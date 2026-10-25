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
        if (!Schema::hasTable('my_id_earnings')) {
            Schema::create('my_id_earnings', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->unsignedBigInteger('completed_task_id')->unique();
                $table->string('provider');
                $table->string('offer_id')->nullable();
                $table->string('offer_name')->nullable();
                $table->decimal('coin_amount', 14, 4);
                $table->decimal('payout_usd', 14, 4);
                $table->decimal('usd_bdt_rate', 10, 2);
                $table->decimal('payout_bdt', 14, 4);
                $table->timestamp('completed_at')->nullable()->index();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('my_id_earnings');
    }
};
