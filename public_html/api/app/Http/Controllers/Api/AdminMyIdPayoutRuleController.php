<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyIdPayoutRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminMyIdPayoutRuleController extends Controller
{
    /**
     * Display a paginated listing of payout rules with today_count and total_count per rule.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $providerFilter = trim((string) $request->query('provider', ''));
        $statusFilter = trim((string) $request->query('status', '')); // 'active', 'inactive', 'all'
        $perPage = (int) $request->query('per_page', 20);
        if ($perPage < 5 || $perPage > 100) {
            $perPage = 20;
        }

        $query = MyIdPayoutRule::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('provider', 'like', "%{$search}%")
                  ->orWhere('offer_id', 'like', "%{$search}%")
                  ->orWhere('offer_name', 'like', "%{$search}%")
                  ->orWhere('coin_amount', 'like', "%{$search}%");
            });
        }

        if ($providerFilter !== '') {
            $query->whereRaw('LOWER(provider) = ?', [strtolower($providerFilter)]);
        }

        if ($statusFilter === 'active') {
            $query->where('is_active', true);
        } elseif ($statusFilter === 'inactive') {
            $query->where('is_active', false);
        }

        $allRules = $query->orderByDesc('id')->get();

        // Compute Today Count and Total Count for each rule from my_id_earnings
        $todayDate = Carbon::now('UTC')->format('Y-m-d');
        $earningsRows = collect();

        if (Schema::hasTable('my_id_earnings')) {
            $earningsRows = DB::table('my_id_earnings')
                ->selectRaw("
                    LOWER(TRIM(provider)) as norm_provider,
                    CASE WHEN offer_id IS NOT NULL AND TRIM(offer_id) != '' THEN LOWER(TRIM(offer_id)) ELSE NULL END as norm_offer_id,
                    coin_amount,
                    COUNT(*) as total_count,
                    COALESCE(SUM(CASE WHEN (completed_at LIKE '{$todayDate}%' OR (completed_at IS NULL AND created_at LIKE '{$todayDate}%')) THEN 1 ELSE 0 END), 0) as today_count
                ")
                ->groupBy(
                    DB::raw("LOWER(TRIM(provider))"),
                    DB::raw("CASE WHEN offer_id IS NOT NULL AND TRIM(offer_id) != '' THEN LOWER(TRIM(offer_id)) ELSE NULL END"),
                    'coin_amount'
                )
                ->get();
        }

        // 1. Index specific rules first
        $specificRuleMap = [];
        foreach ($allRules as $r) {
            if ($r->offer_id !== null && trim((string) $r->offer_id) !== '') {
                $key = strtolower(trim((string) $r->provider)) . '|' . strtolower(trim((string) $r->offer_id)) . '|' . number_format((float) $r->coin_amount, 4, '.', '');
                $specificRuleMap[$key] = true;
            }
        }

        // Attach counts to rules
        $decoratedRules = $allRules->map(function (MyIdPayoutRule $rule) use ($earningsRows, $specificRuleMap): array {
            $normProv = strtolower(trim((string) $rule->provider));
            $normOffer = $rule->offer_id !== null && trim((string) $rule->offer_id) !== '' ? strtolower(trim((string) $rule->offer_id)) : null;
            $coins = (float) $rule->coin_amount;

            $todayCount = 0;
            $totalCount = 0;

            if ($normOffer !== null) {
                // Specific rule: match exact provider, offer_id, and coins
                $matched = $earningsRows->first(function ($row) use ($normProv, $normOffer, $coins) {
                    return $row->norm_provider === $normProv 
                        && $row->norm_offer_id === $normOffer 
                        && (abs(((float) $row->coin_amount) - $coins) < 0.0001);
                });

                if ($matched) {
                    $todayCount = (int) $matched->today_count;
                    $totalCount = (int) $matched->total_count;
                }
            } else {
                // Wildcard rule: match provider and coins, but exclude earnings claimed by specific rules
                $matchedRows = $earningsRows->filter(function ($row) use ($normProv, $coins, $specificRuleMap) {
                    if ($row->norm_provider !== $normProv || abs(((float) $row->coin_amount) - $coins) >= 0.0001) {
                        return false;
                    }

                    if ($row->norm_offer_id !== null) {
                        $specificKey = $normProv . '|' . $row->norm_offer_id . '|' . number_format($coins, 4, '.', '');
                        if (isset($specificRuleMap[$specificKey])) {
                            return false; // Claimed by specific rule
                        }
                    }

                    return true;
                });

                $todayCount = (int) $matchedRows->sum('today_count');
                $totalCount = (int) $matchedRows->sum('total_count');
            }

            return array_merge($rule->toArray(), [
                'today_count' => $todayCount,
                'total_count' => $totalCount,
            ]);
        });

        // Paginate manually over the decorated collection to keep counts accurate
        $page = (int) $request->query('page', 1);
        if ($page < 1) {
            $page = 1;
        }
        $totalItems = $decoratedRules->count();
        $lastPage = max(1, (int) ceil($totalItems / $perPage));
        if ($page > $lastPage) {
            $page = $lastPage;
        }

        $items = $decoratedRules->slice(($page - 1) * $perPage, $perPage)->values()->all();

        return response()->json([
            'success' => true,
            'data' => $items,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $totalItems,
            ],
            'summary' => [
                'total_rules' => $totalItems,
                'active_rules' => $decoratedRules->where('is_active', true)->count(),
                'disabled_rules' => $decoratedRules->where('is_active', false)->count(),
                'today_completions' => (int) $decoratedRules->sum('today_count'),
                'total_completions' => (int) $decoratedRules->sum('total_count'),
            ],
        ]);
    }

    /**
     * Store a newly created payout rule with uniqueness validation.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['required', 'string', 'max:100'],
            'offer_id' => ['nullable', 'string', 'max:255'],
            'offer_name' => ['nullable', 'string', 'max:255'],
            'coin_amount' => ['required', 'numeric', 'min:0'],
            'user_payout_usd' => ['required', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'provider.required' => 'Provider name is required.',
            'coin_amount.required' => 'Credited coin amount is required.',
            'user_payout_usd.required' => 'User payout USD is required.',
        ]);

        $cleanProvider = trim($validated['provider']);
        $rawOfferId = isset($validated['offer_id']) ? trim((string) $validated['offer_id']) : '';
        $cleanOfferId = ($rawOfferId !== '' && $rawOfferId !== '-') ? $rawOfferId : null;
        $cleanOfferName = isset($validated['offer_name']) && trim((string) $validated['offer_name']) !== '' ? trim((string) $validated['offer_name']) : null;
        $coinAmount = (float) $validated['coin_amount'];
        $userPayoutUsd = (float) $validated['user_payout_usd'];
        $isActive = $request->has('is_active') ? (bool) $request->input('is_active') : true;

        // Conflict check: Provider + Coin + Offer ID combination must not already exist
        $conflictQuery = MyIdPayoutRule::query()
            ->whereRaw('LOWER(provider) = ?', [strtolower($cleanProvider)])
            ->where('coin_amount', $coinAmount);

        if ($cleanOfferId !== null) {
            $conflictQuery->whereRaw('LOWER(offer_id) = ?', [strtolower($cleanOfferId)]);
        } else {
            $conflictQuery->whereNull('offer_id');
        }

        if ($conflictQuery->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'A payout rule for this provider, coin amount, and offer ID already exists.',
                'errors' => [
                    'provider' => ['A payout rule for this provider, coin amount, and offer ID already exists.'],
                ],
            ], 422);
        }

        $rule = MyIdPayoutRule::create([
            'provider' => $cleanProvider,
            'offer_id' => $cleanOfferId,
            'offer_name' => $cleanOfferName,
            'coin_amount' => $coinAmount,
            'user_payout_usd' => $userPayoutUsd,
            'is_active' => $isActive,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payout rule created successfully.',
            'data' => $rule,
        ], 201);
    }

    /**
     * Update the specified payout rule with conflict validation.
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $rule = MyIdPayoutRule::query()->findOrFail($id);

        $validated = $request->validate([
            'provider' => ['nullable', 'string', 'max:100'],
            'offer_id' => ['nullable', 'string', 'max:255'],
            'offer_name' => ['nullable', 'string', 'max:255'],
            'coin_amount' => ['nullable', 'numeric', 'min:0'],
            'user_payout_usd' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $newProvider = $request->has('provider') ? trim((string) $request->input('provider')) : $rule->provider;
        $newOfferId = $rule->offer_id;
        if ($request->has('offer_id')) {
            $rawOfferId = trim((string) $request->input('offer_id', ''));
            $newOfferId = ($rawOfferId !== '' && $rawOfferId !== '-') ? $rawOfferId : null;
        }
        $newCoins = $request->has('coin_amount') ? (float) $request->input('coin_amount') : (float) $rule->coin_amount;

        // Conflict check: make sure new combination does not conflict with another existing rule
        $conflictQuery = MyIdPayoutRule::query()
            ->where('id', '!=', $rule->id)
            ->whereRaw('LOWER(provider) = ?', [strtolower($newProvider)])
            ->where('coin_amount', $newCoins);

        if ($newOfferId !== null) {
            $conflictQuery->whereRaw('LOWER(offer_id) = ?', [strtolower($newOfferId)]);
        } else {
            $conflictQuery->whereNull('offer_id');
        }

        if ($conflictQuery->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Another payout rule for this provider, coin amount, and offer ID already exists.',
                'errors' => [
                    'provider' => ['Another payout rule for this provider, coin amount, and offer ID already exists.'],
                ],
            ], 422);
        }

        $rule->provider = $newProvider;
        $rule->offer_id = $newOfferId;

        if ($request->has('offer_name')) {
            $offerName = trim((string) $request->input('offer_name', ''));
            $rule->offer_name = $offerName !== '' ? $offerName : null;
        }

        if ($request->has('coin_amount')) {
            $rule->coin_amount = $newCoins;
        }

        if ($request->has('user_payout_usd')) {
            $rule->user_payout_usd = (float) $request->input('user_payout_usd');
        }

        if ($request->has('is_active')) {
            $rule->is_active = (bool) $request->input('is_active');
        }

        $rule->save();

        return response()->json([
            'success' => true,
            'message' => 'Payout rule updated successfully.',
            'data' => $rule,
        ]);
    }

    /**
     * Delete the specified payout rule.
     */
    public function destroy(int|string $id): JsonResponse
    {
        $rule = MyIdPayoutRule::query()->findOrFail($id);
        $rule->delete();

        return response()->json([
            'success' => true,
            'message' => 'Payout rule deleted successfully.',
        ]);
    }
}
