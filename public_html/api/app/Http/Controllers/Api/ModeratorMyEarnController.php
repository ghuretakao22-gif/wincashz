<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorMyEarnController extends Controller
{
    /**
     * Get read-only earnings grouped by provider, offer, coins, and payout rate
     * strictly isolated to the authenticated moderator's My ID.
     * Supports quick filters: 'today', 'this_month', 'all' or month string 'YYYY-MM'.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        $currentMonth = Carbon::now('UTC')->format('Y-m');
        $todayDate = Carbon::now('UTC')->format('Y-m-d');

        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'my_id' => $myIdCode !== '' ? $myIdCode : null,
                    'has_my_id' => $myIdCode !== '',
                    'active_period' => 'this_month',
                    'selected_month' => $currentMonth,
                    'months' => [$currentMonth],
                    'summary' => [
                        'total_offers' => 0,
                        'total_coins' => 0.0,
                        'total_usd' => 0.0,
                        'total_bdt' => 0.0,
                        'today_completed_offers' => 0,
                        'today_usd_earn' => 0.0,
                        'today_bdt_earn' => 0.0,
                        'chargebacks_count' => 0,
                        'chargebacks_amount' => 0.0,
                    ],
                    'offer_summary' => [],
                    'items' => [],
                ],
            ]);
        }

        // Generate available months strictly for this My ID from snapshot data
        $rawMonths = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->selectRaw("DISTINCT SUBSTR(COALESCE(completed_at, created_at), 1, 7) as month_val")
            ->whereNotNull(DB::raw("COALESCE(completed_at, created_at)"))
            ->orderByDesc('month_val')
            ->pluck('month_val')
            ->filter(fn ($m) => !empty($m) && preg_match('/^\d{4}-\d{2}$/', (string) $m))
            ->values()
            ->all();

        $allMonths = array_values(array_unique(array_merge([$currentMonth], $rawMonths)));
        rsort($allMonths);

        $requestedPeriod = strtolower(trim((string) $request->input('period', '')));
        $requestedMonth = trim((string) $request->input('month', ''));

        // Determine active filter: 'today', 'this_month', 'all', or custom 'YYYY-MM'
        $activePeriod = 'this_month';
        $selectedMonth = $currentMonth;

        if ($requestedPeriod === 'today' || $requestedMonth === 'today') {
            $activePeriod = 'today';
            $selectedMonth = 'today';
        } elseif ($requestedPeriod === 'all' || $requestedMonth === 'all') {
            $activePeriod = 'all';
            $selectedMonth = 'all';
        } elseif ($requestedMonth !== '' && in_array($requestedMonth, $allMonths, true)) {
            $activePeriod = ($requestedMonth === $currentMonth) ? 'this_month' : 'custom';
            $selectedMonth = $requestedMonth;
        }

        // Query ONLY snapshot fields from my_id_earnings strictly scoped to this My ID
        $query = DB::table('my_id_earnings')->where('my_id_code', $myIdCode);

        if ($activePeriod === 'today') {
            $query->where(function ($q) use ($todayDate) {
                $q->where('completed_at', 'like', $todayDate . '%')
                  ->orWhere(function ($q2) use ($todayDate) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $todayDate . '%');
                  });
            });
        } elseif ($activePeriod === 'all') {
            // No date limit
        } else {
            $targetMonth = ($selectedMonth !== '' && $selectedMonth !== 'all') ? $selectedMonth : $currentMonth;
            $query->where(function ($q) use ($targetMonth) {
                $q->where('completed_at', 'like', $targetMonth . '%')
                  ->orWhere(function ($q2) use ($targetMonth) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $targetMonth . '%');
                  });
            });
        }

        // 1. Offer Summary Table: Exactly 8 columns per specification
        // Columns: 1. Provider, 2. Offer Name, 3. Coin, 4. Today Offers, 5. Total Offers, 6. Offer Price (USD), 7. Net USD, 8. Net BDT
        $offerSummarySub = (clone $query)
            ->selectRaw("
                COALESCE(NULLIF(TRIM(provider), ''), 'Unknown Provider') as norm_provider,
                COALESCE(NULLIF(TRIM(offer_name), ''), NULLIF(TRIM(offer_id), ''), 'Standard Offer') as norm_offer_name,
                COALESCE(coin_amount, 0) as norm_coin_amount,
                COALESCE(payout_usd, 0) as norm_payout_usd,
                COALESCE(payout_bdt, 0) as norm_payout_bdt,
                CASE WHEN COALESCE(completed_at, created_at) LIKE ? THEN 1 ELSE 0 END as is_today
            ", [$todayDate . '%']);

        $offerSummary = DB::query()
            ->fromSub($offerSummarySub, 'off_sub')
            ->selectRaw("
                norm_provider as provider,
                norm_offer_name as offer_name,
                norm_coin_amount as coin,
                SUM(is_today) as today_offers,
                COUNT(*) as total_offers,
                norm_payout_usd as offer_price,
                COALESCE(SUM(norm_payout_usd), 0) as net_usd,
                COALESCE(SUM(norm_payout_bdt), 0) as net_bdt
            ")
            ->groupBy('norm_provider', 'norm_offer_name', 'norm_coin_amount', 'norm_payout_usd')
            ->orderByDesc('total_offers')
            ->orderByDesc('net_usd')
            ->get()
            ->map(function ($row) {
                return [
                    'provider' => (string) $row->provider,
                    'offer_name' => (string) $row->offer_name,
                    'coin' => round((float) $row->coin, 2),
                    'today_offers' => (int) $row->today_offers,
                    'total_offers' => (int) $row->total_offers,
                    'offer_price' => round((float) $row->offer_price, 4),
                    'net_usd' => round((float) $row->net_usd, 2),
                    'net_bdt' => round((float) $row->net_bdt, 2),
                    // Backward-compat keys
                    'total_completed' => (int) $row->total_offers,
                    'earnings_usd' => round((float) $row->net_usd, 2),
                    'earnings_bdt' => round((float) $row->net_bdt, 2),
                ];
            })
            ->values()
            ->all();

        // 2. Detailed grouped items
        $records = $query->get([
            'id',
            'provider',
            'offer_id',
            'offer_name',
            'coin_amount',
            'payout_usd',
            'usd_bdt_rate',
            'payout_bdt',
            'completed_at',
            'created_at',
        ]);

        $grouped = [];
        $totalOffers = 0;
        $totalCoins = 0.0;
        $totalUsd = 0.0;
        $totalBdt = 0.0;

        foreach ($records as $r) {
            $provider = trim((string) ($r->provider ?? 'Unknown Provider'));
            if ($provider === '') {
                $provider = 'Unknown Provider';
            }

            $offer = trim((string) (!empty($r->offer_name) ? $r->offer_name : (!empty($r->offer_id) ? $r->offer_id : 'Standard Offer')));
            if ($offer === '') {
                $offer = 'Standard Offer';
            }

            $coinAmount = (float) ($r->coin_amount ?? 0);
            $rateUsd = (float) ($r->payout_usd ?? 0);
            $payoutBdt = (float) ($r->payout_bdt ?? 0);

            $groupKey = $provider . '___' . $offer . '___' . number_format($coinAmount, 4, '.', '') . '___' . number_format($rateUsd, 4, '.', '');

            if (!isset($grouped[$groupKey])) {
                $grouped[$groupKey] = [
                    'provider' => $provider,
                    'offer' => $offer,
                    'coins' => $coinAmount,
                    'quantity' => 0,
                    'rate_usd' => $rateUsd,
                    'total_usd' => 0.0,
                    'total_bdt' => 0.0,
                ];
            }

            $grouped[$groupKey]['quantity'] += 1;
            $grouped[$groupKey]['total_usd'] += $rateUsd;
            $grouped[$groupKey]['total_bdt'] += $payoutBdt;

            $totalOffers += 1;
            $totalCoins += $coinAmount;
            $totalUsd += $rateUsd;
            $totalBdt += $payoutBdt;
        }

        $items = array_values($grouped);
        usort($items, function ($a, $b) {
            $cmpProvider = strcasecmp($a['provider'], $b['provider']);
            if ($cmpProvider !== 0) {
                return $cmpProvider;
            }
            $cmpOffer = strcasecmp($a['offer'], $b['offer']);
            if ($cmpOffer !== 0) {
                return $cmpOffer;
            }
            return $a['coins'] <=> $b['coins'];
        });

        $sl = 1;
        foreach ($items as &$item) {
            $item['sl'] = $sl++;
            $item['coins'] = round($item['coins'], 2);
            $item['rate_usd'] = round($item['rate_usd'], 2);
            $item['rate_bdt'] = $item['quantity'] > 0 ? round($item['total_bdt'] / $item['quantity'], 2) : 0.0;
            $item['total_usd'] = round($item['total_usd'], 2);
            $item['total_bdt'] = round($item['total_bdt'], 2);
        }
        unset($item);

        // Today stats for this My ID (always computed for today UTC)
        $todayStats = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->where(function ($q) use ($todayDate) {
                $q->where('completed_at', 'like', $todayDate . '%')
                  ->orWhere(function ($q2) use ($todayDate) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $todayDate . '%');
                  });
            })
            ->selectRaw('COUNT(*) as completed_cnt, COALESCE(SUM(payout_usd), 0) as usd_sum, COALESCE(SUM(payout_bdt), 0) as bdt_sum')
            ->first();

        $todayCompletedOffers = (int) ($todayStats->completed_cnt ?? 0);
        $todayUsdEarn = (float) ($todayStats->usd_sum ?? 0);
        $todayBdtEarn = (float) ($todayStats->bdt_sum ?? 0);

        // Chargebacks for users linked to this My ID
        $chargebacksCount = 0;
        $chargebacksAmount = 0.0;
        if (Schema::hasTable('chargebacks')) {
            $linkedUserIds = User::query()->where('my_id', $myIdCode)->pluck('id');
            if ($linkedUserIds->isNotEmpty()) {
                $cbQuery = DB::table('chargebacks')->whereIn('user_id', $linkedUserIds);
                if ($activePeriod === 'today') {
                    $cbQuery->where('created_at', 'like', $todayDate . '%');
                } elseif ($activePeriod !== 'all') {
                    $targetMonth = ($selectedMonth !== '' && $selectedMonth !== 'all') ? $selectedMonth : $currentMonth;
                    $cbQuery->where('created_at', 'like', $targetMonth . '%');
                }
                $chargebacksCount = (int) (clone $cbQuery)->count();
                $chargebacksAmount = (float) (clone $cbQuery)->sum('currency_reward');
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'my_id' => $myIdCode,
                'has_my_id' => true,
                'active_period' => $activePeriod,
                'selected_month' => $selectedMonth,
                'months' => $allMonths,
                'summary' => [
                    'total_offers' => $totalOffers,
                    'total_coins' => round($totalCoins, 2),
                    'total_usd' => round($totalUsd, 2),
                    'total_bdt' => round($totalBdt, 2),
                    'today_completed_offers' => $todayCompletedOffers,
                    'today_usd_earn' => round($todayUsdEarn, 2),
                    'today_bdt_earn' => round($todayBdtEarn, 2),
                    'chargebacks_count' => $chargebacksCount,
                    'chargebacks_amount' => round($chargebacksAmount, 2),
                ],
                'offer_summary' => $offerSummary,
                'items' => $items,
            ],
        ]);
    }
}
