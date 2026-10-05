<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\WithdrawalController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::middleware(['auth:api', 'active'])->group(function () {
    Route::get('/username-availability', [AuthController::class, 'usernameAvailability']);
    Route::post('/profile/setup', [AuthController::class, 'completeProfileSetup']);
});
Route::get('/visitor-geo', [AuthController::class, 'visitorGeo']);
Route::get('/google-auth/config', [AuthController::class, 'googleConfig']);
Route::get('/site-settings', [AdminController::class, 'publicSettings']);
Route::post('/google-auth/start', [AuthController::class, 'googleStart']);
Route::get('/offers', [AdminController::class, 'offers']);
Route::get('/timeline', [AdminController::class, 'timeline']);
Route::get('/timeline/{timelineEntry}/details', [AdminController::class, 'timelineDetails']);
Route::get('/offerwalls', [AdminController::class, 'offerwalls']);
Route::get('/cashout-methods', [AdminController::class, 'publicCashoutMethods']);
Route::get('/withdrawals/latest', [WithdrawalController::class, 'latest']);
Route::match(['get', 'post'], '/offerwall-postback/{slug}', [AdminController::class, 'offerwallPostback']);

Route::middleware(['auth:api', 'active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile/tabs', [ProfileController::class, 'tabs']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/withdrawals', [WithdrawalController::class, 'store']);
});

Route::prefix('admin')
    ->middleware(['auth:api', 'active', 'admin'])
    ->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/offers', [AdminController::class, 'adminOffers']);
    Route::post('/offers', [AdminController::class, 'storeOffer']);
    Route::patch('/offers/{offer}', [AdminController::class, 'updateOffer']);
    Route::delete('/offers/{offer}', [AdminController::class, 'destroyOffer']);
    Route::get('/offers-api', [AdminController::class, 'offersApiLinks']);
    Route::post('/offers-api', [AdminController::class, 'storeOffersApiLink']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::get('/completed-tasks', [AdminController::class, 'completedTasks']);
    Route::get('/chargebacks', [AdminController::class, 'chargebacks']);
    Route::get('/pending-withdrawals', [AdminController::class, 'pendingWithdrawals']);
    Route::get('/all-withdrawals', [AdminController::class, 'allWithdrawals']);
    Route::patch('/pending-withdrawals/{withdrawal}/action', [AdminController::class, 'updatePendingWithdrawal']);
    Route::delete('/completed-tasks/{completedTask}', [AdminController::class, 'destroyCompletedTask']);
    Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
    Route::post('/users/bulk', [AdminController::class, 'bulkUsers']);
    Route::patch('/settings/timeline', [AdminController::class, 'updateTimelineSetting']);
    Route::patch('/settings/logo', [AdminController::class, 'updateSiteLogo']);
    Route::get('/settings/google-authentication', [AdminController::class, 'googleAuthentication']);
    Route::patch('/settings/google-authentication', [AdminController::class, 'updateGoogleAuthentication']);
    Route::get('/cashout-methods', [AdminController::class, 'cashoutMethods']);
    Route::post('/cashout-methods', [AdminController::class, 'storeCashoutMethod']);
    Route::patch('/cashout-methods/{cashoutMethod}', [AdminController::class, 'updateCashoutMethod']);
    Route::delete('/cashout-methods/{cashoutMethod}', [AdminController::class, 'destroyCashoutMethod']);
    Route::get('/offerwalls', [AdminController::class, 'offerwalls']);
    Route::post('/offerwalls', [AdminController::class, 'storeOfferwall']);
    Route::patch('/offerwalls/{offerwall}', [AdminController::class, 'updateOfferwall']);
    Route::delete('/offerwalls/{offerwall}', [AdminController::class, 'destroyOfferwall']);
});
