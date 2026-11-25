<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\MyId;
use App\Models\MyIdEarning;
use App\Models\MyIdPayout;
use App\Models\MyIdPayoutRule;
use App\Models\User;
use App\Services\PayoutRuleSyncService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PayoutRuleSyncTest extends TestCase
{
    private User $admin;
    private User $worker;
    private string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('my_id_payouts');
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('my_id_payout_rules');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('users');

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

        Schema::create('my_ids', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->unique();
            $table->string('label')->nullable();
            $table->string('friendly_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('completed_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_wall_name');
            $table->unsignedBigInteger('user_id')->default(0);
            $table->string('user_name')->nullable();
            $table->string('transaction_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->string('offer_id')->nullable();
            $table->decimal('revenue', 12, 2)->default(0);
            $table->decimal('currency_reward', 12, 2)->default(0);
            $table->string('ip', 45)->nullable();
            $table->string('country', 100)->nullable();
            $table->timestamps();
        });

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

        Schema::create('my_id_earnings', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('completed_task_id')->unique();
            $table->string('provider');
            $table->string('offer_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->decimal('coin_amount', 14, 4)->default(0);
            $table->decimal('payout_usd', 14, 4)->default(0);
            $table->decimal('usd_bdt_rate', 10, 2)->default(0);
            $table->decimal('payout_bdt', 14, 4)->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('my_id_payouts', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->index();
            $table->string('payout_month', 7)->index();
            $table->unsignedInteger('total_offers')->default(0);
            $table->decimal('total_usd', 14, 4)->default(0);
            $table->decimal('total_bdt', 14, 4)->default(0);
            $table->string('payment_method')->default('bkash');
            $table->text('payment_details')->nullable();
            $table->string('status')->default('waiting');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        DB::table('settings')->insert([
            ['name' => 'my_id_system_enabled', 'value' => '1', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'my_id_usd_bdt_rate', 'value' => '122.00', 'created_at' => now(), 'updated_at' => now()],
        ]);

        MyId::create([
            'my_id_code' => '1010',
            'label' => 'Zahidul Team',
            'friendly_name' => 'Zahidul',
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_sync',
            'email' => 'admin_sync@wincashz.com',
            'role' => 'admin',
            'password' => 'Secret123!',
            'profile_setup_completed' => true,
        ]);

        $this->worker = User::create([
            'name' => 'Zahidul Operator',
            'username' => 'Zahidul_01_01n',
            'email' => 'zahidul_sync@wincashz.com',
            'role' => 'user',
            'my_id' => '1010',
            'password' => 'Secret123!',
            'profile_setup_completed' => true,
        ]);

        $this->adminToken = auth('api')->login($this->admin);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('my_id_payouts');
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('my_id_payout_rules');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('my_ids');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    public function test_updating_mistaken_high_rule_instantly_recalculates_completed_offers_and_payouts(): void
    {
        $rule = MyIdPayoutRule::create([
            'provider' => 'notik',
            'offer_id' => 'OFFER-99',
            'offer_name' => 'Test Survey',
            'coin_amount' => 150,
            'user_payout_usd' => 15.00, // Mistakenly entered $15.00 instead of $0.15
            'usd_bdt_rate' => 122.00,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'notik',
            'user_id' => $this->worker->id,
            'user_name' => $this->worker->username,
            'transaction_id' => 'TX-1001',
            'offer_name' => 'Test Survey',
            'offer_id' => 'OFFER-99',
            'revenue' => 0.30,
            'currency_reward' => 150,
        ]);

        $month = Carbon::now('UTC')->format('Y-m');

        $earning = MyIdEarning::create([
            'my_id_code' => '1010',
            'user_id' => $this->worker->id,
            'completed_task_id' => $task->id,
            'provider' => 'notik',
            'offer_id' => 'OFFER-99',
            'offer_name' => 'Test Survey',
            'coin_amount' => 150,
            'payout_usd' => 15.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 1830.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $payout = MyIdPayout::create([
            'my_id_code' => '1010',
            'payout_month' => $month,
            'total_offers' => 1,
            'total_usd' => 15.00,
            'total_bdt' => 1830.00,
            'payment_method' => 'bkash',
            'status' => 'waiting',
        ]);

        // Fix the mistaken rule from $15.00 down to $0.15
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->patchJson("/api/admin/my-id-payout-rules/{$rule->id}", [
                'user_payout_usd' => 0.15,
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('sync_summary.updated_tasks_count', 1);

        $earning->refresh();
        $payout->refresh();
        $task->refresh();

        $this->assertEquals(0.15, (float) $earning->payout_usd);
        $this->assertEquals(round(0.15 * 122.00, 2), (float) $earning->payout_bdt);
        $this->assertEquals(0.15, (float) $payout->total_usd);
        $this->assertEquals(round(0.15 * 122.00, 2), (float) $payout->total_bdt);
        // Raw network revenue on completed_tasks must remain untouched
        $this->assertEquals(0.30, (float) $task->revenue);
    }

    public function test_raising_rule_instantly_raises_completed_offer_payouts(): void
    {
        $rule = MyIdPayoutRule::create([
            'provider' => 'torox',
            'offer_id' => null,
            'coin_amount' => 200,
            'user_payout_usd' => 0.20,
            'usd_bdt_rate' => 120.00,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'torox',
            'user_id' => $this->worker->id,
            'user_name' => $this->worker->username,
            'transaction_id' => 'TX-1002',
            'offer_name' => 'Game Quest',
            'offer_id' => 'GAME-200',
            'revenue' => 0.50,
            'currency_reward' => 200,
        ]);

        $earning = MyIdEarning::create([
            'my_id_code' => '1010',
            'user_id' => $this->worker->id,
            'completed_task_id' => $task->id,
            'provider' => 'torox',
            'offer_id' => 'GAME-200',
            'offer_name' => 'Game Quest',
            'coin_amount' => 200,
            'payout_usd' => 0.20,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 24.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->patchJson("/api/admin/my-id-payout-rules/{$rule->id}", [
                'user_payout_usd' => 0.45,
            ]);

        $response->assertOk()
            ->assertJsonPath('sync_summary.updated_tasks_count', 1);

        $earning->refresh();
        $this->assertEquals(0.45, (float) $earning->payout_usd);
        $this->assertEquals(54.00, (float) $earning->payout_bdt);
    }

    public function test_setting_rule_to_zero_and_toggling_or_deleting_drops_totals_to_zero(): void
    {
        $rule = MyIdPayoutRule::create([
            'provider' => 'notik',
            'offer_id' => 'OFFER-ZERO',
            'coin_amount' => 100,
            'user_payout_usd' => 1.00,
            'usd_bdt_rate' => 122.00,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'notik',
            'user_id' => $this->worker->id,
            'user_name' => $this->worker->username,
            'transaction_id' => 'TX-1003',
            'offer_name' => 'Zero Test',
            'offer_id' => 'OFFER-ZERO',
            'revenue' => 2.00,
            'currency_reward' => 100,
        ]);

        $earning = MyIdEarning::create([
            'my_id_code' => '1010',
            'user_id' => $this->worker->id,
            'completed_task_id' => $task->id,
            'provider' => 'notik',
            'offer_id' => 'OFFER-ZERO',
            'offer_name' => 'Zero Test',
            'coin_amount' => 100,
            'payout_usd' => 1.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 122.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        // Set rule to strictly 0
        $resZero = $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->patchJson("/api/admin/my-id-payout-rules/{$rule->id}", [
                'user_payout_usd' => 0,
            ]);

        $resZero->assertOk()
            ->assertJsonPath('sync_summary.updated_tasks_count', 1);

        $earning->refresh();
        $this->assertEquals(0.0, (float) $earning->payout_usd);
        $this->assertEquals(0.0, (float) $earning->payout_bdt);

        // Restore to 0.50, then delete rule -> should drop back to 0.0
        $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->patchJson("/api/admin/my-id-payout-rules/{$rule->id}", [
                'user_payout_usd' => 0.50,
            ])->assertOk();

        $earning->refresh();
        $this->assertEquals(0.50, (float) $earning->payout_usd);

        $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->deleteJson("/api/admin/my-id-payout-rules/{$rule->id}")
            ->assertOk()
            ->assertJsonPath('sync_summary.updated_tasks_count', 1);

        $earning->refresh();
        $this->assertEquals(0.0, (float) $earning->payout_usd);
        $this->assertEquals(0.0, (float) $earning->payout_bdt);
    }

    public function test_sync_all_is_idempotent_and_artisan_command_succeeds(): void
    {
        MyIdPayoutRule::create([
            'provider' => 'notik',
            'offer_id' => 'OFFER-IDEM',
            'coin_amount' => 300,
            'user_payout_usd' => 0.30,
            'usd_bdt_rate' => 122.00,
            'is_active' => true,
        ]);

        $task = CompletedTask::create([
            'offer_wall_name' => 'notik',
            'user_id' => $this->worker->id,
            'user_name' => $this->worker->username,
            'transaction_id' => 'TX-1004',
            'offer_name' => 'Idempotency Offer',
            'offer_id' => 'OFFER-IDEM',
            'revenue' => 0.60,
            'currency_reward' => 300,
        ]);

        MyIdEarning::create([
            'my_id_code' => '1010',
            'user_id' => $this->worker->id,
            'completed_task_id' => $task->id,
            'provider' => 'notik',
            'offer_id' => 'OFFER-IDEM',
            'offer_name' => 'Idempotency Offer',
            'coin_amount' => 300,
            'payout_usd' => 30.00, // Wrong value
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 3660.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $first = PayoutRuleSyncService::syncAllCompletedOffers();
        $second = PayoutRuleSyncService::syncAllCompletedOffers();

        $this->assertEquals(1, $first['updated_tasks_count']);
        $this->assertEquals(0.30, $first['total_payout_after']);

        $this->assertEquals(0, $second['updated_tasks_count']);
        $this->assertEquals(0.30, $second['total_payout_before']);
        $this->assertEquals(0.30, $second['total_payout_after']);

        // Manual admin endpoint
        $this->withHeader('Authorization', 'Bearer ' . $this->adminToken)
            ->postJson('/api/admin/payout-rules/sync-all')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('sync_summary.total_payout_after', 0.3);

        // Artisan command
        $this->artisan('payouts:sync-rules')->assertExitCode(0);
    }
}
