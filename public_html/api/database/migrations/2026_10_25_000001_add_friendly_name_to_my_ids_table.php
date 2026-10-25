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
        if (Schema::hasTable('my_ids') && !Schema::hasColumn('my_ids', 'friendly_name')) {
            Schema::table('my_ids', function (Blueprint $table): void {
                $table->string('friendly_name')->nullable()->after('label');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('my_ids') && Schema::hasColumn('my_ids', 'friendly_name')) {
            Schema::table('my_ids', function (Blueprint $table): void {
                $table->dropColumn('friendly_name');
            });
        }
    }
};
