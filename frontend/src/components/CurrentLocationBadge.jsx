import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Copy, Check, X, Info } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

// In-memory session cache and deduplication to prevent refetching on route changes
let cachedLocation = null;
let cachedUserId = null;
let inflightPromise = null;

export function clearLocationCache() {
  cachedLocation = null;
  cachedUserId = null;
  inflightPromise = null;
}

export default function CurrentLocationBadge({ className = '', variant = 'default' }) {
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const [location, setLocation] = useState(() => cachedUserId === currentUserId ? cachedLocation : null);
  const [loading, setLoading] = useState(() => !(cachedUserId === currentUserId && cachedLocation));
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!currentUserId) {
      clearLocationCache();
      setLocation(null);
      setLoading(false);
      return;
    }

    if (cachedUserId === currentUserId && cachedLocation) {
      setLocation(cachedLocation);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    if (!inflightPromise || cachedUserId !== currentUserId) {
      cachedUserId = currentUserId;
      inflightPromise = api.getUserLocation()
        .then((data) => {
          if (data && (data.country || data.ip)) {
            cachedLocation = data;
            return data;
          }
          cachedLocation = null;
          return null;
        })
        .catch((err) => {
          console.warn('Location lookup failed:', err);
          return null;
        })
        .finally(() => {
          inflightPromise = null;
        });
    }

    inflightPromise.then((data) => {
      if (!mounted) return;
      if (data) {
        setLocation(data);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  // Click-outside and Escape key listener for accessible popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

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
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy IP address', e);
    }
  };

  // -------------------------------------------------------------
  // USER-HEADER REDESIGNED VARIANT
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
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.04] text-slate-400 shrink-0 text-xs">
            📍
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

    const { flag, country, city, region, ip, country_code } = location;
    const isLocal = country === 'Local' || city === 'Local';
    const mainDisplayText = isLocal
      ? 'Local / Network'
      : city && city !== country
        ? `${city}, ${country}`
        : country;

    return (
      <div className="relative inline-block" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`Current location: ${mainDisplayText}. Click for connection details.`}
          className={`group flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/10 hover:border-brand-500/30 text-left transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${className}`}
        >
          {/* Flag / Location icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.06] border border-white/10 text-sm shrink-0 group-hover:scale-105 transition-transform">
            <span role="img" aria-label={country}>
              {flag || '📍'}
            </span>
          </div>

          {/* 2-level text column */}
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
                <MapPin className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Connection Location
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Country & Region Details */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Country</span>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <span role="img" aria-label={country}>{flag || '🌐'}</span>
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

              {/* Monospace IP Address with Copy Button */}
              {ip && (
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>Public IP</span>
                    <button
                      type="button"
                      onClick={handleCopyIp}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy IP</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                    <span className="font-mono text-xs text-brand-300 font-semibold truncate select-all">
                      {ip}
                    </span>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="pt-2 flex items-start gap-1.5 text-[11px] text-slate-400 leading-relaxed border-t border-white/5">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
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
