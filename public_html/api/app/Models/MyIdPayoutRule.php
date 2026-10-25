<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MyIdPayoutRule extends Model
{
    use HasFactory;

    protected $table = 'my_id_payout_rules';

    protected $fillable = [
        'provider',
        'offer_id',
        'offer_name',
        'coin_amount',
        'user_payout_usd',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'coin_amount' => 'decimal:4',
            'user_payout_usd' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Resolve the My ID worker payout for a completed offer.
     *
     * Matching rules:
     * - Must match provider (case-insensitive)
     * - Must match coin amount
     * - If rule specifies offer_id: must match offer_id (case-insensitive)
     * - Active rules only
     * - Exact match (provider + offer_id + coins) prioritised over provider + coins (fallback)
     * - If no rule matches: returns UNMAPPED status with null payout.
     *   Never guesses payout. Never uses raw provider revenue.
     *
     * @param string $provider
     * @param string|null $offerId
     * @param float|int|string $coinAmount
     * @return array{matched: bool, payout_usd: float|null, status: string, rule: MyIdPayoutRule|null}
     */
    public static function resolvePayout(string $provider, ?string $offerId, float|int|string $coinAmount): array
    {
        $normalizedProvider = strtolower(trim($provider));
        $normalizedOfferId = $offerId !== null && trim((string) $offerId) !== '' ? trim((string) $offerId) : null;
        $numericCoins = (float) $coinAmount;

        // 1. Try exact match on provider + offer_id + coin_amount
        if ($normalizedOfferId !== null) {
            $exactRule = static::query()
                ->where('is_active', true)
                ->whereRaw('LOWER(provider) = ?', [$normalizedProvider])
                ->whereRaw('LOWER(offer_id) = ?', [strtolower($normalizedOfferId)])
                ->where('coin_amount', $numericCoins)
                ->orderByDesc('id')
                ->first();

            if ($exactRule) {
                return [
                    'matched' => true,
                    'payout_usd' => (float) $exactRule->user_payout_usd,
                    'status' => 'MAPPED',
                    'rule' => $exactRule,
                ];
            }
        }

        // 2. Try match on provider + coin_amount where offer_id is null/wildcard
        $wildcardRule = static::query()
            ->where('is_active', true)
            ->whereRaw('LOWER(provider) = ?', [$normalizedProvider])
            ->whereNull('offer_id')
            ->where('coin_amount', $numericCoins)
            ->orderByDesc('id')
            ->first();

        if ($wildcardRule) {
            return [
                'matched' => true,
                'payout_usd' => (float) $wildcardRule->user_payout_usd,
                'status' => 'MAPPED',
                'rule' => $wildcardRule,
            ];
        }

        // 3. UNMAPPED: Never guess, never use provider revenue
        return [
            'matched' => false,
            'payout_usd' => null,
            'status' => 'UNMAPPED',
            'rule' => null,
        ];
    }
}
