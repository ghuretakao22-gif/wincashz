<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ModeratorCompletedOffersController extends Controller
{
    /**
     * Get paginated completed offers strictly scoped to the authenticated moderator's My ID.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        if ($myIdCode === '' || !Schema::hasTable('my_id_earnings')) {
            return response()->json([
                'status' => 'success',
                'data' => [],
                'pagination' => [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => 25,
                    'total' => 0,
                    'from' => 0,
                    'to' => 0,
                ],
                'summary' => [
                    'total_offers' => 0,
                    'total_usd' => 0.0,
                    'total_bdt' => 0.0,
                ],
                'providers' => [],
                'months' => [Carbon::now('UTC')->format('Y-m')],
            ]);
        }

        $currentMonth = Carbon::now('UTC')->format('Y-m');
        $todayDate = Carbon::now('UTC')->format('Y-m-d');

        // Fetch distinct available providers for this My ID
        $providers = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->whereNotNull('provider')
            ->where('provider', '!=', '')
            ->distinct()
            ->orderBy('provider')
            ->pluck('provider')
            ->values()
            ->all();

        // Fetch distinct available months for this My ID
        $monthsRaw = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->selectRaw("DISTINCT SUBSTR(COALESCE(completed_at, created_at), 1, 7) as month_val")
            ->whereNotNull(DB::raw("COALESCE(completed_at, created_at)"))
            ->orderByDesc('month_val')
            ->pluck('month_val')
            ->filter(fn ($m) => !empty($m) && preg_match('/^\d{4}-\d{2}$/', (string) $m))
            ->values()
            ->all();

        $allMonths = array_values(array_unique(array_merge([$currentMonth], $monthsRaw)));
        rsort($allMonths);

        // Filters
        $period = strtolower(trim((string) $request->input('period', '')));
        $month = trim((string) $request->input('month', ''));
        $date = trim((string) $request->input('date', ''));
        $provider = trim((string) $request->input('provider', ''));
        $search = trim((string) $request->input('search', ''));
        $userIdInput = $request->input('user_id');

        $query = DB::table('my_id_earnings')
            ->leftJoin('users', 'users.id', '=', 'my_id_earnings.user_id')
            ->where('my_id_earnings.my_id_code', $myIdCode);

        // Date / Period filter
        if ($date !== '' && strtolower($date) !== 'all') {
            $query->where(function ($q) use ($date) {
                $q->where('my_id_earnings.completed_at', 'like', $date . '%')
                  ->orWhere(function ($q2) use ($date) {
                      $q2->whereNull('my_id_earnings.completed_at')
                         ->where('my_id_earnings.created_at', 'like', $date . '%');
                  });
            });
        } elseif ($period === 'today') {
            $query->where(function ($q) use ($todayDate) {
                $q->where('my_id_earnings.completed_at', 'like', $todayDate . '%')
                  ->orWhere(function ($q2) use ($todayDate) {
                      $q2->whereNull('my_id_earnings.completed_at')
                         ->where('my_id_earnings.created_at', 'like', $todayDate . '%');
                  });
            });
        } elseif ($period === 'all') {
            // No date filter
        } elseif ($month !== '' && strtolower($month) !== 'all') {
            $query->where(function ($q) use ($month) {
                $q->where('my_id_earnings.completed_at', 'like', $month . '%')
                  ->orWhere(function ($q2) use ($month) {
                      $q2->whereNull('my_id_earnings.completed_at')
                         ->where('my_id_earnings.created_at', 'like', $month . '%');
                  });
            });
        } elseif ($period === 'this_month') {
            $query->where(function ($q) use ($currentMonth) {
                $q->where('my_id_earnings.completed_at', 'like', $currentMonth . '%')
                  ->orWhere(function ($q2) use ($currentMonth) {
                      $q2->whereNull('my_id_earnings.completed_at')
                         ->where('my_id_earnings.created_at', 'like', $currentMonth . '%');
                  });
            });
        }

        // Provider filter
        if ($provider !== '' && strtolower($provider) !== 'all') {
            $query->whereRaw('LOWER(TRIM(my_id_earnings.provider)) = ?', [strtolower($provider)]);
        }

        // User ID filter
        if ($userIdInput !== null && $userIdInput !== '' && is_numeric($userIdInput)) {
            $query->where('my_id_earnings.user_id', (int) $userIdInput);
        }

        // Free-text search (matches username, name, email, offer_name, offer_id, provider, or numeric user_id)
        if ($search !== '') {
            $escaped = addcslashes($search, '%_\\');
            $like = '%' . $escaped . '%';
            $isNumeric = is_numeric($search);
            $numVal = $isNumeric ? (int) $search : -1;

            $query->where(function ($q) use ($like, $isNumeric, $numVal) {
                $q->where('users.username', 'like', $like)
                  ->orWhere('users.name', 'like', $like)
                  ->orWhere('users.email', 'like', $like)
                  ->orWhere('my_id_earnings.offer_name', 'like', $like)
                  ->orWhere('my_id_earnings.offer_id', 'like', $like)
                  ->orWhere('my_id_earnings.provider', 'like', $like);

                if ($isNumeric) {
                    $q->orWhere('my_id_earnings.user_id', $numVal)
                      ->orWhere('my_id_earnings.coin_amount', $numVal);
                }
            });
        }

        // Compute summary for the filtered result set
        $summaryRow = (clone $query)->selectRaw('
            COUNT(*) as total_offers,
            COALESCE(SUM(my_id_earnings.payout_usd), 0) as total_usd,
            COALESCE(SUM(my_id_earnings.payout_bdt), 0) as total_bdt
        ')->first();

        $totalOffers = (int) ($summaryRow->total_offers ?? 0);
        $totalUsd = round((float) ($summaryRow->total_usd ?? 0), 2);
        $totalBdt = round((float) ($summaryRow->total_bdt ?? 0), 2);

        // Sorting & Pagination
        $query->orderByDesc(DB::raw('COALESCE(my_id_earnings.completed_at, my_id_earnings.created_at)'))
              ->orderByDesc('my_id_earnings.id');

        $allowedPerPage = [20, 25, 50, 100];
        $perPage = (int) $request->input('per_page', 25);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 25;
        }

        $selectFields = [
            'my_id_earnings.id',
            'my_id_earnings.user_id',
            'my_id_earnings.completed_task_id',
            'my_id_earnings.provider',
            'my_id_earnings.offer_id',
            'my_id_earnings.offer_name',
            'my_id_earnings.coin_amount',
            'my_id_earnings.payout_usd',
            'my_id_earnings.usd_bdt_rate',
            'my_id_earnings.payout_bdt',
            'my_id_earnings.completed_at',
            'my_id_earnings.created_at',
            'users.username',
            'users.name as user_name',
            'users.email as user_email',
        ];

        $paginator = $query->select($selectFields)->paginate($perPage);

        $items = collect($paginator->items())->map(function ($row) {
            $rawDate = $row->completed_at ?: $row->created_at;
            $dt = $rawDate ? Carbon::parse($rawDate) : null;

            // Mask email for user privacy: e.g. "jo***@gmail.com"
            $email = trim((string) ($row->user_email ?? ''));
            $maskedEmail = '—';
            if ($email !== '' && str_contains($email, '@')) {
                [$local, $domain] = explode('@', $email, 2);
                $maskedEmail = (strlen($local) <= 2)
                    ? substr($local, 0, 1) . '***@' . $domain
                    : substr($local, 0, 2) . '***@' . $domain;
            }

            $payoutUsd = (float) ($row->payout_usd ?? 0);

            return [
                'id' => (int) $row->id,
                'completed_task_id' => $row->completed_task_id ? (int) $row->completed_task_id : null,
                'user_id' => (int) $row->user_id,
                'username' => (string) ($row->username ?? 'user_' . $row->user_id),
                'user_name' => (string) ($row->user_name ?? ''),
                'user_email' => $maskedEmail,
                'provider' => (string) ($row->provider ?: 'Unknown'),
                'offer_id' => $row->offer_id ?: '—',
                'offer_name' => (string) ($row->offer_name ?: ($row->offer_id ?: 'Standard Offer')),
                'coin_amount' => round((float) ($row->coin_amount ?? 0), 2),
                'payout_usd' => round($payoutUsd, 4),
                'usd_bdt_rate' => round((float) ($row->usd_bdt_rate ?? 0), 2),
                'payout_bdt' => round((float) ($row->payout_bdt ?? 0), 2),
                'status' => $payoutUsd > 0 ? 'Completed' : 'Unmapped',
                'completed_at' => $rawDate,
                'completed_date' => $dt ? $dt->format('d M Y') : '—',
                'completed_time' => $dt ? $dt->format('h:i A') . ' UTC' : '—',
            ];
        })->values()->all();

        $paginationData = [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem() ?? 0,
            'to' => $paginator->lastItem() ?? 0,
        ];

        $summaryData = [
            'total_records' => $totalOffers,
            'total_offers' => $totalOffers,
            'sum_usd' => $totalUsd,
            'total_usd' => $totalUsd,
            'sum_bdt' => $totalBdt,
            'total_bdt' => $totalBdt,
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'data' => $items,
                'items' => $items,
                'pagination' => $paginationData,
                'summary' => $summaryData,
                'providers' => $providers,
                'months' => $allMonths,
            ],
            // Top-level aliases for flexible consumption
            'items' => $items,
            'pagination' => $paginationData,
            'summary' => $summaryData,
            'providers' => $providers,
            'months' => $allMonths,
        ]);
    }
}
