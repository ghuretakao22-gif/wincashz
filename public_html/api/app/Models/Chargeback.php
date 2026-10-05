<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'offer_wall_name',
    'user_id',
    'user_name',
    'transaction_id',
    'offer_name',
    'offer_id',
    'revenue',
    'currency_reward',
    'ip',
    'country',
    'status',
    'reason',
    'admin_id',
])]
class Chargeback extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'revenue' => 'decimal:2',
            'currency_reward' => 'decimal:2',
        ];
    }
}
