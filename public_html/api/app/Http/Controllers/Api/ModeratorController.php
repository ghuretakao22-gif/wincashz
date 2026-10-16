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
    public function stats(): JsonResponse
    {
        $months = [];

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
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_users' => User::count(),
                'months' => $months,
            ],
        ]);
    }

    /**
     * Get paginated user list with wall credit activity, search ranking, and date/month filters.
     * Zero N+1 queries.
     */
    public function users(Request $request): JsonResponse
    {
        $allowedPerPage = [25, 50, 100];
        $perPage = (int) $request->input('per_page', 25);
        if (! in_array($perPage, $allowedPerPage, true)) {
            $perPage = 25;
        }

        $query = User::query()->select(['id', 'username', 'name', 'balance']);

        $search = trim((string) $request->input('search', ''));
        $date = trim((string) ($request->input('date', $request->input('from_date', ''))));
        $month = trim((string) $request->input('month', ''));

        // 1. Search filter across full DB
        if ($search !== '') {
            $isNumeric = is_numeric($search);
            $numericId = $isNumeric ? (int) $search : -1;

            $query->where(function ($q) use ($search, $isNumeric, $numericId) {
                $q->where('username', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");

                if ($isNumeric) {
                    $q->orWhere('id', $numericId);
                }
            });
        }

        // 2. Date / Month filter scoped to completed tasks
        $hasCompletedTasks = Schema::hasTable('completed_tasks');

        if ($hasCompletedTasks) {
            if ($date !== '' && strtolower($date) !== 'all') {
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

        // 3. Search Ranking Order (Exact username -> Exact user ID -> Username prefix -> Display name prefix -> Contains -> Alphabetical)
        if ($search !== '') {
            $isNumeric = is_numeric($search);
            $numericId = $isNumeric ? (int) $search : -1;

            $query->orderByRaw('
                CASE
                    WHEN LOWER(username) = LOWER(?) THEN 1
                    WHEN id = ? THEN 2
                    WHEN LOWER(username) LIKE LOWER(?) THEN 3
                    WHEN LOWER(name) LIKE LOWER(?) THEN 4
                    ELSE 5
                END ASC, username ASC
            ', [
                $search,
                $numericId,
                "{$search}%",
                "{$search}%",
            ]);
        } else {
            $query->orderBy('id', 'asc');
        }

        // 4. Server-side pagination
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

            if ($date !== '' && strtolower($date) !== 'all') {
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
