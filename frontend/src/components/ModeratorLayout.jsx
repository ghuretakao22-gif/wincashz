import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
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
  KeyRound
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

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-300">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0c1015]/95 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Platform Logo & Moderator Portal Title */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/moderator/dashboard" className="flex items-center gap-2.5 group">
            <Logo size="small" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 text-brand-300 border border-brand-500/30">
                Moderator Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Right: My ID Badge, Friendly Name, Settings, Logout */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* My ID Badge & Friendly Name */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-slate-400 font-medium hidden sm:inline">My ID:</span>
              <span className="font-mono font-bold text-white tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {currentCode}
              </span>
            </div>
            {myIdMeta.friendlyName && (
              <span className="hidden md:inline-block text-[11px] text-brand-400 font-semibold pl-1.5 border-l border-white/10 truncate max-w-[140px]">
                {myIdMeta.friendlyName}
              </span>
            )}
          </div>

          {/* Quick Settings Icon */}
          <Link
            to="/moderator/settings"
            className={`p-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
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
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>

          {/* Mobile Hamburger Drawer Toggle */}
          <button
            onClick={() => setMobileDrawerOpen(prev => !prev)}
            className="md:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white border border-white/10"
            title="Toggle Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body: Desktop Sidebar + Content */}
      <div className="flex-1 flex relative">
        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex w-60 bg-[#0c1015]/80 border-r border-white/5 flex-col justify-between shrink-0 p-4 sticky top-[57px] h-[calc(100vh-57px)]">
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

        {/* Mobile Slide-in Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer */}
            <div className="relative w-72 bg-[#0c1015] border-r border-white/10 h-full p-4 flex flex-col justify-between z-10 shadow-2xl animate-slide-right">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Logo size="small" />
                    <span className="text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded border border-brand-500/30">
                      Portal
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* My ID pill in mobile drawer */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active My ID</div>
                  <div className="text-sm font-mono font-black text-brand-300 mt-0.5">{currentCode}</div>
                  {myIdMeta.friendlyName && (
                    <div className="text-xs text-slate-300 font-medium mt-0.5">{myIdMeta.friendlyName}</div>
                  )}
                </div>

                <nav className="space-y-1">
                  {navLinks.map((link) => {
                    const active = isLinkActive(link);
                    return (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          active
                            ? 'bg-gradient-to-r from-brand-500 to-emerald-400 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
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
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8 space-y-5 pb-20 md:pb-8">
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
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0e141d] border border-amber-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95 relative overflow-hidden">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1015]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 flex items-center justify-around">
        {navLinks.map((link) => {
          const active = isLinkActive(link);
          return (
            <Link
              key={link.name}
              to={link.path}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
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
