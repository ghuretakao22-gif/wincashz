<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyId;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorDashboardController extends Controller
{
    /**
     * Get Moderator Dashboard data:
     * - Top cards: My ID, Friendly Name, Linked Users, Completed Offers, Total USD Earn, Total BDT Earn
     * - Month filter (current month default, previous months from earning ledger)
     * - Grouped Earning Table (SL, Wall/Provider, Offer, Coins, Quantity, USD Rate, BDT Rate, Total BDT)
     * - Leaderboard: Top 5 My IDs by Total BDT (with friendly names and offers)
     * - Moderator's own rank card (even if outside Top 5)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        $currentMonth = Carbon::now('UTC')->format('Y-m');

        // Available months from snapshot earnings across the ledger
        $rawMonths = [];
        if (Schema::hasTable('my_id_earnings')) {
            $rawMonths = DB::table('my_id_earnings')
                ->selectRaw("DISTINCT SUBSTR(COALESCE(completed_at, created_at), 1, 7) as month_val")
                ->whereNotNull(DB::raw("COALESCE(completed_at, created_at)"))
                ->orderByDesc('month_val')
                ->pluck('month_val')
                ->filter(fn ($m) => !empty($m) && preg_match('/^\d{4}-\d{2}$/', (string) $m))
                ->values()
                ->all();
        }

        $allMonths = array_values(array_unique(array_merge([$currentMonth], $rawMonths)));
        rsort($allMonths);

        $requestedMonth = trim((string) $request->input('month', ''));
        $selectedMonth = ($requestedMonth !== '' && (in_array($requestedMonth, $allMonths, true) || $requestedMonth === 'all'))
            ? $requestedMonth
            : $currentMonth;

        // If user has no My ID or my_id_earnings table does not exist
        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'my_id' => $myIdCode !== '' ? $myIdCode : null,
                    'friendly_name' => null,
                    'has_my_id' => $myIdCode !== '',
                    'total_linked_users' => 0,
                    'selected_month' => $selectedMonth,
                    'months' => $allMonths,
                    'summary' => [
                        'total_linked_users' => 0,
                        'total_completed_offers' => 0,
                        'total_usd_earn' => 0.0,
                        'total_bdt_earn' => 0.0,
                    ],
                    'items' => [],
                    'leaderboard' => [
                        'top_5' => [],
                        'own_rank' => null,
                    ],
                ],
            ]);
        }

        // Fetch My ID record details
        $myIdRecord = MyId::query()->where('my_id_code', $myIdCode)->first();
        $friendlyName = $myIdRecord?->friendly_name;

        // Total linked users assigned to this My ID
        $totalLinkedUsers = User::query()->where('my_id', $myIdCode)->count();

        // Query earnings strictly isolated to this My ID
        $earningsQuery = DB::table('my_id_earnings')->where('my_id_code', $myIdCode);
        if ($selectedMonth !== 'all') {
            $earningsQuery->where(function ($q) use ($selectedMonth) {
                $q->where('completed_at', 'like', $selectedMonth . '%')
                  ->orWhere(function ($q2) use ($selectedMonth) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $selectedMonth . '%');
                  });
            });
        }

        $records = $earningsQuery->get([
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
        $totalCompletedOffers = 0;
        $totalUsdEarn = 0.0;
        $totalBdtEarn = 0.0;

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

            $totalCompletedOffers += 1;
            $totalUsdEarn += $rateUsd;
            $totalBdtEarn += $payoutBdt;
        }

        // Sort items: Provider ASC, Offer ASC, Coins ASC
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

        // Add SL and format amounts
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

        // Leaderboard calculation across all My IDs for the selected month
        $leaderboardQuery = DB::table('my_id_earnings');
        if ($selectedMonth !== 'all') {
            $leaderboardQuery->where(function ($q) use ($selectedMonth) {
                $q->where('completed_at', 'like', $selectedMonth . '%')
                  ->orWhere(function ($q2) use ($selectedMonth) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $selectedMonth . '%');
                  });
            });
        }

        $aggregated = $leaderboardQuery
            ->selectRaw('my_id_code, COUNT(*) as completed_offers, COALESCE(SUM(payout_bdt), 0) as total_bdt, COALESCE(SUM(payout_usd), 0) as total_usd')
            ->groupBy('my_id_code')
            ->orderByDesc('total_bdt')
            ->orderByDesc('completed_offers')
            ->get();

        $myIdsMap = MyId::query()->pluck('friendly_name', 'my_id_code')->all();

        $rankedList = [];
        $ownRankData = null;

        foreach ($aggregated as $idx => $row) {
            $code = (string) $row->my_id_code;
            $offers = (int) $row->completed_offers;
            $bdt = round((float) $row->total_bdt, 2);
            $rankNum = $idx + 1;
            $fn = $myIdsMap[$code] ?? null;

            $item = [
                'rank' => $rankNum,
                'my_id_code' => $code,
                'friendly_name' => $fn,
                'completed_offers' => $offers,
                'total_bdt' => $bdt,
            ];

            $rankedList[] = $item;

            if ($code === $myIdCode) {
                $ownRankData = $item;
            }
        }

        $top5 = array_slice($rankedList, 0, 5);

        // If current moderator has 0 earnings in the selected month
        if (!$ownRankData) {
            $ownRankData = [
                'rank' => count($rankedList) + 1,
                'my_id_code' => $myIdCode,
                'friendly_name' => $friendlyName,
                'completed_offers' => 0,
                'total_bdt' => 0.0,
                'is_unranked' => count($rankedList) > 0,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'my_id' => $myIdCode,
                'friendly_name' => $friendlyName,
                'has_my_id' => true,
                'total_linked_users' => $totalLinkedUsers,
                'selected_month' => $selectedMonth,
                'months' => $allMonths,
                'summary' => [
                    'my_id' => $myIdCode,
                    'friendly_name' => $friendlyName,
                    'total_linked_users' => $totalLinkedUsers,
                    'total_completed_offers' => $totalCompletedOffers,
                    'total_usd_earn' => round($totalUsdEarn, 2),
                    'total_bdt_earn' => round($totalBdtEarn, 2),
                ],
                'items' => $items,
                'leaderboard' => [
                    'top_5' => $top5,
                    'own_rank' => $ownRankData,
                ],
            ],
        ]);
    }
}
