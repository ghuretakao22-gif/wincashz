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
        if (!Schema::hasTable('my_id_payouts')) {
            Schema::create('my_id_payouts', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code', 50)->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('payout_month', 7)->index(); // Format: YYYY-MM
                $table->unsignedInteger('total_offers')->default(0);
                $table->decimal('total_usd', 14, 2)->default(0);
                $table->decimal('total_bdt', 14, 2)->default(0);
                $table->string('payment_method', 30); // bkash, nagad, bank
                $table->json('payment_details');
                $table->string('status', 30)->default('waiting')->index(); // waiting, review, accepted, completed, rejected
                $table->text('admin_notes')->nullable();
                $table->timestamp('completed_at')->nullable()->index();
                $table->unsignedBigInteger('completed_by')->nullable();
                $table->timestamps();

                $table->unique(['my_id_code', 'payout_month'], 'uniq_my_id_month');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('my_id_payouts');
    }
};
