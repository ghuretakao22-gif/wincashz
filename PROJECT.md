# Wincashz - System Architecture, Security & Codebase Audit

## Audit Overview & Date
- **Audit Date:** 2026-11-03
- **Auditor Role:** Senior Full-Stack Engineer & Security-Focused Code Auditor
- **Workspace:** `c:\Users\zahidul\wincashz` (Branch: `main`)
- **Reported Issue Context:** General system audit and investigation of observable failures or regressions across the first-party application codebase.

---

## 1. Audit Scope & Areas Reviewed
The audit covered the complete first-party codebase, project configurations, data models, routes, controllers, middleware, frontend client components, and security postures:
1. **Backend Application (Laravel 11)**:
   - Route declarations in `public_html/api/routes/api.php` and `public_html/api/routes/web.php`.
   - Controllers in `public_html/api/app/Http/Controllers/Api/` (`AuthController`, `AdminController`, `ModeratorController`, `ModeratorCompletedOffersController`, `ModeratorPayoutController`, `WithdrawalController`, etc.).
   - Middleware pipeline in `bootstrap/app.php` and `app/Http/Middleware/` (`EnsureUserIsAdmin`, `EnsureUserIsModerator`, `EnsureUserIsActive`, `SecurityHeaders`, `CompressResponses`).
   - Domain services in `app/Services/` (`IpCountryResolver`, `GeoLocationService`, `MyIdEarningService`).
   - Eloquent models in `app/Models/` (`User`, `CompletedTask`, `Chargeback`, `Transaction`, `MyId`, `MyIdPayout`, `MyIdPayoutRule`, etc.).
   - Database migrations and schema definitions in `database/migrations/`.
   - Automated testing suite in `tests/Feature/`.
2. **Frontend Client (React 18 + Vite + Tailwind CSS)**:
   - Root application routing, suspense boundaries, and page structures in `frontend/src/App.jsx`.
   - Layouts & Header components (`Navbar.jsx`, `ModeratorLayout.jsx`, `AdminLayout.jsx`, `CurrentLocationBadge.jsx`, `PinGate.jsx`).
   - Authentication context and state lifecycle in `frontend/src/context/AuthContext.jsx`.
   - API client abstraction and query serialization in `frontend/src/services/api.js`.
   - Production Vite bundle compilation outputs in `public_html/assets/` and `public_html/index.html`.
3. **Configuration & Operational Files**:
   - CORS configuration (`config/cors.php`), JWT authentication configuration (`config/jwt.php`, `config/auth.php`), and environment templates (`DEPLOY/PRODUCTION_ENV_TEMPLATE.txt`).

*Exclusions:* Third-party vendor packages (`vendor/`, `node_modules/`), compiled binary packages, and `.git/` internal metadata were excluded from manual code review.

---

## 2. Work Actually Completed During This Task
- Inspected the current Git working tree and commit status (`git status`).
- Inspected recent Git history (`git log -n 5`) to analyze the three most recent commits.
- Executed the full automated test suite non-destructively (`cd public_html/api; php artisan test`).
- Executed the frontend production build verification (`cd frontend; npm run build`) to test module resolution, syntax, and asset generation.
- Performed security and code analysis across authentication, authorization, offerwall postback validation, SQL execution, mass assignment guards, and data exposure.
- Documented all findings, evidence, analysis of the last three edits, and remediation plans in this file (`PROJECT.md`).
- Confirmed zero source code or configuration changes were introduced.

---

## 3. Safe Checks Performed & Results

| # | Safe Check Description | Command Executed | Outcome / Result |
|---|---|---|---|
| 1 | Git Working-Tree Inspection | `git status` | Clean working tree on branch `main`, in sync with `origin/main`. |
| 2 | Commit History Review | `git log -n 5 --stat` | Identified last 3 verifiable commits: `06445ed`, `e62dcde`, and `ade0860`. |
| 3 | Backend PHPUnit Test Suite | `php artisan test` | **Passed:** 188 tests passed (1,452 assertions, 0 failures, ~9.1s duration). |
| 4 | Frontend Production Build | `npm run build` | **Passed:** 1,948 modules transformed; bundled cleanly into `public_html/assets/` with 0 errors (~10.0s). |
| 5 | PHP Application Log Inspection | `Get-Content laravel.log -Tail 40` | Inspected recent entries; no unhandled fatal exceptions or crashes. |
| 6 | Untracked Secrets Inspection | `git ls-files *env*` | Verified `.env` and `.env.production.backup` are not tracked in Git. |

*Checks Skipped Due to Safety Concerns:* Database migration execution (`php artisan migrate`), fresh migrations (`migrate:fresh`), and server credential tests were skipped to preserve production database state.

