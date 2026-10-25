<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorMyEarnController extends Controller
{
    /**
     * Get read-only monthly earnings grouped by provider, offer, coins, and payout rate
     * strictly isolated to the authenticated moderator's My ID.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();

        $myIdCode = trim((string) ($user?->my_id ?? ''));

        $currentMonth = Carbon::now('UTC')->format('Y-m');

        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'my_id' => $myIdCode !== '' ? $myIdCode : null,
                    'has_my_id' => $myIdCode !== '',
                    'selected_month' => $currentMonth,
                    'months' => [$currentMonth],
                    'summary' => [
                        'total_offers' => 0,
                        'total_coins' => 0.0,
                        'total_usd' => 0.0,
                        'total_bdt' => 0.0,
                    ],
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

        $requestedMonth = trim((string) $request->input('month', ''));
        $selectedMonth = ($requestedMonth !== '' && (in_array($requestedMonth, $allMonths, true) || $requestedMonth === 'all'))
            ? $requestedMonth
            : $currentMonth;

        // Query ONLY snapshot fields from my_id_earnings (never use completed_tasks.revenue or current payout rules)
        $query = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode);

        if ($selectedMonth !== 'all') {
            $query->where(function ($q) use ($selectedMonth) {
                $q->where('completed_at', 'like', $selectedMonth . '%')
                  ->orWhere(function ($q2) use ($selectedMonth) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $selectedMonth . '%');
                  });
            });
        }

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

            // Grouping key: Provider + Offer + Coins + Payout Rate (USD)
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

        // Sorting: Provider ASC, Offer ASC, Coin Amount ASC
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

        // Format numeric totals
        foreach ($items as &$item) {
            $item['coins'] = round($item['coins'], 2);
            $item['rate_usd'] = round($item['rate_usd'], 2);
            $item['total_usd'] = round($item['total_usd'], 2);
            $item['total_bdt'] = round($item['total_bdt'], 2);
        }
        unset($item);

        return response()->json([
            'status' => 'success',
            'data' => [
                'my_id' => $myIdCode,
                'has_my_id' => true,
                'selected_month' => $selectedMonth,
                'months' => $allMonths,
                'summary' => [
                    'total_offers' => $totalOffers,
                    'total_coins' => round($totalCoins, 2),
                    'total_usd' => round($totalUsd, 2),
                    'total_bdt' => round($totalBdt, 2),
                ],
                'items' => $items,
            ],
        ]);
    }
}
