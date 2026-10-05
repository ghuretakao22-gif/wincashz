<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TimelineSettingsTest extends TestCase
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
        Schema::dropIfExists('settings');

        parent::tearDown();
    }

    public function test_timeline_endpoint_is_enabled_by_default(): void
    {
        DB::table('timeline_entries')->insert([
            'user_id' => 1001,
            'user_name' => 'timeline-user',
            'user_avatar' => null,
            'offer_wall_name' => 'surveywall',
            'offer_name' => 'Survey Complete',
            'task_id' => 'task-1',
            'currency_reward' => 250.00,
            'type' => 'completed_task',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/timeline?limit=50');

        $response->assertOk();
        $response->assertJsonPath('enabled', true);
        $response->assertJsonCount(1, 'rows');
    }

    public function test_timeline_endpoint_hides_rows_when_disabled(): void
    {
        DB::table('settings')->insert([
            'name' => 'timeline_enabled',
            'value' => '0',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('timeline_entries')->insert([
            'user_id' => 1002,
            'user_name' => 'hidden-user',
            'user_avatar' => null,
            'offer_wall_name' => 'surveywall',
            'offer_name' => 'Hidden Survey',
            'task_id' => 'task-2',
            'currency_reward' => 300.00,
            'type' => 'completed_task',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/timeline?limit=50');

        $response->assertOk();
        $response->assertJsonPath('enabled', false);
        $response->assertJsonCount(0, 'rows');
    }

    public function test_admin_can_toggle_the_timeline_setting(): void
    {
        $this->withoutMiddleware();

        $response = $this->patchJson('/api/admin/settings/timeline', [
            'enabled' => false,
        ]);

        $response->assertOk();
        $response->assertJsonPath('settings.timelineEnabled', false);
        $this->assertDatabaseHas('settings', [
            'name' => 'timeline_enabled',
            'value' => '0',
        ]);
    }
}
