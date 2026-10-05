<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('timeline_entries')) {
            return;
        }

        Schema::table('timeline_entries', function (Blueprint $table): void {
            if (!Schema::hasColumn('timeline_entries', 'country')) {
                $table->string('country')->nullable()->after('currency_reward');
            }

            if (!Schema::hasColumn('timeline_entries', 'ip')) {
                $table->string('ip')->nullable()->after('country');
            }

            if (!Schema::hasColumn('timeline_entries', 'status')) {
                $table->string('status')->nullable()->after('ip');
            }

            if (!Schema::hasColumn('timeline_entries', 'meta')) {
                $table->json('meta')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('timeline_entries')) {
            return;
        }

        Schema::table('timeline_entries', function (Blueprint $table): void {
            if (Schema::hasColumn('timeline_entries', 'meta')) {
                $table->dropColumn('meta');
            }

            if (Schema::hasColumn('timeline_entries', 'status')) {
                $table->dropColumn('status');
            }

            if (Schema::hasColumn('timeline_entries', 'ip')) {
                $table->dropColumn('ip');
            }

            if (Schema::hasColumn('timeline_entries', 'country')) {
                $table->dropColumn('country');
            }
        });
    }
};
