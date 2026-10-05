<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cashout_methods')) {
            return;
        }

        DB::table('cashout_methods')->insertOrIgnore([
            ['name' => 'Amazon', 'slug' => 'amazon', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'DoorDash', 'slug' => 'doordash', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 20, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Starbucks', 'slug' => 'starbucks', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 30, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Ikea', 'slug' => 'ikea', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 40, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Walmart', 'slug' => 'walmart', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 50, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Airbnb', 'slug' => 'airbnb', 'category' => 'gift_card', 'icon' => null, 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'description' => null, 'is_active' => true, 'sort_order' => 60, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Litecoin', 'slug' => 'litecoin', 'category' => 'crypto', 'icon' => null, 'currency' => 'LTC', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'description' => null, 'is_active' => true, 'sort_order' => 70, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Dogecoin', 'slug' => 'dogecoin', 'category' => 'crypto', 'icon' => null, 'currency' => 'DOGE', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'description' => null, 'is_active' => true, 'sort_order' => 80, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Bitcoin Cash', 'slug' => 'bitcoin-cash', 'category' => 'crypto', 'icon' => null, 'currency' => 'BCH', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'description' => null, 'is_active' => true, 'sort_order' => 90, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Tron', 'slug' => 'tron', 'category' => 'crypto', 'icon' => null, 'currency' => 'TRX', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'description' => null, 'is_active' => true, 'sort_order' => 100, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('cashout_methods')) {
            return;
        }

        DB::table('cashout_methods')->whereIn('slug', [
            'amazon',
            'doordash',
            'starbucks',
            'ikea',
            'walmart',
            'airbnb',
            'litecoin',
            'dogecoin',
            'bitcoin-cash',
            'tron',
        ])->delete();
    }
};
