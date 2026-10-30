<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MyId;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class ModeratorSettingsController extends Controller
{
    /**
     * Get settings and profile details for the authenticated moderator.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();
        $myIdCode = trim((string) ($user?->my_id ?? ''));

        $friendlyName = null;
        if ($myIdCode !== '' && Schema::hasTable('my_ids')) {
            $myIdRecord = MyId::where('my_id_code', $myIdCode)->first();
            $friendlyName = $myIdRecord?->friendly_name;
        }

        // Payout preference stored in settings table per user id
        $prefKey = "moderator_payout_pref_{$user->id}";
        $rawPref = Setting::value($prefKey, '');
        $payoutPref = [
            'default_method' => 'bkash',
            'method' => 'bkash',
            'account_number' => '',
            'mobile_number' => '',
            'account_holder_name' => '',
            'account_holder' => '',
            'bank_name' => '',
            'branch_name' => '',
        ];

        if ($rawPref !== '') {
            $decoded = json_decode($rawPref, true);
            if (is_array($decoded)) {
                $payoutPref = array_merge($payoutPref, $decoded);
                // Harmonize keys
                if (isset($decoded['default_method'])) {
                    $payoutPref['method'] = $decoded['default_method'];
                } elseif (isset($decoded['method'])) {
                    $payoutPref['default_method'] = $decoded['method'];
                }
                if (isset($decoded['account_number'])) {
                    $payoutPref['mobile_number'] = $decoded['account_number'];
                } elseif (isset($decoded['mobile_number'])) {
                    $payoutPref['account_number'] = $decoded['mobile_number'];
                }
                if (isset($decoded['account_holder_name'])) {
                    $payoutPref['account_holder'] = $decoded['account_holder_name'];
                } elseif (isset($decoded['account_holder'])) {
                    $payoutPref['account_holder_name'] = $decoded['account_holder'];
                }
            }
        }

        $payoutEnabled = Setting::boolean(AdminMyIdPayoutController::SETTING_PAYOUT_ENABLED, false);

        $profileData = [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'joined_at' => $user->created_at ? $user->created_at->format('d M Y') : '—',
            'created_at' => $user->created_at ? $user->created_at->format('d M Y') : '—',
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'profile' => $profileData,
                'user' => $profileData,
                'my_id' => [
                    'code' => $myIdCode ?: null,
                    'friendly_name' => $friendlyName,
                    'has_my_id' => $myIdCode !== '',
                ],
                'payout_preferences' => $payoutPref,
                'payout_defaults' => $payoutPref,
                'system_info' => [
                    'timezone' => 'UTC',
                    'timezone_notice' => 'All reporting times and audit statistics are strictly computed in UTC.',
                    'rate_notice' => 'Payout rates and USD-to-BDT conversion rates are configured exclusively by the platform administrator. Contact Admin to adjust rates.',
                    'currencies' => 'USD & BDT',
                    'payout_enabled' => $payoutEnabled,
                ],
            ],
        ]);
    }

    /**
     * Update allowed moderator settings (profile name, password, preferred payout info).
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user('api') ?? $request->user();

        // 1. Profile Name Update
        if ($request->has('name')) {
            $name = trim((string) $request->input('name'));
            if ($name !== '' && strlen($name) <= 100) {
                $user->name = $name;
                $user->save();
            }
        }

        // 2. Password Change
        if ($request->filled('new_password')) {
            $currentPassword = (string) $request->input('current_password', '');
            if ($currentPassword === '') {
                throw ValidationException::withMessages([
                    'current_password' => ['Current password is required to set a new password.'],
                ]);
            }

            if (!Hash::check($currentPassword, $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The current password you provided is incorrect.'],
                ]);
            }

            $request->validate([
                'new_password' => ['required', 'string', 'min:8', 'confirmed'],
            ], [
                'new_password.min' => 'The new password must be at least 8 characters long.',
                'new_password.confirmed' => 'Password confirmation does not match.',
            ]);

            $user->password = $request->input('new_password');
            $user->save();
        }

        // 3. Preferred Payout Method defaults
        if ($request->has('payout_preferences') || $request->has('payout_defaults') || $request->has('method')) {
            $payoutData = $request->input('payout_preferences') ?? $request->input('payout_defaults') ?? [
                'method' => $request->input('method', 'bkash'),
                'mobile_number' => $request->input('mobile_number', ''),
                'account_holder' => $request->input('account_holder', ''),
                'account_number' => $request->input('account_number', ''),
                'bank_name' => $request->input('bank_name', ''),
                'branch_name' => $request->input('branch_name', ''),
            ];

            if (is_array($payoutData)) {
                $method = $payoutData['default_method'] ?? $payoutData['method'] ?? 'bkash';
                $accNum = $payoutData['account_number'] ?? $payoutData['mobile_number'] ?? '';
                $holder = $payoutData['account_holder_name'] ?? $payoutData['account_holder'] ?? '';
                $bank = $payoutData['bank_name'] ?? '';
                $branch = $payoutData['branch_name'] ?? '';

                $prefKey = "moderator_payout_pref_{$user->id}";
                $safePref = [
                    'default_method' => in_array($method, ['bkash', 'nagad', 'bank'], true) ? $method : 'bkash',
                    'method' => in_array($method, ['bkash', 'nagad', 'bank'], true) ? $method : 'bkash',
                    'account_number' => substr(trim((string) $accNum), 0, 100),
                    'mobile_number' => substr(trim((string) $accNum), 0, 100),
                    'account_holder_name' => substr(trim((string) $holder), 0, 100),
                    'account_holder' => substr(trim((string) $holder), 0, 100),
                    'bank_name' => substr(trim((string) $bank), 0, 100),
                    'branch_name' => substr(trim((string) $branch), 0, 100),
                ];
                Setting::setValue($prefKey, json_encode($safePref));
            }
        }

        return $this->index($request);
    }
}
