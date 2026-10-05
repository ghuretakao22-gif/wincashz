<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashoutMethod;
use App\Models\Chargeback;
use App\Models\CompletedTask;
use App\Models\GoogleAuthentication;
use App\Models\OfferApiLink;
use App\Models\Offer;
use App\Models\Offerwall;
use App\Models\Setting;
use App\Models\TimelineEntry;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\IpCountryResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    private const TIMELINE_ENABLED_SETTING = 'timeline_enabled';
    private const SITE_LOGO_SETTING = 'site_logo';
    private const MAX_SITE_LOGO_BYTES = 2 * 1024 * 1024;
    private const CUSTOM_OFFER_CATEGORIES = ['top_offers', 'explore_offers'];
    private const OFFER_API_PROVIDERS = [
        ['key' => 'vortexwall', 'label' => 'vortexwall'],
        ['key' => 'offery', 'label' => 'Offery'],
        ['key' => 'lootably', 'label' => 'Lootably'],
        ['key' => 'gemiad', 'label' => 'Gemiad'],
        ['key' => 'incentium', 'label' => 'incentium'],
        ['key' => 'primewall', 'label' => 'Primewall'],
        ['key' => 'notik', 'label' => 'Notik'],
        ['key' => 'adtowall', 'label' => 'Adtowall'],
        ['key' => 'mmwall', 'label' => 'mmwall'],
        ['key' => 'upwall', 'label' => 'Upwall'],
        ['key' => 'torox', 'label' => 'Torox'],
        ['key' => 'revtoo', 'label' => 'Revtoo'],
        ['key' => 'taskwall', 'label' => 'Taskwall'],
        ['key' => 'pubscale', 'label' => 'Pubscale'],
        ['key' => 'revu', 'label' => 'Revu'],
        ['key' => 'radientwall', 'label' => 'Radientwall'],
        ['key' => 'clickwall', 'label' => 'Clickwall'],
    ];

    public function dashboard(): JsonResponse
    {
        $today = Carbon::today();
        $startOfDay = $today->copy()->startOfDay();
        $endOfDay = $today->copy()->endOfDay();

        return response()->json([
            'metrics' => [
                [
                    'label' => 'All Users',
                    'value' => User::count(),
                ],
                [
                    'label' => 'Completed Tasks',
                    'value' => CompletedTask::count(),
                ],
                [
                    'label' => 'All Chargebacks',
                    'value' => Chargeback::count(),
                ],
                [
                    'label' => 'Pending Withdrawals',
                    'value' => Transaction::query()
                        ->where('type', 'like', 'withdrawal%')
                        ->where('status', 'pending')
                        ->count(),
                ],
                [
                    'label' => 'All Withdrawals',
                    'value' => Transaction::query()
                        ->where('type', 'like', 'withdrawal%')
                        ->count(),
                ],
            ],
            'revenue' => [
                [
                    'label' => 'Today Revenue',
                    'value' => $this->sumCompletedTaskRevenue($startOfDay, $endOfDay),
                ],
                [
                    'label' => 'Total Revenue',
                    'value' => $this->sumCompletedTaskRevenue(),
                ],
                [
                    'label' => 'Today Chargeback',
                    'value' => $this->sumChargebackRevenue($startOfDay, $endOfDay),
                ],
                [
                    'label' => 'Total Chargeback',
                    'value' => $this->sumChargebackRevenue(),
                ],
            ],
            'activity' => [
                'users' => $this->recentUsers(),
                'tasks' => $this->recentTasks(),
                'withdrawals' => $this->recentWithdrawals(),
                'chargebacks' => $this->recentChargebacks(),
                'transactions' => $this->recentTransactions(),
                'cashoutMethods' => $this->recentCashoutMethods(),
            ],
            'settings' => [
                'timelineEnabled' => $this->timelineEnabled(),
                'logoUrl' => $this->siteLogo(),
                'googleAuthenticationEnabled' => GoogleAuthentication::isEnabled(),
            ],
        ]);
    }

    public function publicSettings(): JsonResponse
    {
        return response()->json([
            'settings' => [
                'logoUrl' => $this->siteLogo(),
            ],
        ]);
    }

    public function googleAuthentication(): JsonResponse
    {
        if (!Schema::hasTable('google_authentications')) {
            return response()->json([
                'settings' => [
                    'enabled' => false,
                    'clientId' => '',
                    'hasClientSecret' => false,
                    'tableMissing' => true,
                ],
            ]);
        }

        $googleAuthentication = GoogleAuthentication::current();

        return response()->json([
            'settings' => [
                'enabled' => (bool) $googleAuthentication->enabled,
                'clientId' => (string) ($googleAuthentication->client_id ?? ''),
                'hasClientSecret' => filled($googleAuthentication->client_secret),
            ],
        ]);
    }

    public function updateGoogleAuthentication(Request $request): JsonResponse
    {
        if (!Schema::hasTable('google_authentications')) {
            return response()->json([
                'message' => 'Google authentication table is missing. Run the database migrations first.',
            ], 503);
        }

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'clientId' => ['nullable', 'string', 'max:255'],
            'clientSecret' => ['nullable', 'string', 'max:2048'],
        ]);

        $enabled = (bool) $validated['enabled'];
        $clientId = trim((string) ($validated['clientId'] ?? ''));
        $clientSecret = trim((string) ($validated['clientSecret'] ?? ''));
        $googleAuthentication = GoogleAuthentication::current();
        $hasExistingSecret = filled($googleAuthentication->client_secret);

        if ($enabled) {
            $errors = [];

            if ($clientId === '') {
                $errors['clientId'] = ['Google Client ID is required when enabling Google sign in.'];
            }

            if ($clientSecret === '' && ! $hasExistingSecret) {
                $errors['clientSecret'] = ['Google Client Secret is required when enabling Google sign in.'];
            }

            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }
        }

        $googleAuthentication->enabled = $enabled;

        if ($clientId !== '') {
            $googleAuthentication->client_id = $clientId;
        }

        if ($clientSecret !== '') {
            $googleAuthentication->client_secret = $clientSecret;
        }

        $googleAuthentication->save();

        return response()->json([
            'message' => 'Google authentication settings updated.',
            'settings' => [
                'enabled' => (bool) $googleAuthentication->enabled,
                'clientId' => (string) ($googleAuthentication->client_id ?? ''),
                'hasClientSecret' => filled($googleAuthentication->client_secret),
            ],
        ]);
    }

    public function publicCashoutMethods(Request $request): JsonResponse
    {
        if (!Schema::hasTable('cashout_methods')) {
            return response()->json([
                'columns' => [],
                'rows' => [],
            ]);
        }

        $schema = $this->cashoutMethodSchema();
        $columns = array_map(fn (array $column): string => $column['field'], $schema);

        if ($columns === []) {
            return response()->json([
                'columns' => [],
                'rows' => [],
            ]);
        }

        $query = DB::table('cashout_methods')->select($columns);

        if (in_array('is_active', $columns, true) && $request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        foreach ($this->cashoutMethodOrderColumns($schema) as $orderColumn) {
            $query->orderBy($orderColumn);
        }

        return response()->json([
            'columns' => $columns,
            'rows' => $query->get(),
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $perPage = 10;
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $query = User::query();

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function ($builder) use ($escapedSearch, $search): void {
                $like = '%'.$escapedSearch.'%';

                $builder
                    ->where('name', 'like', $like)
                    ->orWhere('username', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('role', 'like', $like)
                    ->orWhere('ip', 'like', $like)
                    ->orWhere('country', 'like', $like);

                if (is_numeric($search)) {
                    $builder->orWhere('id', (int) $search);
                }
            });
        }

        $paginator = $query
            ->orderByDesc('created_at')
            ->paginate(
                $perPage,
                [
                    'id',
                    'name',
                    'username',
                    'email',
                    'role',
                    'balance',
                    'level',
                    'ip',
                    'country',
                    'ban',
                    'created_at',
                ],
                'page',
                $page,
            );

        return response()->json([
            'rows' => $paginator->items(),
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function offers(Request $request): JsonResponse
    {
        $dynamicRows = $this->dynamicHomepageOffers($request);

        if ($dynamicRows !== []) {
            return response()->json([
                'rows' => $dynamicRows,
            ]);
        }

        if (!Schema::hasTable('offers')) {
            return response()->json([
                'rows' => [],
            ]);
        }

        $offers = Offer::query()
            ->select([
                'id',
                'offer_id',
                'provider',
                'title',
                'description',
                'requirements',
                'image',
                'link',
                'points',
                'payout',
                'categories',
            ])
            ->orderByDesc('payout')
            ->orderByDesc('points')
            ->orderBy('id')
            ->get();

        return response()->json([
            'rows' => $offers
                ->map(fn (Offer $offer) => [
                    'id' => $offer->id,
                    'offerId' => $offer->offer_id ?? '',
                    'provider' => $offer->provider ?? '',
                    'title' => $offer->title ?? '',
                    'description' => $offer->description ?? '',
                    'subtitle' => $this->firstNonEmptyString($offer->requirements, $offer->provider, 'Featured reward opportunity'),
                    'tag' => $this->resolveOfferTag($offer->categories, $offer->provider),
                    'reward' => $this->formatOfferRewardValue($offer->points, $offer->payout),
                    'imageUrl' => $this->resolveOfferImageUrl($offer->image),
                    'link' => $offer->link ?? '',
                    'categories' => $offer->categories ?? [],
                    'category' => $this->resolveOfferCategoryValue($offer->categories),
                    'categoryLabel' => Str::headline($this->resolveOfferCategoryValue($offer->categories)),
                ])
                ->values(),
        ]);
    }

    public function adminOffers(): JsonResponse
    {
        if (!Schema::hasTable('offers')) {
            return response()->json([
                'rows' => [],
            ]);
        }

        $offers = Offer::query()
            ->select([
                'id',
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
                'created_at',
                'updated_at',
            ])
            ->orderByDesc('payout')
            ->orderByDesc('points')
            ->orderBy('id')
            ->get();

        return response()->json([
            'rows' => $offers
                ->map(fn (Offer $offer) => $this->formatOffer($offer))
                ->values(),
        ]);
    }

    public function storeOffer(Request $request): JsonResponse
    {
        if (!Schema::hasTable('offers')) {
            return response()->json([
                'message' => 'Offers table not found.',
            ], 404);
        }

        $validated = array_merge($request->validate($this->offerValidationRules(true)), $request->all());

        $payload = $this->buildOfferPayload($validated);
        $payload['created_at'] = now();
        $payload['updated_at'] = now();

        $id = DB::table('offers')->insertGetId($payload);
        $offer = Offer::query()->find($id);

        return response()->json([
            'message' => 'Offer created successfully.',
            'offer' => $offer ? $this->formatOffer($offer) : null,
        ], 201);
    }

    public function updateOffer(Request $request, string $offerId): JsonResponse
    {
        if (!Schema::hasTable('offers')) {
            return response()->json([
                'message' => 'Offers table not found.',
            ], 404);
        }

        $offer = Offer::query()->find($offerId);
        if (! $offer) {
            return response()->json([
                'message' => 'Offer not found.',
            ], 404);
        }

        $validated = array_merge($request->validate($this->offerValidationRules(false)), $request->all());

        $payload = $this->buildOfferPayload($validated, $offer);
        $payload['updated_at'] = now();
        DB::table('offers')->where('id', $offer->id)->update($payload);
        $offer->refresh();

        return response()->json([
            'message' => 'Offer updated successfully.',
            'offer' => $this->formatOffer($offer),
        ]);
    }

    public function destroyOffer(string $offerId): JsonResponse
    {
        if (Schema::hasTable('offers')) {
            $offer = Offer::query()->find($offerId);
            if ($offer) {
                $offer->delete();
            }
        }

        return response()->json([
            'message' => 'Offer deleted successfully.',
        ]);
    }

    public function offersApiLinks(): JsonResponse
    {
        if (!Schema::hasTable('offer_api_links')) {
            return response()->json([
                'rows' => [],
            ]);
        }

        $links = OfferApiLink::query()
            ->select([
                'id',
                'provider_key',
                'api_link',
                'is_active',
                'created_at',
                'updated_at',
            ])
            ->orderBy('provider_key')
            ->get();

        $linksByProvider = $links->keyBy(fn (OfferApiLink $offerApiLink): string => strtolower(trim((string) $offerApiLink->provider_key)));

        return response()->json([
            'rows' => collect(self::OFFER_API_PROVIDERS)
                ->map(function (array $provider) use ($linksByProvider): array {
                    $offerApiLink = $linksByProvider->get($provider['key']);

                    return $this->formatOfferApiLink($provider, $offerApiLink);
                })
                ->values(),
        ]);
    }

    public function storeOffersApiLink(Request $request): JsonResponse
    {
        if (!Schema::hasTable('offer_api_links')) {
            return response()->json([
                'message' => 'Offers API table not found.',
            ], 404);
        }

        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.providerKey' => ['required', 'string', Rule::in($this->offerApiProviderKeys())],
            'items.*.apiLink' => ['nullable', 'string', 'max:2048'],
            'items.*.isActive' => ['sometimes', 'boolean'],
        ]);

        $items = collect($validated['items'])
            ->map(fn (array $item): array => [
                'provider_key' => strtolower(trim((string) $item['providerKey'])),
                'api_link' => trim((string) ($item['apiLink'] ?? '')),
                'is_active' => (bool) ($item['isActive'] ?? false),
            ])
            ->values();

        foreach ($items as $item) {
            if ($item['is_active'] && $item['api_link'] === '') {
                throw ValidationException::withMessages([
                    'items' => ['Please add an API link before enabling a provider.'],
                ]);
            }
        }

        DB::transaction(function () use ($items): void {
            foreach ($items as $item) {
                OfferApiLink::query()->updateOrCreate(
                    ['provider_key' => $item['provider_key']],
                    [
                        'api_link' => $item['api_link'],
                        'is_active' => $item['is_active'],
                    ],
                );
            }
        });

        return response()->json([
            'message' => 'Offers API settings saved successfully.',
            'rows' => collect(self::OFFER_API_PROVIDERS)
                ->map(function (array $provider) use ($items): array {
                    $item = $items->firstWhere('provider_key', $provider['key']);

                    return $this->formatOfferApiLink(
                        $provider,
                        $item ? OfferApiLink::query()->where('provider_key', $provider['key'])->first() : null,
                    );
                })
                ->values(),
        ]);
    }

    public function timeline(Request $request): JsonResponse
    {
        if (!Schema::hasTable('timeline_entries')) {
            return response()->json([
                'enabled' => $this->timelineEnabled(),
                'rows' => [],
                'timeline' => [],
            ]);
        }

        $enabled = $this->timelineEnabled();

        if (! $enabled) {
            return response()->json([
                'enabled' => false,
                'rows' => [],
                'timeline' => [],
            ]);
        }

        $limit = max(1, min(50, (int) $request->query('limit', 50)));

        $rows = TimelineEntry::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (TimelineEntry $entry) => $this->formatTimelineEntry($entry))
            ->values();

        return response()->json([
            'enabled' => true,
            'rows' => $rows,
            'timeline' => $rows,
        ]);
    }

    public function updateTimelineSetting(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $enabled = (bool) $validated['enabled'];
        Setting::setBoolean(self::TIMELINE_ENABLED_SETTING, $enabled);

        return response()->json([
            'message' => 'Timeline setting updated successfully.',
            'settings' => [
                'timelineEnabled' => $enabled,
            ],
        ]);
    }

    public function updateSiteLogo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'logoDataUrl' => ['nullable', 'string', 'max:3000000'],
        ]);

        $logoDataUrl = trim((string) ($validated['logoDataUrl'] ?? ''));

        if ($logoDataUrl !== '') {
            if (preg_match('/^data:image\/(png|jpe?g|webp|gif);base64,([a-z0-9+\/\r\n=]+)$/i', $logoDataUrl, $matches) !== 1) {
                throw ValidationException::withMessages([
                    'logoDataUrl' => ['Upload a PNG, JPEG, WebP, or GIF image.'],
                ]);
            }

            $bytes = base64_decode($matches[2], true);

            if ($bytes === false || strlen($bytes) > self::MAX_SITE_LOGO_BYTES) {
                throw ValidationException::withMessages([
                    'logoDataUrl' => ['The logo must be 2 MB or smaller.'],
                ]);
            }
        }

        Setting::setValue(self::SITE_LOGO_SETTING, $logoDataUrl);

        return response()->json([
            'message' => $logoDataUrl === '' ? 'Site logo reset to the default.' : 'Site logo updated successfully.',
            'settings' => [
                'logoUrl' => $logoDataUrl,
            ],
        ]);
    }

    public function timelineDetails(Request $request, TimelineEntry $timelineEntry): JsonResponse
    {
        if (!Schema::hasTable('timeline_entries')) {
            return response()->json([
                'selected' => null,
                'user' => null,
                'stats' => null,
                'activities' => [],
                'pagination' => [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => 3,
                    'total' => 0,
                    'from' => 0,
                    'to' => 0,
                ],
            ], 404);
        }

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(10, (int) $request->query('per_page', 3)));
        $userId = $timelineEntry->user_id;
        $userName = trim((string) ($timelineEntry->user_name ?? ''));
        $linkedUser = $this->resolveTimelineLinkedUser($userId, $userName);
        $userAvatar = $timelineEntry->user_avatar ?? $this->resolveUserAvatar($linkedUser);

        $baseQuery = TimelineEntry::query()
            ->where(function ($query) use ($userId, $userName): void {
                $query->where('user_id', $userId);

                if ($userName !== '') {
                    $query->orWhere('user_name', $userName);
                }
            });

        $activityCount = (clone $baseQuery)->count();
        $coinsEarned = (float) (clone $baseQuery)->sum('currency_reward');

        $withdrawalsQuery = Transaction::query()
            ->where(function ($query) use ($userId, $userName): void {
                $query->where('user_id', $userId);

                if ($userName !== '') {
                    $query->orWhere('user_name', $userName);
                }
            })
            ->where(function ($query): void {
                $query->where('type', 'like', 'withdrawal%')
                    ->orWhere('reference_type', 'like', 'withdrawal%');
            });

        $withdrawalsTotal = abs((float) (clone $withdrawalsQuery)->sum('amount'));
        $country = $timelineEntry->country ?? $linkedUser?->country ?? 'unknown';

        /** @var \Illuminate\Pagination\LengthAwarePaginator $paginator */
        $paginator = $baseQuery
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        $activities = $paginator->getCollection()
            ->map(fn (TimelineEntry $entry) => $this->formatTimelineEntry($entry))
            ->values();

        return response()->json([
            'selected' => $this->formatTimelineEntry($timelineEntry),
            'user' => [
                'userId' => $timelineEntry->user_id,
                'userName' => $timelineEntry->user_name ?? 'Anonymous',
                'userAvatar' => $userAvatar,
                'country' => $country,
                'levelLabel' => $this->resolveTimelineLevelLabel($coinsEarned),
            ],
            'stats' => [
                'activities' => $activityCount,
                'coinsEarned' => number_format($coinsEarned, 2, '.', ''),
                'withdrawals' => number_format($withdrawalsTotal, 2, '.', ''),
            ],
            'activities' => $activities,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem() ?? 0,
                'to' => $paginator->lastItem() ?? 0,
            ],
        ]);
    }

    public function completedTasks(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $requestedPerPage = strtolower(trim((string) $request->query('per_page', '10')));
        $hasUserUsernameColumn = Schema::hasTable('users') && Schema::hasColumn('users', 'username');
        $query = CompletedTask::query()
            ->leftJoin('users as task_users_by_id', 'task_users_by_id.id', '=', 'completed_tasks.user_id');

        if ($hasUserUsernameColumn) {
            $query->leftJoin('users as task_users_by_name', 'task_users_by_name.username', '=', 'completed_tasks.user_name');
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function ($builder) use ($escapedSearch, $search, $hasUserUsernameColumn): void {
                $like = '%'.$escapedSearch.'%';

                $builder
                    ->where('offer_wall_name', 'like', $like)
                    ->orWhere('user_name', 'like', $like)
                    ->orWhere('transaction_id', 'like', $like)
                    ->orWhere('offer_name', 'like', $like)
                    ->orWhere('offer_id', 'like', $like)
                    ->orWhere('task_users_by_id.email', 'like', $like)
                    ->orWhere('completed_tasks.ip', 'like', $like)
                    ->orWhere('completed_tasks.country', 'like', $like);

                if ($hasUserUsernameColumn) {
                    $builder->orWhere('task_users_by_name.email', 'like', $like);
                }

                if (is_numeric($search)) {
                    $builder->orWhere('completed_tasks.id', (int) $search)
                        ->orWhere('completed_tasks.user_id', (int) $search);
                }
            });
        }

        $allowedPerPageOptions = [10, 20, 30, 50, 100, 500];

        if ($requestedPerPage === 'all') {
            $perPage = max(1, (clone $query)->count());
        } else {
            $requestedPerPageInt = (int) $requestedPerPage;
            $perPage = in_array($requestedPerPageInt, $allowedPerPageOptions, true)
                ? $requestedPerPageInt
                : 10;
        }

        $paginator = $query
            ->orderByDesc('completed_tasks.created_at')
            ->paginate(
                $perPage,
                [
                    'completed_tasks.id as id',
                    'completed_tasks.offer_wall_name as offer_wall_name',
                    'completed_tasks.user_id as user_id',
                    'completed_tasks.user_name as user_name',
                    DB::raw($hasUserUsernameColumn
                        ? 'COALESCE(task_users_by_id.email, task_users_by_name.email) as user_email'
                        : 'task_users_by_id.email as user_email'),
                    'completed_tasks.transaction_id as transaction_id',
                    'completed_tasks.offer_name as offer_name',
                    'completed_tasks.offer_id as offer_id',
                    'completed_tasks.revenue as revenue',
                    'completed_tasks.currency_reward as currency_reward',
                    'completed_tasks.ip as ip',
                    'completed_tasks.country as country',
                    'completed_tasks.created_at as created_at',
                ],
                'page',
                $page,
            );

        $rows = collect($paginator->items())
            ->map(fn (CompletedTask $task) => [
                'id' => $task->id,
                'offerWall' => $task->offer_wall_name ?? '-',
                'userId' => $task->user_id,
                'userName' => $task->user_name ?? '-',
                'userEmail' => $task->user_email ?? '-',
                'transactionId' => $task->transaction_id,
                'offerName' => $task->offer_name ?? '-',
                'offerId' => $task->offer_id ?? '-',
                'payout' => number_format((float) $task->revenue, 2, '.', ''),
                'revenue' => number_format((float) $task->revenue, 2, '.', ''),
                'currencyReward' => number_format((float) $task->currency_reward, 2, '.', ''),
                'ip' => $task->ip ?? '-',
                'country' => $task->country ?? '-',
                'date' => $task->created_at?->toAtomString(),
            ])
            ->values();

        return response()->json([
            'rows' => $rows,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function chargebacks(Request $request): JsonResponse
    {
        $perPage = 10;
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $query = Chargeback::query();

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function ($builder) use ($escapedSearch, $search): void {
                $like = '%'.$escapedSearch.'%';

                $builder
                    ->where('offer_wall_name', 'like', $like)
                    ->orWhere('user_name', 'like', $like)
                    ->orWhere('transaction_id', 'like', $like)
                    ->orWhere('offer_name', 'like', $like)
                    ->orWhere('offer_id', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('reason', 'like', $like)
                    ->orWhere('ip', 'like', $like)
                    ->orWhere('country', 'like', $like);

                if (is_numeric($search)) {
                    $builder->orWhere('id', (int) $search)
                        ->orWhere('user_id', (int) $search)
                        ->orWhere('currency_reward', (float) $search);
                }
            });
        }

        $totalChargebackAmount = abs((float) (clone $query)->sum('currency_reward'));

        $paginator = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                $perPage,
                [
                    'id',
                    'offer_wall_name',
                    'user_id',
                    'user_name',
                    'transaction_id',
                    'offer_name',
                    'offer_id',
                    'revenue',
                    'currency_reward',
                    'ip',
                    'country',
                    'status',
                    'reason',
                    'created_at',
                ],
                'page',
                $page,
            );

        $rows = collect($paginator->items())
            ->map(fn (Chargeback $chargeback) => [
                'id' => $chargeback->id,
                'offerWall' => $chargeback->offer_wall_name ?? '-',
                'userId' => $chargeback->user_id,
                'userName' => $chargeback->user_name ?? '-',
                'transactionId' => $chargeback->transaction_id ?? (string) $chargeback->id,
                'offerName' => $chargeback->offer_name ?? '-',
                'offerId' => $chargeback->offer_id ?? '-',
                'revenue' => number_format((float) $chargeback->revenue, 2, '.', ''),
                'amount' => number_format((float) $chargeback->currency_reward, 2, '.', ''),
                'currencyReward' => number_format((float) $chargeback->currency_reward, 2, '.', ''),
                'ip' => $chargeback->ip ?? '-',
                'country' => $chargeback->country ?? '-',
                'status' => $chargeback->status ?? 'pending',
                'reason' => $chargeback->reason ?? '-',
                'date' => $chargeback->created_at?->toAtomString(),
            ])
            ->values();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'total' => $paginator->total(),
                'totalChargebackAmount' => number_format($totalChargebackAmount, 2, '.', ''),
            ],
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function pendingWithdrawals(Request $request): JsonResponse
    {
        $perPage = 10;
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $query = Transaction::query()
            ->where('type', 'like', 'withdrawal%')
            ->where('status', 'pending');

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function ($builder) use ($escapedSearch, $search): void {
                $like = '%'.$escapedSearch.'%';

                $builder
                    ->where('user_name', 'like', $like)
                    ->orWhere('transaction_id', 'like', $like)
                    ->orWhere('title', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('meta', 'like', $like);

                if (is_numeric($search)) {
                    $builder->orWhere('id', (int) $search)
                        ->orWhere('user_id', (int) $search)
                        ->orWhere('amount', (float) $search);
                }
            });
        }

        $totalPendingAmount = abs((float) (clone $query)->sum('amount'));

        $paginator = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                $perPage,
                [
                    'id',
                    'user_id',
                    'user_name',
                    'type',
                    'status',
                    'amount',
                    'transaction_id',
                    'title',
                    'description',
                    'meta',
                    'created_at',
                ],
                'page',
                $page,
            );

        $rows = collect($paginator->items())
            ->map(fn (Transaction $withdrawal) => $this->formatPendingWithdrawal($withdrawal))
            ->values();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'total' => $paginator->total(),
                'totalPendingAmount' => number_format($totalPendingAmount, 2, '.', ''),
            ],
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function allWithdrawals(Request $request): JsonResponse
    {
        $perPage = 10;
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $query = Transaction::query()
            ->where('type', 'like', 'withdrawal%');

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function ($builder) use ($escapedSearch, $search): void {
                $like = '%'.$escapedSearch.'%';

                $builder
                    ->where('user_name', 'like', $like)
                    ->orWhere('transaction_id', 'like', $like)
                    ->orWhere('title', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('meta', 'like', $like);

                if (is_numeric($search)) {
                    $builder->orWhere('id', (int) $search)
                        ->orWhere('user_id', (int) $search)
                        ->orWhere('amount', (float) $search);
                }
            });
        }

        $totalWithdrawalAmount = abs((float) (clone $query)->sum('amount'));

        $paginator = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                $perPage,
                [
                    'id',
                    'user_id',
                    'user_name',
                    'type',
                    'status',
                    'amount',
                    'transaction_id',
                    'title',
                    'description',
                    'meta',
                    'created_at',
                ],
                'page',
                $page,
            );

        $rows = collect($paginator->items())
            ->map(fn (Transaction $withdrawal) => $this->formatPendingWithdrawal($withdrawal))
            ->values();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'total' => $paginator->total(),
                'totalWithdrawalAmount' => number_format($totalWithdrawalAmount, 2, '.', ''),
            ],
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function updatePendingWithdrawal(Request $request, Transaction $withdrawal): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject', 'refund'])],
        ]);

        if (!str_starts_with((string) ($withdrawal->type ?? ''), 'withdrawal')) {
            return response()->json([
                'message' => 'The selected withdrawal is unavailable.',
            ], 404);
        }

        $action = (string) $validated['action'];
        $withdrawalId = $withdrawal->id;
        $updatedWithdrawal = null;
        $updatedUser = null;

        DB::transaction(function () use ($withdrawalId, $action, &$updatedWithdrawal, &$updatedUser): void {
            $lockedWithdrawal = Transaction::query()
                ->whereKey($withdrawalId)
                ->lockForUpdate()
                ->first();

            if (!$lockedWithdrawal) {
                throw ValidationException::withMessages([
                    'action' => ['The selected withdrawal could not be found.'],
                ]);
            }

            if (($lockedWithdrawal->status ?? '') !== 'pending') {
                throw ValidationException::withMessages([
                    'action' => ['This withdrawal has already been processed.'],
                ]);
            }

            $lockedUser = User::query()
                ->whereKey($lockedWithdrawal->user_id)
                ->lockForUpdate()
                ->first();

            if (!$lockedUser) {
                throw ValidationException::withMessages([
                    'action' => ['The withdrawal user could not be found.'],
                ]);
            }

            $amount = round(abs((float) $lockedWithdrawal->amount), 2);
            $methodName = $this->firstNonEmptyString(
                data_get($this->decodeTransactionMeta($lockedWithdrawal->meta), 'cashoutMethodName'),
                data_get($this->decodeTransactionMeta($lockedWithdrawal->meta), 'walletName'),
                $lockedWithdrawal->title,
                'Withdrawal',
            );
            $status = match ($action) {
                'approve' => 'approved',
                'reject' => 'rejected',
                'refund' => 'refunded',
                default => 'pending',
            };
            $notificationTitle = match ($action) {
                'approve' => 'Withdrawal approved',
                'reject' => 'Withdrawal rejected',
                'refund' => 'Withdrawal refunded',
                default => 'Withdrawal updated',
            };
            $notificationMessage = match ($action) {
                'approve' => 'Your '.$this->formatMoney($amount).' withdrawal via '.$methodName.' has been approved.',
                'reject' => 'Your '.$this->formatMoney($amount).' withdrawal via '.$methodName.' has been rejected.',
                'refund' => 'Your '.$this->formatMoney($amount).' withdrawal via '.$methodName.' has been refunded to your balance.',
                default => 'Your withdrawal status has been updated.',
            };

            if ($action === 'refund') {
                $lockedUser->increment('balance', $amount);
            }

            $lockedWithdrawal->status = $status;
            $lockedWithdrawal->description = $action === 'approve'
                ? 'Withdrawal approved by admin'
                : 'Withdrawal '.$status.' by admin';
            $lockedWithdrawal->save();

            UserNotification::create([
                'user_id' => $lockedUser->id,
                'type' => 'withdrawal',
                'icon' => 'wallet',
                'title' => $notificationTitle,
                'message' => $notificationMessage,
                'data' => [
                    'transactionId' => $lockedWithdrawal->transaction_id ?? (string) $lockedWithdrawal->id,
                    'withdrawalId' => $lockedWithdrawal->id,
                    'cashoutMethodName' => $methodName,
                    'amount' => $amount,
                    'status' => $status,
                    'action' => $action,
                ],
            ]);

            $updatedWithdrawal = $lockedWithdrawal->refresh();
            $updatedUser = $lockedUser->refresh();
        });

        return response()->json([
            'message' => match ($action) {
                'approve' => 'Withdrawal approved successfully.',
                'reject' => 'Withdrawal rejected successfully.',
                'refund' => 'Withdrawal refunded successfully.',
                default => 'Withdrawal updated successfully.',
            },
            'withdrawal' => $updatedWithdrawal ? $this->formatPendingWithdrawal($updatedWithdrawal) : null,
            'user' => $updatedUser ? $this->formatAdminUser($updatedUser) : null,
        ]);
    }

    public function destroyCompletedTask(string $completedTask): JsonResponse
    {
        $task = CompletedTask::query()->findOrFail((int) $completedTask);
        $task->delete();

        return response()->json([
            'message' => 'Completed task deleted successfully.',
        ]);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $original = $user->only(['role', 'balance', 'level', 'ban']);
        $validated = $request->validate([
            'role' => ['required', Rule::in(['admin', 'user'])],
            'balance' => ['required', 'numeric', 'min:0'],
            'level' => ['required', 'integer', 'min:1'],
            'ban' => ['sometimes', 'boolean'],
        ]);
        $nextBan = array_key_exists('ban', $validated) ? (bool) $validated['ban'] : (bool) $original['ban'];

        $user->update($validated);

        $changes = [];

        if ($original['role'] !== $validated['role']) {
            $changes[] = "role changed to {$validated['role']}";
        }

        if ((string) $original['balance'] !== (string) $validated['balance']) {
            $changes[] = 'balance updated';
        }

        if ((string) $original['level'] !== (string) $validated['level']) {
            $changes[] = "level updated to {$validated['level']}";
        }

        if ((bool) $original['ban'] !== $nextBan) {
            $changes[] = $nextBan ? 'account banned' : 'account unbanned';
        }

        if ($changes !== []) {
            UserNotification::create([
                'user_id' => $user->id,
                'type' => 'account_update',
                'icon' => 'shield',
                'title' => 'Your account was updated',
                'message' => 'An administrator updated your account: '.implode(', ', $changes).'.',
                'data' => [
                    'changes' => $changes,
                ],
            ]);
        }

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->refresh(),
        ]);
    }

    public function bulkUsers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:users,id'],
            'action' => ['required', Rule::in(['ban', 'delete'])],
        ]);

        $currentUserId = $request->user('api')?->id;
        $query = User::query()
            ->whereIn('id', $validated['ids'])
            ->where('role', '!=', 'admin');

        if ($currentUserId) {
            $query->where('id', '!=', $currentUserId);
        }

        $targetUsers = $query->get(['id', 'username', 'email']);

        $affectedCount = 0;

        if ($validated['action'] === 'delete') {
            $affectedCount = $query->count();
            $query->delete();
        } else {
            $affectedCount = $query->update(['ban' => true]);

            foreach ($targetUsers as $targetUser) {
                UserNotification::create([
                    'user_id' => $targetUser->id,
                    'type' => 'account_update',
                    'icon' => 'ban',
                    'title' => 'Your account was banned',
                    'message' => 'An administrator has banned your account.',
                    'data' => [
                        'action' => 'ban',
                    ],
                ]);
            }
        }

        return response()->json([
            'message' => $validated['action'] === 'delete'
                ? 'Selected users deleted successfully.'
                : 'Selected users banned successfully.',
            'affected' => $affectedCount,
        ]);
    }

    public function cashoutMethods(): JsonResponse
    {
        if (!Schema::hasTable('cashout_methods')) {
            return response()->json([
                'columns' => [],
                'rows' => [],
            ]);
        }

        $schema = $this->cashoutMethodSchema();
        $columns = array_map(fn (array $column): string => $column['field'], $schema);

        if ($columns === []) {
            return response()->json([
                'columns' => [],
                'rows' => [],
            ]);
        }

        $query = DB::table('cashout_methods')->select($columns);

        foreach ($this->cashoutMethodOrderColumns($schema) as $orderColumn) {
            $query->orderBy($orderColumn);
        }

        return response()->json([
            'columns' => $columns,
            'rows' => $query->get(),
        ]);
    }

    public function offerwalls(Request $request): JsonResponse
    {
        $query = $this->orderedOfferwallQuery();

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        $rows = $query->get()
            ->values()
            ->map(fn (Offerwall $offerwall, int $index) => $this->formatOfferwall($offerwall, $index + 1));

        return response()->json([
            'rows' => $rows,
            'data' => $rows,
            'offers' => $rows,
        ]);
    }

    public function storeCashoutMethod(Request $request): JsonResponse
    {
        if (!Schema::hasTable('cashout_methods')) {
            return response()->json([
                'message' => 'Cashout methods table not found.',
            ], 404);
        }

        $schema = $this->cashoutMethodSchema();
        $validated = $request->validate($this->cashoutMethodValidationRules($schema));
        $payload = $this->cashoutMethodPayload($validated, $schema, true);

        if ($payload === []) {
            return response()->json([
                'message' => 'No writable cashout method columns were found.',
            ], 422);
        }

        $id = DB::table('cashout_methods')->insertGetId($payload);
        $method = $this->findCashoutMethodRowById($id, $schema);

        return response()->json([
            'message' => 'Cashout method created successfully.',
            'method' => $method,
        ], 201);
    }

    public function updateCashoutMethod(Request $request, CashoutMethod $cashoutMethod): JsonResponse
    {
        if (!Schema::hasTable('cashout_methods')) {
            return response()->json([
                'message' => 'Cashout methods table not found.',
            ], 404);
        }

        $schema = $this->cashoutMethodSchema();
        $validated = $request->validate($this->cashoutMethodValidationRules($schema));
        $payload = $this->cashoutMethodPayload($validated, $schema, false);

        if ($payload === []) {
            return response()->json([
                'message' => 'No writable cashout method columns were found.',
            ], 422);
        }

        DB::table('cashout_methods')->where('id', $cashoutMethod->id)->update($payload);
        $method = $this->findCashoutMethodRowById($cashoutMethod->id, $schema);

        return response()->json([
            'message' => 'Cashout method updated successfully.',
            'method' => $method,
        ]);
    }

    public function destroyCashoutMethod(CashoutMethod $cashoutMethod): JsonResponse
    {
        if (Schema::hasTable('cashout_methods')) {
            DB::table('cashout_methods')->where('id', $cashoutMethod->id)->delete();
        }

        return response()->json([
            'message' => 'Cashout method deleted successfully.',
        ]);
    }

    public function storeOfferwall(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'badge' => ['nullable', 'string', 'max:40'],
            'logo_url' => ['required', 'string', 'max:65535'],
            'category' => ['nullable', 'string', 'max:255'],
            'iframe_url' => ['required', 'string', 'max:2000'],
            'rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:1'],
            'unlock_level' => ['required', 'integer', 'min:1', 'max:10'],
            'postback_slug' => ['nullable', 'string', 'max:255'],
            'postback_parameters' => ['nullable'],
            'postback_signature_required' => ['sometimes', 'boolean'],
            'postback_whitelist_ip_required' => ['sometimes', 'boolean'],
            'postback_whitelist_ips' => ['nullable'],
        ]);

        $offerwall = new Offerwall();
        $this->fillOfferwall($offerwall, $validated, null);
        $offerwall->save();
        $this->applyOfferwallOrder($offerwall->id, $validated['sort_order'], $validated['category'] ?? null);

        return response()->json([
            'message' => 'Offerwall created successfully.',
            'offerwall' => $this->formatOfferwall($offerwall->refresh()),
        ], 201);
    }

    public function updateOfferwall(Request $request, Offerwall $offerwall): JsonResponse
    {
        $categoryColumn = $this->offerwallCategoryColumn();
        $previousCategory = $categoryColumn !== null ? $this->normalizeOfferwallCategoryValue($offerwall->{$categoryColumn} ?? null) : 'offerwall';
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'badge' => ['nullable', 'string', 'max:40'],
            'logo_url' => ['sometimes', 'string', 'max:65535'],
            'category' => ['nullable', 'string', 'max:255'],
            'iframe_url' => ['sometimes', 'string', 'max:2000'],
            'rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:1'],
            'unlock_level' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'postback_slug' => ['nullable', 'string', 'max:255'],
            'postback_parameters' => ['nullable'],
            'postback_signature_required' => ['sometimes', 'boolean'],
            'postback_whitelist_ip_required' => ['sometimes', 'boolean'],
            'postback_whitelist_ips' => ['nullable'],
        ]);

        $this->fillOfferwall($offerwall, $validated, $offerwall->id);
        $offerwall->save();
        $newCategory = $categoryColumn !== null ? $this->normalizeOfferwallCategoryValue($offerwall->{$categoryColumn} ?? null) : 'offerwall';

        if (array_key_exists('sort_order', $validated) || $previousCategory !== $newCategory) {
            $this->applyOfferwallOrder($offerwall->id, $validated['sort_order'] ?? null, $newCategory);
        }

        if ($previousCategory !== $newCategory) {
            $this->reindexOfferwallOrders($previousCategory);
        }

        return response()->json([
            'message' => 'Offerwall updated successfully.',
            'offerwall' => $this->formatOfferwall($offerwall->refresh()),
        ]);
    }

    public function destroyOfferwall(Offerwall $offerwall): JsonResponse
    {
        $categoryColumn = $this->offerwallCategoryColumn();
        $category = $categoryColumn !== null ? $this->normalizeOfferwallCategoryValue($offerwall->{$categoryColumn} ?? null) : 'offerwall';
        $offerwall->delete();
        $this->reindexOfferwallOrders($category);

        return response()->json([
            'message' => 'Offerwall deleted successfully.',
        ]);
    }

    public function offerwallPostback(Request $request, string $slug): Response|JsonResponse
    {
        $offerwall = $this->resolveOfferwallForPostback($slug);
        if (!$offerwall || !(bool) ($offerwall->is_active ?? true)) {
            return $this->postbackAcknowledgementResponse();
        }

        $parameterMap = $this->normalizePostbackParameters($offerwall->postback_parameters ?? []);
        $offerwallName = $this->firstNonEmptyString(
            $offerwall->name ?? null,
            $offerwall->offer_wall_name ?? null,
            $slug,
        );
        $offerwallSlug = $this->sanitizeOfferwallSlug((string) ($offerwall->postback_slug ?? $offerwallName));

        $userIdValue = $this->resolvePostbackValue($request, 'userId', $parameterMap, null);
        $userId = $userIdValue === null || trim((string) $userIdValue) === '' ? 0 : (int) $userIdValue;
        $transactionId = trim((string) $this->resolvePostbackValue($request, 'transactionId', $parameterMap, ''));
        $revenue = (float) $this->resolvePostbackValue($request, 'revenue', $parameterMap, 0);
        $reward = (float) $this->resolvePostbackValue($request, 'reward', $parameterMap, $revenue);
        $rawOfferName = $this->resolvePostbackValue($request, 'offerName', $parameterMap, null);
        $offerName = trim((string) $rawOfferName);
        $offerId = trim((string) $this->resolvePostbackValue($request, 'offerId', $parameterMap, ''));
        if ($offerName === '' || strcasecmp($offerName, 'Offer') === 0) {
            if ($offerId !== '') {
                $offerName = is_numeric($offerId) ? 'Offer #' . $offerId : $offerId;
            } else {
                $offerName = 'Offer';
            }
        }
        $status = $this->normalizePostbackStatus(
            $this->resolvePostbackValue($request, 'status', $parameterMap, 'approved')
        );
        $requestIp = trim((string) (app(IpCountryResolver::class)->resolveClientIp($request) ?? ''));
        $postbackIp = trim((string) $this->resolvePostbackValue($request, 'ip', $parameterMap, ''));
        $country = trim((string) $this->resolvePostbackValue($request, 'country', $parameterMap, ''));
        if ($country === '') {
            $country = app(IpCountryResolver::class)->countryFromIp($postbackIp !== '' ? $postbackIp : null, $request);
        }
        $country = $country !== '' ? $country : null;

        if ($transactionId === '') {
            $transactionId = (string) Str::uuid();
        }

        // Handle Incoming Postback Test cleanly without crediting real balance
        if ($request->boolean('is_test') || $request->query('is_test') === '1' || $request->input('is_test') === '1' || $request->query('test') === '1' || $request->query('dry_run') === '1') {
            $testUser = $userId > 0 ? User::query()->where('id', $userId)->first() : User::query()->first();
            if ($testUser instanceof User && $userId <= 0) {
                $userId = $testUser->id;
            }

            $serverReached = true;
            $providerFound = $offerwall instanceof Offerwall;
            $mappingLoaded = !empty($parameterMap);
            $userIdResolved = $testUser instanceof User;
            $transactionParsed = $transactionId !== '';
            $rewardParsed = $reward >= 0;
            $statusParsed = in_array($status, ['approved', 'chargeback', 'pending'], true);

            $testPass = $providerFound && $mappingLoaded && $userIdResolved && $transactionParsed && $rewardParsed && $statusParsed;

            return response()->json([
                'success' => $testPass,
                'status' => $testPass ? 'PASS' : 'FAIL',
                'result' => $testPass ? 'PASS' : 'FAIL',
                'message' => $testPass
                    ? "Incoming Postback Test PASS: Callback reached server, provider '{$offerwallName}' loaded mapping, User #{$userId} verified, transaction '{$transactionId}' parsed, reward {$reward} coins."
                    : "Incoming Postback Test FAIL: User #{$userId} not found or required parameters missing.",
                'is_test' => true,
                'checks' => [
                    'callback_reached_server' => 'YES',
                    'provider_found' => $providerFound ? 'YES' : 'NO',
                    'mapping_loaded' => $mappingLoaded ? 'YES' : 'NO',
                    'user_id_resolved' => $userIdResolved ? 'YES' : 'NO',
                    'transaction_parsed' => $transactionParsed ? 'YES' : 'NO',
                    'reward_parsed' => $rewardParsed ? 'YES' : 'NO',
                    'status_parsed' => $statusParsed ? 'YES' : 'NO',
                ],
                'resolved' => [
                    'user_id' => $userId,
                    'user_exists' => $testUser instanceof User,
                    'username' => $testUser?->username ?? $testUser?->name,
                    'transaction_id' => $transactionId,
                    'reward' => $reward,
                    'payout' => $revenue,
                    'status' => $status,
                    'offer_name' => $offerName,
                    'offer_id' => $offerId,
                    'ip' => $requestIp,
                    'country' => $country,
                ],
            ], $testPass ? 200 : 422);
        }

        $whitelistRequired = (bool) ($offerwall->postback_whitelist_ip_required ?? false);
        $whitelistIps = $this->normalizeWhitelistIps($offerwall->postback_whitelist_ips ?? []);
        if ($whitelistRequired && $whitelistIps !== [] && !in_array($requestIp, $whitelistIps, true)) {
            // Postback providers expect an acknowledgement even when a callback
            // cannot be processed. Do not expose a validation or access error.
            return $this->postbackAcknowledgementResponse();
        }

        $existingCompletedTask = CompletedTask::query()
            ->where('transaction_id', $transactionId)
            ->first();
        $existingChargeback = Chargeback::query()
            ->where('transaction_id', $transactionId)
            ->first();

        if ($status === 'pending') {
            return $this->postbackAcknowledgementResponse();
        }

        $user = User::query()->where('id', $userId)->first();
        $hasRealUser = $user instanceof User;

        if ($hasRealUser) {
            $unlockLevel = max(1, (int) ($offerwall->unlock_level ?? 1));
            $currentLevel = max(1, (int) ($user->level ?? 1));
            if ($status === 'approved' && $currentLevel < $unlockLevel) {
                return $this->postbackAcknowledgementResponse();
            }
        }

        if (!$hasRealUser) {
            if ($status === 'chargeback' || $existingCompletedTask || $existingChargeback) {
                return $this->postbackAcknowledgementResponse();
            }

            CompletedTask::create([
                'offer_wall_name' => $offerwallSlug,
                'user_id' => 0,
                'user_name' => 'anonymous',
                'transaction_id' => $transactionId,
                'offer_name' => $offerName,
                'offer_id' => $offerId !== '' ? $offerId : null,
                'revenue' => round($revenue, 2),
                'currency_reward' => round($reward, 2),
                'ip' => $requestIp !== '' ? $requestIp : null,
                'country' => $country ?? 'unknown',
            ]);

            return $this->postbackAcknowledgementResponse();
        }

        if ($status === 'chargeback') {
            if ($existingChargeback) {
                return $this->postbackAcknowledgementResponse();
            }

            DB::transaction(function () use (
                $offerwallSlug,
                $offerwallName,
                $requestIp,
                $country,
                $transactionId,
                $offerName,
                $offerId,
                $revenue,
                $reward,
                $user,
                $existingCompletedTask
            ): void {
                $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();
                if (!$lockedUser) {
                    return;
                }

                $reversalAmount = abs((float) ($existingCompletedTask?->currency_reward ?? $reward));

                if ($existingCompletedTask) {
                    $existingCompletedTask->delete();
                }

                $lockedUser->decrement('balance', $reversalAmount);

                $chargeback = Chargeback::create([
                    'offer_wall_name' => $offerwallSlug,
                    'user_id' => $lockedUser->id,
                    'user_name' => $lockedUser->username,
                    'transaction_id' => $transactionId,
                    'offer_name' => $offerName,
                    'offer_id' => $offerId !== '' ? $offerId : null,
                    'revenue' => round($revenue, 2),
                    'currency_reward' => round($reversalAmount, 2),
                    'ip' => $requestIp !== '' ? $requestIp : null,
                    'country' => $country ?? 'unknown',
                    'status' => 'chargeback',
                ]);

                Transaction::create([
                    'user_id' => $lockedUser->id,
                    'user_name' => $lockedUser->username,
                    'type' => 'chargeback',
                    'status' => 'approved',
                    'amount' => -round($reversalAmount, 2),
                    'reference_type' => 'chargeback',
                    'reference_id' => $chargeback->id,
                    'transaction_id' => $transactionId,
                    'title' => $offerName,
                    'description' => 'Offerwall: '.$offerwallName,
                    'meta' => json_encode([
                        'offerWallName' => $offerwallSlug,
                        'offerId' => $offerId,
                    ], JSON_UNESCAPED_UNICODE),
                ]);

                UserNotification::create([
                    'user_id' => $lockedUser->id,
                    'type' => 'chargeback',
                    'icon' => 'rotate-ccw',
                    'title' => 'Chargeback received',
                    'message' => 'you have a charge back '.$this->normalizeMoney($reversalAmount).' from '.$offerwallSlug,
                ]);
            });

            return $this->postbackAcknowledgementResponse();
        }

        if ($existingCompletedTask || $existingChargeback) {
            return $this->postbackAcknowledgementResponse();
        }

        DB::transaction(function () use (
            $offerwallSlug,
            $offerwallName,
                $requestIp,
                $country,
                $transactionId,
                $offerName,
            $offerId,
            $revenue,
            $reward,
            $user
        ): void {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (!$lockedUser) {
                return;
            }

            $completedTask = CompletedTask::create([
                'offer_wall_name' => $offerwallSlug,
                'user_id' => $lockedUser->id,
                'user_name' => $lockedUser->username,
                'transaction_id' => $transactionId,
                'offer_name' => $offerName,
                'offer_id' => $offerId !== '' ? $offerId : null,
                'revenue' => round($revenue, 2),
                'currency_reward' => round($reward, 2),
                'ip' => $requestIp !== '' ? $requestIp : null,
                'country' => $country ?? 'unknown',
            ]);

            Transaction::create([
                'user_id' => $lockedUser->id,
                'user_name' => $lockedUser->username,
                'type' => 'completed_task',
                'status' => 'completed',
                'amount' => round($reward, 2),
                'reference_type' => 'completed_task',
                'reference_id' => $completedTask->id,
                'transaction_id' => $transactionId,
                'title' => $offerName,
                'description' => 'Offerwall: '.$offerwallName,
                'meta' => json_encode([
                    'offerWallName' => $offerwallSlug,
                    'offerId' => $offerId,
                ], JSON_UNESCAPED_UNICODE),
            ]);

            $lockedUser->increment('balance', round($reward, 2));

            if (Schema::hasTable('timeline_entries')) {
                TimelineEntry::query()->create([
                    'user_id' => $lockedUser->id,
                    'user_name' => $lockedUser->username,
                    'user_avatar' => $this->resolveUserAvatar($lockedUser),
                    'offer_wall_name' => $offerwallSlug,
                    'offer_name' => $offerName,
                    'task_id' => $offerId !== '' ? $offerId : $transactionId,
                    'currency_reward' => round($reward, 2),
                    'country' => $country ?? ($lockedUser->country ?? 'unknown'),
                    'ip' => $requestIp !== '' ? $requestIp : null,
                    'status' => 'approved',
                    'meta' => [
                        'offerWallName' => $offerwallSlug,
                        'offerId' => $offerId !== '' ? $offerId : null,
                        'transactionId' => $transactionId,
                    ],
                    'type' => 'completed_task',
                ]);
            }

            UserNotification::create([
                'user_id' => $lockedUser->id,
                'type' => 'task_completed',
                'icon' => 'coins',
                'title' => 'You have received '.$this->normalizeMoney($reward).' coins from '.$offerwallSlug.' for '.$offerName,
                'message' => null,
            ]);
        });

        return $this->postbackAcknowledgementResponse();
    }

    private function postbackAcknowledgementResponse(): Response
    {
        return response('Ok', 200)->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    private function formatTimelineEntry(TimelineEntry $entry): array
    {
        $linkedUser = $this->resolveTimelineLinkedUser($entry->user_id, $entry->user_name);
        $userAvatar = $entry->user_avatar ?? $this->resolveUserAvatar($linkedUser);
        $country = $entry->country ?? $linkedUser?->country ?? 'unknown';

        return [
            'id' => $entry->id,
            'userId' => $entry->user_id,
            'userName' => $entry->user_name ?? 'Anonymous',
            'userAvatar' => $userAvatar,
            'offerWallName' => $entry->offer_wall_name ?? 'Offerwall',
            'offerName' => $entry->offer_name ?? 'Completed task',
            'taskId' => $entry->task_id ?? (string) $entry->id,
            'currencyReward' => number_format((float) $entry->currency_reward, 2, '.', ''),
            'country' => $country,
            'ip' => $entry->ip ?? '',
            'type' => $entry->type ?? 'completed_task',
            'status' => $entry->status ?? 'approved',
            'meta' => $entry->meta ?? [],
            'createdAt' => $entry->created_at?->toAtomString(),
        ];
    }

    private function resolveTimelineLinkedUser(?int $userId, ?string $userName): ?User
    {
        $query = User::query();
        $hasUserId = $userId !== null;
        $hasUserName = trim((string) $userName) !== '';

        if ($hasUserId) {
            $query->where('id', $userId);
        }

        if ($hasUserName) {
            if ($hasUserId) {
                $query->orWhere('username', $userName);
            } else {
                $query->where('username', $userName);
            }
        }

        return $hasUserId || $hasUserName ? $query->first() : null;
    }

    private function resolveUserAvatar(?User $user): ?string
    {
        $avatar = trim((string) ($user?->user_avatar ?? ''));

        return $avatar !== '' ? $avatar : null;
    }

    private function resolveTimelineLevelLabel(float $coinsEarned): string
    {
        $level = max(1, min(9, (int) floor($coinsEarned / 1000) + 1));

        return 'Level '.$level;
    }

    private function resolveOfferwallForPostback(string $slug): ?Offerwall
    {
        $normalizedSlug = $this->sanitizeOfferwallSlug($slug);
        if ($normalizedSlug === '') {
            return null;
        }

        $offerwall = Offerwall::query()
            ->where('postback_slug', $normalizedSlug)
            ->first();

        if ($offerwall) {
            return $offerwall;
        }

        return Offerwall::query()
            ->get()
            ->first(function (Offerwall $candidate) use ($normalizedSlug): bool {
                return $this->sanitizeOfferwallSlug((string) ($candidate->postback_slug ?? '')) === $normalizedSlug
                    || $this->sanitizeOfferwallSlug((string) ($candidate->name ?? $candidate->offer_wall_name ?? '')) === $normalizedSlug;
            });
    }

    private function resolvePostbackValue(Request $request, string $field, array $parameterMap = [], mixed $default = null): mixed
    {
        $customKey = trim((string) (($parameterMap[$field]['name'] ?? $parameterMap[$field] ?? '')));
        $keys = $customKey !== '' ? [$customKey] : [];

        $snakeField = Str::snake($field);
        if (!empty($parameterMap[$snakeField])) {
            $mappedKey = is_array($parameterMap[$snakeField]) ? ($parameterMap[$snakeField]['name'] ?? '') : (string) $parameterMap[$snakeField];
            if ($mappedKey !== '') {
                array_unshift($keys, $mappedKey);
            }
        }

        $fallbacks = [
            'userId' => ['userId', 'user_id', 'identity_id', 'subId', 'sub_id', 'subid', 'userid', 'userID', 'player_id', 'member', 'uid'],
            'transactionId' => ['transId', 'trans_id', 'txid', 'transactionId', 'transaction_id', 'transactionid', 'transactionID', 'conversion', 'conv_id', 'offerwall_transaction_id'],
            'revenue' => ['payout', 'payout_usd', 'amount', 'revenue', 'user_amount'],
            'reward' => ['reward', 'reward_value', 'rewardValue', 'points', 'amount', 'user_amount', 'currencyReward', 'currency_reward', 'currencyAmount', 'currency_amount', 'virtual_amount'],
            'offerName' => ['offer_name', 'offername', 'title', 'offer_title', 'campaign_name', 'campaign_title', 'task_name', 'task_title', 'name', 'offerName', 'offerTitle', 'campaignName', 'campaignTitle', 'taskName', 'taskTitle', 'program_name', 'program_title', 'event_name', 'eventName', 'OFFER_NAME', 'OFFERNAME', 'TITLE', 'OFFER_TITLE', 'CAMPAIGN_NAME', 'CAMPAIGN_TITLE', 'TASK_NAME', 'TASK_TITLE', 'NAME'],
            'offerId' => ['offerId', 'campaign_id', 'offer_id', 'program_id'],
            'status' => ['status', 'result', 'type', 'STATUS', 'state'],
            'ip' => ['userIp', 'user_ip', 'userip', 'ip_address', 'ip', 'ipaddr', 'USER_IP'],
            'country' => ['country', 'geo', 'country_name', 'countryName', 'countryCode', 'country_code', 'COUNTRY'],
        ];

        $keys = array_values(array_unique(array_merge($keys, $fallbacks[$field] ?? [])));

        if ($field === 'userId') {
            foreach ($keys as $key) {
                $value = $request->input($key);
                if (! $this->isValidPostbackString($value)) {
                    continue;
                }

                $norm = trim((string) $value);
                if (is_numeric($norm) && (int) $norm > 0) {
                    return (int) $norm;
                }

                $foundUser = User::query()->where('username', $norm)->orWhere('name', $norm)->first();
                if ($foundUser instanceof User) {
                    return $foundUser->id;
                }
            }

            return $default;
        }

        if (in_array($field, ['revenue', 'reward'], true)) {
            foreach ($keys as $key) {
                $value = $request->input($key);
                if ($this->isValidPostbackNumber($value)) {
                    $norm = preg_replace('/[^\d.,-]/', '', trim((string) $value));
                    if (str_contains($norm, ',') && !str_contains($norm, '.')) {
                        $norm = str_replace(',', '.', $norm);
                    } elseif (str_contains($norm, ',') && str_contains($norm, '.')) {
                        $norm = str_replace(',', '', $norm);
                    }
                    return (float) $norm;
                }
            }

            return (float) $default;
        }

        foreach ($keys as $key) {
            $value = $request->input($key);
            if (! $this->isValidPostbackString($value)) {
                continue;
            }

            return $value;
        }

        return $default;
    }

    /**
     * Postback query values are untrusted. Invalid, empty, array, and object
     * values are treated as absent so they never trigger Laravel validation
     * responses or unsafe scalar casts in the handler.
     */
    private function isValidPostbackNumber(mixed $value): bool
    {
        if (is_bool($value) || is_array($value) || is_object($value) || $value === null) {
            return false;
        }

        $normalized = trim((string) $value);
        if ($normalized === '') {
            return false;
        }

        $sanitized = preg_replace('/[^\d.,-]/', '', $normalized);
        if (str_contains($sanitized, ',') && !str_contains($sanitized, '.')) {
            $sanitized = str_replace(',', '.', $sanitized);
        } elseif (str_contains($sanitized, ',') && str_contains($sanitized, '.')) {
            $sanitized = str_replace(',', '', $sanitized);
        }

        return $sanitized !== '' && is_numeric($sanitized) && is_finite((float) $sanitized);
    }

    private function isValidPostbackUserId(mixed $value): bool
    {
        if (is_bool($value) || is_array($value) || is_object($value) || $value === null) {
            return false;
        }

        $normalized = trim((string) $value);

        return preg_match('/^[1-9][0-9]*$/', $normalized) === 1
            && (int) $normalized > 0
            && (string) (int) $normalized === $normalized;
    }

    private function isValidPostbackString(mixed $value): bool
    {
        return ! is_bool($value)
            && ! is_array($value)
            && ! is_object($value)
            && $value !== null
            && trim((string) $value) !== '';
    }

    private function normalizePostbackStatus(mixed $status): string
    {
        $normalized = strtolower(trim((string) $status));

        return match ($normalized) {
            '1', 'true', 'approved', 'approve', 'valid', 'success', 'completed', 'complete', 'ok', 'credited', 'creditade' => 'approved',
            '-1', '2', 'false', '0', 'chargeback', 'reversed', 'reverse', 'rejected', 'reject', 'cancelled', 'canceled', 'refund', 'failed', 'declined' => 'chargeback',
            'pending', 'hold', 'on_hold', 'in_progress', 'processing' => 'pending',
            default => $normalized !== '' ? 'approved' : 'approved',
        };
    }

    private function normalizeMoney(float|int|string $value): string
    {
        $formatted = number_format((float) $value, 2, '.', '');
        $formatted = rtrim(rtrim($formatted, '0'), '.');

        return $formatted !== '' ? $formatted : '0';
    }

    private function formatMoney(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function fillOfferwall(Offerwall $offerwall, array $data, ?int $currentId): void
    {
        $name = $this->firstNonEmptyString(
            $data['name'] ?? null,
            $offerwall->name ?? null,
            $offerwall->offer_wall_name ?? null,
        );
        $category = trim((string) ($data['category'] ?? $offerwall->category ?? 'offerwall'));
        if ($category === '' || strcasecmp($category, 'Select Category') === 0) {
            $category = 'offerwall';
        }

        $parameters = $this->normalizePostbackParameters($data['postback_parameters'] ?? $offerwall->postback_parameters ?? []);
        $slug = $this->resolveOfferwallSlug((string) ($data['postback_slug'] ?? $offerwall->postback_slug ?? ''), $name, $currentId);
        $orderColumn = $this->offerwallOrderColumn();
        $nameColumn = $this->offerwallNameColumn();
        $badgeColumn = $this->offerwallBadgeColumn();
        $logoColumn = $this->offerwallLogoColumn();
        $categoryColumn = $this->offerwallCategoryColumn();
        $iframeColumn = $this->offerwallIframeColumn();
        $ratingColumn = $this->offerwallRatingColumn();
        $statusColumn = $this->offerwallStatusColumn();

        if ($nameColumn !== null) {
            $offerwall->{$nameColumn} = $name;
        }
        if ($badgeColumn !== null) {
            $offerwall->{$badgeColumn} = trim((string) ($data['badge'] ?? $offerwall->{$badgeColumn} ?? '')) ?: null;
        }
        if ($logoColumn !== null) {
            $offerwall->{$logoColumn} = trim((string) ($data['logo_url'] ?? $offerwall->{$logoColumn} ?? ''));
        }
        if ($categoryColumn !== null) {
            $offerwall->{$categoryColumn} = $category;
        }
        if ($iframeColumn !== null) {
            $offerwall->{$iframeColumn} = trim((string) ($data['iframe_url'] ?? $offerwall->{$iframeColumn} ?? ''));
        }
        if ($ratingColumn !== null) {
            $offerwall->{$ratingColumn} = (float) ($data['rating'] ?? $offerwall->{$ratingColumn} ?? 5);
        }
        if ($statusColumn !== null) {
            $offerwall->{$statusColumn} = (bool) ($data['is_active'] ?? $offerwall->{$statusColumn} ?? true);
        }
        $offerwall->unlock_level = (int) ($data['unlock_level'] ?? $offerwall->unlock_level ?? 1);
        $offerwall->postback_slug = $slug;
        $offerwall->postback_parameters = $parameters;
        $offerwall->postback_url = $this->buildOfferwallPostbackUrl($slug, $parameters);
        $offerwall->postback_signature_required = (bool) ($data['postback_signature_required'] ?? $offerwall->postback_signature_required ?? false);
        $offerwall->postback_whitelist_ip_required = (bool) ($data['postback_whitelist_ip_required'] ?? $offerwall->postback_whitelist_ip_required ?? false);
        $offerwall->postback_whitelist_ips = $this->normalizeWhitelistIps($data['postback_whitelist_ips'] ?? $offerwall->postback_whitelist_ips ?? []);

        if ($orderColumn !== null) {
            $offerwall->{$orderColumn} = (int) ($data['sort_order'] ?? $offerwall->{$orderColumn} ?? 1);
        }
    }

    private function formatOfferwall(Offerwall $offerwall, ?int $fallbackOrder = null): array
    {
        $sortOrder = $this->resolveOfferwallOrderValue($offerwall, $fallbackOrder);

        return [
            'id' => $offerwall->id,
            'name' => $this->firstNonEmptyString($offerwall->name ?? null, $offerwall->offer_wall_name ?? null),
            'offerWallName' => $this->firstNonEmptyString($offerwall->name ?? null, $offerwall->offer_wall_name ?? null),
            'badge' => $offerwall->badge ?? $offerwall->offerwall_badge ?? $offerwall->offer_wall_badge ?? null,
            'offerwallBadge' => $offerwall->badge ?? $offerwall->offerwall_badge ?? $offerwall->offer_wall_badge ?? null,
            'logo_url' => (string) ($offerwall->logo_url ?? $offerwall->offer_wall_logo ?? ''),
            'offerWallLogo' => (string) ($offerwall->logo_url ?? $offerwall->offer_wall_logo ?? ''),
            'iframe_url' => (string) ($offerwall->iframe_url ?? $offerwall->offer_wall_ifream_url ?? ''),
            'offerWallIfreamUrl' => (string) ($offerwall->iframe_url ?? $offerwall->offer_wall_ifream_url ?? ''),
            'category' => (string) ($offerwall->category ?? $offerwall->offerwall_category ?? 'offerwall'),
            'offerwallCategory' => (string) ($offerwall->category ?? $offerwall->offerwall_category ?? 'offerwall'),
            'rating' => (float) ($offerwall->rating ?? $offerwall->offer_wall_rating ?? 5),
            'offerWallRating' => (float) ($offerwall->rating ?? $offerwall->offer_wall_rating ?? 5),
            'is_active' => (bool) ($offerwall->is_active ?? $offerwall->offerwall_status ?? true),
            'offerwallStatus' => (bool) ($offerwall->is_active ?? $offerwall->offerwall_status ?? true),
            'sort_order' => $sortOrder,
            'offerwallOrder' => $sortOrder,
            'unlock_level' => (int) ($offerwall->unlock_level ?? $offerwall->unlockLevel ?? 1),
            'unlockLevel' => (int) ($offerwall->unlock_level ?? $offerwall->unlockLevel ?? 1),
            'postback_slug' => $offerwall->postback_slug ?? $offerwall->postbackSlug ?? null,
            'postbackSlug' => $offerwall->postback_slug ?? $offerwall->postbackSlug ?? null,
            'postback_parameters' => $offerwall->postback_parameters ?? [],
            'postbackParameters' => $offerwall->postback_parameters ?? [],
            'postback_url' => $offerwall->postback_url,
            'generatedPostbackUrl' => $offerwall->postback_url,
            'postback_signature_required' => (bool) $offerwall->postback_signature_required,
            'postbackSignatureRequired' => (bool) $offerwall->postback_signature_required,
            'postback_whitelist_ip_required' => (bool) $offerwall->postback_whitelist_ip_required,
            'postbackWhitelistIpRequired' => (bool) $offerwall->postback_whitelist_ip_required,
            'postback_whitelist_ips' => $offerwall->postback_whitelist_ips ?? [],
            'postbackWhitelistIps' => $offerwall->postback_whitelist_ips ?? [],
            'created_at' => $offerwall->created_at,
            'updated_at' => $offerwall->updated_at,
        ];
    }

    private function buildOfferwallPostbackUrl(string $slug, array $parameters): ?string
    {
        $cleanSlug = $this->sanitizeOfferwallSlug($slug);
        if ($cleanSlug === '') {
            return null;
        }

        $baseUrl = $this->normalizeGeneratedPostbackBaseUrl((string) config('app.url'));
        if ($baseUrl === '') {
            return null;
        }

        $map = $this->normalizePostbackParameters($parameters);
        if ($cleanSlug === 'upwall') {
            return $baseUrl.'/api/offerwall-postback/upwall?userid={userid}&user_amount={user_amount}&offer_name={offer_name}&offer_id={offer_id}&payout={payout}&ip_address={ip_address}&currency_name={currency_name}&transactionID={transactionID}&date={date}';
        }

        if ($cleanSlug === 'taskwall') {
            return $baseUrl.'/api/offerwall-postback/taskwall?userid={userid}&user_amount={user_amount}&offer_name={offer_name}&offer_id={offer_id}&payout={payout}&ip_address={ip_address}&date={date}';
        }

        if ($cleanSlug === 'revlum') {
            return $baseUrl.'/api/offerwall-postback/revlum?subId={subId}&transId={transId}&offerName={offerName}&offerId={offerId}&event_id={event_id}&event_name={event_name}&reward={reward}&payout={payout}&userIp={userIp}&country={country}&status={status}';
        }

        if ($cleanSlug === 'radientwall') {
            return $baseUrl.'/api/offerwall-postback/radientwall?subId={subId}&transId={transId}&reward={reward}&payout={payout}&status={status}&userIp={userIp}&offer_name={offer_name}&country={country}';
        }

        if ($cleanSlug === 'adswedmedia') {
            return $baseUrl.'/api/offerwall-postback/adswedmedia?subId={subId}&transId={transId}&offer_id={offer_id}&offer_name={offer_name}&event_id={event_id}&event_name={event_name}&reward={reward}&round_reward={round_reward}&payout={payout}&signature={signature}&status={status}&userIp={userIp}&country={country}&uuid={uuid}';
        }

        if ($cleanSlug === 'revtoo') {
            return $baseUrl.'/api/offerwall-postback/revtoo?subId={subId}&transId={transId}&payout={payout}&reward={reward}&status={status}&userIp={userIp}&offer_name={offer_name}&debug={debug}&signature={signature}';
        }

        $queryParts = [];

        foreach (['userId', 'offerId', 'offerName'] as $field) {
            if (($map[$field]['name'] ?? '') !== '' && ($map[$field]['placeholder'] ?? '') !== '') {
                $queryParts[] = $map[$field]['name'].'='.$map[$field]['placeholder'];
            }
        }

        foreach (($map['extras'] ?? []) as $extra) {
            if (!is_array($extra) || empty($extra['name']) || !array_key_exists('placeholder', $extra)) {
                continue;
            }

            $queryParts[] = (string) $extra['name'].'='.(string) $extra['placeholder'];
        }

        foreach (['revenue', 'reward', 'transactionId', 'status', 'ip', 'country'] as $field) {
            if (($map[$field]['name'] ?? '') !== '' && ($map[$field]['placeholder'] ?? '') !== '') {
                $queryParts[] = $map[$field]['name'].'='.$map[$field]['placeholder'];
            }
        }

        $queryParts = array_values(array_filter(
            $queryParts,
            fn ($item) => !str_ends_with((string) $item, '=')
        ));

        $query = implode('&', $queryParts);

        return $baseUrl.'/api/offerwall-postback/'.$cleanSlug.($query !== '' ? '?'.$query : '');
    }

    private function normalizeGeneratedPostbackBaseUrl(string $value): string
    {
        $baseUrl = rtrim(trim($value), '/');
        if ($baseUrl === '') {
            return '';
        }

        $baseUrl = preg_replace('#/(callback/api|api|callback)$#', '', $baseUrl) ?? $baseUrl;

        return rtrim($baseUrl, '/');
    }

    private function normalizePostbackParameters(mixed $value): array
    {
        $defaults = [
            'userId' => ['name' => 'user_id', 'placeholder' => '{userId}'],
            'transactionId' => ['name' => 'transaction_id', 'placeholder' => '{transactionId}'],
            'revenue' => ['name' => 'payout', 'placeholder' => '{payout}'],
            'reward' => ['name' => 'reward', 'placeholder' => '{reward}'],
            'offerName' => ['name' => 'offer_name', 'placeholder' => '{offerName}'],
            'offerId' => ['name' => 'offer_id', 'placeholder' => '{offerId}'],
            'status' => ['name' => 'status', 'placeholder' => '{status}'],
            'ip' => ['name' => 'ip', 'placeholder' => '{ip}'],
            'country' => ['name' => 'country', 'placeholder' => '{country}'],
            'extras' => [],
        ];

        $source = is_array($value) ? $value : [];

        // Normalize indexed array format (Format A) into associative map (Format B)
        if (!empty($source) && array_is_list($source)) {
            $converted = [];
            foreach ($source as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $paramName = $this->sanitizeParameterName((string) ($item['param'] ?? $item['name'] ?? ''));
                $fieldKey = trim((string) ($item['field'] ?? $item['target'] ?? $item['key'] ?? ''));
                $macro = $this->sanitizePlaceholder((string) ($item['macro'] ?? $item['placeholder'] ?? ''));

                if ($paramName === '' || $fieldKey === '' || $fieldKey === 'ambiguous' || $fieldKey === 'ignore') {
                    continue;
                }

                $canonicalField = match (strtolower($fieldKey)) {
                    'user_id', 'userid', 'userid', 'userid' => 'userId',
                    'transaction_id', 'transactionid', 'txid', 'transactionid' => 'transactionId',
                    'payout', 'revenue' => 'revenue',
                    'reward' => 'reward',
                    'offer_id', 'offerid', 'offerid' => 'offerId',
                    'offer_name', 'offername', 'offername' => 'offerName',
                    'status' => 'status',
                    'ip' => 'ip',
                    'country' => 'country',
                    default => null,
                };

                if ($canonicalField !== null) {
                    $converted[$canonicalField] = [
                        'name' => $paramName,
                        'placeholder' => $macro !== '' ? $macro : '{'.$paramName.'}',
                    ];
                } else {
                    $converted['extras'][] = [
                        'name' => $paramName,
                        'placeholder' => $macro !== '' ? $macro : '{'.$paramName.'}',
                    ];
                }
            }
            $source = array_merge($defaults, $converted);
        }

        $normalized = $defaults;

        foreach ($defaults as $field => $config) {
            if ($field === 'extras') {
                continue;
            }

            $current = $source[$field] ?? null;
            if (is_string($current)) {
                $normalized[$field]['name'] = $this->sanitizeParameterName($current);
                continue;
            }

            if (is_array($current)) {
                $normalized[$field] = [
                    'name' => $this->sanitizeParameterName((string) ($current['name'] ?? $config['name'])),
                    'placeholder' => $this->sanitizePlaceholder((string) ($current['placeholder'] ?? $config['placeholder'])),
                ];
            }
        }

        $normalized['extras'] = [];
        if (isset($source['extras']) && is_array($source['extras'])) {
            foreach ($source['extras'] as $extra) {
                if (!is_array($extra)) {
                    continue;
                }

                $normalized['extras'][] = [
                    'name' => $this->sanitizeParameterName((string) ($extra['name'] ?? '')),
                    'placeholder' => $this->sanitizePlaceholder((string) ($extra['placeholder'] ?? '')),
                ];
            }
        }

        return $normalized;
    }

    private function sanitizeParameterName(string $value): string
    {
        return Str::of($value)
            ->replaceMatches('/[^A-Za-z0-9_]+/', '_')
            ->replaceMatches('/^_+|_+$/', '')
            ->limit(120, '')
            ->value();
    }

    private function sanitizePlaceholder(string $value): string
    {
        return trim($value);
    }

    private function normalizeWhitelistIps(mixed $value): array
    {
        $source = is_array($value)
            ? $value
            : (preg_split('/[\r\n,]+/', (string) $value) ?: []);

        $ips = [];

        foreach ($source as $item) {
            $ip = trim((string) $item);
            if ($ip !== '') {
                $ips[$ip] = $ip;
            }
        }

        return array_values($ips);
    }

    private function sanitizeOfferwallSlug(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '-')
            ->trim('-')
            ->limit(120, '')
            ->value();
    }

    private function resolveOfferwallSlug(string $slug, string $name, ?int $ignoreId = null): string
    {
        $base = $this->sanitizeOfferwallSlug($slug);
        if ($base === '') {
            $base = $this->sanitizeOfferwallSlug($name);
        }
        if ($base === '') {
            $base = 'offerwall';
        }

        $candidate = $base;
        $counter = 2;

        while (
            Offerwall::query()
                ->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('postback_slug', $candidate)
                ->exists()
        ) {
            $candidate = $base.'-'.$counter;
            $counter += 1;
        }

        return $candidate;
    }

    private function orderedOfferwallIds(?int $excludeId = null, ?string $category = null): array
    {
        $query = Offerwall::query()
            ->when($excludeId !== null, fn ($builder) => $builder->where('id', '!=', $excludeId));

        $categoryColumn = $this->offerwallCategoryColumn();
        if ($categoryColumn !== null && $category !== null) {
            $query->where($categoryColumn, $this->normalizeOfferwallCategoryValue($category));
        }

        $orderColumn = $this->offerwallOrderColumn();
        if ($orderColumn !== null) {
            $query->orderBy($orderColumn)->orderBy('id');
        } else {
            $query->orderBy('id');
        }

        return $query
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function clampOfferwallOrder(mixed $value, int $maxPosition): int
    {
        $maxPosition = max(1, $maxPosition);
        $normalized = is_numeric($value) ? (int) $value : $maxPosition;

        if ($normalized < 1) {
            return 1;
        }

        if ($normalized > $maxPosition) {
            return $maxPosition;
        }

        return $normalized;
    }

    private function applyOfferwallOrder(int $offerwallId, mixed $requestedOrder, ?string $category = null): void
    {
        $orderColumn = $this->offerwallOrderColumn();
        if ($orderColumn === null) {
            return;
        }

        $orderedIds = $this->orderedOfferwallIds($offerwallId, $category);
        $targetPosition = $this->clampOfferwallOrder($requestedOrder, count($orderedIds) + 1);

        array_splice($orderedIds, $targetPosition - 1, 0, [$offerwallId]);

        foreach ($orderedIds as $index => $id) {
            Offerwall::query()->where('id', (int) $id)->update([
                $orderColumn => $index + 1,
                'updated_at' => now(),
            ]);
        }
    }

    private function reindexOfferwallOrders(?string $category = null): void
    {
        $orderColumn = $this->offerwallOrderColumn();
        if ($orderColumn === null) {
            return;
        }

        foreach ($this->orderedOfferwallIds(null, $category) as $index => $id) {
            Offerwall::query()->where('id', (int) $id)->update([
                $orderColumn => $index + 1,
                'updated_at' => now(),
            ]);
        }
    }

    private function orderedOfferwallQuery(?int $excludeId = null)
    {
        $query = Offerwall::query()
            ->when($excludeId !== null, fn ($builder) => $builder->where('id', '!=', $excludeId));

        $orderColumn = $this->offerwallOrderColumn();

        if ($orderColumn !== null) {
            $query->orderBy($orderColumn)->orderBy('id');
        } else {
            $query->orderBy('id');
        }

        return $query;
    }

    private function offerwallOrderColumn(): ?string
    {
        foreach (['sort_order', 'offerwall_order', 'order'] as $column) {
            if (Schema::hasColumn('offerwalls', $column)) {
                return $column;
            }
        }

        return null;
    }

    private function offerwallNameColumn(): ?string
    {
        return $this->firstOfferwallColumn(['name', 'offer_wall_name']);
    }

    private function offerwallBadgeColumn(): ?string
    {
        return $this->firstOfferwallColumn(['badge', 'offerwall_badge', 'offer_wall_badge']);
    }

    private function offerwallLogoColumn(): ?string
    {
        return $this->firstOfferwallColumn(['logo_url', 'offer_wall_logo']);
    }

    private function offerwallCategoryColumn(): ?string
    {
        return $this->firstOfferwallColumn(['category', 'offerwall_category']);
    }

    private function normalizeOfferwallCategoryValue(mixed $value): string
    {
        $category = strtolower(trim((string) ($value ?? '')));

        return $category !== '' ? $category : 'offerwall';
    }

    private function offerwallIframeColumn(): ?string
    {
        return $this->firstOfferwallColumn(['iframe_url', 'offer_wall_ifream_url']);
    }

    private function offerwallRatingColumn(): ?string
    {
        return $this->firstOfferwallColumn(['rating', 'offer_wall_rating']);
    }

    private function offerwallStatusColumn(): ?string
    {
        return $this->firstOfferwallColumn(['is_active', 'offerwall_status']);
    }

    private function firstOfferwallColumn(array $columns): ?string
    {
        foreach ($columns as $column) {
            if (Schema::hasColumn('offerwalls', $column)) {
                return $column;
            }
        }

        return null;
    }

    private function resolveOfferwallOrderValue(Offerwall $offerwall, ?int $fallbackOrder = null): int
    {
        foreach (['sort_order', 'offerwall_order', 'order'] as $column) {
            $value = $offerwall->{$column} ?? null;
            if (is_numeric($value) && (int) $value > 0) {
                return (int) $value;
            }
        }

        return max(1, (int) ($fallbackOrder ?? 1));
    }

    private function firstNonEmptyString(mixed ...$values): string
    {
        foreach ($values as $value) {
            $text = trim((string) ($value ?? ''));
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function formatAdminUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name ?? null,
            'username' => $user->username ?? null,
            'email' => $user->email ?? null,
            'role' => $user->role ?? 'user',
            'balance' => number_format((float) ($user->balance ?? 0), 2, '.', ''),
            'level' => (int) ($user->level ?? 1),
            'ip' => $user->ip ?? null,
            'country' => $user->country ?? null,
            'ban' => (bool) ($user->ban ?? false),
            'created_at' => $user->created_at?->toAtomString(),
        ];
    }

    private function resolveOfferTag(mixed $categories, ?string $fallback = null): string
    {
        $candidateValues = [];

        if (is_array($categories)) {
            $candidateValues = $categories;
        } else {
            $decoded = json_decode((string) $categories, true);
            if (is_array($decoded)) {
                $candidateValues = $decoded;
            } else {
                $candidateValues = preg_split('/[,\n|]+/', (string) $categories) ?: [];
            }
        }

        foreach ($candidateValues as $value) {
            $text = trim((string) $value);
            if ($text !== '') {
                return Str::headline($text);
            }
        }

        return Str::headline($this->firstNonEmptyString($fallback, 'Offer'));
    }

    private function dynamicHomepageOffers(Request $request): array
    {
        if (!Schema::hasTable('offer_api_links')) {
            return [];
        }

        $notikLink = OfferApiLink::query()
            ->where('provider_key', 'notik')
            ->where('is_active', true)
            ->value('api_link');

        if (!is_string($notikLink) || trim($notikLink) === '') {
            return [];
        }

        $currentUser = auth('api')->user() ?? $request->user('api');
        $rawOffers = $this->loadNotikApiOffers(trim($notikLink));

        if ($rawOffers === []) {
            return [];
        }

        return $this->normalizeNotikOffers($rawOffers, $currentUser);
    }

    private function loadNotikApiOffers(string $apiLink): array
    {
        $cacheKey = 'notik-api-offers:'.sha1($apiLink);

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($apiLink): array {
            $offers = [];
            $currentUrl = $apiLink;
            $requestCount = 0;

            while ($currentUrl !== '' && $requestCount < 30) {
                try {
                    $response = Http::acceptJson()
                        ->timeout(20)
                        ->get($currentUrl);
                } catch (\Throwable) {
                    break;
                }

                if (! $response->ok()) {
                    break;
                }

                $payload = $response->json();
                $offers = array_merge($offers, $this->extractNotikOfferRows($payload));

                $nextUrl = $this->extractNotikNextPageUrl($payload, $currentUrl);
                if ($nextUrl === null) {
                    break;
                }

                $currentUrl = $nextUrl;
                $requestCount++;
            }

            return $offers;
        });
    }

    private function extractNotikOfferRows(mixed $payload): array
    {
        if (!is_array($payload)) {
            return [];
        }

        $candidates = [];

        foreach (['offers', 'data', 'results', 'items', 'list'] as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];
            if (is_array($value)) {
                $candidates[] = $value;
            }
        }

        foreach ($candidates as $candidate) {
            $rows = $this->findSequentialOfferRows($candidate);
            if ($rows !== []) {
                return $rows;
            }
        }

        return $this->findSequentialOfferRows($payload);
    }

    private function findSequentialOfferRows(array $payload): array
    {
        if (array_is_list($payload)) {
            $rows = array_values(array_filter($payload, fn ($item): bool => is_array($item) && $this->looksLikeNotikOfferRow($item)));

            if ($rows !== []) {
                return $rows;
            }
        }

        foreach ($payload as $value) {
            if (is_array($value)) {
                $rows = $this->findSequentialOfferRows($value);
                if ($rows !== []) {
                    return $rows;
                }
            }
        }

        return [];
    }

    private function looksLikeNotikOfferRow(array $offer): bool
    {
        return collect([
            'id',
            'offer_id',
            'campaign_id',
            'click_url',
            'clickUrl',
            'name',
            'title',
            'payout',
            'reward',
        ])->contains(fn (string $key): bool => array_key_exists($key, $offer));
    }

    private function extractNotikNextPageUrl(mixed $payload, string $currentUrl): ?string
    {
        if (!is_array($payload)) {
            return null;
        }

        $paths = [
            ['next_page_url'],
            ['meta', 'next_page_url'],
            ['pagination', 'next_page_url'],
            ['links', 'next'],
            ['nextPageUrl'],
            ['next'],
        ];

        foreach ($paths as $path) {
            $candidate = $this->arrayPathValue($payload, $path);
            if (!is_string($candidate)) {
                continue;
            }

            $candidate = trim($candidate);
            if ($candidate === '' || strtolower($candidate) === 'null') {
                continue;
            }

            return $this->resolveNotikUrl($currentUrl, $candidate);
        }

        return null;
    }

    private function arrayPathValue(array $payload, array $path): mixed
    {
        $value = $payload;

        foreach ($path as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return null;
            }

            $value = $value[$segment];
        }

        return $value;
    }

    private function resolveNotikUrl(string $baseUrl, string $candidateUrl): string
    {
        $candidateUrl = trim($candidateUrl);

        if ($candidateUrl === '') {
            return '';
        }

        if (Str::startsWith($candidateUrl, ['http://', 'https://'])) {
            return $candidateUrl;
        }

        $parsed = parse_url($baseUrl);
        if (!is_array($parsed) || empty($parsed['scheme']) || empty($parsed['host'])) {
            return $candidateUrl;
        }

        $origin = $parsed['scheme'].'://'.$parsed['host'].(isset($parsed['port']) ? ':'.$parsed['port'] : '');

        if (str_starts_with($candidateUrl, '/')) {
            return $origin.$candidateUrl;
        }

        $basePath = (string) ($parsed['path'] ?? '/');
        $directory = trim(str_replace('\\', '/', dirname($basePath)), '.');
        $prefix = $directory === '' || $directory === '/' ? '' : '/'.$directory;

        return $origin.$prefix.'/'.ltrim($candidateUrl, '/');
    }

    private function normalizeNotikOffers(array $offers, ?User $user = null): array
    {
        $completedLookup = $this->completedTaskLookup($user);
        $rows = [];

        foreach ($offers as $index => $offer) {
            if (!is_array($offer)) {
                continue;
            }

            if ($this->isNotikOfferDisabled($offer)) {
                continue;
            }

            $offerId = $this->firstNonEmptyString(
                $offer['offer_id'] ?? null,
                $offer['offerId'] ?? null,
                $offer['campaign_id'] ?? null,
                $offer['campaignId'] ?? null,
                $offer['id'] ?? null,
            );
            $title = $this->firstNonEmptyString(
                $offer['title'] ?? null,
                $offer['name'] ?? null,
                $offer['offer_name'] ?? null,
            );
            $clickUrl = $this->firstNonEmptyString(
                $offer['click_url'] ?? null,
                $offer['clickUrl'] ?? null,
                $offer['tracking_url'] ?? null,
                $offer['url'] ?? null,
                $offer['link'] ?? null,
            );
            $imageUrl = $this->firstNonEmptyString(
                $offer['image_url'] ?? null,
                $offer['imageUrl'] ?? null,
                $offer['image'] ?? null,
                $offer['logo_url'] ?? null,
                $offer['logoUrl'] ?? null,
                $offer['thumbnail'] ?? null,
            );
            $description = $this->firstNonEmptyString(
                $offer['description'] ?? null,
                $offer['instructions'] ?? null,
                $offer['details'] ?? null,
                $offer['requirements'] ?? null,
            );
            $countryCodes = $this->normalizeOfferListValue(
                $offer['country_code'] ?? ($offer['countryCodes'] ?? ($offer['countries'] ?? ($offer['country'] ?? []))),
            );
            $devices = $this->normalizeOfferListValue($offer['devices'] ?? ($offer['device'] ?? []));
            $platforms = $this->normalizeOfferListValue($offer['platforms'] ?? ($offer['platform'] ?? []));
            $rewardRows = $this->normalizeNotikRewardRows(
                $offer['taskSteps'] ?? ($offer['task_steps'] ?? ($offer['steps'] ?? ($offer['rewards'] ?? ($offer['rewardEvents'] ?? ($offer['events'] ?? []))))),
            );
            $reward = $this->formatOfferRewardValue(
                $offer['points'] ?? ($offer['point'] ?? null),
                $offer['payout'] ?? ($offer['reward'] ?? null),
            );
            $normalizedTitle = strtolower(trim($title));
            $normalizedOfferId = strtolower(trim($offerId));

            if ($offerId !== '' && in_array($normalizedOfferId, $completedLookup['offerIds'], true)) {
                continue;
            }

            if ($title !== '' && in_array($normalizedTitle, $completedLookup['offerNames'], true)) {
                continue;
            }

            if ($this->isNotikNewUsersOnlyOffer($offer) && $completedLookup['hasCompleted'] && ($offerId !== '' || $title !== '')) {
                if ($offerId !== '' && in_array($normalizedOfferId, $completedLookup['offerIds'], true)) {
                    continue;
                }

                if ($title !== '' && in_array($normalizedTitle, $completedLookup['offerNames'], true)) {
                    continue;
                }
            }

            if ($clickUrl === '') {
                continue;
            }

            $resolvedClickUrl = $this->resolveNotikClickUrl($clickUrl, $user);

            $rows[] = [
                'id' => $offerId !== '' ? 'notik-'.$offerId : 'notik-'.$index.'-'.sha1($title.'|'.$clickUrl),
                'offerId' => $offerId,
                'provider' => 'Notik',
                'title' => $title !== '' ? $title : 'Notik Offer',
                'description' => $description !== '' ? $description : 'Complete this offer to earn rewards.',
                'subtitle' => $description !== '' ? $description : 'Complete this offer to earn rewards.',
                'tag' => 'Notik',
                'reward' => $reward,
                'taskReward' => $reward,
                'taskName' => $title !== '' ? $title : 'Notik Offer',
                'taskImageUrl' => $this->resolveOfferImageUrl($imageUrl),
                'taskDescription' => $description !== '' ? $description : 'Complete this offer to earn rewards.',
                'imageUrl' => $this->resolveOfferImageUrl($imageUrl),
                'link' => $resolvedClickUrl,
                'linkUrl' => $resolvedClickUrl,
                'countryCodes' => $countryCodes,
                'country_code' => $countryCodes,
                'devices' => $devices,
                'platforms' => $platforms,
                'platform' => $platforms,
                'rewardRows' => $rewardRows,
                'taskSteps' => $rewardRows,
                'categories' => [self::CUSTOM_OFFER_CATEGORIES[1]],
                'category' => self::CUSTOM_OFFER_CATEGORIES[1],
                'categoryLabel' => Str::headline(self::CUSTOM_OFFER_CATEGORIES[1]),
                'source' => 'notik',
            ];
        }

        return array_values($rows);
    }

    private function completedTaskLookup(?User $user): array
    {
        if (! $user) {
            return [
                'offerIds' => [],
                'offerNames' => [],
                'hasCompleted' => false,
            ];
        }

        $username = trim((string) ($user->username ?? ''));

        if ($username === '' && ! filled($user->id)) {
            return [
                'offerIds' => [],
                'offerNames' => [],
                'hasCompleted' => false,
            ];
        }

        $tasks = CompletedTask::query()
            ->where(function ($query) use ($user, $username): void {
                $query->where('user_id', $user->id);

                if ($username !== '') {
                    $query->orWhere('user_name', $username);
                }
            })
            ->get(['offer_id', 'offer_name']);

        $offerIds = $tasks
            ->pluck('offer_id')
            ->filter()
            ->map(fn ($value): string => strtolower(trim((string) $value)))
            ->values()
            ->all();

        $offerNames = $tasks
            ->pluck('offer_name')
            ->filter()
            ->map(fn ($value): string => strtolower(trim((string) $value)))
            ->values()
            ->all();

        return [
            'offerIds' => $offerIds,
            'offerNames' => $offerNames,
            'hasCompleted' => $offerIds !== [] || $offerNames !== [],
        ];
    }

    private function isNotikOfferDisabled(array $offer): bool
    {
        foreach (['is_active', 'active'] as $activeKey) {
            if (array_key_exists($activeKey, $offer)) {
                $isActive = filter_var($offer[$activeKey], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

                if ($isActive !== null) {
                    return ! $isActive;
                }
            }
        }

        foreach (['disabled', 'is_disabled', 'paused', 'blocked'] as $disabledKey) {
            if (array_key_exists($disabledKey, $offer) && filter_var($offer[$disabledKey], FILTER_VALIDATE_BOOLEAN)) {
                return true;
            }
        }

        $status = strtolower(trim((string) ($offer['status'] ?? $offer['state'] ?? '')));
        if ($status !== '' && in_array($status, ['disabled', 'inactive', 'off', 'paused', 'blocked', 'archived'], true)) {
            return true;
        }

        return false;
    }

    private function isNotikNewUsersOnlyOffer(array $offer): bool
    {
        foreach (['new_users_only', 'newUsersOnly', 'new_user_only', 'first_time_users_only', 'first_time_only'] as $key) {
            if (array_key_exists($key, $offer)) {
                return filter_var($offer[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

        $status = strtolower(trim((string) ($offer['target_audience'] ?? $offer['audience'] ?? '')));

        return in_array($status, ['new users only', 'new-user-only', 'new_users_only'], true);
    }

    private function resolveNotikClickUrl(string $rawUrl, ?User $user = null): string
    {
        $resolvedUserId = trim((string) ($user?->id ?? ''));

        return trim(
            str_replace(
                ['{USER_ID}', '{user_id}', '{userId}', '{userid}', '[USER_ID]', '[user_id]', '[userId]', '[userid]'],
                $resolvedUserId,
                $rawUrl,
            ),
        );
    }

    private function formatOffer(Offer $offer): array
    {
        $category = $this->resolveOfferCategoryValue($offer->categories ?? []);

        return [
            'id' => $offer->id,
            'offerId' => $offer->offer_id ?? '',
            'provider' => $offer->provider ?? '',
            'title' => $offer->title ?? '',
            'description' => $offer->description ?? '',
            'instructions' => $offer->instructions ?? '',
            'requirements' => $offer->requirements ?? '',
            'image' => $offer->image ?? '',
            'imageUrl' => $this->resolveOfferImageUrl($offer->image),
            'link' => $offer->link ?? '',
            'points' => (float) ($offer->points ?? 0),
            'payout' => (float) ($offer->payout ?? 0),
            'reward' => $this->formatOfferRewardValue($offer->points, $offer->payout),
            'categories' => $offer->categories ?? [],
            'category' => $category,
            'categoryLabel' => Str::headline($category),
            'countries' => $offer->countries ?? [],
            'devices' => $offer->devices ?? [],
            'events' => $offer->events ?? [],
            'created_at' => $offer->created_at,
            'updated_at' => $offer->updated_at,
        ];
    }

    private function offerApiProviderKeys(): array
    {
        return array_map(
            fn (array $provider): string => $provider['key'],
            self::OFFER_API_PROVIDERS,
        );
    }

    private function formatOfferApiLink(array $provider, ?OfferApiLink $offerApiLink = null): array
    {
        return [
            'id' => $offerApiLink?->id,
            'providerKey' => $provider['key'],
            'providerLabel' => $provider['label'],
            'apiLink' => $offerApiLink?->api_link ?? '',
            'isActive' => (bool) ($offerApiLink?->is_active ?? false),
            'createdAt' => $offerApiLink?->created_at?->toAtomString(),
            'updatedAt' => $offerApiLink?->updated_at?->toAtomString(),
        ];
    }

    private function offerValidationRules(bool $isCreate): array
    {
        $categoryRule = $isCreate ? 'required' : 'sometimes';

        return [
            'offer_id' => ['nullable', 'string', 'max:255'],
            'provider' => ['nullable', 'string', 'max:255'],
            'title' => [$isCreate ? 'required' : 'sometimes', $isCreate ? 'string' : 'filled', 'max:255'],
            'description' => ['nullable', 'string'],
            'instructions' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string', 'max:255'],
            'image' => ['nullable', 'string'],
            'link' => ['nullable', 'string'],
            'points' => ['nullable', 'numeric', 'min:0'],
            'payout' => ['nullable', 'numeric', 'min:0'],
            'category' => [$categoryRule, $isCreate ? 'string' : 'filled', Rule::in(self::CUSTOM_OFFER_CATEGORIES)],
            'countries' => ['nullable'],
            'devices' => ['nullable'],
            'events' => ['nullable'],
        ];
    }

    private function fillOffer(Offer $offer, array $data): void
    {
        $offer->offer_id = $this->trimNullableString($data['offer_id'] ?? $offer->offer_id ?? null);
        $offer->provider = $this->trimNullableString($data['provider'] ?? $offer->provider ?? null);
        $offer->title = trim((string) ($data['title'] ?? $offer->title ?? ''));
        $offer->description = $this->trimNullableString($data['description'] ?? $offer->description ?? null);
        $offer->instructions = $this->trimNullableString($data['instructions'] ?? $offer->instructions ?? null);
        $offer->requirements = $this->trimNullableString($data['requirements'] ?? $offer->requirements ?? null);
        $offer->image = $this->trimNullableString($data['image'] ?? $offer->image ?? null);
        $offer->link = $this->trimNullableString($data['link'] ?? $offer->link ?? null);
        $offer->points = (float) ($data['points'] ?? $offer->points ?? 0);
        $offer->payout = (float) ($data['payout'] ?? $offer->payout ?? 0);
        $categorySource = $data['category'] ?? $offer->categories ?? null;
        $offer->categories = [$this->resolveOfferCategoryValue($categorySource, self::CUSTOM_OFFER_CATEGORIES[0])];
        $offer->countries = $this->normalizeOfferListValue($data['countries'] ?? $offer->countries ?? []);
        $offer->devices = $this->normalizeOfferListValue($data['devices'] ?? $offer->devices ?? []);
        $offer->events = $this->normalizeOfferListValue($data['events'] ?? $offer->events ?? []);
    }

    private function buildOfferPayload(array $data, ?Offer $existing = null): array
    {
        $categorySource = $data['category'] ?? $existing?->categories ?? null;

        return [
            'offer_id' => $this->trimNullableString($data['offer_id'] ?? $existing?->offer_id ?? null),
            'provider' => $this->trimNullableString($data['provider'] ?? $existing?->provider ?? null),
            'title' => trim((string) ($data['title'] ?? $existing?->title ?? '')),
            'description' => $this->trimNullableString($data['description'] ?? $existing?->description ?? null),
            'instructions' => $this->trimNullableString($data['instructions'] ?? $existing?->instructions ?? null),
            'requirements' => $this->trimNullableString($data['requirements'] ?? $existing?->requirements ?? null),
            'image' => $this->trimNullableString($data['image'] ?? $existing?->image ?? null),
            'link' => $this->trimNullableString($data['link'] ?? $existing?->link ?? null),
            'points' => (float) ($data['points'] ?? $existing?->points ?? 0),
            'payout' => (float) ($data['payout'] ?? $existing?->payout ?? 0),
            'categories' => json_encode([
                $this->resolveOfferCategoryValue($categorySource, self::CUSTOM_OFFER_CATEGORIES[0]),
            ]),
            'countries' => json_encode($this->normalizeOfferListValue($data['countries'] ?? $existing?->countries ?? [])),
            'devices' => json_encode($this->normalizeOfferListValue($data['devices'] ?? $existing?->devices ?? [])),
            'events' => json_encode($this->normalizeOfferListValue($data['events'] ?? $existing?->events ?? [])),
        ];
    }

    private function resolveOfferCategoryValue(mixed $value, ?string $fallback = null): string
    {
        $candidateValues = [];

        if (is_array($value)) {
            $candidateValues = $value;
        } else {
            $decoded = json_decode((string) $value, true);
            if (is_array($decoded)) {
                $candidateValues = $decoded;
            } else {
                $candidateValues = preg_split('/[,\n|]+/', (string) $value) ?: [];
            }
        }

        foreach ($candidateValues as $candidateValue) {
            $normalized = $this->normalizeOfferCategoryValue($candidateValue);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        if ($fallback !== null) {
            return $this->normalizeOfferCategoryValue($fallback);
        }

        return '';
    }

    private function normalizeOfferCategoryValue(mixed $value): string
    {
        $category = strtolower(trim((string) $value));
        $category = preg_replace('/[\s-]+/', '_', $category) ?? $category;
        $category = preg_replace('/[^a-z0-9_]/', '', $category) ?? $category;

        return $category !== '' ? $category : self::CUSTOM_OFFER_CATEGORIES[0];
    }

    private function normalizeOfferListValue(mixed $value): array
    {
        if (is_array($value)) {
            $values = $value;
        } else {
            $values = preg_split('/[,\n|]+/', (string) $value) ?: [];
        }

        return array_values(array_filter(array_map(
            static fn ($item) => trim((string) $item),
            $values,
        )));
    }

    private function normalizeNotikRewardRows(mixed $value): array
    {
        if (! is_array($value)) {
            $values = $this->normalizeOfferListValue($value);

            return array_values(array_map(
                static fn (string $item): array => ['label' => $item],
                $values,
            ));
        }

        $rows = [];

        foreach ($value as $item) {
            if (is_array($item)) {
                $amount = $this->firstNonEmptyString(
                    $item['amount'] ?? null,
                    $item['reward'] ?? null,
                    $item['payout'] ?? null,
                    $item['value'] ?? null,
                );
                $label = $this->firstNonEmptyString(
                    $item['label'] ?? null,
                    $item['name'] ?? null,
                    $item['title'] ?? null,
                    $item['text'] ?? null,
                    $item['description'] ?? null,
                    $item['step'] ?? null,
                    $item['task'] ?? null,
                );

                if ($amount === '' && $label === '') {
                    continue;
                }

                $rows[] = [
                    'amount' => $amount,
                    'label' => $label !== '' ? $label : $amount,
                ];

                continue;
            }

            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            $rows[] = [
                'amount' => '',
                'label' => $text,
            ];
        }

        return $rows;
    }

    private function trimNullableString(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }

    private function resolveOfferImageUrl(mixed $value): string
    {
        $image = trim((string) ($value ?? ''));

        if ($image === '') {
            return '';
        }

        if (preg_match('/^(?:https?:)?\\/\\//i', $image) || str_starts_with($image, 'data:')) {
            return $image;
        }

        $baseUrl = rtrim((string) config('app.url'), '/');

        if ($baseUrl === '') {
            return $image;
        }

        return $baseUrl.'/'.ltrim($image, '/');
    }

    private function formatOfferRewardValue(mixed $points, mixed $payout): string
    {
        $value = is_numeric($points) && (float) $points > 0 ? (float) $points : (float) $payout;

        if (!is_finite($value)) {
            return '0';
        }

        if (floor($value) === $value) {
            return number_format($value, 0, '.', ',');
        }

        return rtrim(rtrim(number_format($value, 2, '.', ','), '0'), '.');
    }

    private function sumCompletedTaskRevenue(?Carbon $from = null, ?Carbon $to = null): string
    {
        $query = CompletedTask::query();

        if ($from && $to) {
            $query->whereBetween('created_at', [$from, $to]);
        }

        return number_format((float) $query->sum('revenue'), 2, '.', '');
    }

    private function sumChargebackRevenue(?Carbon $from = null, ?Carbon $to = null): string
    {
        $query = Chargeback::query();

        if ($from && $to) {
            $query->whereBetween('created_at', [$from, $to]);
        }

        return number_format((float) $query->sum('revenue'), 2, '.', '');
    }

    private function recentUsers()
    {
        return User::query()->latest()->limit(5)->get(['id', 'name', 'username', 'email', 'role', 'balance', 'created_at']);
    }

    private function recentTasks()
    {
        return CompletedTask::query()->latest()->limit(5)->get(['id', 'offer_wall_name', 'offer_name', 'transaction_id', 'currency_reward', 'country', 'created_at']);
    }

    private function recentWithdrawals()
    {
        return Transaction::query()
            ->where('type', 'like', 'withdrawal%')
            ->latest()
            ->limit(5)
            ->get(['id', 'user_name', 'type', 'status', 'amount', 'transaction_id', 'title', 'description', 'created_at']);
    }

    private function recentChargebacks()
    {
        return Chargeback::query()->latest()->limit(5)->get(['id', 'offer_wall_name', 'offer_name', 'transaction_id', 'currency_reward', 'status', 'created_at']);
    }

    private function recentTransactions()
    {
        return Transaction::query()->latest()->limit(5)->get(['id', 'user_name', 'type', 'status', 'amount', 'transaction_id', 'title', 'created_at']);
    }

    private function recentCashoutMethods()
    {
        if (!Schema::hasTable('cashout_methods')) {
            return collect();
        }

        $schema = $this->cashoutMethodSchema();
        $columns = array_map(fn (array $column): string => $column['field'], $schema);

        if ($columns === []) {
            return collect();
        }

        $query = DB::table('cashout_methods')->select($columns);

        foreach ($this->cashoutMethodOrderColumns($schema) as $orderColumn) {
            $query->orderBy($orderColumn);
        }

        return $query->limit(5)->get();
    }

    private function formatPendingWithdrawal(Transaction $withdrawal): array
    {
        $meta = $this->decodeTransactionMeta($withdrawal->meta);

        return [
            'id' => $withdrawal->id,
            'userId' => $withdrawal->user_id,
            'userName' => $withdrawal->user_name ?? '-',
            'transactionId' => $withdrawal->transaction_id ?? (string) $withdrawal->id,
            'title' => $withdrawal->title ?? '-',
            'description' => $withdrawal->description ?? '-',
            'amount' => number_format((float) $withdrawal->amount, 2, '.', ''),
            'status' => $withdrawal->status ?? 'pending',
            'type' => $withdrawal->type ?? '-',
            'cashoutMethodName' => $this->firstNonEmptyString(
                data_get($meta, 'cashoutMethodName'),
                data_get($meta, 'walletName'),
                $withdrawal->title,
                'Cashout method',
            ),
            'walletAddress' => $this->firstNonEmptyString(
                data_get($meta, 'walletAddress'),
                data_get($meta, 'wallet_address'),
                '-',
            ),
            'feeRate' => data_get($meta, 'feeRate'),
            'feeLabel' => $this->firstNonEmptyString(
                data_get($meta, 'feeLabel'),
                is_numeric(data_get($meta, 'feeRate')) ? number_format((float) data_get($meta, 'feeRate'), 2, '.', '').'%' : null,
                null,
            ),
            'date' => $withdrawal->created_at?->toAtomString(),
        ];
    }

    private function decodeTransactionMeta(mixed $meta): array
    {
        if (is_array($meta)) {
            return $meta;
        }

        if (!is_string($meta) || trim($meta) === '') {
            return [];
        }

        $decoded = json_decode($meta, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function cashoutMethodSchema(): array
    {
        if (!Schema::hasTable('cashout_methods')) {
            return [];
        }

        $columns = DB::select('SHOW COLUMNS FROM `cashout_methods`');

        return array_values(array_map(function (object $column): array {
            $field = (string) ($column->Field ?? '');
            $type = strtolower((string) ($column->Type ?? ''));
            $extra = strtolower((string) ($column->Extra ?? ''));
            $nullable = strtoupper((string) ($column->Null ?? '')) === 'YES';
            $default = property_exists($column, 'Default') ? $column->Default : null;

            return [
                'field' => $field,
                'label' => $this->humanizeCashoutMethodField($field),
                'sqlType' => $type,
                'inputType' => $this->inferCashoutMethodInputType($field, $type),
                'nullable' => $nullable,
                'default' => $default,
                'required' => !$nullable && $default === null && $extra !== 'auto_increment' && !in_array($field, ['id', 'created_at', 'updated_at'], true),
                'editable' => !in_array($field, ['id', 'created_at', 'updated_at'], true) && $extra !== 'auto_increment',
                'maxLength' => $this->cashoutMethodMaxLength($type),
                'autoIncrement' => $extra === 'auto_increment',
            ];
        }, $columns));
    }

    private function cashoutMethodOrderColumns(array $schema): array
    {
        $columns = array_column($schema, 'field');
        $orderColumns = [];

        foreach (['sort_order', 'order', 'id'] as $column) {
            if (in_array($column, $columns, true)) {
                $orderColumns[] = $column;
            }
        }

        return $orderColumns;
    }

    private function cashoutMethodValidationRules(array $schema): array
    {
        $rules = [];

        foreach ($schema as $column) {
            if (empty($column['editable'])) {
                continue;
            }

            $field = $column['field'];
            $fieldRules = [];

            if (!empty($column['required'])) {
                $fieldRules[] = 'required';
            } else {
                $fieldRules[] = 'nullable';
            }

            $inputType = $column['inputType'] ?? 'string';
            if ($inputType === 'boolean') {
                $fieldRules[] = 'boolean';
            } elseif ($inputType === 'number') {
                $fieldRules[] = 'numeric';
            } else {
                $fieldRules[] = 'string';
                $fieldRules[] = 'max:'.(int) ($column['maxLength'] ?? 65535);
            }

            $rules[$field] = $fieldRules;
        }

        return $rules;
    }

    private function cashoutMethodPayload(array $validated, array $schema, bool $isCreate): array
    {
        $payload = [];
        $columns = array_column($schema, 'field');

        foreach ($schema as $column) {
            if (empty($column['editable'])) {
                continue;
            }

            $field = $column['field'];
            if (!array_key_exists($field, $validated)) {
                continue;
            }

            $value = $validated[$field];
            if ($value === '' || $value === null) {
                continue;
            }

            $payload[$field] = $this->castCashoutMethodValue($field, $value, $column['inputType'] ?? 'string');
        }

        if ($isCreate && in_array('created_at', $columns, true)) {
            $payload['created_at'] = now();
        }

        if (in_array('updated_at', $columns, true)) {
            $payload['updated_at'] = now();
        }

        return $payload;
    }

    private function findCashoutMethodRowById(int $id, array $schema): ?object
    {
        $columns = array_map(fn (array $column): string => $column['field'], $schema);

        if ($columns === []) {
            return null;
        }

        return DB::table('cashout_methods')
            ->select($columns)
            ->where('id', $id)
            ->first();
    }

    private function castCashoutMethodValue(string $field, mixed $value, string $inputType): mixed
    {
        if ($inputType === 'boolean') {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        }

        if ($inputType === 'number') {
            return is_numeric($value) && (string) (int) $value === (string) $value ? (int) $value : (float) $value;
        }

        return trim((string) $value);
    }

    private function inferCashoutMethodInputType(string $field, string $sqlType): string
    {
        $normalizedField = strtolower($field);

        if (
            str_contains($normalizedField, 'is_') ||
            str_ends_with($normalizedField, '_active') ||
            str_ends_with($normalizedField, '_enabled') ||
            $normalizedField === 'active' ||
            $normalizedField === 'enabled'
        ) {
            return 'boolean';
        }

        if (
            str_contains($normalizedField, 'description') ||
            str_contains($normalizedField, 'note') ||
            str_contains($normalizedField, 'detail') ||
            str_contains($sqlType, 'text')
        ) {
            return 'textarea';
        }

        if (
            str_contains($sqlType, 'int') ||
            str_contains($sqlType, 'decimal') ||
            str_contains($sqlType, 'float') ||
            str_contains($sqlType, 'double') ||
            str_contains($sqlType, 'numeric') ||
            str_contains($sqlType, 'bit')
        ) {
            return 'number';
        }

        return 'string';
    }

    private function cashoutMethodMaxLength(string $sqlType): int
    {
        if (str_contains($sqlType, 'text')) {
            return 65535;
        }

        if (preg_match('/varchar\((\d+)\)/i', $sqlType, $matches) === 1) {
            return (int) $matches[1];
        }

        return 255;
    }

    private function humanizeCashoutMethodField(string $field): string
    {
        return trim(preg_replace('/\s+/', ' ', ucwords(str_replace(['_', '-'], ' ', $field))) ?? $field);
    }

    private function timelineEnabled(): bool
    {
        return Setting::boolean(self::TIMELINE_ENABLED_SETTING, true);
    }

    private function siteLogo(): string
    {
        return Setting::value(self::SITE_LOGO_SETTING);
    }
}
