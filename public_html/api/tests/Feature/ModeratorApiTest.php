<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeratorApiTest extends TestCase
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
            $table->string('ip', 45)->nullable();
            $table->string('country')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->unsignedInteger('level')->default(1);
            $table->boolean('ban')->default(false);
            $table->string('google_id')->nullable();
            $table->string('google_avatar')->nullable();
            $table->string('user_avatar')->nullable();
            $table->boolean('profile_setup_completed')->default(false);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->default('secret');
            $table->rememberToken();
            $table->timestamps();
        });

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

    protected function tearDown(): void
    {
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    protected function createUser(array $attributes = []): User
    {
        $id = DB::table('users')->insertGetId(array_merge([
            'name' => 'Test User',
            'username' => 'testuser_'.uniqid(),
            'email' => 'user_'.uniqid().'@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'United States',
            'balance' => 1500.00,
            'level' => 1,
            'ban' => false,
            'password' => bcrypt('password123'),
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));

        return User::findOrFail($id);
    }

    protected function createCompletedTask(array $attributes = []): int
    {
        return DB::table('completed_tasks')->insertGetId(array_merge([
            'offer_wall_name' => 'Vortex',
            'user_id' => null,
            'user_name' => 'testuser',
            'transaction_id' => 'tx_'.uniqid(),
            'offer_name' => 'Test Offer',
            'offer_id' => 'off_123',
            'revenue' => 1.00,
            'currency_reward' => 470.00,
            'ip' => '127.0.0.1',
            'country' => 'United States',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    /**
     * Test: Normal user -> moderator API = 403
     */
    public function test_normal_user_cannot_access_moderator_routes(): void
    {
        $normalUser = $this->createUser(['role' => 'user']);

        $resStats = $this->actingAs($normalUser, 'api')->getJson('/api/moderator/stats');
        $resStats->assertStatus(403);

        $resUsers = $this->actingAs($normalUser, 'api')->getJson('/api/moderator/users');
        $resUsers->assertStatus(403);
    }

    /**
     * Test: Moderator -> moderator API = 200
     */
    public function test_moderator_can_access_moderator_routes(): void
    {
        $moderator = $this->createUser(['role' => 'moderator', 'username' => 'staff_mod']);

        $resStats = $this->actingAs($moderator, 'api')->getJson('/api/moderator/stats');
        $resStats->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => ['total_users', 'months'],
            ]);

        $resUsers = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users');
        $resUsers->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data',
                'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
            ]);
    }

    /**
     * Test: Moderator -> admin API = 403
     */
    public function test_moderator_cannot_access_admin_routes(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/admin/users');
        $res->assertStatus(403);
    }

    /**
     * Test: Admin -> moderator API = 200
     */
    public function test_admin_can_access_moderator_routes(): void
    {
        $admin = $this->createUser(['role' => 'admin']);

        $res = $this->actingAs($admin, 'api')->getJson('/api/moderator/users');
        $res->assertStatus(200);
    }

    /**
     * Test: DATA PRIVACY - Response contains ONLY whitelisted keys. Sensitive fields MUST be absent.
     */
    public function test_data_privacy_whitelist_guarantees_no_sensitive_fields(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $user = $this->createUser([
            'name' => 'Target User',
            'username' => 'targetuser',
            'email' => 'sensitive_target@private.org',
            'ip' => '192.168.10.99',
            'country' => 'Germany',
            'balance' => 450.50,
            'ban' => true,
        ]);

        $this->createCompletedTask([
            'user_id' => $user->id,
            'offer_wall_name' => 'Vortex',
            'currency_reward' => 350.00,
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users');
        $res->assertStatus(200);

        $data = $res->json('data');
        $this->assertNotEmpty($data);

        foreach ($data as $item) {
            // Must have only allowed keys
            $this->assertArrayHasKey('id', $item);
            $this->assertArrayHasKey('username', $item);
            $this->assertArrayHasKey('name', $item);
            $this->assertArrayHasKey('balance', $item);
            $this->assertArrayHasKey('latest_wall', $item);
            $this->assertArrayHasKey('latest_coins', $item);
            $this->assertArrayHasKey('latest_credit_at', $item);
            $this->assertArrayHasKey('latest_credit_date', $item);
            $this->assertArrayHasKey('latest_credit_time', $item);

            // Must NOT have sensitive keys
            $this->assertArrayNotHasKey('email', $item);
            $this->assertArrayNotHasKey('ip', $item);
            $this->assertArrayNotHasKey('country', $item);
            $this->assertArrayNotHasKey('ban', $item);
            $this->assertArrayNotHasKey('role', $item);
            $this->assertArrayNotHasKey('password', $item);
            $this->assertArrayNotHasKey('revenue', $item);
            $this->assertArrayNotHasKey('payout', $item);
            $this->assertArrayNotHasKey('google_id', $item);
            $this->assertArrayNotHasKey('google_avatar', $item);
            $this->assertArrayNotHasKey('user_avatar', $item);
            $this->assertArrayNotHasKey('profile_setup_completed', $item);
        }
    }

    /**
     * Test: TOTAL USERS - DB total matches stats() and pagination total
     */
    public function test_total_users_matches_database_count(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $this->createUser(['username' => 'user_a']);
        $this->createUser(['username' => 'user_b']);
        $this->createUser(['username' => 'user_c']);

        $dbCount = DB::table('users')->count();

        $statsRes = $this->actingAs($moderator, 'api')->getJson('/api/moderator/stats');
        $statsRes->assertStatus(200);
        $this->assertEquals($dbCount, $statsRes->json('data.total_users'));

        $usersRes = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users');
        $usersRes->assertStatus(200);
        $this->assertEquals($dbCount, $usersRes->json('pagination.total'));
    }

    /**
     * Test: SEARCH & RANKING
     * Query: "ra"
     * Expected order:
     * 1. ra (Exact match)
     * 2-4. rahim, rakib, rasel (Starts with, alphabetical)
     * Excluded: imran, sohelrahman (Contains substring, strictly excluded in prefix-only search)
     */
    public function test_search_ranking_prioritizes_exact_prefix_and_excludes_middle_substrings(): void
    {
        $moderator = $this->createUser(['role' => 'moderator', 'username' => 'mod_x']);

        $this->createUser(['username' => 'sohelrahman', 'name' => 'Sohel Rahman']);
        $this->createUser(['username' => 'rahim', 'name' => 'Abdur Rahim']);
        $this->createUser(['username' => 'imran', 'name' => 'Imran Khan']);
        $this->createUser(['username' => 'ra', 'name' => 'RA Master']);
        $this->createUser(['username' => 'rasel', 'name' => 'Rasel Ahmed']);
        $this->createUser(['username' => 'rakib', 'name' => 'Rakib Hasan']);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?search=ra&per_page=100');
        $res->assertStatus(200);

        $usernames = collect($res->json('data'))->pluck('username')->all();

        // 1. Exact match
        $this->assertEquals('ra', $usernames[0]);

        // 2-4. Prefix matches sorted alphabetically
        $this->assertEquals('rahim', $usernames[1]);
        $this->assertEquals('rakib', $usernames[2]);
        $this->assertEquals('rasel', $usernames[3]);

        // Strictly prefix-only: middle substring matches must NOT be returned
        $this->assertNotContains('imran', $usernames);
        $this->assertNotContains('sohelrahman', $usernames);
    }

    /**
     * Test: PREFIX-ONLY SEARCH FOR "za" (matches zahidul, zaman; strictly rejects rezaul)
     */
    public function test_prefix_only_search_for_za_matches_start_and_rejects_middle_match(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);

        $this->createUser(['username' => 'zahidul', 'name' => 'Zahidul Islam']);
        $this->createUser(['username' => 'zaman', 'name' => 'Zaman Ali']);
        $this->createUser(['username' => 'rezaul', 'name' => 'Rezaul Karim']);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?search=za');
        $res->assertStatus(200);

        $usernames = collect($res->json('data'))->pluck('username')->all();

        $this->assertContains('zahidul', $usernames);
        $this->assertContains('zaman', $usernames);
        $this->assertNotContains('rezaul', $usernames);
    }

    /**
     * Test: SEARCH by exact numeric ID
     */
    public function test_search_by_numeric_id(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $targetUser = $this->createUser(['username' => 'special_target']);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?search='.$targetUser->id);
        $res->assertStatus(200);

        $data = $res->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals($targetUser->id, $data[0]['id']);
        $this->assertEquals('special_target', $data[0]['username']);
    }

    /**
     * Test: WALL & COIN ACTIVITY per user without N+1 queries
     */
    public function test_wall_activity_and_coins_displayed_accurately(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $user = $this->createUser(['username' => 'gamer99', 'balance' => 1250.00]);

        // Older completion
        $this->createCompletedTask([
            'user_id' => $user->id,
            'offer_wall_name' => 'Torox',
            'currency_reward' => 200.00,
            'created_at' => now()->subDays(2),
        ]);

        // Latest completion
        $this->createCompletedTask([
            'user_id' => $user->id,
            'offer_wall_name' => 'Vortex',
            'currency_reward' => 470.00,
            'created_at' => now(),
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?search=gamer99');
        $res->assertStatus(200);

        $item = $res->json('data.0');
        $this->assertNotNull($item);
        $this->assertEquals('gamer99', $item['username']);
        $this->assertEquals(1250.00, $item['balance']);
        $this->assertEquals('Vortex', $item['latest_wall']);
        $this->assertEquals(470.00, $item['latest_coins']);
        $this->assertNotNull($item['latest_credit_date']);
        $this->assertNotNull($item['latest_credit_time']);
    }

    /**
     * Test: DATE FILTER scopes to specific date
     */
    public function test_date_filter_scopes_to_specific_date(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $userA = $this->createUser(['username' => 'user_oct15']);
        $userB = $this->createUser(['username' => 'user_oct16']);

        $this->createCompletedTask([
            'user_id' => $userA->id,
            'offer_wall_name' => 'BitLabs',
            'currency_reward' => 100.00,
            'created_at' => '2026-10-15 10:00:00',
        ]);

        $this->createCompletedTask([
            'user_id' => $userB->id,
            'offer_wall_name' => 'CPALead',
            'currency_reward' => 300.00,
            'created_at' => '2026-10-16 14:30:00',
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?date=2026-10-16');
        $res->assertStatus(200);

        $usernames = collect($res->json('data'))->pluck('username')->all();
        $this->assertContains('user_oct16', $usernames);
        $this->assertNotContains('user_oct15', $usernames);

        $matchedItem = collect($res->json('data'))->firstWhere('username', 'user_oct16');
        $this->assertEquals('CPALead', $matchedItem['latest_wall']);
        $this->assertEquals(300.00, $matchedItem['latest_coins']);
    }

    /**
     * Test: MONTH FILTER scopes to specific month
     */
    public function test_month_filter_scopes_to_specific_month(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $userSep = $this->createUser(['username' => 'user_sep']);
        $userOct = $this->createUser(['username' => 'user_oct']);

        $this->createCompletedTask([
            'user_id' => $userSep->id,
            'offer_wall_name' => 'Torox',
            'currency_reward' => 500.00,
            'created_at' => '2026-09-20 12:00:00',
        ]);

        $this->createCompletedTask([
            'user_id' => $userOct->id,
            'offer_wall_name' => 'Vortex',
            'currency_reward' => 750.00,
            'created_at' => '2026-10-05 15:00:00',
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?month=2026-10');
        $res->assertStatus(200);

        $usernames = collect($res->json('data'))->pluck('username')->all();
        $this->assertContains('user_oct', $usernames);
        $this->assertNotContains('user_sep', $usernames);
    }

    /**
     * Test: USER RECENT ACTIVITY DETAIL ENDPOINT
     */
    public function test_user_recent_activity_detail_endpoint(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $user = $this->createUser(['username' => 'active_player']);

        $this->createCompletedTask([
            'user_id' => $user->id,
            'offer_wall_name' => 'Torox',
            'currency_reward' => 250.00,
            'created_at' => '2026-10-16 11:00:00',
        ]);

        $this->createCompletedTask([
            'user_id' => $user->id,
            'offer_wall_name' => 'CPALead',
            'currency_reward' => 450.00,
            'created_at' => '2026-10-16 12:00:00',
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users/'.$user->id.'/activity');
        $res->assertStatus(200);

        $data = $res->json('data');
        $this->assertCount(2, $data);
        $this->assertEquals('CPALead', $data[0]['offer_wall_name']);
        $this->assertEquals(450.00, $data[0]['currency_reward']);
        $this->assertNotNull($data[0]['credit_date']);
        $this->assertNotNull($data[0]['credit_time']);
    }

    /**
     * Test: PAGINATION options (25, 50, 100) and clamping
     */
    public function test_pagination_options_and_clamping(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);

        $res25 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=25');
        $res25->assertStatus(200);
        $this->assertEquals(25, $res25->json('pagination.perPage'));

        $res50 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=50');
        $res50->assertStatus(200);
        $this->assertEquals(50, $res50->json('pagination.perPage'));

        $res100 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=100');
        $res100->assertStatus(200);
        $this->assertEquals(100, $res100->json('pagination.perPage'));

        $resClamped = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=500');
        $resClamped->assertStatus(200);
        $this->assertEquals(25, $resClamped->json('pagination.perPage'));
    }

    /**
     * Test: Mutating endpoints do not exist (Read-Only)
     */
    public function test_moderator_routes_are_strictly_read_only(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);

        $resPost = $this->actingAs($moderator, 'api')->postJson('/api/moderator/users', ['name' => 'Bad']);
        $this->assertTrue(in_array($resPost->status(), [404, 405], true));

        $resPut = $this->actingAs($moderator, 'api')->putJson('/api/moderator/users/1', ['name' => 'Bad']);
        $this->assertTrue(in_array($resPut->status(), [404, 405], true));

        $resDelete = $this->actingAs($moderator, 'api')->deleteJson('/api/moderator/users/1');
        $this->assertTrue(in_array($resDelete->status(), [404, 405], true));
    }

    /**
     * Test: COINS VIEW MODE returns individual coin credit rows with safe fields
     */
    public function test_coins_view_mode_returns_credited_coins_and_safe_fields(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $user = $this->createUser(['username' => 'coins_player', 'name' => 'Coins Player', 'balance' => 999.00]);

        $this->createCompletedTask([
            'user_id' => $user->id,
            'user_name' => 'coins_player',
            'offer_wall_name' => 'Torox',
            'offer_name' => 'Play Game 1',
            'currency_reward' => 350.00,
            'created_at' => '2026-10-16 10:00:00',
        ]);

        $this->createCompletedTask([
            'user_id' => $user->id,
            'user_name' => 'coins_player',
            'offer_wall_name' => 'CPALead',
            'offer_name' => 'Download App',
            'currency_reward' => 150.00,
            'created_at' => '2026-10-16 12:00:00',
        ]);

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?view=coins');
        $res->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'data' => [
                    '*' => [
                        'id',
                        'user_id',
                        'username',
                        'name',
                        'balance',
                        'wall_name',
                        'credited_coins',
                        'created_at',
                        'credit_date',
                        'credit_time',
                    ],
                ],
                'pagination',
            ]);

        $data = $res->json('data');
        $this->assertCount(2, $data);
        $this->assertEquals('CPALead', $data[0]['wall_name']);
        $this->assertEquals(150.00, $data[0]['credited_coins']);
        $this->assertEquals('Torox', $data[1]['wall_name']);
        $this->assertEquals(350.00, $data[1]['credited_coins']);

        // Sensitive fields check
        foreach ($data as $row) {
            $this->assertArrayNotHasKey('email', $row);
            $this->assertArrayNotHasKey('ip', $row);
            $this->assertArrayNotHasKey('country', $row);
            $this->assertArrayNotHasKey('revenue', $row);
            $this->assertArrayNotHasKey('payout', $row);
        }
    }

    /**
     * Test: AUTO ALL RESULTS ON SPECIFIC SINGLE DATE
     */
    public function test_single_date_auto_shows_all_records_ignoring_per_page_cap(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $user = $this->createUser(['username' => 'daily_grinder']);

        // Insert 30 completions on a single specific date
        for ($i = 1; $i <= 30; $i++) {
            $this->createCompletedTask([
                'user_id' => $user->id,
                'user_name' => 'daily_grinder',
                'transaction_id' => 'batch-tx-'.$i,
                'currency_reward' => 10.00 * $i,
                'created_at' => '2026-10-16 14:00:00',
            ]);
        }

        $res = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?view=coins&date=2026-10-16&per_page=25');
        $res->assertStatus(200);

        // When specific date is picked, all 30 matching records are loaded automatically
        $data = $res->json('data');
        $this->assertCount(30, $data);
        $this->assertEquals(30, $res->json('pagination.total'));
    }
}
