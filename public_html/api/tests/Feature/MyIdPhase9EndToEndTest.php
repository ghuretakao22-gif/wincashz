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

class MyIdPhase9EndToEndTest extends TestCase
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
        Schema::dropIfExists('my_id_payout_rules');
        Schema::dropIfExists('settings');

        parent::tearDown();
    }

    public function test_full_phase_9_e2e_workflow(): void
    {
        // =========================================================================
        // Step A: Create My ID 1001
        // =========================================================================
        $myId = MyId::create([
            'my_id_code' => '1001',
            'label' => 'Team Alpha Worker',
            'is_active' => true,
        ]);
        $this->assertDatabaseHas('my_ids', ['my_id_code' => '1001', 'is_active' => 1]);

        // =========================================================================
        // Step B: Moderator linked to My ID 1001
        // =========================================================================
        $moderator = User::create([
            'name' => 'Mod Alpha',
            'username' => 'mod_1001',
            'email' => 'mod1001@example.com',
            'role' => 'moderator',
            'password' => bcrypt('password123'),
            'my_id' => '1001',
        ]);
        $this->assertSame('1001', $moderator->my_id);

        // Also create Admin User for testing Admin Overview
        $admin = User::create([
            'name' => 'Super Admin',
            'username' => 'admin_super',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);

        // =========================================================================
        // Step C: Create 3 normal user accounts using My ID 1001
        // =========================================================================
        $userA = User::create([
            'name' => 'Worker User A',
            'username' => 'worker_a',
            'email' => 'workera@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
            'my_id' => '1001',
        ]);

        $userB = User::create([
            'name' => 'Worker User B',
            'username' => 'worker_b',
            'email' => 'workerb@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
            'my_id' => '1001',
        ]);

        $userC = User::create([
            'name' => 'Worker User C',
            'username' => 'worker_c',
            'email' => 'workerc@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
            'my_id' => '1001',
        ]);

        // Verify linked users
        $linkedUsersCount = User::where('my_id', '1001')->count();
        $this->assertGreaterThanOrEqual(3, $linkedUsersCount);

        // =========================================================================
        // Step D: Add payout rule: Vortex / Prime Video / 350 Coins / $0.70 Payout
        // =========================================================================
        $payoutRule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'pv-101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);
        $this->assertDatabaseHas('my_id_payout_rules', ['offer_name' => 'Prime Video', 'user_payout_usd' => 0.70]);

        // =========================================================================
        // Step E: My ID Settings: Enabled = ON, Start Date = current, USD/BDT = 122
        // =========================================================================
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_START_DATE, Carbon::now('UTC')->subHour()->format('Y-m-d H:i:s'));
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        $this->assertTrue(MyIdEarningService::isSystemEnabled());
        $this->assertEquals(122.00, MyIdEarningService::getUsdBdtRate());

        // =========================================================================
        // Step F: Create/process 3 eligible completed task records (all linked users, Vortex, Prime Video, 350 coins)
        // =========================================================================
        $task1 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userA->id,
            'user_name' => $userA->username,
            'transaction_id' => 'tx_e2e_1',
            'offer_id' => 'pv-101',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 10.00, // Raw provider revenue - MUST BE IGNORED
        ]);
        $rec1 = MyIdEarningService::recordTaskEarning($task1);
        $this->assertTrue($rec1['created']);
        $this->assertEquals(0.70, $rec1['payout_usd']);
        $this->assertEquals(122.00, $rec1['usd_bdt_rate']);
        $this->assertEquals(85.40, $rec1['payout_bdt']); // 0.70 * 122 = 85.40

        $task2 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userB->id,
            'user_name' => $userB->username,
            'transaction_id' => 'tx_e2e_2',
            'offer_id' => 'pv-101',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 12.50,
        ]);
        $rec2 = MyIdEarningService::recordTaskEarning($task2);
        $this->assertTrue($rec2['created']);
        $this->assertEquals(85.40, $rec2['payout_bdt']);

        $task3 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userC->id,
            'user_name' => $userC->username,
            'transaction_id' => 'tx_e2e_3',
            'offer_id' => 'pv-101',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 14.00,
        ]);
        $rec3 = MyIdEarningService::recordTaskEarning($task3);
        $this->assertTrue($rec3['created']);
        $this->assertEquals(85.40, $rec3['payout_bdt']);

        // Check before rate change: Exactly 3 earning ledger rows
        $this->assertSame(3, MyIdEarning::count());

        // Check Moderator My Earn endpoint before rate change:
        // Expected: Qty = 3, Total USD = $2.10, Total BDT = ৳256.20 (85.40 * 3 = 256.20)
        $modResBefore = $this->actingAs($moderator, 'api')->getJson('/api/moderator/my-earn');
        $modResBefore->assertStatus(200);
        $modResBefore->assertJsonPath('data.summary.total_offers', 3);
        $this->assertEquals(2.10, $modResBefore->json('data.summary.total_usd'));
        $this->assertEquals(256.20, $modResBefore->json('data.summary.total_bdt'));
        $this->assertEquals(3, $modResBefore->json('data.items.0.quantity'));
        $this->assertEquals(2.10, $modResBefore->json('data.items.0.total_usd'));
        $this->assertEquals(256.20, $modResBefore->json('data.items.0.total_bdt'));

        // =========================================================================
        // Step G: Change USD/BDT rate to 125. Create one NEW eligible completion.
        // =========================================================================
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '125.00');
        $this->assertEquals(125.00, MyIdEarningService::getUsdBdtRate());

        $task4 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userA->id,
            'user_name' => $userA->username,
            'transaction_id' => 'tx_e2e_4',
            'offer_id' => 'pv-101',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 15.00,
        ]);
        $rec4 = MyIdEarningService::recordTaskEarning($task4);
        $this->assertTrue($rec4['created']);
        $this->assertEquals(0.70, $rec4['payout_usd']);
        $this->assertEquals(125.00, $rec4['usd_bdt_rate']);
        $this->assertEquals(87.50, $rec4['payout_bdt']); // 0.70 * 125 = 87.50

        // Old 3 earnings MUST remain unchanged (85.40 each at rate 122)
        $oldEarnings = MyIdEarning::whereIn('completed_task_id', [$task1->id, $task2->id, $task3->id])->get();
        foreach ($oldEarnings as $old) {
            $this->assertEquals(122.00, (float) $old->usd_bdt_rate);
            $this->assertEquals(85.40, (float) $old->payout_bdt);
            $this->assertEquals(0.70, (float) $old->payout_usd);
        }

        // Expected New totals: Qty = 4, Total USD = $2.80, Total BDT = ৳343.70 (256.20 + 87.50 = 343.70)
        $modResAfter = $this->actingAs($moderator, 'api')->getJson('/api/moderator/my-earn');
        $modResAfter->assertStatus(200);
        $modResAfter->assertJsonPath('data.summary.total_offers', 4);
        $this->assertEquals(2.80, $modResAfter->json('data.summary.total_usd'));
        $this->assertEquals(343.70, $modResAfter->json('data.summary.total_bdt'));
        $this->assertEquals(4, $modResAfter->json('data.items.0.quantity'));
        $this->assertEquals(2.80, $modResAfter->json('data.items.0.total_usd'));
        $this->assertEquals(343.70, $modResAfter->json('data.items.0.total_bdt'));

        // =========================================================================
        // Step H: Verify Admin Overview totals match My Earn totals
        // =========================================================================
        $adminRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview');
        $adminRes->assertStatus(200);
        $adminRes->assertJsonPath('success', true);

        // Find My ID 1001 in Admin overview
        $overviewRows = $adminRes->json('data');
        $row1001 = collect($overviewRows)->firstWhere('my_id_code', '1001');
        $this->assertNotNull($row1001);
        $this->assertSame('1001', $row1001['my_id_code']);
        $this->assertSame(4, $row1001['total_offers']);
        $this->assertEquals(2.80, $row1001['total_usd']);
        $this->assertEquals(343.70, $row1001['total_bdt']);

        // Check overall summary matches
        $this->assertEquals(2.80, $adminRes->json('summary.total_usd'));
        $this->assertEquals(343.70, $adminRes->json('summary.total_bdt'));
        $this->assertSame(4, $adminRes->json('summary.total_offers'));

        // =========================================================================
        // Step I: Test Admin Overview search, status filter, and month filter
        // =========================================================================
        // Search test: matching
        $searchRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview?search=1001');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data'));

        // Search test: non-matching
        $searchNonRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview?search=nonexistent_code');
        $searchNonRes->assertStatus(200);
        $this->assertCount(0, $searchNonRes->json('data'));

        // Status filter: active (1001 is active)
        $activeRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview?status=active');
        $activeRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($activeRes->json('data')));

        // Status filter: inactive (1001 is active so should not appear)
        $inactiveRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview?status=inactive');
        $inactiveRes->assertStatus(200);
        $this->assertNull(collect($inactiveRes->json('data'))->firstWhere('my_id_code', '1001'));

        // Month filter: current month
        $currMonth = Carbon::now('UTC')->format('Y-m');
        $monthRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-overview?month=' . $currMonth);
        $monthRes->assertStatus(200);
        $this->assertEquals(2.80, $monthRes->json('summary.total_usd'));
        $this->assertEquals(343.70, $monthRes->json('summary.total_bdt'));
    }
}
