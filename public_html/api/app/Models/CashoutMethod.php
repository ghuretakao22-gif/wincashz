<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'name',
    'slug',
    'category',
    'icon',
    'currency',
    'minimum_amount',
    'fee',
    'processing_time',
    'description',
    'is_active',
    'sort_order',
])]
class CashoutMethod extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'minimum_amount' => 'decimal:2',
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
