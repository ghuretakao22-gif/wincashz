<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TimelineAvatarResolutionTest extends TestCase
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

        Schema::create('transactions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
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
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('timeline_entries');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_timeline_api_resolves_avatar_from_linked_user(): void
    {
        $userId = DB::table('users')->insertGetId([
            'name' => 'Timeline User',
            'username' => 'timelineuser',
            'email' => 'timeline@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'balance' => 0,
            'level' => 1,
            'ban' => false,
            'profile_setup_completed' => true,
            'user_avatar' => 'https://api.dicebear.com/10.x/avataaars/svg?seed=timelineuser',
            'email_verified_at' => now(),
            'password' => bcrypt('Password123!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $timelineId = DB::table('timeline_entries')->insertGetId([
            'user_id' => $userId,
            'user_name' => 'timelineuser',
            'user_avatar' => null,
            'offer_wall_name' => 'surveywall',
            'offer_name' => 'Survey Complete',
            'task_id' => 'task-1',
            'currency_reward' => 125.00,
            'type' => 'completed_task',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $timelineResponse = $this->getJson('/api/timeline?limit=50');

        $timelineResponse->assertOk();
        $timelineResponse->assertJsonPath('rows.0.userAvatar', 'https://api.dicebear.com/10.x/avataaars/svg?seed=timelineuser');

        $detailsResponse = $this->getJson('/api/timeline/'.$timelineId.'/details');

        $detailsResponse->assertOk();
        $detailsResponse->assertJsonPath('selected.userAvatar', 'https://api.dicebear.com/10.x/avataaars/svg?seed=timelineuser');
        $detailsResponse->assertJsonPath('user.userAvatar', 'https://api.dicebear.com/10.x/avataaars/svg?seed=timelineuser');
    }

    public function test_timeline_api_falls_back_to_dicebear_when_avatar_is_missing(): void
    {
        $userId = DB::table('users')->insertGetId([
            'name' => 'Fallback Timeline User',
            'username' => 'fallbacktimeline',
            'email' => 'fallbacktimeline@example.com',
            'role' => 'user',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'balance' => 0,
            'level' => 1,
            'ban' => false,
            'profile_setup_completed' => false,
            'user_avatar' => null,
            'email_verified_at' => now(),
            'password' => bcrypt('Password123!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('timeline_entries')->insert([
            'user_id' => $userId,
            'user_name' => 'fallbacktimeline',
            'user_avatar' => null,
            'offer_wall_name' => 'surveywall',
            'offer_name' => 'Survey Complete',
            'task_id' => 'task-2',
            'currency_reward' => 150.00,
            'type' => 'completed_task',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/timeline?limit=50');

        $response->assertOk();
        $response->assertJsonPath('rows.0.userAvatar', 'https://api.dicebear.com/10.x/avataaars/svg?seed=fallbacktimeline');
    }
}
