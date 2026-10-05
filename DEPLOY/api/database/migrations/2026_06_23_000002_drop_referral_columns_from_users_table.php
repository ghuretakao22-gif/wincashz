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
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'referral_code')) {
                $table->dropUnique('users_referral_code_unique');
                $table->dropColumn([
                    'referral_code',
                    'referred_by',
                    'total_referred',
                    'referral_earning',
                ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('referral_code', 6)->unique();
            $table->string('referred_by')->nullable();
            $table->unsignedInteger('total_referred')->default(0);
            $table->decimal('referral_earning', 12, 2)->default(0);
        });
    }
};
