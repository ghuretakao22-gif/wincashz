<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'username' => 'admin',
                'role' => 'admin',
                'ip' => '127.0.0.1',
                'country' => 'Local',
                'balance' => 4960,
                'level' => 9,
                'password' => 'Admin12345',
            ],
        );

        User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'username' => 'testuser',
                'role' => 'user',
                'ip' => '127.0.0.1',
                'country' => 'Local',
                'balance' => 0,
                'level' => 1,
                'password' => 'password',
            ],
        );

        $this->call(CashoutMethodSeeder::class);
    }
}
