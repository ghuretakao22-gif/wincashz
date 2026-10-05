<?php

namespace Database\Seeders;

use App\Models\CashoutMethod;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CashoutMethodSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $methods = [
            ['name' => 'Amazon', 'slug' => 'amazon', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 10],
            ['name' => 'DoorDash', 'slug' => 'doordash', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 20],
            ['name' => 'Starbucks', 'slug' => 'starbucks', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 30],
            ['name' => 'Ikea', 'slug' => 'ikea', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 40],
            ['name' => 'Walmart', 'slug' => 'walmart', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 50],
            ['name' => 'Airbnb', 'slug' => 'airbnb', 'category' => 'gift_card', 'currency' => 'USD', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Instant', 'sort_order' => 60],
            ['name' => 'Litecoin', 'slug' => 'litecoin', 'category' => 'crypto', 'currency' => 'LTC', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'sort_order' => 70],
            ['name' => 'Dogecoin', 'slug' => 'dogecoin', 'category' => 'crypto', 'currency' => 'DOGE', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'sort_order' => 80],
            ['name' => 'Bitcoin Cash', 'slug' => 'bitcoin-cash', 'category' => 'crypto', 'currency' => 'BCH', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'sort_order' => 90],
            ['name' => 'Tron', 'slug' => 'tron', 'category' => 'crypto', 'currency' => 'TRX', 'minimum_amount' => 0, 'fee' => 0, 'processing_time' => 'Within 24 hours', 'sort_order' => 100],
        ];

        foreach ($methods as $method) {
            CashoutMethod::query()->updateOrCreate(
                ['slug' => $method['slug']],
                $method + [
                    'description' => null,
                    'icon' => null,
                    'is_active' => true,
                ],
            );
        }
    }
}
