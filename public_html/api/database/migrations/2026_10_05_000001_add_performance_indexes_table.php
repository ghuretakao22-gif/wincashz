<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the performance index migrations.
     */
    public function up(): void
    {
        // 1. completed_tasks
        if (Schema::hasTable('completed_tasks')) {
            Schema::table('completed_tasks', function (Blueprint $table): void {
                $table->index('user_name', 'completed_tasks_user_name_index');
                $table->index(['user_id', 'user_name'], 'completed_tasks_user_id_user_name_index');
            });
        }

        // 2. transactions
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table): void {
                $table->index('status', 'transactions_status_index');
                $table->index('reference_id', 'transactions_reference_id_index');
                $table->index(['user_id', 'type'], 'transactions_user_id_type_index');
                $table->index(['user_id', 'type', 'status'], 'transactions_user_id_type_status_index');
            });
        }

        // 3. timeline_entries
        if (Schema::hasTable('timeline_entries')) {
            Schema::table('timeline_entries', function (Blueprint $table): void {
                $table->index('created_at', 'timeline_entries_created_at_index');
                $table->index(['user_id', 'created_at'], 'timeline_entries_user_id_created_at_index');
            });
        }

        // 4. user_notifications
        if (Schema::hasTable('user_notifications')) {
            Schema::table('user_notifications', function (Blueprint $table): void {
                $table->index('created_at', 'user_notifications_created_at_index');
            });
        }

        // 5. users
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->index('role', 'users_role_index');
                $table->index(['role', 'ban'], 'users_role_ban_index');
                $table->index('ip', 'users_ip_index');
                $table->index('country', 'users_country_index');
            });
        }
    }

    /**
     * Reverse the performance index migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropIndex('users_country_index');
                $table->dropIndex('users_ip_index');
                $table->dropIndex('users_role_ban_index');
                $table->dropIndex('users_role_index');
            });
        }

        if (Schema::hasTable('user_notifications')) {
            Schema::table('user_notifications', function (Blueprint $table): void {
                $table->dropIndex('user_notifications_created_at_index');
            });
        }

        if (Schema::hasTable('timeline_entries')) {
            Schema::table('timeline_entries', function (Blueprint $table): void {
                $table->dropIndex('timeline_entries_user_id_created_at_index');
                $table->dropIndex('timeline_entries_created_at_index');
            });
        }

        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table): void {
                $table->dropIndex('transactions_user_id_type_status_index');
                $table->dropIndex('transactions_user_id_type_index');
                $table->dropIndex('transactions_reference_id_index');
                $table->dropIndex('transactions_status_index');
            });
        }

        if (Schema::hasTable('completed_tasks')) {
            Schema::table('completed_tasks', function (Blueprint $table): void {
                $table->dropIndex('completed_tasks_user_id_user_name_index');
                $table->dropIndex('completed_tasks_user_name_index');
            });
        }
    }
};
