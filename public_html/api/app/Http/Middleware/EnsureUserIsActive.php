<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('api');

        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        if ((bool) ($user->ban ?? false)) {
            auth('api')->logout();
            abort(403, 'Your account has been banned.');
        }

        return $next($request);
    }
}
