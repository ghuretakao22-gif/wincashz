import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Star } from 'lucide-react';

export default function ProviderCard({ wall, onOpen, isFeatured = false }) {
  const [imageError, setImageError] = useState(false);

  const imageUrl =
    wall?.logo_url ||
    wall?.offerWallLogo ||
    wall?.image_url ||
    wall?.banner_url ||
    wall?.background_url ||
    '';

  const categoryLabel = wall?.category || wall?.offerwallCategory || 'games';
  const displayName = wall?.display_name || wall?.name || wall?.offerWallName || 'Provider';
  const description =
    wall?.description ||
    wall?.desc ||
    'Complete offers and surveys for verified instant cash rewards.';

  const bonusMultiplier =
    wall?.bonus_multiplier && Number(wall.bonus_multiplier) > 0
      ? Number(wall.bonus_multiplier)
      : null;

  const minLevel = Number(wall?.min_level || wall?.unlock_level || wall?.unlockLevel || 1);

  return (
    <div
      onClick={() => onOpen && onOpen(wall)}
      className={`relative overflow-hidden rounded-3xl p-6 cursor-pointer flex flex-col justify-between group transition-all duration-300 ease-out select-none bg-[#0c1118] ${
        isFeatured
          ? 'border border-amber-500/35 hover:border-amber-400/70 hover:shadow-[0_12px_35px_-8px_rgba(245,158,11,0.22)]'
          : 'border border-white/[0.09] hover:border-emerald-400/50 hover:shadow-[0_12px_35px_-8px_rgba(0,229,153,0.18)]'
      } hover:-translate-y-1 shadow-xl min-h-[220px]`}
    >
      {/* Glow Edge Accents */}
      <div
        className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-500 pointer-events-none ${
          isFeatured ? 'group-hover:via-amber-400/70' : 'group-hover:via-emerald-400/70'
        }`}
      />
      <div
        className={`absolute left-0 top-1/6 bottom-1/6 w-[2.5px] rounded-r-full bg-gradient-to-b from-transparent to-transparent transition-all duration-500 pointer-events-none ${
          isFeatured
            ? 'via-amber-400/30 group-hover:via-amber-400/90'
            : 'via-emerald-400/30 group-hover:via-emerald-400/90'
        }`}
      />
      <div
        className={`absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl transition-all duration-500 pointer-events-none ${
          isFeatured
            ? 'bg-amber-500/10 group-hover:bg-amber-500/25'
            : 'bg-emerald-500/10 group-hover:bg-emerald-500/20'
        }`}
      />

      {/* Layer 1: Provider Image Full Card Visual */}
      {imageUrl && !imageError && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105 opacity-35 group-hover:opacity-45 filter saturate-[1.2]"
          />
        </div>
      )}

      {/* Layer 2: Dual Contrast Gradient Overlays for Guaranteed Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#080c12] via-[#0a0f16]/85 to-[#0d131d]/75 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080c12]/90 via-[#0a0f16]/65 to-transparent pointer-events-none" />

      {/* Layer 3: Interactive Content Hierarchy */}
      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        {/* Top Header Row */}
        <div>
          <div className="flex items-center justify-between gap-3">
            {/* Logo box */}
            <div
              className={`w-12 h-12 rounded-2xl bg-white/[0.08] backdrop-blur-md border p-2 flex items-center justify-center transition-all duration-300 shadow-md shrink-0 ${
                isFeatured
                  ? 'border-amber-500/30 group-hover:border-amber-400/60'
                  : 'border-white/15 group-hover:border-emerald-400/40'
              } group-hover:scale-105`}
            >
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={displayName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span
                  className={`font-bold text-lg ${
                    isFeatured ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {wall?.icon || displayName?.charAt(0) || '🎮'}
                </span>
              )}
            </div>

            {/* Badges / Multipliers */}
            <div className="flex flex-col items-end gap-1.5">
              {isFeatured && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-amber-300" /> TOP PICK
                </span>
              )}

              {bonusMultiplier ? (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isFeatured
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-glow-amber'
                      : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                  }`}
                >
                  +{bonusMultiplier}% Bonus
                </span>
              ) : (
                !isFeatured && (
                  <span className="text-[11px] font-semibold text-slate-300 capitalize bg-white/[0.08] backdrop-blur-sm border border-white/10 px-2.5 py-0.5 rounded-md">
                    {categoryLabel}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Provider Title & Description */}
          <div className="mt-4">
            <h3
              className={`font-extrabold text-lg sm:text-xl text-white tracking-tight transition-colors drop-shadow-sm line-clamp-1 ${
                isFeatured ? 'group-hover:text-amber-300' : 'group-hover:text-emerald-300'
              }`}
            >
              {displayName}
            </h3>
            <p className="text-xs text-slate-300/90 line-clamp-2 mt-1.5 leading-relaxed font-normal drop-shadow-sm">
              {description}
            </p>
          </div>
        </div>

        {/* Card Footer Row */}
        <div className="pt-3.5 border-t border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Verified</span>
            </span>

            {minLevel > 1 && (
              <span className="text-[11px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                Lvl {minLevel}
              </span>
            )}
          </div>

          {isFeatured ? (
            <button className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 group-hover:brightness-110 shadow-md transition-all">
              <span>Launch</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1 group-hover:translate-x-1 transition-all">
              <span>Open</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
