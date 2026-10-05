<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminOffersApiCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('offer_api_links', function (Blueprint $table): void {
            $table->id();
            $table->string('provider_key')->unique();
            $table->text('api_link');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('offer_api_links');

        parent::tearDown();
    }

    public function test_admin_can_save_and_reload_provider_offers_api_links(): void
    {
        $this->withoutMiddleware();

        $saveResponse = $this->postJson('/api/admin/offers-api', [
            'items' => [
                [
                    'providerKey' => 'notik',
                    'apiLink' => 'https://example.com/notik',
                    'isActive' => true,
                ],
                [
                    'providerKey' => 'lootably',
                    'apiLink' => 'https://example.com/lootably',
                    'isActive' => false,
                ],
            ],
        ]);

        $saveResponse->assertOk();
        $saveResponse->assertJsonPath('rows.0.providerKey', 'vortexwall');
        $saveResponse->assertJsonPath('rows.6.providerKey', 'notik');

        $this->assertDatabaseHas('offer_api_links', [
            'provider_key' => 'notik',
            'api_link' => 'https://example.com/notik',
            'is_active' => 1,
        ]);
        $this->assertDatabaseHas('offer_api_links', [
            'provider_key' => 'lootably',
            'api_link' => 'https://example.com/lootably',
            'is_active' => 0,
        ]);

        $reloadResponse = $this->getJson('/api/admin/offers-api');
        $reloadResponse->assertOk();
        $reloadResponse->assertJsonPath('rows.6.apiLink', 'https://example.com/notik');
        $reloadResponse->assertJsonPath('rows.6.isActive', true);
        $reloadResponse->assertJsonPath('rows.2.apiLink', 'https://example.com/lootably');
        $reloadResponse->assertJsonPath('rows.2.isActive', false);

        $this->assertCount(17, $reloadResponse->json('rows'));
        $this->assertDatabaseMissing('offer_api_links', [
            'provider_key' => 'vortexwall',
        ]);
    }
}
