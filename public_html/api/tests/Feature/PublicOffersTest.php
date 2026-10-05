<?php

namespace Tests\Feature;

use App\Models\CompletedTask;
use App\Models\OfferApiLink;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PublicOffersTest extends TestCase
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

        Schema::create('offer_api_links', function (Blueprint $table): void {
            $table->id();
            $table->string('provider_key')->unique();
            $table->text('api_link');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->string('username')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('role')->default('user');
            $table->string('ip')->nullable();
            $table->string('country')->nullable();
            $table->decimal('balance', 12, 2)->default(0);
            $table->integer('level')->default(1);
            $table->boolean('ban')->default(false);
            $table->boolean('profile_setup_completed')->default(true);
            $table->timestamps();
        });

        Schema::create('completed_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('offer_wall_name')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('transaction_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->string('offer_id')->nullable();
            $table->decimal('revenue', 12, 2)->default(0);
            $table->decimal('currency_reward', 12, 2)->default(0);
            $table->string('ip')->nullable();
            $table->string('country')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');
        Schema::dropIfExists('offer_api_links');
        Schema::dropIfExists('offers');

        parent::tearDown();
    }

    public function test_offers_endpoint_returns_highest_earning_rows_first(): void
    {
        DB::table('offers')->insert([
            'offer_id' => 'offer-1',
            'provider' => 'Survey',
            'title' => 'Low Offer',
            'description' => 'Low reward offer',
            'requirements' => 'Complete step 1',
            'image' => '/images/low.png',
            'link' => 'https://example.com/low',
            'points' => 150,
            'payout' => 1.50,
            'categories' => json_encode(['survey']),
            'countries' => json_encode(['US']),
            'devices' => json_encode(['mobile']),
            'events' => json_encode(['install']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('offers')->insert([
            'offer_id' => 'offer-2',
            'provider' => 'Game',
            'title' => 'High Offer',
            'description' => 'High reward offer',
            'requirements' => 'Complete step 2',
            'image' => '/images/high.png',
            'link' => 'https://example.com/high',
            'points' => 1250,
            'payout' => 12.50,
            'categories' => json_encode(['game']),
            'countries' => json_encode(['US']),
            'devices' => json_encode(['desktop']),
            'events' => json_encode(['signup']),
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);

        $response = $this->getJson('/api/offers');

        $response->assertOk();
        $response->assertJsonCount(2, 'rows');
        $response->assertJsonPath('rows.0.title', 'High Offer');
        $response->assertJsonPath('rows.0.reward', '1,250');
        $response->assertJsonPath('rows.0.tag', 'Game');
    }

    public function test_offers_endpoint_merges_notik_pages_and_hides_completed_disabled_rows(): void
    {
        DB::table('offers')->insert([
            'offer_id' => 'custom-top',
            'provider' => 'Custom',
            'title' => 'Custom Top Offer',
            'description' => 'Top category offer',
            'requirements' => 'Complete the custom top offer',
            'image' => '/images/custom-top.png',
            'link' => 'https://example.com/custom-top',
            'points' => 200,
            'payout' => 2.00,
            'categories' => json_encode(['top_offers']),
            'countries' => json_encode(['US']),
            'devices' => json_encode(['mobile']),
            'events' => json_encode(['install']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('offers')->insert([
            'offer_id' => 'custom-explore',
            'provider' => 'Custom',
            'title' => 'Custom Explore Offer',
            'description' => 'Explore category offer',
            'requirements' => 'Complete the custom explore offer',
            'image' => '/images/custom-explore.png',
            'link' => 'https://example.com/custom-explore',
            'points' => 180,
            'payout' => 1.80,
            'categories' => json_encode(['explore_offers']),
            'countries' => json_encode(['US']),
            'devices' => json_encode(['mobile']),
            'events' => json_encode(['install']),
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);

        $user = User::query()->create([
            'name' => 'Test User',
            'username' => 'tester',
            'email' => 'tester@example.com',
            'password' => 'secret',
            'role' => 'user',
            'ban' => false,
            'balance' => 0,
            'level' => 1,
            'profile_setup_completed' => true,
        ]);

        CompletedTask::query()->create([
            'offer_wall_name' => 'Notik',
            'user_id' => $user->id,
            'user_name' => $user->username,
            'transaction_id' => 'txn-100',
            'offer_name' => 'Already Completed',
            'offer_id' => 'notik-completed',
            'revenue' => 1.50,
            'currency_reward' => 150,
            'ip' => '127.0.0.1',
            'country' => 'US',
        ]);

        OfferApiLink::query()->create([
            'provider_key' => 'notik',
            'api_link' => 'https://notik.test/api/offers',
            'is_active' => true,
        ]);

        $token = auth('api')->login($user);

        Http::fake([
            'https://notik.test/api/offers' => Http::response([
                'data' => [
                    [
                        'id' => 'notik-completed',
                        'name' => 'Already Completed',
                        'click_url' => 'https://notik.test/click?user_id=[user_id]',
                        'image_url' => '/images/completed.png',
                        'payout' => 2.5,
                        'status' => 'active',
                    ],
                    [
                        'id' => 'notik-disabled',
                        'name' => 'Disabled Offer',
                        'click_url' => 'https://notik.test/click-disabled?user_id=[user_id]',
                        'image_url' => '/images/disabled.png',
                        'payout' => 3.5,
                        'status' => 'disabled',
                    ],
                    [
                        'id' => 'notik-fresh',
                        'name' => 'Fresh Offer',
                        'click_url' => 'https://notik.test/click-fresh?user_id=[user_id]',
                        'image_url' => '/images/fresh.png',
                        'payout' => 4.5,
                        'status' => 'active',
                        'new_users_only' => true,
                    ],
                ],
                'next_page_url' => 'https://notik.test/api/offers?page=2',
            ], 200),
            'https://notik.test/api/offers?page=2' => Http::response([
                'offers' => [
                    [
                        'id' => 'notik-second',
                        'title' => 'Second Page Offer',
                        'click_url' => 'https://notik.test/click-second?user_id=[user_id]',
                        'image_url' => '/images/second.png',
                        'reward' => 5,
                        'status' => 'active',
                    ],
                ],
                'next_page_url' => null,
            ], 200),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/offers');

        $response->assertOk();
        $response->assertJsonCount(2, 'rows');

        $titles = collect($response->json('rows'))->pluck('title')->all();

        $this->assertContains('Fresh Offer', $titles);
        $this->assertContains('Second Page Offer', $titles);
        $this->assertNotContains('Custom Top Offer', $titles);
        $this->assertNotContains('Custom Explore Offer', $titles);

        $response->assertJsonPath('rows.0.title', 'Fresh Offer');
        $response->assertJsonPath('rows.0.category', 'explore_offers');
        $response->assertJsonPath('rows.0.link', 'https://notik.test/click-fresh?user_id='.$user->id);
        $response->assertJsonPath('rows.1.title', 'Second Page Offer');

        Http::assertSentCount(2);
    }
}
