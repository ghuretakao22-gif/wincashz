<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class GeoLocationService
{
    /**
     * Resolve IP address to location data: ip, country, country_code, flag, city, region.
     * Caches successful lookups for 1 hour (3600s).
     * Private IPs return "Local" without external HTTP calls.
     * Any failure safely returns "Unknown" fallback, never throws.
     */
    public function resolve(?string $ip): array
    {
        $ip = trim((string) $ip);
        if ($ip === '') {
            $ip = '127.0.0.1';
        }

        if ($this->isPrivateIp($ip)) {
            return [
                'ip' => $ip,
                'country' => 'Local',
                'country_code' => '--',
                'flag' => '🏳️',
                'city' => 'Local',
                'region' => 'Local',
            ];
        }

        try {
            return cache()->remember("geo:{$ip}", 3600, function () use ($ip) {
                try {
                    $response = Http::timeout(3)->get("https://ipwho.is/{$ip}");
                    if ($response->successful()) {
                        $data = $response->json();
                        if (is_array($data) && ($data['success'] ?? true)) {
                            $countryCode = strtoupper(trim((string) ($data['country_code'] ?? $data['countryCode'] ?? '')));
                            $country = trim((string) ($data['country'] ?? ''));
                            $city = trim((string) ($data['city'] ?? ''));
                            $region = trim((string) ($data['region'] ?? ''));

                            return [
                                'ip' => $ip,
                                'country' => $country !== '' ? $country : 'Unknown',
                                'country_code' => $countryCode !== '' ? $countryCode : '--',
                                'flag' => $this->countryCodeToFlag($countryCode),
                                'city' => $city,
                                'region' => $region,
                            ];
                        }
                    }
                } catch (\Throwable $e) {
                    // Fall through to unknown fallback
                }

                return [
                    'ip' => $ip,
                    'country' => 'Unknown',
                    'country_code' => '--',
                    'flag' => '🌐',
                    'city' => '',
                    'region' => '',
                ];
            });
        } catch (\Throwable $e) {
            return [
                'ip' => $ip,
                'country' => 'Unknown',
                'country_code' => '--',
                'flag' => '🌐',
                'city' => '',
                'region' => '',
            ];
        }
    }

    /**
     * Check if an IP is in a private, loopback, or reserved range.
     */
    public function isPrivateIp(string $ip): bool
    {
        if ($ip === '127.0.0.1' || $ip === '::1' || str_starts_with($ip, '10.') || str_starts_with($ip, '192.168.')) {
            return true;
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }

    /**
     * Convert 2-letter ISO country code (e.g. BD, US) to flag emoji.
     */
    public function countryCodeToFlag(string $code): string
    {
        $code = strtoupper(trim($code));
        if (strlen($code) !== 2 || !ctype_alpha($code)) {
            return '🌐';
        }

        $first = 127397 + ord($code[0]);
        $second = 127397 + ord($code[1]);

        return mb_chr($first, 'UTF-8') . mb_chr($second, 'UTF-8');
    }
}
