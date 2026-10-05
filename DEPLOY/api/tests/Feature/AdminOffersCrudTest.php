<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminOffersCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('offers', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_id')->nullable();
            $table->string('provider')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->longText('instructions')->nullable();
            $table->string('requirements')->nullable();
            $table->text('image')->nullable();
            $table->text('link')->nullable();
            $table->double('points')->default(0);
            $table->double('payout')->default(0);
            $table->longText('categories')->nullable();
            $table->longText('countries')->nullable();
            $table->longText('devices')->nullable();
            $table->longText('events')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('offers');

        parent::tearDown();
    }

    public function test_admin_can_create_update_and_delete_custom_offers(): void
    {
        $this->withoutMiddleware();

        $createResponse = $this->postJson('/api/admin/offers', [
            'offer_id' => 'offer-1',
            'provider' => 'Provider One',
            'title' => 'Top Offer',
            'description' => 'A featured offer',
            'instructions' => 'Install and complete',
            'requirements' => 'Reach level 5',
            'image' => 'https://example.com/top.png',
            'link' => 'https://example.com/top',
            'points' => 150,
            'payout' => 1.5,
            'category' => 'top_offers',
            'countries' => ['BD', 'US'],
            'devices' => ['mobile'],
            'events' => ['signup'],
        ]);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('offer.title', 'Top Offer');
        $createResponse->assertJsonPath('offer.category', 'top_offers');
        $createResponse->assertJsonPath('offer.categoryLabel', 'Top Offers');

        $offerId = $createResponse->json('offer.id');
        $this->assertNotNull($offerId);
        $this->assertDatabaseHas('offers', [
            'id' => $offerId,
            'title' => 'Top Offer',
            'categories' => json_encode(['top_offers']),
        ]);

        $updateResponse = $this->patchJson('/api/admin/offers/'.$offerId, [
            'title' => 'Explore Offer',
            'category' => 'explore_offers',
            'points' => 275,
            'payout' => 2.75,
        ]);

        $updateResponse->assertOk();
        $updateResponse->assertJsonPath('offer.title', 'Explore Offer');
        $updateResponse->assertJsonPath('offer.category', 'explore_offers');
        $updateResponse->assertJsonPath('offer.categoryLabel', 'Explore Offers');

        $this->assertDatabaseHas('offers', [
            'id' => $offerId,
            'title' => 'Explore Offer',
            'categories' => json_encode(['explore_offers']),
        ]);

        $deleteResponse = $this->deleteJson('/api/admin/offers/'.$offerId);
        $deleteResponse->assertOk();
        $deleteResponse->assertJsonPath('message', 'Offer deleted successfully.');
        $this->assertDatabaseMissing('offers', [
            'id' => $offerId,
        ]);
    }
}
