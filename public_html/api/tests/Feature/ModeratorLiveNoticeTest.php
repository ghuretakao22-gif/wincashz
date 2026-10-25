<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeratorLiveNoticeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (!Schema::hasTable('settings')) {
            Schema::create('settings', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('username')->unique();
                $table->string('email')->unique();
                $table->enum('role', ['admin', 'moderator', 'user'])->default('user');
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
        }

        Setting::query()->delete();
        User::query()->delete();
    }

    public function test_admin_can_get_and_save_moderator_notice(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_notice',
            'email' => 'admin_notice@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);

        // Default get (initial empty state)
        $initialRes = $this->actingAs($admin, 'api')
            ->getJson('/api/admin/moderator-notice');

        $initialRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.enabled', false);

        // Update notice
        $saveRes = $this->actingAs($admin, 'api')
            ->postJson('/api/admin/moderator-notice', [
                'enabled' => true,
                'headline' => 'Critical Server Maintenance Tonight',
                'text' => 'Please inform workers that offerwalls will undergo brief maintenance at 02:00 UTC.',
            ]);

        $saveRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.headline', 'Critical Server Maintenance Tonight')
            ->assertJsonPath('data.text', 'Please inform workers that offerwalls will undergo brief maintenance at 02:00 UTC.');

        $this->assertNotEmpty($saveRes->json('data.updated_at'));

        // Check settings table persistence
        $this->assertEquals('1', Setting::value('moderator_notice_enabled'));
        $this->assertEquals('Critical Server Maintenance Tonight', Setting::value('moderator_notice_headline'));
        $this->assertEquals('Please inform workers that offerwalls will undergo brief maintenance at 02:00 UTC.', Setting::value('moderator_notice_text'));
    }

    public function test_admin_can_toggle_enable_disable(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_toggle',
            'email' => 'admin_toggle@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);

        // Enable notice
        $this->actingAs($admin, 'api')
            ->postJson('/api/admin/moderator-notice', [
                'enabled' => true,
                'headline' => 'Active Notice',
                'text' => 'Notice body text',
            ])->assertStatus(200)
            ->assertJsonPath('data.enabled', true);

        // Disable notice
        $disableRes = $this->actingAs($admin, 'api')
            ->postJson('/api/admin/moderator-notice', [
                'enabled' => false,
                'headline' => 'Active Notice',
                'text' => 'Notice body text',
            ]);

        $disableRes->assertStatus(200)
            ->assertJsonPath('data.enabled', false);

        $this->assertFalse(Setting::boolean('moderator_notice_enabled'));
    }

    public function test_moderator_can_read_notice_when_enabled(): void
    {
        Setting::setBoolean('moderator_notice_enabled', true);
        Setting::setValue('moderator_notice_headline', 'Payout Rate Increase');
        Setting::setValue('moderator_notice_text', 'All Prime Video tasks will now earn $0.80 per offer.');
        Setting::setValue('moderator_notice_updated_at', '2026-10-25T12:00:00Z');

        $moderator = User::create([
            'name' => 'Mod User',
            'username' => 'mod_live',
            'email' => 'mod_live@example.com',
            'role' => 'moderator',
            'password' => bcrypt('password123'),
        ]);

        $res = $this->actingAs($moderator, 'api')
            ->getJson('/api/moderator/notice');

        $res->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.headline', 'Payout Rate Increase')
            ->assertJsonPath('data.text', 'All Prime Video tasks will now earn $0.80 per offer.')
            ->assertJsonPath('data.updated_at', '2026-10-25T12:00:00Z');
    }

    public function test_moderator_receives_empty_notice_when_disabled(): void
    {
        Setting::setBoolean('moderator_notice_enabled', false);
        Setting::setValue('moderator_notice_headline', 'Old Notice');
        Setting::setValue('moderator_notice_text', 'Old Text');
        Setting::setValue('moderator_notice_updated_at', '2026-10-20T10:00:00Z');

        $moderator = User::create([
            'name' => 'Mod User 2',
            'username' => 'mod_disabled',
            'email' => 'mod_disabled@example.com',
            'role' => 'moderator',
            'password' => bcrypt('password123'),
        ]);

        $res = $this->actingAs($moderator, 'api')
            ->getJson('/api/moderator/notice');

        $res->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.headline', '')
            ->assertJsonPath('data.text', '');
    }

    public function test_normal_user_cannot_access_moderator_or_admin_notice(): void
    {
        Setting::setBoolean('moderator_notice_enabled', true);
        Setting::setValue('moderator_notice_headline', 'Confidential Moderator Notice');
        Setting::setValue('moderator_notice_text', 'Secret instructions for My ID owners.');

        $normalUser = User::create([
            'name' => 'Normal User',
            'username' => 'regular_worker',
            'email' => 'regular@example.com',
            'role' => 'user',
            'password' => bcrypt('password123'),
        ]);

        // Normal user trying to access moderator notice -> 403 Forbidden
        $modRes = $this->actingAs($normalUser, 'api')
            ->getJson('/api/moderator/notice');
        $modRes->assertStatus(403);

        // Normal user trying to access admin notice -> 403 Forbidden
        $adminRes = $this->actingAs($normalUser, 'api')
            ->getJson('/api/admin/moderator-notice');
        $adminRes->assertStatus(403);

        // Unauthenticated access -> rejected (401 or 403)
        $guestRes = $this->getJson('/api/moderator/notice');
        $this->assertTrue(in_array($guestRes->status(), [401, 403], true));
    }

    public function test_admin_update_updates_timestamp_for_dismissal_refresh(): void
    {
        $admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin_ts',
            'email' => 'admin_ts@example.com',
            'role' => 'admin',
            'password' => bcrypt('password123'),
        ]);

        $res1 = $this->actingAs($admin, 'api')
            ->postJson('/api/admin/moderator-notice', [
                'enabled' => true,
                'headline' => 'Notice v1',
                'text' => 'Content v1',
            ]);
        $res1->assertStatus(200);
        $ts1 = $res1->json('data.updated_at');

        // Sleep briefly to ensure timestamp difference
        Carbon::setTestNow(Carbon::now()->addSeconds(2));

        $res2 = $this->actingAs($admin, 'api')
            ->postJson('/api/admin/moderator-notice', [
                'enabled' => true,
                'headline' => 'Notice v2 Updated',
                'text' => 'Content v2 with new instructions',
            ]);
        $res2->assertStatus(200);
        $ts2 = $res2->json('data.updated_at');

        $this->assertNotEquals($ts1, $ts2);
        $this->assertEquals('Notice v2 Updated', Setting::value('moderator_notice_headline'));
    }
}
