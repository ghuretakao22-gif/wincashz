<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

#[Fillable([
    'name',
    'value',
])]
class Setting extends Model
{
    use HasFactory;

    public static function boolean(string $name, bool $default = true): bool
    {
        if (!Schema::hasTable('settings')) {
            return $default;
        }

        $setting = static::query()->firstOrCreate(
            ['name' => $name],
            ['value' => $default ? '1' : '0'],
        );

        return filter_var($setting->value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
    }

    public static function setBoolean(string $name, bool $value): self
    {
        return static::query()->updateOrCreate(
            ['name' => $name],
            ['value' => $value ? '1' : '0'],
        );
    }

    public static function value(string $name, string $default = ''): string
    {
        if (!Schema::hasTable('settings')) {
            return $default;
        }

        return (string) (static::query()->where('name', $name)->value('value') ?? $default);
    }

    public static function setValue(string $name, string $value): self
    {
        return static::query()->updateOrCreate(
            ['name' => $name],
            ['value' => $value],
        );
    }
}
