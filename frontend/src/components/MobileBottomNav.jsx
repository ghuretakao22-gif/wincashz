import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Wallet, CircleDollarSign, Layers, Gift } from 'lucide-react';

export default function MobileBottomNav({ menuOpen, onOpenMenu }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isCashout = location.pathname === '/cashout';
  const isOffers = location.pathname === '/earn' && location.hash === '#offers-section';
  const isEarn = location.pathname === '/earn' && !isOffers;
  const isRewards = location.pathname === '/dashboard';

  const handleOffersClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/earn') {
      const el = document.getElementById('offers-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      navigate('/earn#offers-section', { replace: true });
    } else {
      navigate('/earn#offers-section');
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#090d14]/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_30px_rgba(0,0,0,0.6)]"
      aria-label="Mobile bottom navigation"
    >
      <div className="grid grid-cols-5 items-end max-w-md mx-auto px-1.5 pt-1.5 pb-1.5">
        {/* 1. Menu (Opens Drawer) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-all active:scale-95 ${
            menuOpen ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">Menu</span>
        </button>

        {/* 2. Cashout */}
        <Link
          to="/cashout"
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-all active:scale-95 ${
            isCashout ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className={`w-5 h-5 ${isCashout ? 'text-brand-400' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-tight">Cashout</span>
        </Link>

        {/* 3. Earn (Elevated Circular Center Highlight) */}
        <Link
          to="/earn"
          className="flex flex-col items-center justify-end min-h-[48px] pb-0.5 group"
          aria-label="Earn"
        >
          <div
            className={`-mt-6 w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,229,153,0.4)] border-2 transition-transform duration-200 group-active:scale-95 ${
              isEarn
                ? 'bg-gradient-to-tr from-brand-400 via-emerald-400 to-cyan-400 border-white/40 text-slate-950 scale-105'
                : 'bg-gradient-to-tr from-brand-500 to-emerald-400 border-[#090d14] text-slate-950'
            }`}
          >
            <CircleDollarSign className="w-6 h-6 stroke-[2.4]" />
          </div>
          <span
            className={`text-[10px] font-extrabold mt-1 tracking-tight ${
              isEarn ? 'text-brand-400' : 'text-slate-300'
            }`}
          >
            Earn
          </span>
        </Link>

        {/* 4. Offers */}
        <a
          href="/earn#offers-section"
          onClick={handleOffersClick}
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-all active:scale-95 ${
            isOffers ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className={`w-5 h-5 ${isOffers ? 'text-brand-400' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-tight">Offers</span>
        </a>

        {/* 5. Rewards */}
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-all active:scale-95 ${
            isRewards ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gift className={`w-5 h-5 ${isRewards ? 'text-brand-400' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-tight">Rewards</span>
        </Link>
      </div>
    </nav>
  );
}
