<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorController extends Controller
{
    /**
     * Get platform statistics and available months scoped strictly to the moderator's My ID.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $isModerator = $user && $user->role === 'moderator';
        $hasMyIdCol = Schema::hasColumn('users', 'my_id');
        $myIdCode = $hasMyIdCol ? trim((string) ($user?->my_id ?? '')) : '';

        // If moderator has no My ID assigned in a full environment
        if ($isModerator && $hasMyIdCol && $myIdCode === '') {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'total_users' => 0,
                    'months' => [],
                    'daily_counts' => [],
                    'date_count' => 0,
                ],
            ]);
        }

        $months = [];
        $dailyCounts = [];
        $dateCount = 0;
        $selectedMonth = trim((string) $request->input('month', ''));
        $selectedDate = trim((string) $request->input('date', ''));

        // Count users (scoped to moderator's My ID when present)
        $usersCountQuery = User::query();
        if ($isModerator && $hasMyIdCol && $myIdCode !== '') {
            $usersCountQuery->where('my_id', $myIdCode);
        }
        $totalUsers = $usersCountQuery->count();

        if (Schema::hasTable('completed_tasks')) {
            $tasksQuery = DB::table('completed_tasks');
            if ($isModerator && $hasMyIdCol && $myIdCode !== '') {
                $tasksQuery->join('users', 'users.id', '=', 'completed_tasks.user_id')
                    ->where('users.my_id', $myIdCode);
            }

            $months = (clone $tasksQuery)
                ->selectRaw("DISTINCT SUBSTRING(completed_tasks.created_at, 1, 7) as month_val")
                ->whereNotNull('completed_tasks.created_at')
                ->orderByDesc('month_val')
                ->limit(24)
                ->pluck('month_val')
                ->filter()
                ->values()
                ->all();

            $targetMonth = ($selectedMonth !== '' && $selectedMonth !== 'all')
                ? $selectedMonth
                : ($months[0] ?? Carbon::now()->format('Y-m'));

            $dailyCounts = (clone $tasksQuery)
                ->selectRaw("SUBSTRING(completed_tasks.created_at, 1, 10) as day_date, COUNT(*) as count")
                ->where('completed_tasks.created_at', 'like', $targetMonth . '%')
                ->groupBy('day_date')
                ->pluck('count', 'day_date')
                ->all();

            if ($selectedDate !== '' && strtolower($selectedDate) !== 'all') {
                $dateCount = (clone $tasksQuery)
                    ->whereDate('completed_tasks.created_at', $selectedDate)
                    ->count();
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_users' => $totalUsers,
                'months' => $months,
                'daily_counts' => $dailyCounts,
                'date_count' => $dateCount,
            ],
        ]);
    }

    /**
     * Get paginated user list or coin credit activity strictly scoped to moderator's My ID.
     */
    public function users(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $isModerator = $user && $user->role === 'moderator';
        $hasMyIdCol = Schema::hasColumn('users', 'my_id');
        $myIdCode = $hasMyIdCol ? trim((string) ($user?->my_id ?? '')) : '';

        // If moderator has no My ID in a full environment
        if ($hasMyIdCol && $myIdCode === '') {
            $emptyPagination = [
                'currentPage' => 1,
                'current_page' => 1,
                'lastPage' => 1,
                'last_page' => 1,
                'perPage' => 25,
                'per_page' => 25,
                'total' => 0,
                'from' => 0,
                'to' => 0,
            ];

            return response()->json([
                'status' => 'success',
                'data' => [],
                'pagination' => $emptyPagination,
                'offerwalls' => [],
                'providers' => [],
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 25,
                'total' => 0,
                'from' => 0,
                'to' => 0,
            ]);
        }

        $view = strtolower(trim((string) $request->input('view', 'all')));
        $search = trim((string) $request->input('search', ''));
        $wallFilter = trim((string) $request->input('wall', $request->input('offerwall', $request->input('provider', ''))));
        $date = trim((string) ($request->input('date', $request->input('from_date', ''))));
        $month = trim((string) $request->input('month', ''));
        $isValidDate = ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date));
        $isValidMonth = ($month !== '' && preg_match('/^\d{4}-\d{2}$/', $month));
        $isSpecificSingleDate = $isValidDate;

        $startStr = null;
        $endStr = null;
        if ($isValidDate) {
            $dateStart = Carbon::createFromFormat('Y-m-d', $date, 'UTC')->startOfDay();
            $dateEnd = (clone $dateStart)->addDay();
            $startStr = $dateStart->toDateTimeString();
            $endStr = $dateEnd->toDateTimeString();
        } elseif ($isValidMonth) {
            $dateStart = Carbon::createFromFormat('Y-m', $month, 'UTC')->startOfMonth();
            $dateEnd = (clone $dateStart)->addMonth();
            $startStr = $dateStart->toDateTimeString();
            $endStr = $dateEnd->toDateTimeString();
        }
        $hasCompletedTasks = Schema::hasTable('completed_tasks');

        // =========================================================================
        // VIEW: COINS (All credited coin transactions / completed offers)
        // =========================================================================
        if ($view === 'coins') {
            if (! $hasCompletedTasks) {
                return response()->json([
                    'status' => 'success',
                    'data' => [],
                    'pagination' => ['currentPage' => 1, 'lastPage' => 1, 'perPage' => 25, 'total' => 0, 'from' => 0, 'to' => 0],
                ]);
            }

            $query = DB::table('completed_tasks')
                ->leftJoin('users', 'users.id', '=', 'completed_tasks.user_id')
                ->select([
                    'completed_tasks.id as task_id',
                    'completed_tasks.user_id as user_id',
                    DB::raw('COALESCE(users.username, completed_tasks.user_name) as username'),
                    'users.name as name',
                    'users.balance as balance',
                    'completed_tasks.offer_wall_name as wall_name',
                    'completed_tasks.offer_name as offer_name',
                    'completed_tasks.currency_reward as credited_coins',
                    'completed_tasks.created_at as created_at',
                ]);

            // Scope strictly to moderator's My ID
            if ($hasMyIdCol) {
                $query->where('users.my_id', $myIdCode);
            }

            if ($wallFilter !== '' && strtolower($wallFilter) !== 'all') {
                $query->whereRaw('LOWER(TRIM(completed_tasks.offer_wall_name)) = ?', [strtolower($wallFilter)]);
            }

            if ($search !== '') {
                $escapedSearch = addcslashes($search, '%_\\');
                $prefixLike = $escapedSearch . '%';
                $isNumeric = is_numeric($search);
                $numericId = $isNumeric ? (int) $search : -1;

                $query->where(function ($q) use ($prefixLike, $isNumeric, $numericId) {
                    $q->where(DB::raw('COALESCE(users.username, completed_tasks.user_name)'), 'like', $prefixLike)
                      ->orWhere('users.name', 'like', $prefixLike);

                    if ($isNumeric) {
                        $q->orWhere('completed_tasks.user_id', $numericId);
                    }
                });
            }

            if ($startStr !== null && $endStr !== null) {
                $query->where('completed_tasks.created_at', '>=', $startStr)
                      ->where('completed_tasks.created_at', '<', $endStr);
            }

            $query->orderByDesc('completed_tasks.created_at')
                  ->orderByDesc('completed_tasks.id');

            $rawPerPage = $request->input('per_page');
            $isAll = (is_string($rawPerPage) && strtolower(trim($rawPerPage)) === 'all');

            if ($isAll || $isSpecificSingleDate) {
                $totalCount = (clone $query)->count();
                $perPage = max(1, $totalCount);
            } else {
                $allowedPerPage = [25, 50, 100];
                $perPage = (int) $rawPerPage;
                if (! in_array($perPage, $allowedPerPage, true)) {
                    $perPage = 25;
                }
            }

            $paginator = $query->paginate($perPage);

            $data = collect($paginator->items())->map(function ($row) {
                $createdAt = $row->created_at ? Carbon::parse($row->created_at) : null;

                return [
                    'id' => (int) $row->task_id,
                    'user_id' => $row->user_id ? (int) $row->user_id : null,
                    'username' => (string) $row->username,
                    'name' => (string) ($row->name ?? ''),
                    'balance' => (float) ($row->balance ?? 0),
                    'wall_name' => (string) ($row->wall_name ?? '—'),
                    'offer_name' => (string) ($row->offer_name ?? '—'),
                    'credited_coins' => (float) ($row->credited_coins ?? 0),
                    'created_at' => $row->created_at,
                    'credit_at' => $row->created_at,
                    'credit_date' => $createdAt ? $createdAt->format('d M Y') : '—',
                    'credit_time' => $createdAt ? $createdAt->format('h:i A') : '—',
                ];
            })->values()->all();

            $paginatorTotal = $paginator->total();
            $perPageDisplay = $isAll ? $paginatorTotal : $paginator->perPage();
            $from = $paginatorTotal > 0 ? ($paginator->firstItem() ?? 1) : 0;
            $to = $paginatorTotal > 0 ? ($paginator->lastItem() ?? $paginatorTotal) : 0;
            $currentPage = $isAll ? 1 : $paginator->currentPage();
            $lastPage = $isAll ? 1 : $paginator->lastPage();

            $paginationData = [
                'currentPage' => $currentPage,
                'current_page' => $currentPage,
                'lastPage' => $lastPage,
                'last_page' => $lastPage,
                'perPage' => $perPageDisplay,
                'per_page' => $perPageDisplay,
                'total' => $paginatorTotal,
                'from' => $from,
                'to' => $to,
            ];

            return response()->json([
                'status' => 'success',
                'data' => $data,
                'pagination' => $paginationData,
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => $perPageDisplay,
                'total' => $paginatorTotal,
                'from' => $from,
                'to' => $to,
            ]);
        }

        // =========================================================================
        // VIEW: ALL (User Directory)
        // =========================================================================
        $query = User::query()->select(['id', 'username', 'name', 'email', 'balance', 'ban', 'created_at']);

        // Scope strictly to moderator's My ID
        if ($hasMyIdCol) {
            $query->where('users.my_id', $myIdCode);
        }

        if ($wallFilter !== '' && strtolower($wallFilter) !== 'all' && $hasCompletedTasks) {
            $query->whereExists(function ($sub) use ($wallFilter) {
                $sub->select(DB::raw(1))
                    ->from('completed_tasks')
                    ->whereColumn('completed_tasks.user_id', 'users.id')
                    ->whereRaw('LOWER(TRIM(completed_tasks.offer_wall_name)) = ?', [strtolower($wallFilter)]);
            });
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $prefixLike = $escapedSearch . '%';
            $isNumeric = is_numeric($search);
            $numericId = $isNumeric ? (int) $search : -1;

            $query->where(function ($q) use ($prefixLike, $isNumeric, $numericId, $hasCompletedTasks) {
                $q->where('username', 'like', $prefixLike)
                  ->orWhere('name', 'like', $prefixLike)
                  ->orWhere('email', 'like', $prefixLike);

                if ($isNumeric) {
                    $q->orWhere('users.id', $numericId);
                }

                if ($hasCompletedTasks) {
                    $q->orWhereExists(function ($sub) use ($prefixLike) {
                        $sub->select(DB::raw(1))
                            ->from('completed_tasks')
                            ->whereColumn('completed_tasks.user_id', 'users.id')
                            ->where(function ($ts) use ($prefixLike) {
                                $ts->where('offer_name', 'like', $prefixLike)
                                   ->orWhere('offer_wall_name', 'like', $prefixLike)
                                   ->orWhere('transaction_id', 'like', $prefixLike);
                            });
                    });
                }
            });
        }

        if ($startStr !== null && $endStr !== null) {
            $query->where(function ($q) use ($startStr, $endStr, $hasCompletedTasks) {
                $q->where('users.created_at', '>=', $startStr)
                  ->where('users.created_at', '<', $endStr);

                if ($hasCompletedTasks) {
                    $q->orWhereExists(function ($sub) use ($startStr, $endStr) {
                        $sub->select(DB::raw(1))
                            ->from('completed_tasks')
                            ->whereColumn('completed_tasks.user_id', 'users.id')
                            ->where('completed_tasks.created_at', '>=', $startStr)
                            ->where('completed_tasks.created_at', '<', $endStr);
                    });
                }
            });
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $prefixLike = $escapedSearch . '%';
            $isNumeric = is_numeric($search);
            $numericId = $isNumeric ? (int) $search : -1;

            $query->orderByRaw('
                CASE
                    WHEN LOWER(username) = LOWER(?) THEN 1
                    WHEN id = ? THEN 2
                    WHEN LOWER(username) LIKE LOWER(?) THEN 3
                    WHEN LOWER(name) LIKE LOWER(?) THEN 4
                    ELSE 5
                END ASC, username ASC, id ASC
            ', [
                $search,
                $numericId,
                $prefixLike,
                $prefixLike,
            ]);
        } else {
            $query->orderBy('id', 'asc');
        }

        $rawPerPage = $request->input('per_page');
        $isAll = (is_string($rawPerPage) && strtolower(trim($rawPerPage)) === 'all');

        if ($isAll || $isSpecificSingleDate) {
            $totalCount = (clone $query)->count();
            $perPage = max(1, $totalCount);
        } else {
            $allowedPerPage = [25, 50, 100];
            $perPage = (int) $rawPerPage;
            if (! in_array($perPage, $allowedPerPage, true)) {
                $perPage = 25;
            }
        }

        $users = $query->paginate($perPage);

        $userIds = collect($users->items())->pluck('id')->filter()->all();
        $latestTasks = collect();
        $completedCounts = [];

        if (! empty($userIds) && $hasCompletedTasks) {
            $taskQuery = DB::table('completed_tasks')
                ->whereIn('user_id', $userIds)
                ->select(['id', 'user_id', 'offer_wall_name', 'currency_reward', 'created_at'])
                ->orderByDesc('created_at')
                ->orderByDesc('id');

            if ($startStr !== null && $endStr !== null) {
                $taskQuery->where('created_at', '>=', $startStr)
                          ->where('created_at', '<', $endStr);
            }

            $latestTasks = $taskQuery->get()->groupBy('user_id')->map(fn ($group) => $group->first());

            $completedCounts = DB::table('completed_tasks')
                ->whereIn('user_id', $userIds)
                ->groupBy('user_id')
                ->selectRaw('user_id, COUNT(*) as cnt')
                ->pluck('cnt', 'user_id')
                ->all();
        }

        $data = collect($users->items())->map(function ($u) use ($latestTasks, $completedCounts) {
            $task = $latestTasks->get($u->id);
            $createdAt = $task && $task->created_at ? Carbon::parse($task->created_at) : null;
            $userCreated = $u->created_at ? Carbon::parse($u->created_at) : null;

            $rawEmail = trim((string) ($u->email ?? ''));
            $maskedEmail = '—';
            if ($rawEmail !== '' && str_contains($rawEmail, '@')) {
                [$local, $domain] = explode('@', $rawEmail, 2);
                $maskedEmail = (strlen($local) <= 2)
                    ? substr($local, 0, 1) . '***@' . $domain
                    : substr($local, 0, 2) . '***@' . $domain;
            }

            $isBanned = (bool) ($u->ban ?? false);

            return [
                'id' => (int) $u->id,
                'username' => (string) $u->username,
                'name' => (string) ($u->name ?? ''),
                'masked_email' => $maskedEmail,
                'joined_at' => $userCreated ? $userCreated->format('d M Y') : '—',
                'created_at' => $u->created_at,
                'completed_offers' => (int) ($completedCounts[$u->id] ?? 0),
                'completed_offers_count' => (int) ($completedCounts[$u->id] ?? 0),
                'status' => $isBanned ? 'Banned' : 'Active',
                'is_banned' => $isBanned,
                'balance' => (float) ($u->balance ?? 0),
                'latest_wall' => $task ? ($task->offer_wall_name ?? '—') : '—',
                'latest_coins' => $task ? (float) ($task->currency_reward ?? 0) : null,
                'latest_credit_at' => $task ? $task->created_at : null,
                'latest_credit_date' => $createdAt ? $createdAt->format('d M Y') : '—',
                'latest_credit_time' => $createdAt ? $createdAt->format('h:i A') : '—',
            ];
        })->values()->all();

        $paginatorTotal = $users->total();
        $perPageDisplay = $isAll ? $paginatorTotal : $users->perPage();
        $from = $paginatorTotal > 0 ? ($users->firstItem() ?? 1) : 0;
        $to = $paginatorTotal > 0 ? ($users->lastItem() ?? $paginatorTotal) : 0;
        $currentPage = $isAll ? 1 : $users->currentPage();
        $lastPage = $isAll ? 1 : $users->lastPage();

        $paginationData = [
            'currentPage' => $currentPage,
            'current_page' => $currentPage,
            'lastPage' => $lastPage,
            'last_page' => $lastPage,
            'perPage' => $perPageDisplay,
            'per_page' => $perPageDisplay,
            'total' => $paginatorTotal,
            'from' => $from,
            'to' => $to,
        ];

        $offerwalls = [];
        if ($hasCompletedTasks && $hasMyIdCol && $myIdCode !== '') {
            $offerwalls = DB::table('completed_tasks')
                ->join('users', 'users.id', '=', 'completed_tasks.user_id')
                ->where('users.my_id', $myIdCode)
                ->whereNotNull('completed_tasks.offer_wall_name')
                ->where('completed_tasks.offer_wall_name', '!=', '')
                ->distinct()
                ->orderBy('completed_tasks.offer_wall_name')
                ->pluck('completed_tasks.offer_wall_name')
                ->filter()
                ->values()
                ->all();
        }

        if (Schema::hasTable('my_id_earnings') && $myIdCode !== '') {
            $earningProviders = DB::table('my_id_earnings')
                ->where('my_id_code', $myIdCode)
                ->whereNotNull('provider')
                ->where('provider', '!=', '')
                ->distinct()
                ->pluck('provider')
                ->filter()
                ->values()
                ->all();
            $offerwalls = array_values(array_unique(array_merge($offerwalls, $earningProviders)));
            sort($offerwalls);
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'pagination' => $paginationData,
            'offerwalls' => $offerwalls,
            'providers' => $offerwalls,
            'current_page' => $currentPage,
            'last_page' => $lastPage,
            'per_page' => $perPageDisplay,
            'total' => $paginatorTotal,
            'from' => $from,
            'to' => $to,
        ]);
    }

    /**
     * Get recent offerwall activity for a single user (Read-only, max 15 entries).
     */
    public function activity(Request $request, int $id): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $isModerator = $user && $user->role === 'moderator';
        $hasMyIdCol = Schema::hasColumn('users', 'my_id');
        $myIdCode = $hasMyIdCol ? trim((string) ($user?->my_id ?? '')) : '';

        // If moderator, verify target user belongs to moderator's My ID
        if ($hasMyIdCol) {
            if ($myIdCode === '' || ! User::where('id', $id)->where('my_id', $myIdCode)->exists()) {
                return response()->json([
                    'status' => 'success',
                    'data' => [],
                ]);
            }
        }

        $activities = [];

        if (Schema::hasTable('completed_tasks')) {
            $activities = DB::table('completed_tasks')
                ->where('user_id', $id)
                ->select(['id', 'offer_wall_name', 'currency_reward', 'created_at'])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(15)
                ->get()
                ->map(function ($t) {
                    $createdAt = $t->created_at ? Carbon::parse($t->created_at) : null;

                    return [
                        'id' => (int) $t->id,
                        'offer_wall_name' => $t->offer_wall_name ?? '—',
                        'currency_reward' => (float) ($t->currency_reward ?? 0),
                        'created_at' => $t->created_at,
                        'credit_date' => $createdAt ? $createdAt->format('d M Y') : '—',
                        'credit_time' => $createdAt ? $createdAt->format('h:i A') : '—',
                    ];
                })
                ->values()
                ->all();
        }

        return response()->json([
            'status' => 'success',
            'data' => $activities,
        ]);
    }
}
