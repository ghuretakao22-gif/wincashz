<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'user_avatar')) {
                $table->string('user_avatar')->nullable()->after('google_avatar');
            }

            if (! Schema::hasColumn('users', 'profile_setup_completed')) {
                $table->boolean('profile_setup_completed')->default(false)->after('user_avatar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'profile_setup_completed')) {
                $table->dropColumn('profile_setup_completed');
            }

            if (Schema::hasColumn('users', 'user_avatar')) {
                $table->dropColumn('user_avatar');
            }
        });
    }
};
