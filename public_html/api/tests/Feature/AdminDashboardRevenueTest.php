<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminDashboardRevenueTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('role')->default('user');
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

        Schema::create('completed_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_wall_name')->nullable();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_name')->default('anonymous');
            $table->string('transaction_id')->unique();
            $table->string('offer_name')->nullable();
            $table->string('offer_id')->nullable();
            $table->decimal('revenue', 18, 2)->default(0);
            $table->decimal('currency_reward', 18, 2)->default(0);
            $table->string('ip', 100)->nullable();
            $table->string('country')->default('unknown');
            $table->timestamps();
        });

        Schema::create('chargebacks', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_wall_name')->nullable();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_name')->default('anonymous');
            $table->string('transaction_id')->unique();
            $table->string('offer_name')->nullable();
            $table->string('offer_id')->nullable();
            $table->decimal('revenue', 18, 2)->default(0);
            $table->decimal('currency_reward', 18, 2)->default(0);
            $table->string('ip', 100)->nullable();
            $table->string('country')->default('unknown');
            $table->string('status')->default('pending');
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('admin_id')->nullable();
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('user_name')->default('anonymous');
            $table->string('type')->default('system');
            $table->string('status')->default('completed');
            $table->decimal('amount', 18, 4)->default(0);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('transaction_id')->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->longText('meta')->nullable();
            $table->timestamps();
            $table->unique(['reference_type', 'reference_id']);
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('chargebacks');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_dashboard_revenue_cards_use_revenue_column_values(): void
    {
        $now = Carbon::parse('2026-06-27 09:00:00');
        Carbon::setTestNow($now);

        DB::table('users')->insert([
            'name' => 'Admin User',
            'username' => 'admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'ip' => '127.0.0.1',
            'country' => 'BD',
            'balance' => 0,
            'level' => 1,
            'referral_code' => 'ABC123',
            'referred_by' => null,
            'total_referred' => 0,
            'referral_earning' => 0,
            'email_verified_at' => now(),
            'password' => bcrypt('secret123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            [
                'offer_wall_name' => 'surveywall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'task-1',
                'offer_name' => 'Offer 1',
                'offer_id' => 'O-1',
                'revenue' => 10.50,
                'currency_reward' => 150.00,
                'ip' => '127.0.0.1',
                'country' => 'BD',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'offer_wall_name' => 'surveywall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'task-2',
                'offer_name' => 'Offer 2',
                'offer_id' => 'O-2',
                'revenue' => 5.25,
                'currency_reward' => 99.00,
                'ip' => '127.0.0.1',
                'country' => 'BD',
                'created_at' => $now->copy()->subDay(),
                'updated_at' => $now->copy()->subDay(),
            ],
        ]);

        DB::table('chargebacks')->insert([
            [
                'offer_wall_name' => 'surveywall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'cb-1',
                'offer_name' => 'Chargeback 1',
                'offer_id' => 'C-1',
                'revenue' => 2.75,
                'currency_reward' => 75.00,
                'ip' => '127.0.0.1',
                'country' => 'BD',
                'status' => 'approved',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'offer_wall_name' => 'surveywall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'cb-2',
                'offer_name' => 'Chargeback 2',
                'offer_id' => 'C-2',
                'revenue' => 1.25,
                'currency_reward' => 25.00,
                'ip' => '127.0.0.1',
                'country' => 'BD',
                'status' => 'approved',
                'created_at' => $now->copy()->subDay(),
                'updated_at' => $now->copy()->subDay(),
            ],
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard');

        $response->assertOk();
        $response->assertJsonPath('revenue.0.label', 'Today Revenue');
        $response->assertJsonPath('revenue.0.value', '10.50');
        $response->assertJsonPath('revenue.1.value', '15.75');
        $response->assertJsonPath('revenue.2.label', 'Today Chargeback');
        $response->assertJsonPath('revenue.2.value', '2.75');
        $response->assertJsonPath('revenue.3.value', '4.00');

        Carbon::setTestNow();
    }
}
