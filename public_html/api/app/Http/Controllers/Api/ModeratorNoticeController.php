<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ModeratorNoticeController extends Controller
{
    public const SETTING_ENABLED = 'moderator_notice_enabled';
    public const SETTING_HEADLINE = 'moderator_notice_headline';
    public const SETTING_TEXT = 'moderator_notice_text';
    public const SETTING_UPDATED_AT = 'moderator_notice_updated_at';

    /**
     * Get current moderator live notice configuration for Admin.
     */
    public function getAdminNotice(): JsonResponse
    {
        $enabled = Setting::boolean(self::SETTING_ENABLED, false);
        $headline = Setting::value(self::SETTING_HEADLINE, '');
        $text = Setting::value(self::SETTING_TEXT, '');
        $updatedAt = Setting::value(self::SETTING_UPDATED_AT, '');

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => $enabled,
                'headline' => $headline,
                'text' => $text,
                'updated_at' => $updatedAt,
            ],
        ]);
    }

    /**
     * Save or update moderator live notice configuration (Admin only).
     */
    public function updateAdminNotice(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'headline' => ['nullable', 'string', 'max:255'],
            'text' => ['nullable', 'string', 'max:10000'],
        ]);

        $enabled = (bool) $validated['enabled'];
        $headline = trim((string) ($validated['headline'] ?? ''));
        $text = trim((string) ($validated['text'] ?? ''));
        $updatedAt = Carbon::now('UTC')->toIso8601String();

        Setting::setBoolean(self::SETTING_ENABLED, $enabled);
        Setting::setValue(self::SETTING_HEADLINE, $headline);
        Setting::setValue(self::SETTING_TEXT, $text);
        Setting::setValue(self::SETTING_UPDATED_AT, $updatedAt);

        return response()->json([
            'success' => true,
            'message' => 'Moderator live notice updated successfully.',
            'data' => [
                'enabled' => $enabled,
                'headline' => $headline,
                'text' => $text,
                'updated_at' => $updatedAt,
            ],
        ]);
    }

    /**
     * Get live notice for authenticated active moderators.
     * Strictly read-only and free of private data.
     */
    public function getModeratorNotice(): JsonResponse
    {
        $enabled = Setting::boolean(self::SETTING_ENABLED, false);
        $headline = Setting::value(self::SETTING_HEADLINE, '');
        $text = Setting::value(self::SETTING_TEXT, '');
        $updatedAt = Setting::value(self::SETTING_UPDATED_AT, '');

        return response()->json([
            'status' => 'success',
            'data' => [
                'enabled' => $enabled,
                'headline' => $enabled ? $headline : '',
                'text' => $enabled ? $text : '',
                'updated_at' => $updatedAt,
            ],
        ]);
    }
}
