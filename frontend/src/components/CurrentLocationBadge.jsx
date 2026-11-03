import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, ChevronDown, Copy, Check, X, Info } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Cache configuration
const FRESHNESS_TTL_MS = 15 * 60 * 1000;      // 15 minutes max freshness for valid location
const INITIAL_BACKOFF_MS = 30 * 1000;         // 30 seconds initial failure backoff
const MAX_BACKOFF_MS = 5 * 60 * 1000;         // 5 minutes maximum failure backoff
const REVALIDATION_THROTTLE_MS = 60 * 1000;  // Throttled revalidation on focus/online

// Session generation and in-flight tracking
let currentSessionGeneration = 0;
let activeRequestId = 0;
let inflightPromise = null;
let inflightAbortController = null;

// Session-scoped cache store (never stores authentication tokens)
const cacheStore = {
  userId: null,
  generation: 0,
  data: null,
  cachedAt: 0,
  consecutiveFailures: 0,
  nextRetryAllowedAt: 0,
  isAuthError: false,
};

/**
 * Invalidate session generation on logout and new authentication session.
 * Drops any pending responses and wipes session-specific location data.
 */
export function invalidateLocationSession() {
  currentSessionGeneration++;

  if (inflightAbortController) {
    try {
      inflightAbortController.abort();
    } catch (_) {}
    inflightAbortController = null;
  }

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

export function clearLocationCache() {
  invalidateLocationSession();
}

export default function CurrentLocationBadge({ className = '', variant = 'default' }) {
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  // Initial state derived from active session cache
  const [location, setLocation] = useState(() => {
    if (
      currentUserId &&
      cacheStore.userId === currentUserId &&
      cacheStore.generation === currentSessionGeneration &&
      cacheStore.data
    ) {
      const isFresh = Date.now() - cacheStore.cachedAt < FRESHNESS_TTL_MS;
      if (isFresh) return cacheStore.data;
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (!currentUserId) return false;
    if (
      cacheStore.userId === currentUserId &&
      cacheStore.generation === currentSessionGeneration &&
      cacheStore.data
    ) {
      return Date.now() - cacheStore.cachedAt >= FRESHNESS_TTL_MS;
    }
    return true;
  });

  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Core fetch routine with generation guards and failure backoff
  const fetchLocation = useCallback((force = false) => {
    if (!currentUserId) {
      setLocation(null);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const isCurrentSession =
      cacheStore.userId === currentUserId &&
      cacheStore.generation === currentSessionGeneration;

    // Check bounded freshness (15 minutes)
    if (!force && isCurrentSession && cacheStore.data) {
      const isFresh = now - cacheStore.cachedAt < FRESHNESS_TTL_MS;
      if (isFresh) {
        setLocation(cacheStore.data);
        setError(false);
        setLoading(false);
        return;
      }
    }

    // Check bounded failure backoff (30s initial, up to 5m)
    if (!force && isCurrentSession && cacheStore.nextRetryAllowedAt > now) {
      if (!cacheStore.data) {
        setError(true);
      }
      setLoading(false);
      return;
    }

    // Check auth error guard: do not retry automatically on 401/403
    if (isCurrentSession && cacheStore.isAuthError) {
      setLoading(false);
      return;
    }

    // Capture generation and request ID at time of dispatch
    const targetGeneration = currentSessionGeneration;
    const targetUserId = currentUserId;
    const thisRequestId = ++activeRequestId;

    // Deduplicate in-flight requests within the active session
    if (inflightPromise && isCurrentSession) {
      setLoading(true);
      inflightPromise.then((data) => {
        if (
          currentSessionGeneration !== targetGeneration ||
          currentUserId !== targetUserId
        ) {
          return;
        }
        if (data) {
          setLocation(data);
          setError(false);
        } else {
          setError(true);
        }
        setLoading(false);
      });
      return;
    }

    // Cancel previous in-flight request if present
    if (inflightAbortController) {
      try {
        inflightAbortController.abort();
      } catch (_) {}
    }
    const abortController =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    inflightAbortController = abortController;

    setLoading(true);

    const promise = api
      .getUserLocation({ signal: abortController?.signal })
      .then((data) => {
        // Guard 1: Drop response if session generation or user changed
        if (
          currentSessionGeneration !== targetGeneration ||
          currentUserId !== targetUserId
        ) {
          return null;
        }

        // Validate payload: must be valid location, not unknown
        if (data && (data.country || data.ip) && data.country !== 'Unknown') {
          cacheStore.userId = targetUserId;
          cacheStore.generation = targetGeneration;
          cacheStore.data = data;
          cacheStore.cachedAt = Date.now();
          cacheStore.consecutiveFailures = 0;
          cacheStore.nextRetryAllowedAt = 0;
          cacheStore.isAuthError = false;

          setLocation(data);
          setError(false);
          return data;
        }

        // Handle "Unknown" result as a transient failure with bounded backoff
        const failures = cacheStore.consecutiveFailures;
        const backoff = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, failures),
          MAX_BACKOFF_MS
        );
        cacheStore.userId = targetUserId;
        cacheStore.generation = targetGeneration;
        cacheStore.data = null;
        cacheStore.consecutiveFailures = failures + 1;
        cacheStore.nextRetryAllowedAt = Date.now() + backoff;

        setError(true);
        return null;
      })
      .catch((err) => {
        // Guard: Drop if session changed or aborted
        if (
          currentSessionGeneration !== targetGeneration ||
          currentUserId !== targetUserId
        ) {
          return null;
        }

        if (err?.name === 'AbortError') {
          return null;
        }

        const isAuth =
          err?.status === 401 ||
          err?.status === 403 ||
          err?.response?.status === 401 ||
          err?.response?.status === 403;

        const failures = cacheStore.consecutiveFailures;
        const backoff = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, failures),
          MAX_BACKOFF_MS
        );

        cacheStore.userId = targetUserId;
        cacheStore.generation = targetGeneration;
        cacheStore.consecutiveFailures = failures + 1;
        cacheStore.nextRetryAllowedAt = Date.now() + backoff;
        cacheStore.isAuthError = Boolean(isAuth);

        setError(true);
        return null;
      })
      .finally(() => {
        // Guard: An old request's finally MUST NOT clear a newer request's in-flight state
        if (
          activeRequestId === thisRequestId &&
          currentSessionGeneration === targetGeneration
        ) {
          inflightPromise = null;
          inflightAbortController = null;
          setLoading(false);
        }
      });

    inflightPromise = promise;
  }, [currentUserId]);

  // Trigger fetch on mount or user change
  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Throttled revalidation on focus / network reconnect
  useEffect(() => {
    let lastRevalidation = 0;

    const handleRevalidation = () => {
      const now = Date.now();
      if (now - lastRevalidation < REVALIDATION_THROTTLE_MS) return;

      if (cacheStore.data && now - cacheStore.cachedAt >= FRESHNESS_TTL_MS) {
        lastRevalidation = now;
        fetchLocation(true);
      }
    };

    window.addEventListener('focus', handleRevalidation);
    window.addEventListener('online', handleRevalidation);

    return () => {
      window.removeEventListener('focus', handleRevalidation);
      window.removeEventListener('online', handleRevalidation);
    };
  }, [fetchLocation]);

  // Click-outside and Escape key listener for accessible popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Focus close button on open
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyIp = async () => {
    if (!location?.ip) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(location.ip);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = location.ip;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy IP address', e);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  // -------------------------------------------------------------
  // USER-HEADER REDESIGNED VARIANT (MapPin Icon, No Emoji Flags)
  // -------------------------------------------------------------
  if (variant === 'user-header') {
    if (loading) {
      return (
        <div
          className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/[0.03] border border-white/5 animate-pulse min-w-[130px] sm:min-w-[160px] h-[38px] ${className}`}
          aria-hidden="true"
        >
          <div className="w-6 h-6 rounded-lg bg-white/10 shrink-0" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="w-14 h-2 rounded bg-white/10" />
            <div className="w-20 sm:w-24 h-2.5 rounded bg-white/10" />
          </div>
        </div>
      );
    }

    if (error || !location) {
      return (
        <div
          className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-left select-none text-slate-500 ${className}`}
          title="Location information currently unavailable"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.04] text-slate-400 shrink-0">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 leading-tight">
              Location
            </span>
            <span className="text-xs font-medium text-slate-400 leading-tight">
              Unavailable
            </span>
          </div>
        </div>
      );
    }

    const { country, city, region, ip, country_code } = location;
    const isLocal = country === 'Local' || city === 'Local';
    const mainDisplayText = isLocal
      ? 'Local / Network'
      : city && city !== country
        ? `${city}, ${country}`
        : country;

    return (
      <div className="relative inline-block" ref={popoverRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Current location: ${mainDisplayText}. Click for connection details.`}
          className={`group flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/10 hover:border-brand-500/30 text-left transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${className}`}
        >
          {/* Consistent SVG Location Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0 group-hover:scale-105 transition-transform">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
          </div>

          {/* 2-level text column with responsive truncation */}
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 leading-tight">
              Current location
            </span>
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[100px] sm:max-w-[140px] md:max-w-[170px] leading-tight">
              {mainDisplayText}
            </span>
          </div>

          {/* Subtle dropdown indicator */}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Accessible Popover */}
        {isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Current Location & Connection Details"
            className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0c1017]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-400" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Connection Location
                </span>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Country & Region Details */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Country</span>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" aria-hidden="true" />
                  <span>{country}</span>
                  {country_code && country_code !== '--' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      {country_code}
                    </span>
                  )}
                </div>
              </div>

              {(city || region) && city !== 'Local' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">City / Region</span>
                  <span className="font-medium text-slate-200 text-right truncate max-w-[170px]">
                    {[city, region].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {/* Monospace IP Address with Copy Button (Handles IPv4 & IPv6 safely) */}
              {ip && (
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>Public IP</span>
                    <button
                      type="button"
                      onClick={handleCopyIp}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-400 hover:text-brand-300 transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500/40 rounded px-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : copyFailed ? (
                        <span className="text-rose-400">Copy failed</span>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Copy IP</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                    <span className="font-mono text-xs text-brand-300 font-semibold select-all break-all">
                      {ip}
                    </span>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="pt-2 flex items-start gap-1.5 text-[11px] text-slate-400 leading-relaxed border-t border-white/5">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Approximate IP-based location. Physical GPS is not accessed.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEFAULT VARIANT (PRESERVES ADMIN AND MODERATOR APPEARANCE 100%)
  // -------------------------------------------------------------
  if (error) {
    return null;
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 animate-pulse ${className}`}>
        <div className="w-5 h-5 rounded-full bg-white/10" />
        <div className="w-20 sm:w-28 h-4 rounded bg-white/10" />
      </div>
    );
  }

  if (!location) {
    return null;
  }

  const { flag, country, city, ip } = location;

  return (
    <div
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-white/[0.06] to-white/[0.03] hover:from-white/[0.08] hover:to-white/[0.05] border border-white/10 shadow-sm text-sm sm:text-base font-bold text-white transition-all select-none ${className}`}
      title={`Current Location: ${country}${city ? ` · ${city}` : ''} (${ip})`}
    >
      {/* Flag Emoji */}
      <span className="text-base sm:text-lg leading-none shrink-0" role="img" aria-label={country}>
        {flag || '🌐'}
      </span>

      {/* Country */}
      <span className="font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-none">
        {country}
      </span>

      {/* City (hidden on small mobile screens) */}
      {city && city !== 'Local' && (
        <>
          <span className="hidden sm:inline text-slate-500 font-normal">·</span>
          <span className="hidden sm:inline font-semibold text-slate-300 text-xs sm:text-sm truncate max-w-[100px] lg:max-w-none">
            {city}
          </span>
        </>
      )}

      {/* IP in mono (hidden on small mobile screens) */}
      {ip && (
        <>
          <span className="hidden sm:inline text-slate-500 font-normal">·</span>
          <span className="hidden sm:inline font-mono font-medium text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 px-1.5 py-0.5 rounded">
            {ip}
          </span>
        </>
      )}
    </div>
  );
}
