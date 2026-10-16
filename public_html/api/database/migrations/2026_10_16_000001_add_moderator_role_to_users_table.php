<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin', 'moderator', 'user') NOT NULL DEFAULT 'user'");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::table('users')->where('role', 'moderator')->update(['role' => 'user']);
                DB::statement("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user'");
            }
        }
    }
};
