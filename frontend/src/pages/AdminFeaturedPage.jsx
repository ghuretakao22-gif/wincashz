import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Layers, 
  RefreshCw,
  Eye,
  Check,
  Zap,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminFeaturedPage() {
  const [offerwalls, setOfferwalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchWalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOfferwalls();
      const list = res.offerwalls || res.data || [];
      setOfferwalls(list);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to fetch offerwalls.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalls();

    const handleSync = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setOfferwalls(e.detail);
      }
    };
    window.addEventListener('wincashz-offerwalls-sync', handleSync);
    return () => window.removeEventListener('wincashz-offerwalls-sync', handleSync);
  }, [fetchWalls]);

  const handleToggleFeatured = async (id) => {
    const wall = offerwalls.find(w => String(w.id) === String(id));
    if (!wall) return;
    const newFeatured = !wall.is_featured;
    setOfferwalls(prev => prev.map(w => String(w.id) === String(id) ? { ...w, is_featured: newFeatured } : w));
    
    try {
      await api.updateOfferwall(id, { is_featured: newFeatured });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update featured state.' });
    }
  };

  const handlePositionChange = (id, val) => {
    const num = Math.max(1, parseInt(val) || 1);
    setOfferwalls((prev) =>
      prev.map((w) => (String(w.id) === String(id) ? { ...w, featured_position: num } : w))
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMsg(null);
    try {
      for (const wall of offerwalls) {
        await api.updateOfferwall(wall.id, {
          is_featured: Boolean(wall.is_featured),
          featured_position: Number(wall.featured_position || 1),
        });
      }
      setMsg({ type: 'success', text: 'Featured offerwalls order saved and persisted to database!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update featured walls order.' });
    } finally {
      setSaving(false);
    }
  };

  const featuredWalls = offerwalls
    .filter((w) => w.is_featured)
    .sort((a, b) => Number(a.featured_position || 99) - Number(b.featured_position || 99));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            Featured Offerwalls Curation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Select and rank verified providers to showcase in the high-visibility top section on the Earn page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWalls}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-brand-400 text-slate-950 font-bold text-xs shadow-glow-amber hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving Order...' : 'Save Featured Order'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fade-in ${
          msg.type === 'success' ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Featured Preview Grid */}
      <div className="rounded-3xl glass-card border border-amber-500/20 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Eye className="w-4 h-4 text-amber-400" />
            Live Preview: Earn Page Featured Carousel ({featuredWalls.length} Active)
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Sorted by numerical position</span>
        </div>

        {featuredWalls.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No offerwalls currently selected as featured. Toggle the star on any provider below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredWalls.map((wall, idx) => (
              <div
                key={wall.id}
                className="p-4 rounded-2xl bg-white/[0.03] border border-amber-500/30 relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-brand-400">
                      {wall.image_url ? (
                        <img src={wall.image_url} alt={wall.name} className="w-full h-full object-contain" />
                      ) : (
                        wall.icon || wall.name?.charAt(0) || '⭐'
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">{wall.name}</div>
                      <div className="text-[10px] text-slate-400">{wall.category || 'games'}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    Pos #{wall.featured_position || idx + 1}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                  {wall.description || wall.desc || 'Verified earning provider.'}
                </p>
                {wall.bonus_multiplier > 0 && (
                  <div className="mt-3 text-[10px] font-bold text-brand-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> +{wall.bonus_multiplier}% Bonus Rate Active
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offerwalls Curation List Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 select-none whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5 w-12 text-center">S.L</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Logo</th>
                <th className="py-2.5 px-3 border-r border-white/5">Provider Name</th>
                <th className="py-2.5 px-3 border-r border-white/5">Category</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Featured Status</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Featured Position</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">Bonus %</th>
                <th className="py-2.5 px-3 text-center">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {offerwalls.map((wall, index) => (
                <tr key={wall.id} className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap">
                  <td className="py-2.5 px-3 border-r border-white/5 text-center text-slate-500 font-sans">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 text-center">
                    <div className="w-7 h-7 mx-auto rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-brand-400 overflow-hidden">
                      {wall.image_url ? (
                        <img src={wall.image_url} alt={wall.name} className="w-full h-full object-contain" />
                      ) : (
                        wall.icon || wall.name?.charAt(0) || '⭐'
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 font-sans">
                    <div className="font-bold text-white">{wall.display_name || wall.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">/{wall.slug || wall.name?.toLowerCase()}</div>
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 font-sans">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 capitalize">
                      {wall.category || 'games'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 text-center font-sans">
                    <button
                      onClick={() => handleToggleFeatured(wall.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                        wall.is_featured
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${wall.is_featured ? 'fill-amber-300 text-amber-300' : ''}`} />
                      {wall.is_featured ? 'Featured' : 'Not Featured'}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 text-center">
                    <input
                      type="number"
                      min="1"
                      disabled={!wall.is_featured}
                      value={wall.featured_position || 1}
                      onChange={(e) => handlePositionChange(wall.id, e.target.value)}
                      className={`w-14 px-2 py-1 rounded-lg text-center font-bold font-mono transition-all ${
                        wall.is_featured
                          ? 'glass-input text-amber-300 border-amber-500/30'
                          : 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed'
                      }`}
                    />
                  </td>
                  <td className="py-2.5 px-3 border-r border-white/5 text-right font-bold text-brand-400 font-mono">
                    {wall.bonus_multiplier ? `+${wall.bonus_multiplier}%` : '0%'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <button
                      onClick={() => handleToggleFeatured(wall.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-semibold transition-colors"
                    >
                      {wall.is_featured ? 'Remove' : 'Feature Wall'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
