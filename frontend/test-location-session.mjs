import test from 'node:test';
import assert from 'node:assert/strict';

// We simulate the exact cache store, generation, and dispatch state machine used in CurrentLocationBadge.jsx
function createLocationSessionManager() {
  const FRESHNESS_TTL_MS = 15 * 60 * 1000;
  const INITIAL_BACKOFF_MS = 30 * 1000;
  const MAX_BACKOFF_MS = 5 * 60 * 1000;

  let currentSessionGeneration = 0;
  let activeRequestId = 0;
  let inflightPromise = null;

  const cacheStore = {
    userId: null,
    generation: 0,
    data: null,
    cachedAt: 0,
    consecutiveFailures: 0,
    nextRetryAllowedAt: 0,
    isAuthError: false,
  };

  function invalidateLocationSession() {
    currentSessionGeneration++;
    inflightPromise = null;
    activeRequestId = 0;

    cacheStore.userId = null;
    cacheStore.generation = currentSessionGeneration;
    cacheStore.data = null;
    cacheStore.cachedAt = 0;
    cacheStore.consecutiveFailures = 0;
    cacheStore.nextRetryAllowedAt = 0;
    cacheStore.isAuthError = false;
  }

  function fetchLocation(currentUserId, apiFn, now = Date.now(), force = false) {
    if (!currentUserId) return Promise.resolve({ action: 'noop_no_user' });

    const isCurrentSession =
      cacheStore.userId === currentUserId &&
      cacheStore.generation === currentSessionGeneration;

    // Freshness check
    if (!force && isCurrentSession && cacheStore.data) {
      if (now - cacheStore.cachedAt < FRESHNESS_TTL_MS) {
        return Promise.resolve({ action: 'from_cache', data: cacheStore.data });
      }
    }

    // Auth error check
    if (isCurrentSession && cacheStore.isAuthError) {
      return Promise.resolve({ action: 'auth_error_suppressed' });
    }

    // Failure backoff check
    if (!force && isCurrentSession && cacheStore.nextRetryAllowedAt > now) {
      return Promise.resolve({ action: 'backoff_suppressed', nextRetry: cacheStore.nextRetryAllowedAt });
    }

    const targetGeneration = currentSessionGeneration;
    const targetUserId = currentUserId;
    const thisRequestId = ++activeRequestId;

    // Deduplication check
    if (inflightPromise && isCurrentSession) {
      return inflightPromise.then((data) => {
        if (currentSessionGeneration !== targetGeneration || currentUserId !== targetUserId) {
          return { action: 'dropped_dedup_outdated' };
        }
        return { action: 'dedup_resolved', data };
      });
    }

    const promise = apiFn()
      .then((data) => {
        // Guard 1: Drop if generation or user changed
        if (currentSessionGeneration !== targetGeneration || currentUserId !== targetUserId) {
          return { action: 'dropped_session_changed' };
        }

        if (data && (data.country || data.ip) && data.country !== 'Unknown') {
          cacheStore.userId = targetUserId;
          cacheStore.generation = targetGeneration;
          cacheStore.data = data;
          cacheStore.cachedAt = now;
          cacheStore.consecutiveFailures = 0;
          cacheStore.nextRetryAllowedAt = 0;
          cacheStore.isAuthError = false;
          return { action: 'cached_success', data };
        }

        // Unknown result -> backoff
        const failures = cacheStore.consecutiveFailures;
        const backoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, failures), MAX_BACKOFF_MS);
        cacheStore.userId = targetUserId;
        cacheStore.generation = targetGeneration;
        cacheStore.data = null;
        cacheStore.consecutiveFailures = failures + 1;
        cacheStore.nextRetryAllowedAt = now + backoff;
        return { action: 'failure_unknown_backoff', backoff };
      })
      .catch((err) => {
        if (currentSessionGeneration !== targetGeneration || currentUserId !== targetUserId) {
          return { action: 'dropped_catch_outdated' };
        }
        const isAuth = err?.status === 401 || err?.status === 403;
        const failures = cacheStore.consecutiveFailures;
        const backoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, failures), MAX_BACKOFF_MS);

        cacheStore.userId = targetUserId;
        cacheStore.generation = targetGeneration;
        cacheStore.consecutiveFailures = failures + 1;
        cacheStore.nextRetryAllowedAt = now + backoff;
        cacheStore.isAuthError = Boolean(isAuth);
        return { action: 'failure_caught_backoff', backoff, isAuth };
      })
      .finally(() => {
        if (activeRequestId === thisRequestId && currentSessionGeneration === targetGeneration) {
          inflightPromise = null;
        }
      });

    inflightPromise = promise;
    return promise;
  }

  return {
    cacheStore,
    invalidateLocationSession,
    fetchLocation,
    getCurrentGeneration: () => currentSessionGeneration,
    getActiveRequestId: () => activeRequestId,
    hasInflight: () => inflightPromise !== null,
  };
}

