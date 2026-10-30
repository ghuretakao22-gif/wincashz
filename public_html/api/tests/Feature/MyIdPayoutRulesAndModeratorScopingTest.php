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
}
