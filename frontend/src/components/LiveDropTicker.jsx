import React, { useState, useEffect } from 'react';
import { Coins, Zap } from 'lucide-react';
import { api } from '../services/api';

export default function LiveDropTicker() {
  const [drops, setDrops] = useState([]);

  const fetchTimeline = async () => {
    try {
      const res = await api.getTimeline();
      const list = res.timeline || res.rows || res.data || [];
      if (Array.isArray(list) && list.length > 0) {
        const formatted = list.slice(0, 50).map((item, idx) => {
          const user = item.userName || item.username || item.user_name || 'Member';
          const coinsRaw = Number(item.currencyReward ?? item.reward ?? item.points ?? item.amount ?? 0);
          const coinsFormatted = coinsRaw % 1 === 0 ? coinsRaw.toLocaleString() : coinsRaw.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

          return {
            id: item.id || `drop-${idx}`,
            user,
            coins: coinsRaw,
            coinsDisplay: `${coinsFormatted} coins`,
          };
        });
        setDrops(formatted);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchTimeline();

    // Event listener for instant local postback completion
    const handleTaskCompleted = (e) => {
      if (e.detail && e.detail.user_name && (e.detail.reward !== undefined || e.detail.currency_reward !== undefined)) {
        const rawReward = Number(e.detail.reward ?? e.detail.currency_reward ?? 0);
        const coinsFormatted = rawReward % 1 === 0 ? rawReward.toLocaleString() : rawReward.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        const newDrop = {
          id: Date.now(),
          user: e.detail.user_name,
          coins: rawReward,
          coinsDisplay: `${coinsFormatted} coins`,
        };
        setDrops(prev => [newDrop, ...prev.slice(0, 49)]);
      } else {
        fetchTimeline();
      }
    };

    window.addEventListener('wincashz-task-completed', handleTaskCompleted);
    const pollInterval = setInterval(fetchTimeline, 20000);

    return () => {
      window.removeEventListener('wincashz-task-completed', handleTaskCompleted);
      clearInterval(pollInterval);
    };
  }, []);

  // Duplicate for seamless infinite marquee loop
  const items = drops.length > 0 ? [...drops, ...drops] : [];

  return (
    <div className="w-full bg-[#080d14]/90 backdrop-blur-md border-y border-white/[0.07] py-2 overflow-hidden select-none z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center gap-3.5 overflow-hidden">
        {/* Live Badge */}
        <div className="flex items-center gap-2 shrink-0 bg-brand-500/10 border border-brand-500/30 rounded-full px-3 py-1 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
          </span>
          <span className="text-[10.5px] font-extrabold text-brand-400 tracking-wider uppercase flex items-center gap-1">
            <Zap className="w-3 h-3 text-brand-400" />
            Live Activity
          </span>
        </div>

        {/* Continuous Smooth Marquee or Empty Fallback */}
        <div className="overflow-hidden flex-1 relative min-h-[26px] flex items-center">
          {drops.length === 0 ? (
            <span className="text-xs text-slate-500 font-medium italic">
              Live offer activity stream active. Completed rewards will appear here instantly!
            </span>
          ) : (
            <div className="animate-ticker flex items-center gap-3 whitespace-nowrap">
              {items.map((drop, idx) => {
                // Subtle visual variation based on reward size / index
                const isHighlight = drop.coins >= 100;
                return (
                  <div
                    key={`${drop.id}-${idx}`}
                    className={`inline-flex items-center gap-2 text-xs py-1 px-3 rounded-full shrink-0 transition-all hover:scale-105 duration-200 border cursor-default ${
                      isHighlight
                        ? 'bg-gradient-to-r from-brand-500/15 to-cyan-500/10 border-brand-500/30 text-white shadow-[0_0_12px_rgba(0,229,153,0.12)]'
                        : 'bg-[#101722]/90 border-white/10 text-slate-200 hover:border-brand-500/30 hover:bg-[#131b28]'
                    }`}
                  >
                    {/* User initial avatar */}
                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-slate-300">
                      {drop.user.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Username */}
                    <span className="font-semibold text-slate-100 tracking-wide">
                      {drop.user}
                    </span>

                    {/* Coins Badge */}
                    <span className="inline-flex items-center gap-1 font-extrabold text-brand-400 font-mono tracking-tight bg-brand-500/10 px-1.5 py-0.5 rounded-md border border-brand-500/20 text-[11px]">
                      <Coins className="w-3 h-3 text-amber-400 shrink-0" />
                      {drop.coinsDisplay}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
