<?php

namespace App\Services;

use Illuminate\Http\Request;

class IpCountryResolver
{
    public function countryFromRequest(Request $request): string
    {
        return $this->countryFromIp($this->resolveClientIp($request), $request);
    }

    public function countryFromIp(?string $ip, ?Request $request = null): string
    {
        $headerCountry = $request ? $this->extractCountryHeader($request) : null;
        if ($this->isFilledString($headerCountry)) {
            return $headerCountry;
        }

        $resolvedIp = $this->normalizeIp($ip);
        if ($resolvedIp === null && $request) {
            $resolvedIp = $this->resolveClientIp($request);
        }

        if ($resolvedIp === null) {
            return 'Unknown';
        }

        if (! $this->isPublicIp($resolvedIp)) {
            return $headerCountry ?: 'Local';
        }

        return $headerCountry ?: 'Unknown';
    }

    public function resolveClientIp(Request $request): ?string
    {
        $forwardedFor = trim((string) $request->header('X-Forwarded-For', ''));
        if ($forwardedFor !== '') {
            $fallback = null;

            foreach (explode(',', $forwardedFor) as $candidate) {
                $value = $this->normalizeIp($candidate);
                if ($value === null) {
                    continue;
                }

                if ($this->isPublicIp($value)) {
                    return $value;
                }

                $fallback ??= $value;
            }

            if ($fallback !== null) {
                return $fallback;
            }
        }

        foreach (['X-Client-IP', 'CF-Connecting-IP', 'True-Client-IP', 'X-Real-IP'] as $header) {
            $value = $this->normalizeIp($request->header($header));
            if ($value !== null) {
                return $value;
            }
        }

        return $this->normalizeIp($request->ip());
    }

    private function extractCountryHeader(Request $request): ?string
    {
        foreach (['CF-IPCountry', 'X-Country-Code', 'X-Country'] as $header) {
            $value = trim((string) $request->header($header, ''));
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function normalizeIp(mixed $ip): ?string
    {
        $value = trim((string) $ip);
        if ($value === '') {
            return null;
        }

        return filter_var($value, FILTER_VALIDATE_IP) !== false ? $value : null;
    }

    private function isPublicIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    private function isFilledString(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }

    private function normalizeCountryValue(mixed $country): string
    {
        $country = trim((string) $country);
        if ($country === '' || strcasecmp($country, 'XX') === 0 || strcasecmp($country, 'unknown') === 0) {
            return 'Unknown';
        }

        if (preg_match('/^[A-Z]{2}$/i', $country) === 1) {
            if (function_exists('locale_get_display_region')) {
                $display = locale_get_display_region('-'.strtoupper($country), 'en');
                if (is_string($display) && trim($display) !== '') {
                    return mb_substr($display, 0, 100);
                }
            }

            return strtoupper($country);
        }

        return mb_substr($country, 0, 100);
    }
}
