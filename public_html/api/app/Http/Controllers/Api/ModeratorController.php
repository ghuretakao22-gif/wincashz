<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModeratorController extends Controller
{
    /**
     * Get platform statistics for moderator panel.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => [
                'total_users' => User::count(),
            ],
        ]);
    }

    /**
     * Get paginated user list with strict column whitelist and ranking search.
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

        $users = $query->paginate($perPage);

        // Explicit whitelist mapping guarantees zero sensitive field leakage
        $data = collect($users->items())->map(function ($u) {
            return [
                'id' => (int) $u->id,
                'username' => (string) $u->username,
                'name' => (string) ($u->name ?? ''),
                'balance' => (float) ($u->balance ?? 0),
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
}
