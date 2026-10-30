<?php

namespace App\Services;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdEarning;
use App\Models\MyIdPayoutRule;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;

class MyIdEarningService
{
    public const SETTING_SYSTEM_ENABLED = 'my_id_system_enabled';
    public const SETTING_START_DATE = 'my_id_start_date';
    public const SETTING_USD_BDT_RATE = 'my_id_usd_bdt_rate';

    public const DEFAULT_USD_BDT_RATE = 122.00;

    /**
     * Check if My ID earning system is active.
     */
    public static function isSystemEnabled(): bool
    {
        return Setting::boolean(self::SETTING_SYSTEM_ENABLED, false);
    }

    /**
     * Get start date timestamp in UTC (or null).
     */
    public static function getStartDate(): ?Carbon
    {
        $raw = trim(Setting::value(self::SETTING_START_DATE, ''));
        if ($raw === '') {
            return null;
        }

        try {
            return Carbon::parse($raw, 'UTC')->setTimezone('UTC');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Get global USD to BDT exchange rate.
     */
    public static function getUsdBdtRate(): float
    {
        $raw = trim(Setting::value(self::SETTING_USD_BDT_RATE, ''));
        if ($raw === '' || !is_numeric($raw)) {
            return self::DEFAULT_USD_BDT_RATE;
        }

        return (float) $raw;
    }

    /**
     * Convert USD to BDT using current global rate or specified rate.
     */
    public static function convertUsdToBdt(float $usd, ?float $rate = null): float
    {
        $activeRate = $rate ?? static::getUsdBdtRate();
        return round($usd * $activeRate, 2);
    }

    /**
     * Check if a task date is eligible under system enabled and start date rules.
     */
    public static function isTaskEligibleByDate(Carbon|string $taskCreatedAt): bool
    {
        if (!static::isSystemEnabled()) {
            return false;
        }

        $startDate = static::getStartDate();
        if ($startDate === null) {
            return true;
        }

        $taskDate = $taskCreatedAt instanceof Carbon 
            ? $taskCreatedAt->copy()->setTimezone('UTC') 
            : Carbon::parse($taskCreatedAt, 'UTC')->setTimezone('UTC');

        return $taskDate->greaterThanOrEqualTo($startDate);
    }

    /**
     * Calculate payout for a completed task without exposing provider revenue.
     *
     * @param CompletedTask $task
     * @return array{
     *   eligible: bool,
     *   reason?: string,
     *   status: string,
     *   payout_usd: float|null,
     *   payout_bdt: float|null,
     *   usd_bdt_rate: float
     * }
     */
    public static function evaluateTaskPayout(CompletedTask $task): array
    {
        $rate = static::getUsdBdtRate();

        if (!static::isSystemEnabled()) {
            return [
                'eligible' => false,
                'reason' => 'system_disabled',
                'status' => 'SYSTEM_DISABLED',
                'payout_usd' => null,
                'payout_bdt' => null,
                'usd_bdt_rate' => $rate,
            ];
        }

        if (!static::isTaskEligibleByDate($task->created_at)) {
            return [
                'eligible' => false,
                'reason' => 'pre_start_date',
                'status' => 'PRE_START_EXCLUDED',
                'payout_usd' => null,
                'payout_bdt' => null,
                'usd_bdt_rate' => $rate,
            ];
        }

        // Match against payout rules using provider, offer_id, and currency_reward (coins)
        // NEVER USE $task->revenue
        $resolved = MyIdPayoutRule::resolvePayout(
            (string) ($task->offer_wall_name ?? ''),
            (string) ($task->offer_id ?? ''),
            $task->currency_reward ?? 0
        );

        if (!$resolved['matched'] || $resolved['payout_usd'] === null) {
            return [
                'eligible' => true,
                'reason' => 'unmapped_rule',
                'status' => 'UNMAPPED',
                'payout_usd' => 0.0,
                'payout_bdt' => 0.0,
                'usd_bdt_rate' => 0.0,
            ];
        }

        $payoutUsd = (float) $resolved['payout_usd'];
        $ruleRate = (float) ($resolved['rule']?->usd_bdt_rate ?? 0);
        if ($ruleRate <= 0) {
            $ruleRate = static::getUsdBdtRate();
        }
        $payoutBdt = round($payoutUsd * $ruleRate, 2);

        return [
            'eligible' => true,
            'status' => 'MAPPED',
            'payout_usd' => $payoutUsd,
            'payout_bdt' => $payoutBdt,
            'usd_bdt_rate' => $ruleRate,
        ];
    }

    /**
     * Record an immutable earning ledger row for an eligible completed task.
     *
     * @param CompletedTask $task
     * @return array{
     *   created: bool,
     *   status: string,
     *   reason?: string,
     *   earning: MyIdEarning|null,
     *   payout_usd: float|null,
     *   usd_bdt_rate: float,
     *   payout_bdt: float|null
     * }
     */
    public static function recordTaskEarning(CompletedTask $task): array
    {
        $rate = static::getUsdBdtRate();

        // 1. Check duplicate task protection
        $existing = MyIdEarning::where('completed_task_id', $task->id)->first();
        if ($existing) {
            return [
                'created' => false,
                'status' => 'ALREADY_RECORDED',
                'reason' => 'duplicate_task',
                'earning' => $existing,
                'payout_usd' => (float) $existing->payout_usd,
                'usd_bdt_rate' => (float) $existing->usd_bdt_rate,
                'payout_bdt' => (float) $existing->payout_bdt,
            ];
        }

        // 2. Check system enabled
        if (!static::isSystemEnabled()) {
            return [
                'created' => false,
                'status' => 'SYSTEM_DISABLED',
                'reason' => 'system_disabled',
                'earning' => null,
                'payout_usd' => null,
                'usd_bdt_rate' => $rate,
                'payout_bdt' => null,
            ];
        }

        // 3. Check start date eligibility
        if (!static::isTaskEligibleByDate($task->created_at)) {
            return [
                'created' => false,
                'status' => 'PRE_START_EXCLUDED',
                'reason' => 'pre_start_date',
                'earning' => null,
                'payout_usd' => null,
                'usd_bdt_rate' => $rate,
                'payout_bdt' => null,
            ];
        }

        // 4. Resolve User and My ID
        $user = null;
        if (!empty($task->user_id)) {
            $user = User::find($task->user_id);
        }
        if (!$user && !empty($task->user_name)) {
            $user = User::where('name', $task->user_name)->orWhere('username', $task->user_name)->first();
        }

        if (!$user) {
            return [
                'created' => false,
                'status' => 'USER_NOT_FOUND',
                'reason' => 'user_not_found',
                'earning' => null,
                'payout_usd' => null,
                'usd_bdt_rate' => $rate,
                'payout_bdt' => null,
            ];
        }

        if (empty($user->my_id)) {
            return [
                'created' => false,
                'status' => 'NO_MY_ID',
                'reason' => 'user_has_no_my_id',
                'earning' => null,
                'payout_usd' => null,
                'usd_bdt_rate' => $rate,
                'payout_bdt' => null,
            ];
        }

        $myId = MyId::where('my_id_code', $user->my_id)->first();
        if (!$myId || !$myId->is_active) {
            return [
                'created' => false,
                'status' => 'INACTIVE_MY_ID',
                'reason' => 'my_id_inactive_or_missing',
                'earning' => null,
                'payout_usd' => null,
                'usd_bdt_rate' => $rate,
                'payout_bdt' => null,
            ];
        }

        // 5. Match payout rule (NEVER use $task->revenue)
        $resolved = MyIdPayoutRule::resolvePayout(
            (string) ($task->offer_wall_name ?? ''),
            (string) ($task->offer_id ?? ''),
            $task->currency_reward ?? 0
        );

        $isMapped = ($resolved['matched'] && $resolved['payout_usd'] !== null);

        if ($isMapped) {
            $payoutUsd = (float) $resolved['payout_usd'];
            $ruleRate = (float) ($resolved['rule']?->usd_bdt_rate ?? 0);
            if ($ruleRate <= 0) {
                $ruleRate = static::getUsdBdtRate();
            }
            $payoutBdt = round($payoutUsd * $ruleRate, 2);
            $activeUsdBdtRate = $ruleRate;
            $recordStatus = 'RECORDED';
        } else {
            // UNMAPPED: worker completed an offer with no matching rule yet
            // Still insert my_id_earnings so Moderator counts Today/Total Offers, money = 0
            $payoutUsd = 0.0;
            $activeUsdBdtRate = 0.0;
            $payoutBdt = 0.0;
            $recordStatus = 'UNMAPPED_RECORDED';
        }

        // 6. Create ledger record with snapshot values
        try {
            $earning = MyIdEarning::create([
                'my_id_code' => $user->my_id,
                'user_id' => $user->id,
                'completed_task_id' => $task->id,
                'provider' => (string) ($task->offer_wall_name ?? ''),
                'offer_id' => $task->offer_id !== null ? (string) $task->offer_id : null,
                'offer_name' => $task->offer_name !== null ? (string) $task->offer_name : null,
                'coin_amount' => (float) ($task->currency_reward ?? 0),
                'payout_usd' => $payoutUsd,
                'usd_bdt_rate' => $activeUsdBdtRate,
                'payout_bdt' => $payoutBdt,
                'completed_at' => $task->created_at,
            ]);

            return [
                'created' => true,
                'status' => $recordStatus,
                'earning' => $earning,
                'payout_usd' => $payoutUsd,
                'usd_bdt_rate' => $activeUsdBdtRate,
                'payout_bdt' => $payoutBdt,
            ];
        } catch (QueryException $e) {
            // Guard duplicate key on completed_task_id
            $existing = MyIdEarning::where('completed_task_id', $task->id)->first();
            if ($existing) {
                return [
                    'created' => false,
                    'status' => 'ALREADY_RECORDED',
                    'reason' => 'duplicate_task',
                    'earning' => $existing,
                    'payout_usd' => (float) $existing->payout_usd,
                    'usd_bdt_rate' => (float) $existing->usd_bdt_rate,
                    'payout_bdt' => (float) $existing->payout_bdt,
                ];
            }

            throw $e;
        }
    }
}
