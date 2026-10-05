<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminUsersSearchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->enum('role', ['admin', 'user'])->default('user');
            $table->string('ip', 45)->nullable();
            $table->string('country')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->unsignedInteger('level')->default(1);
            $table->string('referral_code', 6)->unique();
            $table->string('referred_by')->nullable();
            $table->unsignedInteger('total_referred')->default(0);
            $table->decimal('referral_earning', 12, 2)->default(0);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('user_avatar')->nullable();
            $table->boolean('profile_setup_completed')->default(false);
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_users_endpoint_supports_keyword_search(): void
    {
        $this->withoutMiddleware();

        DB::table('users')->insert([
            'name' => 'Alpha User',
            'username' => 'alphauser',
            'email' => 'alpha@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'balance' => 100,
            'level' => 1,
            'referral_code' => 'A1B2C3',
            'referred_by' => null,
            'total_referred' => 0,
            'referral_earning' => 0,
            'password' => bcrypt('password'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'name' => 'Needle User',
            'username' => 'needleuser',
            'email' => 'needle@example.com',
            'role' => 'user',
            'ip' => '127.0.0.2',
            'country' => 'India',
            'balance' => 200,
            'level' => 2,
            'referral_code' => 'D4E5F6',
            'referred_by' => 'alphauser',
            'total_referred' => 1,
            'referral_earning' => 25,
            'password' => bcrypt('password'),
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);

        $response = $this->getJson('/api/admin/users?page=1&search=needle');

        $response->assertOk();
        $response->assertJsonCount(1, 'rows');
        $response->assertJsonPath('rows.0.username', 'needleuser');
        $response->assertJsonPath('pagination.total', 1);
    }
}
