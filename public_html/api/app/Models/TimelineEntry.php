<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'user_name',
    'user_avatar',
    'offer_wall_name',
    'offer_name',
    'task_id',
    'currency_reward',
    'country',
    'ip',
    'type',
    'status',
    'meta',
])]
class TimelineEntry extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'currency_reward' => 'decimal:2',
            'meta' => 'array',
        ];
    }
}
