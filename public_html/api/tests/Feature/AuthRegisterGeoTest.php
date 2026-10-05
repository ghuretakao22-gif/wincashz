<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuthRegisterGeoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->enum('role', ['admin', 'user'])->default('user');
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

    protected function tearDown(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_register_stores_country_resolved_from_forwarded_ip(): void
    {
        Http::fake([
            'api.country.is/8.8.8.8' => Http::response([
                'ip' => '8.8.8.8',
                'country' => 'US',
            ], 200),
        ]);

        $response = $this->withHeaders([
            'X-Forwarded-For' => '8.8.8.8',
        ])->postJson('/api/register', [
            'email' => 'geo@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('user.ip', '8.8.8.8');
        $response->assertJsonPath('user.country', 'United States');
        $expectedAvatar = 'https://api.dicebear.com/10.x/avataaars/svg?seed='.(string) $response->json('user.id');
        $response->assertJsonPath('user.user_avatar', $expectedAvatar);

        $this->assertSame('8.8.8.8', DB::table('users')->where('email', 'geo@example.com')->value('ip'));
        $this->assertSame('United States', DB::table('users')->where('email', 'geo@example.com')->value('country'));
        $this->assertSame($expectedAvatar, DB::table('users')->where('email', 'geo@example.com')->value('user_avatar'));
    }

    public function test_me_syncs_visitor_country_and_ip_to_the_user_record(): void
    {
        Http::fake([
            'api.country.is/8.8.8.8' => Http::response([
                'ip' => '8.8.8.8',
                'country' => 'US',
            ], 200),
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => 'Country Viewer',
            'username' => 'countryviewer',
            'email' => 'country@example.com',
            'role' => 'user',
            'ip' => '1.1.1.1',
            'country' => null,
            'balance' => 0,
            'level' => 1,
            'ban' => false,
            'email_verified_at' => now(),
            'password' => bcrypt('Password123!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $token = auth('api')->login(\App\Models\User::query()->findOrFail($userId));

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Forwarded-For' => '8.8.8.8',
        ])->getJson('/api/me');

        $response->assertOk();
        $response->assertJsonPath('user.session_country', 'United States');
        $response->assertJsonPath('user.session_ip_address', '8.8.8.8');
        $response->assertJsonPath('user.visitor_country', 'United States');
        $response->assertJsonPath('user.visitorCountry', 'United States');
        $response->assertJsonPath('user.country', 'United States');
        $this->assertSame('8.8.8.8', DB::table('users')->where('id', $userId)->value('ip'));
        $this->assertSame('United States', DB::table('users')->where('id', $userId)->value('country'));
    }

    public function test_visitor_geo_returns_country_for_forwarded_ip(): void
    {
        Http::fake([
            'api.country.is/8.8.8.8' => Http::response([
                'ip' => '8.8.8.8',
                'country' => 'US',
            ], 200),
        ]);

        $response = $this->withHeaders([
            'X-Forwarded-For' => '8.8.8.8',
        ])->getJson('/api/visitor-geo');

        $response->assertOk();
        $response->assertJsonPath('ip_address', '8.8.8.8');
        $response->assertJsonPath('country', 'United States');
    }

    public function test_registration_requires_profile_setup_completion(): void
    {
        Http::fake([
            'api.country.is/8.8.8.8' => Http::response([
                'ip' => '8.8.8.8',
                'country' => 'US',
            ], 200),
        ]);

        DB::table('users')->insert([
            'name' => 'Taken User',
            'username' => 'takenname',
            'email' => 'taken@example.com',
            'role' => 'user',
            'ip' => '8.8.8.8',
            'country' => 'United States',
            'balance' => 0,
            'level' => 1,
            'ban' => false,
            'profile_setup_completed' => true,
            'password' => bcrypt('Password123!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->withHeaders([
            'X-Forwarded-For' => '8.8.8.8',
        ])->postJson('/api/register', [
            'email' => 'newmember@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('user.profile_setup_completed', false);
        $this->assertStringStartsWith('member-', (string) $response->json('user.username'));

        $token = $response->json('token');
        $this->assertNotEmpty($token);

        $availabilityResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/username-availability?username=takenname');

        $availabilityResponse->assertOk();
        $availabilityResponse->assertJsonPath('available', false);

        $completionResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/profile/setup', [
            'username' => 'unique-member',
            'avatar' => 'https://api.dicebear.com/10.x/avataaars/svg?seed=unique-member',
        ]);

        $completionResponse->assertOk();
        $completionResponse->assertJsonPath('user.username', 'unique-member');
        $completionResponse->assertJsonPath('user.user_avatar', 'https://api.dicebear.com/10.x/avataaars/svg?seed=unique-member');
        $completionResponse->assertJsonPath('user.profile_setup_completed', true);

        $this->assertDatabaseHas('users', [
            'email' => 'newmember@example.com',
            'username' => 'unique-member',
            'user_avatar' => 'https://api.dicebear.com/10.x/avataaars/svg?seed=unique-member',
            'profile_setup_completed' => true,
        ]);
    }
}
