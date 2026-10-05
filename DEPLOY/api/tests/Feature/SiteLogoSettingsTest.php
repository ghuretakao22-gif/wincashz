<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SiteLogoSettingsTest extends TestCase
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

    public function test_site_logo_can_be_saved_and_read_publicly(): void
    {
        $this->withoutMiddleware();
        $logo = 'data:image/png;base64,iVBORw0KGgo=';

        $this->patchJson('/api/admin/settings/logo', ['logoDataUrl' => $logo])
            ->assertOk()
            ->assertJsonPath('settings.logoUrl', $logo);

        $this->getJson('/api/site-settings')
            ->assertOk()
            ->assertJsonPath('settings.logoUrl', $logo);
    }

    public function test_site_logo_rejects_non_image_data(): void
    {
        $this->withoutMiddleware();

        $this->patchJson('/api/admin/settings/logo', [
            'logoDataUrl' => 'data:text/plain;base64,SGVsbG8=',
        ])->assertUnprocessable();
    }
}
