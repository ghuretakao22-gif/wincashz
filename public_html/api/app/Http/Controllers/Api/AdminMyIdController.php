<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminMyIdController extends Controller
{
    /**
     * Display a listing of My IDs with linked user count and optional search.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $query = MyId::query()->withCount('users');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('my_id_code', 'like', "%{$search}%")
                  ->orWhere('label', 'like', "%{$search}%");
            });
        }

        $myIds = $query->orderByDesc('id')->get();

        return response()->json([
            'success' => true,
            'data' => $myIds,
        ]);
    }

    /**
     * Store a newly created My ID.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'my_id_code' => ['required', 'string', 'max:50', 'unique:my_ids,my_id_code'],
            'label' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'my_id_code.required' => 'My ID code is required.',
            'my_id_code.unique' => 'This My ID already exists.',
            'my_id_code.max' => 'My ID code cannot exceed 50 characters.',
        ]);

        $myId = MyId::create([
            'my_id_code' => trim($validated['my_id_code']),
            'label' => isset($validated['label']) && trim((string) $validated['label']) !== '' ? trim((string) $validated['label']) : null,
            'is_active' => $request->has('is_active') ? (bool) $request->input('is_active') : true,
        ]);

        $myId->loadCount('users');

        return response()->json([
            'success' => true,
            'message' => 'My ID created successfully.',
            'data' => $myId,
        ], 201);
    }

    /**
     * Update the specified My ID (label, status).
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $myId = MyId::query()->findOrFail($id);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->has('label')) {
            $labelInput = trim((string) $request->input('label', ''));
            $myId->label = $labelInput !== '' ? $labelInput : null;
        }

        if ($request->has('is_active')) {
            $myId->is_active = (bool) $request->input('is_active');
        }

        $myId->save();
        $myId->loadCount('users');

        return response()->json([
            'success' => true,
            'message' => 'My ID updated successfully.',
            'data' => $myId,
        ]);
    }

    /**
     * Get read-only overview of My IDs with linked user count and snapshot monthly earnings.
     */
    public function overview(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $status = strtolower(trim((string) $request->query('status', 'all')));
        $requestedMonth = trim((string) $request->query('month', ''));

        $currentMonth = Carbon::now('UTC')->format('Y-m');

        // Available months from snapshot earnings
        $rawMonths = [];
        if (Schema::hasTable('my_id_earnings')) {
            $rawMonths = DB::table('my_id_earnings')
                ->selectRaw("DISTINCT SUBSTR(COALESCE(completed_at, created_at), 1, 7) as month_val")
                ->whereNotNull(DB::raw("COALESCE(completed_at, created_at)"))
                ->orderByDesc('month_val')
                ->pluck('month_val')
                ->filter(fn ($m) => !empty($m) && preg_match('/^\d{4}-\d{2}$/', (string) $m))
                ->values()
                ->all();
        }

        $allMonths = array_values(array_unique(array_merge([$currentMonth], $rawMonths)));
        rsort($allMonths);

        $selectedMonth = ($requestedMonth !== '' && (in_array($requestedMonth, $allMonths, true) || $requestedMonth === 'all'))
            ? $requestedMonth
            : $currentMonth;

        $query = MyId::query()->withCount('users');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('my_id_code', 'like', "%{$search}%")
                  ->orWhere('label', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $myIds = $query->orderBy('my_id_code', 'asc')->get();

        $rows = [];
        $totalLinkedUsers = 0;
        $totalOffersAll = 0;
        $totalUsdAll = 0.0;
        $totalBdtAll = 0.0;

        foreach ($myIds as $m) {
            $code = $m->my_id_code;
            $linked = (int) ($m->users_count ?? 0);
            $totalLinkedUsers += $linked;

            $earningsQuery = DB::table('my_id_earnings')->where('my_id_code', $code);
            if ($selectedMonth !== 'all') {
                $earningsQuery->where(function ($q) use ($selectedMonth) {
                    $q->where('completed_at', 'like', $selectedMonth . '%')
                      ->orWhere(function ($q2) use ($selectedMonth) {
                          $q2->whereNull('completed_at')->where('created_at', 'like', $selectedMonth . '%');
                      });
                });
            }

            $stats = $earningsQuery->selectRaw("
                COUNT(*) as total_offers,
                COALESCE(SUM(payout_usd), 0) as total_usd,
                COALESCE(SUM(payout_bdt), 0) as total_bdt
            ")->first();

            $offers = (int) ($stats->total_offers ?? 0);
            $usd = round((float) ($stats->total_usd ?? 0), 2);
            $bdt = round((float) ($stats->total_bdt ?? 0), 2);

            $totalOffersAll += $offers;
            $totalUsdAll += $usd;
            $totalBdtAll += $bdt;

            $rows[] = [
                'id' => $m->id,
                'my_id_code' => $code,
                'label' => $m->label,
                'is_active' => (bool) $m->is_active,
                'status' => $m->is_active ? 'Active' : 'Inactive',
                'linked_users' => $linked,
                'total_offers' => $offers,
                'total_usd' => $usd,
                'total_bdt' => $bdt,
                'created_at' => $m->created_at,
            ];
        }

        return response()->json([
            'success' => true,
            'selected_month' => $selectedMonth,
            'months' => $allMonths,
            'summary' => [
                'total_my_ids' => count($myIds),
                'total_linked_users' => $totalLinkedUsers,
                'total_offers' => $totalOffersAll,
                'total_usd' => round($totalUsdAll, 2),
                'total_bdt' => round($totalBdtAll, 2),
            ],
            'data' => $rows,
        ]);
    }
}
