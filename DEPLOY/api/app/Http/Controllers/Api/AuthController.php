<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompletedTask;
use App\Models\GoogleAuthentication;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\IpCountryResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function googleConfig(): JsonResponse
    {
        return response()->json([
            'enabled' => GoogleAuthentication::isEnabled(),
        ]);
    }

    public function googleStart(Request $request): JsonResponse
    {
        $mode = $request->string('mode')->toString() === 'register' ? 'register' : 'login';
        $googleAuth = GoogleAuthentication::current();

        if (! $googleAuth->enabled || blank($googleAuth->client_id) || blank($googleAuth->client_secret)) {
            throw ValidationException::withMessages([
                'google' => ['Google sign in is not configured yet.'],
            ]);
        }

        $state = Crypt::encryptString(json_encode([
            'mode' => $mode,
            'origin' => $this->resolveFrontendOrigin($request),
            'nonce' => Str::random(40),
        ], JSON_THROW_ON_ERROR));

        $callbackUrl = route('google-auth.callback');

        $query = http_build_query([
            'client_id' => $googleAuth->client_id,
            'redirect_uri' => $callbackUrl,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
            'access_type' => 'online',
            'include_granted_scopes' => 'true',
        ]);

        return response()->json([
            'url' => 'https://accounts.google.com/o/oauth2/v2/auth?'.$query,
        ]);
    }

    public function googleCallback(Request $request)
    {
        if ($request->filled('error')) {
            return $this->googleCallbackResponse([
                'success' => false,
                'error' => $request->query('error_description', $request->query('error', 'Google sign in failed.')),
            ], $this->resolveCallbackOrigin($request));
        }

        $state = $this->decodeGoogleState((string) $request->query('state', ''));

        if (! $state) {
            return $this->googleCallbackResponse([
                'success' => false,
                'error' => 'Google sign in state is invalid or expired.',
            ], $this->resolveCallbackOrigin($request));
        }

        $origin = (string) ($state['origin'] ?? '');
        $mode = (string) ($state['mode'] ?? 'login');
        $code = (string) $request->query('code', '');
        $googleAuth = GoogleAuthentication::current();

        if ($code === '') {
            return $this->googleCallbackResponse([
                'success' => false,
                'error' => 'Google sign in did not return an authorization code.',
            ], $origin);
        }

        if (! $googleAuth->enabled || blank($googleAuth->client_id) || blank($googleAuth->client_secret)) {
            return $this->googleCallbackResponse([
                'success' => false,
                'error' => 'Google sign in is not configured yet.',
            ], $origin);
        }

        try {
            $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'code' => $code,
                'client_id' => $googleAuth->client_id,
                'client_secret' => $googleAuth->client_secret,
                'redirect_uri' => route('google-auth.callback'),
                'grant_type' => 'authorization_code',
            ])->throw();

            $accessToken = (string) $tokenResponse->json('access_token', '');

            if ($accessToken === '') {
                throw new \RuntimeException('Google sign in did not return an access token.');
            }

            $profileResponse = Http::withToken($accessToken)
                ->get('https://openidconnect.googleapis.com/v1/userinfo')
                ->throw();

            $googleId = trim((string) $profileResponse->json('sub', ''));
            $email = strtolower(trim((string) $profileResponse->json('email', '')));
            $emailVerified = filter_var($profileResponse->json('email_verified'), FILTER_VALIDATE_BOOLEAN);
            $name = trim((string) $profileResponse->json('name', ''));
            $avatar = trim((string) $profileResponse->json('picture', ''));

            if ($googleId === '' || $email === '') {
                return $this->googleCallbackResponse([
                    'success' => false,
                    'error' => 'Google account information is incomplete.',
                ], $origin);
            }

            if (! $emailVerified) {
                return $this->googleCallbackResponse([
                    'success' => false,
                    'error' => 'Google email address is not verified.',
                ], $origin);
            }

            $user = User::query()
                ->where('google_id', $googleId)
                ->first()
                ?? User::query()->where('email', $email)->first();

            if (! $user) {
                $emailPrefix = explode('@', $email)[0] ?? 'member';
                $username = $this->generateUniqueUsername($emailPrefix);
                $ip = $this->resolveVisitorIp($request);
                $country = $this->resolveVisitorCountry($request);

                $user = User::create([
                    'name' => $name !== '' ? $name : $username,
                    'username' => $username,
                    'email' => $email,
                    'role' => 'user',
                    'ban' => false,
                    'ip' => $ip,
                    'country' => $country,
                    'balance' => 0,
                    'level' => 1,
                    'email_verified_at' => now(),
                    'google_id' => $googleId,
                    'google_avatar' => $avatar !== '' ? $avatar : null,
                    'user_avatar' => null,
                    'profile_setup_completed' => true,
                    'password' => Str::random(64),
                ]);

                $user->forceFill([
                    'user_avatar' => User::diceBearAvatarUrl((string) $user->id),
                ])->save();

                UserNotification::create([
                    'user_id' => $user->id,
                    'type' => 'welcome',
                    'icon' => 'bell',
                    'title' => 'Welcome to Wincashz',
                    'message' => 'Your Google account has been connected successfully.',
                    'data' => [
                        'source' => 'google-auth',
                        'mode' => $mode,
                    ],
                ]);
            } else {
                $updates = [];

                if (blank($user->google_id)) {
                    $updates['google_id'] = $googleId;
                }

                if (blank($user->google_avatar) && $avatar !== '') {
                    $updates['google_avatar'] = $avatar;
                }

                if (blank($user->user_avatar)) {
                    $updates['user_avatar'] = User::diceBearAvatarUrl((string) $user->id);
                }

                if (blank($user->email_verified_at)) {
                    $updates['email_verified_at'] = now();
                }

                if ($updates !== []) {
                    $user->forceFill($updates)->save();
                }
            }

            if ((bool) ($user->ban ?? false)) {
                return $this->googleCallbackResponse([
                    'success' => false,
                    'error' => 'Your account has been banned.',
                ], $origin);
            }

            $token = auth('api')->login($user->refresh());

            return $this->googleCallbackResponse([
                'success' => true,
                'message' => $mode === 'register'
                    ? 'Google registration successful.'
                    : 'Google login successful.',
                'token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
                'user' => $this->attachEarningsSummary($user->refresh(), $request),
            ], $origin);
        } catch (\Throwable $throwable) {
            return $this->googleCallbackResponse([
                'success' => false,
                'error' => $throwable->getMessage() ?: 'Google sign in failed.',
            ], $origin);
        }
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'min:5', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
        ], [
            'username.required' => 'Please provide a username.',
            'username.unique' => 'This username is already taken. Please choose another.',
            'username.max' => 'The username may not be greater than 255 characters.',
        ]);

        $username = trim((string) $validated['username']);

        $ip = $this->resolveVisitorIp($request);
        $country = $this->resolveVisitorCountry($request);

        $user = User::create([
            'name' => $username,
            'username' => $username,
            'email' => $validated['email'],
            'role' => 'user',
            'ban' => false,
            'ip' => $ip,
            'country' => $country,
            'balance' => 0,
            'level' => 1,
            'user_avatar' => null,
            'profile_setup_completed' => true,
            'password' => $validated['password'],
        ]);

        $user->forceFill([
            'user_avatar' => User::diceBearAvatarUrl((string) $user->id),
        ])->save();

        UserNotification::create([
            'user_id' => $user->id,
            'type' => 'welcome',
            'icon' => 'bell',
            'title' => 'Welcome to Wincashz',
            'message' => 'Your account is ready. Start earning and watch new updates appear here.',
            'data' => [
                'source' => 'registration',
            ],
        ]);

        $token = auth('api')->login($user);

        return $this->respondWithToken($request, $token, 'Registration successful.', $user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $token = auth('api')->attempt($credentials + ['ban' => 0]);

        if (! $token) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        return $this->respondWithToken($request, $token, 'Login successful.');
    }

    public function visitorGeo(Request $request): JsonResponse
    {
        $requestedIp = trim((string) $request->query('ip', ''));
        $ip = $requestedIp !== '' ? $requestedIp : $this->resolveVisitorIp($request);
        $country = $this->resolveVisitorCountry($request, $ip);

        return response()->json([
            'success' => true,
            'ip_address' => $ip,
            'country' => $country,
            'city' => '',
            'location' => '',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        if ($response = $this->rejectBannedUser($request->user('api'))) {
            return $response;
        }

        return response()->json([
            'user' => $this->attachEarningsSummary($request->user('api'), $request),
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        if ($response = $this->rejectBannedUser($request->user('api'))) {
            return $response;
        }

        return $this->respondWithToken($request, auth('api')->refresh(), 'Token refreshed.');
    }

    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function usernameAvailability(Request $request): JsonResponse
    {
        $user = $request->user('api');
        $validated = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:25'],
        ]);

        $username = $this->normalizeUsername($validated['username']);

        if ($username === '' || Str::length($username) < 3) {
            throw ValidationException::withMessages([
                'username' => ['Please enter a valid username.'],
            ]);
        }

        $isAvailable = ! User::query()
            ->where('username', $username)
            ->when($user?->id, fn ($query, $userId) => $query->where('id', '!=', $userId))
            ->exists();

        return response()->json([
            'username' => $username,
            'available' => $isAvailable,
        ]);
    }

    public function completeProfileSetup(Request $request): JsonResponse
    {
        $user = $request->user('api');

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $validated = $request->validate([
            'username' => [
                'required',
                'string',
                'min:3',
                'max:25',
                Rule::unique('users', 'username')->ignore($user->id),
            ],
            'avatar' => ['required', 'string', 'max:2048'],
        ]);

        $username = $this->normalizeUsername($validated['username']);
        $avatar = trim((string) $validated['avatar']);

        if ($username === '' || Str::length($username) < 3) {
            throw ValidationException::withMessages([
                'username' => ['Please enter a valid username.'],
            ]);
        }

        if ($avatar === '') {
            throw ValidationException::withMessages([
                'avatar' => ['Please select an avatar.'],
            ]);
        }

        if (User::query()
            ->where('username', $username)
            ->where('id', '!=', $user->id)
            ->exists()) {
            throw ValidationException::withMessages([
                'username' => ['This username is already taken.'],
            ]);
        }

        $user->forceFill([
            'username' => $username,
            'name' => $username,
            'user_avatar' => $avatar,
            'profile_setup_completed' => true,
        ])->save();

        return response()->json([
            'message' => 'Profile setup completed successfully.',
            'user' => $this->attachEarningsSummary($user->refresh(), $request),
        ]);
    }

    private function respondWithToken(Request $request, string $token, string $message, ?User $user = null, int $status = 200): JsonResponse
    {
        $resolvedUser = $this->attachEarningsSummary($user ?? auth('api')->user(), $request);

        return response()->json([
            'message' => $message,
            'user' => $resolvedUser,
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60,
        ], $status);
    }

    private function attachEarningsSummary(?User $user, ?Request $request = null): ?User
    {
        if (! $user) {
            return null;
        }

        if ($request) {
            $user = $this->syncVisitorGeo($user, $request);
        }

        $responseUser = clone $user;

        $userId = $user->id;
        $username = (string) ($user->username ?? '');

        $totalEarnings = (float) CompletedTask::query()
            ->where(function ($query) use ($userId, $username): void {
                $query->where('user_id', $userId);

                if ($username !== '') {
                    $query->orWhere('user_name', $username);
                }
            })
            ->sum('currency_reward');

        $completedTasksCount = CompletedTask::query()
            ->where(function ($query) use ($userId, $username): void {
                $query->where('user_id', $userId);

                if ($username !== '') {
                    $query->orWhere('user_name', $username);
                }
            })
            ->count();

        $withdrawalsCount = Transaction::query()
            ->where('user_id', $userId)
            ->where(function ($query): void {
                $query->where('type', 'like', 'withdrawal%')
                    ->orWhere('reference_type', 'like', 'withdrawal%');
            })
            ->count();

        $responseUser->setAttribute('total_earnings', $totalEarnings);
        $responseUser->setAttribute('totalEarnings', $totalEarnings);
        $responseUser->setAttribute('completed_tasks_count', $completedTasksCount);
        $responseUser->setAttribute('completedTasksCount', $completedTasksCount);
        $responseUser->setAttribute('withdrawals_count', $withdrawalsCount);
        $responseUser->setAttribute('withdrawalsCount', $withdrawalsCount);

        if ($request) {
            $visitorIp = $this->resolveVisitorIp($request);
            $visitorCountry = $this->resolveVisitorCountry($request, $visitorIp);
            $responseUser->setAttribute('session_ip_address', $visitorIp);
            $responseUser->setAttribute('sessionIpAddress', $visitorIp);
            $responseUser->setAttribute('session_country', $visitorCountry);
            $responseUser->setAttribute('sessionCountry', $visitorCountry);
            $responseUser->setAttribute('visitor_country', $visitorCountry);
            $responseUser->setAttribute('visitorCountry', $visitorCountry);
        }

        return $responseUser;
    }

    private function syncVisitorGeo(User $user, Request $request): User
    {
        $resolvedIp = app(IpCountryResolver::class)->resolveClientIp($request);
        $resolvedCountry = $this->resolveVisitorCountry($request);
        $updates = [];

        if (filled($resolvedIp) && $user->ip !== $resolvedIp) {
            $updates['ip'] = $resolvedIp;
        }

        if (filled($resolvedCountry) && $user->country !== $resolvedCountry) {
            $updates['country'] = $resolvedCountry;
        }

        if ($updates !== []) {
            $user->forceFill($updates)->save();
        }

        return $user;
    }

    private function rejectBannedUser(?User $user): ?JsonResponse
    {
        if (! $user || ! (bool) ($user->ban ?? false)) {
            return null;
        }

        auth('api')->logout();

        return response()->json([
            'message' => 'Your account has been banned.',
        ], 403);
    }

    private function generateUniqueUsername(string $preferred = 'member'): string
    {
        $base = $this->normalizeUsername($preferred);
        if ($base === '' || Str::length($base) < 3) {
            $base = 'user';
        }
        $base = Str::limit($base, 15, '');

        if (! User::query()->where('username', $base)->exists()) {
            return $base;
        }

        $username = $base . Str::lower(Str::random(4));
        $suffix = 1;

        while (User::query()->where('username', $username)->exists()) {
            $username = $base . Str::lower(Str::random(4)) . $suffix;
            $suffix++;
        }

        return $username;
    }

    private function generateTemporaryUsername(): string
    {
        $base = 'member';
        $username = $base.'-'.Str::lower(Str::random(8));
        $suffix = 1;

        while (User::query()->where('username', $username)->exists()) {
            $username = $base.'-'.Str::lower(Str::random(8)).'-'.$suffix;
            $suffix++;
        }

        return $username;
    }

    private function normalizeUsername(string $username): string
    {
        return Str::of($username)
            ->trim()
            ->lower()
            ->replaceMatches('/[^a-z0-9._-]+/', '')
            ->value();
    }

    private function resolveVisitorIp(Request $request): ?string
    {
        return app(IpCountryResolver::class)->resolveClientIp($request);
    }

    private function resolveVisitorCountry(Request $request, ?string $ip = null): string
    {
        return app(IpCountryResolver::class)->countryFromIp($ip, $request);
    }

    private function decodeGoogleState(string $state): ?array
    {
        if ($state === '') {
            return null;
        }

        try {
            $decoded = json_decode(Crypt::decryptString($state), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    private function resolveFrontendOrigin(Request $request): string
    {
        $origin = trim((string) $request->header('Origin', ''));

        if ($origin === '') {
            $origin = trim((string) $request->header('Referer', ''));
        }

        if ($origin === '') {
            return rtrim((string) config('app.url'), '/');
        }

        if (str_contains($origin, '://')) {
            $parsed = parse_url($origin);

            if (is_array($parsed) && isset($parsed['scheme'], $parsed['host'])) {
                $resolved = $parsed['scheme'].'://'.$parsed['host'];

                if (isset($parsed['port'])) {
                    $resolved .= ':'.$parsed['port'];
                }

                return rtrim($resolved, '/');
            }
        }

        return rtrim((string) config('app.url'), '/');
    }

    private function resolveCallbackOrigin(Request $request): string
    {
        return $this->resolveFrontendOrigin($request);
    }

    private function googleCallbackResponse(array $payload, string $targetOrigin)
    {
        return response()->view('google-auth-callback', [
            'payload' => $payload,
            'targetOrigin' => $targetOrigin !== '' ? $targetOrigin : rtrim((string) config('app.url'), '/'),
        ]);
    }
}
