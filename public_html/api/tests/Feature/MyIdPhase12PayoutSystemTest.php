<?php

namespace Tests\Feature;

use App\Models\MyId;
use App\Models\MyIdEarning;
use App\Models\MyIdPayout;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdPhase12PayoutSystemTest extends TestCase
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
                $table->decimal('coin_amount', 12, 2)->default(0);
                $table->decimal('payout_usd', 10, 4)->default(0);
                $table->decimal('usd_bdt_rate', 10, 4)->default(0);
                $table->decimal('payout_bdt', 12, 4)->default(0);
                $table->timestamp('completed_at')->nullable()->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('my_id_payouts')) {
            Schema::create('my_id_payouts', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code', 32)->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('payout_month', 7)->index();
                $table->unsignedInteger('total_offers')->default(0);
                $table->decimal('total_usd', 12, 2)->default(0);
                $table->decimal('total_bdt', 12, 2)->default(0);
                $table->string('payment_method', 32);
                $table->json('payment_details');
                $table->string('status', 32)->default('waiting')->index();
                $table->text('admin_notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->unsignedBigInteger('completed_by')->nullable();
                $table->timestamps();

                $table->unique(['my_id_code', 'payout_month']);
            });
        }

        MyIdPayout::query()->delete();
        MyIdEarning::query()->delete();
        MyId::query()->delete();
        User::query()->delete();
        Setting::query()->delete();
    }

    private function createAdmin(): User
    {
        return User::create([
            'name' => 'Admin User',
            'username' => 'admin_payout',
            'email' => 'admin_payout@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);
    }

    private function createModerator(string $myIdCode, string $friendlyName = 'Moderator A'): User
    {
        MyId::create([
            'my_id_code' => $myIdCode,
            'label' => 'Team Alpha',
            'friendly_name' => $friendlyName,
            'is_active' => true,
        ]);

        return User::create([
            'name' => $friendlyName,
            'username' => 'mod_' . $myIdCode,
            'email' => 'mod_' . $myIdCode . '@example.com',
            'role' => 'moderator',
            'my_id' => $myIdCode,
            'password' => bcrypt('password123'),
        ]);
    }

    public function test_admin_can_toggle_global_payout_setting(): void
    {
        $admin = $this->createAdmin();

        // 1. Missing setting: default must be false (OFF)
        $getRes = $this->actingAs($admin, 'api')->getJson('/api/admin/my-id-payouts/settings');
        $getRes->assertStatus(200);
        $getRes->assertJsonPath('data.payout_enabled', false);

        // 2. Admin explicitly enables payout: turn ON
        $enableRes = $this->actingAs($admin, 'api')->patchJson('/api/admin/my-id-payouts/settings', [
            'payout_enabled' => true,
        ]);
        $enableRes->assertStatus(200);
        $enableRes->assertJsonPath('data.payout_enabled', true);
        $this->assertTrue(Setting::boolean('my_id_payout_enabled'));

        // 3. Admin explicitly disables payout: turn OFF
        $patchRes = $this->actingAs($admin, 'api')->patchJson('/api/admin/my-id-payouts/settings', [
            'payout_enabled' => false,
        ]);
        $patchRes->assertStatus(200);
        $patchRes->assertJsonPath('data.payout_enabled', false);

        // Verify stored in DB
        $this->assertFalse(Setting::boolean('my_id_payout_enabled'));
    }

    public function test_payout_setting_missing_zero_and_one_behavior(): void
    {
        $mod = $this->createModerator('1001', 'Arif');
        $month = Carbon::now('UTC')->format('Y-m');

        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'payout_usd' => 10.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 1200.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $payload = [
            'month' => $month,
            'payment_method' => 'bkash',
            'mobile_number' => '01712345678',
        ];

        // Case A: Missing setting -> OFF
        Setting::query()->where('name', 'my_id_payout_enabled')->delete();
        $this->assertNull(Setting::where('name', 'my_id_payout_enabled')->first());

        $indexRes1 = $this->actingAs($mod, 'api')->getJson("/api/moderator/payouts?month={$month}");
        $indexRes1->assertStatus(200);
        $indexRes1->assertJsonPath('data.payout_enabled', false);
        $indexRes1->assertJsonPath('data.selected_month_data.can_submit', false);

        $submitRes1 = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $submitRes1->assertStatus(422);
        $submitRes1->assertJsonPath('status', 'error');
        $this->assertStringContainsString('temporarily disabled', (string) $submitRes1->json('message'));

        // Case B: Explicit setting = 0 -> OFF
        Setting::setBoolean('my_id_payout_enabled', false);
        $indexRes2 = $this->actingAs($mod, 'api')->getJson("/api/moderator/payouts?month={$month}");
        $indexRes2->assertStatus(200);
        $indexRes2->assertJsonPath('data.payout_enabled', false);
        $indexRes2->assertJsonPath('data.selected_month_data.can_submit', false);

        $submitRes2 = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $submitRes2->assertStatus(422);
        $this->assertStringContainsString('temporarily disabled', (string) $submitRes2->json('message'));

        // Case C: Explicit setting = 1 -> ON
        Setting::setBoolean('my_id_payout_enabled', true);
        $indexRes3 = $this->actingAs($mod, 'api')->getJson("/api/moderator/payouts?month={$month}");
        $indexRes3->assertStatus(200);
        $indexRes3->assertJsonPath('data.payout_enabled', true);
        $indexRes3->assertJsonPath('data.selected_month_data.can_submit', true);

        $submitRes3 = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $submitRes3->assertStatus(201);
        $submitRes3->assertJsonPath('status', 'success');
    }

    public function test_moderator_payout_index_calculates_payable_from_snapshot_ledger(): void
    {
        Setting::setBoolean('my_id_payout_enabled', true);
        $mod = $this->createModerator('1001', 'Arif');
        $month = Carbon::now('UTC')->format('Y-m');

        // Create 2 snapshot earnings for 1001 in current month
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'offer_name' => 'Offer A',
            'coin_amount' => 100,
            'payout_usd' => 1.50,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 180.00,
            'completed_at' => Carbon::now('UTC'),
        ]);
        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 102,
            'provider' => 'Torox',
            'offer_name' => 'Offer B',
            'coin_amount' => 200,
            'payout_usd' => 2.50,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 300.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $res = $this->actingAs($mod, 'api')->getJson("/api/moderator/payouts?month={$month}");
        $res->assertStatus(200);
        $res->assertJsonPath('status', 'success');
        $res->assertJsonPath('data.my_id', '1001');
        $res->assertJsonPath('data.friendly_name', 'Arif');
        $res->assertJsonPath('data.selected_month_data.total_offers', 2);
        $this->assertEquals(4.0, (float) $res->json('data.selected_month_data.total_usd'));
        $this->assertEquals(480.0, (float) $res->json('data.selected_month_data.total_bdt'));
        $res->assertJsonPath('data.selected_month_data.payout_status', 'NOT_REQUESTED');
        $res->assertJsonPath('data.selected_month_data.can_submit', true);
    }

    public function test_moderator_can_submit_bkash_payout_request(): void
    {
        Setting::setBoolean('my_id_payout_enabled', true);
        $mod = $this->createModerator('1001', 'Arif');
        $month = Carbon::now('UTC')->format('Y-m');

        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'payout_usd' => 10.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 1200.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $payload = [
            'month' => $month,
            'payment_method' => 'bkash',
            'mobile_number' => '01712345678',
        ];

        $res = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $res->assertStatus(201);
        $res->assertJsonPath('status', 'success');
        $res->assertJsonPath('data.status', 'waiting');
        $this->assertEquals(1200.0, (float) $res->json('data.total_bdt'));
        $res->assertJsonPath('data.payment_method', 'bkash');
        $res->assertJsonPath('data.payment_details.mobile_number', '01712345678');

        $this->assertDatabaseHas('my_id_payouts', [
            'my_id_code' => '1001',
            'payout_month' => $month,
            'status' => 'waiting',
            'payment_method' => 'bkash',
        ]);
    }

    public function test_moderator_can_submit_nagad_payout_request(): void
    {
        Setting::setBoolean('my_id_payout_enabled', true);
        $mod = $this->createModerator('1002', 'Tanvir');
        $month = Carbon::now('UTC')->format('Y-m');

        MyIdEarning::create([
            'my_id_code' => '1002',
            'user_id' => $mod->id,
            'completed_task_id' => 201,
            'provider' => 'Torox',
            'payout_usd' => 5.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 600.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $payload = [
            'month' => $month,
            'payment_method' => 'nagad',
            'mobile_number' => '01812345678',
        ];

        $res = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $res->assertStatus(201);
        $res->assertJsonPath('data.payment_method', 'nagad');
        $res->assertJsonPath('data.payment_details.mobile_number', '01812345678');
    }

    public function test_moderator_can_submit_bank_payout_request(): void
    {
        Setting::setBoolean('my_id_payout_enabled', true);
        $mod = $this->createModerator('1003', 'Kamal');
        $month = Carbon::now('UTC')->format('Y-m');

        MyIdEarning::create([
            'my_id_code' => '1003',
            'user_id' => $mod->id,
            'completed_task_id' => 301,
            'provider' => 'RevU',
            'payout_usd' => 25.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 3000.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $payload = [
            'month' => $month,
            'payment_method' => 'bank',
            'account_holder_name' => 'Kamal Hossain',
            'account_number' => '1234567890123',
            'bank_name' => 'Islami Bank Bangladesh Ltd',
            'branch_name' => 'Dhanmondi Branch',
        ];

        $res = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', $payload);
        $res->assertStatus(201);
        $res->assertJsonPath('data.payment_method', 'bank');
        $res->assertJsonPath('data.payment_details.bank_name', 'Islami Bank Bangladesh Ltd');
        $res->assertJsonPath('data.payment_details.account_number', '1234567890123');
    }

    public function test_duplicate_month_payment_blocked(): void
    {
        Setting::setBoolean('my_id_payout_enabled', true);
        $mod = $this->createModerator('1001', 'Arif');
        $month = '2026-10';

        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'payout_usd' => 10.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 1200.00,
            'completed_at' => Carbon::parse('2026-10-15 12:00:00'),
        ]);

        // First request succeeds
        $firstRes = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', [
            'month' => $month,
            'payment_method' => 'bkash',
            'mobile_number' => '01712345678',
        ]);
        $firstRes->assertStatus(201);

        // Second request for the same month must fail
        $secondRes = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', [
            'month' => $month,
            'payment_method' => 'bkash',
            'mobile_number' => '01712345678',
        ]);
        $secondRes->assertStatus(422);
        $secondRes->assertJsonPath('status', 'error');
        $this->assertStringContainsString('cannot be requested twice', (string) $secondRes->json('message'));
    }

    public function test_payout_blocked_when_global_setting_disabled(): void
    {
        $mod = $this->createModerator('1001', 'Arif');
        $month = Carbon::now('UTC')->format('Y-m');

        Setting::setBoolean('my_id_payout_enabled', false);

        MyIdEarning::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'completed_task_id' => 101,
            'provider' => 'Vortex',
            'payout_usd' => 10.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 1200.00,
            'completed_at' => Carbon::now('UTC'),
        ]);

        $res = $this->actingAs($mod, 'api')->postJson('/api/moderator/payouts', [
            'month' => $month,
            'payment_method' => 'bkash',
            'mobile_number' => '01712345678',
        ]);

        $res->assertStatus(422);
        $res->assertJsonPath('status', 'error');
        $this->assertStringContainsString('temporarily disabled', (string) $res->json('message'));
    }

    public function test_admin_can_manage_payout_status_progression(): void
    {
        $admin = $this->createAdmin();
        $mod = $this->createModerator('1001', 'Arif');

        $payout = MyIdPayout::create([
            'my_id_code' => '1001',
            'user_id' => $mod->id,
            'payout_month' => '2026-09',
            'total_offers' => 5,
            'total_usd' => 50.00,
            'total_bdt' => 6000.00,
            'payment_method' => 'bkash',
            'payment_details' => ['mobile_number' => '01711112222'],
            'status' => 'waiting',
        ]);

        // Progression 1: REVIEW
        $revRes = $this->actingAs($admin, 'api')->patchJson("/api/admin/my-id-payouts/{$payout->id}/status", [
            'status' => 'review',
            'admin_notes' => 'Under review by accountant',
        ]);
        $revRes->assertStatus(200);
        $this->assertEquals('review', $payout->fresh()->status);
        $this->assertEquals('Under review by accountant', $payout->fresh()->admin_notes);

        // Progression 2: ACCEPTED
        $accRes = $this->actingAs($admin, 'api')->patchJson("/api/admin/my-id-payouts/{$payout->id}/status", [
            'status' => 'accepted',
        ]);
        $accRes->assertStatus(200);
        $this->assertEquals('accepted', $payout->fresh()->status);

        // Progression 3: COMPLETED
        $compRes = $this->actingAs($admin, 'api')->patchJson("/api/admin/my-id-payouts/{$payout->id}/status", [
            'status' => 'completed',
            'admin_notes' => 'Paid via bKash TrxID #89283492',
        ]);
        $compRes->assertStatus(200);
        $fresh = $payout->fresh();
        $this->assertEquals('completed', $fresh->status);
        $this->assertNotNull($fresh->completed_at);
        $this->assertEquals($admin->id, $fresh->completed_by);
        $this->assertEquals('Paid via bKash TrxID #89283492', $fresh->admin_notes);
    }

    public function test_moderator_cannot_view_another_moderators_payouts(): void
    {
        $mod1 = $this->createModerator('1001', 'Arif');
        $mod2 = $this->createModerator('1002', 'Tanvir');

        // Payout for 1001
        MyIdPayout::create([
            'my_id_code' => '1001',
            'user_id' => $mod1->id,
            'payout_month' => '2026-08',
            'total_offers' => 10,
            'total_usd' => 100.00,
            'total_bdt' => 12000.00,
            'payment_method' => 'bkash',
            'payment_details' => ['mobile_number' => '01711112222'],
            'status' => 'completed',
        ]);

        // Payout for 1002
        MyIdPayout::create([
            'my_id_code' => '1002',
            'user_id' => $mod2->id,
            'payout_month' => '2026-08',
            'total_offers' => 4,
            'total_usd' => 40.00,
            'total_bdt' => 4800.00,
            'payment_method' => 'nagad',
            'payment_details' => ['mobile_number' => '01811112222'],
            'status' => 'waiting',
        ]);

        // Mod 1 checks history
        $res1 = $this->actingAs($mod1, 'api')->getJson('/api/moderator/payouts');
        $res1->assertStatus(200);
        $history1 = $res1->json('data.history');
        $this->assertCount(1, $history1);
        $this->assertEquals(12000.0, $history1[0]['bdt']);

        // Mod 2 checks history
        $res2 = $this->actingAs($mod2, 'api')->getJson('/api/moderator/payouts');
        $res2->assertStatus(200);
        $history2 = $res2->json('data.history');
        $this->assertCount(1, $history2);
        $this->assertEquals(4800.0, $history2[0]['bdt']);
    }

    public function test_normal_user_cannot_access_payout_endpoints(): void
    {
        $user = User::create([
            'name' => 'Regular User',
            'username' => 'reg_user',
            'email' => 'user@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
        ]);

        $modRes = $this->actingAs($user, 'api')->getJson('/api/moderator/payouts');
        $this->assertTrue(in_array($modRes->status(), [401, 403], true));

        $adminRes = $this->actingAs($user, 'api')->getJson('/api/admin/my-id-payouts');
        $this->assertTrue(in_array($adminRes->status(), [401, 403], true));
    }
}
