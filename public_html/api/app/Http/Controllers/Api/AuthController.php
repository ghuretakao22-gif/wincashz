<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompletedTask;
use App\Models\GoogleAuthentication;
use App\Models\MyId;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\GeoLocationService;
use App\Services\IpCountryResolver;
use App\Services\MyIdEarningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
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
        $isSystemEnabled = MyIdEarningService::isSystemEnabled();

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'min:5', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'my_id' => ['nullable', 'string', 'max:50'],
            'my_id_code' => ['nullable', 'string', 'max:50'],
        ], [
            'username.required' => 'Please provide a username.',
            'username.unique' => 'This username is already taken. Please choose another.',
            'username.max' => 'The username may not be greater than 255 characters.',
        ]);

        $username = trim((string) $validated['username']);

        $myIdInput = trim((string) ($request->input('my_id_code') ?? $request->input('my_id') ?? ''));

        if ($isSystemEnabled && $myIdInput === '') {
            throw ValidationException::withMessages([
                'my_id_code' => ['Invalid or inactive My ID code.'],
                'my_id' => ['Invalid or inactive My ID code.'],
            ]);
        }

        $myIdCode = null;

        if ($myIdInput !== '') {
            $cleanInput = ltrim($myIdInput, "# \t\n\r\0\x0B");
            $myIdRecord = MyId::where('my_id_code', $myIdInput)
                ->orWhere('my_id_code', $cleanInput)
                ->orWhere('my_id_code', '#' . $cleanInput)
                ->first(['my_id_code', 'is_active']);

            if (! $myIdRecord && $cleanInput !== '') {
                $myIdRecord = MyId::where('my_id_code', 'like', "%{$cleanInput}%")
                    ->first(['my_id_code', 'is_active']);
            }

            if (! $myIdRecord && is_numeric($cleanInput) && Schema::hasColumn('my_ids', 'id')) {
                $myIdRecord = MyId::where('id', (int) $cleanInput)
                    ->first(['my_id_code', 'is_active']);
            }

            if (! $myIdRecord || (isset($myIdRecord->is_active) && $myIdRecord->is_active === false)) {
                throw ValidationException::withMessages([
                    'my_id_code' => ['Invalid or inactive My ID code.'],
                    'my_id' => ['Invalid or inactive My ID code.'],
                ]);
            }

            $myIdCode = $myIdRecord->my_id_code;
        }

        $ip = $this->resolveVisitorIp($request);
        $country = $this->resolveVisitorCountry($request, $ip);

        $userData = [
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
        ];

        if (Schema::hasColumn('users', 'my_id')) {
            $userData['my_id'] = $myIdCode;
        }
        if (Schema::hasColumn('users', 'my_id_code')) {
            $userData['my_id_code'] = $myIdCode;
        }

        $user = User::create($userData);

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

    public function resolveMyId(Request $request, ?string $code = null): JsonResponse
    {
        try {
            $rawCode = trim((string) ($code ?: $request->query('code') ?: $request->query('my_id') ?: $request->input('code') ?: ''));
            $cleanCode = ltrim($rawCode, "# \t\n\r\0\x0B");

            if ($cleanCode === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'My ID code is required.',
                    'friendly_name' => null,
                    'sequence' => '01',
                    'date_code' => '',
                ], 400);
            }

            // Safe lookup in my_ids table using Schema verification
            $record = null;
            if (Schema::hasTable('my_ids')) {
                if (Schema::hasColumn('my_ids', 'my_id_code')) {
                    $record = MyId::query()
                        ->where(function ($query) use ($cleanCode, $rawCode): void {
                            $query->where('my_id_code', $cleanCode)
                                ->orWhere('my_id_code', '#' . $cleanCode)
                                ->orWhere('my_id_code', $rawCode);
                        })
                        ->first();

                    if (! $record) {
                        $record = MyId::query()
                            ->where('my_id_code', 'like', "%{$cleanCode}%")
                            ->first();
                    }
                }

                if (! $record && is_numeric($cleanCode) && Schema::hasColumn('my_ids', 'id')) {
                    $record = MyId::query()
                        ->where('id', (int) $cleanCode)
                        ->first();
                }
            }

            if (! $record) {
                return response()->json([
                    'success' => false,
                    'message' => "My ID '{$rawCode}' not found in database.",
                    'friendly_name' => null,
                    'sequence' => '01',
                    'date_code' => '',
                ], 404);
            }

            if (isset($record->is_active) && $record->is_active === false) {
                return response()->json([
                    'success' => false,
                    'message' => "My ID '{$record->my_id_code}' is currently inactive.",
                    'friendly_name' => null,
                    'sequence' => '01',
                    'date_code' => '',
                ], 400);
            }

            // Extract friendly name safely across possible columns
            $rawName = '';
            if (isset($record->friendly_name) && filled($record->friendly_name)) {
                $rawName = trim((string) $record->friendly_name);
            } elseif (isset($record->label) && filled($record->label)) {
                $rawName = trim((string) $record->label);
            } elseif (isset($record->name) && filled($record->name)) {
                $rawName = trim((string) $record->name);
            }

            $sanitizedName = preg_replace('/\s+/', '_', $rawName);
            $sanitizedName = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $sanitizedName);
            $sanitizedName = trim((string) $sanitizedName, '_');
            if ($sanitizedName === '') {
                $sanitizedName = 'User';
            }

            // Current UTC date code (e.g. 07n)
            $nowUtc = now('UTC');
            $day = sprintf('%02d', $nowUtc->day);
            $monthLetters = ['j', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];
            $monthLetter = $monthLetters[$nowUtc->month - 1] ?? 'n';
            $dateCode = "{$day}{$monthLetter}";

            $startOfUtcDay = $nowUtc->copy()->startOfDay();
            $endOfUtcDay = $nowUtc->copy()->endOfDay();

            // Detect user My ID column name safely
            $userMyIdCol = null;
            if (Schema::hasTable('users')) {
                if (Schema::hasColumn('users', 'my_id')) {
                    $userMyIdCol = 'my_id';
                } elseif (Schema::hasColumn('users', 'my_id_code')) {
                    $userMyIdCol = 'my_id_code';
                }
            }

            // 1. Find all usernames matching the pattern for today: {SanitizedName}_%_{dateCode}
            $pattern = "{$sanitizedName}_%_{$dateCode}";
            $existingUsernamesQuery = User::where('username', 'like', $pattern);

            if ($userMyIdCol) {
                $existingUsernamesQuery->orWhere(function ($q) use ($userMyIdCol, $record, $cleanCode, $startOfUtcDay, $endOfUtcDay): void {
                    $q->where(function ($sub) use ($userMyIdCol, $record, $cleanCode): void {
                        $sub->where($userMyIdCol, $record->my_id_code)
                            ->orWhere($userMyIdCol, $cleanCode)
                            ->orWhere($userMyIdCol, '#' . $cleanCode);
                    })->whereBetween('created_at', [$startOfUtcDay, $endOfUtcDay]);
                });
            }

            $existingUsernames = $existingUsernamesQuery->pluck('username')->all();

            // 2. Parse numeric sequence segment from any existing matching usernames
            $maxSeq = 0;
            foreach ($existingUsernames as $u) {
                if (preg_match('/_(\d+)_[a-zA-Z0-9]+$/', (string) $u, $matches)) {
                    $val = (int) $matches[1];
                    if ($val > $maxSeq) {
                        $maxSeq = $val;
                    }
                }
            }

            // Also check registration count for today under this My ID if column exists
            if ($userMyIdCol) {
                $todayCount = User::where(function ($query) use ($userMyIdCol, $record, $cleanCode): void {
                    $query->where($userMyIdCol, $record->my_id_code)
                        ->orWhere($userMyIdCol, $cleanCode);
                })
                    ->whereBetween('created_at', [$startOfUtcDay, $endOfUtcDay])
                    ->count();

                if ($todayCount > $maxSeq) {
                    $maxSeq = $todayCount;
                }
            }

            // 3. Next sequence starts at maxSeq + 1
            $nextSeqNum = $maxSeq + 1;

            // 4. Verify candidate username does not already exist in users
            do {
                $candidateSeq = sprintf('%02d', $nextSeqNum);
                $candidateUsername = "{$sanitizedName}_{$candidateSeq}_{$dateCode}";
                $exists = User::where('username', $candidateUsername)->exists();
                if ($exists) {
                    $nextSeqNum++;
                }
            } while ($exists && $nextSeqNum < 1000);

            $finalSequence = sprintf('%02d', $nextSeqNum);
            $suggestedUsername = "{$sanitizedName}_{$finalSequence}_{$dateCode}";

            return response()->json([
                'success' => true,
                'my_id_code' => $record->my_id_code,
                'friendly_name' => $rawName ?: $sanitizedName,
                'sanitized_name' => $sanitizedName,
                'sequence' => $finalSequence,
                'date_code' => $dateCode,
                'suggested_username' => $suggestedUsername,
            ])
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache');
        } catch (\Throwable $e) {
            Log::error('My ID resolution exception: ' . $e->getMessage(), [
                'code' => $code ?? null,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to resolve My ID at this moment: ' . $e->getMessage(),
                'friendly_name' => null,
                'sequence' => '01',
                'date_code' => '',
            ], 400);
        }
    }

    public function visitorGeo(Request $request): JsonResponse
    {
        $ip = $this->resolveVisitorIp($request);
        $country = $this->resolveVisitorCountry($request, $ip);

        return response()->json([
            'success' => true,
            'ip_address' => $ip,
            'country' => $country,
            'city' => '',
            'location' => '',
        ])
            ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache');
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

    public function location(Request $request, GeoLocationService $geoService): JsonResponse
    {
        if ($response = $this->rejectBannedUser($request->user('api'))) {
            return $response;
        }

        $resolver = app(IpCountryResolver::class);
        $clientIp = $resolver->resolveClientIp($request);
        $ip = (string) ($clientIp ?? $request->ip());
        $location = $geoService->resolve($ip);

        return response()->json($location)
            ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Vary', 'Authorization');
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
        $resolver = app(IpCountryResolver::class);
        $resolvedIp = $resolver->resolveClientIp($request);

        // Only update geo if a valid public client IP was extracted (strictly NOT loopback, private, or host server IP 69.57.162.203)
        if (! filled($resolvedIp) || ! $resolver->isPublicClientIp($resolvedIp)) {
            return $user;
        }

        $resolvedCountry = $this->resolveVisitorCountry($request, $resolvedIp);
        $updates = [];

        if ($user->ip !== $resolvedIp) {
            $updates['ip'] = $resolvedIp;
        }

        if (filled($resolvedCountry) && $resolvedCountry !== 'Unknown' && $resolvedCountry !== 'Local' && $user->country !== $resolvedCountry) {
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
        $country = app(IpCountryResolver::class)->countryFromIp($ip, $request);

        if (($country === 'Unknown' || $country === '') && filled($request->user('api')?->country)) {
            return $request->user('api')->country;
        }

        return $country;
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
