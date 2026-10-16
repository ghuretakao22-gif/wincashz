import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { 
  Users, 
  ArrowLeft, 
  Globe, 
  LogOut, 
  Menu, 
  X, 
  MoreVertical, 
  PanelLeftClose, 
  PanelLeftOpen, 
  ShieldCheck, 
  Layers,
  Coins
} from 'lucide-react';

export default function ModeratorLayout() {
  const { user, isAuthenticated, isModerator, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wincashz_moderator_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Mobile drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('wincashz_moderator_sidebar_collapsed', String(sidebarCollapsed));
    } catch (e) {}
  }, [sidebarCollapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a0e] flex items-center justify-center text-slate-400">
        Loading Moderator Portal...
      </div>
    );
  }

  if (!isAuthenticated || !isModerator) {
    return <Navigate to="/login" replace />;
  }

  const moderatorLinks = [
    { name: 'Wall User', path: '/moderator/users', icon: Users, badge: 'Live' },
  ];

  const currentLink = moderatorLinks.find(l => l.path === location.pathname) || { name: 'Wall User' };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/earn');
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0c1015]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left Controls: [ Back ] [ Homepage ] [ Breadcrumb ] */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95 shadow-sm"
            title="Go Back"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <Link
            to="/earn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-500/10 to-cyan-500/10 hover:from-brand-500/20 hover:to-cyan-500/20 text-brand-400 hover:text-brand-300 border border-brand-500/25 text-xs font-semibold transition-all active:scale-95"
            title="Open Homepage"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Homepage</span>
          </Link>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 pl-1">
            <span>/</span>
            <span className="font-semibold text-white flex items-center gap-1.5">
              {currentLink.name}
            </span>
          </div>
        </div>

        {/* Center / Right: [ Sidebar Toggle / Hamburger ] [ Profile Badge ] */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Sidebar Collapse Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95 shadow-sm"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Full-Width'}
          >
            <MoreVertical className="w-4 h-4 text-brand-400" />
            {sidebarCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-brand-400" />
                <span className="text-[11px]">Show Sidebar</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-slate-400" />
                <span className="text-[11px]">Full Width</span>
              </>
            )}
          </button>

          {/* Mobile Sidebar Drawer Toggle */}
          <button
            onClick={() => setMobileDrawerOpen(prev => !prev)}
            className="md:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white border border-white/10"
            title="Toggle Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Moderator Profile Badge */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
              {user?.username?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                {user?.username || user?.name || 'Moderator'}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold leading-tight uppercase tracking-wider">
                {user?.role === 'admin' ? 'Admin (Mod View)' : 'Moderator'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar & Content */}
      <div className="flex-1 flex relative">
        {/* Desktop Sidebar */}
        <aside
          className={`bg-[#0c1015]/80 border-r border-white/5 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out ${
            sidebarCollapsed
              ? 'w-0 p-0 overflow-hidden border-0 opacity-0 pointer-events-none'
              : 'w-64 p-4 opacity-100'
          }`}
        >
          <div className="space-y-6">
            {/* Logo & Moderator Panel Badge */}
            <div className="px-2 pt-2 flex items-center justify-between">
              <Logo size="small" />
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md">
                Read-Only
              </span>
            </div>

            {/* Sidebar Header Title */}
            <div className="px-2">
              <div className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                MODERATOR PANEL
              </div>
            </div>

            {/* Nav Links: ONLY Wall User */}
            <nav className="space-y-1">
              {moderatorLinks.map((link) => {
                const active = location.pathname === link.path || (location.pathname === '/moderator' && link.path === '/moderator/users');
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-brand-500 text-slate-950 shadow-glow-emerald font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-brand-400'}`} />
                      <span>{link.name}</span>
                    </div>
                    {link.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        active ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-brand-400'
                      }`}>
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Intentional Structured Information Card */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Monitoring Console</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Review real-time registered members, recent offerwall credits, and coin activity with zero write access.
              </p>
            </div>
          </div>

          {/* Bottom Sidebar Actions */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <Link
              to="/earn"
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>User Experience</span>
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
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
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <Logo size="small" />
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-[11px] font-black tracking-wider text-slate-400 uppercase px-2">
                  MODERATOR PANEL
                </div>

                <nav className="space-y-1">
                  {moderatorLinks.map((link) => {
                    const active = location.pathname === link.path || (location.pathname === '/moderator' && link.path === '/moderator/users');
                    return (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                          active
                            ? 'bg-brand-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-brand-400'}`} />
                          <span>{link.name}</span>
                        </div>
                        {link.badge && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            active ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-brand-400'
                          }`}>
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <Link
                  to="/earn"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>User Experience</span>
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
