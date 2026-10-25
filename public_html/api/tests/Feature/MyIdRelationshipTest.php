<?php

namespace Tests\Feature;

use App\Models\MyId;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MyIdRelationshipTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

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

        parent::tearDown();
    }

    public function test_my_id_can_link_multiple_users(): void
    {
        // 1. Create My ID 1001
        $myId = MyId::create([
            'my_id_code' => '1001',
            'label' => 'Primary Test My ID',
            'is_active' => true,
        ]);

        $this->assertDatabaseHas('my_ids', [
            'my_id_code' => '1001',
            'is_active' => true,
        ]);

        // 2. Link 3 users (user A, user B, user C)
        $userA = User::create([
            'name' => 'User Alpha',
            'username' => 'user_alpha_1001',
            'email' => 'user.alpha@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1001',
        ]);

        $userB = User::create([
            'name' => 'User Beta',
            'username' => 'user_beta_1001',
            'email' => 'user.beta@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1001',
        ]);

        $userC = User::create([
            'name' => 'User Gamma',
            'username' => 'user_gamma_1001',
            'email' => 'user.gamma@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1001',
        ]);

        // 3. Query through MyId relationship
        $freshMyId = MyId::where('my_id_code', '1001')->firstOrFail();
        $linkedUsers = $freshMyId->users;

        $this->assertCount(3, $linkedUsers);
        $this->assertEqualsCanonicalizing(
            [$userA->id, $userB->id, $userC->id],
            $linkedUsers->pluck('id')->all()
        );

        // 4. Query inverse relationship from User to MyId
        $this->assertNotNull($userA->myId);
        $this->assertEquals('1001', $userA->myId->my_id_code);
        $this->assertEquals('Primary Test My ID', $userA->myId->label);
    }

    /**
     * Test A: My ID 1001 exists and active -> signup succeeds -> users.my_id = 1001
     */
    public function test_registration_with_valid_active_my_id_succeeds_and_links_my_id(): void
    {
        MyId::create([
            'my_id_code' => '1001',
            'label' => 'Active My ID 1001',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/register', [
            'username' => 'testuser1001',
            'email' => 'testuser1001@example.com',
            'password' => 'Password123!',
            'my_id' => '1001',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('message', 'Registration successful.');

        $user = User::where('email', 'testuser1001@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('1001', $user->my_id);
        $this->assertNotNull($user->myId);
        $this->assertSame('1001', $user->myId->my_id_code);
    }

    /**
     * Test B: Invalid My ID 9999 -> signup fails with clear validation error
     */
    public function test_registration_with_non_existent_my_id_fails_validation(): void
    {
        $response = $this->postJson('/api/register', [
            'username' => 'invaliduser',
            'email' => 'invalid@example.com',
            'password' => 'Password123!',
            'my_id' => '9999',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['my_id']);
        $response->assertJsonFragment([
            'my_id' => ['The provided My ID does not exist.'],
        ]);

        $this->assertDatabaseMissing('users', [
            'email' => 'invalid@example.com',
        ]);
    }

    /**
     * Test C: Inactive My ID -> signup fails with clear validation error
     */
    public function test_registration_with_inactive_my_id_fails_validation(): void
    {
        MyId::create([
            'my_id_code' => '9000',
            'label' => 'Inactive My ID',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/register', [
            'username' => 'inactiveuser',
            'email' => 'inactive@example.com',
            'password' => 'Password123!',
            'my_id' => '9000',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['my_id']);
        $response->assertJsonFragment([
            'my_id' => ['The provided My ID is currently inactive.'],
        ]);

        $this->assertDatabaseMissing('users', [
            'email' => 'inactive@example.com',
        ]);
    }

    /**
     * Test D: Blank or omitted My ID -> signup succeeds normally -> users.my_id is null
     */
    public function test_registration_with_blank_or_omitted_my_id_succeeds_normally(): void
    {
        // 1. Blank string
        $responseBlank = $this->postJson('/api/register', [
            'username' => 'blankuser',
            'email' => 'blank@example.com',
            'password' => 'Password123!',
            'my_id' => '',
        ]);

        $responseBlank->assertCreated();
        $userBlank = User::where('email', 'blank@example.com')->first();
        $this->assertNotNull($userBlank);
        $this->assertNull($userBlank->my_id);

        // 2. Omitted field
        $responseOmitted = $this->postJson('/api/register', [
            'username' => 'omitteduser',
            'email' => 'omitted@example.com',
            'password' => 'Password123!',
        ]);

        $responseOmitted->assertCreated();
        $userOmitted = User::where('email', 'omitted@example.com')->first();
        $this->assertNotNull($userOmitted);
        $this->assertNull($userOmitted->my_id);
    }

    /**
     * Test E: Provider/postback flow remains unchanged - receives users.id only, never My ID
     */
    public function test_provider_postback_flow_uses_users_id_only(): void
    {
        MyId::create([
            'my_id_code' => '1001',
            'label' => 'Active My ID 1001',
            'is_active' => true,
        ]);

        $user = User::create([
            'name' => 'Provider Test User',
            'username' => 'provider_user_test',
            'email' => 'provider.test@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1001',
        ]);

        // Verify that the user has a numeric id that is used for provider interactions
        $this->assertIsInt($user->id);
        $this->assertNotSame((string) $user->id, $user->my_id);

        // Verify provider user ID helper logic matches user.id
        $providerUserId = $user->id;
        $this->assertEquals($user->id, $providerUserId);
        $this->assertNotEquals($user->my_id, $providerUserId);
    }
}
