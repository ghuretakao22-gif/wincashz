import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import CurrentLocationBadge from './CurrentLocationBadge';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Users, 
  Wallet, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Megaphone, 
  ShieldCheck,
  ChevronRight,
  Sparkles,
  KeyRound,
  Globe,
  User
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorLayout() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Moderator metadata (My ID code & friendly name)
  const [myIdMeta, setMyIdMeta] = useState({
    code: user?.my_id || '',
    friendlyName: '',
  });

  // Live Broadcast Notice State
  const [notice, setNotice] = useState(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // Mobile Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Fetch moderator settings for My ID and friendly name
  useEffect(() => {
    let active = true;
    if (isAuthenticated && (user?.role === 'moderator' || user?.role === 'admin')) {
      api.getModeratorSettings()
        .then((res) => {
          if (!active) return;
          if (res?.data?.my_id) {
            setMyIdMeta({
              code: res.data.my_id.code || user?.my_id || '',
              friendlyName: res.data.my_id.friendly_name || '',
            });
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Fetch admin live notice for moderators
  useEffect(() => {
    let active = true;
    const fetchNotice = async () => {
      try {
        const res = await api.getModeratorNotice();
        if (!active) return;
        if (res && (res.status === 'success' || res.data)) {
          const data = res.data || res;
          if (data && data.enabled && (data.headline || data.text)) {
            setNotice(data);
            const isDismissed = localStorage.getItem(`wincashz_mod_notice_dismissed_${data.updated_at}`) === 'true';
            setNoticeDismissed(isDismissed);
          } else {
            setNotice(null);
          }
        }
      } catch (err) {
        // Silently catch error
      }
    };

    if (isAuthenticated && (user?.role === 'moderator' || user?.role === 'admin')) {
      fetchNotice();
      const interval = setInterval(fetchNotice, 30000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
  }, [isAuthenticated, user]);

  const handleDismissNotice = () => {
    if (notice?.updated_at) {
      try {
        localStorage.setItem(`wincashz_mod_notice_dismissed_${notice.updated_at}`, 'true');
      } catch (e) {}
    }
    setNoticeDismissed(true);
    setShowNoticeModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a0e] flex items-center justify-center text-brand-400 font-bold font-mono text-sm animate-pulse">
        Loading Moderator Portal...
      </div>
    );
  }

  // Route Guards: strictly for moderators (and admins in mod view)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'moderator' && user?.role !== 'admin') {
    return <Navigate to="/earn" replace />;
  }

  const navLinks = [
    { name: 'Dashboard', path: '/moderator/dashboard', match: ['/moderator', '/moderator/dashboard'], icon: LayoutDashboard },
    { name: 'Completed Offers', path: '/moderator/completed-offers', match: ['/moderator/completed-offers', '/moderator/my-earn'], icon: CheckCircle2 },
    { name: 'Users', path: '/moderator/users', match: ['/moderator/users'], icon: Users },
    { name: 'Payout', path: '/moderator/payout', match: ['/moderator/payout'], icon: Wallet },
    { name: 'Settings', path: '/moderator/settings', match: ['/moderator/settings'], icon: Settings },
  ];

  const isLinkActive = (link) => {
    return link.match.some(m => location.pathname === m || (m === '/moderator/dashboard' && location.pathname === '/moderator'));
  };

  const currentCode = myIdMeta.code || user?.my_id || 'UNASSIGNED';

  const handleLogout = async () => {
    setMobileDrawerOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-300">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0c1015]/95 backdrop-blur-md border-b border-white/5 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Hamburger + Platform Logo & Moderator Portal Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((prev) => !prev)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-colors shrink-0"
            title="Toggle Menu"
            aria-label="Toggle Moderator Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/moderator/dashboard" className="flex items-center gap-2 group min-w-0">
            <Logo size="small" className="shrink-0" />
            <span className="hidden sm:inline-block text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 text-brand-300 border border-brand-500/30 shrink-0">
              Moderator Portal
            </span>
          </Link>
        </div>

        {/* Center / Right: Location Badge, My ID Badge, Settings, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Current Location Badge */}
          <div className="hidden sm:block">
            <CurrentLocationBadge />
          </div>

          {/* My ID Badge & Friendly Name */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="text-slate-400 font-medium hidden sm:inline">My ID:</span>
              <span className="font-mono font-bold text-white tracking-wider bg-white/5 px-1.5 sm:px-2 py-0.5 rounded border border-white/5 text-[11px] sm:text-xs">
                {currentCode}
              </span>
            </div>
            {myIdMeta.friendlyName && (
              <span className="hidden md:inline-block text-[11px] text-brand-400 font-semibold pl-1.5 border-l border-white/10 truncate max-w-[140px]">
                {myIdMeta.friendlyName}
              </span>
            )}
          </div>

          {/* Quick Settings Icon (sm+) */}
          <Link
            to="/moderator/settings"
            className={`hidden sm:flex p-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              location.pathname === '/moderator/settings'
                ? 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Moderator Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="min-h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/25 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Body: Desktop Sidebar + Content */}
      <div className="flex-1 flex relative min-w-0">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex w-60 bg-[#0c1015]/80 border-r border-white/5 flex-col justify-between shrink-0 p-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <div className="space-y-5">
            {/* Nav Header Title */}
            <div className="px-2 pt-1 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                NAVIGATION
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/25">
                Live
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const active = isLinkActive(link);
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      active
                        ? 'bg-gradient-to-r from-brand-500 to-emerald-400 text-slate-950 font-bold shadow-glow-emerald'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-slate-400 group-hover:text-brand-400'}`} />
                      <span>{link.name}</span>
                    </div>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-slate-950" />}
                  </Link>
                );
              })}
            </nav>

            {/* Moderator Info Card */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Isolated Scope</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You are viewing activity and earnings solely generated under <span className="text-slate-300 font-mono font-semibold">{currentCode}</span>.
              </p>
            </div>
          </div>

          {/* User pill footer in sidebar */}
          <div className="pt-3 border-t border-white/5 flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/30 flex items-center justify-center font-black text-xs text-brand-300">
              {user?.username?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {user?.username || 'Moderator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email || 'Active Session'}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile / Tablet Slide-in Drawer (< lg) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-[55] lg:hidden flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer */}
            <aside className="relative z-[56] w-[85vw] max-w-[300px] bg-[#0c1015] border-r border-white/10 h-full flex flex-col shadow-2xl animate-slide-right">
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Logo size="small" />
                  <span className="text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded border border-brand-500/30">
                    Mod
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close Moderator Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* My ID pill & Location in mobile drawer */}
              <div className="p-4 border-b border-white/10 bg-[#0d131d]/70 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active My ID</div>
                    <div className="text-sm font-mono font-black text-brand-300 mt-0.5">{currentCode}</div>
                  </div>
                  <CurrentLocationBadge />
                </div>
                {myIdMeta.friendlyName && (
                  <div className="text-xs text-slate-300 font-medium">{myIdMeta.friendlyName}</div>
                )}
              </div>

              {/* Scrollable Navigation */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                <nav className="space-y-1">
                  {navLinks.map((link) => {
                    const active = isLinkActive(link);
                    return (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          active
                            ? 'bg-gradient-to-r from-brand-500 to-emerald-400 text-slate-950 font-bold shadow-glow-emerald'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-brand-400'}`} />
                          <span>{link.name}</span>
                        </div>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-slate-950" />}
                      </Link>
                    );
                  })}
                </nav>

                {user?.role === 'admin' && (
                  <div className="pt-3 border-t border-white/10 space-y-1">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Quick Switch
                    </p>
                    <Link
                      to="/admin"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Admin Panel</span>
                    </Link>
                    <Link
                      to="/earn"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-cyan-300 hover:bg-white/5"
                    >
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>Site / Earn</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Profile</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="p-4 border-t border-white/10 bg-[#090d14] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shrink-0">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Log Out</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-clip p-3 sm:p-6 lg:p-8 space-y-5 pb-24 lg:pb-8">
          {/* Moderator Live Notice Banner */}
          {notice && notice.enabled && !noticeDismissed && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone className="w-4 h-4 animate-bounce" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Live Notice
                    </span>
                    <h4 className="text-xs font-bold text-white truncate">
                      {notice.headline || 'Official Moderator Notice'}
                    </h4>
                  </div>
                  {notice.text && (
                    <p className="text-[11px] text-amber-200/90 mt-1 line-clamp-1">
                      {notice.text}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
                >
                  Read Full
                </button>
                <button
                  type="button"
                  onClick={handleDismissNotice}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Dismiss notice"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Notice Modal */}
          {showNoticeModal && notice && notice.enabled && (
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0e141d] border border-amber-500/30 rounded-3xl p-5 sm:p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4 animate-in fade-in zoom-in-95 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white leading-tight">
                        {notice.headline || 'Official Moderator Notice'}
                      </h3>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        Moderator Announcement
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNoticeModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {notice.text || 'No additional details provided.'}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-white/5">
                  <span className="text-[11px] text-slate-500">
                    {notice.updated_at ? `Updated: ${new Date(notice.updated_at).toLocaleString()}` : 'Admin Broadcast'}
                  </span>

                  <button
                    type="button"
                    onClick={handleDismissNotice}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-glow-emerald cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Got it / বুঝেছি</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar for easy one-hand navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c1015]/95 backdrop-blur-lg border-t border-white/10 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around">
        {navLinks.map((link) => {
          const active = isLinkActive(link);
          return (
            <Link
              key={link.name}
              to={link.path}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
                active
                  ? 'text-brand-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <link.icon className={`w-4 h-4 ${active ? 'text-brand-400' : 'text-slate-400'}`} />
              <span className="truncate max-w-[60px]">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
