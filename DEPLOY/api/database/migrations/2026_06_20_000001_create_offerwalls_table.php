<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offerwalls', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('badge', 40)->nullable();
            $table->text('logo_url');
            $table->string('category')->default('offerwall');
            $table->text('iframe_url');
            $table->decimal('rating', 4, 2)->default(5);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedTinyInteger('unlock_level')->default(1);
            $table->string('postback_slug')->nullable()->unique();
            $table->json('postback_parameters')->nullable();
            $table->text('postback_url')->nullable();
            $table->boolean('postback_signature_required')->default(false);
            $table->boolean('postback_whitelist_ip_required')->default(false);
            $table->json('postback_whitelist_ips')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offerwalls');
    }
};
