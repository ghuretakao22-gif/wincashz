<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('my_id_payout_rules') && !Schema::hasColumn('my_id_payout_rules', 'usd_bdt_rate')) {
            Schema::table('my_id_payout_rules', function (Blueprint $table): void {
                $table->decimal('usd_bdt_rate', 10, 2)->nullable()->default(null)->after('user_payout_usd');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('my_id_payout_rules') && Schema::hasColumn('my_id_payout_rules', 'usd_bdt_rate')) {
            Schema::table('my_id_payout_rules', function (Blueprint $table): void {
                $table->dropColumn('usd_bdt_rate');
            });
        }
    }
};
