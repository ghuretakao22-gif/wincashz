<?php

namespace App\Console\Commands;

use App\Services\PayoutRuleSyncService;
use Illuminate\Console\Command;

class SyncPayoutRulesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payouts:sync-rules';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate and synchronize all completed offers, My ID earnings, and payout totals against active Payout Rules';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Synchronizing all completed offers against current active Payout Rules...');

        $summary = PayoutRuleSyncService::syncAllCompletedOffers();

        $this->table(
            ['Metric', 'Value'],
            [
                ['Updated Offers', (string) $summary['updated_tasks_count']],
                ['Affected Users', (string) $summary['affected_users_count']],
                ['Affected My IDs', (string) $summary['affected_my_ids_count']],
                ['Total Payout Before (USD)', '$' . number_format((float) $summary['total_payout_before'], 4)],
                ['Total Payout After (USD)', '$' . number_format((float) $summary['total_payout_after'], 4)],
            ]
        );

        $this->info('Payout rule synchronization complete.');

        return self::SUCCESS;
    }
}
