<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'offer_id',
    'provider',
    'title',
    'description',
    'instructions',
    'requirements',
    'image',
    'link',
    'points',
    'payout',
    'categories',
    'countries',
    'devices',
    'events',
])]
class Offer extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'points' => 'decimal:2',
            'payout' => 'decimal:2',
            'categories' => 'array',
            'countries' => 'array',
            'devices' => 'array',
            'events' => 'array',
        ];
    }
}
