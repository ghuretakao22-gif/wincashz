import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, 
  Search, 
  Gamepad2, 
  FileSpreadsheet, 
  Smartphone, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Star,
  Layers,
  Lock
} from 'lucide-react';
import OfferwallModal from '../components/OfferwallModal';
import ProviderCard from '../components/ProviderCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function EarnPage() {
  const { user } = useAuth();
  const [offerwalls, setOfferwalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOfferwall, setSelectedOfferwall] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchWalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOfferwalls();
      const list = res.offerwalls || res.rows || res.data || [];
      setOfferwalls(list);
    } catch (err) {
      console.error('Failed to load offerwalls for earn page:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalls();

    // Auto-sync listener for real-time reflection of admin changes
    const handleSync = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setOfferwalls(e.detail);
      } else {
        fetchWalls();
      }
    };
    window.addEventListener('wincashz-offerwalls-sync', handleSync);
    return () => window.removeEventListener('wincashz-offerwalls-sync', handleSync);
  }, [fetchWalls]);

  // Filter active walls only, sorted strictly by numeric position / sort_order
  const activeWalls = offerwalls
    .filter((w) => w.status !== false && w.status !== 0 && w.status !== 'inactive')
    .sort((a, b) => Number(a.sort_order || a.position || 999) - Number(b.sort_order || b.position || 999));

  // Featured Top Picks
  const featuredWalls = activeWalls
    .filter((w) => w.is_featured === true || w.is_featured === 1 || w.featured === true || w.featured === 1)
    .sort((a, b) => Number(a.featured_position || a.sort_order || 999) - Number(b.featured_position || b.sort_order || 999));

  // Category and Search Filtering
  const filteredWalls = activeWalls.filter((w) => {
    const matchesCat = category === 'all' || (w.category && w.category.toLowerCase().includes(category));
    const matchesSearch = (w.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (w.display_name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (w.description || w.desc || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpen = (wall) => {
    const userLevel = Number(user?.level || 1);
    const reqLevel = Number(wall.min_level || 1);
    if (user && userLevel < reqLevel) {
      alert(`⚠️ Level Requirement: This provider requires Level ${reqLevel}. You are currently Level ${userLevel}. Complete other tasks to level up!`);
      return;
    }
    setSelectedOfferwall(wall);
    setModalOpen(true);
  };

  const categories = [
    { id: 'all', label: 'All Providers', icon: Sparkles },
    { id: 'games', label: 'Gaming Quests', icon: Gamepad2 },
    { id: 'surveys', label: 'Surveys', icon: FileSpreadsheet },
    { id: 'apps', label: 'Mobile Apps', icon: Smartphone },
    { id: 'tasks', label: 'Micro Tasks', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 py-6 sm:py-10 selection:bg-brand-500/30 selection:text-brand-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Banner */}
        <div className="rounded-3xl glass-card p-6 sm:p-10 border border-brand-500/20 shadow-glow-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Wincashz Earning Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Explore Verified Offerwalls
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Pick any partner provider below to access thousands of live offers, gaming quests, and high-paying surveys. Completed tasks are verified and credited automatically.
            </p>
          </div>
        </div>

        {/* Featured Providers & Top Picks Section */}
        {category === 'all' && !search && featuredWalls.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Featured Providers & Top Picks
                </h2>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Highest Payouts
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {featuredWalls.length} Promoted Providers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredWalls.map((wall, idx) => (
                <ProviderCard
                  key={`featured-${wall.id || idx}`}
                  wall={wall}
                  onOpen={handleOpen}
                  isFeatured={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-3xl glass-card border border-white/10">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {categories.map((cat) => {
              const active = category === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 shadow-glow-emerald scale-[1.02]'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search providers or games..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl glass-input text-xs"
            />
          </div>
        </div>

        {/* All Active Offerwalls Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-400" />
              <span>Available Providers ({filteredWalls.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              Loading verified offerwalls...
            </div>
          ) : filteredWalls.length === 0 ? (
            <div className="py-20 text-center text-slate-400 glass-card rounded-3xl border border-white/10 space-y-2">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-bold text-white text-base">No active offerwalls found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No providers match your current filter or category. Try clearing search or check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWalls.map((wall, idx) => (
                <ProviderCard
                  key={wall.id || idx}
                  wall={wall}
                  onOpen={handleOpen}
                  isFeatured={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offerwall Modal */}
      {selectedOfferwall && (
        <OfferwallModal
          offerwall={selectedOfferwall}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedOfferwall(null);
          }}
        />
      )}
    </div>
  );
}
