<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WithdrawalController extends Controller
{
    public function latest(Request $request): JsonResponse
    {
        if (!Schema::hasTable('transactions')) {
            return response()->json([
                'rows' => [],
            ]);
        }

        $limit = max(1, min(100, (int) $request->query('limit', 100)));
        $withdrawals = Transaction::query()
            ->where(function ($query): void {
                $query->where('type', 'like', 'withdrawal%')
                    ->orWhere('reference_type', 'like', 'withdrawal%');
            })
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get([
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
            ]);

        $userIds = $withdrawals->pluck('user_id')->filter()->unique()->values()->all();
        $usersById = $userIds === []
            ? collect()
            : User::query()
                ->whereIn('id', $userIds)
                ->get(['id', 'username', 'user_avatar', 'name', 'email'])
                ->keyBy('id');

        $cashoutMethodsById = $this->cashoutMethodImagesById();

        return response()->json([
            'rows' => $withdrawals->map(function (Transaction $withdrawal) use ($usersById, $cashoutMethodsById): array {
                return $this->formatLatestWithdrawal($withdrawal, $usersById->get($withdrawal->user_id), $cashoutMethodsById);
            })->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cashout_method_id' => ['required', 'integer', 'min:1'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'wallet_address' => ['required', 'string', 'max:255'],
        ]);

        if (!Schema::hasTable('cashout_methods')) {
            return response()->json([
                'message' => 'Cashout methods table not found.',
            ], 404);
        }

        $method = DB::table('cashout_methods')
            ->where('id', $validated['cashout_method_id'])
            ->first();

        if (!$method || !($method->is_active ?? false)) {
            return response()->json([
                'message' => 'The selected cashout method is unavailable.',
            ], 404);
        }

        $requestedAmount = round((float) $validated['amount'], 2);
        $methodName = $this->resolveCashoutMethodName($method);
        $methodSlug = $this->resolveCashoutMethodSlug($method, $methodName);
        $minimumAmount = max(0.01, round((float) ($method->minimum_amount ?? $method->min_coins ?? 0), 2));
        $walletAddress = trim((string) $validated['wallet_address']);
        $feeDetails = $this->resolveCashoutMethodFeeDetails($method);
        $processingTime = $method->processing_time ?? null;
        $currency = $method->currency ?? $method->currency_code ?? null;

        if ($requestedAmount < $minimumAmount) {
            throw ValidationException::withMessages([
                'amount' => ['The requested amount must be at least '.$this->formatMoney($minimumAmount).'.'],
            ]);
        }

        $user = $request->user('api');

        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 401);
        }

        $withdrawal = null;
        $remainingBalance = null;

        DB::transaction(function () use (
            $user,
            $method,
            $requestedAmount,
            $minimumAmount,
            $methodName,
            $methodSlug,
            $feeDetails,
            $processingTime,
            $currency,
            $walletAddress,
            &$withdrawal,
            &$remainingBalance
        ): void {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if (!$lockedUser) {
                throw ValidationException::withMessages([
                    'amount' => ['We could not load your account.'],
                ]);
            }

            $availableBalance = round((float) ($lockedUser->balance ?? 0), 2);

            if ($availableBalance < $requestedAmount) {
                throw ValidationException::withMessages([
                    'amount' => ['You do not have enough balance for this withdrawal.'],
                ]);
            }

            $remainingBalance = round($availableBalance - $requestedAmount, 2);
            $transactionId = (string) Str::uuid();

            $withdrawal = Transaction::create([
                'user_id' => $lockedUser->id,
                'user_name' => $lockedUser->username,
                'type' => 'withdrawal_pending',
                'status' => 'pending',
                'amount' => round($requestedAmount, 2),
                'reference_type' => 'withdrawal',
                'reference_id' => null,
                'transaction_id' => $transactionId,
                'title' => $methodName,
                'description' => 'Withdrawal requested via '.$methodName,
                'meta' => json_encode([
                    'cashoutMethodId' => $method->id,
                    'cashoutMethodName' => $methodName,
                    'cashoutMethodSlug' => $methodSlug,
                    'minimumAmount' => $minimumAmount,
                    'requestedAmount' => round($requestedAmount, 2),
                    'walletAddress' => $walletAddress,
                    'walletName' => $methodName,
                    'currency' => $currency,
                    'processingTime' => $processingTime,
                    'feeMode' => $feeDetails['mode'],
                    'feeRate' => $feeDetails['rate'],
                    'feeLabel' => $feeDetails['label'],
                    'fee' => $feeDetails['rate'],
                ], JSON_UNESCAPED_UNICODE),
            ]);

            $lockedUser->decrement('balance', round($requestedAmount, 2));

            UserNotification::create([
                'user_id' => $lockedUser->id,
                'type' => 'withdrawal',
                'icon' => 'wallet',
                'title' => 'Withdrawal requested',
                'message' => 'Your '.$this->formatMoney($requestedAmount).' withdrawal via '.$methodName.' is pending review.',
                'data' => [
                    'transactionId' => $transactionId,
                    'cashoutMethodId' => $method->id,
                    'cashoutMethodName' => $methodName,
                    'cashoutMethodSlug' => $methodSlug,
                    'walletAddress' => $walletAddress,
                    'amount' => round($requestedAmount, 2),
                    'feeMode' => $feeDetails['mode'],
                    'feeRate' => $feeDetails['rate'],
                    'remainingBalance' => $remainingBalance,
                ],
            ]);
        });

        return response()->json([
            'message' => 'Withdrawal request submitted successfully.',
            'withdrawal' => $this->formatWithdrawal($withdrawal),
            'remaining_balance' => $remainingBalance,
        ], 201);
    }

    private function formatWithdrawal(?Transaction $withdrawal): ?array
    {
        if (!$withdrawal) {
            return null;
        }

        return [
            'id' => $withdrawal->id,
            'transactionId' => $withdrawal->transaction_id ?? (string) $withdrawal->id,
            'type' => $withdrawal->type,
            'status' => $withdrawal->status,
            'amount' => number_format((float) $withdrawal->amount, 2, '.', ''),
            'title' => $withdrawal->title,
            'description' => $withdrawal->description,
            'meta' => $withdrawal->meta,
            'created_at' => $withdrawal->created_at instanceof \DateTimeInterface
                ? $withdrawal->created_at->format(DATE_ATOM)
                : null,
        ];
    }

    private function formatLatestWithdrawal(Transaction $withdrawal, ?User $user, array $cashoutMethodsById): array
    {
        $meta = $this->decodeTransactionMeta($withdrawal->meta);
        $cashoutMethodId = $this->firstNonEmptyString(
            data_get($meta, 'cashoutMethodId'),
            data_get($meta, 'cashout_method_id'),
            data_get($meta, 'cashoutMethodID'),
        );
        $cashoutMethodName = $this->firstNonEmptyString(
            data_get($meta, 'cashoutMethodName'),
            data_get($meta, 'walletName'),
            $withdrawal->title,
            'Withdrawal',
        );
        $methodRecord = $cashoutMethodId !== '' && isset($cashoutMethodsById[$cashoutMethodId])
            ? $cashoutMethodsById[$cashoutMethodId]
            : null;
        $cashoutMethodImageUrl = $this->firstNonEmptyString(
            $methodRecord['imageUrl'] ?? null,
            $methodRecord['image_url'] ?? null,
        );
        $resolvedUser = $user ?? null;
        $userName = trim((string) ($resolvedUser?->username ?? $withdrawal->user_name ?? '')) ?: 'Anonymous';
        $userAvatar = trim((string) ($resolvedUser?->user_avatar ?? ''));

        if ($userAvatar === '') {
            $userAvatar = User::diceBearAvatarUrl($userName !== '' ? $userName : (string) ($withdrawal->user_id ?? $withdrawal->id));
        }

        return [
            'id' => $withdrawal->id,
            'userId' => $withdrawal->user_id,
            'userName' => $userName,
            'userAvatar' => $userAvatar,
            'amount' => number_format((float) $withdrawal->amount, 2, '.', ''),
            'status' => $withdrawal->status ?? 'pending',
            'cashoutMethodId' => $cashoutMethodId !== '' ? $cashoutMethodId : null,
            'cashoutMethodName' => $cashoutMethodName,
            'cashoutMethodImageUrl' => $cashoutMethodImageUrl !== '' ? $cashoutMethodImageUrl : null,
            'transactionId' => $withdrawal->transaction_id ?? (string) $withdrawal->id,
            'createdAt' => $withdrawal->created_at?->toAtomString(),
        ];
    }

    private function cashoutMethodImagesById(): array
    {
        if (!Schema::hasTable('cashout_methods')) {
            return [];
        }

        $columns = array_values(array_intersect(
            Schema::getColumnListing('cashout_methods'),
            ['id', 'name', 'method_name', 'title', 'label', 'slug', 'image_url', 'image', 'logo_url', 'logoUrl']
        ));

        if ($columns === []) {
            return [];
        }

        $methods = DB::table('cashout_methods')->select($columns)->get();
        $map = [];

        foreach ($methods as $method) {
            $methodId = $method->id ?? null;

            if ($methodId === null) {
                continue;
            }

            $map[(string) $methodId] = [
                'name' => $this->firstNonEmptyString($method->name ?? null, $method->method_name ?? null, $method->title ?? null, $method->label ?? null, $method->slug ?? null),
                'imageUrl' => $this->firstNonEmptyString($method->image_url ?? null, $method->image ?? null, $method->logo_url ?? null, $method->logoUrl ?? null),
            ];
        }

        return $map;
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

    private function firstNonEmptyString(mixed ...$values): string
    {
        foreach ($values as $value) {
            if (is_string($value) || is_numeric($value)) {
                $text = trim((string) $value);

                if ($text !== '') {
                    return $text;
                }
            }
        }

        return '';
    }

    private function formatMoney(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function resolveCashoutMethodFeeDetails(object $method): array
    {
        $rawFixedFee = $this->normalizeMoneyValue($method->fee ?? $method->charge ?? 0);
        $rawPercentageCandidates = [
            $method->fee_percentage ?? null,
            $method->feePercent ?? null,
            $method->fee_percent ?? null,
            $method->percentage_fee ?? null,
            $method->percentageFee ?? null,
            $method->commission_percent ?? null,
            $method->commissionPercentage ?? null,
        ];

        $explicitType = strtolower(trim((string) ($method->fee_type ?? $method->fee_mode ?? $method->charge_type ?? $method->fee_kind ?? '')));
        $rawFeeText = trim((string) ($method->fee ?? $method->charge ?? ''));
        $percentageCandidate = null;

        foreach ($rawPercentageCandidates as $candidate) {
            if (is_numeric($candidate)) {
                $percentageCandidate = (float) $candidate;
                break;
            }
        }

        $typeLooksPercentage = str_contains($explicitType, 'percent')
            || str_contains($explicitType, 'percentage')
            || str_contains($explicitType, 'commission')
            || $explicitType === '%';
        $textLooksPercentage = str_ends_with($rawFeeText, '%');
        $rate = $percentageCandidate !== null
            ? max(0.0, round($percentageCandidate, 2))
            : ($textLooksPercentage
                ? max(0.0, round((float) rtrim($rawFeeText, '%'), 2))
                : max(0.0, round($rawFixedFee, 2)));

        return [
            'mode' => 'percentage',
            'rate' => $rate,
            'label' => $this->formatMoney($rate).'%',
        ];
    }

    private function resolveCashoutMethodName(object $method): string
    {
        return trim((string) (
            $method->name
            ?? $method->method_name
            ?? $method->title
            ?? $method->label
            ?? $method->slug
            ?? 'Cashout request'
        )) ?: 'Cashout request';
    }

    private function resolveCashoutMethodSlug(object $method, string $fallbackName): string
    {
        $slug = trim((string) ($method->slug ?? $method->method_slug ?? ''));

        if ($slug !== '') {
            return $slug;
        }

        return Str::slug($fallbackName) ?: 'cashout-request';
    }

    private function normalizeMoneyValue(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }
}
