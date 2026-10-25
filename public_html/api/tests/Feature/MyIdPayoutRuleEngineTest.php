<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdPayoutRule;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdPayoutRuleEngineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

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

        parent::tearDown();
    }

    private function createAdminUser(): User
    {
        return User::create([
            'name' => 'Admin User',
            'username' => 'admin_'.uniqid(),
            'email' => 'admin_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'admin',
        ]);
    }

    private function createNormalUser(): User
    {
        return User::create([
            'name' => 'Normal User',
            'username' => 'user_'.uniqid(),
            'email' => 'user_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'user',
        ]);
    }

    private function createModeratorUser(): User
    {
        return User::create([
            'name' => 'Moderator User',
            'username' => 'mod_'.uniqid(),
            'email' => 'mod_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'moderator',
        ]);
    }

    public function test_payout_rule_table_exists_and_stores_records(): void
    {
        $rule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350.0000,
            'user_payout_usd' => 0.7000,
            'is_active' => true,
        ]);

        $this->assertDatabaseHas('my_id_payout_rules', [
            'id' => $rule->id,
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'is_active' => true,
        ]);
    }

    public function test_admin_can_create_payout_rule(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/admin/my-id-payout-rules', [
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.provider', 'Vortex');
        $response->assertJsonPath('data.offer_id', 'prime_video_101');
        $response->assertJsonPath('data.coin_amount', '350.0000');
        $response->assertJsonPath('data.user_payout_usd', '0.7000');
    }

    public function test_admin_can_edit_payout_rule(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $rule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-id-payout-rules/'.$rule->id, [
            'user_payout_usd' => 0.75,
            'offer_name' => 'Prime Video Updated',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.user_payout_usd', '0.7500');
        $response->assertJsonPath('data.offer_name', 'Prime Video Updated');

        $this->assertDatabaseHas('my_id_payout_rules', [
            'id' => $rule->id,
            'user_payout_usd' => 0.75,
            'offer_name' => 'Prime Video Updated',
        ]);
    }

    public function test_admin_can_enable_and_disable_payout_rule(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $rule = MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        // Disable rule
        $disableRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-id-payout-rules/'.$rule->id, [
            'is_active' => false,
        ]);

        $disableRes->assertOk();
        $disableRes->assertJsonPath('data.is_active', false);

        // Disabled rule should not match
        $matchDisabled = MyIdPayoutRule::resolvePayout('Vortex', 'prime_video_101', 350);
        $this->assertFalse($matchDisabled['matched']);
        $this->assertSame('UNMAPPED', $matchDisabled['status']);
        $this->assertNull($matchDisabled['payout_usd']);

        // Re-enable rule
        $enableRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-id-payout-rules/'.$rule->id, [
            'is_active' => true,
        ]);

        $enableRes->assertOk();
        $enableRes->assertJsonPath('data.is_active', true);

        // Re-enabled rule now matches
        $matchEnabled = MyIdPayoutRule::resolvePayout('Vortex', 'prime_video_101', 350);
        $this->assertTrue($matchEnabled['matched']);
        $this->assertSame('MAPPED', $matchEnabled['status']);
        $this->assertSame(0.70, $matchEnabled['payout_usd']);
    }

    public function test_exact_rule_matching_provider_offer_id_and_coins(): void
    {
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $result = MyIdPayoutRule::resolvePayout('Vortex', 'prime_video_101', 350);

        $this->assertTrue($result['matched']);
        $this->assertSame('MAPPED', $result['status']);
        $this->assertSame(0.70, $result['payout_usd']);
        $this->assertNotNull($result['rule']);
    }

    public function test_case_insensitive_provider_and_offer_matching(): void
    {
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        // lower case provider and upper case offer_id
        $result = MyIdPayoutRule::resolvePayout('vortex', 'PRIME_VIDEO_101', 350);

        $this->assertTrue($result['matched']);
        $this->assertSame(0.70, $result['payout_usd']);
    }

    public function test_wildcard_matching_when_offer_id_is_null_on_rule(): void
    {
        MyIdPayoutRule::create([
            'provider' => 'Notik',
            'offer_id' => null,
            'offer_name' => 'Any Notik Offer',
            'coin_amount' => 500,
            'user_payout_usd' => 1.00,
            'is_active' => true,
        ]);

        $result = MyIdPayoutRule::resolvePayout('Notik', 'arbitrary_offer_999', 500);

        $this->assertTrue($result['matched']);
        $this->assertSame(1.00, $result['payout_usd']);
    }

    public function test_coin_amount_must_match_for_resolution(): void
    {
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        // Wrong coin amount (e.g. 400 instead of 350)
        $result = MyIdPayoutRule::resolvePayout('Vortex', 'prime_video_101', 400);

        $this->assertFalse($result['matched']);
        $this->assertSame('UNMAPPED', $result['status']);
        $this->assertNull($result['payout_usd']);
    }

    public function test_unmapped_handling_when_no_rule_exists(): void
    {
        $result = MyIdPayoutRule::resolvePayout('NonExistentProvider', 'no_offer', 9999);

        $this->assertFalse($result['matched']);
        $this->assertSame('UNMAPPED', $result['status']);
        $this->assertNull($result['payout_usd']);
        $this->assertNull($result['rule']);
    }

    public function test_raw_provider_revenue_is_never_used_for_payout(): void
    {
        // Provider sent raw revenue of 1.50 USD and credited 350 coins
        $task = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'offer_name' => 'Prime Video',
            'transaction_id' => 'tx_test_revenue_isolation',
            'revenue' => 1.50, // RAW PROVIDER REVENUE - MUST NOT BE USED
            'currency_reward' => 350.00,
        ]);

        // Admin rule specifies $0.70 USD for 350 coins
        MyIdPayoutRule::create([
            'provider' => 'Vortex',
            'offer_id' => 'prime_video_101',
            'coin_amount' => 350,
            'user_payout_usd' => 0.70,
            'is_active' => true,
        ]);

        $result = MyIdPayoutRule::resolvePayout($task->offer_wall_name, $task->offer_id, $task->currency_reward);

        $this->assertTrue($result['matched']);
        $this->assertSame(0.70, $result['payout_usd']);
        // Verify it NEVER equals raw task revenue
        $this->assertNotEquals((float) $task->revenue, $result['payout_usd']);

        // Verify unmapped task never falls back to revenue
        $unmappedTask = CompletedTask::create([
            'offer_wall_name' => 'Vortex',
            'offer_id' => 'unmapped_offer',
            'transaction_id' => 'tx_unmapped',
            'revenue' => 2.00,
            'currency_reward' => 999,
        ]);

        $unmappedResult = MyIdPayoutRule::resolvePayout($unmappedTask->offer_wall_name, $unmappedTask->offer_id, $unmappedTask->currency_reward);
        $this->assertFalse($unmappedResult['matched']);
        $this->assertNull($unmappedResult['payout_usd']);
        $this->assertNotEquals((float) $unmappedTask->revenue, $unmappedResult['payout_usd']);
    }

    public function test_normal_user_and_moderator_blocked_from_payout_rules_endpoints(): void
    {
        $normal = $this->createNormalUser();
        $normalToken = auth('api')->login($normal);

        $mod = $this->createModeratorUser();
        $modToken = auth('api')->login($mod);

        // Normal user blocked
        $this->withHeaders(['Authorization' => 'Bearer '.$normalToken])
            ->getJson('/api/admin/my-id-payout-rules')
            ->assertStatus(403);

        $this->withHeaders(['Authorization' => 'Bearer '.$normalToken])
            ->postJson('/api/admin/my-id-payout-rules', ['provider' => 'Test'])
            ->assertStatus(403);

        // Moderator blocked
        $this->withHeaders(['Authorization' => 'Bearer '.$modToken])
            ->getJson('/api/admin/my-id-payout-rules')
            ->assertStatus(403);

        $this->withHeaders(['Authorization' => 'Bearer '.$modToken])
            ->postJson('/api/admin/my-id-payout-rules', ['provider' => 'Test'])
            ->assertStatus(403);
    }
}
