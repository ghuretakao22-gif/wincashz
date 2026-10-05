<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

#[Fillable([
    'enabled',
    'client_id',
    'client_secret',
])]
class GoogleAuthentication extends Model
{
    use HasFactory;

    protected $casts = [
        'enabled' => 'boolean',
    ];

    public static function current(): self
    {
        if (! Schema::hasTable('google_authentications')) {
            return new static([
                'enabled' => false,
                'client_id' => null,
                'client_secret' => null,
            ]);
        }

        $record = static::query()->first();

        if ($record) {
            return $record;
        }

        return static::query()->create([
            'enabled' => false,
            'client_id' => null,
            'client_secret' => null,
        ]);
    }

    public static function isEnabled(): bool
    {
        return Schema::hasTable('google_authentications') && (bool) static::current()->enabled;
    }
}
