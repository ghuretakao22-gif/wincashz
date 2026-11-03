import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function CurrentLocationBadge({ className = '' }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getUserLocation()
      .then((data) => {
        if (!mounted) return;
        if (data && data.country && data.country !== 'Unknown') {
          setLocation(data);
        } else if (data && data.ip) {
          setLocation(data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
