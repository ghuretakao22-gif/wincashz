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
        if ($isModerator && $hasMyIdCol && $myIdCode === '') {
            return response()->json([
                'status' => 'success',
                'data' => [],
                'pagination' => ['currentPage' => 1, 'lastPage' => 1, 'perPage' => 25, 'total' => 0, 'from' => 0, 'to' => 0],
            ]);
        }

        $view = strtolower(trim((string) $request->input('view', 'all')));
        $search = trim((string) $request->input('search', ''));
        $date = trim((string) ($request->input('date', $request->input('from_date', ''))));
        $month = trim((string) $request->input('month', ''));
        $isSpecificSingleDate = ($date !== '' && strtolower($date) !== 'all');
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
            if ($isModerator && $hasMyIdCol && $myIdCode !== '') {
                $query->where('users.my_id', $myIdCode);
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

            if ($isSpecificSingleDate) {
                $query->whereDate('completed_tasks.created_at', $date);
            } elseif ($month !== '' && strtolower($month) !== 'all') {
                $query->where('completed_tasks.created_at', 'like', $month . '%');
            }

            $query->orderByDesc('completed_tasks.created_at')
                  ->orderByDesc('completed_tasks.id');

            if ($request->input('per_page') === 'all' || $isSpecificSingleDate) {
                $perPage = max(1, (clone $query)->count());
            } else {
                $allowedPerPage = [25, 50, 100];
                $perPage = (int) $request->input('per_page', 25);
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

            return response()->json([
                'status' => 'success',
                'data' => $data,
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

        // =========================================================================
        // VIEW: ALL (User Directory)
        // =========================================================================
        $query = User::query()->select(['id', 'username', 'name', 'balance', 'created_at']);

        // Scope strictly to moderator's My ID
        if ($isModerator && $hasMyIdCol && $myIdCode !== '') {
            $query->where('my_id', $myIdCode);
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $prefixLike = $escapedSearch . '%';
            $isNumeric = is_numeric($search);
            $numericId = $isNumeric ? (int) $search : -1;

            $query->where(function ($q) use ($prefixLike, $isNumeric, $numericId) {
                $q->where('username', 'like', $prefixLike)
                  ->orWhere('name', 'like', $prefixLike);

                if ($isNumeric) {
                    $q->orWhere('id', $numericId);
                }
            });
        }

        if ($hasCompletedTasks) {
            if ($isSpecificSingleDate) {
                $query->whereExists(function ($sub) use ($date) {
                    $sub->select(DB::raw(1))
                        ->from('completed_tasks')
                        ->whereColumn('completed_tasks.user_id', 'users.id')
                        ->whereDate('completed_tasks.created_at', $date);
                });
            } elseif ($month !== '' && strtolower($month) !== 'all') {
                $query->whereExists(function ($sub) use ($month) {
                    $sub->select(DB::raw(1))
                        ->from('completed_tasks')
                        ->whereColumn('completed_tasks.user_id', 'users.id')
                        ->where('completed_tasks.created_at', 'like', $month . '%');
                });
            }
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

        if ($request->input('per_page') === 'all' || $isSpecificSingleDate) {
            $perPage = max(1, (clone $query)->count());
        } else {
            $allowedPerPage = [25, 50, 100];
            $perPage = (int) $request->input('per_page', 25);
            if (! in_array($perPage, $allowedPerPage, true)) {
                $perPage = 25;
            }
        }

        $users = $query->paginate($perPage);

        $userIds = collect($users->items())->pluck('id')->filter()->all();
        $latestTasks = collect();

        if (! empty($userIds) && $hasCompletedTasks) {
            $taskQuery = DB::table('completed_tasks')
                ->whereIn('user_id', $userIds)
                ->select(['id', 'user_id', 'offer_wall_name', 'currency_reward', 'created_at'])
                ->orderByDesc('created_at')
                ->orderByDesc('id');

            if ($isSpecificSingleDate) {
                $taskQuery->whereDate('created_at', $date);
            } elseif ($month !== '' && strtolower($month) !== 'all') {
                $taskQuery->where('created_at', 'like', $month . '%');
            }

            $latestTasks = $taskQuery->get()->groupBy('user_id')->map(fn ($group) => $group->first());
        }

        $data = collect($users->items())->map(function ($u) use ($latestTasks) {
            $task = $latestTasks->get($u->id);
            $createdAt = $task && $task->created_at ? Carbon::parse($task->created_at) : null;

            return [
                'id' => (int) $u->id,
                'username' => (string) $u->username,
                'name' => (string) ($u->name ?? ''),
                'balance' => (float) ($u->balance ?? 0),
                'latest_wall' => $task ? ($task->offer_wall_name ?? '—') : '—',
                'latest_coins' => $task ? (float) ($task->currency_reward ?? 0) : null,
                'latest_credit_at' => $task ? $task->created_at : null,
                'latest_credit_date' => $createdAt ? $createdAt->format('d M Y') : '—',
                'latest_credit_time' => $createdAt ? $createdAt->format('h:i A') : '—',
            ];
        })->values()->all();

        return response()->json([
            'status' => 'success',
            'data' => $data,
            'pagination' => [
                'currentPage' => $users->currentPage(),
                'lastPage' => $users->lastPage(),
                'perPage' => $users->perPage(),
                'total' => $users->total(),
                'from' => $users->firstItem() ?? 0,
                'to' => $users->lastItem() ?? 0,
            ],
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
        if ($isModerator && $hasMyIdCol && $myIdCode !== '') {
            $targetUserBelongs = User::where('id', $id)->where('my_id', $myIdCode)->exists();
            if (! $targetUserBelongs) {
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