---

## 4. Review of the Last Three Verifiable Edits

### Edit 1: Commit `06445ed`
- **Commit Message:** `Moderator users page: strict My ID scoping, S.L serial column, add 'All' option to rows-per-page`
- **Files Modified:**
  - `frontend/src/pages/ModeratorUsersPage.jsx`
  - `public_html/api/app/Http/Controllers/Api/ModeratorController.php`
  - `public_html/api/tests/Feature/ModeratorUsersScopeTest.php` (new file)
  - `public_html/assets/*` and `public_html/index.html` (Vite build outputs)
- **Summary of Changes:**
  - Scoped `ModeratorController::users()` queries explicitly with `where('users.my_id', $myIdCode)` to prevent cross-team data access.
  - Handled moderators with null/empty `my_id` by safely returning an empty result set (`total: 0`, `data: []`).
  - Added support for `per_page="all"` along with fallback to `25` for invalid values, normalizing pagination response keys.
  - Added frontend `S.L` serial numbering column `(pagination.from || 1) + idx` and `All` rows option.
- **Assessment:**
  - **No regression introduced.** The scoping prevents privilege escalation and cross-team data leakage. All 5 dedicated unit tests and all 188 full-suite tests pass.

### Edit 2: Commit `e62dcde`
- **Commit Message:** `Add current location (country/flag/city/IP) badge in post-login header`
- **Files Modified:**
  - `frontend/src/components/CurrentLocationBadge.jsx` (new file)
  - `frontend/src/components/Navbar.jsx`, `ModeratorLayout.jsx`, `AdminLayout.jsx`
  - `frontend/src/services/api.js`
  - `public_html/api/app/Services/GeoLocationService.php` (new file)
  - `public_html/api/app/Http/Controllers/Api/AuthController.php`
  - `public_html/api/routes/api.php`
  - `public_html/api/tests/Feature/UserLocationTest.php` (new file)
  - `public_html/assets/*` and `public_html/index.html` (Vite build outputs)
- **Summary of Changes:**
  - Introduced `GET /api/me/location` protected by `['auth:api', 'active']`.
  - Implemented `GeoLocationService` with local/private IP bypass, 1-hour per-IP caching, 3s timeout for external lookups, and graceful fallback to `Unknown` (`🌐`).
  - Integrated responsive `<CurrentLocationBadge />` pill in member, moderator, and admin headers.
- **Assessment:**
  - **No regression introduced.** The endpoint is authenticated, non-destructive, and handles errors gracefully without throwing 500 exceptions.

### Edit 3: Commit `ade0860`
- **Commit Message:** `Fix moderator completed-offers 500 (ONLY_FULL_GROUP_BY reorder), add S.L serial column, add UTC date & month calendar filters on Completed Offers and Users pages`
- **Files Modified:**
  - `frontend/src/pages/ModeratorCompletedOffersPage.jsx`
  - `frontend/src/pages/ModeratorUsersPage.jsx`
  - `public_html/api/app/Http/Controllers/Api/ModeratorCompletedOffersController.php`
  - `public_html/api/app/Http/Controllers/Api/ModeratorController.php`
  - `public_html/api/tests/Feature/ModeratorCompletedOffersStrictSqlTest.php` (new file)
  - `public_html/assets/*` and `public_html/index.html` (Vite build outputs)
- **Summary of Changes:**
  - Fixed MySQL 8 `ONLY_FULL_GROUP_BY` SQL syntax error (QueryException 1140) in `/api/moderator/completed-offers` by calling `reorder()` on cloned aggregate queries.
  - Added UTC calendar date and month filters and S.L serial column on moderator tables.
- **Assessment:**
  - **Resolved a confirmed production defect.** No regressions observed; strict SQL mode compatibility tests verify the fix across all grouping scenarios.

---

## 5. Audit Findings by Severity

### HIGH SEVERITY

