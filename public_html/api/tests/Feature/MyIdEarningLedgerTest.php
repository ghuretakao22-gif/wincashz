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

class MyIdEarningLedgerTest extends TestCase
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

    public function test_earning_table_schema_structure(): void
    {
        $this->assertTrue(Schema::hasTable('my_id_earnings'));
        $this->assertTrue(Schema::hasColumns('my_id_earnings', [
            'id',
            'my_id_code',
            'user_id',
            'completed_task_id',
            'provider',
            'offer_id',
            'offer_name',
            'coin_amount',
            'payout_usd',
            'usd_bdt_rate',
            'payout_bdt',
            'completed_at',
            'created_at',
            'updated_at',
        ]));
    }

    public function test_snapshot_usd_and_bdt_rate_and_total_calculation(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        $myId = MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User',
            'username' => 'worker_1',
            'email' => 'worker1@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_snap_001',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 15.00, // Provider raw revenue - must NOT be used
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertTrue($result['created']);
        $this->assertSame('RECORDED', $result['status']);
        $this->assertEquals(0.70, $result['payout_usd']);
        $this->assertEquals(122.00, $result['usd_bdt_rate']);
        $this->assertEquals(85.40, $result['payout_bdt']);

        $earning = MyIdEarning::where('completed_task_id', $task->id)->first();
        $this->assertNotNull($earning);
        $this->assertSame('1001', $earning->my_id_code);
        $this->assertEquals($user->id, $earning->user_id);
        $this->assertEquals($task->id, $earning->completed_task_id);
        $this->assertSame('Vortex', $earning->provider);
        $this->assertEquals(350.0, (float) $earning->coin_amount);
        $this->assertEquals(0.70, (float) $earning->payout_usd);
        $this->assertEquals(122.00, (float) $earning->usd_bdt_rate);
        $this->assertEquals(85.40, (float) $earning->payout_bdt);
    }

    public function test_old_earning_immutable_after_rate_and_rule_changes(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 2',
            'username' => 'worker_2',
            'email' => 'worker2@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        $rule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $task1 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_old_001',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
            'revenue' => 12.00,
        ]);

        $result1 = MyIdEarningService::recordTaskEarning($task1);
        $this->assertTrue($result1['created']);
        $this->assertEquals(85.40, $result1['payout_bdt']);

        // Now Admin changes global rate to 125.00 and edits the rule to 0.90 USD
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '125.00');
        $rule->update(['user_payout_usd' => 0.90]);

        // Historical earning row must remain 100% unchanged
        $earning1 = MyIdEarning::where('completed_task_id', $task1->id)->first();
        $this->assertEquals(0.70, (float) $earning1->payout_usd);
        $this->assertEquals(122.00, (float) $earning1->usd_bdt_rate);
        $this->assertEquals(85.40, (float) $earning1->payout_bdt);
    }

    public function test_new_earning_uses_new_rate(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 3',
            'username' => 'worker_3',
            'email' => 'worker3@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.00,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        // Task 1 recorded under 122.00 rate -> 85.40 BDT
        $task1 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_rate_001',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
        ]);
        $res1 = MyIdEarningService::recordTaskEarning($task1);
        $this->assertEquals(85.40, $res1['payout_bdt']);

        // Admin updates rate to 125.00
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '125.00');

        // Task 2 recorded under new rate 125.00 -> 0.70 * 125 = 87.50 BDT
        $task2 = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_rate_002',
            'offer_id' => 'prime-1',
            'offer_name' => 'Prime Video',
            'currency_reward' => 350.00,
        ]);
        $res2 = MyIdEarningService::recordTaskEarning($task2);
        $this->assertTrue($res2['created']);
        $this->assertEquals(0.70, $res2['payout_usd']);
        $this->assertEquals(125.00, $res2['usd_bdt_rate']);
        $this->assertEquals(87.50, $res2['payout_bdt']);

        $earning2 = MyIdEarning::where('completed_task_id', $task2->id)->first();
        $this->assertEquals(87.50, (float) $earning2->payout_bdt);
        $this->assertEquals(125.00, (float) $earning2->usd_bdt_rate);
    }

    public function test_duplicate_task_protection_prevents_multiple_records(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 4',
            'username' => 'worker_4',
            'email' => 'worker4@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'AdGate',
            'offer_id' => 'survey-9',
            'offer_name' => 'Quick Survey',
            'coin_amount' => 100.00,
            'user_payout_usd' => 0.25,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'AdGate',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_dup_001',
            'offer_id' => 'survey-9',
            'offer_name' => 'Quick Survey',
            'currency_reward' => 100.00,
        ]);

        // First recording: success
        $firstResult = MyIdEarningService::recordTaskEarning($task);
        $this->assertTrue($firstResult['created']);
        $this->assertSame('RECORDED', $firstResult['status']);

        // Second recording: rejected as duplicate
        $secondResult = MyIdEarningService::recordTaskEarning($task);
        $this->assertFalse($secondResult['created']);
        $this->assertSame('ALREADY_RECORDED', $secondResult['status']);

        // Confirm exactly 1 record in table
        $count = MyIdEarning::where('completed_task_id', $task->id)->count();
        $this->assertSame(1, $count);
    }

    public function test_unmapped_payout_rule_handling_creates_no_earning(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 5',
            'username' => 'worker_5',
            'email' => 'worker5@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        // Task with coins = 999 where NO payout rule exists
        $task = CompletedTask::create([
            'offer_wall_name' => 'UnknownProvider',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_unmapped_001',
            'offer_id' => 'unknown-offer',
            'offer_name' => 'Unknown Offer',
            'currency_reward' => 999.00,
            'revenue' => 50.00,
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertFalse($result['created']);
        $this->assertSame('UNMAPPED', $result['status']);
        $this->assertNull($result['payout_usd']);
        $this->assertNull($result['payout_bdt']);
        $this->assertNull($result['earning']);

        // Ensure zero records created in DB
        $this->assertSame(0, MyIdEarning::count());
    }

    public function test_raw_provider_revenue_is_never_used(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '120.00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 6',
            'username' => 'worker_6',
            'email' => 'worker6@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'vortex-fixed',
            'offer_name' => 'Fixed Offer',
            'coin_amount' => 500.00,
            'user_payout_usd' => 1.00, // Rule user payout is 1.00 USD
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_rev_001',
            'offer_id' => 'vortex-fixed',
            'offer_name' => 'Fixed Offer',
            'currency_reward' => 500.00,
            'revenue' => 88.88, // Huge provider revenue - must remain completely hidden/ignored
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertTrue($result['created']);
        $this->assertEquals(1.00, $result['payout_usd']);
        $this->assertEquals(120.00, $result['payout_bdt']); // 1.00 * 120.00

        // Explicitly assert that 88.88 revenue was NEVER used
        $this->assertNotEquals(88.88, $result['payout_usd']);
        $this->assertNotEquals(round(88.88 * 120, 2), $result['payout_bdt']);

        $earning = MyIdEarning::where('completed_task_id', $task->id)->first();
        $this->assertEquals(1.00, (float) $earning->payout_usd);
        $this->assertEquals(120.00, (float) $earning->payout_bdt);
    }

    public function test_system_disabled_prevents_earning_creation(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '0'); // OFF

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 7',
            'username' => 'worker_7',
            'email' => 'worker7@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'v-1',
            'coin_amount' => 100.00,
            'user_payout_usd' => 0.50,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_sys_off',
            'offer_id' => 'v-1',
            'currency_reward' => 100.00,
        ]);

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertFalse($result['created']);
        $this->assertSame('SYSTEM_DISABLED', $result['status']);
        $this->assertSame(0, MyIdEarning::count());
    }

    public function test_tasks_before_start_date_are_excluded(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');
        Setting::setValue(MyIdEarningService::SETTING_START_DATE, '2026-10-25 00:00:00');

        MyId::create(['my_id_code' => '1001', 'is_active' => true]);
        $user = User::create([
            'name' => 'Worker User 8',
            'username' => 'worker_8',
            'email' => 'worker8@example.com',
            'password' => 'secret123',
            'my_id' => '1001',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'v-2',
            'coin_amount' => 100.00,
            'user_payout_usd' => 0.50,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'tx_hist_001',
            'offer_id' => 'v-2',
            'currency_reward' => 100.00,
        ]);

        // Historical task created before start date
        DB::table('completed_tasks')->where('id', $task->id)->update([
            'created_at' => Carbon::parse('2026-10-24 23:59:59', 'UTC'),
        ]);
        $task->refresh();

        $result = MyIdEarningService::recordTaskEarning($task);

        $this->assertFalse($result['created']);
        $this->assertSame('PRE_START_EXCLUDED', $result['status']);
        $this->assertSame(0, MyIdEarning::count());
    }

    public function test_user_without_my_id_or_inactive_my_id_is_not_recorded(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_SYSTEM_ENABLED, '1');

        $inactiveMyId = MyId::create(['my_id_code' => '9999', 'is_active' => false]);

        $userWithoutMyId = User::create([
            'name' => 'No MyId User',
            'username' => 'no_my_id',
            'email' => 'nomyid@example.com',
            'password' => 'secret123',
            'my_id' => null,
        ]);

        $userWithInactiveMyId = User::create([
            'name' => 'Inactive MyId User',
            'username' => 'inactive_my_id',
            'email' => 'inactive@example.com',
            'password' => 'secret123',
            'my_id' => '9999',
        ]);

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'v-3',
            'coin_amount' => 100.00,
            'user_payout_usd' => 0.50,
            'is_active' => true,
        ]);

        $taskNoMyId = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userWithoutMyId->id,
            'user_name' => $userWithoutMyId->username,
            'transaction_id' => 'tx_nomyid',
            'offer_id' => 'v-3',
            'currency_reward' => 100.00,
        ]);

        $res1 = MyIdEarningService::recordTaskEarning($taskNoMyId);
        $this->assertFalse($res1['created']);
        $this->assertSame('NO_MY_ID', $res1['status']);

        $taskInactive = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'user_id' => $userWithInactiveMyId->id,
            'user_name' => $userWithInactiveMyId->username,
            'transaction_id' => 'tx_inactive',
            'offer_id' => 'v-3',
            'currency_reward' => 100.00,
        ]);

        $res2 = MyIdEarningService::recordTaskEarning($taskInactive);
        $this->assertFalse($res2['created']);
        $this->assertSame('INACTIVE_MY_ID', $res2['status']);

        $this->assertSame(0, MyIdEarning::count());
    }
}
