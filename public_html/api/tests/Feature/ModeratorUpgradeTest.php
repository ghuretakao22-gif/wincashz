<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeratorUpgradeTest extends TestCase
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
            $table->string('my_id')->nullable()->index();
            $table->string('ip', 45)->nullable();
            $table->string('country')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->unsignedInteger('level')->default(1);
            $table->boolean('ban')->default(false);
            $table->string('password')->default('secret');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('my_ids', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->unique();
            $table->string('friendly_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('assigned_user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('my_id_earnings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('completed_task_id')->nullable();
            $table->string('transaction_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('username')->nullable();
            $table->string('my_id_code')->index();
            $table->string('provider');
            $table->string('offer_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->decimal('coin_amount', 12, 2)->default(0);
            $table->decimal('payout_usd', 10, 4)->default(0);
            $table->decimal('usd_bdt_rate', 10, 2)->default(120.00);
            $table->decimal('payout_bdt', 12, 2)->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    protected function createModerator(string $myIdCode = 'MOD_TEAM_A'): User
    {
        $id = DB::table('users')->insertGetId([
            'name' => 'Team Moderator',
            'username' => 'mod_user',
            'email' => 'mod@wincashz.com',
            'role' => 'moderator',
            'my_id' => $myIdCode,
            'password' => Hash::make('password123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('my_ids')->insert([
            'my_id_code' => $myIdCode,
            'friendly_name' => 'Alpha Team',
            'is_active' => true,
            'assigned_user_id' => $id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::findOrFail($id);
    }

    public function test_guest_and_regular_user_cannot_access_moderator_completed_offers(): void
    {
        $res = $this->getJson('/api/moderator/completed-offers');
        $res->assertUnauthorized();

        $normalUser = User::forceCreate([
            'name' => 'Regular User',
            'username' => 'worker_1',
            'email' => 'worker@wincashz.com',
            'role' => 'user',
            'password' => Hash::make('secret'),
        ]);

        $resUser = $this->actingAs($normalUser, 'api')->getJson('/api/moderator/completed-offers');
        $resUser->assertForbidden();
    }

    public function test_moderator_completed_offers_strictly_isolated_to_moderator_my_id(): void
    {
        $mod = $this->createModerator('TEAM_A');

        $workerA = User::forceCreate([
            'name' => 'Worker Alpha',
            'username' => 'worker_alpha',
            'email' => 'alpha@gmail.com',
            'role' => 'user',
            'my_id' => 'TEAM_A',
            'password' => Hash::make('secret'),
        ]);

        $workerB = User::forceCreate([
            'name' => 'Worker Beta',
            'username' => 'worker_beta',
            'email' => 'beta@gmail.com',
            'role' => 'user',
            'my_id' => 'TEAM_B',
            'password' => Hash::make('secret'),
        ]);

        // Earning for TEAM_A
        DB::table('my_id_earnings')->insert([
            'user_id' => $workerA->id,
            'username' => $workerA->username,
            'my_id_code' => 'TEAM_A',
            'provider' => 'Torox',
            'offer_id' => 'tx_101',
            'offer_name' => 'Install App A',
            'coin_amount' => 500,
            'payout_usd' => 1.25,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 152.50,
            'completed_at' => now()->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Earning for TEAM_B (should NEVER be visible to TEAM_A)
        DB::table('my_id_earnings')->insert([
            'user_id' => $workerB->id,
            'username' => $workerB->username,
            'my_id_code' => 'TEAM_B',
            'provider' => 'RevU',
            'offer_id' => 'ru_999',
            'offer_name' => 'Secret App B',
            'coin_amount' => 1000,
            'payout_usd' => 3.50,
            'usd_bdt_rate' => 125.00,
            'payout_bdt' => 437.50,
            'completed_at' => now()->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all');
        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $data = $response->json('data.data');
        $this->assertCount(1, $data);
        $this->assertEquals('Install App A', $data[0]['offer_name']);
        $this->assertEquals('Torox', $data[0]['provider']);
        $this->assertEquals(1.25, $data[0]['payout_usd']);
        $this->assertEquals(152.5, $data[0]['payout_bdt']);
        $this->assertEquals('Completed', $data[0]['status']);

        // Check summary totals
        $summary = $response->json('data.summary');
        $this->assertEquals(1, $summary['total_records']);
        $this->assertEquals(1.25, $summary['sum_usd']);
        $this->assertEquals(152.5, $summary['sum_bdt']);
    }

    public function test_moderator_completed_offers_filtering_by_provider_and_user(): void
    {
        $mod = $this->createModerator('TEAM_A');

        $worker1 = User::forceCreate([
            'name' => 'Worker One',
            'username' => 'worker_1',
            'email' => 'worker1@example.com',
            'role' => 'user',
            'my_id' => 'TEAM_A',
            'password' => Hash::make('secret'),
        ]);

        $worker2 = User::forceCreate([
            'name' => 'Worker Two',
            'username' => 'worker_2',
            'email' => 'worker2@example.com',
            'role' => 'user',
            'my_id' => 'TEAM_A',
            'password' => Hash::make('secret'),
        ]);

        DB::table('my_id_earnings')->insert([
            'user_id' => $worker1->id,
            'username' => $worker1->username,
            'my_id_code' => 'TEAM_A',
            'provider' => 'Torox',
            'offer_id' => 'torox_1',
            'offer_name' => 'Survey X',
            'coin_amount' => 200,
            'payout_usd' => 0.50,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 60.00,
            'completed_at' => now()->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('my_id_earnings')->insert([
            'user_id' => $worker2->id,
            'username' => $worker2->username,
            'my_id_code' => 'TEAM_A',
            'provider' => 'AdGate',
            'offer_id' => 'adgate_2',
            'offer_name' => 'Game Y',
            'coin_amount' => 800,
            'payout_usd' => 2.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 240.00,
            'completed_at' => now()->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Filter by provider
        $resProvider = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all&provider=AdGate');
        $resProvider->assertOk();
        $this->assertCount(1, $resProvider->json('data.data'));
        $this->assertEquals('Game Y', $resProvider->json('data.data.0.offer_name'));

        // Filter by user_id
        $resUser = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all&user_id='.$worker1->id);
        $resUser->assertOk();
        $this->assertCount(1, $resUser->json('data.data'));
        $this->assertEquals('Survey X', $resUser->json('data.data.0.offer_name'));
    }

    public function test_moderator_settings_get_and_patch(): void
    {
        $mod = $this->createModerator('TEAM_A');

        // GET settings
        $resGet = $this->actingAs($mod, 'api')->getJson('/api/moderator/settings');
        $resGet->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.profile.username', 'mod_user')
            ->assertJsonPath('data.my_id.code', 'TEAM_A')
            ->assertJsonPath('data.my_id.friendly_name', 'Alpha Team')
            ->assertJsonPath('data.system_info.timezone', 'UTC');

        // PATCH preferences
        $resPatch = $this->actingAs($mod, 'api')->patchJson('/api/moderator/settings', [
            'name' => 'Updated Mod Name',
            'payout_preferences' => [
                'default_method' => 'bkash',
                'account_number' => '01712345678',
                'account_holder_name' => 'Mod Alpha',
                'bank_name' => '',
                'branch_name' => '',
            ],
        ]);

        $resPatch->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.profile.name', 'Updated Mod Name')
            ->assertJsonPath('data.payout_preferences.default_method', 'bkash')
            ->assertJsonPath('data.payout_preferences.account_number', '01712345678');

        // Verify password change
        $resPw = $this->actingAs($mod, 'api')->patchJson('/api/moderator/settings', [
            'current_password' => 'password123',
            'new_password' => 'new_secure_password_123',
            'new_password_confirmation' => 'new_secure_password_123',
        ]);
        $resPw->assertOk()
            ->assertJsonPath('status', 'success');

        $modFresh = User::findOrFail($mod->id);
        $this->assertTrue(Hash::check('new_secure_password_123', $modFresh->password));
    }

    public function test_leaderboard_returns_top_5_own_my_id_workers_for_current_month(): void
    {
        $mod = $this->createModerator('TEAM_ALPHA');
        $currentMonth = now()->format('Y-m');

        // Create 6 workers under TEAM_ALPHA
        for ($i = 1; $i <= 6; $i++) {
            $w = User::forceCreate([
                'name' => "Alpha Worker {$i}",
                'username' => "alpha_worker_{$i}",
                'email' => "w{$i}@alpha.com",
                'role' => 'user',
                'my_id' => 'TEAM_ALPHA',
                'password' => Hash::make('secret'),
            ]);

            // Worker $i completes $i * 2 offers
            for ($k = 1; $k <= ($i * 2); $k++) {
                DB::table('my_id_earnings')->insert([
                    'user_id' => $w->id,
                    'my_id_code' => 'TEAM_ALPHA',
                    'provider' => 'Torox',
                    'offer_id' => "off_{$i}_{$k}",
                    'offer_name' => "Task {$k}",
                    'coin_amount' => 100,
                    'payout_usd' => 0.50,
                    'usd_bdt_rate' => 120.00,
                    'payout_bdt' => 60.00,
                    'completed_at' => "{$currentMonth}-10 10:00:00",
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/dashboard');
        $res->assertOk()
            ->assertJsonPath('status', 'success');

        $topWorkers = $res->json('data.top_workers');
        $this->assertCount(5, $topWorkers);

        // Worker 6 completed 12 offers (Rank 1)
        $this->assertEquals(1, $topWorkers[0]['rank']);
        $this->assertEquals('alpha_worker_6', $topWorkers[0]['username']);
        $this->assertEquals(12, $topWorkers[0]['completed_offers']);
        $this->assertEquals(6.00, $topWorkers[0]['payout_usd']);

        // Worker 2 is Rank 5 (4 offers)
        $this->assertEquals(5, $topWorkers[4]['rank']);
        $this->assertEquals('alpha_worker_2', $topWorkers[4]['username']);
        $this->assertEquals(4, $topWorkers[4]['completed_offers']);
    }

    public function test_my_rank_returns_correct_position_among_multiple_my_ids_by_monthly_earnings(): void
    {
        $mod = $this->createModerator('TEAM_BETA');
        $currentMonth = now()->format('Y-m');

        // Create 3 active teams: TEAM_GAMMA, TEAM_BETA, TEAM_DELTA
        DB::table('my_ids')->insert([
            ['my_id_code' => 'TEAM_GAMMA', 'friendly_name' => 'Gamma', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['my_id_code' => 'TEAM_DELTA', 'friendly_name' => 'Delta', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Seed earnings:
        // TEAM_GAMMA: $50 USD (Rank 1)
        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'TEAM_GAMMA',
            'user_id' => 99,
            'provider' => 'RevU',
            'coin_amount' => 5000,
            'payout_usd' => 50.00,
            'payout_bdt' => 6000.00,
            'completed_at' => "{$currentMonth}-12 12:00:00",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // TEAM_BETA (mod): $30 USD (Rank 2)
        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'TEAM_BETA',
            'user_id' => 101,
            'provider' => 'Torox',
            'coin_amount' => 3000,
            'payout_usd' => 30.00,
            'payout_bdt' => 3600.00,
            'completed_at' => "{$currentMonth}-12 12:00:00",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // TEAM_DELTA: $10 USD (Rank 3)
        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'TEAM_DELTA',
            'user_id' => 102,
            'provider' => 'AdGate',
            'coin_amount' => 1000,
            'payout_usd' => 10.00,
            'payout_bdt' => 1200.00,
            'completed_at' => "{$currentMonth}-12 12:00:00",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/dashboard');
        $res->assertOk();

        $myRank = $res->json('data.my_rank');
        $this->assertEquals(2, $myRank['rank']); // Position 2 of 3
        $this->assertEquals(3, $myRank['total_teams']);
        $this->assertEquals('TEAM_BETA', $myRank['my_id_code']);
        $this->assertEquals(30.00, $myRank['monthly_usd']);

        // Check privacy: response must NOT contain other teams' names or codes in leaderboard
        $json = $res->getContent();
        $this->assertStringNotContainsString('TEAM_GAMMA', $json);
        $this->assertStringNotContainsString('TEAM_DELTA', $json);
        $this->assertStringNotContainsString('Gamma', $json);
        $this->assertStringNotContainsString('Delta', $json);
    }

    public function test_moderator_cannot_see_other_my_id_workers_in_leaderboard(): void
    {
        $mod = $this->createModerator('TEAM_ONE');
        $currentMonth = now()->format('Y-m');

        $workerOwn = User::forceCreate([
            'name' => 'Own Worker',
            'username' => 'own_worker_alice',
            'email' => 'alice@teamone.com',
            'role' => 'user',
            'my_id' => 'TEAM_ONE',
            'password' => Hash::make('secret'),
        ]);

        $workerOther = User::forceCreate([
            'name' => 'Foreign Worker',
            'username' => 'foreign_worker_bob',
            'email' => 'bob@teamtwo.com',
            'role' => 'user',
            'my_id' => 'TEAM_TWO',
            'password' => Hash::make('secret'),
        ]);

        DB::table('my_id_earnings')->insert([
            'user_id' => $workerOwn->id,
            'my_id_code' => 'TEAM_ONE',
            'provider' => 'Torox',
            'coin_amount' => 500,
            'payout_usd' => 5.00,
            'payout_bdt' => 600.00,
            'completed_at' => "{$currentMonth}-05 10:00:00",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('my_id_earnings')->insert([
            'user_id' => $workerOther->id,
            'my_id_code' => 'TEAM_TWO',
            'provider' => 'Torox',
            'coin_amount' => 1000,
            'payout_usd' => 10.00,
            'payout_bdt' => 1200.00,
            'completed_at' => "{$currentMonth}-05 10:00:00",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/dashboard');
        $res->assertOk();

        $topWorkers = $res->json('data.top_workers');
        $this->assertCount(1, $topWorkers);
        $this->assertEquals('own_worker_alice', $topWorkers[0]['username']);

        // foreign worker bob must NOT appear in leaderboard
        $usernames = collect($topWorkers)->pluck('username')->all();
        $this->assertNotContains('foreign_worker_bob', $usernames);
    }
}
