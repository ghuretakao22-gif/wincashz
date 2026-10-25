<?php

namespace Tests\Feature;

use App\Models\MyId;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminMyIdManagementTest extends TestCase
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

    private function createAdminUser(): User
    {
        return User::create([
            'name' => 'Admin User',
            'username' => 'admin_test_'.uniqid(),
            'email' => 'admin_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'admin',
        ]);
    }

    private function createNormalUser(): User
    {
        return User::create([
            'name' => 'Normal User',
            'username' => 'user_test_'.uniqid(),
            'email' => 'user_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'user',
        ]);
    }

    private function createModeratorUser(): User
    {
        return User::create([
            'name' => 'Moderator User',
            'username' => 'mod_test_'.uniqid(),
            'email' => 'mod_'.uniqid().'@example.com',
            'password' => 'Password123!',
            'role' => 'moderator',
        ]);
    }

    public function test_admin_can_create_my_id_1002(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/admin/my-ids', [
            'my_id_code' => '1002',
            'label' => 'Team 1002 Label',
            'is_active' => true,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.my_id_code', '1002');
        $response->assertJsonPath('data.label', 'Team 1002 Label');
        $response->assertJsonPath('data.is_active', true);

        $this->assertDatabaseHas('my_ids', [
            'my_id_code' => '1002',
            'label' => 'Team 1002 Label',
            'is_active' => true,
        ]);
    }

    public function test_duplicate_my_id_code_rejected(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        MyId::create([
            'my_id_code' => '1002',
            'label' => 'Existing 1002',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/admin/my-ids', [
            'my_id_code' => '1002',
            'label' => 'Duplicate 1002',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['my_id_code']);
        $response->assertJsonFragment([
            'my_id_code' => ['This My ID already exists.'],
        ]);
    }

    public function test_admin_can_edit_my_id_label(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $myId = MyId::create([
            'my_id_code' => '1002',
            'label' => 'Old Label',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-ids/'.$myId->id, [
            'label' => 'New Updated Label',
        ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.label', 'New Updated Label');

        $this->assertDatabaseHas('my_ids', [
            'id' => $myId->id,
            'label' => 'New Updated Label',
        ]);
    }

    public function test_disable_my_id_causes_signup_to_be_rejected(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $myId = MyId::create([
            'my_id_code' => '1002',
            'label' => 'Active 1002',
            'is_active' => true,
        ]);

        // Disable 1002
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-ids/'.$myId->id, [
            'is_active' => false,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('my_ids', [
            'id' => $myId->id,
            'is_active' => false,
        ]);

        // Attempt registration using 1002 -> rejected
        $signupResponse = $this->postJson('/api/register', [
            'username' => 'testuser_disabled',
            'email' => 'disabled_test@example.com',
            'password' => 'Password123!',
            'my_id' => '1002',
        ]);

        $signupResponse->assertStatus(422);
        $signupResponse->assertJsonValidationErrors(['my_id']);
        $signupResponse->assertJsonFragment([
            'my_id' => ['The provided My ID is currently inactive.'],
        ]);
    }

    public function test_reenable_my_id_causes_signup_to_be_accepted(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $myId = MyId::create([
            'my_id_code' => '1002',
            'label' => 'Disabled 1002',
            'is_active' => false,
        ]);

        // Re-enable 1002
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->patchJson('/api/admin/my-ids/'.$myId->id, [
            'is_active' => true,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.is_active', true);
        $this->assertDatabaseHas('my_ids', [
            'id' => $myId->id,
            'is_active' => true,
        ]);

        // Registration using 1002 -> accepted
        $signupResponse = $this->postJson('/api/register', [
            'username' => 'testuser_reenabled',
            'email' => 'reenabled_test@example.com',
            'password' => 'Password123!',
            'my_id' => '1002',
        ]);

        $signupResponse->assertCreated();
        $this->assertDatabaseHas('users', [
            'username' => 'testuser_reenabled',
            'my_id' => '1002',
        ]);
    }

    public function test_linked_user_count_correct(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $myId = MyId::create([
            'my_id_code' => '1003',
            'label' => 'Count Test',
            'is_active' => true,
        ]);

        // Create 3 users linked to 1003
        User::create([
            'name' => 'Linked User 1',
            'username' => 'linked1',
            'email' => 'l1@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1003',
        ]);
        User::create([
            'name' => 'Linked User 2',
            'username' => 'linked2',
            'email' => 'l2@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1003',
        ]);
        User::create([
            'name' => 'Linked User 3',
            'username' => 'linked3',
            'email' => 'l3@example.com',
            'password' => 'Password123!',
            'role' => 'user',
            'my_id' => '1003',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/admin/my-ids?search=1003');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame(3, $data[0]['users_count']);
    }

    public function test_normal_user_blocked_from_admin_my_id_endpoints(): void
    {
        $user = $this->createNormalUser();
        $token = auth('api')->login($user);

        // GET index
        $resGet = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-ids');
        $resGet->assertStatus(403);

        // POST store
        $resPost = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-ids', ['my_id_code' => '9999']);
        $resPost->assertStatus(403);

        // PATCH update
        $resPatch = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->patchJson('/api/admin/my-ids/1', ['label' => 'Hack']);
        $resPatch->assertStatus(403);
    }

    public function test_moderator_blocked_from_admin_my_id_endpoints(): void
    {
        $mod = $this->createModeratorUser();
        $token = auth('api')->login($mod);

        // GET index
        $resGet = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/my-ids');
        $resGet->assertStatus(403);

        // POST store
        $resPost = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/my-ids', ['my_id_code' => '9999']);
        $resPost->assertStatus(403);

        // PATCH update
        $resPatch = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->patchJson('/api/admin/my-ids/1', ['label' => 'Hack']);
        $resPatch->assertStatus(403);
    }

    public function test_admin_can_access_admin_my_id_endpoints(): void
    {
        $admin = $this->createAdminUser();
        $token = auth('api')->login($admin);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/admin/my-ids');

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'data',
        ]);
    }
}
