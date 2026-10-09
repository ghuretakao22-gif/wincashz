<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OfferwallPostbackTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('offerwalls', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('badge', 40)->nullable();
            $table->text('logo_url');
            $table->string('category')->default('offerwall');
            $table->text('iframe_url');
            $table->decimal('rating', 4, 2)->default(5);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedTinyInteger('unlock_level')->default(1);
            $table->string('postback_slug')->nullable()->unique();
            $table->json('postback_parameters')->nullable();
            $table->text('postback_url')->nullable();
            $table->boolean('postback_signature_required')->default(false);
            $table->boolean('postback_whitelist_ip_required')->default(false);
            $table->json('postback_whitelist_ips')->nullable();
            $table->timestamps();
        });

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
            $table->string('referral_code', 6)->unique();
            $table->string('referred_by')->nullable();
            $table->unsignedInteger('total_referred')->default(0);
            $table->decimal('referral_earning', 12, 2)->default(0);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('user_avatar')->nullable();
            $table->boolean('profile_setup_completed')->default(false);
            $table->string('password');
            $table->rememberToken();
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

        Schema::create('chargebacks', function (Blueprint $table): void {
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
            $table->string('status')->default('pending');
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('admin_id')->nullable();
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
            $table->unique(['reference_type', 'reference_id']);
        });

        Schema::create('timeline_entries', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_name')->nullable()->index();
            $table->string('user_avatar')->nullable();
            $table->string('offer_wall_name')->nullable()->index();
            $table->string('offer_name')->nullable();
            $table->string('task_id')->nullable()->index();
            $table->decimal('currency_reward', 12, 2)->default(0);
            $table->string('type')->default('completed_task')->index();
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('chargebacks');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');
        Schema::dropIfExists('offerwalls');

        parent::tearDown();
    }

    public function test_offerwall_postback_credits_a_user_and_handles_chargebacks(): void
    {
        DB::table('offerwalls')->insert([
            'name' => 'Survey Partners',
            'badge' => null,
            'logo_url' => 'https://example.com/logo.png',
            'category' => 'survey',
            'iframe_url' => 'https://example.com/frame/',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'surveywall',
            'postback_parameters' => json_encode([
                'userId' => ['name' => 'player_id', 'placeholder' => '{userId}'],
                'transactionId' => ['name' => 'txid', 'placeholder' => '{transactionId}'],
                'revenue' => ['name' => 'payout', 'placeholder' => '{payout}'],
                'reward' => ['name' => 'points', 'placeholder' => '{reward}'],
                'offerName' => ['name' => 'offer_name', 'placeholder' => '{offerName}'],
                'offerId' => ['name' => 'offer_id', 'placeholder' => '{offerId}'],
                'status' => ['name' => 'status', 'placeholder' => '{status}'],
                'ip' => ['name' => 'ip_address', 'placeholder' => '{ip}'],
                'country' => ['name' => 'country', 'placeholder' => '{country}'],
                'extras' => [],
            ]),
            'postback_url' => 'https://example.com/api/offerwall-postback/surveywall',
            'postback_signature_required' => false,
            'postback_whitelist_ip_required' => false,
            'postback_whitelist_ips' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => 'Survey User',
            'username' => 'surveyuser',
            'email' => 'survey@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'balance' => 0,
            'level' => 1,
            'referral_code' => 'ABC123',
            'referred_by' => null,
            'total_referred' => 0,
            'referral_earning' => 0,
            'email_verified_at' => now(),
            'password' => bcrypt('secret123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $approve = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1001&payout=1.25&points=250&offer_name=Survey+Complete&offer_id=SV-1&status=approved&ip_address=127.0.0.1&country=BD');
        $approve->assertOk()->assertContent('Ok');

        $completedTask = DB::table('completed_tasks')->where('transaction_id', 'tx-1001')->first();
        $this->assertNotNull($completedTask);
        $this->assertSame('surveywall', $completedTask->offer_wall_name);
        $this->assertSame($userId, (int) $completedTask->user_id);
        $this->assertSame('Survey Complete', $completedTask->offer_name);
        $this->assertSame(250.0, (float) $completedTask->currency_reward);
        $this->assertSame(250.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $timelineEntry = DB::table('timeline_entries')->where('offer_wall_name', 'surveywall')->first();
        $this->assertNotNull($timelineEntry);
        $this->assertSame('Survey Complete', $timelineEntry->offer_name);
        $this->assertSame(250.0, (float) $timelineEntry->currency_reward);
        $this->assertSame('completed_task', $timelineEntry->type);
        $this->assertFalse(property_exists($timelineEntry, 'offer_id'));
        $this->assertFalse(property_exists($timelineEntry, 'revenue'));

        $rewardNotification = DB::table('user_notifications')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();
        $this->assertNotNull($rewardNotification);
        $this->assertSame('task_completed', $rewardNotification->type);
        $this->assertSame('You have received 250 coins from surveywall for Survey Complete', $rewardNotification->title);
        $this->assertNull($rewardNotification->message);

        $chargeback = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1001&payout=1.25&points=250&offer_name=Survey+Complete&offer_id=SV-1&status=2&ip_address=127.0.0.1&country=BD');
        $chargeback->assertOk()->assertContent('Ok');

        $this->assertFalse(DB::table('completed_tasks')->where('transaction_id', 'tx-1001')->exists());

        $chargebackRow = DB::table('chargebacks')->where('transaction_id', 'tx-1001')->first();
        $this->assertNotNull($chargebackRow);
        $this->assertSame('surveywall', $chargebackRow->offer_wall_name);
        $this->assertSame(250.0, (float) $chargebackRow->currency_reward);
        $this->assertSame(0.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $notification = DB::table('user_notifications')
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->first();
        $this->assertNotNull($notification);
        $this->assertSame('chargeback', $notification->type);

        $missingStatusApprove = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1002&payout=1.25&points=250&offer_name=Survey+Complete+2&offer_id=SV-2&ip_address=127.0.0.1&country=BD');
        $missingStatusApprove->assertOk()->assertContent('Ok');

        $completedTaskMissingStatus = DB::table('completed_tasks')->where('transaction_id', 'tx-1002')->first();
        $this->assertNotNull($completedTaskMissingStatus);
        $this->assertSame('Survey Complete 2', $completedTaskMissingStatus->offer_name);
        $this->assertSame(250.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $falseChargeback = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1002&payout=1.25&points=250&offer_name=Survey+Complete+2&offer_id=SV-2&status=false&ip_address=127.0.0.1&country=BD');
        $falseChargeback->assertOk()->assertContent('Ok');

        $this->assertFalse(DB::table('completed_tasks')->where('transaction_id', 'tx-1002')->exists());

        $falseChargebackRow = DB::table('chargebacks')->where('transaction_id', 'tx-1002')->first();
        $this->assertNotNull($falseChargebackRow);
        $this->assertSame('chargeback', $falseChargebackRow->status);
        $this->assertSame(0.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $successStatus = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1003&payout=1.25&points=250&offer_name=Survey+Complete+3&offer_id=SV-3&status=success&ip_address=127.0.0.1&country=BD');
        $successStatus->assertOk()->assertContent('Ok');

        $completedTaskSuccess = DB::table('completed_tasks')->where('transaction_id', 'tx-1003')->first();
        $this->assertNotNull($completedTaskSuccess);
        $this->assertSame(250.0, (float) $completedTaskSuccess->currency_reward);
        $this->assertSame(250.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $trueStatus = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-1004&payout=1.25&points=250&offer_name=Survey+Complete+4&offer_id=SV-4&status=true&ip_address=127.0.0.1&country=BD');
        $trueStatus->assertOk()->assertContent('Ok');

        $completedTaskTrue = DB::table('completed_tasks')->where('transaction_id', 'tx-1004')->first();
        $this->assertNotNull($completedTaskTrue);
        $this->assertSame(250.0, (float) $completedTaskTrue->currency_reward);
        $this->assertSame(500.0, (float) DB::table('users')->where('id', $userId)->value('balance'));
    }

    public function test_offerwall_postback_resolves_country_from_ip_when_missing(): void
    {
        Http::fake([
            'ipapi.co/8.8.4.4/json/' => Http::response([
                'country_name' => 'United States',
                'country' => 'US',
            ], 200),
        ]);

        DB::table('offerwalls')->insert([
            'name' => 'Survey Partners',
            'badge' => null,
            'logo_url' => 'https://example.com/logo.png',
            'category' => 'survey',
            'iframe_url' => 'https://example.com/frame/',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'surveywall',
            'postback_parameters' => json_encode([
                'userId' => ['name' => 'player_id', 'placeholder' => '{userId}'],
                'transactionId' => ['name' => 'txid', 'placeholder' => '{transactionId}'],
                'revenue' => ['name' => 'payout', 'placeholder' => '{payout}'],
                'reward' => ['name' => 'points', 'placeholder' => '{reward}'],
                'offerName' => ['name' => 'offer_name', 'placeholder' => '{offerName}'],
                'offerId' => ['name' => 'offer_id', 'placeholder' => '{offerId}'],
                'status' => ['name' => 'status', 'placeholder' => '{status}'],
                'ip' => ['name' => 'ip_address', 'placeholder' => '{ip}'],
                'country' => ['name' => 'country', 'placeholder' => '{country}'],
                'extras' => [],
            ]),
            'postback_url' => 'https://example.com/api/offerwall-postback/surveywall',
            'postback_signature_required' => false,
            'postback_whitelist_ip_required' => false,
            'postback_whitelist_ips' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => 'Survey User',
            'username' => 'surveyuser',
            'email' => 'survey2@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'balance' => 0,
            'level' => 1,
            'referral_code' => 'DEF456',
            'referred_by' => null,
            'total_referred' => 0,
            'referral_earning' => 0,
            'email_verified_at' => now(),
            'password' => bcrypt('secret123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $approve = $this->get('/api/offerwall-postback/surveywall?player_id='.$userId.'&txid=tx-2001&payout=1.25&points=250&offer_name=Survey+Complete&offer_id=SV-1&status=approved&ip_address=8.8.4.4');
        $approve->assertOk()->assertContent('Ok');

        $completedTask = DB::table('completed_tasks')->where('transaction_id', 'tx-2001')->first();
        $this->assertNotNull($completedTask);
        $this->assertSame('United States', $completedTask->country);
    }

    public function test_offerwall_postback_returns_success_when_user_id_is_missing(): void
    {
        DB::table('offerwalls')->insert([
            'name' => 'Survey Partners',
            'badge' => null,
            'logo_url' => 'https://example.com/logo.png',
            'category' => 'survey',
            'iframe_url' => 'https://example.com/frame/',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'surveywall',
            'postback_parameters' => json_encode([
                'userId' => ['name' => 'player_id', 'placeholder' => '{userId}'],
                'transactionId' => ['name' => 'txid', 'placeholder' => '{transactionId}'],
                'revenue' => ['name' => 'payout', 'placeholder' => '{payout}'],
                'reward' => ['name' => 'points', 'placeholder' => '{reward}'],
                'offerName' => ['name' => 'offer_name', 'placeholder' => '{offerName}'],
                'offerId' => ['name' => 'offer_id', 'placeholder' => '{offerId}'],
                'status' => ['name' => 'status', 'placeholder' => '{status}'],
                'ip' => ['name' => 'ip_address', 'placeholder' => '{ip}'],
                'country' => ['name' => 'country', 'placeholder' => '{country}'],
                'extras' => [],
            ]),
            'postback_url' => 'https://example.com/api/offerwall-postback/surveywall',
            'postback_signature_required' => false,
            'postback_whitelist_ip_required' => false,
            'postback_whitelist_ips' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->get('/api/offerwall-postback/surveywall?txid=tx-3001&payout=1.25&points=250&offer_name=Survey+Complete&offer_id=SV-1&status=approved&ip_address=127.0.0.1&country=BD');

        $response->assertOk()->assertContent('Ok');
        $completedTask = DB::table('completed_tasks')->where('transaction_id', 'tx-3001')->first();
        $this->assertNotNull($completedTask);
        $this->assertSame(0, (int) $completedTask->user_id);
        $this->assertSame('anonymous', $completedTask->user_name);
        $this->assertFalse(DB::table('chargebacks')->where('transaction_id', 'tx-3001')->exists());
    }

    public function test_offerwall_postback_silently_acknowledges_invalid_parameters(): void
    {
        DB::table('offerwalls')->insert([
            'name' => 'Survey Partners',
            'badge' => null,
            'logo_url' => 'https://example.com/logo.png',
            'category' => 'survey',
            'iframe_url' => 'https://example.com/frame/',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'surveywall',
            'postback_parameters' => json_encode([
                'userId' => ['name' => 'user_id'],
                'transactionId' => ['name' => 'transaction_id'],
                'reward' => ['name' => 'reward_amount'],
                'offerId' => ['name' => 'offer_id'],
            ]),
            'postback_url' => 'https://example.com/api/offerwall-postback/surveywall',
            'postback_signature_required' => false,
            'postback_whitelist_ip_required' => false,
            'postback_whitelist_ips' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->get('/api/offerwall-postback/surveywall?event_id[]=invalid&user_id[]=invalid&offer_id[]=invalid&reward_amount[]=invalid');

        $response->assertOk()->assertContent('Ok');
    }

    public function test_cpalead_postback_converts_usd_payout_to_coins_correctly(): void
    {
        DB::table('offerwalls')->insert([
            'name' => 'CPALead',
            'badge' => null,
            'logo_url' => 'https://example.com/cpalead.png',
            'category' => 'offerwall',
            'iframe_url' => 'https://example.com/cpalead/frame',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'cpalead',
            'postback_parameters' => json_encode([
                'userId' => ['name' => 'subid', 'placeholder' => '{userId}'],
                'transactionId' => ['name' => 'transid', 'placeholder' => '{transactionId}'],
                'revenue' => ['name' => 'payout', 'placeholder' => '{payout}'],
                'offerName' => ['name' => 'campaign_name', 'placeholder' => '{offerName}'],
                'offerId' => ['name' => 'campaign_id', 'placeholder' => '{offerId}'],
                'ip' => ['name' => 'ip', 'placeholder' => '{ip}'],
                'country' => ['name' => 'country', 'placeholder' => '{country}'],
                'extras' => [],
            ]),
            'postback_url' => 'https://example.com/api/offerwall-postback/cpalead',
            'postback_signature_required' => false,
            'postback_whitelist_ip_required' => false,
            'postback_whitelist_ips' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => 'CPALead User',
            'username' => 'cpaleaduser',
            'email' => 'cpalead@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'United States',
            'balance' => 0,
            'level' => 1,
            'referral_code' => 'CPA123',
            'referred_by' => null,
            'total_referred' => 0,
            'referral_earning' => 0,
            'email_verified_at' => now(),
            'password' => bcrypt('secret123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->get('/api/offerwall-postback/cpalead?subid='.$userId.'&transid=cpa-tx-101&payout=0.47&campaign_name=Hero+Wars&campaign_id=987&ip=127.0.0.1&country=US');
        $response->assertOk()->assertContent('Ok');

        $completedTask = DB::table('completed_tasks')->where('transaction_id', 'cpa-tx-101')->first();
        $this->assertNotNull($completedTask);
        $this->assertSame(0.47, (float) $completedTask->revenue);
        $this->assertSame(470.0, (float) $completedTask->currency_reward);
        $this->assertSame(470.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        $timelineEntry = DB::table('timeline_entries')->where('task_id', '987')->first();
        $this->assertNotNull($timelineEntry);
        $this->assertSame(470.0, (float) $timelineEntry->currency_reward);

        $notification = DB::table('user_notifications')->where('user_id', $userId)->first();
        $this->assertNotNull($notification);
        $this->assertSame('You have received 470 coins from cpalead for Hero Wars', $notification->title);

        $transaction = DB::table('transactions')->where('transaction_id', 'cpa-tx-101')->first();
        $this->assertNotNull($transaction);
        $this->assertSame(470.0, (float) $transaction->amount);
    }

    public function test_vortex_postback_with_alias_slug_and_dynamic_parameters(): void
    {
        DB::table('offerwalls')->insert([
            'name' => 'Vortex',
            'logo_url' => 'https://example.com/vortex.png',
            'category' => 'offerwall',
            'iframe_url' => 'https://vortexwall.com/ow/123/{user_id}',
            'rating' => 5,
            'is_active' => true,
            'sort_order' => 1,
            'unlock_level' => 1,
            'postback_slug' => 'vortex',
            'postback_parameters' => json_encode([]),
            'postback_url' => 'https://example.com/api/offerwall-postback/vortex',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => 'Vortex Player',
            'username' => 'vortexplayer',
            'email' => 'vortex@example.com',
            'role' => 'user',
            'balance' => 0,
            'level' => 1,
            'referral_code' => 'VOR123',
            'password' => bcrypt('secret123'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 1. Postback to vortexwall alias with sub_id, event_id, status=1
        $response = $this->get('/api/offerwall-postback/vortexwall?sub_id='.$userId.'&event_id=vortex-tx-555&payout=0.35&reward=350&status=1&campaign_name=Prime+Video');
        $response->assertOk()->assertContent('Ok');

        $completedTask = DB::table('completed_tasks')->where('transaction_id', 'vortex-tx-555')->first();
        $this->assertNotNull($completedTask);
        $this->assertSame('vortex', $completedTask->offer_wall_name);
        $this->assertSame(350.0, (float) $completedTask->currency_reward);
        $this->assertSame(350.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        // 2. Postback to unseeded provider (e.g. clickwall)
        $response2 = $this->get('/api/offerwall-postback/clickwall?user_id='.$userId.'&txid=click-tx-777&payout=0.20&reward=200&status=approved&offer_name=App+Install');
        $response2->assertOk()->assertContent('Ok');

        $completedTask2 = DB::table('completed_tasks')->where('transaction_id', 'click-tx-777')->first();
        $this->assertNotNull($completedTask2);
        $this->assertSame('clickwall', $completedTask2->offer_wall_name);
        $this->assertSame(200.0, (float) $completedTask2->currency_reward);
        $this->assertSame(550.0, (float) DB::table('users')->where('id', $userId)->value('balance'));

        // 3. User resolution by username
        $response3 = $this->get('/api/offerwall-postback/vortex?user_id=vortexplayer&txid=vortex-tx-888&payout=0.15&reward=150&status=approved&offer_name=Survey');
        $response3->assertOk()->assertContent('Ok');

        $completedTask3 = DB::table('completed_tasks')->where('transaction_id', 'vortex-tx-888')->first();
        $this->assertNotNull($completedTask3);
        $this->assertSame($userId, (int) $completedTask3->user_id);
        $this->assertSame(700.0, (float) DB::table('users')->where('id', $userId)->value('balance'));
    }
}
