<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

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
])]
class CompletedTask extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'revenue' => 'decimal:2',
            'currency_reward' => 'decimal:2',
        ];
    }

    public function myIdEarning(): HasOne
    {
        return $this->hasOne(MyIdEarning::class, 'completed_task_id');
    }
}
