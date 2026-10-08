import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function LiveDropTicker() {
  const [drops, setDrops] = useState([]);

  const fetchTimeline = async () => {
    try {
      const res = await api.getTimeline();
      const list = res.timeline || res.rows || res.data || [];
      if (Array.isArray(list) && list.length > 0) {
        const formatted = list.slice(0, 15).map((item, idx) => {
          const user = item.userName || item.username || item.user_name || 'User';
          const coinsRaw = Number(item.currencyReward ?? item.reward ?? item.points ?? item.amount ?? 0);
          const coins = Math.round(coinsRaw >= 1 ? coinsRaw : coinsRaw * 1000);
          const offerName = item.offerName || item.offer_name || 'Offer Task';
          const provider = item.offerWallName || item.offerWall || item.offerwall_name || '';

          return {
            id: item.id || idx,
            user,
            coins,
            offerName,
            provider,
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
      if (e.detail && e.detail.user_name && e.detail.reward) {
        const newDrop = {
          id: Date.now(),
          user: e.detail.user_name,
          coins: Math.round(Number(e.detail.reward)),
          offerName: e.detail.offer_name || 'Offer Task',
          provider: e.detail.offer_wall_name || '',
        };
        setDrops(prev => [newDrop, ...prev.slice(0, 14)]);
      } else {
        fetchTimeline();
      }
    };

    window.addEventListener('wincashz-task-completed', handleTaskCompleted);
    const pollInterval = setInterval(fetchTimeline, 18000);

    return () => {
      window.removeEventListener('wincashz-task-completed', handleTaskCompleted);
      clearInterval(pollInterval);
    };
  }, []);

  const items = drops.length > 0 ? [...drops, ...drops] : [];

  return (
    <div className="w-full bg-[#080d14] border-y border-white/5 py-1.5 sm:py-2 overflow-hidden select-none z-30">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-4 flex items-center gap-3 overflow-hidden">
        {/* Live Badge */}
        <div className="flex items-center gap-1.5 shrink-0 bg-brand-500/10 border border-brand-500/30 rounded-full px-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-[10px] font-bold text-brand-400 tracking-wider uppercase">
            Live Activity
          </span>
        </div>

        {/* Continuous Smooth Marquee or Empty Fallback */}
        <div className="overflow-hidden flex-1 relative min-h-[20px] flex items-center">
          {drops.length === 0 ? (
            <span className="text-xs text-slate-500 font-medium italic">
              No recent activity recorded yet. Launch an offerwall below to earn coins!
            </span>
          ) : (
            <div className="animate-ticker flex items-center gap-4 whitespace-nowrap">
              {items.map((drop, idx) => (
                <div
                  key={`${drop.id}-${idx}`}
                  className="inline-flex items-center gap-2 text-xs text-slate-300 bg-white/[0.04] border border-white/5 px-3 py-1 rounded-full shrink-0"
                >
                  <span className="font-semibold text-white tracking-wide">{drop.user}</span>
                  <span className="font-extrabold text-brand-400">{drop.coins.toLocaleString()} coins</span>
                  <span className="text-slate-600 text-xs ml-1">•</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
