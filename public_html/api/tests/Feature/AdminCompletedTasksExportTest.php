<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminCompletedTasksExportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->string('username')->nullable()->unique();
            $table->string('email')->nullable();
            $table->string('role')->default('user');
            $table->string('my_id')->nullable();
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

        Schema::create('my_id_earnings', function (Blueprint $table): void {
            $table->id();
            $table->string('my_id_code')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('completed_task_id')->unique();
            $table->string('provider');
            $table->string('offer_id')->nullable();
            $table->string('offer_name')->nullable();
            $table->decimal('coin_amount', 14, 4);
            $table->decimal('payout_usd', 14, 4);
            $table->decimal('usd_bdt_rate', 10, 2);
            $table->decimal('payout_bdt', 14, 4);
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('my_id_earnings');
        Schema::dropIfExists('completed_tasks');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_export_header_row_contains_username_and_coin_and_no_revenue_column(): void
    {
        $this->withoutMiddleware();

        $response = $this->get('/api/admin/completed-tasks/export?format=csv');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $response->getContent();
        $firstLine = strtok($csv, "\r\n");

        // Strip UTF-8 BOM if present
        $cleanFirstLine = preg_replace('/^\xEF\xBB\xBF/', '', $firstLine);
        $headers = str_getcsv($cleanFirstLine);

        // Header assertions
        $this->assertContains('Username', $headers);
        $this->assertContains('Coin', $headers);
        $this->assertContains('Payout USD', $headers);
        $this->assertContains('Payout BDT', $headers);

        // Strict revenue exclusion assertion
        $this->assertNotContains('Revenue', $headers);
        $this->assertNotContains('Site Revenue', $headers);
        $this->assertNotContains('Site Revenue ($)', $headers);
        $this->assertNotContains('Offer Value', $headers);
        $this->assertNotContains('Offer Value ($)', $headers);
        $this->assertNotContains('site_revenue', $headers);
        $this->assertNotContains('revenue', $headers);
    }

    public function test_known_completed_task_row_exports_correct_username_and_correct_coin_value(): void
    {
        $this->withoutMiddleware();

        // Target user
        $userId = DB::table('users')->insertGetId([
            'name' => 'Alice Johnson',
            'username' => 'alice_wonder',
            'email' => 'alice@example.com',
            'my_id' => 'VIP77',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $taskId = DB::table('completed_tasks')->insertGetId([
            'offer_wall_name' => 'Torox',
            'user_id' => $userId,
            'user_name' => 'alice_wonder',
            'transaction_id' => 'TX-TOROX-999',
            'offer_name' => 'Hero Wars Level 10',
            'offer_id' => 'HW-101',
            'revenue' => 4.50,
            'currency_reward' => 450.00,
            'ip' => '103.20.10.5',
            'country' => 'Bangladesh',
            'created_at' => '2026-10-15 14:30:00',
            'updated_at' => '2026-10-15 14:30:00',
        ]);

        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'VIP77',
            'user_id' => $userId,
            'completed_task_id' => $taskId,
            'provider' => 'Torox',
            'offer_id' => 'HW-101',
            'offer_name' => 'Hero Wars Level 10',
            'coin_amount' => 450.00,
            'payout_usd' => 1.25,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 152.50,
            'completed_at' => '2026-10-15 14:30:00',
            'created_at' => '2026-10-15 14:30:00',
            'updated_at' => '2026-10-15 14:30:00',
        ]);

        $response = $this->get('/api/admin/completed-tasks/export?format=csv');
        $response->assertOk();

        $csv = $response->getContent();
        $this->assertStringContainsString('alice_wonder', $csv);
        $this->assertStringContainsString('450', $csv);
        $this->assertStringContainsString('VIP77', $csv);
        $this->assertStringContainsString('TX-TOROX-999', $csv);
    }

    public function test_month_filter_exports_only_rows_inside_that_utc_month(): void
    {
        $this->withoutMiddleware();

        $userId = DB::table('users')->insertGetId([
            'name' => 'Bob User',
            'username' => 'bob_october',
            'email' => 'bob@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // October task (in range)
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'Offery',
            'user_id' => $userId,
            'user_name' => 'bob_october',
            'transaction_id' => 'TX-OCTOBER',
            'offer_name' => 'October Survey',
            'offer_id' => 'OCT-1',
            'revenue' => 1.00,
            'currency_reward' => 100.00,
            'ip' => '127.0.0.1',
            'country' => 'US',
            'created_at' => '2026-10-10 10:00:00',
            'updated_at' => '2026-10-10 10:00:00',
        ]);

        // September task (out of range)
        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'Offery',
            'user_id' => $userId,
            'user_name' => 'bob_october',
            'transaction_id' => 'TX-SEPTEMBER',
            'offer_name' => 'September Survey',
            'offer_id' => 'SEP-1',
            'revenue' => 2.00,
            'currency_reward' => 200.00,
            'ip' => '127.0.0.1',
            'country' => 'US',
            'created_at' => '2026-09-28 23:59:59',
            'updated_at' => '2026-09-28 23:59:59',
        ]);

        $response = $this->get('/api/admin/completed-tasks/export?format=csv&month=2026-10');
        $response->assertOk();

        $csv = $response->getContent();
        $this->assertStringContainsString('TX-OCTOBER', $csv);
        $this->assertStringNotContainsString('TX-SEPTEMBER', $csv);
    }

    public function test_provider_and_search_filter_exports_only_matching_rows(): void
    {
        $this->withoutMiddleware();

        $userId = DB::table('users')->insertGetId([
            'name' => 'Charlie Day',
            'username' => 'charlie_d',
            'email' => 'charlie@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'Lootably',
            'user_id' => $userId,
            'user_name' => 'charlie_d',
            'transaction_id' => 'TX-LOOT-1',
            'offer_name' => 'Match 3 Mania',
            'offer_id' => 'M3-1',
            'revenue' => 3.00,
            'currency_reward' => 300.00,
            'ip' => '127.0.0.1',
            'country' => 'CA',
            'created_at' => '2026-10-20 12:00:00',
            'updated_at' => '2026-10-20 12:00:00',
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'AdGate',
            'user_id' => $userId,
            'user_name' => 'charlie_d',
            'transaction_id' => 'TX-ADGATE-1',
            'offer_name' => 'Candy Crush Quest',
            'offer_id' => 'CC-1',
            'revenue' => 5.00,
            'currency_reward' => 500.00,
            'ip' => '127.0.0.1',
            'country' => 'CA',
            'created_at' => '2026-10-20 12:00:00',
            'updated_at' => '2026-10-20 12:00:00',
        ]);

        // Filter by wall Lootably
        $wallRes = $this->get('/api/admin/completed-tasks/export?format=csv&wall=Lootably');
        $wallRes->assertOk();
        $wallCsv = $wallRes->getContent();
        $this->assertStringContainsString('TX-LOOT-1', $wallCsv);
        $this->assertStringNotContainsString('TX-ADGATE-1', $wallCsv);

        // Search by offer name
        $searchRes = $this->get('/api/admin/completed-tasks/export?format=csv&search=Candy+Crush');
        $searchRes->assertOk();
        $searchCsv = $searchRes->getContent();
        $this->assertStringContainsString('TX-ADGATE-1', $searchCsv);
        $this->assertStringNotContainsString('TX-LOOT-1', $searchCsv);
    }

    public function test_xlsx_export_produces_valid_openxml_with_username_and_numeric_coins(): void
    {
        $this->withoutMiddleware();

        $userId = DB::table('users')->insertGetId([
            'name' => 'David Miller',
            'username' => 'david_excel',
            'email' => 'david@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('completed_tasks')->insert([
            'offer_wall_name' => 'Offery',
            'user_id' => $userId,
            'user_name' => 'david_excel',
            'transaction_id' => 'TX-EXCEL-001',
            'offer_name' => 'Mega Survey',
            'offer_id' => 'MS-10',
            'revenue' => 10.00,
            'currency_reward' => 1000.00,
            'ip' => '1.2.3.4',
            'country' => 'UK',
            'created_at' => '2026-10-22 15:00:00',
            'updated_at' => '2026-10-22 15:00:00',
        ]);

        $response = $this->get('/api/admin/completed-tasks/export');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $content = $response->getContent();
        $tempFile = tempnam(sys_get_temp_dir(), 'test_admin_xlsx_');
        file_put_contents($tempFile, $content);

        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tempFile) === true, 'Failed to open exported XLSX ZIP');

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        @unlink($tempFile);

        $this->assertNotEmpty($sheetXml);
        $this->assertStringContainsString('Username', $sheetXml);
        $this->assertStringContainsString('Coin', $sheetXml);
        $this->assertStringContainsString('david_excel', $sheetXml);
        // Numeric cell for coin
        $this->assertStringContainsString('<c><v>1000</v></c>', $sheetXml);
        // Strict revenue exclusion
        $this->assertStringNotContainsString('Site Revenue', $sheetXml);
        $this->assertStringNotContainsString('Offer Value', $sheetXml);
    }

    public function test_moderator_triggered_export_contains_only_that_moderator_my_id_rows(): void
    {
        $this->withoutMiddleware();

        $modUser = new User();
        $modUser->id = 501;
        $modUser->role = 'moderator';
        $modUser->my_id = 'VIP_MOD_99';
        $modUser->email = 'mod99@example.com';
        $modUser->username = 'moderator_99';

        $worker1Id = DB::table('users')->insertGetId([
            'username' => 'worker_team_99',
            'email' => 'worker1@example.com',
            'my_id' => 'VIP_MOD_99',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $worker2Id = DB::table('users')->insertGetId([
            'username' => 'worker_other_team',
            'email' => 'worker2@example.com',
            'my_id' => 'OTHER_TEAM_12',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Earning for VIP_MOD_99
        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'VIP_MOD_99',
            'user_id' => $worker1Id,
            'completed_task_id' => 101,
            'provider' => 'Torox',
            'offer_id' => 'OFF-99',
            'offer_name' => 'Team 99 Special',
            'coin_amount' => 500.00,
            'payout_usd' => 2.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 244.00,
            'completed_at' => '2026-10-25 10:00:00',
            'created_at' => '2026-10-25 10:00:00',
            'updated_at' => '2026-10-25 10:00:00',
        ]);

        // Earning for OTHER_TEAM_12
        DB::table('my_id_earnings')->insert([
            'my_id_code' => 'OTHER_TEAM_12',
            'user_id' => $worker2Id,
            'completed_task_id' => 102,
            'provider' => 'Torox',
            'offer_id' => 'OFF-12',
            'offer_name' => 'Team 12 Secret',
            'coin_amount' => 800.00,
            'payout_usd' => 3.00,
            'usd_bdt_rate' => 122.00,
            'payout_bdt' => 366.00,
            'completed_at' => '2026-10-25 11:00:00',
            'created_at' => '2026-10-25 11:00:00',
            'updated_at' => '2026-10-25 11:00:00',
        ]);

        $response = $this->actingAs($modUser, 'api')
            ->get('/api/moderator/completed-offers/export?format=csv');

        $response->assertOk();
        $csv = $response->getContent();

        // Must contain team 99 data
        $this->assertStringContainsString('VIP_MOD_99', $csv);
        $this->assertStringContainsString('worker_team_99', $csv);
        $this->assertStringContainsString('500', $csv);

        // Must NEVER contain other team data
        $this->assertStringNotContainsString('OTHER_TEAM_12', $csv);
        $this->assertStringNotContainsString('worker_other_team', $csv);
        $this->assertStringNotContainsString('Team 12 Secret', $csv);

        // Strictly NO revenue columns
        $this->assertStringNotContainsString('Site Revenue', $csv);
        $this->assertStringNotContainsString('Offer Value', $csv);
    }
}
