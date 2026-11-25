import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import CurrentLocationBadge from './CurrentLocationBadge';
import {
  X,
  Home,
  Coins,
  Wallet,
  Gift,
  User,
  ShieldCheck,
  Shield,
  LogOut,
  LogIn,
  Sparkles,
  Hash,
  ChevronRight,
} from 'lucide-react';

export default function MobileMenuDrawer({ isOpen, onClose }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-close drawer when route changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape key and lock background scroll while open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const points = Number(user?.balance ?? user?.points ?? 0);
  const dollarValue = (points / 1000).toFixed(2);
  const myIdCode = user?.my_id_code || user?.my_id || null;
  const isModeratorOnly = user?.role === 'moderator';

  const mainLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Earn / Offerwalls', path: '/earn', icon: Coins, highlight: true },
    { name: 'Cashout', path: '/cashout', icon: Wallet },
    { name: 'Rewards & Activity', path: '/dashboard', icon: Gift },
    { name: 'Profile / Settings', path: '/profile', icon: User },
  ];

  return (
    <div
      className={`md:hidden fixed inset-0 z-[55] transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Dark Backdrop Overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Slide-out Drawer Panel */}
      <aside
        className={`relative z-[56] h-full w-[85vw] max-w-[320px] bg-[#090e15]/98 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile navigation menu"
      >
        {/* Top Bar with Logo + Close */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
          <Logo size="small" />
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Header: User Card or Guest Auth */}
        <div className="p-4 border-b border-white/10 bg-[#0d131d]/70 shrink-0">
          {isAuthenticated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center text-slate-950 font-extrabold text-base shadow-glow-emerald shrink-0">
                  {(user?.username || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">
                      {user?.username || user?.name || 'Member'}
                    </p>
                    {myIdCode && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/30 text-[10px] font-bold text-brand-300 shrink-0">
                        <Hash className="w-2.5 h-2.5" />
                        {String(myIdCode).replace(/^#/, '')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {user?.email || 'Verified Member'}
                  </p>
                </div>
              </div>

              {/* Balance & Location Row */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Link
                  to="/cashout"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background-surface/90 border border-brand-500/25 hover:border-brand-400/50 transition-colors"
                >
                  <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[10px] font-extrabold text-slate-950">
                    $
                  </div>
                  <span className="text-xs font-extrabold text-white">
                    {points.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold text-brand-400">
                    (${dollarValue})
                  </span>
                </Link>

                <CurrentLocationBadge variant="user-header" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-white">Welcome to Wincashz</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sign in or create a free account to start earning instant rewards.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  onClick={onClose}
                  className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 text-xs font-extrabold shadow-glow-emerald transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Free</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Main Navigation */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Navigation
            </p>
            {mainLinks.map((link) => {
              const active = location.pathname === link.path;
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={onClose}
                  className={`min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-brand-400' : link.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{link.name}</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 ${active ? 'text-brand-400' : 'text-slate-600'}`} />
                </Link>
              );
            })}
          </div>

          {/* Management Section (Role-Aware) */}
          {(isAdmin || isModeratorOnly) && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-400/80 mb-2">
                Management
              </p>

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={onClose}
                  className={`min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 border-amber-500/25'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Admin Panel</span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Admin
                  </span>
                </Link>
              )}

              {isModeratorOnly && (
                <Link
                  to="/moderator/dashboard"
                  onClick={onClose}
                  className={`min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    location.pathname.startsWith('/moderator')
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15 border-cyan-500/25'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Moderator Panel</span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                    Mod
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sticky Drawer Footer */}
        {isAuthenticated && (
          <div className="p-4 border-t border-white/10 bg-[#090d14] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[48px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/30 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-sm font-bold transition-all"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
