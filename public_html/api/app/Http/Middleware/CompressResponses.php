<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CompressResponses
{
    /**
     * Compress JSON only when the web server/PHP has not already done so.
     * This keeps large API payloads quick over slower mobile connections.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $contentType = (string) $response->headers->get('Content-Type', '');
        $content = $response->getContent();

        if (! str_contains($request->header('Accept-Encoding', ''), 'gzip')
            || $response->headers->has('Content-Encoding')
            || ! str_contains($contentType, 'application/json')
            || ! is_string($content)
            || strlen($content) < 1024
            || ! function_exists('gzencode')) {
            return $response;
        }

        $compressed = gzencode($content, 6);

        if ($compressed === false || strlen($compressed) >= strlen($content)) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', 'gzip');
        $response->headers->set('Vary', 'Accept-Encoding', false);
        $response->headers->remove('Content-Length');

        return $response;
    }
}
