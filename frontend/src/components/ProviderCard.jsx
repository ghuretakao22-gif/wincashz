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

  const categoryLabel = wall?.category || wall?.offerwallCategory || 'Offers';
  const displayName = wall?.display_name || wall?.name || wall?.offerWallName || 'Provider';
  const description =
    wall?.description ||
    wall?.desc ||
    'Complete tasks, surveys, and app quests for verified instant cash rewards.';

  const bonusMultiplier =
    wall?.bonus_multiplier && Number(wall.bonus_multiplier) > 0
      ? Number(wall.bonus_multiplier)
      : null;

  const minLevel = Number(wall?.min_level || wall?.unlock_level || wall?.unlockLevel || 1);

  return (
    <div
      onClick={() => onOpen && onOpen(wall)}
      className={`relative overflow-hidden rounded-3xl cursor-pointer flex flex-col justify-between group transition-all duration-300 ease-out select-none bg-[#090d14] ${
        isFeatured
          ? 'border border-amber-500/30 hover:border-amber-400/70 hover:shadow-[0_12px_32px_-6px_rgba(245,158,11,0.22)]'
          : 'border border-white/[0.08] hover:border-emerald-400/50 hover:shadow-[0_12px_32px_-6px_rgba(0,229,153,0.18)]'
      } hover:-translate-y-1 shadow-xl p-3.5`}
    >
      {/* Subtle Hairline Edge Light */}
      <div
        className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-500 pointer-events-none ${
          isFeatured ? 'group-hover:via-amber-400/70' : 'group-hover:via-emerald-400/70'
        }`}
      />
      <div
        className={`absolute left-0 top-1/4 bottom-1/4 w-[2px] rounded-r-full bg-gradient-to-b from-transparent to-transparent transition-all duration-500 pointer-events-none ${
          isFeatured
            ? 'via-amber-400/30 group-hover:via-amber-400/80'
            : 'via-emerald-400/30 group-hover:via-emerald-400/80'
        }`}
      />

      {/* 1. CLEAN PROVIDER IMAGE AREA (Clearly Visible & Uncropped) */}
      <div className="relative w-full h-36 sm:h-40 rounded-2xl overflow-hidden bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] flex items-center justify-center p-4 group-hover:border-white/10 transition-colors">
        {/* Subtle Backdrop Illumination behind image */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${
            isFeatured
              ? 'bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08)_0%,transparent_70%)] group-hover:opacity-100'
              : 'bg-[radial-gradient(ellipse_at_center,rgba(0,229,153,0.06)_0%,transparent_70%)] group-hover:opacity-100'
          }`}
        />

        {/* Badges Overlay at Top of Image Area */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          {/* Category or Status Badge */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-[#090d14]/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg">
            {categoryLabel}
          </span>

          {/* Top Pick / Bonus Badge */}
          {isFeatured ? (
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/90 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-sans">
              <Star className="w-3 h-3 fill-slate-950" /> TOP PICK
            </span>
          ) : bonusMultiplier ? (
            <span className="text-[11px] font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
              +{bonusMultiplier}% BONUS
            </span>
          ) : null}
        </div>

        {/* The Clean, Centered, Uncropped Provider Visual */}
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={displayName}
            loading="lazy"
            onError={() => setImageError(true)}
            className="max-w-full max-h-full w-auto h-auto object-contain object-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1">
            <span
              className={`font-black text-3xl drop-shadow-md ${
                isFeatured ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {wall?.icon || displayName?.charAt(0) || '🎮'}
            </span>
            <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
              {displayName}
            </span>
          </div>
        )}
      </div>

      {/* 2. LOCALIZED CONTENT AREA (Provider Name, Description, Controls) */}
      <div className="pt-3.5 px-1.5 pb-1 flex flex-col justify-between space-y-3">
        {/* Title and Multiplier (if not featured) */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`font-extrabold text-base sm:text-lg text-white tracking-tight line-clamp-1 transition-colors ${
                isFeatured ? 'group-hover:text-amber-300' : 'group-hover:text-emerald-300'
              }`}
            >
              {displayName}
            </h3>

            {isFeatured && bonusMultiplier && (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                +{bonusMultiplier}%
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed font-normal">
            {description}
          </p>
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verified</span>
            </span>

            {minLevel > 1 && (
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
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
