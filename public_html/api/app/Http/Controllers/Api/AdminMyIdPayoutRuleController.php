<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyIdPayoutRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminMyIdPayoutRuleController extends Controller
{
    /**
     * Display a listing of payout rules with optional search/filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $providerFilter = trim((string) $request->query('provider', ''));

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

        $rules = $query->orderByDesc('id')->get();

        return response()->json([
            'success' => true,
            'data' => $rules,
        ]);
    }

    /**
     * Store a newly created payout rule.
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

        $rule = MyIdPayoutRule::create([
            'provider' => trim($validated['provider']),
            'offer_id' => isset($validated['offer_id']) && trim((string) $validated['offer_id']) !== '' ? trim((string) $validated['offer_id']) : null,
            'offer_name' => isset($validated['offer_name']) && trim((string) $validated['offer_name']) !== '' ? trim((string) $validated['offer_name']) : null,
            'coin_amount' => (float) $validated['coin_amount'],
            'user_payout_usd' => (float) $validated['user_payout_usd'],
            'is_active' => $request->has('is_active') ? (bool) $request->input('is_active') : true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Payout rule created successfully.',
            'data' => $rule,
        ], 201);
    }

    /**
     * Update the specified payout rule.
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

        if ($request->has('provider')) {
            $rule->provider = trim((string) $request->input('provider'));
        }

        if ($request->has('offer_id')) {
            $offerId = trim((string) $request->input('offer_id', ''));
            $rule->offer_id = $offerId !== '' ? $offerId : null;
        }

        if ($request->has('offer_name')) {
            $offerName = trim((string) $request->input('offer_name', ''));
            $rule->offer_name = $offerName !== '' ? $offerName : null;
        }

        if ($request->has('coin_amount')) {
            $rule->coin_amount = (float) $request->input('coin_amount');
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
