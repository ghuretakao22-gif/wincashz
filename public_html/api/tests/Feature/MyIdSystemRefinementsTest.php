<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdEarning;
use App\Models\MyIdPayoutRule;
use App\Models\Setting;
use App\Models\User;
use App\Services\MyIdEarningService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdSystemRefinementsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (!Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('my_ids')) {
            Schema::create('my_ids', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code')->unique();
                $table->string('label')->nullable();
                $table->string('friendly_name')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->default('Test User');
                $table->string('username')->unique();
                $table->string('email')->unique();
                $table->string('password');
                $table->enum('role', ['admin', 'moderator', 'user'])->default('user');
                $table->string('my_id')->nullable()->index();
                $table->string('ip', 45)->nullable();
                $table->string('country')->nullable();
                $table->decimal('balance', 12, 2)->default(0);
                $table->unsignedInteger('level')->default(1);
                $table->boolean('ban')->default(false);
                $table->timestamp('email_verified_at')->nullable();
                $table->string('user_avatar')->nullable();
                $table->boolean('profile_setup_completed')->default(false);
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('user_notifications')) {
            Schema::create('user_notifications', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('type', 100)->default('system');
                $table->string('icon', 100)->nullable();
                $table->string('title');
                $table->text('message')->nullable();
                $table->json('data')->nullable();
                $table->timestamp('read_at')->nullable()->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('completed_tasks')) {
            Schema::create('completed_tasks', function (Blueprint $table): void {
                $table->id();
                $table->string('offer_wall_name')->nullable();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('user_name')->default('anonymous');
                $table->string('transaction_id')->unique();
                $table->string('offer_name')->nullable();
                $table->string('offer_id')->nullable();
                $table->decimal('revenue', 18, 4)->default(0);
                $table->decimal('reward', 18, 4)->default(0);
                $table->decimal('currency_reward', 18, 4)->default(0);
                $table->string('ip', 100)->nullable();
                $table->string('country')->default('unknown');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('transactions')) {
            Schema::create('transactions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('user_name')->default('anonymous');
                $table->string('type')->default('system');
                $table->string('reference_type')->nullable();
                $table->string('status')->default('completed');
                $table->decimal('amount', 18, 4)->default(0);
                $table->timestamps();
            });
        }

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

        if (!Schema::hasTable('my_id_payout_rules')) {
            Schema::create('my_id_payout_rules', function (Blueprint $table): void {
                $table->id();
                $table->string('provider')->index();
                $table->string('offer_id')->nullable()->index();
                $table->string('offer_name')->nullable();
                $table->decimal('coin_amount', 14, 4)->index();
                $table->decimal('user_payout_usd', 14, 4);
                $table->decimal('usd_bdt_rate', 10, 2)->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
            });
        }

        // Clean tables
        DB::table('users')->delete();
        DB::table('my_ids')->delete();
        DB::table('settings')->delete();
        DB::table('my_id_earnings')->delete();
        DB::table('my_id_payout_rules')->delete();
    }

    private function enableMyIdSystem(): void
    {
        Setting::updateOrCreate(['name' => 'my_id_system_enabled'], ['value' => '1']);
        Setting::updateOrCreate(['name' => 'my_id_system_start_date'], ['value' => Carbon::yesterday()->toDateString()]);
    }

    private function disableMyIdSystem(): void
    {
        Setting::updateOrCreate(['name' => 'my_id_system_enabled'], ['value' => '0']);
    }

    public function test_signup_requires_valid_active_my_id_when_enabled(): void
    {
        $this->enableMyIdSystem();

        MyId::create([
            'my_id_code' => 'MOD_TEST_101',
            'friendly_name' => 'Moderator Team 101',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/register', [
            'username' => 'worker101',
            'email' => 'worker101@example.com',
            'password' => 'Password123!',
            'my_id_code' => 'MOD_TEST_101',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'username' => 'worker101',
            'email' => 'worker101@example.com',
            'my_id' => 'MOD_TEST_101',
        ]);
    }

    public function test_signup_fails_with_exact_error_when_my_id_missing_while_enabled(): void
    {
        $this->enableMyIdSystem();

        $response = $this->postJson('/api/register', [
            'username' => 'worker_nomyid',
            'email' => 'worker_nomyid@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['my_id_code']);
        $response->assertJsonFragment([
            'my_id_code' => ['Invalid or inactive My ID code.'],
        ]);
    }

    public function test_signup_fails_with_exact_error_when_my_id_is_inactive_or_not_found(): void
    {
        $this->enableMyIdSystem();

        MyId::create([
            'my_id_code' => 'INACTIVE_CODE',
            'friendly_name' => 'Inactive Team',
            'is_active' => false,
        ]);

        // 1. Non-existent code
        $resNonExistent = $this->postJson('/api/register', [
            'username' => 'worker_ghost',
            'email' => 'worker_ghost@example.com',
            'password' => 'Password123!',
            'my_id_code' => 'DOES_NOT_EXIST',
        ]);
        $resNonExistent->assertStatus(422);
        $resNonExistent->assertJsonValidationErrors(['my_id_code']);
        $resNonExistent->assertJsonFragment([
            'my_id_code' => ['Invalid or inactive My ID code.'],
        ]);

        // 2. Inactive code
        $resInactive = $this->postJson('/api/register', [
            'username' => 'worker_dormant',
            'email' => 'worker_dormant@example.com',
            'password' => 'Password123!',
            'my_id_code' => 'INACTIVE_CODE',
        ]);
        $resInactive->assertStatus(422);
        $resInactive->assertJsonValidationErrors(['my_id_code']);
        $resInactive->assertJsonFragment([
            'my_id_code' => ['Invalid or inactive My ID code.'],
        ]);
    }

    public function test_admin_can_assign_active_my_id_to_user(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'superadmin',
            'email' => 'admin@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_solo',
            'email' => 'worker_solo@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'my_id' => null,
        ]);

        $activeMyId = MyId::create([
            'my_id_code' => 'TEAM_BETA',
            'friendly_name' => 'Beta Team',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson("/api/admin/users/{$worker->id}", [
            'my_id' => 'TEAM_BETA',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', [
            'id' => $worker->id,
            'my_id' => 'TEAM_BETA',
        ]);
    }

    public function test_admin_assign_fails_for_inactive_or_not_found_my_id(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'superadmin2',
            'email' => 'admin2@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_target',
            'email' => 'worker_target@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
        ]);

        MyId::create([
            'my_id_code' => 'FROZEN_ID',
            'is_active' => false,
        ]);

        // Attempt assigning inactive My ID
        $resInactive = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson("/api/admin/users/{$worker->id}", [
            'my_id' => 'FROZEN_ID',
        ]);
        $resInactive->assertStatus(422);
        $resInactive->assertJsonValidationErrors(['my_id']);

        // Attempt assigning non-existent My ID
        $resMissing = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson("/api/admin/users/{$worker->id}", [
            'my_id' => 'NON_EXISTENT_99',
        ]);
        $resMissing->assertStatus(422);
        $resMissing->assertJsonValidationErrors(['my_id']);
    }

    public function test_admin_can_unassign_my_id_from_user(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'superadmin3',
            'email' => 'admin3@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_assigned',
            'email' => 'worker_assigned@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'my_id' => 'TEAM_GAMMA',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson("/api/admin/users/{$worker->id}", [
            'my_id' => '',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', [
            'id' => $worker->id,
            'my_id' => null,
        ]);
    }

    public function test_admin_users_api_returns_my_id_column(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'superadmin4',
            'email' => 'admin4@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        User::create([
            'name' => 'Worker Alpha',
            'username' => 'worker_alpha',
            'email' => 'alpha@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'my_id' => 'ALPHA_01',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/admin/users');

        $response->assertOk();
        $rows = $response->json('rows');
        $this->assertNotEmpty($rows);
        $alphaUser = collect($rows)->firstWhere('username', 'worker_alpha');
        $this->assertNotNull($alphaUser);
        $this->assertSame('ALPHA_01', $alphaUser['my_id']);
    }

    public function test_moderator_dashboard_returns_exact_8_column_offer_summary_and_today_stats(): void
    {
        $todayDate = Carbon::now('UTC')->format('Y-m-d');
        $yesterdayDate = Carbon::yesterday('UTC')->format('Y-m-d');

        $myId = MyId::create([
            'my_id_code' => 'MOD_ALPHA',
            'friendly_name' => 'Alpha Operations',
            'is_active' => true,
        ]);

        $moderator = User::create([
            'name' => 'Moderator Alpha',
            'username' => 'mod_alpha',
            'email' => 'mod_alpha@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'moderator',
            'my_id' => 'MOD_ALPHA',
        ]);
        $token = auth('api')->login($moderator);

        $worker = User::create([
            'name' => 'Worker 1',
            'username' => 'w1',
            'email' => 'w1@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'my_id' => 'MOD_ALPHA',
        ]);

        // Insert 1 earning today
        MyIdEarning::create([
            'my_id_code' => 'MOD_ALPHA',
            'user_id' => $worker->id,
            'completed_task_id' => 101,
            'provider' => 'AdGem',
            'offer_id' => 'AG_100',
            'offer_name' => 'Install TikTok',
            'coin_amount' => 500,
            'payout_usd' => 0.50,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 60.00,
            'completed_at' => $todayDate.' 12:00:00',
        ]);

        // Insert 1 earning yesterday (same month)
        MyIdEarning::create([
            'my_id_code' => 'MOD_ALPHA',
            'user_id' => $worker->id,
            'completed_task_id' => 102,
            'provider' => 'AdGem',
            'offer_id' => 'AG_100',
            'offer_name' => 'Install TikTok',
            'coin_amount' => 500,
            'payout_usd' => 0.50,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 60.00,
            'completed_at' => $yesterdayDate.' 12:00:00',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/moderator/dashboard');

        $response->assertOk();
        $response->assertJsonPath('status', 'success');

        // Check summary keys
        $summary = $response->json('data.summary');
        $this->assertSame(2, $summary['total_completed_offers']);
        $this->assertSame(1.0, (float) $summary['total_usd_earn']);
        $this->assertSame(120.0, (float) $summary['total_bdt_earn']);
        $this->assertSame(1, $summary['today_completed_offers']);
        $this->assertSame(0.5, (float) $summary['today_usd_earn']);
        $this->assertSame(60.0, (float) $summary['today_bdt_earn']);

        // Check 8 columns of offer_summary
        $offerSummary = $response->json('data.offer_summary');
        $this->assertCount(1, $offerSummary);
        $row = $offerSummary[0];

        $this->assertSame('AdGem', $row['provider']);
        $this->assertSame('Install TikTok', $row['offer_name']);
        $this->assertSame(500.0, (float) $row['coin']);
        $this->assertSame(1, $row['today_offers']);
        $this->assertSame(2, $row['total_offers']);
        $this->assertSame(0.5, (float) $row['offer_price']);
        $this->assertSame(1.0, (float) $row['net_usd']);
        $this->assertSame(120.0, (float) $row['net_bdt']);
    }

    public function test_moderator_my_earn_returns_exact_8_column_offer_summary_and_today_stats(): void
    {
        $todayDate = Carbon::now('UTC')->format('Y-m-d');

        MyId::create([
            'my_id_code' => 'MOD_BETA',
            'friendly_name' => 'Beta Ops',
            'is_active' => true,
        ]);

        $moderator = User::create([
            'name' => 'Moderator Beta',
            'username' => 'mod_beta',
            'email' => 'mod_beta@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'moderator',
            'my_id' => 'MOD_BETA',
        ]);
        $token = auth('api')->login($moderator);

        MyIdEarning::create([
            'my_id_code' => 'MOD_BETA',
            'user_id' => $moderator->id,
            'completed_task_id' => 201,
            'provider' => 'Lootably',
            'offer_id' => 'LT_55',
            'offer_name' => 'Survey Pro',
            'coin_amount' => 1000,
            'payout_usd' => 1.25,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 150.00,
            'completed_at' => $todayDate.' 08:00:00',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/moderator/my-earn');

        $response->assertOk();
        $response->assertJsonPath('status', 'success');

        $offerSummary = $response->json('data.offer_summary');
        $this->assertCount(1, $offerSummary);
        $row = $offerSummary[0];

        $this->assertSame('Lootably', $row['provider']);
        $this->assertSame('Survey Pro', $row['offer_name']);
        $this->assertSame(1000.0, (float) $row['coin']);
        $this->assertSame(1, $row['today_offers']);
        $this->assertSame(1, $row['total_offers']);
        $this->assertSame(1.25, (float) $row['offer_price']);
        $this->assertSame(1.25, (float) $row['net_usd']);
        $this->assertSame(150.0, (float) $row['net_bdt']);
    }

    public function test_admin_can_create_payout_rule_with_custom_usd_bdt_rate(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_rate',
            'email' => 'admin_rate@test.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-id-payout-rules', [
                'provider' => 'Torox',
                'offer_id' => 'game_prime',
                'offer_name' => 'Torox Prime',
                'coin_amount' => 450,
                'user_payout_usd' => 1.50,
                'usd_bdt_rate' => 125.50,
                'is_active' => true,
            ]);

        $res->assertCreated();
        $res->assertJsonPath('success', true);
        $this->assertEquals(125.50, (float) $res->json('data.usd_bdt_rate'));

        $this->assertDatabaseHas('my_id_payout_rules', [
            'provider' => 'Torox',
            'offer_id' => 'game_prime',
            'coin_amount' => 450,
            'usd_bdt_rate' => 125.50,
        ]);
    }

    public function test_admin_can_update_payout_rule_usd_bdt_rate(): void
    {
        $admin = User::create([
            'name' => 'Admin User 2',
            'username' => 'admin_rate_2',
            'email' => 'admin_rate_2@test.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $token = auth('api')->login($admin);

        $rule = MyIdPayoutRule::create([
            'provider' => 'AdGate',
            'offer_id' => 'offer_1',
            'offer_name' => 'Offer 1',
            'coin_amount' => 300,
            'user_payout_usd' => 0.80,
            'usd_bdt_rate' => 122.00,
            'is_active' => true,
        ]);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->patchJson('/api/admin/my-id-payout-rules/'.$rule->id, [
                'usd_bdt_rate' => 128.00,
            ]);

        $res->assertOk();
        $res->assertJsonPath('success', true);
        $this->assertEquals(128.00, (float) $res->json('data.usd_bdt_rate'));

        $this->assertEquals(128.00, (float) $rule->fresh()->usd_bdt_rate);
    }

    public function test_offer_completion_uses_rule_specific_bdt_rate(): void
    {
        $this->enableMyIdSystem();

        MyId::create(['my_id_code' => 'RATE_TEST', 'is_active' => true]);
        $worker = User::create([
            'name' => 'Worker Rate',
            'username' => 'worker_rate',
            'email' => 'worker_rate@test.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'my_id' => 'RATE_TEST',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Torox',
            'offer_id' => 'survey_101',
            'offer_name' => 'Survey 101',
            'coin_amount' => 600,
            'user_payout_usd' => 2.00,
            'usd_bdt_rate' => 125.00,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Torox',
            'user_id' => $worker->id,
            'user_name' => $worker->username,
            'transaction_id' => 'tx_rate_spec_1',
            'offer_id' => 'survey_101',
            'offer_name' => 'Survey 101',
            'reward' => 600,
            'currency_reward' => 600,
            'revenue' => 5.00,
            'created_at' => Carbon::now('UTC'),
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertTrue($result['created']);
        $this->assertEquals(2.00, (float) $result['payout_usd']);
        $this->assertEquals(125.00, (float) $result['usd_bdt_rate']);
        $this->assertEquals(250.00, (float) $result['payout_bdt']); // 2.00 * 125

        $earning = MyIdEarning::where('completed_task_id', $task->id)->first();
        $this->assertNotNull($earning);
        $this->assertEquals(2.00, (float) $earning->payout_usd);
        $this->assertEquals(125.00, (float) $earning->usd_bdt_rate);
        $this->assertEquals(250.00, (float) $earning->payout_bdt);
    }

    public function test_unmapped_offer_creates_zero_payout_counted_in_moderator_panel(): void
    {
        $this->enableMyIdSystem();

        MyId::create(['my_id_code' => 'UNMAPPED_MY', 'is_active' => true]);

        $moderator = User::create([
            'name' => 'Mod Unmapped',
            'username' => 'mod_unmapped',
            'email' => 'mod_unmapped@test.com',
            'password' => Hash::make('password'),
            'role' => 'moderator',
            'my_id' => 'UNMAPPED_MY',
        ]);
        $worker = User::create([
            'name' => 'Worker Unmapped',
            'username' => 'worker_unmapped',
            'email' => 'worker_unmapped@test.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'my_id' => 'UNMAPPED_MY',
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'MysteryWall',
            'user_id' => $worker->id,
            'user_name' => $worker->username,
            'transaction_id' => 'tx_unmapped_test_1',
            'offer_id' => 'mystery_offer',
            'offer_name' => 'Mystery Task',
            'reward' => 800,
            'currency_reward' => 800,
            'revenue' => 10.00,
            'created_at' => Carbon::now('UTC'),
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertTrue($result['created']);
        $this->assertSame('UNMAPPED_RECORDED', $result['status']);
        $this->assertEquals(0.0, (float) $result['payout_usd']);
        $this->assertEquals(0.0, (float) $result['payout_bdt']);

        // Check Moderator My Earn panel
        $token = auth('api')->login($moderator);
        $response = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/moderator/my-earn');

        $response->assertOk();
        $offerSummary = $response->json('data.offer_summary');
        $this->assertCount(1, $offerSummary);
        $row = $offerSummary[0];

        $this->assertSame('MysteryWall', $row['provider']);
        $this->assertSame(800.0, (float) $row['coin']);
        $this->assertSame(1, $row['today_offers']);
        $this->assertSame(1, $row['total_offers']);
        $this->assertEquals(0.0, (float) $row['offer_price']);
        $this->assertEquals(0.0, (float) $row['net_usd']);
        $this->assertEquals(0.0, (float) $row['net_bdt']);
    }

    public function test_admin_creating_rule_auto_backfills_unmapped_zero_earnings(): void
    {
        $this->enableMyIdSystem();

        MyId::create(['my_id_code' => 'BACKFILL_MY', 'is_active' => true]);

        $moderator = User::create([
            'name' => 'Mod Backfill',
            'username' => 'mod_backfill',
            'email' => 'mod_backfill@test.com',
            'password' => Hash::make('password'),
            'role' => 'moderator',
            'my_id' => 'BACKFILL_MY',
        ]);
        $worker = User::create([
            'name' => 'Worker Backfill',
            'username' => 'worker_backfill',
            'email' => 'worker_backfill@test.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'my_id' => 'BACKFILL_MY',
        ]);
        $admin = User::create([
            'name' => 'Admin Backfill',
            'username' => 'admin_backfill',
            'email' => 'admin_backfill@test.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        // 1. Worker completes offer with NO matching rule
        $task = CompletedTask::create([
            'offer_wall_name' => 'RevU',
            'user_id' => $worker->id,
            'user_name' => $worker->username,
            'transaction_id' => 'tx_backfill_1',
            'offer_id' => 'revu_survey',
            'offer_name' => 'Revu Survey',
            'reward' => 500,
            'currency_reward' => 500,
            'revenue' => 15.00,
            'created_at' => Carbon::now('UTC'),
        ]);

        $recordResult = MyIdEarningService::recordTaskEarning($task);
        $this->assertTrue($recordResult['created']);
        $this->assertEquals(0.0, (float) $recordResult['payout_usd']);

        $earning = MyIdEarning::where('completed_task_id', $task->id)->first();
        $this->assertEquals(0.0, (float) $earning->payout_usd);

        // 2. Admin creates the matching rule
        $adminToken = auth('api')->login($admin);
        $createRes = $this->withHeaders(['Authorization' => 'Bearer '.$adminToken])
            ->postJson('/api/admin/my-id-payout-rules', [
                'provider' => 'RevU',
                'offer_id' => 'revu_survey',
                'offer_name' => 'Revu Survey',
                'coin_amount' => 500,
                'user_payout_usd' => 1.50,
                'usd_bdt_rate' => 124.00,
                'is_active' => true,
            ]);

        $createRes->assertCreated();

        // 3. Earning must be auto-backfilled to 1.50 USD and 186.00 BDT
        $earning->refresh();
        $this->assertEquals(1.50, (float) $earning->payout_usd);
        $this->assertEquals(124.00, (float) $earning->usd_bdt_rate);
        $this->assertEquals(186.00, (float) $earning->payout_bdt);

        // 4. Moderator panel immediately reflects updated net USD and BDT
        $modToken = auth('api')->login($moderator);
        $modRes = $this->withHeaders(['Authorization' => 'Bearer '.$modToken])
            ->getJson('/api/moderator/my-earn');

        $modRes->assertOk();
        $offerSummary = $modRes->json('data.offer_summary');
        $this->assertCount(1, $offerSummary);
        $this->assertEquals(1.50, (float) $offerSummary[0]['net_usd']);
        $this->assertEquals(186.00, (float) $offerSummary[0]['net_bdt']);
    }

    public function test_wildcard_backfill_does_not_overwrite_specific_rule_unmapped_rows(): void
    {
        $this->enableMyIdSystem();

        MyId::create(['my_id_code' => 'WILD_MY', 'is_active' => true]);
        $worker = User::create([
            'name' => 'Worker Wild',
            'username' => 'worker_wild',
            'email' => 'worker_wild@test.com',
            'password' => Hash::make('password'),
            'role' => 'user',
            'my_id' => 'WILD_MY',
        ]);
        $admin = User::create([
            'name' => 'Admin Wild',
            'username' => 'admin_wild',
            'email' => 'admin_wild@test.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        // Pre-create an active specific rule for 'special_offer'
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'special_offer',
            'offer_name' => 'Special Offer',
            'coin_amount' => 400,
            'user_payout_usd' => 3.00,
            'usd_bdt_rate' => 125.00,
            'is_active' => true,
        ]);

        // Manually insert an unmapped row that has offer_id = 'special_offer'
        $unmappedSpecific = MyIdEarning::create([
            'my_id_code' => 'WILD_MY',
            'user_id' => $worker->id,
            'completed_task_id' => 9991,
            'provider' => 'Vortex',
            'offer_id' => 'special_offer',
            'offer_name' => 'Special Offer',
            'coin_amount' => 400,
            'payout_usd' => 0.0,
            'usd_bdt_rate' => 0.0,
            'payout_bdt' => 0.0,
            'completed_at' => Carbon::now('UTC'),
        ]);

        // Also insert an unmapped row that is generic (e.g. 'generic_offer')
        $unmappedGeneric = MyIdEarning::create([
            'my_id_code' => 'WILD_MY',
            'user_id' => $worker->id,
            'completed_task_id' => 9992,
            'provider' => 'Vortex',
            'offer_id' => 'generic_offer',
            'offer_name' => 'Generic Offer',
            'coin_amount' => 400,
            'payout_usd' => 0.0,
            'usd_bdt_rate' => 0.0,
            'payout_bdt' => 0.0,
            'completed_at' => Carbon::now('UTC'),
        ]);

        // Admin creates a WILDCARD rule for Vortex + 400 coins
        $adminToken = auth('api')->login($admin);
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$adminToken])
            ->postJson('/api/admin/my-id-payout-rules', [
                'provider' => 'Vortex',
                'offer_id' => null,
                'offer_name' => 'Wildcard All Vortex 400',
                'coin_amount' => 400,
                'user_payout_usd' => 1.00,
                'usd_bdt_rate' => 122.00,
                'is_active' => true,
            ]);

        $res->assertCreated();

        // Generic unmapped must be backfilled to 1.00 USD
        $unmappedGeneric->refresh();
        $this->assertEquals(1.00, (float) $unmappedGeneric->payout_usd);
        $this->assertEquals(122.00, (float) $unmappedGeneric->payout_bdt);

        // Specific unmapped row MUST NOT be stolen by the wildcard rule!
        $unmappedSpecific->refresh();
        $this->assertEquals(0.0, (float) $unmappedSpecific->payout_usd);
    }
}