test('1. Logout while a location request is pending drops the response and leaves cache empty', async () => {
  const sm = createLocationSessionManager();
  let resolveReq;
  const delayedPromise = new Promise((resolve) => { resolveReq = resolve; });

  const fetchPromise = sm.fetchLocation(1, () => delayedPromise);

  // User logs out while request is pending
  sm.invalidateLocationSession();

  // Now request completes
  resolveReq({ country: 'Bangladesh', ip: '103.141.209.145' });
  const result = await fetchPromise;

  assert.equal(result.action, 'dropped_session_changed');
  assert.equal(sm.cacheStore.data, null);
  assert.equal(sm.cacheStore.userId, null);
});

test('2. Account A switching to Account B before A response arrives drops A response and does not overwrite B', async () => {
  const sm = createLocationSessionManager();
  let resolveA;
  const delayedA = new Promise((resolve) => { resolveA = resolve; });

  // Account A request dispatched
  const promiseA = sm.fetchLocation(1, () => delayedA);

  // User logs out and User B logs in
  sm.invalidateLocationSession();

  // User B request completes immediately with B's location
  const resultB = await sm.fetchLocation(2, async () => ({ country: 'United States', ip: '8.8.8.8' }));
  assert.equal(resultB.action, 'cached_success');
  assert.equal(sm.cacheStore.data.country, 'United States');
  assert.equal(sm.cacheStore.userId, 2);

  // Now A's delayed response finally settles
  resolveA({ country: 'Bangladesh', ip: '103.1.1.1' });
  const resultA = await promiseA;

  assert.equal(resultA.action, 'dropped_session_changed');
  // Cache still belongs to User B!
  assert.equal(sm.cacheStore.data.country, 'United States');
  assert.equal(sm.cacheStore.userId, 2);
});

test('3. Logout and re-login by the same account invalidates previous pending response', async () => {
  const sm = createLocationSessionManager();
  let resolveOld;
  const delayedOld = new Promise((resolve) => { resolveOld = resolve; });

  // Session 1: User 1 request starts
  const oldPromise = sm.fetchLocation(1, () => delayedOld);

  // User 1 logs out and logs in again (new generation)
  sm.invalidateLocationSession();

  // Session 2: User 1 gets new data
  const newPromise = await sm.fetchLocation(1, async () => ({ country: 'Germany', ip: '1.2.3.4' }));
  assert.equal(newPromise.action, 'cached_success');
  assert.equal(sm.cacheStore.data.country, 'Germany');

  // Old delayed response from Session 1 settles with stale data
  resolveOld({ country: 'Old Country', ip: '9.9.9.9' });
  const oldResult = await oldPromise;

  assert.equal(oldResult.action, 'dropped_session_changed');
  assert.equal(sm.cacheStore.data.country, 'Germany');
});

