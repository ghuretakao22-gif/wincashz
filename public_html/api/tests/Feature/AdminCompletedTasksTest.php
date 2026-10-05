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
}
