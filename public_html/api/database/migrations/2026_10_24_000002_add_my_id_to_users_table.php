<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'my_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('my_id')->nullable()->after('role')->index();
                $table->foreign('my_id')->references('my_id_code')->on('my_ids')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'my_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['my_id']);
                $table->dropColumn('my_id');
            });
        }
    }
};
