<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MyIdPayout extends Model
{
    use HasFactory;

    protected $table = 'my_id_payouts';

    protected $fillable = [
        'my_id_code',
        'user_id',
        'payout_month',
        'total_offers',
        'total_usd',
        'total_bdt',
        'payment_method',
        'payment_details',
        'status',
        'admin_notes',
        'completed_at',
        'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_details' => 'array',
            'total_offers' => 'integer',
            'total_usd' => 'decimal:2',
            'total_bdt' => 'decimal:2',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function myId(): BelongsTo
    {
        return $this->belongsTo(MyId::class, 'my_id_code', 'my_id_code');
    }

    public function completedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
