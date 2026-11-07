<?php

namespace Tests\Feature;

use App\Models\User;
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

        if (!Schema::hasTable('my_ids')) {
            Schema::create('my_ids', function (Blueprint $table): void {
                $table->id();
                $table->string('my_id_code')->unique();
                $table->string('label')->nullable();
                $table->string('friendly_name')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->enum('role', ['admin', 'user'])->default('user');
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

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => '8.8.8.8',
        ])->postJson('/api/register', [
            'username' => 'geouser',
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

    public function test_direct_request_with_spoofed_forwarding_headers_cannot_spoof_ip(): void
    {
        Http::fake();

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => '127.0.0.1',
        ])->withHeaders([
            'X-Forwarded-For' => '8.8.8.8',
            'CF-Connecting-IP' => '1.1.1.1',
            'X-Real-IP' => '2.2.2.2',
            'X-Client-IP' => '3.3.3.3',
        ])->postJson('/api/register', [
            'username' => 'spoofuser',
            'email' => 'spoof@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertCreated();
        // Canonical $request->ip() safely evaluates REMOTE_ADDR (127.0.0.1) and rejects untrusted forwarded headers
        $response->assertJsonPath('user.ip', '127.0.0.1');
        $this->assertSame('127.0.0.1', DB::table('users')->where('email', 'spoof@example.com')->value('ip'));
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

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => '8.8.8.8',
        ])->withHeaders([
            'Authorization' => 'Bearer '.$token,
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

        $response = $this->withServerVariables([
            'REMOTE_ADDR' => '8.8.8.8',
        ])->getJson('/api/visitor-geo');

        $response->assertOk();
        $response->assertJsonPath('ip_address', '8.8.8.8');
        $response->assertJsonPath('country', 'United States');
    }

    public function test_country_resolution_is_cached_for_24_hours_avoiding_repeated_http_requests(): void
    {
        Http::fake([
            'https://ipapi.co/93.184.216.34/json/' => Http::response([
                'country_name' => 'United States',
                'country' => 'US',
            ], 200),
        ]);

        $resolver = app(\App\Services\IpCountryResolver::class);

        $first = $resolver->countryFromIp('93.184.216.34');
        $this->assertSame('United States', $first);
        Http::assertSentCount(1);

        // Second lookup must hit the 24-hour cache and not dispatch an HTTP call
        $second = $resolver->countryFromIp('93.184.216.34');
        $this->assertSame('United States', $second);
        Http::assertSentCount(1);
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

        $user = User::create([
            'name' => 'New Member',
            'username' => 'member-1234',
            'email' => 'newmember@example.com',
            'role' => 'user',
            'ip' => '8.8.8.8',
            'country' => 'United States',
            'balance' => 0,
            'level' => 1,
            'ban' => false,
            'profile_setup_completed' => false,
            'password' => 'Password123!',
        ]);

        $token = auth('api')->login($user);
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

    public function test_it_resolves_my_id_and_returns_friendly_name_and_sequence(): void
    {
        DB::table('my_ids')->insert([
            'my_id_code' => '1010',
            'friendly_name' => 'Zahidul',
            'label' => 'Zahidul Moderator',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/my-id/resolve/1010');

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'my_id_code' => '1010',
            'friendly_name' => 'Zahidul',
            'sanitized_name' => 'Zahidul',
            'sequence' => '01',
        ]);
        $this->assertNotEmpty($response->json('date_code'));
        $this->assertStringStartsWith('Zahidul_01_', $response->json('suggested_username'));

        // Test with leading '#' in code lookup (e.g. #1010)
        $hashResponse = $this->getJson('/api/my-id/resolve/%231010');
        $hashResponse->assertOk();
        $hashResponse->assertJsonPath('friendly_name', 'Zahidul');
    }

    public function test_it_resolves_code_with_hash_in_db_and_spaced_names(): void
    {
        DB::table('my_ids')->insert([
            'my_id_code' => '#1003',
            'friendly_name' => 'HZ Tanvir',
            'label' => 'Tanvir Moderator',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Resolving '1003' should match '#1003' in database
        $response = $this->getJson('/api/my-id/resolve/1003');
        $response->assertOk();
        $response->assertJsonPath('friendly_name', 'HZ Tanvir');
        $response->assertJsonPath('sanitized_name', 'HZ_Tanvir');
        $this->assertStringStartsWith('HZ_Tanvir_01_', $response->json('suggested_username'));
    }

    public function test_it_resolves_from_label_when_friendly_name_is_null(): void
    {
        DB::table('my_ids')->insert([
            'my_id_code' => '1019',
            'friendly_name' => null,
            'label' => 'Monoyer',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/my-id/resolve/1019');
        $response->assertOk();
        $response->assertJsonPath('friendly_name', 'Monoyer');
        $response->assertJsonPath('sanitized_name', 'Monoyer');
        $this->assertStringStartsWith('Monoyer_01_', $response->json('suggested_username'));
    }

    public function test_it_returns_404_when_my_id_not_found(): void
    {
        $response = $this->getJson('/api/my-id/resolve/9999');
        $response->assertStatus(404);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', "My ID '9999' not found in database.");
    }

    public function test_it_resolves_via_query_param_and_handles_inactive(): void
    {
        DB::table('my_ids')->insert([
            'my_id_code' => '1000',
            'friendly_name' => 'Operator1000',
            'label' => 'Test Operator',
            'is_active' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Inactive returns 400
        $inactiveResponse = $this->getJson('/api/my-id/resolve?code=1000');
        $inactiveResponse->assertStatus(400);
        $inactiveResponse->assertJsonPath('success', false);

        // Update to active
        DB::table('my_ids')->where('my_id_code', '1000')->update(['is_active' => true]);

        // Resolving active via query param returns 200
        $activeResponse = $this->getJson('/api/my-id/resolve?code=1000');
        $activeResponse->assertOk();
        $activeResponse->assertJsonPath('success', true);
        $activeResponse->assertJsonPath('friendly_name', 'Operator1000');
    }
}
