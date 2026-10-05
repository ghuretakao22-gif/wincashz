<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-site');
        $response->headers->set('Vary', 'Accept-Encoding', false);

        // These unauthenticated catalog responses are safe to reuse at the browser/CDN edge.
        if ($request->isMethod('GET') && ! $request->headers->has('Authorization')) {
            $maxAge = match (true) {
                $request->is('api/timeline') => 15,
                $request->is('api/offers'),
                $request->is('api/cashout-methods'),
                $request->is('api/offerwalls'),
                $request->is('api/google-auth/config') => 60,
                default => 0,
            };

            if ($maxAge > 0) {
                $response->headers->set('Cache-Control', "public, max-age={$maxAge}, stale-while-revalidate=300");
            }
        }

        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http: https: ws: wss:; font-src 'self' data:; upgrade-insecure-requests"
        );

        return $response;
    }
}
