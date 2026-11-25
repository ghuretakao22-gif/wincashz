import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import CurrentLocationBadge from './CurrentLocationBadge';
import {
  Coins,
  Wallet,
  Gift,
  User,
  LogOut,
  ShieldCheck,
  Shield,
  Bell,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const mobileAccountRef = useRef(null);
  const desktopUserRef = useRef(null);

  useEffect(() => {
    setUserDropdownOpen(false);
    setMobileAccountOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileAccountRef.current && !mobileAccountRef.current.contains(e.target)) {
        setMobileAccountOpen(false);
      }
      if (desktopUserRef.current && !desktopUserRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setMobileAccountOpen(false);
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Earn', path: '/earn', icon: Coins },
    { name: 'Cashout', path: '/cashout', icon: Wallet },
    { name: 'Rewards', path: '/dashboard', icon: Gift, authOnly: true },
  ];

  const points = Number(user?.balance ?? user?.points ?? 0);
  const dollarValue = (points / 1000).toFixed(2);
  const isModeratorOnly = user?.role === 'moderator';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5">
      {/* ==================== MOBILE STICKY TOP HEADER (md:hidden) ==================== */}
      <div className="md:hidden px-3 h-14 flex items-center justify-between gap-2">
        {/* Left: Compact Brand Logo */}
        <Logo size="small" className="shrink-0" />

        {/* Right: Auth / Balance / Quick Account Dropdown */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Tappable Balance Pill -> /cashout */}
            <Link
              to="/cashout"
              className="flex items-center gap-1.5 bg-background-surface/95 border border-brand-500/25 hover:border-brand-400/50 rounded-full px-2.5 py-1.5 shadow-inner active:scale-95 transition-all"
              aria-label="View balance and cashout"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[10px] font-extrabold text-slate-950 shrink-0">
                $
              </div>
              <span className="font-extrabold text-white text-xs">
                {points.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-brand-400">
                ${dollarValue}
              </span>
            </Link>

            {/* Compact User Avatar + Quick Account Dropdown */}
            <div className="relative" ref={mobileAccountRef}>
              <button
                type="button"
                onClick={() => setMobileAccountOpen((prev) => !prev)}
                className="min-w-[40px] min-h-[40px] flex items-center gap-1 p-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all"
                aria-label="Account menu"
                aria-expanded={mobileAccountOpen}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-500 to-cyan-500 flex items-center justify-center text-slate-950 font-extrabold text-xs shadow-sm">
                  {(user?.username || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${mobileAccountOpen ? 'rotate-180' : ''}`} />
              </button>

              {mobileAccountOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card bg-[#0b1018]/98 shadow-2xl py-2 z-50 border border-white/10">
                  <div className="px-4 py-2.5 border-b border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white truncate">
                        {user?.username || user?.name || 'Member'}
                      </p>
                      <CurrentLocationBadge variant="user-header" />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user?.email || ''}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setMobileAccountOpen(false)}
                      className="min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 active:bg-white/10"
                    >
                      <User className="w-4 h-4 text-cyan-400" />
                      <span>Profile</span>
                    </Link>

                    <Link
                      to="/dashboard"
                      onClick={() => setMobileAccountOpen(false)}
                      className="min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 active:bg-white/10"
                    >
                      <Gift className="w-4 h-4 text-brand-400" />
                      <span>Rewards</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileAccountOpen(false)}
                        className="min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-400/10 font-semibold"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    {isModeratorOnly && (
                      <Link
                        to="/moderator/dashboard"
                        onClick={() => setMobileAccountOpen(false)}
                        className="min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm text-cyan-400 hover:bg-cyan-400/10 font-semibold"
                      >
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Moderator Panel</span>
                      </Link>
                    )}
                  </div>

                  <div className="my-1 border-t border-white/10" />

                  <div className="px-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-sm font-bold border border-rose-500/25 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to="/login"
              className="min-h-[38px] inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 shadow-glow-emerald active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Sign Up</span>
            </Link>
          </div>
        )}
      </div>

      {/* ==================== DESKTOP HEADER (hidden md:block) ==================== */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo + Desktop Navigation Links */}
          <div className="flex items-center gap-8">
            <Logo />

            <nav className="flex items-center gap-2">
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
                <CurrentLocationBadge variant="user-header" />

                {/* Balance Display Pill */}
                <Link
                  to="/cashout"
                  className="flex items-center bg-background-surface/90 border border-brand-500/20 hover:border-brand-400/40 rounded-full px-3 py-1.5 shadow-inner transition-colors"
                >
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
                </Link>

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
                <div className="relative" ref={desktopUserRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-sm">
                      {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="text-sm font-medium text-slate-200 max-w-[100px] truncate">
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
                        Profile
                      </Link>

                      {isModeratorOnly && (
                        <Link
                          to="/moderator"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-400/10 font-medium"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          Moderator Panel
                        </Link>
                      )}

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

                {/* Desktop Sign Out Shortcut Button */}
                <button
                  onClick={handleLogout}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
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
          </div>
        </div>
      </div>
    </header>
  );
}