test('4. An old request finally handler settling after a newer request starts does not clear newer in-flight state', async () => {
  const sm = createLocationSessionManager();
  let resolveReq1;
  const p1 = new Promise((resolve) => { resolveReq1 = resolve; });
  let resolveReq2;
  const p2 = new Promise((resolve) => { resolveReq2 = resolve; });

  // Request 1 starts
  const call1 = sm.fetchLocation(1, () => p1);

  // Request 2 forced starts before request 1 settles
  const call2 = sm.fetchLocation(1, () => p2, Date.now(), true);
  assert.equal(sm.hasInflight(), true);

  // Request 1 settles and runs finally
  resolveReq1({ country: 'Location 1', ip: '1.1.1.1' });
  await call1;

  // inflightPromise MUST NOT be cleared by request 1 because request 2 is active!
  assert.equal(sm.hasInflight(), true);

  // Now request 2 settles
  resolveReq2({ country: 'Location 2', ip: '2.2.2.2' });
  await call2;

  // After request 2 completes, in-flight is cleanly reset
  assert.equal(sm.hasInflight(), false);
  assert.equal(sm.cacheStore.data.country, 'Location 2');
});

test('5. Cache freshness TTL (15 min) and request deduplication', async () => {
  const sm = createLocationSessionManager();
  let fetchCount = 0;
  const fakeApi = async () => {
    fetchCount++;
    return { country: 'Japan', ip: '133.1.1.1' };
  };

  const t0 = 1000000;
  // First fetch at t0
  const res1 = await sm.fetchLocation(1, fakeApi, t0);
  assert.equal(res1.action, 'cached_success');
  assert.equal(fetchCount, 1);

  // Second fetch at t0 + 5 minutes (well within 15 min TTL)
  const res2 = await sm.fetchLocation(1, fakeApi, t0 + 5 * 60 * 1000);
  assert.equal(res2.action, 'from_cache');
  assert.equal(res2.data.country, 'Japan');
  assert.equal(fetchCount, 1); // 0 additional network calls

  // Third fetch at t0 + 16 minutes (TTL expired)
  const res3 = await sm.fetchLocation(1, fakeApi, t0 + 16 * 60 * 1000);
  assert.equal(res3.action, 'cached_success');
  assert.equal(fetchCount, 2); // Revalidated
});

test('6. Provider failure, Unknown result, and bounded exponential backoff', async () => {
  const sm = createLocationSessionManager();
  const t0 = 1000000;

  // Failure 1: Provider returns "Unknown"
  const res1 = await sm.fetchLocation(1, async () => ({ country: 'Unknown', ip: '1.1.1.1' }), t0);
  assert.equal(res1.action, 'failure_unknown_backoff');
  assert.equal(res1.backoff, 30000); // 30s initial backoff

  // Route change 5 seconds later: suppressed by backoff window
  const resSuppressed = await sm.fetchLocation(1, async () => ({ country: 'Unknown' }), t0 + 5000);
  assert.equal(resSuppressed.action, 'backoff_suppressed');

  // Attempt at t0 + 31 seconds: backoff expired, attempt 2 fails
  const res2 = await sm.fetchLocation(1, async () => { throw new Error('Network error'); }, t0 + 31000);
  assert.equal(res2.action, 'failure_caught_backoff');
  assert.equal(res2.backoff, 60000); // 60s backoff (doubled)

  // Fast forward past 5 failures to test maximum ceiling (5 minutes = 300000ms)
  let t = t0 + 100000;
  for (let i = 0; i < 5; i++) {
    t += 360000;
    const r = await sm.fetchLocation(1, async () => { throw new Error('Down'); }, t);
    assert.ok(r.backoff <= 300000, 'Backoff must never exceed 5 minutes');
  }
  assert.equal(sm.cacheStore.nextRetryAllowedAt, t + 300000);

  // 401 auth error stops automatic retry loop
  const resAuth = await sm.fetchLocation(1, async () => {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }, t + 350000);
  assert.equal(resAuth.isAuth, true);

  const resAuthSuppressed = await sm.fetchLocation(1, async () => ({ country: 'Japan' }), t + 355000);
  assert.equal(resAuthSuppressed.action, 'auth_error_suppressed');
});
