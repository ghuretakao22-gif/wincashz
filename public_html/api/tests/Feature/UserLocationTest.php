<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\GeoLocationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserLocationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('role')->default('user');
            $table->string('my_id')->nullable()->index();
            $table->string('ip', 45)->nullable();
            $table->string('country')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->unsignedInteger('level')->default(1);
            $table->boolean('ban')->default(false);
            $table->string('user_avatar')->nullable();
            $table->boolean('profile_setup_completed')->default(false);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->default('secret');
            $table->rememberToken();
            $table->timestamps();
        });
    }

    private function createUser(array $overrides = []): User
    {
        return User::create(array_merge([
            'name' => 'Test User',
            'username' => 'testuser_' . uniqid(),
            'email' => 'test_' . uniqid() . '@example.com',
            'role' => 'user',
            'balance' => 100.00,
            'ban' => false,
            'password' => bcrypt('password123'),
        ], $overrides));
    }

    public function test_guest_cannot_access_location_endpoint(): void
    {
        $response = $this->getJson('/api/me/location');
        $response->assertStatus(401);
    }

    public function test_banned_user_cannot_access_location_endpoint(): void
    {
        $user = $this->createUser(['ban' => true]);

        $response = $this->actingAs($user, 'api')->getJson('/api/me/location');
        $response->assertStatus(403);
    }

    public function test_authenticated_user_with_private_ip_returns_local_without_http_call(): void
    {
        Http::fake();

        $user = $this->createUser();

        // 127.0.0.1
        $response = $this->actingAs($user, 'api')
            ->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->getJson('/api/me/location');

        $response->assertStatus(200)
            ->assertHeader('Cache-Control')
            ->assertJson([
                'ip' => '127.0.0.1',
                'country' => 'Local',
                'country_code' => '--',
                'flag' => '🏳️',
                'city' => 'Local',
                'region' => 'Local',
                'approximate' => true,
            ]);

        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control') ?? '');

        Http::assertNothingSent();

        // 192.168.1.50
        $response2 = $this->actingAs($user, 'api')
            ->withServerVariables(['REMOTE_ADDR' => '192.168.1.50'])
            ->getJson('/api/me/location');

        $response2->assertStatus(200)
            ->assertJson([
                'country' => 'Local',
                'flag' => '🏳️',
            ]);

        Http::assertNothingSent();
    }

    public function test_authenticated_user_with_public_ip_resolves_via_ipwhois_and_caches(): void
    {
        Http::fake([
            'https://ipwho.is/103.100.200.1' => Http::response([
                'success' => true,
                'country' => 'Bangladesh',
                'country_code' => 'BD',
                'city' => 'Dhaka',
                'region' => 'Dhaka Division',
            ], 200),
        ]);

        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->withServerVariables(['REMOTE_ADDR' => '103.100.200.1'])
            ->getJson('/api/me/location');

        $response->assertStatus(200)
            ->assertJson([
                'ip' => '103.100.200.1',
                'country' => 'Bangladesh',
                'country_code' => 'BD',
                'flag' => '🇧🇩',
                'city' => 'Dhaka',
                'region' => 'Dhaka Division',
                'approximate' => true,
            ]);

        Http::assertSentCount(1);

        // Second call with same IP should be cached and make no extra HTTP request
        $responseCached = $this->actingAs($user, 'api')
            ->withServerVariables(['REMOTE_ADDR' => '103.100.200.1'])
            ->getJson('/api/me/location');

        $responseCached->assertStatus(200)
            ->assertJson([
                'country' => 'Bangladesh',
                'flag' => '🇧🇩',
            ]);

        Http::assertSentCount(1);
    }

    public function test_authenticated_user_with_http_failure_returns_fallback_gracefully(): void
    {
        Http::fake([
            'https://ipwho.is/*' => Http::response(null, 500),
        ]);

        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->withServerVariables(['REMOTE_ADDR' => '8.8.8.8'])
            ->getJson('/api/me/location');

        $response->assertStatus(200)
            ->assertJson([
                'ip' => '8.8.8.8',
                'country' => 'Unknown',
                'country_code' => '--',
                'flag' => '🌐',
                'city' => '',
                'region' => '',
                'approximate' => true,
            ]);
    }

    public function test_geo_service_flag_conversion_and_private_ip_detection(): void
    {
        $service = new GeoLocationService();

        // Flag conversion
        $this->assertEquals('🇧🇩', $service->countryCodeToFlag('BD'));
        $this->assertEquals('🇺🇸', $service->countryCodeToFlag('US'));
        $this->assertEquals('🇬🇧', $service->countryCodeToFlag('GB'));
        $this->assertEquals('🌐', $service->countryCodeToFlag(''));
        $this->assertEquals('🌐', $service->countryCodeToFlag('XYZ'));
        $this->assertEquals('🌐', $service->countryCodeToFlag('12'));

        // Private IP detection
        $this->assertTrue($service->isPrivateIp('127.0.0.1'));
        $this->assertTrue($service->isPrivateIp('::1'));
        $this->assertTrue($service->isPrivateIp('10.0.0.1'));
        $this->assertTrue($service->isPrivateIp('192.168.0.1'));
        $this->assertTrue($service->isPrivateIp('172.16.0.1'));
        $this->assertFalse($service->isPrivateIp('8.8.8.8'));
        $this->assertFalse($service->isPrivateIp('103.100.200.1'));
    }
}
