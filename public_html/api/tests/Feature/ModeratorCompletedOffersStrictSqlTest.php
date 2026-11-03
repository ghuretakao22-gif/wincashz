<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeratorCompletedOffersStrictSqlTest extends TestCase
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
            $table->decimal('balance', 12, 2)->default(0);
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

    protected function createModerator(string $myIdCode = 'TEAM_STRICT'): User
    {
        $id = DB::table('users')->insertGetId([
            'name' => 'Strict Moderator',
            'username' => 'mod_strict',
            'email' => 'mod_strict@example.com',
            'role' => 'moderator',
            'my_id' => $myIdCode,
            'password' => Hash::make('password123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('my_ids')->insert([
            'my_id_code' => $myIdCode,
            'friendly_name' => 'Strict Team',
            'is_active' => true,
            'assigned_user_id' => $id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::findOrFail($id);
    }

    public function test_completed_offers_returns_200_with_summary_and_pagination_keys(): void
    {
        $mod = $this->createModerator('TEAM_STRICT');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_1',
            'email' => 'worker_1@example.com',
            'password' => 'secret',
            'my_id' => 'TEAM_STRICT',
        ]);

        // Seed 3 earnings for TEAM_STRICT
        for ($i = 1; $i <= 3; $i++) {
            DB::table('my_id_earnings')->insert([
                'user_id' => $worker->id,
                'username' => $worker->username,
                'my_id_code' => 'TEAM_STRICT',
                'provider' => 'Torox',
                'offer_id' => 'offer_' . $i,
                'offer_name' => 'Offer ' . $i,
                'coin_amount' => 500,
                'payout_usd' => 1.50,
                'usd_bdt_rate' => 120.00,
                'payout_bdt' => 180.00,
                'completed_at' => now()->toDateTimeString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // GET /api/moderator/completed-offers?period=all
        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all');

        $res->assertOk()
            ->assertJsonPath('status', 'success');

        // Assert pagination keys
        $res->assertJsonStructure([
            'data' => [
                'data',
                'pagination' => ['currentPage', 'lastPage', 'perPage', 'total', 'from', 'to'],
                'summary' => ['total_offers', 'total_usd', 'total_bdt', 'total_records', 'sum_usd', 'sum_bdt'],
            ],
            'pagination' => ['currentPage', 'lastPage', 'perPage', 'total', 'from', 'to'],
            'summary' => ['total_offers', 'total_usd', 'total_bdt', 'total_records', 'sum_usd', 'sum_bdt'],
        ]);

        $this->assertCount(3, $res->json('data.data'));
        $this->assertEquals(3, $res->json('data.pagination.total'));
        $this->assertEquals(3, $res->json('data.summary.total_offers'));
        $this->assertEquals(4.50, (float) $res->json('data.summary.total_usd'));
        $this->assertEquals(540.00, (float) $res->json('data.summary.total_bdt'));
    }

    public function test_date_filter_boundary_utc(): void
    {
        $mod = $this->createModerator('TEAM_STRICT');

        $worker = User::create([
            'name' => 'Worker User',
            'username' => 'worker_boundary',
            'email' => 'worker_boundary@example.com',
            'password' => 'secret',
            'my_id' => 'TEAM_STRICT',
        ]);

        // Row 1: 2026-10-31 23:59:59 UTC
        DB::table('my_id_earnings')->insert([
            'user_id' => $worker->id,
            'username' => $worker->username,
            'my_id_code' => 'TEAM_STRICT',
            'provider' => 'BitLabs',
            'offer_id' => 'oct_31_offer',
            'offer_name' => 'Oct 31 Offer',
            'coin_amount' => 100,
            'payout_usd' => 1.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 120.00,
            'completed_at' => '2026-10-31 23:59:59',
            'created_at' => '2026-10-31 23:59:59',
            'updated_at' => '2026-10-31 23:59:59',
        ]);

        // Row 2: 2026-11-01 00:00:00 UTC
        DB::table('my_id_earnings')->insert([
            'user_id' => $worker->id,
            'username' => $worker->username,
            'my_id_code' => 'TEAM_STRICT',
            'provider' => 'CPALead',
            'offer_id' => 'nov_01_offer',
            'offer_name' => 'Nov 01 Offer',
            'coin_amount' => 200,
            'payout_usd' => 2.00,
            'usd_bdt_rate' => 120.00,
            'payout_bdt' => 240.00,
            'completed_at' => '2026-11-01 00:00:00',
            'created_at' => '2026-11-01 00:00:00',
            'updated_at' => '2026-11-01 00:00:00',
        ]);

        // 1. date=2026-10-31 returns ONLY the first row
        $resOct31 = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?date=2026-10-31');
        $resOct31->assertOk();
        $this->assertCount(1, $resOct31->json('data.data'));
        $this->assertEquals('Oct 31 Offer', $resOct31->json('data.data.0.offer_name'));

        // 2. date=2026-11-01 returns ONLY the second row
        $resNov01 = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?date=2026-11-01');
        $resNov01->assertOk();
        $this->assertCount(1, $resNov01->json('data.data'));
        $this->assertEquals('Nov 01 Offer', $resNov01->json('data.data.0.offer_name'));

        // 3. month=2026-10 returns ONLY October rows
        $resMonthOct = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?month=2026-10');
        $resMonthOct->assertOk();
        $this->assertCount(1, $resMonthOct->json('data.data'));
        $this->assertEquals('Oct 31 Offer', $resMonthOct->json('data.data.0.offer_name'));

        // 4. period=all returns BOTH rows
        $resAll = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all');
        $resAll->assertOk();
        $this->assertCount(2, $resAll->json('data.data'));

        // 5. period=this_month with test now set to November 2026
        Carbon::setTestNow('2026-11-03 12:00:00');
        try {
            $resThisMonth = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=this_month');
            $resThisMonth->assertOk();
            $this->assertCount(1, $resThisMonth->json('data.data'));
            $this->assertEquals('Nov 01 Offer', $resThisMonth->json('data.data.0.offer_name'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_empty_result_shape(): void
    {
        $mod = $this->createModerator('TEAM_EMPTY');

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/completed-offers?period=all');

        $res->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertEmpty($res->json('data.data'));
        $this->assertEquals(0, $res->json('data.pagination.total'));
        $this->assertEquals(0, $res->json('data.summary.total_offers'));
        $this->assertEquals(0.0, (float) $res->json('data.summary.total_usd'));
        $this->assertEquals(0.0, (float) $res->json('data.summary.total_bdt'));
    }

    public function test_users_date_filter(): void
    {
        $mod = $this->createModerator('TEAM_STRICT');

        // Create 2 users under TEAM_STRICT with different created_at
        DB::table('users')->insert([
            'name' => 'User Day One',
            'username' => 'user_day1',
            'email' => 'day1@example.com',
            'password' => 'secret',
            'my_id' => 'TEAM_STRICT',
            'created_at' => '2026-10-15 09:30:00',
            'updated_at' => '2026-10-15 09:30:00',
        ]);

        DB::table('users')->insert([
            'name' => 'User Day Two',
            'username' => 'user_day2',
            'email' => 'day2@example.com',
            'password' => 'secret',
            'my_id' => 'TEAM_STRICT',
            'created_at' => '2026-10-16 14:00:00',
            'updated_at' => '2026-10-16 14:00:00',
        ]);

        // Another user under different team
        DB::table('users')->insert([
            'name' => 'Other Team User',
            'username' => 'other_user',
            'email' => 'other@example.com',
            'password' => 'secret',
            'my_id' => 'OTHER_TEAM',
            'created_at' => '2026-10-15 09:30:00',
            'updated_at' => '2026-10-15 09:30:00',
        ]);

        // GET /api/moderator/users?date=2026-10-15
        $resDay1 = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?date=2026-10-15');
        $resDay1->assertOk();
        $usernamesDay1 = collect($resDay1->json('data'))->pluck('username')->all();
        $this->assertContains('user_day1', $usernamesDay1);
        $this->assertNotContains('user_day2', $usernamesDay1);
        $this->assertNotContains('other_user', $usernamesDay1);

        // GET /api/moderator/users?date=2026-10-16
        $resDay2 = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?date=2026-10-16');
        $resDay2->assertOk();
        $usernamesDay2 = collect($resDay2->json('data'))->pluck('username')->all();
        $this->assertContains('user_day2', $usernamesDay2);
        $this->assertNotContains('user_day1', $usernamesDay2);

        // GET /api/moderator/users?month=2026-10
        $resMonth = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?month=2026-10');
        $resMonth->assertOk();
        $usernamesMonth = collect($resMonth->json('data'))->pluck('username')->all();
        $this->assertContains('user_day1', $usernamesMonth);
        $this->assertContains('user_day2', $usernamesMonth);
        $this->assertNotContains('other_user', $usernamesMonth);
    }
}
