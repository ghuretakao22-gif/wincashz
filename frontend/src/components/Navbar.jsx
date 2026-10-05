import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { 
  Coins, 
  Wallet, 
  Gift, 
  User, 
  LogOut, 
  ShieldCheck, 
  Menu, 
  X, 
  Bell, 
  ChevronDown,
  Sparkles,
  Flame
} from 'lucide-react';
import { api } from '../services/api';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      api.getNotifications()
        .then((res) => {
          const list = res.notifications || res.data || [];
          setNotifications(list);
          const unread = list.filter((n) => !n.read_at).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, location.pathname]);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const navLinks = [
    { name: 'Earn', path: '/earn', icon: Coins },
    { name: 'Cashout', path: '/cashout', icon: Wallet },
    { name: 'Rewards', path: '/dashboard', icon: Gift, authOnly: true },
  ];

  const points = user?.balance ?? user?.points ?? 0;
  const dollarValue = (points / 1000).toFixed(2);

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Logo />

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => {
                if (link.authOnly && !isAuthenticated) return null;
                const active = location.pathname === link.path;
                const isEarn = link.name === 'Earn';
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? isEarn
                          ? 'bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 font-bold shadow-glow-emerald'
                          : 'bg-white/10 text-white shadow-sm'
                        : isEarn
                          ? 'bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 border border-brand-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <link.icon className={`w-4 h-4 ${active && isEarn ? 'text-slate-950' : isEarn ? 'text-brand-400' : active ? 'text-brand-400' : 'text-slate-400'}`} />
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Balance Display Pill */}
                <div className="flex items-center bg-background-surface/90 border border-brand-500/20 rounded-full px-3 py-1.5 shadow-inner">
                  <div className="flex items-center gap-1.5 mr-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[11px] font-bold text-slate-950 shadow-sm">
                      $
                    </div>
                    <span className="font-bold text-white text-sm">
                      {points.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">coins</span>
                  </div>
                  <div className="h-4 w-px bg-white/10" />
                  <span className="text-xs font-semibold text-brand-400 ml-2">
                    ${dollarValue}
                  </span>
                </div>

                {/* Notifications Icon */}
                <div className="relative">
                  <button
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors relative"
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-brand-400 rounded-full animate-pulse" />
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-card shadow-2xl p-4 z-50 border border-white/10">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                        <span className="font-semibold text-sm text-white">Notifications</span>
                        <span className="text-xs text-brand-400">{unreadCount} new</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">No notifications yet.</p>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="p-2 rounded-lg bg-white/5 text-xs text-slate-300">
                              <p className="font-medium text-white">{n.title || 'Notification'}</p>
                              <p className="text-slate-400 mt-0.5">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-sm">
                      {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-slate-200 max-w-[100px] truncate">
                      {user?.username || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-card shadow-2xl py-2 z-50 border border-white/10">
                      <div className="px-4 py-2 border-b border-white/10">
                        <p className="text-xs text-slate-400">Signed in as</p>
                        <p className="text-sm font-semibold text-white truncate">{user?.email}</p>
                      </div>

                      <Link
                        to="/dashboard"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 hover:text-white"
                      >
                        <Gift className="w-4 h-4 text-brand-400" />
                        Dashboard
                      </Link>

                      <Link
                        to="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 hover:text-white"
                      >
                        <User className="w-4 h-4 text-cyan-400" />
                        Profile Settings
                      </Link>

                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-400/10 font-medium"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          Admin Console
                        </Link>
                      )}

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="relative inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-slate-950" />
                  Sign Up Free
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 space-y-2">
            {navLinks.map((link) => {
              if (link.authOnly && !isAuthenticated) return null;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-slate-200 hover:bg-white/5 active:bg-white/10 min-h-[44px]"
                >
                  <link.icon className="w-5 h-5 text-brand-400" />
                  {link.name}
                </Link>
              );
            })}
            {!isAuthenticated && (
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 active:bg-white/20 min-h-[44px] flex items-center justify-center"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 active:brightness-110 min-h-[44px] flex items-center justify-center"
                >
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Fixed, Safe Area Inset Supported) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d13]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] shadow-2xl">
        <div className="grid grid-cols-4 items-center justify-items-center max-w-md mx-auto">
          {/* 1. Earn (Primary Highlight) */}
          <Link
            to="/earn"
            className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all min-h-[44px] ${
              location.pathname === '/earn' || location.pathname === '/'
                ? 'text-brand-400 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${location.pathname === '/earn' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : ''}`}>
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight">Earn</span>
          </Link>

          {/* 2. Rewards / Dashboard */}
          <Link
            to="/dashboard"
            className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all min-h-[44px] ${
              location.pathname === '/dashboard'
                ? 'text-brand-400 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${location.pathname === '/dashboard' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : ''}`}>
              <Gift className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight">Rewards</span>
          </Link>

          {/* 3. Cashout */}
          <Link
            to="/cashout"
            className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all min-h-[44px] ${
              location.pathname === '/cashout'
                ? 'text-amber-400 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${location.pathname === '/cashout' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : ''}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight">Cashout</span>
          </Link>

          {/* 4. Profile / Account */}
          <Link
            to={isAuthenticated ? '/profile' : '/login'}
            className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all min-h-[44px] ${
              location.pathname === '/profile' || location.pathname === '/login'
                ? 'text-cyan-400 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${location.pathname === '/profile' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : ''}`}>
              <User className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tight">{isAuthenticated ? 'Profile' : 'Sign In'}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
