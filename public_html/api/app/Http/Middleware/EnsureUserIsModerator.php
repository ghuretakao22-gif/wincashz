<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsModerator
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('api');

        $role = $user->role ?? 'user';

        if (! $user || ($role !== 'moderator' && $role !== 'admin')) {
            abort(403, 'Moderator access required.');
        }

        return $next($request);
    }
}
