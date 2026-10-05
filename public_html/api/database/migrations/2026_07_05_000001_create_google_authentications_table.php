<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('google_authentications')) {
            return;
        }

        Schema::create('google_authentications', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->string('client_id')->nullable();
            $table->longText('client_secret')->nullable();
            $table->timestamps();
        });

        DB::table('google_authentications')->insert([
            'enabled' => false,
            'client_id' => null,
            'client_secret' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('google_authentications');
    }
};
