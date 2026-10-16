import React from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { ShieldCheck, LogOut, Globe, ArrowLeft } from 'lucide-react';

export default function ModeratorLayout() {
  const { user, isAuthenticated, isModerator, logout, loading } = useAuth();
  const navigate = useNavigate();

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

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/earn');
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0c1015]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left Side: Back, Homepage, Branding */}
        <div className="flex items-center gap-3">
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
            <span className="hidden sm:inline">Homepage</span>
          </Link>

          <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

          <Logo />

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>MODERATOR PANEL — READ ONLY</span>
          </div>
        </div>

        {/* Right Side: Logged-in info and Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-white leading-tight">
              {user?.username || user?.name || 'Moderator'}
            </span>
            <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider">
              {user?.role === 'admin' ? 'Admin (Moderator View)' : 'Moderator'}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer Notice */}
      <footer className="py-4 border-t border-white/5 text-center text-slate-500 text-xs">
        Wincashz Moderator Console &bull; Read-Only User Lookup &bull; Strict Access Controls Active
      </footer>
    </div>
  );
}
