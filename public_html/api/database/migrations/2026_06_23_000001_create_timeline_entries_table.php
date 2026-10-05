<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('timeline_entries')) {
            return;
        }

        Schema::create('timeline_entries', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_name')->nullable()->index();
            $table->string('user_avatar')->nullable();
            $table->string('offer_wall_name')->nullable()->index();
            $table->string('offer_name')->nullable();
            $table->string('task_id')->nullable()->index();
            $table->decimal('currency_reward', 12, 2)->default(0);
            $table->string('type')->default('completed_task')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timeline_entries');
    }
};
