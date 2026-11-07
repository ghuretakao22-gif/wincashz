<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/google-auth/callback', [AuthController::class, 'googleCallback'])->name('google-auth.callback');
Route::get('/my-id/resolve/{code?}', [AuthController::class, 'resolveMyId']);
Route::get('/my-id/resolve', [AuthController::class, 'resolveMyId']);
Route::get('/api/my-id/resolve/{code?}', [AuthController::class, 'resolveMyId']);
Route::get('/api/my-id/resolve', [AuthController::class, 'resolveMyId']);