#### [SEC-01] Offerwall Postbacks Lack Cryptographic Signature Verification
- **Category:** Application Security / Financial Fraud
- **File & Line Reference:** [AdminController.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Http/Controllers/Api/AdminController.php#L2389-L2392) (lines 2389–2392, 3018, 3057–3058)
- **Description:** While `postback_signature_required` exists on the `Offerwall` model, `AdminController::offerwallPostback()` never evaluates or verifies an HMAC, SHA256, or MD5 cryptographic signature. It only checks `postback_whitelist_ips`. If an offerwall provider does not require IP whitelisting or has an empty IP list, any external client can make an unauthenticated request to `/api/offerwall-postback/{slug}` with forged transaction parameters, automatically crediting coins and balance to user accounts.
- **Likely Relationship to Reported Issue:** Potential critical vulnerability for balance manipulation if untrusted postbacks reach the server.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Implement cryptographic signature verification (HMAC-SHA256 or MD5 depending on provider spec) against a secret postback key stored in the offerwall configuration.
  - Reject postbacks with HTTP 403/422 if `postback_signature_required` is enabled and signature verification fails.

#### [SEC-02] Missing Rate Limiting on Authentication Endpoints (`/api/login`, `/api/register`)
- **Category:** Authentication Security / Brute-Force & Abuse
- **File & Line Reference:** [api.php](file:///c:/Users/zahidul/wincashz/public_html/api/routes/api.php#L21-L22) (lines 21–22) and [AuthController.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Http/Controllers/Api/AuthController.php#L239-L336)
- **Description:** Routes `POST /api/register` and `POST /api/login` have no `throttle` middleware attached, nor do the controller methods call Laravel's `RateLimiter`. An attacker can conduct unlimited automated credential-stuffing, dictionary attacks, or mass account creation.
- **Likely Relationship to Reported Issue:** Exposes authentication system to automated credential attacks.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Attach `throttle:10,1` or a custom `RateLimiter::for('login')` to `/api/login` and `/api/register` to block brute-force attempts.

---

### MEDIUM SEVERITY

#### [SEC-03] Unvalidated Reverse Proxy Header Parsing in IP Resolution
- **Category:** Security / IP Spoofing
- **File & Line Reference:** [IpCountryResolver.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Services/IpCountryResolver.php#L61-L93) (lines 61–93) and [app.php](file:///c:/Users/zahidul/wincashz/public_html/api/bootstrap/app.php#L15-L24)
- **Description:** `IpCountryResolver::resolveClientIp()` inspects headers such as `X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`, and `X-Client-IP` directly without verifying whether the direct connecting IP (`REMOTE_ADDR`) is an authorized reverse proxy. Furthermore, Laravel 11's `$middleware->trustProxies()` is not configured in `bootstrap/app.php`. If traffic hits the web server directly (bypassing CDN/proxy), arbitrary client headers can spoof IP addresses and geolocation.
- **Likely Relationship to Reported Issue:** Potential for users to bypass IP/country checks or spoof moderator locations.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Configure trusted proxies in `bootstrap/app.php` (`$middleware->trustProxies(at: '...', headers: Request::HEADER_X_FORWARDED_FOR | ...)`) and restrict header parsing to trusted proxy IP ranges only.

#### [SEC-04] Long-Lived JWT Token Lifespan (10-Year TTL in Production Template)
- **Category:** Authentication / Token Security
- **File & Line Reference:** [PRODUCTION_ENV_TEMPLATE.txt](file:///c:/Users/zahidul/wincashz/DEPLOY/PRODUCTION_ENV_TEMPLATE.txt#L14-L15) (lines 14–15) and [api.js](file:///c:/Users/zahidul/wincashz/frontend/src/services/api.js#L23-L49)
- **Description:** `JWT_TTL` is set to `5256000` minutes (10 years) in the deployment configuration template. Because tokens are stored in browser `localStorage`, any compromised token remains valid for a decade unless manually blacklisted or until the global JWT secret is rotated.
- **Likely Relationship to Reported Issue:** Increases the impact window of token theft.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Set `JWT_TTL` to 60–120 minutes and rely on `POST /api/refresh` for extending active user sessions.

#### [SEC-05] Unauthenticated External Geolocation Query Triggering
- **Category:** Resource Exhaustion / Third-Party API Depletion
- **File & Line Reference:** [AuthController.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Http/Controllers/Api/AuthController.php#L338-L351) (lines 338–351) and [IpCountryResolver.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Services/IpCountryResolver.php#L34-L58)
- **Description:** `GET /api/visitor-geo` is unauthenticated and accepts a user-controlled `?ip=` parameter (`$requestedIp = trim((string) $request->query('ip', ''))`). If a public IP is provided, it triggers outbound HTTP calls to `ipapi.co` and `api.country.is`. An attacker can query this endpoint with randomized public IPs to deplete external API quotas and cause denial of service for genuine visitors.
- **Likely Relationship to Reported Issue:** Potential rate limit depletion of external geolocation providers.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Ignore user-supplied `?ip=` parameter on unauthenticated requests and always resolve the client IP from the connection, with caching.

#### [PERF-01] In-Memory Dataset Loading in CSV Exports
- **Category:** Performance & Scalability
- **File & Line Reference:** [AdminController.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Http/Controllers/Api/AdminController.php#L1388-L1405) (lines 1388–1405) and [ModeratorCompletedOffersController.php](file:///c:/Users/zahidul/wincashz/public_html/api/app/Http/Controllers/Api/ModeratorCompletedOffersController.php#L364-L365) (line 364)
- **Description:** Both the admin completed offers export and moderator completed offers export load the entire matching dataset into PHP memory via `$query->get()`. As database records grow into tens or hundreds of thousands, this risks exceeding PHP's `memory_limit` and causing 500 errors.
- **Likely Relationship to Reported Issue:** Can cause intermittent 500 errors or timeouts on large export requests.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Implement streaming responses using Laravel's `cursor()` or chunking (`chunk(500)`) with `Symfony\Component\HttpFoundation\StreamedResponse`.

---

### LOW SEVERITY

#### [SEC-06] Permissive Wildcard CORS Configuration
- **Category:** API Security
- **File & Line Reference:** [cors.php](file:///c:/Users/zahidul/wincashz/public_html/api/config/cors.php#L4-L8) (lines 4–8)
- **Description:** `'allowed_origins' => ['*']` allows cross-origin requests from any website to the API.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Constrain `allowed_origins` to `config('app.frontend_url', 'https://wincashz.com')`.

#### [CODE-01] Tracking of Deprecated Build Artifacts in Repository History
- **Category:** Maintenance / Repository Hygiene
- **File & Line Reference:** `public_html/assets/`
- **Description:** Compiled Vite asset bundles are committed directly to Git. Superseded hashes from earlier commits accumulate in the repository unless pruned during commits.
- **Recommended Remediation (NOT IMPLEMENTED):**
  - Compile assets during deployment or prune stale chunks when committing production builds.

---

## 6. Recommended Next Steps (NOT IMPLEMENTED)
All recommendations are documented for future implementation planning only; no fixes were applied in this task:
1. **Remediate SEC-01 & SEC-02**: Add HMAC signature checking on offerwalls and attach `throttle` middleware to `/api/login` and `/api/register`.
2. **Remediate SEC-03**: Configure trusted reverse proxies in `bootstrap/app.php`.
3. **Remediate PERF-01**: Refactor data exports to stream CSVs via `cursor()` to prevent PHP memory limits from being exceeded.
4. **Remediate SEC-04 & SEC-05**: Adjust production `JWT_TTL` to standard session windows and remove the client-supplied `?ip=` parameter on `/api/visitor-geo`.

---

## 7. Audit Limitations & Unverified Areas
- **Live Production Database**: The audit was conducted using the local testing database (SQLite in-memory with migrations) and the code repository. Real production MySQL data volumes and live server network latency were not directly tested.
- **External Third-Party APIs**: Third-party offerwall networks, Google OAuth endpoints, and paid geolocation APIs were evaluated from code inspection and mocked unit tests, not live network calls.
- **Web Server Configuration**: Host-level configurations (Nginx/Apache vhost files, Cloudflare WAF rules, and cPanel settings outside the Git repository) were not directly inspectable.

---

## 8. Website Connectivity Diagnosis (ERR_TIMED_OUT) & Redesigned Header Location Widget

### 1. Verified Connectivity Diagnostics (wincashz.com)
- **DNS Resolution**: `wincashz.com` resolves directly to A-record IP `69.57.162.203` (TTL 14400, Namecheap shared/VPS host). `www.wincashz.com` is a CNAME pointing to `wincashz.com`. No IPv6 (AAAA) record exists.
- **Port 80 (HTTP)**: TCP connection succeeds immediately; returns HTTP `301 Moved Permanently` redirecting to `https://wincashz.com/`.
- **Port 443 (HTTPS)**: TLS handshake succeeds cleanly; Sectigo DV SSL certificate is active and valid (validity: 2025-12-18 through 2026-12-19).
- **Web Server & Application Status**: The production LiteSpeed web server serves the static SPA (`index.html` and assets in `/assets/`) with HTTP 200 OK. Public API endpoints (e.g. `/api/site-pin/status`) return HTTP 200 `{"has_pin":false}`.
- **Root Cause of `ERR_TIMED_OUT` on User's Browser / Proxy Profile**:
  - The connection fails at the network transport level before reaching the application layer or web server. TCP SYN packets from the proxy's egress IP are dropped without receiving a SYN-ACK, causing the browser to timeout with `ERR_TIMED_OUT`.
  - This symptom is characteristic of hosting-level security firewalls (ConfigServer Security & Firewall / CSF, cPHulk brute force protection, or Imunify360 on Namecheap server `69.57.162.203`) dropping traffic from datacenter/commercial proxy IP ranges or subnets flagged for automated activity.
  - Alternatively, the user's local browser proxy profile may be pointing to an offline, dead, or misconfigured upstream proxy server node.
- **Required Operator / Hosting Actions**:
  1. **Whitelist Proxy IP in Hosting Firewall**: In cPanel / WHM (or via hosting support ticket), inspect CSF / Imunify360 / cPHulk blocks for the specific egress IP of the user's proxy profile and whitelist it.
  2. **Verify Upstream Proxy Node**: Test whether the proxy server node itself is responding by connecting to other HTTPS targets through the same profile.
  3. **Cloudflare / CDN WAF Rules**: If a CDN or reverse proxy is placed in front of the origin, ensure that management/development proxy IP ranges are exempted from managed challenge / block rules.

### 2. Implemented Application Improvements & Location Widget Redesign

#### A. Backend Geolocation & Security Hardening
- **Timeout Reduction**: Reduced HTTP client timeout in `GeoLocationService` from 3.0s to 2.5s to prevent long hanging requests on degraded third-party API performance.
- **Selective Caching**: Caching (`Cache::put("geo:{$ip}", $result, 3600)`) is now restricted to successful, verified location results. Failed lookups or transient network errors are no longer cached for 1 hour, allowing subsequent retries to succeed once connectivity is restored.
- **Response Headers**: Added strict `Cache-Control: private, no-cache, no-store, must-revalidate` and `Vary: Authorization` headers on `GET /api/me/location` to ensure CDN or reverse proxy caches never leak one user's location/IP to another.
- **Removed Query IP Spoofing**: In `AuthController::visitorGeo()`, removed the client-supplied `?ip=` query override (mitigating SEC-05), resolving client IP strictly from connection and trusted headers.
- **Approximate Flag**: Added `'approximate' => true` to all location responses to accurately convey that location is IP-derived and does not access hardware GPS.

#### B. Redesigned User Header Location Widget
- **Compact 2-Level Trigger (`variant="user-header"`)**:
  - Replaced the large horizontal banner (`Flag Country · City · [bright green mono IP box]`) in `Navbar.jsx` with a compact, polished 2-level widget.
  - Small uppercase label on top: `Current location` (`text-[9px] font-semibold tracking-wider text-slate-400`).
  - Truncated primary text below: `City, Country` (e.g., `Dhaka, Bangladesh`) with width bounding (`max-w-[100px] sm:max-w-[140px] md:max-w-[170px]`) to prevent layout shifts or navbar wrapping.
  - Left indicator: Rounded icon box with country flag emoji or fallback pin icon.
  - Right indicator: Subtle chevron indicating clickable detail popover.
- **Accessible Detail Popover**:
  - Displays on click with backdrop blur, dark card styling, and subtle borders matching the SaaS theme.
  - Header: Connection Location title and accessible close button (`X`).
  - Country row: Flag emoji, full country name, and ISO-2 country code badge.
  - City / Region row: Displays detected city and region when available.
  - Public IP row: Monospace IP address box with a "Copy IP" action button (with "Copied!" confirmation feedback and clipboard fallback).
  - Truthful Disclaimer: Notice stating `"Approximate IP-based location. Physical GPS is not accessed."`
  - Accessibility: Full keyboard support (Escape key closes popover, click-outside closes popover, proper ARIA `dialog` attributes).
- **Non-Blocking & Stale-Data Management**:
  - In-memory session caching and in-flight promise deduplication ensure zero redundant network requests on route changes.
  - Dedicated `clearLocationCache()` exported and triggered on logout (`AuthContext::logout()`) so location data is instantly wiped when a session ends.
  - Calm fallback (`Location Unavailable`) renders cleanly without layout disruption or uncaught errors if third-party lookup fails.
  - Opt-in `variant="user-header"`: Admin layout (`AdminLayout.jsx`) and Moderator layout (`ModeratorLayout.jsx`) omit the variant prop and retain their existing layouts 100% untouched.

### 3. Verification & Test Outcomes
- **PHPUnit Feature Tests**: `cd public_html/api; php artisan test --filter=UserLocationTest` -> **6/6 passed**, 31 assertions.
- **Full Backend Test Suite**: `php artisan test` -> **190/190 passed**, 1,463 assertions, 0 failures.
- **Frontend Production Build**: `npm --prefix frontend run build` -> **1,948 modules transformed cleanly** in 6.78s; Vite bundle compiled into `public_html/assets/` and `public_html/index.html`.
- **Admin / Moderator Regressions**: Verified that `AdminLayout.jsx` and `ModeratorLayout.jsx` continue to render the default badge layout without any changes.
