<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'user_name',
    'type',
    'status',
    'amount',
    'reference_type',
    'reference_id',
    'transaction_id',
    'title',
    'description',
    'meta',
])]
class Transaction extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
        ];
    }
}
