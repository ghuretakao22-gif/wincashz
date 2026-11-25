<?php

namespace App\Services;

use App\Models\CompletedTask;
use App\Models\MyIdEarning;
use App\Models\MyIdPayout;
use App\Models\MyIdPayoutRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PayoutRuleSyncService
{
    /**
     * Resolve the live payout rule amounts for a completed task or earning row.
     *
     * Strictly uses the currently active MyIdPayoutRule hierarchy:
     * 1. Exact match (provider + offer_id + coin_amount)
     * 2. Wildcard match (provider + null/empty/'-' offer_id + coin_amount)
     * 3. Unmapped (no active rule) -> 0.00
     *
     * If a matching active rule explicitly sets user_payout_usd = 0, strictly returns 0.00.
     *
     * @param CompletedTask|MyIdEarning|object $task
     * @return array{
     *   matched: bool,
     *   payout_usd: float,
     *   usd_bdt_rate: float,
     *   payout_bdt: float,
     *   rule: MyIdPayoutRule|null
     * }
     */
    public static function resolveRuleAmountForTask(object $task): array
    {
        $provider = (string) ($task->offer_wall_name ?? $task->provider ?? '');
        $offerId = $task->offer_id !== null ? (string) $task->offer_id : null;
        $coinAmount = $task->currency_reward ?? $task->coin_amount ?? 0;

        $resolved = MyIdPayoutRule::resolvePayout($provider, $offerId, $coinAmount);

        if ($resolved['matched'] && $resolved['payout_usd'] !== null) {
            $payoutUsd = round((float) $resolved['payout_usd'], 4);
            if ($payoutUsd <= 0.0) {
                $payoutUsd = 0.0;
            }

            $usdBdtRate = (float) ($resolved['usd_bdt_rate'] ?? 0);
            if ($usdBdtRate <= 0.0) {
                $usdBdtRate = MyIdEarningService::getUsdBdtRate();
            }

            $payoutBdt = round($payoutUsd * $usdBdtRate, 2);

            return [
                'matched' => true,
                'payout_usd' => $payoutUsd,
                'usd_bdt_rate' => $usdBdtRate,
                'payout_bdt' => $payoutBdt,
                'rule' => $resolved['rule'] ?? null,
            ];
        }

        return [
            'matched' => false,
            'payout_usd' => 0.0,
            'usd_bdt_rate' => 0.0,
            'payout_bdt' => 0.0,
            'rule' => null,
        ];
    }

    /**
     * Recalculate and synchronize ALL completed offer earnings, unpaid My ID payout
     * requests, and totals site-wide against the current active Payout Rules.
     *
     * Idempotent & transactional: running 1 time or 10 times produces identical totals.
     *
     * @return array{
     *   updated_tasks_count: int,
     *   affected_users_count: int,
     *   affected_my_ids_count: int,
     *   total_payout_before: float,
     *   total_payout_after: float
     * }
     */
    public static function syncAllCompletedOffers(): array
    {
        return DB::transaction(function (): array {
            if (!Schema::hasTable('my_id_earnings') || !Schema::hasTable('my_id_payout_rules')) {
                return [
                    'updated_tasks_count' => 0,
                    'affected_users_count' => 0,
                    'affected_my_ids_count' => 0,
                    'total_payout_before' => 0.0,
                    'total_payout_after' => 0.0,
                ];
            }

            $totalPayoutBefore = (float) DB::table('my_id_earnings')->sum('payout_usd');
            $updatedTasksCount = 0;
            $affectedUserIds = [];
            $affectedMyIds = [];
            $hasRateCol = Schema::hasColumn('my_id_earnings', 'usd_bdt_rate');
            $now = Carbon::now('UTC');

            // 1. Backfill any eligible completed_tasks that don't yet have a my_id_earnings row
            if (Schema::hasTable('completed_tasks') && MyIdEarningService::isSystemEnabled()) {
                $missingTasks = CompletedTask::query()
                    ->leftJoin('my_id_earnings', 'completed_tasks.id', '=', 'my_id_earnings.completed_task_id')
                    ->whereNull('my_id_earnings.id')
                    ->select('completed_tasks.*')
                    ->orderBy('completed_tasks.id')
                    ->get();

                foreach ($missingTasks as $task) {
                    $recorded = MyIdEarningService::recordTaskEarning($task);
                    if (!empty($recorded['created']) && !empty($recorded['earning'])) {
                        $earning = $recorded['earning'];
                        $updatedTasksCount++;
                        if (!empty($earning->user_id)) {
                            $affectedUserIds[(int) $earning->user_id] = true;
                        }
                        if (!empty($earning->my_id_code)) {
                            $affectedMyIds[(string) $earning->my_id_code] = true;
                        }
                    }
                }
            }

            // 2. Recalculate every existing my_id_earnings row against current active payout rules
            MyIdEarning::query()
                ->orderBy('id')
                ->chunkById(500, function ($earnings) use (&$updatedTasksCount, &$affectedUserIds, &$affectedMyIds, $hasRateCol, $now): void {
                    foreach ($earnings as $earning) {
                        $resolved = static::resolveRuleAmountForTask($earning);

                        $oldUsd = round((float) ($earning->payout_usd ?? 0), 4);
                        $oldBdt = round((float) ($earning->payout_bdt ?? 0), 2);
                        $oldRate = $hasRateCol ? round((float) ($earning->usd_bdt_rate ?? 0), 2) : 0.0;

                        $newUsd = round((float) $resolved['payout_usd'], 4);
                        $newBdt = round((float) $resolved['payout_bdt'], 2);
                        $newRate = round((float) $resolved['usd_bdt_rate'], 2);

                        $usdChanged = abs($oldUsd - $newUsd) >= 0.0001;
                        $bdtChanged = abs($oldBdt - $newBdt) >= 0.01;
                        $rateChanged = $hasRateCol && abs($oldRate - $newRate) >= 0.01;

                        if ($usdChanged || $bdtChanged || $rateChanged) {
                            $updateData = [
                                'payout_usd' => $newUsd,
                                'payout_bdt' => $newBdt,
                                'updated_at' => $now,
                            ];

                            if ($hasRateCol) {
                                $updateData['usd_bdt_rate'] = $newRate;
                            }

                            DB::table('my_id_earnings')
                                ->where('id', $earning->id)
                                ->update($updateData);

                            $updatedTasksCount++;

                            if (!empty($earning->user_id)) {
                                $affectedUserIds[(int) $earning->user_id] = true;
                            }
                            if (!empty($earning->my_id_code)) {
                                $affectedMyIds[(string) $earning->my_id_code] = true;
                            }
                        }
                    }
                });

            // 3. Synchronize any unpaid My ID payout requests (status != completed & != rejected)
            if (Schema::hasTable('my_id_payouts')) {
                $unpaidPayouts = MyIdPayout::query()
                    ->whereNotIn('status', ['completed', 'rejected'])
                    ->get();

                foreach ($unpaidPayouts as $payout) {
                    $month = (string) $payout->payout_month;
                    $stats = DB::table('my_id_earnings')
                        ->where('my_id_code', $payout->my_id_code)
                        ->where(function ($q) use ($month): void {
                            $q->where('completed_at', 'like', $month . '%')
                                ->orWhere(function ($q2) use ($month): void {
                                    $q2->whereNull('completed_at')->where('created_at', 'like', $month . '%');
                                });
                        })
                        ->selectRaw('
                            COUNT(*) as total_offers,
                            COALESCE(SUM(payout_usd), 0) as total_usd,
                            COALESCE(SUM(payout_bdt), 0) as total_bdt
                        ')
                        ->first();

                    $newOffers = (int) ($stats->total_offers ?? 0);
                    $newTotalUsd = round((float) ($stats->total_usd ?? 0), 2);
                    $newTotalBdt = round((float) ($stats->total_bdt ?? 0), 2);

                    if (
                        (int) $payout->total_offers !== $newOffers ||
                        abs((float) $payout->total_usd - $newTotalUsd) >= 0.01 ||
                        abs((float) $payout->total_bdt - $newTotalBdt) >= 0.01
                    ) {
                        $payout->total_offers = $newOffers;
                        $payout->total_usd = $newTotalUsd;
                        $payout->total_bdt = $newTotalBdt;
                        $payout->save();
                    }
                }
            }

            $totalPayoutAfter = (float) DB::table('my_id_earnings')->sum('payout_usd');

            return [
                'updated_tasks_count' => $updatedTasksCount,
                'affected_users_count' => count($affectedUserIds),
                'affected_my_ids_count' => count($affectedMyIds),
                'total_payout_before' => round($totalPayoutBefore, 4),
                'total_payout_after' => round($totalPayoutAfter, 4),
            ];
        });
    }
}
