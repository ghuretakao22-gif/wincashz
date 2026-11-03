<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeratorUsersScopeTest extends TestCase
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

    private function createUser(array $overrides = []): User
    {
        return User::create(array_merge([
            'name' => 'Test User',
            'username' => 'user_' . uniqid(),
            'email' => 'user_' . uniqid() . '@example.com',
            'role' => 'user',
            'my_id' => 'ALPHA',
            'balance' => 0.00,
            'ban' => false,
            'password' => bcrypt('secret123'),
        ], $overrides));
    }

    /**
     * Requirement 1: STRICT My ID scoping (only this moderator's users)
     * Create users under my_id A (moderator's) and my_id B;
     * GET /api/moderator/users as moderator of A -> only A's users returned, none from B.
     */
    public function test_users_list_is_scoped_to_moderator_my_id(): void
    {
        $modAlpha = $this->createUser([
            'username' => 'mod_alpha',
            'email' => 'mod_alpha@example.com',
            'role' => 'moderator',
            'my_id' => 'TEAM_A',
        ]);

        // Users under TEAM_A
        $userA1 = $this->createUser(['username' => 'alice_a', 'email' => 'alice@a.com', 'my_id' => 'TEAM_A']);
        $userA2 = $this->createUser(['username' => 'bob_a', 'email' => 'bob@a.com', 'my_id' => 'TEAM_A']);

        // Users under TEAM_B
        $userB1 = $this->createUser(['username' => 'charlie_b', 'email' => 'charlie@b.com', 'my_id' => 'TEAM_B']);
        $userB2 = $this->createUser(['username' => 'david_b', 'email' => 'david@b.com', 'my_id' => 'TEAM_B']);

        $res = $this->actingAs($modAlpha, 'api')->getJson('/api/moderator/users');
        $res->assertStatus(200);

        $usernames = collect($res->json('data'))->pluck('username')->all();

        // Must include TEAM_A users (including mod_alpha who also belongs to TEAM_A)
        $this->assertContains('alice_a', $usernames);
        $this->assertContains('bob_a', $usernames);

        // Must NEVER include TEAM_B users
        $this->assertNotContains('charlie_b', $usernames);
        $this->assertNotContains('david_b', $usernames);

        // All returned rows must have total matching TEAM_A count
        $this->assertEquals(3, $res->json('pagination.total'));
    }

    /**
     * Requirement 3: "All" option in Rows-per-page selector
     * Seed 7 users under moderator's my_id;
     * GET ?per_page=all -> 200, data count = 7, total=7, per_page=7, from=1, to=7, last_page=1, current_page=1.
     */
    public function test_per_page_all_returns_everything_with_same_shape(): void
    {
        $mod = $this->createUser([
            'username' => 'mod_seed',
            'role' => 'moderator',
            'my_id' => 'SEED_TEAM',
        ]);

        // Seed 6 more users (plus moderator = 7 users total under SEED_TEAM)
        for ($i = 1; $i <= 6; $i++) {
            $this->createUser([
                'username' => "seed_worker_{$i}",
                'my_id' => 'SEED_TEAM',
            ]);
        }

        // Add unrelated user in another team
        $this->createUser(['username' => 'other_team_user', 'my_id' => 'OTHER_TEAM']);

        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?per_page=all');
        $res->assertStatus(200);

        $data = $res->json('data');
        $this->assertCount(7, $data);

        // Assert pagination structure and values (both inside pagination and top-level aliases)
        $this->assertEquals(7, $res->json('pagination.total'));
        $this->assertEquals(7, $res->json('pagination.perPage'));
        $this->assertEquals(1, $res->json('pagination.from'));
        $this->assertEquals(7, $res->json('pagination.to'));
        $this->assertEquals(1, $res->json('pagination.currentPage'));
        $this->assertEquals(1, $res->json('pagination.lastPage'));

        // Snake_case / top-level compatibility
        $this->assertEquals(7, $res->json('total'));
        $this->assertEquals(7, $res->json('per_page'));
        $this->assertEquals(1, $res->json('from'));
        $this->assertEquals(7, $res->json('to'));
        $this->assertEquals(1, $res->json('current_page'));
        $this->assertEquals(1, $res->json('last_page'));
    }

    /**
     * Requirement 3: Rows-per-page whitelist & fallback
     * per_page=50 works; per_page=999 -> falls back to 25 (assert per_page=25 in response); per_page="all" works.
     */
    public function test_per_page_whitelist(): void
    {
        $mod = $this->createUser([
            'username' => 'mod_whitelist',
            'role' => 'moderator',
            'my_id' => 'WL_TEAM',
        ]);

        // per_page=50 works
        $res50 = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?per_page=50');
        $res50->assertStatus(200);
        $this->assertEquals(50, $res50->json('pagination.perPage'));
        $this->assertEquals(50, $res50->json('per_page'));

        // per_page=999 falls back to 25
        $res999 = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?per_page=999');
        $res999->assertStatus(200);
        $this->assertEquals(25, $res999->json('pagination.perPage'));
        $this->assertEquals(25, $res999->json('per_page'));

        // invalid string falls back to 25
        $resInvalid = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?per_page=foo');
        $resInvalid->assertStatus(200);
        $this->assertEquals(25, $resInvalid->json('pagination.perPage'));
        $this->assertEquals(25, $resInvalid->json('per_page'));

        // per_page="all" works
        $resAll = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?per_page=all');
        $resAll->assertStatus(200);
        $this->assertEquals(1, $resAll->json('pagination.perPage'));
        $this->assertEquals(1, $resAll->json('per_page'));
    }

    /**
     * Requirement 1: Search filter stays strictly inside scoped My ID
     * Search term matching a user in ANOTHER my_id -> not returned; matching own user -> returned.
     */
    public function test_search_stays_within_scope(): void
    {
        $mod = $this->createUser([
            'username' => 'mod_scoper',
            'role' => 'moderator',
            'my_id' => 'SEARCH_TEAM_A',
        ]);

        // Own user
        $ownUser = $this->createUser([
            'name' => 'Gamer Zone',
            'username' => 'gamer_alpha',
            'email' => 'gamer@alpha.com',
            'my_id' => 'SEARCH_TEAM_A',
        ]);

        // Another team's user with similar name/username
        $otherUser = $this->createUser([
            'name' => 'Gamer Pro',
            'username' => 'gamer_beta',
            'email' => 'gamer@beta.com',
            'my_id' => 'SEARCH_TEAM_B',
        ]);

        // Search for "gamer" should only find ownUser, not otherUser
        $resSearch = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?search=gamer');
        $resSearch->assertStatus(200);

        $usernames = collect($resSearch->json('data'))->pluck('username')->all();
        $this->assertContains('gamer_alpha', $usernames);
        $this->assertNotContains('gamer_beta', $usernames);

        // Search specifically for otherUser's username "gamer_beta" -> 0 results
        $resSearchOther = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?search=gamer_beta');
        $resSearchOther->assertStatus(200);
        $this->assertCount(0, $resSearchOther->json('data'));
        $this->assertEquals(0, $resSearchOther->json('pagination.total'));

        // Search by otherUser's numeric ID -> 0 results
        $resSearchId = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?search=' . $otherUser->id);
        $resSearchId->assertStatus(200);
        $this->assertCount(0, $resSearchId->json('data'));
    }

    /**
     * Requirement 1: Moderator with null or empty My ID returns empty result safely (never 500)
     */
    public function test_moderator_with_empty_or_null_my_id_returns_empty_safely(): void
    {
        $modWithoutMyId = $this->createUser([
            'username' => 'mod_no_id',
            'role' => 'moderator',
            'my_id' => null,
        ]);

        $res = $this->actingAs($modWithoutMyId, 'api')->getJson('/api/moderator/users');
        $res->assertStatus(200);
        $res->assertJson([
            'status' => 'success',
            'data' => [],
            'pagination' => [
                'total' => 0,
                'perPage' => 25,
            ],
        ]);
    }

    /**
     * Requirement 1: Data Isolation - Moderator cannot view user activity of another team
     */
    public function test_moderator_cannot_view_activity_of_user_belonging_to_another_team(): void
    {
        $modA = $this->createUser([
            'username' => 'mod_iso_a',
            'role' => 'moderator',
            'my_id' => 'ISO_TEAM_A',
        ]);

        $userB = $this->createUser([
            'username' => 'user_iso_b',
            'role' => 'user',
            'my_id' => 'ISO_TEAM_B',
        ]);

        DB::table('completed_tasks')->insert([
            'user_id' => $userB->id,
            'user_name' => $userB->username,
            'transaction_id' => 'tx_iso_b_99',
            'offer_wall_name' => 'SecretWall',
            'offer_name' => 'Secret Task',
            'currency_reward' => 500,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $res = $this->actingAs($modA, 'api')->getJson('/api/moderator/users/' . $userB->id . '/activity');
        $res->assertStatus(200);
        $res->assertJson([
            'status' => 'success',
            'data' => [],
        ]);
    }

    /**
     * Requirement 2: Offerwall filtering on Moderator Users endpoint
     */
    public function test_users_endpoint_offerwall_filter_and_offerwalls_list(): void
    {
        $mod = $this->createUser([
            'username' => 'mod_walls',
            'role' => 'moderator',
            'my_id' => 'WALLS_TEAM',
        ]);

        $user1 = $this->createUser(['username' => 'w_user1', 'my_id' => 'WALLS_TEAM']);
        $user2 = $this->createUser(['username' => 'w_user2', 'my_id' => 'WALLS_TEAM']);

        DB::table('completed_tasks')->insert([
            'user_id' => $user1->id,
            'user_name' => $user1->username,
            'transaction_id' => 'tx_w1',
            'offer_wall_name' => 'Torox',
            'offer_name' => 'Torox Offer 1',
            'currency_reward' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            'user_id' => $user2->id,
            'user_name' => $user2->username,
            'transaction_id' => 'tx_w2',
            'offer_wall_name' => 'AdWorkMedia',
            'offer_name' => 'AWM Offer 2',
            'currency_reward' => 200,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // GET all returns offerwalls list
        $res = $this->actingAs($mod, 'api')->getJson('/api/moderator/users');
        $res->assertStatus(200);
        $offerwalls = $res->json('offerwalls');
        $this->assertIsArray($offerwalls);
        $this->assertContains('Torox', $offerwalls);
        $this->assertContains('AdWorkMedia', $offerwalls);

        // Filter by wall=Torox
        $resWall = $this->actingAs($mod, 'api')->getJson('/api/moderator/users?wall=Torox');
        $resWall->assertStatus(200);
        $wallUsernames = collect($resWall->json('data'))->pluck('username')->all();
        $this->assertContains('w_user1', $wallUsernames);
        $this->assertNotContains('w_user2', $wallUsernames);
    }
}
