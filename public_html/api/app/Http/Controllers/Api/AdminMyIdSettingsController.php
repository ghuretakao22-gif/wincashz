<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\MyIdEarningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminMyIdSettingsController extends Controller
{
    /**
     * Get current My ID system activation, start date, and USD/BDT rate.
     */
    public function getSettings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'my_id_system_enabled' => MyIdEarningService::isSystemEnabled(),
                'my_id_start_date' => Setting::value(MyIdEarningService::SETTING_START_DATE, ''),
                'my_id_usd_bdt_rate' => MyIdEarningService::getUsdBdtRate(),
                'timezone' => 'UTC',
            ],
        ]);
    }

    /**
     * Update My ID system settings.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'my_id_system_enabled' => ['nullable', 'boolean'],
            'my_id_start_date' => ['nullable', 'string'],
            'my_id_usd_bdt_rate' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        if ($request->has('my_id_system_enabled')) {
            Setting::setBoolean(
                MyIdEarningService::SETTING_SYSTEM_ENABLED,
                (bool) $request->input('my_id_system_enabled')
            );
        }

        if ($request->has('my_id_start_date')) {
            $rawDate = trim((string) $request->input('my_id_start_date', ''));
            if ($rawDate === '') {
                Setting::setValue(MyIdEarningService::SETTING_START_DATE, '');
            } else {
                // Parse consistently as UTC timestamp
                $parsed = Carbon::parse($rawDate, 'UTC')->setTimezone('UTC')->format('Y-m-d H:i:s');
                Setting::setValue(MyIdEarningService::SETTING_START_DATE, $parsed);
            }
        }

        if ($request->has('my_id_usd_bdt_rate')) {
            $rate = number_format((float) $request->input('my_id_usd_bdt_rate'), 2, '.', '');
            Setting::setValue(MyIdEarningService::SETTING_USD_BDT_RATE, $rate);
        }

        return response()->json([
            'success' => true,
            'message' => 'My ID system settings updated successfully.',
            'data' => [
                'my_id_system_enabled' => MyIdEarningService::isSystemEnabled(),
                'my_id_start_date' => Setting::value(MyIdEarningService::SETTING_START_DATE, ''),
                'my_id_usd_bdt_rate' => MyIdEarningService::getUsdBdtRate(),
                'timezone' => 'UTC',
            ],
        ]);
    }
}
