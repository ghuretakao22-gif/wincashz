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
        if (!Schema::hasTable('my_id_payout_rules')) {
            Schema::create('my_id_payout_rules', function (Blueprint $table): void {
                $table->id();
                $table->string('provider')->index();
                $table->string('offer_id')->nullable()->index();
                $table->string('offer_name')->nullable();
                $table->decimal('coin_amount', 14, 4)->index();
                $table->decimal('user_payout_usd', 14, 4);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('my_id_payout_rules');
    }
};
