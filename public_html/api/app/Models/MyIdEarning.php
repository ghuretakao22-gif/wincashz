<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MyIdEarning extends Model
{
    use HasFactory;

    protected $table = 'my_id_earnings';

    protected $fillable = [
        'my_id_code',
        'user_id',
        'completed_task_id',
        'provider',
        'offer_id',
        'offer_name',
        'coin_amount',
        'payout_usd',
        'usd_bdt_rate',
        'payout_bdt',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'coin_amount' => 'decimal:4',
            'payout_usd' => 'decimal:4',
            'usd_bdt_rate' => 'decimal:2',
            'payout_bdt' => 'decimal:4',
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

    public function completedTask(): BelongsTo
    {
        return $this->belongsTo(CompletedTask::class, 'completed_task_id');
    }
}
