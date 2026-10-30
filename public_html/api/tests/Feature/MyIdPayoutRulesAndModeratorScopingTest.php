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
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdPayoutRulesAndModeratorScopingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('my_ids', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->unique();
            $table->string('label')->nullable();
            $table->string('friendly_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('role')->default('user');
            $table->string('my_id')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->boolean('ban')->default(false);
            $table->string('password')->default('secret');
            $table->timestamps();
        });

        Schema::create('my_id_payout_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('provider');
            $table->string('offer_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->decimal('coin_amount', 14, 4);
            $table->decimal('user_payout_usd', 14, 4);
            $table->decimal('usd_bdt_rate', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('completed_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_wall_name')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name')->default('anonymous');
            $table->string('transaction_id')->unique();
            $table->string('offer_name')->nullable();
            $table->string('offer_id')->nullable();
            $table->decimal('revenue', 18, 2)->default(0);
            $table->decimal('currency_reward', 18, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('my_id_earnings', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('completed_task_id')->unique();
            $table->string('provider');
            $table->string('offer_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->decimal('coin_amount', 14, 4);
            $table->decimal('payout_usd', 14, 4);
            $table->decimal('usd_bdt_rate', 10, 2);
            $table->decimal('payout_bdt', 14, 4);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('my_id_payout_rules');
        Schema::dropIfExists('users');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('settings');
        parent::tearDown();
    }

    protected function createAdminUser(): User
    {
        return User::create([
            'name' => 'Admin User',
            'username' => 'admin_'.uniqid(),
            'email' => 'admin_'.uniqid().'@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);
    }

    protected function createModeratorUser(string $myIdCode): User
    {
        return User::create([
            'name' => 'Mod User',
            'username' => 'mod_'.uniqid(),
            'email' => 'mod_'.uniqid().'@example.com',
            'role' => 'moderator',
            'my_id' => $myIdCode,
            'password' => bcrypt('password123'),
        ]);
    }

    public function test_payout_rule_returns_today_count_and_total_count(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        // 1. Create rule
        $rule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 500,
            'user_payout_usd' => 1.50,
            'is_active' => true,
        ]);

        $todayStr = Carbon::now('UTC')->format('Y-m-d H:i:s');
        $yesterdayStr = Carbon::now('UTC')->subDay()->format('Y-m-d H:i:s');

        // 2. Insert earnings (1 today, 2 total)
        MyIdEarning::create([
            'my_id_code' => 'TEAM_A',
            'user_id' => 10,
            'completed_task_id' => 1,
            'provider' => 'Vortex',
            'offer_id' => 'prime_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 500,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $todayStr,
        ]);

        MyIdEarning::create([
            'my_id_code' => 'TEAM_B',
            'user_id' => 11,
            'completed_task_id' => 2,
            'provider' => 'Vortex',
            'offer_id' => 'prime_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 500,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $yesterdayStr,
        ]);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-payout-rules');

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $items = $res->json('data');
        $this->assertCount(1, $items);
        $this->assertEquals(1, $items[0]['today_count']);
        $this->assertEquals(2, $items[0]['total_count']);
    }

    public function test_payout_rule_aggregation_handles_wildcard_casing_and_null_offers_under_strict_grouping(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        // 1. Specific rule
        $ruleSpecific = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'special_offer',
            'offer_name' => 'Special Offer',
            'coin_amount' => 500,
            'user_payout_usd' => 1.50,
            'is_active' => true,
        ]);

        // 2. Wildcard rule
        $ruleWildcard = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => null,
            'offer_name' => null,
            'coin_amount' => 250,
            'user_payout_usd' => 0.75,
            'is_active' => true,
        ]);

        $todayStr = Carbon::now('UTC')->format('Y-m-d H:i:s');
        $yesterdayStr = Carbon::now('UTC')->subDay()->format('Y-m-d H:i:s');

        // Insert specific earnings (2 today with different casing/trimming, 1 yesterday)
        MyIdEarning::create([
            'my_id_code' => 'TEAM_A',
            'user_id' => 10,
            'completed_task_id' => 101,
            'provider' => ' Vortex ',
            'offer_id' => ' SPECIAL_OFFER ',
            'offer_name' => 'Special Offer',
            'coin_amount' => 500,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $todayStr,
        ]);

        MyIdEarning::create([
            'my_id_code' => 'TEAM_A',
            'user_id' => 11,
            'completed_task_id' => 102,
            'provider' => 'vortex',
            'offer_id' => 'special_offer',
            'offer_name' => 'Special Offer',
            'coin_amount' => 500,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $todayStr,
        ]);

        MyIdEarning::create([
            'my_id_code' => 'TEAM_B',
            'user_id' => 12,
            'completed_task_id' => 103,
            'provider' => 'vortex',
            'offer_id' => 'special_offer',
            'offer_name' => 'Special Offer',
            'coin_amount' => 500,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $yesterdayStr,
        ]);

        // Insert wildcard earnings (one with null offer_id, one with empty string, one with '-')
        MyIdEarning::create([
            'my_id_code' => 'TEAM_A',
            'user_id' => 13,
            'completed_task_id' => 104,
            'provider' => 'Vortex',
            'offer_id' => null,
            'offer_name' => null,
            'coin_amount' => 250,
            'payout_usd' => 0.75,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 91.50,
            'completed_at' => $todayStr,
        ]);

        MyIdEarning::create([
            'my_id_code' => 'TEAM_B',
            'user_id' => 14,
            'completed_task_id' => 105,
            'provider' => 'Vortex',
            'offer_id' => '',
            'offer_name' => null,
            'coin_amount' => 250,
            'payout_usd' => 0.75,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 91.50,
            'completed_at' => $todayStr,
        ]);

        MyIdEarning::create([
            'my_id_code' => 'TEAM_C',
            'user_id' => 15,
            'completed_task_id' => 106,
            'provider' => 'Vortex',
            'offer_id' => '-',
            'offer_name' => null,
            'coin_amount' => 250,
            'payout_usd' => 0.75,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 91.50,
            'completed_at' => $yesterdayStr,
        ]);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-payout-rules');

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $items = collect($res->json('data'));

        $specificItem = $items->firstWhere('id', $ruleSpecific->id);
        $wildcardItem = $items->firstWhere('id', $ruleWildcard->id);

        $this->assertNotNull($specificItem);
        $this->assertEquals(2, $specificItem['today_count']);
        $this->assertEquals(3, $specificItem['total_count']);

        $this->assertNotNull($wildcardItem);
        $this->assertEquals(2, $wildcardItem['today_count']);
        $this->assertEquals(3, $wildcardItem['total_count']);
    }

    public function test_payout_rule_conflict_validation_prevents_duplicates(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        MyIdPayoutRule::create([
            'provider' => 'Torox',
            'offer_id' => 'game_1',
            'offer_name' => 'Game 1',
            'coin_amount' => 200,
            'user_payout_usd' => 0.40,
            'is_active' => true,
        ]);

        // Attempt duplicate creation
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-id-payout-rules', [
                'provider' => 'Torox',
                'offer_id' => 'game_1',
                'coin_amount' => 200,
                'user_payout_usd' => 0.50,
            ]);

        $res->assertStatus(422);
        $res->assertJsonPath('success', false);
    }

    public function test_moderator_panel_scopes_data_strictly_to_own_my_id(): void
    {
        MyId::create(['my_id_code' => 'ALPHA', 'friendly_name' => 'Alpha Team']);
        MyId::create(['my_id_code' => 'BETA', 'friendly_name' => 'Beta Team']);

        $modAlpha = $this->createModeratorUser('ALPHA');
        $tokenAlpha = auth('api')->login($modAlpha);

        // Create member user for ALPHA
        $userAlpha = User::create([
            'name' => 'User Alpha',
            'username' => 'user_alpha',
            'email' => 'alpha@test.com',
            'role' => 'user',
            'my_id' => 'ALPHA',
            'balance' => 100,
        ]);

        // Create member user for BETA
        $userBeta = User::create([
            'name' => 'User Beta',
            'username' => 'user_beta',
            'email' => 'beta@test.com',
            'role' => 'user',
            'my_id' => 'BETA',
            'balance' => 200,
        ]);

        // Insert earnings
        MyIdEarning::create([
            'my_id_code' => 'ALPHA',
            'user_id' => $userAlpha->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'offer_id' => 'v1',
            'offer_name' => 'Alpha Offer',
            'coin_amount' => 300,
            'payout_usd' => 1.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 122.00,
            'completed_at' => Carbon::now('UTC')->format('Y-m-d H:i:s'),
        ]);

        MyIdEarning::create([
            'my_id_code' => 'BETA',
            'user_id' => $userBeta->id,
            'completed_task_id' => 102,
            'provider' => 'Torox',
            'offer_id' => 'b1',
            'offer_name' => 'Beta Offer',
            'coin_amount' => 600,
            'payout_usd' => 2.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 244.00,
            'completed_at' => Carbon::now('UTC')->format('Y-m-d H:i:s'),
        ]);

        // Moderator ALPHA requests /moderator/users
        $resUsers = $this->withHeaders(['Authorization' => 'Bearer '.$tokenAlpha])
            ->getJson('/api/moderator/users');

        $resUsers->assertStatus(200);
        $usersData = $resUsers->json('data');
        // Users under ALPHA = modAlpha + userAlpha (2), BETA user is completely excluded
        $this->assertCount(2, $usersData);
        $usernames = collect($usersData)->pluck('username')->all();
        $this->assertContains('user_alpha', $usernames);
        $this->assertNotContains('user_beta', $usernames);

        // Moderator ALPHA requests /moderator/stats
        $resStats = $this->withHeaders(['Authorization' => 'Bearer '.$tokenAlpha])
            ->getJson('/api/moderator/stats');

        $resStats->assertStatus(200);
        $this->assertEquals(2, $resStats->json('data.total_users'));

        // Moderator ALPHA requests /moderator/my-earn
        $resEarn = $this->withHeaders(['Authorization' => 'Bearer '.$tokenAlpha])
            ->getJson('/api/moderator/my-earn');

        $resEarn->assertStatus(200);
        $this->assertEquals(1, $resEarn->json('data.summary.total_offers'));
        $this->assertEquals(1.00, $resEarn->json('data.summary.total_usd'));
        $this->assertEquals(122.00, $resEarn->json('data.summary.total_bdt'));

        // Check offer summary table
        $offerSummary = $resEarn->json('data.offer_summary');
        $this->assertCount(1, $offerSummary);
        $this->assertEquals('Alpha Offer', $offerSummary[0]['offer_name']);
        $this->assertEquals(1, $offerSummary[0]['total_completed']);
    }

    public function test_moderator_today_filter_returns_only_today_records(): void
    {
        MyId::create(['my_id_code' => 'GAMMA', 'friendly_name' => 'Gamma Team']);
        $mod = $this->createModeratorUser('GAMMA');
        $token = auth('api')->login($mod);

        $today = Carbon::now('UTC')->format('Y-m-d H:i:s');
        $lastMonth = Carbon::now('UTC')->subMonth()->format('Y-m-d H:i:s');

        // Today earning
        MyIdEarning::create([
            'my_id_code' => 'GAMMA',
            'user_id' => 1,
            'completed_task_id' => 201,
            'provider' => 'Vortex',
            'offer_id' => 'v_today',
            'offer_name' => 'Today Offer',
            'coin_amount' => 100,
            'payout_usd' => 0.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 61.00,
            'completed_at' => $today,
        ]);

        // Past earning
        MyIdEarning::create([
            'my_id_code' => 'GAMMA',
            'user_id' => 1,
            'completed_task_id' => 202,
            'provider' => 'Vortex',
            'offer_id' => 'v_old',
            'offer_name' => 'Old Offer',
            'coin_amount' => 200,
            'payout_usd' => 1.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 122.00,
            'completed_at' => $lastMonth,
        ]);

        // Query with period=today
        $resToday = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/moderator/my-earn?period=today');

        $resToday->assertStatus(200);
        $this->assertEquals(1, $resToday->json('data.summary.total_offers'));
        $this->assertEquals(0.50, $resToday->json('data.summary.total_usd'));
        $this->assertEquals('today', $resToday->json('data.active_period'));

        // Query with period=all
        $resAll = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/moderator/my-earn?period=all');

        $resAll->assertStatus(200);
        $this->assertEquals(2, $resAll->json('data.summary.total_offers'));
        $this->assertEquals(1.50, $resAll->json('data.summary.total_usd'));
    }

    public function test_admin_settings_api_handles_payout_enabled(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        // Get initial settings (defaults)
        $resGet = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-settings');

        $resGet->assertStatus(200);
        $this->assertFalse($resGet->json('data.my_id_system_enabled'));
        $this->assertFalse($resGet->json('data.my_id_payout_enabled'));

        // Update settings
        $resPatch = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->patchJson('/api/admin/my-id-settings', [
                'my_id_system_enabled' => true,
                'my_id_payout_enabled' => true,
                'my_id_usd_bdt_rate' => 125.50,
            ]);

        $resPatch->assertStatus(200);
        $this->assertTrue($resPatch->json('data.my_id_system_enabled'));
        $this->assertTrue($resPatch->json('data.my_id_payout_enabled'));
        $this->assertEquals(125.50, $resPatch->json('data.my_id_usd_bdt_rate'));
    }

    public function test_admin_can_add_payout_rule_and_receive_complete_payload(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-id-payout-rules', [
                'provider' => 'RevU',
                'offer_id' => 'game_123',
                'offer_name' => 'Fun Game',
                'coin_amount' => 400,
                'user_payout_usd' => 1.20,
                'is_active' => true,
            ]);

        $res->assertStatus(201);
        $res->assertJsonPath('success', true);
        $res->assertJsonPath('data.provider', 'RevU');
        $res->assertJsonPath('data.offer_id', 'game_123');
        $res->assertJsonPath('data.today_count', 0);
        $res->assertJsonPath('data.total_count', 0);

        $this->assertDatabaseHas('my_id_payout_rules', [
            'provider' => 'RevU',
            'offer_id' => 'game_123',
            'coin_amount' => 400,
        ]);
    }

    public function test_admin_can_edit_payout_rule_via_put_and_patch(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $rule = MyIdPayoutRule::create([
            'provider' => 'Offery',
            'offer_id' => 'off_1',
            'offer_name' => 'Offer 1',
            'coin_amount' => 300,
            'user_payout_usd' => 0.60,
            'is_active' => true,
        ]);

        // PATCH
        $resPatch = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->patchJson('/api/admin/my-id-payout-rules/'.$rule->id, [
                'user_payout_usd' => 0.85,
            ]);

        $resPatch->assertStatus(200);
        $resPatch->assertJsonPath('success', true);
        $resPatch->assertJsonPath('data.user_payout_usd', '0.8500');

        // PUT
        $resPut = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->putJson('/api/admin/my-id-payout-rules/'.$rule->id, [
                'user_payout_usd' => 0.90,
            ]);

        $resPut->assertStatus(200);
        $resPut->assertJsonPath('success', true);
        $resPut->assertJsonPath('data.user_payout_usd', '0.9000');
    }

    public function test_admin_can_delete_payout_rule(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $rule = MyIdPayoutRule::create([
            'provider' => 'DeleteProv',
            'offer_id' => 'del_1',
            'coin_amount' => 150,
            'user_payout_usd' => 0.30,
            'is_active' => true,
        ]);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->deleteJson('/api/admin/my-id-payout-rules/'.$rule->id);

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $this->assertDatabaseMissing('my_id_payout_rules', ['id' => $rule->id]);

        // Non-existent ID returns 404
        $res404 = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->deleteJson('/api/admin/my-id-payout-rules/999999');

        $res404->assertStatus(404);
        $res404->assertJsonPath('success', false);
    }

    public function test_admin_payout_rules_index_handles_undefined_and_null_query_strings(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        MyIdPayoutRule::create([
            'provider' => 'CleanProv',
            'offer_id' => 'clean_1',
            'coin_amount' => 100,
            'user_payout_usd' => 0.20,
            'is_active' => true,
        ]);

        // Query with literal 'undefined' parameters that raw frontend clients might pass
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-payout-rules?provider=undefined&status=undefined&search=undefined');

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $items = $res->json('data');
        $this->assertNotEmpty($items);
        $this->assertSame('CleanProv', $items[0]['provider']);
    }

    public function test_rule_based_earnings_flow_on_completed_task(): void
    {
        Setting::create(['name' => 'my_id_system_enabled', 'value' => '1']);
        Setting::create(['name' => 'my_id_usd_bdt_rate', 'value' => '122.00']);

        MyId::create([
            'my_id_code' => 'TEAM_BETA',
            'friendly_name' => 'Team Beta',
            'is_active' => true,
        ]);

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_'.uniqid(),
            'email' => 'worker_'.uniqid().'@example.com',
            'role' => 'user',
            'my_id' => 'TEAM_BETA',
            'balance' => 0,
        ]);

        $mod = $this->createModeratorUser('TEAM_BETA');
        $modToken = auth('api')->login($mod);

        // 1. Specific rule
        MyIdPayoutRule::create([
            'provider' => 'Torox',
            'offer_id' => 'game_prime',
            'offer_name' => 'Prime Game',
            'coin_amount' => 500,
            'user_payout_usd' => 1.50,
            'is_active' => true,
        ]);

        // 2. Wildcard rule
        MyIdPayoutRule::create([
            'provider' => 'Torox',
            'offer_id' => null,
            'offer_name' => null,
            'coin_amount' => 200,
            'user_payout_usd' => 0.50,
            'is_active' => true,
        ]);

        // Specific match task (provider raw revenue is $3.00, but rule payout is $1.50)
        $task1 = CompletedTask::create([
            'offer_wall_name' => 'Torox',
            'user_id' => $worker->id,
            'user_name' => $worker->username,
            'transaction_id' => 'tx_spec_'.uniqid(),
            'offer_name' => 'Prime Game',
            'offer_id' => 'game_prime',
            'revenue' => 3.00, // RAW PROVIDER REVENUE - NEVER EXPOSED
            'currency_reward' => 500.00,
        ]);

        $rec1 = MyIdEarningService::recordTaskEarning($task1);
        $this->assertTrue($rec1['created']);
        $this->assertEquals(1.50, $rec1['payout_usd']);
        $this->assertEquals(183.00, $rec1['payout_bdt']);

        // Wildcard match task (provider raw revenue is $1.80, but rule payout is $0.50)
        $task2 = CompletedTask::create([
            'offer_wall_name' => 'Torox',
            'user_id' => $worker->id,
            'user_name' => $worker->username,
            'transaction_id' => 'tx_wild_'.uniqid(),
            'offer_name' => 'Other Game',
            'offer_id' => 'random_offer_456',
            'revenue' => 1.80,
            'currency_reward' => 200.00,
        ]);

        $rec2 = MyIdEarningService::recordTaskEarning($task2);
        $this->assertTrue($rec2['created']);
        $this->assertEquals(0.50, $rec2['payout_usd']);
        $this->assertEquals(61.00, $rec2['payout_bdt']);

        // Check Moderator dashboard sees ONLY rule-based total ($2.00 USD), never raw provider revenue ($4.80)
        $resMod = $this->withHeaders(['Authorization' => 'Bearer '.$modToken])
            ->getJson('/api/moderator/dashboard?month=all');

        $resMod->assertStatus(200);
        $summary = $resMod->json('data.summary');
        $this->assertEquals(2, $summary['total_completed_offers']);
        $this->assertEquals(2.00, $summary['total_usd_earn']);
        $this->assertEquals(244.00, $summary['total_bdt_earn']);
    }
}
