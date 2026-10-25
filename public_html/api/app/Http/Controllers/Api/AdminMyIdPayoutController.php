<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyId;
use App\Models\MyIdPayout;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminMyIdPayoutController extends Controller
{
    public const SETTING_PAYOUT_ENABLED = 'my_id_payout_enabled';

    /**
     * Get paginated payout requests with search, month filter, and status filter.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $status = strtolower(trim((string) $request->query('status', 'all')));
        $month = trim((string) $request->query('month', 'all'));
        $perPage = (int) $request->query('per_page', 20);
        if ($perPage < 5 || $perPage > 100) {
            $perPage = 20;
        }

        $payoutEnabled = Setting::boolean(self::SETTING_PAYOUT_ENABLED, false);

        if (!Schema::hasTable('my_id_payouts')) {
            return response()->json([
                'success' => true,
                'payout_enabled' => $payoutEnabled,
                'summary' => [
                    'total_requests' => 0,
                    'waiting' => 0,
                    'completed' => 0,
                    'total_payable_bdt' => 0.0,
                    'total_paid_bdt' => 0.0,
                ],
                'months' => [],
                'data' => [],
                'pagination' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                ],
            ]);
        }

        // Summary metrics across all requests
        $summary = DB::table('my_id_payouts')
            ->selectRaw("
                COUNT(*) as total_requests,
                COALESCE(SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END), 0) as waiting,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
                COALESCE(SUM(CASE WHEN status IN ('waiting', 'review', 'accepted') THEN total_bdt ELSE 0 END), 0) as total_payable_bdt,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total_bdt ELSE 0 END), 0) as total_paid_bdt
            ")
            ->first();

        // Distinct available months
        $months = DB::table('my_id_payouts')
            ->selectRaw("DISTINCT payout_month")
            ->orderByDesc('payout_month')
            ->pluck('payout_month')
            ->filter()
            ->values()
            ->all();

        $query = MyIdPayout::query()->orderByDesc('id');

        if ($status !== 'all' && $status !== '') {
            $query->where('status', $status);
        }

        if ($month !== 'all' && $month !== '') {
            $query->where('payout_month', $month);
        }

        if ($search !== '') {
            $matchingCodes = [];
            if (Schema::hasTable('my_ids')) {
                $hasFriendly = Schema::hasColumn('my_ids', 'friendly_name');
                $myIdQuery = MyId::query()->where('my_id_code', 'like', "%{$search}%");
                if ($hasFriendly) {
                    $myIdQuery->orWhere('friendly_name', 'like', "%{$search}%");
                }
                $matchingCodes = $myIdQuery->pluck('my_id_code')->all();
            }

            $query->where(function ($q) use ($search, $matchingCodes): void {
                $q->where('my_id_code', 'like', "%{$search}%");
                if (!empty($matchingCodes)) {
                    $q->orWhereIn('my_id_code', $matchingCodes);
                }
                $q->orWhere('payment_method', 'like', "%{$search}%")
                  ->orWhere('payment_details', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        // Map friendly names from my_ids table
        $myIdsMap = [];
        if (Schema::hasTable('my_ids')) {
            $hasFriendly = Schema::hasColumn('my_ids', 'friendly_name');
            if ($hasFriendly) {
                $myIdsMap = MyId::query()->pluck('friendly_name', 'my_id_code')->all();
            }
        }

        $items = collect($paginator->items())->map(function (MyIdPayout $p) use ($myIdsMap): array {
            return [
                'id' => $p->id,
                'my_id_code' => $p->my_id_code,
                'friendly_name' => $myIdsMap[$p->my_id_code] ?? null,
                'payout_month' => $p->payout_month,
                'total_offers' => $p->total_offers,
                'total_usd' => (float) $p->total_usd,
                'total_bdt' => (float) $p->total_bdt,
                'payment_method' => $p->payment_method,
                'payment_details' => $p->payment_details,
                'status' => $p->status,
                'admin_notes' => $p->admin_notes,
                'requested_at' => $p->created_at ? $p->created_at->toIso8601String() : null,
                'completed_at' => $p->completed_at ? $p->completed_at->toIso8601String() : null,
                'completed_by' => $p->completed_by,
            ];
        })->all();

        return response()->json([
            'success' => true,
            'payout_enabled' => $payoutEnabled,
            'summary' => [
                'total_requests' => (int) ($summary->total_requests ?? 0),
                'waiting' => (int) ($summary->waiting ?? 0),
                'completed' => (int) ($summary->completed ?? 0),
                'total_payable_bdt' => round((float) ($summary->total_payable_bdt ?? 0), 2),
                'total_paid_bdt' => round((float) ($summary->total_paid_bdt ?? 0), 2),
            ],
            'months' => $months,
            'data' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Update payout request status (WAITING -> REVIEW -> ACCEPTED -> COMPLETED).
     */
    public function updateStatus(Request $request, int|string $id): JsonResponse
    {
        $payout = MyIdPayout::query()->findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:waiting,review,accepted,completed,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $nextStatus = strtolower(trim($validated['status']));
        $payout->status = $nextStatus;

        if ($request->has('admin_notes')) {
            $notes = trim((string) $request->input('admin_notes', ''));
            $payout->admin_notes = $notes !== '' ? $notes : null;
        }

        if ($nextStatus === 'completed') {
            $payout->completed_at = Carbon::now('UTC');
            $user = $request->user('api') ?? $request->user();
            if ($user) {
                $payout->completed_by = $user->id;
            }
        } elseif ($nextStatus !== 'completed' && $payout->completed_at !== null) {
            $payout->completed_at = null;
            $payout->completed_by = null;
        }

        $payout->save();

        return response()->json([
            'success' => true,
            'message' => "Payout status updated to {$nextStatus} successfully.",
            'data' => $payout,
        ]);
    }

    /**
     * Get global My ID payout settings.
     */
    public function getSettings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'payout_enabled' => Setting::boolean(self::SETTING_PAYOUT_ENABLED, false),
            ],
        ]);
    }

    /**
     * Update global My ID payout settings (enable/disable requests globally).
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payout_enabled' => ['required', 'boolean'],
        ]);

        $enabled = (bool) $validated['payout_enabled'];
        Setting::setBoolean(self::SETTING_PAYOUT_ENABLED, $enabled);

        return response()->json([
            'success' => true,
            'message' => 'Global My ID payout setting updated.',
            'data' => [
                'payout_enabled' => $enabled,
            ],
        ]);
    }
}
