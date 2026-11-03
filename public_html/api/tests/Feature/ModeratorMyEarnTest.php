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

class ModeratorMyEarnTest extends TestCase
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
                $table->boolean('is_active')->default(true);
                $table->timestamps();
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

        if (!Schema::hasTable('completed_tasks')) {
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('settings');

        parent::tearDown();
    }

    private function createModerator(string $username, ?string $myIdCode = null): User
    {
        return User::create([
            'name' => 'Moderator ' . $username,
            'username' => $username,
            'email' => $username . '@example.com',
            'role' => 'moderator',
            'password' => bcrypt('password123'),
            'my_id' => $myIdCode,
        ]);
    }

    public function test_unauthenticated_or_normal_user_cannot_access_my_earn(): void
    {
        $guestRes = $this->getJson('/api/moderator/my-earn');
        $guestRes->assertStatus(401);

        $normalUser = User::create([
            'name' => 'Normal User',
            'username' => 'normal_guy',
            'email' => 'normal@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
            'my_id' => '1001',
        ]);

        $userRes = $this->actingAs($normalUser, 'api')->getJson('/api/moderator/my-earn');
        $userRes->assertStatus(403);
    }

    public function test_moderator_my_id_isolation_never_shows_another_my_id(): void
    {
        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        MyId::create(['my_id_code' => '1002', 'is_active' => true]);

        $mod1 = $this->createModerator('mod_1001', '1001');
        $mod2 = $this->createModerator('mod_1002', '1002');
        $worker = User::create([
            'name' => 'Worker',
            'username' => 'worker_a',
            'email' => 'worker_a@example.com',
            'password' => 'secret',
            'my_id' => '1001',
        ]);

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        // Earning for 1001
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'offer_id' => 'off-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'payout_usd' => 0.70,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 85.40,
            'completed_at' => $now,
        ]);

        // Earning for 1002
        MyIdEarning::create([
            'my_id_code' => '1002',
            'user_id' => $worker->id,
            'completed_task_id' => 102,
            'provider' => 'AdGate',
            'offer_id' => 'off-2',
            'offer_name' => 'Survey',
            'coin_amount' => 500.00,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 183.00,
            'completed_at' => $now,
        ]);

        // Mod 1 requests: should ONLY see 1001, never 1002
        $res1 = $this->actingAs($mod1, 'api')->getJson('/api/moderator/my-earn');
        $res1->assertStatus(200);
        $res1->assertJsonPath('data.my_id', '1001');
        $res1->assertJsonPath('data.summary.total_offers', 1);
        $res1->assertJsonPath('data.items.0.provider', 'Vortex');
        $this->assertCount(1, $res1->json('data.items'));

        // Attempting to query another My ID via query parameter has NO effect
        $res1Hack = $this->actingAs($mod1, 'api')->getJson('/api/moderator/my-earn?my_id=1002');
        $res1Hack->assertStatus(200);
        $res1Hack->assertJsonPath('data.my_id', '1001');
        $this->assertCount(1, $res1Hack->json('data.items'));
        $this->assertSame('Vortex', $res1Hack->json('data.items.0.provider'));

        // Mod 2 requests: should ONLY see 1002
        $res2 = $this->actingAs($mod2, 'api')->getJson('/api/moderator/my-earn');
        $res2->assertStatus(200);
        $res2->assertJsonPath('data.my_id', '1002');
        $res2->assertJsonPath('data.summary.total_offers', 1);
        $res2->assertJsonPath('data.items.0.provider', 'AdGate');
        $this->assertCount(1, $res2->json('data.items'));
    }

    public function test_moderator_without_my_id_returns_empty_state(): void
    {
        $modWithoutMyId = $this->createModerator('mod_no_id', null);

        $res = $this->actingAs($modWithoutMyId, 'api')->getJson('/api/moderator/my-earn');
        $res->assertStatus(200);
        $res->assertJsonPath('data.has_my_id', false);
        $res->assertJsonPath('data.my_id', null);
        $res->assertJsonPath('data.summary.total_offers', 0);
        $this->assertEmpty($res->json('data.items'));
    }

    public function test_exact_phase_8_local_test_calculation_and_grouping(): void
    {
        /**
         * Requirement Local Test:
         * My ID 1001 has:
         * Vortex / Prime Video / 350 coins
         * 3 earnings
         * $0.70 each
         *
         * Expected:
         * Qty = 3
         * Total USD = $2.10
         *
         * At rate snapshots:
         * 122, 122, 125
         *
         * Expected BDT:
         * 85.40 + 85.40 + 87.50
         * = 258.30
         */
        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $mod = $this->createModerator('mod_1001_calc', '1001');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_u',
            'email' => 'worker_u@example.com',
            'password' => 'secret',
            'my_id' => '1001',
        ]);

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        // Earning 1: Rate 122 -> BDT 85.40
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 201,
            'provider' => 'Vortex',
            'offer_id' => 'pv-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'payout_usd' => 0.70,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 85.40,
            'completed_at' => $now,
        ]);

        // Earning 2: Rate 122 -> BDT 85.40
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 202,
            'provider' => 'Vortex',
            'offer_id' => 'pv-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'payout_usd' => 0.70,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 85.40,
            'completed_at' => $now,
        ]);

        // Earning 3: Rate 125 -> BDT 87.50
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 203,
            'provider' => 'Vortex',
            'offer_id' => 'pv-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'payout_usd' => 0.70,
            'usd_bdt_rate' => 125.00,
            'payout_bdt' => 87.50,
            'completed_at' => $now,
        ]);

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/my-earn');
        $res->assertStatus(200);

        // Check top summary cards
        $res->assertJsonPath('data.summary.total_offers', 3);
        $this->assertEquals(1050.0, $res->json('data.summary.total_coins'));
        $this->assertEquals(2.10, $res->json('data.summary.total_usd'));
        $this->assertEquals(258.30, $res->json('data.summary.total_bdt'));

        // Check grouped table
        $items = $res->json('data.items');
        $this->assertCount(1, $items);

        $row = $items[0];
        $this->assertSame('Vortex', $row['provider']);
        $this->assertSame('Prime Video', $row['offer']);
        $this->assertEquals(350.0, $row['coins']);
        $this->assertSame(3, $row['quantity']);
        $this->assertEquals(0.70, $row['rate_usd']);
        $this->assertEquals(2.10, $row['total_usd']);
        $this->assertEquals(258.30, $row['total_bdt']);
    }

    public function test_monthly_filtering_and_months_list_generation(): void
    {
        Carbon::setTestNow('2026-10-15 12:00:00');
        try {
            MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $mod = $this->createModerator('mod_months', '1001');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_m',
            'email' => 'worker_m@example.com',
            'password' => 'secret',
            'my_id' => '1001',
        ]);

        // September 2026 task
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 301,
            'provider' => 'Vortex',
            'offer_id' => 'sep-offer',
            'offer_name' => 'September Offer',
            'coin_amount' => 200.00,
            'payout_usd' => 0.40,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 48.00,
            'completed_at' => '2026-09-15 12:00:00',
        ]);

        // October 2026 task
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 302,
            'provider' => 'Vortex',
            'offer_id' => 'oct-offer',
            'offer_name' => 'October Offer',
            'coin_amount' => 400.00,
            'payout_usd' => 0.80,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 97.60,
            'completed_at' => '2026-10-10 12:00:00',
        ]);

        // Default request: selects current month (2026-10)
        $resDefault = $this->actingAs($mod, 'api')->getJson('/api/moderator/my-earn');
        $resDefault->assertStatus(200);
        $this->assertTrue(in_array('2026-09', $resDefault->json('data.months')));
        $this->assertTrue(in_array('2026-10', $resDefault->json('data.months')));

        // If today is 2026-10, default returns October task
        $resDefault->assertJsonPath('data.selected_month', '2026-10');
        $resDefault->assertJsonPath('data.summary.total_offers', 1);
        $resDefault->assertJsonPath('data.items.0.offer', 'October Offer');

        // Request specific month September 2026
        $resSep = $this->actingAs($mod, 'api')->getJson('/api/moderator/my-earn?month=2026-09');
        $resSep->assertStatus(200);
        $resSep->assertJsonPath('data.selected_month', '2026-09');
        $resSep->assertJsonPath('data.summary.total_offers', 1);
        $this->assertEquals(200.0, $resSep->json('data.summary.total_coins'));
        $this->assertEquals(0.40, $resSep->json('data.summary.total_usd'));
        $this->assertEquals(48.00, $resSep->json('data.summary.total_bdt'));
        $resSep->assertJsonPath('data.items.0.offer', 'September Offer');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_sorting_by_provider_then_offer_then_coins(): void
    {
        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $mod = $this->createModerator('mod_sorting', '1001');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_s',
            'email' => 'worker_s@example.com',
            'password' => 'secret',
            'my_id' => '1001',
        ]);

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        // 1. Vortex / Zebra
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 401,
            'provider' => 'Vortex',
            'offer_name' => 'Zebra Offer',
            'coin_amount' => 100.00,
            'payout_usd' => 0.50,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 61.00,
            'completed_at' => $now,
        ]);

        // 2. AdGate / Alpha
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 402,
            'provider' => 'AdGate',
            'offer_name' => 'Alpha Offer',
            'coin_amount' => 50.00,
            'payout_usd' => 0.20,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 24.40,
            'completed_at' => $now,
        ]);

        // 3. Vortex / Alpha (lower coins)
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 403,
            'provider' => 'Vortex',
            'offer_name' => 'Alpha Offer',
            'coin_amount' => 50.00,
            'payout_usd' => 0.20,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 24.40,
            'completed_at' => $now,
        ]);

        // 4. Vortex / Alpha (higher coins)
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 404,
            'provider' => 'Vortex',
            'offer_name' => 'Alpha Offer',
            'coin_amount' => 100.00,
            'payout_usd' => 0.40,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 48.80,
            'completed_at' => $now,
        ]);

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/my-earn');
        $res->assertStatus(200);

        $items = $res->json('data.items');
        $this->assertCount(4, $items);

        // Row 0: AdGate / Alpha (AdGate comes before Vortex)
        $this->assertSame('AdGate', $items[0]['provider']);
        $this->assertSame('Alpha Offer', $items[0]['offer']);

        // Row 1: Vortex / Alpha / 50 coins
        $this->assertSame('Vortex', $items[1]['provider']);
        $this->assertSame('Alpha Offer', $items[1]['offer']);
        $this->assertEquals(50.0, $items[1]['coins']);

        // Row 2: Vortex / Alpha / 100 coins
        $this->assertSame('Vortex', $items[2]['provider']);
        $this->assertSame('Alpha Offer', $items[2]['offer']);
        $this->assertEquals(100.0, $items[2]['coins']);

        // Row 3: Vortex / Zebra Offer (Zebra comes after Alpha)
        $this->assertSame('Vortex', $items[3]['provider']);
        $this->assertSame('Zebra Offer', $items[3]['offer']);
    }

    public function test_snapshot_values_used_immutable_after_admin_rate_change(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $mod = $this->createModerator('mod_immutable', '1001');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_i',
            'email' => 'worker_i@example.com',
            'password' => 'secret',
            'my_id' => '1001',
        ]);

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $worker->id,
            'completed_task_id' => 501,
            'provider' => 'Vortex',
            'offer_id' => 'pv-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'payout_usd' => 0.70,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 85.40,
            'completed_at' => $now,
        ]);

        // Admin modifies global rate to 135.00
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '135.00');

        // Query My Earn: must still show 85.40, NOT 0.70 * 135 = 94.50
        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/my-earn');
        $res->assertStatus(200);
        $res->assertJsonPath('data.summary.total_bdt', 85.40);
        $res->assertJsonPath('data.items.0.total_bdt', 85.40);
    }

    public function test_read_only_endpoint_refuses_mutations(): void
    {
        $mod = $this->createModerator('mod_readonly', '1001');

        $postRes = $this->actingAs($mod, 'api')->postJson('/api/moderator/my-earn', ['fake' => 'data']);
        $postRes->assertStatus(405);

        $deleteRes = $this->actingAs($mod, 'api')->deleteJson('/api/moderator/my-earn');
        $deleteRes->assertStatus(405);
    }
}
