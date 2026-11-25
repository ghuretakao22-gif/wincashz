import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import CurrentLocationBadge from './CurrentLocationBadge';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Wallet, 
  Users, 
  Settings, 
  ArrowLeft, 
  ShieldAlert, 
  Star,
  Layers,
  LogOut,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  Hash,
  Coins,
  Calendar,
  TrendingUp,
  Megaphone,
  CreditCard
} from 'lucide-react';

export default function AdminLayout() {
  const { user, isAuthenticated, isAdmin, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wincashz_admin_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Mobile drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('wincashz_admin_sidebar_collapsed', String(sidebarCollapsed));
    } catch (e) {}
  }, [sidebarCollapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a0e] flex items-center justify-center text-slate-400">
        Loading Admin System...
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Completed Offers', path: '/admin/completed-offers', icon: FileSpreadsheet, badge: '13-Col' },
    { name: 'Chargebacks', path: '/admin/chargebacks', icon: ShieldAlert, badge: 'Audit' },
    { name: 'Offerwalls', path: '/admin/offerwalls', icon: Layers, badge: 'Postback' },
    { name: 'Featured Walls', path: '/admin/featured', icon: Star },
    { name: 'Withdrawals', path: '/admin/withdrawals', icon: Wallet },
    { name: 'Site PIN', path: '/admin/pin', icon: KeyRound },
    { name: 'My IDs', path: '/admin/my-ids', icon: Hash },
    { name: 'My ID Overview', path: '/admin/my-id-overview', icon: TrendingUp },
    { name: 'Payout Rules', path: '/admin/payout-rules', icon: Coins },
    { name: 'My ID Payments', path: '/admin/my-id-payments', icon: CreditCard, badge: 'Payout' },
    { name: 'My ID Settings', path: '/admin/my-id-settings', icon: Calendar },
    { name: 'Moderator Notice', path: '/admin/moderator-notice', icon: Megaphone, badge: 'Live' },
    { name: 'Website Settings', path: '/admin/settings', icon: Settings },
  ];

  // Derive current page title for breadcrumb
  const currentLink = adminLinks.find(l => l.path === location.pathname) || { name: 'Admin Console' };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/admin');
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const handleLogout = async () => {
    setMobileDrawerOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0c1015]/95 backdrop-blur-md border-b border-white/5 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Controls: [ Mobile Hamburger ] [ Back ] [ Site / Earn ] [ Page Title / Breadcrumb ] */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile / Tablet Sidebar Drawer Toggle (< lg) */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((prev) => !prev)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-colors shrink-0"
            title="Toggle Admin Menu"
            aria-label="Toggle Admin Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Back Button (sm+) */}
          <button
            onClick={handleBack}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95 shadow-sm shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden md:inline">Back</span>
          </button>

          {/* Mobile Current Section Title */}
          <span className="lg:hidden text-xs sm:text-sm font-bold text-white truncate">
            {currentLink.name}
          </span>

          {/* Site / Earn Button */}
          <Link
            to="/earn"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-500/10 to-cyan-500/10 hover:from-brand-500/20 hover:to-cyan-500/20 text-brand-400 hover:text-brand-300 border border-brand-500/25 text-xs font-semibold transition-all active:scale-95 shrink-0"
            title="Open Public User Homepage / Earn Hub"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Site / Earn</span>
          </Link>

          {/* Desktop Breadcrumb Separator */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 pl-1">
            <span>/</span>
            <span className="font-semibold text-white flex items-center gap-1.5">
              {currentLink.name}
            </span>
          </div>
        </div>

        {/* Center / Right: [ Quick Site Link on xs ] [ Sidebar Toggle ] [ Admin Profile ] [ Log Out ] */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Quick Site / Earn shortcut on extra-small screens */}
          <Link
            to="/earn"
            className="sm:hidden min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/25 text-[11px] font-bold shrink-0"
            title="Site / Earn"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Earn</span>
          </Link>

          {/* Desktop Sidebar Collapse / Three-Dot Layout Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95 shadow-sm"
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

          {/* Current Location Badge (hidden on tiny xs to prevent header overflow, shown inside Drawer) */}
          <div className="hidden sm:block">
            <CurrentLocationBadge />
          </div>

          {/* Admin Profile Badge */}
          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/10">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                {user?.name || user?.username || 'Admin'}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold leading-tight uppercase tracking-wider">
                Administrator
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
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

      {/* Main Body with Dynamic Sidebar & Expandable Full-Width Content */}
      <div className="flex-1 flex relative min-w-0">
        {/* Desktop Sidebar (hidden on < lg) */}
        <aside
          className={`hidden lg:flex bg-background-surface border-r border-white/5 flex-col justify-between shrink-0 transition-all duration-300 ease-in-out ${
            sidebarCollapsed
              ? 'w-0 p-0 overflow-hidden border-0 opacity-0 pointer-events-none'
              : 'w-64 p-4 opacity-100'
          }`}
        >
          <div className="space-y-6">
            {/* Logo & Admin Badge */}
            <div className="px-2 pt-2 flex items-center justify-between">
              <Logo size="small" />
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                Console
              </span>
            </div>

            {/* Nav Links List */}
            <nav className="space-y-1">
              {adminLinks.map((link) => {
                const active = location.pathname === link.path;
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
                      <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
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
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile / Tablet Slide-Out Drawer Overlay (< lg) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-[55] flex lg:hidden">
            <div
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <aside className="relative z-[56] w-[85vw] max-w-[300px] h-full bg-[#0a0f17] border-r border-white/10 flex flex-col shadow-2xl">
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Logo size="small" />
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                    Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close Admin Menu"
                >
                  ✕
                </button>
              </div>

              {/* Admin Identity + Location */}
              <div className="px-4 py-3 border-b border-white/10 bg-[#0d131d]/70 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {user?.name || user?.username || 'Admin'}
                    </div>
                    <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                      Administrator
                    </div>
                  </div>
                </div>
                <CurrentLocationBadge />
              </div>

              {/* Scrollable Nav Links */}
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {adminLinks.map((link) => {
                  const active = location.pathname === link.path;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-brand-500 text-slate-950 font-bold shadow-glow-emerald'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <link.icon className={`w-4 h-4 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
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

              {/* Sticky Drawer Footer */}
              <div className="p-3.5 border-t border-white/10 bg-[#090d14] space-y-2 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] shrink-0">
                <Link
                  to="/earn"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/25"
                >
                  <Globe className="w-4 h-4" />
                  <span>Site / Earn Hub</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Log Out</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Full-Width Expandable Main Content Area */}
        <main
          className={`flex-1 min-w-0 p-3 sm:p-6 lg:p-8 overflow-y-auto overflow-x-clip transition-all duration-300 ${
            sidebarCollapsed ? 'w-full max-w-full' : 'max-w-7xl'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
