<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdEarning;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdPhase10DashboardLeaderboardTest extends TestCase
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
        } elseif (!Schema::hasColumn('my_ids', 'friendly_name')) {
            Schema::table('my_ids', function (Blueprint $table): void {
                $table->string('friendly_name')->nullable()->after('label');
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('username')->unique();
                $table->string('email')->unique();
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
                $table->string('password');
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('my_id_earnings')) {
            Schema::create('my_id_earnings', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->unsignedBigInteger('completed_task_id')->unique();
                $table->string('provider')->index();
                $table->string('offer_id')->nullable()->index();
                $table->string('offer_name')->nullable();
                $table->decimal('coin_amount', 14, 4);
                $table->decimal('payout_usd', 14, 4);
                $table->decimal('usd_bdt_rate', 14, 4);
                $table->decimal('payout_bdt', 14, 4);
                $table->timestamp('completed_at')->nullable()->index();
                $table->timestamps();
            });
        }

        Setting::query()->delete();
        MyIdEarning::query()->delete();
        User::query()->delete();
        MyId::query()->delete();
    }

    public function test_admin_can_set_and_edit_friendly_name(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_p10',
            'email' => 'admin_p10@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);

        // 1. Create My ID with friendly_name
        $createRes = $this->actingAs($admin, 'api')
            ->postJson('/api/admin/my-ids', [
                'my_id_code' => '1002',
                'label' => 'Team Rihan',
                'friendly_name' => 'Rihan',
                'is_active' => true,
            ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.my_id_code', '1002')
            ->assertJsonPath('data.friendly_name', 'Rihan')
            ->assertJsonPath('data.label', 'Team Rihan');

        $myId = MyId::where('my_id_code', '1002')->first();
        $this->assertNotNull($myId);
        $this->assertEquals('Rihan', $myId->friendly_name);

        // 2. Edit friendly_name
        $updateRes = $this->actingAs($admin, 'api')
            ->patchJson("/api/admin/my-ids/{$myId->id}", [
                'friendly_name' => 'Rihan Al Mamun',
                'label' => 'VIP Team',
            ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.friendly_name', 'Rihan Al Mamun')
            ->assertJsonPath('data.label', 'VIP Team');

        $this->assertEquals('Rihan Al Mamun', $myId->fresh()->friendly_name);

        // 3. Search by friendly name in Admin index
        $searchRes = $this->actingAs($admin, 'api')
            ->getJson('/api/admin/my-ids?search=Rihan');

        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data'));
        $this->assertEquals('1002', $searchRes->json('data.0.my_id_code'));

        // 4. Admin overview includes friendly_name
        $overviewRes = $this->actingAs($admin, 'api')
            ->getJson('/api/admin/my-id-overview?search=Rihan');

        $overviewRes->assertStatus(200)
            ->assertJsonPath('data.0.friendly_name', 'Rihan Al Mamun');
    }

    public function test_moderator_dashboard_top_cards_and_grouped_earning_table(): void
    {
        $currentMonth = Carbon::now('UTC')->format('Y-m');

        $myId1002 = MyId::create([
            'my_id_code' => '1002',
            'label' => 'Rihan Team',
            'friendly_name' => 'Rihan',
            'is_active' => true,
        ]);

        $moderator = User::create([
            'name' => 'Rihan Moderator',
            'username' => 'rihan_mod',
            'email' => 'rihan@example.com',
            'role' => 'moderator',
            'my_id' => '1002',
            'password' => bcrypt('password123'),
        ]);

        // Create 3 linked users under My ID 1002
        for ($i = 1; $i <= 3; $i++) {
            User::create([
                'name' => "Worker {$i}",
                'username' => "worker_{$i}",
                'email' => "worker_{$i}@example.com",
                'role' => 'user',
                'my_id' => '1002',
                'password' => bcrypt('password123'),
            ]);
        }

        // Create 25 completed tasks for Vortex Prime Video (Coins: 350, Rate USD: 0.70, Rate BDT: 85.40, Total BDT: 2135.00)
        for ($i = 1; $i <= 25; $i++) {
            MyIdEarning::create([
                'my_id_code' => '1002',
                'user_id' => 1,
                'completed_task_id' => 100 + $i,
                'provider' => 'Vortex',
                'offer_id' => 'prime-1',
                'offer_name' => 'Prime Video',
                'coin_amount' => 350,
                'payout_usd' => 0.70,
                'usd_bdt_rate' => 122.00,
                'payout_bdt' => 85.40,
                'completed_at' => "{$currentMonth}-15 12:00:00",
            ]);
        }

        // Create 10 completed tasks for Torox Spotify (Coins: 200, Rate USD: 0.50, Rate BDT: 61.00, Total BDT: 610.00)
        for ($i = 1; $i <= 10; $i++) {
            MyIdEarning::create([
                'my_id_code' => '1002',
                'user_id' => 2,
                'completed_task_id' => 200 + $i,
                'provider' => 'Torox',
                'offer_id' => 'spotify-1',
                'offer_name' => 'Spotify',
                'coin_amount' => 200,
                'payout_usd' => 0.50,
                'usd_bdt_rate' => 122.00,
                'payout_bdt' => 61.00,
                'completed_at' => "{$currentMonth}-16 14:00:00",
            ]);
        }

        $res = $this->actingAs($moderator, 'api')
            ->getJson('/api/moderator/dashboard');

        $res->assertStatus(200);

        // Top Summary Cards Verification
        $res->assertJsonPath('data.my_id', '1002')
            ->assertJsonPath('data.friendly_name', 'Rihan')
            ->assertJsonPath('data.has_my_id', true)
            ->assertJsonPath('data.total_linked_users', 4)
            ->assertJsonPath('data.summary.total_linked_users', 4)
            ->assertJsonPath('data.summary.total_completed_offers', 35);

        // Total USD = (25 * 0.70) + (10 * 0.50) = 17.50 + 5.00 = 22.50
        $this->assertEquals(22.50, (float) $res->json('data.summary.total_usd_earn'));

        // Total BDT = (25 * 85.40) + (10 * 61.00) = 2135.00 + 610.00 = 2745.00
        $this->assertEquals(2745.00, (float) $res->json('data.summary.total_bdt_earn'));

        // Grouped Earning Table Verification
        $items = $res->json('data.items');
        $this->assertCount(2, $items);

        // First item: Torox Spotify (sorted by provider Torox < Vortex)
        $this->assertEquals(1, $items[0]['sl']);
        $this->assertEquals('Torox', $items[0]['provider']);
        $this->assertEquals('Spotify', $items[0]['offer']);
        $this->assertEquals(200.0, (float) $items[0]['coins']);
        $this->assertEquals(10, $items[0]['quantity']);
        $this->assertEquals(0.50, (float) $items[0]['rate_usd']);
        $this->assertEquals(61.00, (float) $items[0]['rate_bdt']);
        $this->assertEquals(610.00, (float) $items[0]['total_bdt']);

        // Second item: Vortex Prime Video
        $this->assertEquals(2, $items[1]['sl']);
        $this->assertEquals('Vortex', $items[1]['provider']);
        $this->assertEquals('Prime Video', $items[1]['offer']);
        $this->assertEquals(350.0, (float) $items[1]['coins']);
        $this->assertEquals(25, $items[1]['quantity']);
        $this->assertEquals(0.70, (float) $items[1]['rate_usd']);
        $this->assertEquals(85.40, (float) $items[1]['rate_bdt']);
        $this->assertEquals(2135.00, (float) $items[1]['total_bdt']);
    }

    public function test_leaderboard_top_5_and_own_rank_outside_top_5(): void
    {
        $currentMonth = Carbon::now('UTC')->format('Y-m');

        // Create 7 My IDs (1001 to 1007)
        for ($i = 1; $i <= 7; $i++) {
            MyId::create([
                'my_id_code' => "100{$i}",
                'label' => "Label 100{$i}",
                'friendly_name' => "WorkerName_{$i}",
                'is_active' => true,
            ]);
        }

        // Moderator is 1007 (will be ranked #7, outside Top 5)
        $mod = User::create([
            'name' => 'Mod Seven',
            'username' => 'mod_7',
            'email' => 'mod7@example.com',
            'role' => 'moderator',
            'my_id' => '1007',
            'password' => bcrypt('password123'),
        ]);

        // Seed earnings:
        // 1001: 5000 BDT (Rank 1)
        // 1002: 4000 BDT (Rank 2)
        // 1003: 3000 BDT (Rank 3)
        // 1004: 2000 BDT (Rank 4)
        // 1005: 1000 BDT (Rank 5)
        // 1006: 500 BDT  (Rank 6)
        // 1007: 200 BDT  (Rank 7 - Moderator's own rank)
        $payouts = [
            1 => 5000.0,
            2 => 4000.0,
            3 => 3000.0,
            4 => 2000.0,
            5 => 1000.0,
            6 => 500.0,
            7 => 200.0,
        ];

        foreach ($payouts as $idNum => $bdt) {
            MyIdEarning::create([
                'my_id_code' => "100{$idNum}",
                'user_id' => 1,
                'completed_task_id' => 500 + $idNum,
                'provider' => 'Vortex',
                'offer_id' => 'offer-test',
                'offer_name' => 'Test Offer',
                'coin_amount' => 100,
                'payout_usd' => $bdt / 100,
                'usd_bdt_rate' => 100.0,
                'payout_bdt' => $bdt,
                'completed_at' => "{$currentMonth}-10 10:00:00",
            ]);
        }

        $res = $this->actingAs($mod, 'api')
            ->getJson('/api/moderator/dashboard');

        $res->assertStatus(200);

        // My Rank check (1007 is rank #7 of 7 teams!)
        $myRank = $res->json('data.my_rank');
        $this->assertNotNull($myRank);
        $this->assertEquals(7, $myRank['rank']);
        $this->assertEquals(7, $myRank['total_teams']);
        $this->assertEquals('1007', $myRank['my_id_code']);
        $this->assertEquals(2.0, (float) $myRank['monthly_usd']);

        // Check Top Workers strictly scoped to own My ID
        $topWorkers = $res->json('data.top_workers');
        $this->assertIsArray($topWorkers);
        $this->assertCount(1, $topWorkers);
        $this->assertEquals(1, $topWorkers[0]['rank']);
        $this->assertEquals(1, $topWorkers[0]['completed_offers']);
        $this->assertEquals(2.0, (float) $topWorkers[0]['payout_usd']);
    }

    public function test_moderator_my_id_strict_isolation_and_no_leak_of_private_data(): void
    {
        $currentMonth = Carbon::now('UTC')->format('Y-m');

        MyId::create(['my_id_code' => '1001', 'friendly_name' => 'Alice']);
        MyId::create(['my_id_code' => '1002', 'friendly_name' => 'Bob']);

        $modAlice = User::create([
            'name' => 'Alice Mod',
            'username' => 'alice_mod',
            'email' => 'alice@secret-domain.com',
            'role' => 'moderator',
            'my_id' => '1001',
            'balance' => 999.99,
            'ip' => '192.168.1.100',
            'password' => bcrypt('password123'),
        ]);

        // Earning for Alice
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => 1,
            'completed_task_id' => 901,
            'provider' => 'ProviderA',
            'offer_id' => 'off-1',
            'offer_name' => 'Alice Secret Task',
            'coin_amount' => 100,
            'payout_usd' => 1.00,
            'usd_bdt_rate' => 120.0,
            'payout_bdt' => 120.0,
            'completed_at' => "{$currentMonth}-05 10:00:00",
        ]);

        // Earning for Bob
        MyIdEarning::create([
            'my_id_code' => '1002',
            'user_id' => 2,
            'completed_task_id' => 902,
            'provider' => 'ProviderB',
            'offer_id' => 'off-2',
            'offer_name' => 'Bob Private Campaign',
            'coin_amount' => 500,
            'payout_usd' => 5.00,
            'usd_bdt_rate' => 120.0,
            'payout_bdt' => 600.0,
            'completed_at' => "{$currentMonth}-06 10:00:00",
        ]);

        $res = $this->actingAs($modAlice, 'api')
            ->getJson('/api/moderator/dashboard');

        $res->assertStatus(200);

        // Moderator Alice items must ONLY contain Alice's offer
        $items = $res->json('data.items');
        $this->assertCount(1, $items);
        $this->assertEquals('Alice Secret Task', $items[0]['offer']);

        // Bob's specific offer details must NOT be in items
        $jsonString = $res->getContent();
        $this->assertStringNotContainsString('Bob Private Campaign', $jsonString);

        // No private user details (email, ip, balance) anywhere in the JSON response
        $this->assertStringNotContainsString('alice@secret-domain.com', $jsonString);
        $this->assertStringNotContainsString('192.168.1.100', $jsonString);
        $this->assertStringNotContainsString('999.99', $jsonString);
        $this->assertStringNotContainsString('completed_tasks.revenue', $jsonString);
    }
}
