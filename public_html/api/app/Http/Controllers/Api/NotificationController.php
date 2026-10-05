<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api');
        $limit = max(1, min(20, (int) $request->query('limit', 10)));

        $rows = UserNotification::query()
            ->where('user_id', $user?->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (UserNotification $notification) => $this->formatNotification($notification))
            ->values();

        $unreadCount = UserNotification::query()
            ->where('user_id', $user?->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'rows' => $rows,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user('api');

        UserNotification::query()
            ->where('user_id', $user?->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->index($request);
    }

    public function markRead(Request $request, UserNotification $notification): JsonResponse
    {
        $user = $request->user('api');

        abort_unless($notification->user_id === $user?->id, 404);

        if (! $notification->read_at) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        return response()->json([
            'message' => 'Notification marked as read.',
            'notification' => $this->formatNotification($notification->refresh()),
            'unread_count' => UserNotification::query()
                ->where('user_id', $user?->id)
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    private function formatNotification(UserNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'user_id' => $notification->user_id,
            'type' => $notification->type,
            'icon' => $notification->icon,
            'title' => $notification->title,
            'message' => $notification->message,
            'data' => $notification->data ?? [],
            'is_read' => $notification->read_at !== null,
            'read_at' => $notification->read_at?->toAtomString(),
            'created_at' => $notification->created_at?->toAtomString(),
        ];
    }
}
