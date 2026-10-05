<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chargeback;
use App\Models\CompletedTask;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class ProfileController extends Controller
{
    public function tabs(Request $request): JsonResponse
    {
        $user = $request->user('api');
        $tab = (string) $request->query('tab', 'completed');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(50, (int) $request->query('per_page', 5)));

        return response()->json([
            'user' => $this->profileUserPayload($user),
            ...$this->tabPayload($tab, $user->id, $user->username, $page, $perPage),
        ]);
    }

    private function tabPayload(string $tab, int $userId, string $username, int $page, int $perPage): array
    {
        return match ($tab) {
            'completed' => $this->completedTasks($userId, $username, $page, $perPage),
            'transactions' => $this->transactions($userId, $page, $perPage),
            'withdrawals' => $this->withdrawals($userId, $page, $perPage),
            'chargebacks' => $this->chargebacks($userId, $username, $page, $perPage),
            default => abort(422, 'Invalid profile tab requested.'),
        };
    }

    private function completedTasks(int $userId, string $username, int $page, int $perPage): array
    {
        return $this->buildPaginatedRows(
            CompletedTask::query()
                ->where(function ($query) use ($userId, $username): void {
                    $query->where('user_id', $userId)
                        ->orWhere('user_name', $username);
                })
                ->orderByDesc('created_at'),
            $page,
            $perPage,
            fn (CompletedTask $task) => $this->normalizeTaskRow(
                id: $task->id,
                wall: $task->offer_wall_name ?? 'completed_task',
                offer: $task->offer_name ?? 'Completed task',
                transactionId: $task->transaction_id,
                amount: $task->currency_reward,
                ip: $task->ip,
                country: $task->country,
                createdAt: $task->created_at,
                status: 'completed',
            ),
        );
    }

    private function withdrawals(int $userId, int $page, int $perPage): array
    {
        return $this->buildPaginatedRows(
            Transaction::query()
                ->where('user_id', $userId)
                ->where(function ($query): void {
                    $query->where('type', 'like', 'withdrawal%')
                        ->orWhere('reference_type', 'like', 'withdrawal%');
                })
                ->orderByDesc('created_at'),
            $page,
            $perPage,
            fn (Transaction $transaction) => [
                'id' => $transaction->id,
                'walletName' => $this->withdrawalWalletName($transaction->description, $transaction->title, $transaction->meta),
                'walletAddress' => $this->withdrawalWalletAddress($transaction->meta),
                'transactionId' => $transaction->transaction_id ?? (string) $transaction->id,
                'amount' => number_format((float) $transaction->amount, 2, '.', ''),
                'status' => $transaction->status,
                'date' => $transaction->created_at instanceof \DateTimeInterface
                    ? $transaction->created_at->format(DATE_ATOM)
                    : (is_string($transaction->created_at) && $transaction->created_at !== '' ? $transaction->created_at : null),
            ],
        );
    }

    private function transactions(int $userId, int $page, int $perPage): array
    {
        return $this->buildPaginatedRows(
            Transaction::query()
                ->where('user_id', $userId)
                ->orderByDesc('created_at'),
            $page,
            $perPage,
            fn (Transaction $transaction) => [
                'id' => $transaction->id,
                'type' => $transaction->type ?? '-',
                'status' => $transaction->status ?? '-',
                'amount' => number_format((float) $transaction->amount, 2, '.', ''),
                'referenceType' => $transaction->reference_type ?? '-',
                'referenceId' => $transaction->reference_id ?? '-',
                'transactionId' => $transaction->transaction_id ?? (string) $transaction->id,
                'title' => $transaction->title ?? '-',
                'description' => $transaction->description ?? '-',
                'date' => $transaction->created_at instanceof \DateTimeInterface
                    ? $transaction->created_at->format(DATE_ATOM)
                    : (is_string($transaction->created_at) && $transaction->created_at !== '' ? $transaction->created_at : null),
            ],
        );
    }

    private function chargebacks(int $userId, string $username, int $page, int $perPage): array
    {
        return $this->buildPaginatedRows(
            Chargeback::query()
                ->where(function ($query) use ($userId, $username): void {
                    $query->where('user_id', $userId)
                        ->orWhere('user_name', $username);
                })
                ->orderByDesc('created_at'),
            $page,
            $perPage,
            fn (Chargeback $chargeback) => [
                'id' => $chargeback->id,
                'offerWall' => $chargeback->offer_wall_name ?? '-',
                'transactionId' => $chargeback->transaction_id,
                'offerName' => $chargeback->offer_name ?? '-',
                'amount' => number_format((float) $chargeback->currency_reward, 2, '.', ''),
                'ip' => $chargeback->ip ?? '-',
                'country' => $chargeback->country ?? '-',
                'status' => $chargeback->status,
                'reason' => $chargeback->reason,
                'date' => $chargeback->created_at instanceof \DateTimeInterface
                    ? $chargeback->created_at->format(DATE_ATOM)
                    : (is_string($chargeback->created_at) && $chargeback->created_at !== '' ? $chargeback->created_at : null),
            ],
        );
    }

    private function buildPaginatedRows(Builder $query, int $page, int $perPage, callable $transform): array
    {
        /** @var LengthAwarePaginator $paginator */
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $rows = $paginator->getCollection()
            ->map($transform)
            ->values()
            ->all();

        return [
            'rows' => $rows,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    private function profileUserPayload(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'userAvatar' => trim((string) ($user->user_avatar ?? '')) ?: null,
            'profileSetupCompleted' => (bool) ($user->profile_setup_completed ?? false),
        ];
    }

    private function normalizeTaskRow(
        int $id,
        string $wall,
        string $offer,
        ?string $transactionId,
        string|int|float $amount,
        ?string $ip,
        ?string $country,
        mixed $createdAt,
        ?string $status = null,
        ?string $reason = null,
    ): array {
        $date = $createdAt instanceof \DateTimeInterface
            ? $createdAt->format(DATE_ATOM)
            : (is_string($createdAt) && $createdAt !== '' ? $createdAt : null);

        return [
            'id' => $id,
            'wall' => $wall,
            'offer' => $offer,
            'transactionId' => $transactionId ?? (string) $id,
            'ip' => $ip ?? '-',
            'country' => $country ?? '-',
            'amount' => number_format((float) $amount, 2, '.', ''),
            'date' => $date,
            'status' => $status,
            'reason' => $reason,
        ];
    }

    private function withdrawalWalletName(?string $description, ?string $title, mixed $meta): string
    {
        $decoded = $this->decodeMeta($meta);

        if (isset($decoded['walletName']) && is_string($decoded['walletName']) && $decoded['walletName'] !== '') {
            return $decoded['walletName'];
        }

        if (is_string($description) && preg_match('/wallet:\s*(.+)$/i', $description, $matches) === 1) {
            return trim($matches[1]) ?: '-';
        }

        return is_string($title) && $title !== '' ? $title : '-';
    }

    private function withdrawalWalletAddress(mixed $meta): string
    {
        $decoded = $this->decodeMeta($meta);

        if (isset($decoded['walletAddress']) && is_string($decoded['walletAddress']) && $decoded['walletAddress'] !== '') {
            return $decoded['walletAddress'];
        }

        return '-';
    }

    private function decodeMeta(mixed $meta): array
    {
        if (!is_string($meta) || $meta === '') {
            return [];
        }

        $decoded = json_decode($meta, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function summarizeMeta(mixed $meta): string
    {
        if (!is_string($meta) || $meta === '') {
            return '-';
        }

        $decoded = $this->decodeMeta($meta);

        if (!is_array($decoded)) {
            return $meta;
        }

        $parts = [];

        foreach (['walletName', 'walletAddress', 'offerWallName', 'offerId', 'withdrawalId'] as $key) {
            if (!array_key_exists($key, $decoded) || $decoded[$key] === null || $decoded[$key] === '') {
                continue;
            }

            $parts[] = "{$key}: {$decoded[$key]}";
        }

        return $parts !== [] ? implode(' | ', $parts) : $meta;
    }
}
