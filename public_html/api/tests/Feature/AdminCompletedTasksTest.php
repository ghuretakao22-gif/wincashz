<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminCompletedTasksTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

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

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('email')->unique();
            $table->string('ip')->nullable();
            $table->string('country')->nullable();
            $table->string('user_avatar')->nullable();
            $table->boolean('profile_setup_completed')->default(false);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_completed_tasks_endpoint_paginates_ten_rows_at_a_time(): void
    {
        $this->withoutMiddleware();

        foreach (range(1, 12) as $index) {
            DB::table('users')->insert([
                'id' => 1000 + $index,
                'email' => 'user'.$index.'@example.com',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('completed_tasks')->insert([
                'offer_wall_name' => 'surveywall',
                'user_id' => 1000 + $index,
                'user_name' => 'user'.$index,
                'transaction_id' => 'task-'.$index,
                'offer_name' => 'Offer '.$index,
                'offer_id' => 'O-'.$index,
                'revenue' => 1.25,
                'currency_reward' => 250.00,
                'ip' => '127.0.0.1',
                'country' => 'Bangladesh',
                'created_at' => now()->subMinutes(12 - $index),
                'updated_at' => now()->subMinutes(12 - $index),
            ]);
        }

        $response = $this->getJson('/api/admin/completed-tasks?page=1');

        $response->assertOk();
        $response->assertJsonCount(10, 'rows');
        $response->assertJsonPath('rows.0.payout', '1.25');
        $response->assertJsonPath('rows.0.userEmail', 'user12@example.com');
        $response->assertJson([
            'pagination' => [
                'currentPage' => 1,
                'lastPage' => 2,
                'perPage' => 10,
                'total' => 12,
                'from' => 1,
                'to' => 10,
            ],
        ]);

        $secondPage = $this->getJson('/api/admin/completed-tasks?page=2');
        $secondPage->assertOk();
        $secondPage->assertJsonCount(2, 'rows');
        $secondPage->assertJson([
            'pagination' => [
                'currentPage' => 2,
                'lastPage' => 2,
                'perPage' => 10,
                'total' => 12,
                'from' => 11,
                'to' => 12,
            ],
        ]);
    }

    public function test_completed_tasks_endpoint_supports_custom_page_sizes_and_all(): void
    {
        $this->withoutMiddleware();

        foreach (range(1, 12) as $index) {
            DB::table('users')->insert([
                'id' => 2000 + $index,
                'email' => 'page-user'.$index.'@example.com',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('completed_tasks')->insert([
                'offer_wall_name' => 'surveywall',
                'user_id' => 2000 + $index,
                'user_name' => 'page-user'.$index,
                'transaction_id' => 'page-task-'.$index,
                'offer_name' => 'Page Offer '.$index,
                'offer_id' => 'P-'.$index,
                'revenue' => 4.25,
                'currency_reward' => 875.00,
                'ip' => '127.0.1.'.$index,
                'country' => 'Bangladesh',
                'created_at' => now()->subSeconds(12 - $index),
                'updated_at' => now()->subSeconds(12 - $index),
            ]);
        }

        $response = $this->getJson('/api/admin/completed-tasks?page=1&per_page=20');

        $response->assertOk();
        $response->assertJsonCount(12, 'rows');
        $response->assertJsonPath('rows.0.userEmail', 'page-user12@example.com');
        $response->assertJsonPath('pagination.perPage', 20);
        $response->assertJsonPath('pagination.lastPage', 1);
        $response->assertJsonPath('pagination.from', 1);
        $response->assertJsonPath('pagination.to', 12);

        $allResponse = $this->getJson('/api/admin/completed-tasks?page=1&per_page=all');

        $allResponse->assertOk();
        $allResponse->assertJsonCount(12, 'rows');
        $allResponse->assertJsonPath('pagination.perPage', 12);
        $allResponse->assertJsonPath('pagination.lastPage', 1);
        $allResponse->assertJsonPath('pagination.from', 1);
        $allResponse->assertJsonPath('pagination.to', 12);
    }

    public function test_completed_tasks_endpoint_supports_keyword_search(): void
    {
        $this->withoutMiddleware();

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'surveywall',
            'user_id' => 1001,
            'user_name' => 'alpha-user',
            'transaction_id' => 'task-alpha',
            'offer_name' => 'Alpha Offer',
            'offer_id' => 'A-1',
            'revenue' => 1.25,
            'currency_reward' => 250.00,
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => 1001,
            'email' => 'alpha@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'surveywall',
            'user_id' => 1002,
            'user_name' => 'needle-user',
            'transaction_id' => 'needle-transaction',
            'offer_name' => 'Keyword Offer',
            'offer_id' => 'K-1',
            'revenue' => 2.25,
            'currency_reward' => 500.00,
            'ip' => '127.0.0.2',
            'country' => 'India',
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);

        DB::table('users')->insert([
            'id' => 1002,
            'email' => 'needle@example.com',
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);

        $response = $this->getJson('/api/admin/completed-tasks?page=1&search=needle');

        $response->assertOk();
        $response->assertJsonCount(1, 'rows');
        $response->assertJsonPath('rows.0.transactionId', 'needle-transaction');
        $response->assertJsonPath('rows.0.userEmail', 'needle@example.com');
        $response->assertJsonPath('rows.0.payout', '2.25');
        $response->assertJsonPath('pagination.total', 1);
    }

    public function test_completed_tasks_endpoint_supports_ip_search_without_ambiguity(): void
    {
        $this->withoutMiddleware();

        DB::table('users')->insert([
            'id' => 1001,
            'email' => 'alpha@example.com',
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'surveywall',
            'user_id' => 1001,
            'user_name' => 'alpha-user',
            'transaction_id' => 'task-alpha',
            'offer_name' => 'Alpha Offer',
            'offer_id' => 'A-1',
            'revenue' => 1.25,
            'currency_reward' => 250.00,
            'ip' => '127.0.0.1',
            'country' => 'Bangladesh',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/admin/completed-tasks?page=1&search=127.0.0.1');

        $response->assertOk();
        $response->assertJsonCount(1, 'rows');
        $response->assertJsonPath('rows.0.ip', '127.0.0.1');
        $response->assertJsonPath('rows.0.userEmail', 'alpha@example.com');
        $response->assertJsonPath('pagination.total', 1);
    }

    public function test_completed_tasks_endpoint_deletes_a_row(): void
    {
        $this->withoutMiddleware();

        $taskId = DB::table('completed_tasks')->insertGetId([
            'offer_wall_name' => 'surveywall',
            'user_id' => 1003,
            'user_name' => 'delete-user',
            'transaction_id' => 'delete-me',
            'offer_name' => 'Delete Offer',
            'offer_id' => 'D-1',
            'revenue' => 3.25,
            'currency_reward' => 750.00,
            'ip' => '127.0.0.3',
            'country' => 'Bangladesh',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => 1003,
            'email' => 'delete-user@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson('/api/admin/completed-tasks/'.$taskId);

        $response->assertOk();
        $response->assertJsonPath('message', 'Completed task deleted successfully.');
        $this->assertFalse(DB::table('completed_tasks')->where('id', $taskId)->exists());
    }

    public function test_month_selection_auto_shows_all_records_without_page_size_cap(): void
    {
        $this->withoutMiddleware();

        // Insert 35 records for October 2026
        foreach (range(1, 35) as $i) {
            DB::table('completed_tasks')->insert([
                'offer_wall_name' => 'Torox',
                'user_id' => 101,
                'user_name' => 'oct_user_'.$i,
                'transaction_id' => 'TX-OCT-'.$i,
                'offer_name' => 'Offer '.$i,
                'offer_id' => 'OFF-'.$i,
                'revenue' => 1.00,
                'currency_reward' => 200.00,
                'created_at' => '2026-10-15 12:00:00',
            ]);
        }

        // Without passing per_page, or passing default per_page=25, selecting month automatically returns all 35 records
        $response = $this->getJson('/api/admin/completed-tasks?month=2026-10');
        $response->assertOk();
        $response->assertJsonCount(35, 'rows');
        $response->assertJsonPath('pagination.total', 35);
    }

    public function test_search_field_rules_distinguishes_user_prefix_and_non_user_substring(): void
    {
        $this->withoutMiddleware();

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'Torox Offerwall',
            'user_id' => 101,
            'user_name' => 'zahidul',
            'transaction_id' => 'TX-987654321',
            'offer_name' => 'Install TikTok App and Register',
            'offer_id' => 'OFF-TIKTOK',
            'created_at' => '2026-10-16 10:00:00',
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'CPALead Network',
            'user_id' => 102,
            'user_name' => 'rezaul',
            'transaction_id' => 'TX-111222333',
            'offer_name' => 'Play Monopoly',
            'offer_id' => 'OFF-MONO',
            'created_at' => '2026-10-16 11:00:00',
        ]);

        // 1. User search: 'za' matches 'zahidul', excludes 'rezaul'
        $resUser = $this->getJson('/api/admin/completed-tasks?search=za');
        $resUser->assertOk();
        $resUser->assertJsonCount(1, 'rows');
        $resUser->assertJsonPath('rows.0.userName', 'zahidul');

        // 2. Provider substring search: 'Offerwall' matches 'Torox Offerwall'
        $resProvider = $this->getJson('/api/admin/completed-tasks?search=Offerwall');
        $resProvider->assertOk();
        $resProvider->assertJsonCount(1, 'rows');
        $resProvider->assertJsonPath('rows.0.offerWall', 'Torox Offerwall');

        // 3. Offer keyword search: 'TikTok' matches 'Install TikTok App and Register'
        $resOffer = $this->getJson('/api/admin/completed-tasks?search=TikTok');
        $resOffer->assertOk();
        $resOffer->assertJsonCount(1, 'rows');
        $resOffer->assertJsonPath('rows.0.offerName', 'Install TikTok App and Register');

        // 4. Transaction ID substring search: '987654321' matches 'TX-987654321'
        $resTx = $this->getJson('/api/admin/completed-tasks?search=987654321');
        $resTx->assertOk();
        $resTx->assertJsonCount(1, 'rows');
        $resTx->assertJsonPath('rows.0.transactionId', 'TX-987654321');
    }
}
