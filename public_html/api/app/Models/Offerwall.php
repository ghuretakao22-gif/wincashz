<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'name',
    'badge',
    'logo_url',
    'category',
    'iframe_url',
    'rating',
    'is_active',
    'sort_order',
    'unlock_level',
    'postback_slug',
    'postback_parameters',
    'postback_url',
    'postback_signature_required',
    'postback_whitelist_ip_required',
    'postback_whitelist_ips',
])]
class Offerwall extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'unlock_level' => 'integer',
            'postback_parameters' => 'array',
            'postback_signature_required' => 'boolean',
            'postback_whitelist_ip_required' => 'boolean',
            'postback_whitelist_ips' => 'array',
        ];
    }
}
