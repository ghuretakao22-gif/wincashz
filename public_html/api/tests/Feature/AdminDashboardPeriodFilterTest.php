<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminDashboardPeriodFilterTest extends TestCase
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

        Schema::create('offerwalls', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('offerwalls');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('chargebacks');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_period_this_month_includes_last_second_of_month_and_excludes_first_second_of_next_month(): void
    {
        // Fix test time inside October 2026 UTC
        $now = Carbon::parse('2026-10-15 12:00:00', 'UTC');
        Carbon::setTestNow($now);

        // Record 1: Inside October (last second of October 2026 UTC: 2026-10-31 23:59:59)
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-oct-last-sec',
            'offer_name' => 'Oct Offer',
            'offer_id' => 'OCT-1',
            'revenue' => 25.00,
            'currency_reward' => 250.00,
            'created_at' => '2026-10-31 23:59:59',
            'updated_at' => '2026-10-31 23:59:59',
        ]);

        // Record 2: First second of next month (2026-11-01 00:00:00 UTC) -> MUST BE EXCLUDED
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-nov-first-sec',
            'offer_name' => 'Nov Offer',
            'offer_id' => 'NOV-1',
            'revenue' => 50.00,
            'currency_reward' => 500.00,
            'created_at' => '2026-11-01 00:00:00',
            'updated_at' => '2026-11-01 00:00:00',
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?period=this_month');

        $response->assertOk();
        $response->assertJsonPath('period', 'this_month');
        $response->assertJsonPath('month_label', 'October 2026');
        $response->assertJsonPath('range_start', '2026-10-01T00:00:00Z');
        $response->assertJsonPath('range_end', '2026-11-01T00:00:00Z');

        // Only the record at 2026-10-31 23:59:59 should be counted (revenue = 25.00, count = 1)
        $response->assertJsonPath('summary.totalCompletedOffers', 1);
        $response->assertJsonPath('summary.totalRevenueUsd', 25);

        Carbon::setTestNow();
    }

    public function test_period_last_month_returns_previous_utc_month(): void
    {
        // Fix test time inside October 2026 UTC
        $now = Carbon::parse('2026-10-15 12:00:00', 'UTC');
        Carbon::setTestNow($now);

        // Record in September 2026 (last month)
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-sep',
            'offer_name' => 'Sep Offer',
            'offer_id' => 'SEP-1',
            'revenue' => 15.50,
            'currency_reward' => 155.00,
            'created_at' => '2026-09-15 10:00:00',
            'updated_at' => '2026-09-15 10:00:00',
        ]);

        // Record in October 2026 (this month)
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-oct',
            'offer_name' => 'Oct Offer',
            'offer_id' => 'OCT-1',
            'revenue' => 40.00,
            'currency_reward' => 400.00,
            'created_at' => '2026-10-05 10:00:00',
            'updated_at' => '2026-10-05 10:00:00',
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?period=last_month');

        $response->assertOk();
        $response->assertJsonPath('period', 'last_month');
        $response->assertJsonPath('month_label', 'September 2026');
        $response->assertJsonPath('range_start', '2026-09-01T00:00:00Z');
        $response->assertJsonPath('range_end', '2026-10-01T00:00:00Z');

        // Only September record should be counted
        $response->assertJsonPath('summary.totalCompletedOffers', 1);
        $response->assertJsonPath('summary.totalRevenueUsd', 15.50);

        Carbon::setTestNow();
    }

    public function test_month_parameter_returns_specific_month(): void
    {
        $now = Carbon::parse('2026-10-15 12:00:00', 'UTC');
        Carbon::setTestNow($now);

        // Record in August 2026
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-aug',
            'offer_name' => 'Aug Offer',
            'offer_id' => 'AUG-1',
            'revenue' => 33.33,
            'currency_reward' => 333.30,
            'created_at' => '2026-08-20 14:00:00',
            'updated_at' => '2026-08-20 14:00:00',
        ]);

        // Record in September 2026
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'testwall',
            'user_id' => 1,
            'user_name' => 'user-1',
            'transaction_id' => 'tx-sep',
            'offer_name' => 'Sep Offer',
            'offer_id' => 'SEP-1',
            'revenue' => 10.00,
            'currency_reward' => 100.00,
            'created_at' => '2026-09-01 00:00:00',
            'updated_at' => '2026-09-01 00:00:00',
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?month=2026-08');

        $response->assertOk();
        $response->assertJsonPath('month_label', 'August 2026');
        $response->assertJsonPath('range_start', '2026-08-01T00:00:00Z');
        $response->assertJsonPath('range_end', '2026-09-01T00:00:00Z');
        $response->assertJsonPath('summary.totalCompletedOffers', 1);
        $response->assertJsonPath('summary.totalRevenueUsd', 33.33);

        Carbon::setTestNow();
    }

    public function test_period_all_time_returns_all_records_without_date_filter(): void
    {
        $now = Carbon::parse('2026-10-15 12:00:00', 'UTC');
        Carbon::setTestNow($now);

        DB::table('completed_tasks')->insert([
            [
                'offer_wall_name' => 'testwall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'tx-old',
                'offer_name' => 'Old Offer',
                'offer_id' => 'OLD-1',
                'revenue' => 12.00,
                'currency_reward' => 120.00,
                'created_at' => '2025-01-01 00:00:00',
                'updated_at' => '2025-01-01 00:00:00',
            ],
            [
                'offer_wall_name' => 'testwall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'tx-new',
                'offer_name' => 'New Offer',
                'offer_id' => 'NEW-1',
                'revenue' => 18.00,
                'currency_reward' => 180.00,
                'created_at' => '2026-10-15 12:00:00',
                'updated_at' => '2026-10-15 12:00:00',
            ],
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?period=all_time');

        $response->assertOk();
        $response->assertJsonPath('period', 'all_time');
        $response->assertJsonPath('month_label', 'All Time');
        $this->assertNull($response->json('range_start'));
        $this->assertNull($response->json('range_end'));
        $response->assertJsonPath('summary.totalCompletedOffers', 2);
        $response->assertJsonPath('summary.totalRevenueUsd', 30);

        Carbon::setTestNow();
    }

    public function test_missing_period_param_retains_legacy_behavior(): void
    {
        $now = Carbon::parse('2026-10-15 12:00:00', 'UTC');
        Carbon::setTestNow($now);

        DB::table('completed_tasks')->insert([
            [
                'offer_wall_name' => 'testwall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'tx-1',
                'offer_name' => 'Offer 1',
                'offer_id' => 'O-1',
                'revenue' => 5.00,
                'currency_reward' => 50.00,
                'created_at' => '2024-05-01 00:00:00',
                'updated_at' => '2024-05-01 00:00:00',
            ],
            [
                'offer_wall_name' => 'testwall',
                'user_id' => 1,
                'user_name' => 'user-1',
                'transaction_id' => 'tx-2',
                'offer_name' => 'Offer 2',
                'offer_id' => 'O-2',
                'revenue' => 15.00,
                'currency_reward' => 150.00,
                'created_at' => '2026-10-15 12:00:00',
                'updated_at' => '2026-10-15 12:00:00',
            ],
        ]);

        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard');

        $response->assertOk();
        // Missing period should return all records (exact legacy behavior)
        $response->assertJsonPath('summary.totalCompletedOffers', 2);
        $response->assertJsonPath('summary.totalRevenueUsd', 20);

        Carbon::setTestNow();
    }

    public function test_invalid_period_value_returns_422(): void
    {
        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?period=invalid_period_name');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['period']);
    }

    public function test_invalid_month_format_returns_422(): void
    {
        $response = $this->withoutMiddleware()->getJson('/api/admin/dashboard?month=invalid-date');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['month']);
    }
}
