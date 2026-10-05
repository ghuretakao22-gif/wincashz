<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $columns = [];

        if (Schema::hasColumn('offerwalls', 'postback_signature_parameter')) {
            $columns[] = 'postback_signature_parameter';
        }

        if (Schema::hasColumn('offerwalls', 'postback_signature_secret')) {
            $columns[] = 'postback_signature_secret';
        }

        if ($columns === []) {
            return;
        }

        Schema::table('offerwalls', function (Blueprint $table) use ($columns): void {
            $table->dropColumn($columns);
        });
    }

    public function down(): void
    {
        Schema::table('offerwalls', function (Blueprint $table): void {
            if (! Schema::hasColumn('offerwalls', 'postback_signature_parameter')) {
                $table->string('postback_signature_parameter', 120)->nullable()->after('postback_slug');
            }

            if (! Schema::hasColumn('offerwalls', 'postback_signature_secret')) {
                $table->text('postback_signature_secret')->nullable()->after('postback_signature_parameter');
            }
        });
    }
};
