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
    }

    protected function tearDown(): void
    {
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
                'data' => ['total_users'],
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
     * Test: DATA PRIVACY - Response contains ONLY id, username, name, balance.
     * Sensitive fields MUST be absent.
     */
    public function test_data_privacy_whitelist_guarantees_no_sensitive_fields(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);
        $this->createUser([
            'name' => 'Target User',
            'username' => 'targetuser',
            'email' => 'sensitive_target@private.org',
            'ip' => '192.168.10.99',
            'country' => 'Germany',
            'balance' => 450.50,
            'ban' => true,
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

            // Must NOT have sensitive keys
            $this->assertArrayNotHasKey('email', $item);
            $this->assertArrayNotHasKey('ip', $item);
            $this->assertArrayNotHasKey('country', $item);
            $this->assertArrayNotHasKey('ban', $item);
            $this->assertArrayNotHasKey('role', $item);
            $this->assertArrayNotHasKey('password', $item);
            $this->assertArrayNotHasKey('google_id', $item);
            $this->assertArrayNotHasKey('google_avatar', $item);
            $this->assertArrayNotHasKey('user_avatar', $item);
            $this->assertArrayNotHasKey('profile_setup_completed', $item);
            $this->assertArrayNotHasKey('created_at', $item);
            $this->assertArrayNotHasKey('updated_at', $item);
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
     * 5-6. imran, sohelrahman (Contains, alphabetical)
     */
    public function test_search_ranking_prioritizes_exact_prefix_then_contains(): void
    {
        $moderator = $this->createUser(['role' => 'moderator', 'username' => 'mod_x']);

        // Insert test accounts in randomized order
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

        // 5-6. Contains matches sorted alphabetically
        $this->assertEquals('imran', $usernames[4]);
        $this->assertEquals('sohelrahman', $usernames[5]);
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
     * Test: PAGINATION options (25, 50, 100) and clamping
     */
    public function test_pagination_options_and_clamping(): void
    {
        $moderator = $this->createUser(['role' => 'moderator']);

        // Test 25
        $res25 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=25');
        $res25->assertStatus(200);
        $this->assertEquals(25, $res25->json('pagination.perPage'));

        // Test 50
        $res50 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=50');
        $res50->assertStatus(200);
        $this->assertEquals(50, $res50->json('pagination.perPage'));

        // Test 100
        $res100 = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=100');
        $res100->assertStatus(200);
        $this->assertEquals(100, $res100->json('pagination.perPage'));

        // Test invalid/over limit (clamped back to 25)
        $resClamped = $this->actingAs($moderator, 'api')->getJson('/api/moderator/users?per_page=500');
        $resClamped->assertStatus(200);
        $this->assertEquals(25, $resClamped->json('pagination.perPage'));
    }

    /**
     * Test: Mutating endpoints do not exist
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
}
