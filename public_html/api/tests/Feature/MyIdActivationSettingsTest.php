<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdPayoutRule;
use App\Models\Setting;
use App\Models\User;
use App\Services\MyIdEarningService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdActivationSettingsTest extends TestCase
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
                $table->decimal('revenue', 18, 2)->default(0);
                $table->decimal('currency_reward', 18, 2)->default(0);
                $table->string('ip', 100)->nullable();
                $table->string('country')->default('unknown');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('transactions')) {
            Schema::create('transactions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
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
            });
        }
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('users');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('my_id_payout_rules');
        Schema::dropIfExists('settings');

        parent::tearDown();
    }

    private function createAdminUser(): User
    {
        return User::create([
            'name' => 'Admin User',
            'username' => 'admin_act_'.uniqid(),
            'email' => 'admin_act_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'admin',
        ]);
    }

    private function createNormalUser(): User
    {
        return User::create([
            'name' => 'Normal User',
            'username' => 'user_act_'.uniqid(),
            'email' => 'user_act_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'user',
        ]);
    }

    /**
     * Test 1: System OFF -> eligible payout count = 0
     */
    public function test_system_off_returns_zero_eligible_payout(): void
    {
        Setting::setBoolean(MyIdEarningService::SETTING_SYSTEM_ENABLED, false);

        // Task with valid matching rule
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'transaction_id' => 'tx_sys_off',
            'currency_reward' => 350,
            'created_at' => Carbon::now('UTC'),
        ]);

        $evaluation = MyIdEarningService::evaluateTaskPayout($task);

        $this->assertFalse($evaluation['eligible']);
        $this->assertSame('SYSTEM_DISABLED', $evaluation['status']);
        $this->assertNull($evaluation['payout_usd']);
        $this->assertNull($evaluation['payout_bdt']);
    }

    /**
     * Test 2: System ON, Start Date = 2026-11-01 00:00:00
     * Task: 2026-10-31 23:59:59 -> excluded
     * Task: 2026-11-01 00:00:00 -> included
     */
    public function test_start_date_boundary_filtering(): void
    {
        Setting::setBoolean(MyIdEarningService::SETTING_SYSTEM_ENABLED, true);
        Setting::setValue(MyIdEarningService::SETTING_START_DATE, '2026-11-01 00:00:00');

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        // 1. Task just before start date (2026-10-31 23:59:59 UTC)
        $preStartTask = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'transaction_id' => 'tx_pre_start',
            'currency_reward' => 350,
        ]);
        \Illuminate\Support\Facades\DB::table('completed_tasks')
            ->where('id', $preStartTask->id)
            ->update(['created_at' => Carbon::parse('2026-10-31 23:59:59', 'UTC')]);
        $preStartTask->refresh();

        $preEval = MyIdEarningService::evaluateTaskPayout($preStartTask);
        $this->assertFalse($preEval['eligible']);
        $this->assertSame('PRE_START_EXCLUDED', $preEval['status']);
        $this->assertNull($preEval['payout_usd']);

        // 2. Task exactly at start date (2026-11-01 00:00:00 UTC)
        $atStartTask = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'transaction_id' => 'tx_at_start',
            'currency_reward' => 350,
        ]);
        \Illuminate\Support\Facades\DB::table('completed_tasks')
            ->where('id', $atStartTask->id)
            ->update(['created_at' => Carbon::parse('2026-11-01 00:00:00', 'UTC')]);
        $atStartTask->refresh();

        $atEval = MyIdEarningService::evaluateTaskPayout($atStartTask);
        $this->assertTrue($atEval['eligible']);
        $this->assertSame('MAPPED', $atEval['status']);
        $this->assertSame(0.70, $atEval['payout_usd']);

        // 3. Task after start date (2026-11-02 12:00:00 UTC)
        $postStartTask = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'transaction_id' => 'tx_post_start',
            'currency_reward' => 350,
        ]);
        \Illuminate\Support\Facades\DB::table('completed_tasks')
            ->where('id', $postStartTask->id)
            ->update(['created_at' => Carbon::parse('2026-11-02 12:00:00', 'UTC')]);
        $postStartTask->refresh();

        $postEval = MyIdEarningService::evaluateTaskPayout($postStartTask);
        $this->assertTrue($postEval['eligible']);
        $this->assertSame(0.70, $postEval['payout_usd']);
    }

    /**
     * Test 3: USD/BDT rate = 122 -> $0.70 -> ৳85.40
     */
    public function test_usd_to_bdt_rate_122(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        $bdt = MyIdEarningService::convertUsdToBdt(0.70, 122.00);

        $this->assertSame(85.40, $bdt);
        $this->assertSame('85.40', number_format($bdt, 2, '.', ''));
    }

    /**
     * Test 4: Change rate to 125 -> new calculation: $0.70 -> ৳87.50
     */
    public function test_usd_to_bdt_rate_125(): void
    {
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '125.00');

        $bdt = MyIdEarningService::convertUsdToBdt(0.70, 125.00);

        $this->assertSame(87.50, $bdt);
        $this->assertSame('87.50', number_format($bdt, 2, '.', ''));
    }

    /**
     * Test 5: Admin settings API endpoints
     */
    public function test_admin_can_read_and_update_my_id_settings(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        // 1. Get settings
        $getRes = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-settings');
        $getRes->assertOk();
        $getRes->assertJsonStructure(['success', 'data' => ['my_id_system_enabled', 'my_id_start_date', 'my_id_usd_bdt_rate', 'timezone']]);

        // 2. Update settings
        $postRes = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-id-settings', [
                'my_id_system_enabled' => true,
                'my_id_start_date' => '2026-11-01 00:00:00',
                'my_id_usd_bdt_rate' => 125.00,
            ]);

        $postRes->assertOk();
        $postRes->assertJsonPath('data.my_id_system_enabled', true);
        $postRes->assertJsonPath('data.my_id_start_date', '2026-11-01 00:00:00');
        $this->assertEquals(125.0, $postRes->json('data.my_id_usd_bdt_rate'));

        $this->assertTrue(MyIdEarningService::isSystemEnabled());
        $this->assertSame('2026-11-01 00:00:00', Setting::value(MyIdEarningService::SETTING_START_DATE));
        $this->assertEquals(125.0, MyIdEarningService::getUsdBdtRate());
    }

    public function test_normal_user_blocked_from_my_id_settings_endpoint(): void
    {
        $user = $this->createNormalUser();
        $token = auth('api')->login($user);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-id-settings')
            ->assertStatus(403);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-id-settings', ['my_id_system_enabled' => true])
            ->assertStatus(403);
    }

    public function test_raw_provider_revenue_is_never_used(): void
    {
        Setting::setBoolean(MyIdEarningService::SETTING_SYSTEM_ENABLED, true);
        Setting::setValue(MyIdEarningService::SETTING_START_DATE, '2026-10-01 00:00:00');
        Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, '122.00');

        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'transaction_id' => 'tx_rev_test',
            'revenue' => 10.50, // RAW PROVIDER REVENUE - MUST REMAIN HIDDEN
            'currency_reward' => 350,
            'created_at' => Carbon::parse('2026-10-15 12:00:00', 'UTC'),
        ]);

        $evaluation = MyIdEarningService::evaluateTaskPayout($task);

        $this->assertTrue($evaluation['eligible']);
        $this->assertSame(0.70, $evaluation['payout_usd']);
        $this->assertSame(85.40, $evaluation['payout_bdt']);
        // Verify revenue is never leaked into payout
        $this->assertNotEquals((float) $task->revenue, $evaluation['payout_usd']);
        $this->assertArrayNotHasKey('revenue', $evaluation);
    }
}
