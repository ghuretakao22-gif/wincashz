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

class ModeratorPayoutController extends Controller
{
    /**
     * Get moderator payout request data, current month eligibility, and historical payouts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        $payoutEnabled = Setting::boolean(AdminMyIdPayoutController::SETTING_PAYOUT_ENABLED, false);
        $currentMonth = Carbon::now('UTC')->format('Y-m');

        if ($myIdCode === '') {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'my_id' => null,
                    'friendly_name' => null,
                    'has_my_id' => false,
                    'payout_enabled' => $payoutEnabled,
                    'selected_month' => $currentMonth,
                    'months' => [$currentMonth],
                    'selected_month_data' => [
                        'total_offers' => 0,
                        'total_usd' => 0.0,
                        'total_bdt' => 0.0,
                        'payout_status' => 'NOT_REQUESTED',
                        'can_submit' => false,
                        'existing_payout' => null,
                    ],
                    'history' => [],
                ],
            ]);
        }

        // Fetch My ID details
        $myIdRecord = null;
        if (Schema::hasTable('my_ids')) {
            $myIdRecord = MyId::query()->where('my_id_code', $myIdCode)->first();
        }
        $friendlyName = $myIdRecord?->friendly_name;

        // Collect available months from my_id_earnings
        $rawMonths = [];
        if (Schema::hasTable('my_id_earnings')) {
            $rawMonths = DB::table('my_id_earnings')
                ->where('my_id_code', $myIdCode)
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

        $requestedMonth = trim((string) $request->query('month', ''));
        $selectedMonth = ($requestedMonth !== '' && in_array($requestedMonth, $allMonths, true))
            ? $requestedMonth
            : ($allMonths[0] ?? $currentMonth);

        // Compute automatic payable amount from snapshot ledger
        $totalOffers = 0;
        $totalUsd = 0.0;
        $totalBdt = 0.0;

        if (Schema::hasTable('my_id_earnings')) {
            $stats = DB::table('my_id_earnings')
                ->where('my_id_code', $myIdCode)
                ->where(function ($q) use ($selectedMonth) {
                    $q->where('completed_at', 'like', $selectedMonth . '%')
                      ->orWhere(function ($q2) use ($selectedMonth) {
                          $q2->whereNull('completed_at')->where('created_at', 'like', $selectedMonth . '%');
                      });
                })
                ->selectRaw("
                    COUNT(*) as total_offers,
                    COALESCE(SUM(payout_usd), 0) as total_usd,
                    COALESCE(SUM(payout_bdt), 0) as total_bdt
                ")
                ->first();

            $totalOffers = (int) ($stats->total_offers ?? 0);
            $totalUsd = round((float) ($stats->total_usd ?? 0), 2);
            $totalBdt = round((float) ($stats->total_bdt ?? 0), 2);
        }

        // Check existing payout record for selected month
        $existingPayout = null;
        if (Schema::hasTable('my_id_payouts')) {
            $existingPayout = MyIdPayout::query()
                ->where('my_id_code', $myIdCode)
                ->where('payout_month', $selectedMonth)
                ->first();
        }

        $payoutStatus = 'NOT_REQUESTED';
        if ($existingPayout) {
            $payoutStatus = strtoupper($existingPayout->status);
        }

        $canSubmit = ($existingPayout === null) && $payoutEnabled && ($totalBdt > 0) && ($totalOffers > 0);

        // Payout history strictly for this My ID
        $history = [];
        if (Schema::hasTable('my_id_payouts')) {
            $payouts = MyIdPayout::query()
                ->where('my_id_code', $myIdCode)
                ->orderByDesc('payout_month')
                ->get();

            $history = $payouts->map(function (MyIdPayout $p): array {
                $statusUpper = strtoupper($p->status);
                $displayStatus = $statusUpper === 'COMPLETED' ? 'PAID' : $statusUpper;

                return [
                    'id' => $p->id,
                    'month' => $p->payout_month,
                    'offers' => $p->total_offers,
                    'usd' => (float) $p->total_usd,
                    'bdt' => (float) $p->total_bdt,
                    'method' => $p->payment_method,
                    'details' => $p->payment_details,
                    'status' => $p->status,
                    'status_label' => $displayStatus,
                    'requested_date' => $p->created_at ? $p->created_at->format('Y-m-d H:i') : null,
                    'paid_date' => $p->completed_at ? $p->completed_at->format('Y-m-d H:i') : null,
                ];
            })->all();
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'my_id' => $myIdCode,
                'friendly_name' => $friendlyName,
                'has_my_id' => true,
                'payout_enabled' => $payoutEnabled,
                'selected_month' => $selectedMonth,
                'months' => $allMonths,
                'selected_month_data' => [
                    'total_offers' => $totalOffers,
                    'total_usd' => $totalUsd,
                    'total_bdt' => $totalBdt,
                    'payout_status' => $payoutStatus,
                    'can_submit' => $canSubmit,
                    'existing_payout' => $existingPayout ? [
                        'id' => $existingPayout->id,
                        'status' => $existingPayout->status,
                        'payment_method' => $existingPayout->payment_method,
                        'payment_details' => $existingPayout->payment_details,
                        'requested_at' => $existingPayout->created_at ? $existingPayout->created_at->toIso8601String() : null,
                        'completed_at' => $existingPayout->completed_at ? $existingPayout->completed_at->toIso8601String() : null,
                    ] : null,
                ],
                'history' => $history,
            ],
        ]);
    }

    /**
     * Submit a new monthly payout request.
     */
    public function store(Request $request): JsonResponse
    {
        // 1. Check Global Payout Request ON/OFF control
        if (!Setting::boolean(AdminMyIdPayoutController::SETTING_PAYOUT_ENABLED, false)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Payout requests are temporarily disabled by the administrator.',
            ], 422);
        }

        // 2. Authenticate moderator's My ID
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        if ($myIdCode === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'Your account is not linked to an active My ID.',
            ], 422);
        }

        // 3. Validate base payload
        $validated = $request->validate([
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'payment_method' => ['required', 'string', 'in:bkash,nagad,bank'],
        ], [
            'month.required' => 'Please select an eligible payout month.',
            'month.regex' => 'Payout month format must be YYYY-MM.',
            'payment_method.required' => 'Please select a payment method.',
            'payment_method.in' => 'Payment method must be bKash, Nagad, or Bank.',
        ]);

        $month = $validated['month'];
        $method = $validated['payment_method'];

        // 4. Validate method-specific payment details
        $paymentDetails = [];
        if ($method === 'bkash') {
            $subVal = $request->validate([
                'mobile_number' => ['required', 'string', 'min:10', 'max:20', 'regex:/^[0-9+\s-]+$/'],
            ], [
                'mobile_number.required' => 'bKash mobile number is required.',
                'mobile_number.regex' => 'Please enter a valid bKash mobile number.',
            ]);
            $paymentDetails = [
                'mobile_number' => trim($subVal['mobile_number']),
            ];
        } elseif ($method === 'nagad') {
            $subVal = $request->validate([
                'mobile_number' => ['required', 'string', 'min:10', 'max:20', 'regex:/^[0-9+\s-]+$/'],
            ], [
                'mobile_number.required' => 'Nagad mobile number is required.',
                'mobile_number.regex' => 'Please enter a valid Nagad mobile number.',
            ]);
            $paymentDetails = [
                'mobile_number' => trim($subVal['mobile_number']),
            ];
        } elseif ($method === 'bank') {
            $subVal = $request->validate([
                'account_holder_name' => ['required', 'string', 'max:255'],
                'account_number' => ['required', 'string', 'max:100'],
                'bank_name' => ['required', 'string', 'max:255'],
                'branch_name' => ['nullable', 'string', 'max:255'],
            ], [
                'account_holder_name.required' => 'Account holder name is required.',
                'account_number.required' => 'Bank account number is required.',
                'bank_name.required' => 'Bank name is required.',
            ]);
            $paymentDetails = [
                'account_holder_name' => trim($subVal['account_holder_name']),
                'account_number' => trim($subVal['account_number']),
                'bank_name' => trim($subVal['bank_name']),
                'branch_name' => trim((string) ($subVal['branch_name'] ?? '')),
            ];
        }

        // 5. Duplicate Protection: Check if this month has already been requested/paid
        $existing = MyIdPayout::query()
            ->where('my_id_code', $myIdCode)
            ->where('payout_month', $month)
            ->first();

        if ($existing) {
            $statusWord = $existing->status === 'completed' ? 'already been paid' : 'already been submitted for review';
            return response()->json([
                'status' => 'error',
                'message' => "Payout for {$month} has {$statusWord}. A month cannot be requested twice.",
            ], 422);
        }

        // 6. Automatic Payable Calculation strictly from snapshot ledger
        $stats = DB::table('my_id_earnings')
            ->where('my_id_code', $myIdCode)
            ->where(function ($q) use ($month) {
                $q->where('completed_at', 'like', $month . '%')
                  ->orWhere(function ($q2) use ($month) {
                      $q2->whereNull('completed_at')->where('created_at', 'like', $month . '%');
                  });
            })
            ->selectRaw("
                COUNT(*) as total_offers,
                COALESCE(SUM(payout_usd), 0) as total_usd,
                COALESCE(SUM(payout_bdt), 0) as total_bdt
            ")
            ->first();

        $offers = (int) ($stats->total_offers ?? 0);
        $usd = round((float) ($stats->total_usd ?? 0), 2);
        $bdt = round((float) ($stats->total_bdt ?? 0), 2);

        if ($bdt <= 0 || $offers <= 0) {
            return response()->json([
                'status' => 'error',
                'message' => "No eligible earnings found for {$month}.",
            ], 422);
        }

        // 7. Create Payout Request Record with initial status WAITING
        $payout = MyIdPayout::create([
            'my_id_code' => $myIdCode,
            'user_id' => $user->id,
            'payout_month' => $month,
            'total_offers' => $offers,
            'total_usd' => $usd,
            'total_bdt' => $bdt,
            'payment_method' => $method,
            'payment_details' => $paymentDetails,
            'status' => 'waiting',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Payout request submitted successfully and is waiting for review.',
            'data' => [
                'id' => $payout->id,
                'my_id_code' => $payout->my_id_code,
                'payout_month' => $payout->payout_month,
                'total_offers' => $payout->total_offers,
                'total_usd' => (float) $payout->total_usd,
                'total_bdt' => (float) $payout->total_bdt,
                'payment_method' => $payout->payment_method,
                'payment_details' => $payout->payment_details,
                'status' => $payout->status,
                'requested_at' => $payout->created_at->toIso8601String(),
            ],
        ], 201);
    }
}
