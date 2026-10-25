<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MyId extends Model
{
    use HasFactory;

    protected $table = 'my_ids';

    protected $fillable = [
        'my_id_code',
        'label',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'my_id', 'my_id_code');
    }

    public function earnings(): HasMany
    {
        return $this->hasMany(MyIdEarning::class, 'my_id_code', 'my_id_code');
    }
}
