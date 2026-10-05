<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

#[Fillable([
    'name',
    'username',
    'email',
    'role',
    'ip',
    'country',
    'balance',
    'level',
    'ban',
    'google_id',
    'google_avatar',
    'user_avatar',
    'profile_setup_completed',
    'password',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'balance' => 'decimal:2',
            'level' => 'integer',
            'ban' => 'boolean',
            'profile_setup_completed' => 'boolean',
        ];
    }

    public static function diceBearAvatarUrl(string|int $seed): string
    {
        $normalizedSeed = trim((string) $seed);

        if ($normalizedSeed === '') {
            return '';
        }

        return 'https://api.dicebear.com/10.x/avataaars/svg?seed='.rawurlencode($normalizedSeed);
    }

    public static function normalizeAvatarUrl(?string $value, string|int|null $fallbackSeed = null): ?string
    {
        $avatar = trim((string) ($value ?? ''));

        if ($avatar === '') {
            $fallback = trim((string) ($fallbackSeed ?? ''));

            return $fallback !== '' ? self::diceBearAvatarUrl($fallback) : null;
        }

        if (str_contains($avatar, 'api.dicebear.com')) {
            $seed = '';

            if (preg_match('/[?&]seed=([^&]+)/', $avatar, $matches) === 1) {
                $seed = rawurldecode($matches[1]);
            }

            $fallback = $seed !== '' ? $seed : trim((string) ($fallbackSeed ?? ''));

            return $fallback !== '' ? self::diceBearAvatarUrl($fallback) : $avatar;
        }

        return $avatar;
    }

    public function getUserAvatarAttribute(mixed $value): ?string
    {
        $seed = trim((string) ($this->username ?? $this->name ?? $this->email ?? $this->getKey() ?? ''));

        return self::normalizeAvatarUrl($value, $seed);
    }

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [];
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(UserNotification::class)->orderByDesc('created_at');
    }
}
