<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SitePinTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('settings');

        parent::tearDown();
    }

    public function test_site_pin_lifecycle_and_verification(): void
    {
        $this->withoutMiddleware();

        // 1. Initially no PIN is set
        $statusRes = $this->getJson('/api/site-pin/status');
        $statusRes->assertOk();
        $statusRes->assertJsonPath('has_pin', false);

        // Public verify returns true when no PIN configured
        $verifyRes = $this->postJson('/api/site-pin/verify', ['pin' => '1234']);
        $verifyRes->assertOk();
        $verifyRes->assertJsonPath('success', true);

        // 2. Reject invalid PIN formats
        $this->postJson('/api/admin/site-pin', ['pin' => '123'])->assertUnprocessable();
        $this->postJson('/api/admin/site-pin', ['pin' => '12345'])->assertUnprocessable();
        $this->postJson('/api/admin/site-pin', ['pin' => '12AB'])->assertUnprocessable();

        // 3. Set valid 4-digit PIN: 1234
        $saveRes = $this->postJson('/api/admin/site-pin', ['pin' => '1234']);
        $saveRes->assertOk();
        $saveRes->assertJsonPath('success', true);
        $saveRes->assertJsonPath('has_pin', true);

        // Status is now active
        $this->getJson('/api/site-pin/status')
            ->assertOk()
            ->assertJsonPath('has_pin', true);

        // Admin check returns has_pin true, but does not expose pin value
        $adminRes = $this->getJson('/api/admin/site-pin');
        $adminRes->assertOk();
        $adminRes->assertJsonPath('has_pin', true);
        $this->assertArrayNotHasKey('pin', $adminRes->json());

        // 4. Verify wrong PIN fails
        $wrongRes = $this->postJson('/api/site-pin/verify', ['pin' => '1111']);
        $wrongRes->assertUnprocessable();
        $wrongRes->assertJsonPath('success', false);

        // 5. Verify correct PIN succeeds
        $correctRes = $this->postJson('/api/site-pin/verify', ['pin' => '1234']);
        $correctRes->assertOk();
        $correctRes->assertJsonPath('success', true);

        // 6. Update PIN to 5072
        $this->postJson('/api/admin/site-pin', ['pin' => '5072'])->assertOk();

        // Old PIN fails
        $this->postJson('/api/site-pin/verify', ['pin' => '1234'])->assertUnprocessable();

        // New PIN succeeds
        $this->postJson('/api/site-pin/verify', ['pin' => '5072'])->assertOk();

        // 7. Delete PIN
        $delRes = $this->deleteJson('/api/admin/site-pin');
        $delRes->assertOk();
        $delRes->assertJsonPath('has_pin', false);

        // Status is now inactive
        $this->getJson('/api/site-pin/status')
            ->assertOk()
            ->assertJsonPath('has_pin', false);

        // Verification returns success when no PIN configured
        $this->postJson('/api/site-pin/verify', ['pin' => '5072'])->assertOk();
    }
}
