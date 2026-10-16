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
     * Get platform statistics and available months for moderator panel.
     */
    public function stats(Request $request): JsonResponse
    {
        $months = [];
        $dailyCounts = [];
        $dateCount = 0;
        $selectedMonth = trim((string) $request->input('month', ''));
        $selectedDate = trim((string) $request->input('date', ''));

        if (Schema::hasTable('completed_tasks')) {
            $months = DB::table('completed_tasks')
                ->selectRaw("DISTINCT SUBSTRING(created_at, 1, 7) as month_val")
                ->whereNotNull('created_at')
                ->orderByDesc('month_val')
                ->limit(24)
                ->pluck('month_val')
                ->filter()
                ->values()
                ->all();

            $targetMonth = ($selectedMonth !== '' && $selectedMonth !== 'all')
                ? $selectedMonth
                : ($months[0] ?? Carbon::now()->format('Y-m'));

            $dailyCounts = DB::table('completed_tasks')
                ->selectRaw("SUBSTRING(created_at, 1, 10) as day_date, COUNT(*) as count")
                ->where('created_at', 'like', $targetMonth . '%')
                ->groupBy('day_date')
                ->pluck('count', 'day_date')
                ->all();

            if ($selectedDate !== '' && strtolower($selectedDate) !== 'all') {
                $dateCount = DB::table('completed_tasks')->whereDate('created_at', $selectedDate)->count();
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_users' => User::count(),
                'months' => $months,
                'daily_counts' => $dailyCounts,
                'date_count' => $dateCount,
            ],
        ]);
    }

    /**
     * Get paginated user list or coin credit activity with search ranking, view mode, and date/month filters.
     * Zero N+1 queries.
     */
    public function users(Request $request): JsonResponse
    {
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

            // 1. Date / Month filter
            if ($isSpecificSingleDate) {
                $query->whereDate('completed_tasks.created_at', $date);
            } elseif ($month !== '' && strtolower($month) !== 'all') {
                $query->where('completed_tasks.created_at', 'like', $month . '%');
            }

            // 2. Prefix-only search filter & ranking
            if ($search !== '') {
                $escapedSearch = addcslashes($search, '%_\\');
                $prefixLike = $escapedSearch . '%';
                $isNumeric = is_numeric($search);
                $numericId = $isNumeric ? (int) $search : -1;

                $query->where(function ($q) use ($prefixLike, $isNumeric, $numericId) {
                    $q->where('completed_tasks.user_name', 'like', $prefixLike)
                      ->orWhere('users.username', 'like', $prefixLike)
                      ->orWhere('users.name', 'like', $prefixLike);

                    if ($isNumeric) {
                        $q->orWhere('completed_tasks.user_id', $numericId)
                          ->orWhere('completed_tasks.id', $numericId);
                    }
                });

                $query->orderByRaw('
                    CASE
                        WHEN LOWER(COALESCE(users.username, completed_tasks.user_name)) = LOWER(?) THEN 1
                        WHEN completed_tasks.user_id = ? THEN 2
                        WHEN LOWER(COALESCE(users.username, completed_tasks.user_name)) LIKE LOWER(?) THEN 3
                        ELSE 4
                    END ASC, completed_tasks.created_at DESC, completed_tasks.id DESC
                ', [
                    $search,
                    $numericId,
                    $prefixLike,
                ]);
            } else {
                $query->orderByDesc('completed_tasks.created_at')
                      ->orderByDesc('completed_tasks.id');
            }

            // 3. Pagination (Auto-all for specific dates or requested all)
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

            $data = collect($paginator->items())->map(function ($item) {
                $createdAt = $item->created_at ? Carbon::parse($item->created_at) : null;

                return [
                    'id' => (int) $item->task_id,
                    'user_id' => (int) ($item->user_id ?? 0),
                    'username' => (string) ($item->username ?? '—'),
                    'name' => (string) ($item->name ?? '—'),
                    'balance' => (float) ($item->balance ?? 0),
                    'wall_name' => (string) ($item->wall_name ?? '—'),
                    'offer_name' => (string) ($item->offer_name ?? '—'),
                    'credited_coins' => (float) ($item->credited_coins ?? 0),
                    'created_at' => $item->created_at,
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
        // VIEW: ALL (Standard registered users directory with wall monitoring)
        // =========================================================================
        $query = User::query()->select(['id', 'username', 'name', 'balance']);

        // 1. Prefix-only search filter across full DB
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

        // 2. Date / Month filter scoped to completed tasks
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

        // 3. Search Ranking Order (Exact username -> Exact user ID -> Username prefix -> Display name prefix -> ID ASC)
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
            // Default ordering: oldest accounts first (ID 1, 2, 3...)
            $query->orderBy('id', 'asc');
        }

        // 4. Server-side pagination (Auto-all for specific date or requested all)
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

        // 5. Fetch latest completed task for ONLY the users on the current page (Zero N+1!)
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

        // 6. Explicit whitelist mapping guarantees zero sensitive data exposure
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
