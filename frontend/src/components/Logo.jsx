import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo({ size = 'default', showIcon = true, className = '' }) {
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 font-bold tracking-tight select-none group ${className}`}>
      {showIcon && (
        <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-cyan-500 shadow-glow-emerald transition-transform duration-300 group-hover:scale-105 ${
          isLarge ? 'w-11 h-11' : isSmall ? 'w-7 h-7' : 'w-9 h-9'
        }`}>
          {/* Diamond / Flash SVG Icon */}
          <svg
            className={`${isLarge ? 'w-6 h-6' : isSmall ? 'w-4 h-4' : 'w-5 h-5'} text-background`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L3 9L12 22L21 9L12 2Z" />
          </svg>
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      <div className="flex items-baseline">
        <span className={`font-extrabold bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent ${
          isLarge ? 'text-3xl' : isSmall ? 'text-lg' : 'text-2xl'
        }`}>
          Win
        </span>
        <span className={`font-bold text-white tracking-normal ${
          isLarge ? 'text-3xl' : isSmall ? 'text-lg' : 'text-2xl'
        }`}>
          cash
        </span>
        <span className={`font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] ${
          isLarge ? 'text-3xl' : isSmall ? 'text-lg' : 'text-2xl'
        }`}>
          z
        </span>
      </div>
    </Link>
  );
}
