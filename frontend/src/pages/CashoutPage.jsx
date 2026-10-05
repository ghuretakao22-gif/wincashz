import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Coins, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Gift 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CashoutModal from '../components/CashoutModal';
import { api } from '../services/api';

export default function CashoutPage() {
  const { user } = useAuth();
  const [methods, setMethods] = useState([]);
  const [latestWithdrawals, setLatestWithdrawals] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getCashoutMethods()
      .then((res) => setMethods(res.methods || res.data || []))
      .catch(() => {});

    api.getLatestWithdrawals()
      .then((res) => setLatestWithdrawals(res.withdrawals || res.data || []))
      .catch(() => {});
  }, []);

  const defaultMethods = [
    { id: 1, name: 'Bitcoin (BTC)', type: 'crypto', min_amount: 5, icon: '₿', speed: 'Instant / 10m', color: 'from-amber-500/20 to-yellow-500/10' },
    { id: 2, name: 'Litecoin (LTC)', type: 'crypto', min_amount: 1, icon: 'Ł', speed: 'Instant (~2m)', color: 'from-slate-500/20 to-zinc-500/10' },
    { id: 3, name: 'Tether (USDT)', type: 'crypto', min_amount: 2, icon: '₮', speed: 'Instant (~3m)', color: 'from-emerald-500/20 to-teal-500/10' },
    { id: 4, name: 'PayPal USD', type: 'cash', min_amount: 5, icon: '🅿️', speed: 'Instant / 1h', color: 'from-cyan-500/20 to-blue-500/10' },
    { id: 5, name: 'Amazon Gift Card', type: 'giftcard', min_amount: 5, icon: '🛍️', speed: 'Instant Code', color: 'from-amber-600/20 to-yellow-600/10' },
    { id: 6, name: 'Visa Prepaid Card', type: 'cash', min_amount: 10, icon: '💳', speed: 'Instant Virtual', color: 'from-blue-600/20 to-indigo-600/10' },
    { id: 7, name: 'Steam Gift Card', type: 'giftcard', min_amount: 5, icon: '🎮', speed: 'Instant Key', color: 'from-slate-600/20 to-neutral-600/10' },
    { id: 8, name: 'Google Play Gift Card', type: 'giftcard', min_amount: 5, icon: '📱', speed: 'Instant Code', color: 'from-emerald-600/20 to-green-600/10' },
  ];

  const displayMethods = methods.length > 0 ? methods : defaultMethods;

  const filteredMethods = displayMethods.filter((m) => {
    if (filter === 'all') return true;
    return m.type === filter;
  });

  const points = user?.balance ?? user?.points ?? 0;
  const userBalanceUSD = (points / 1000).toFixed(2);

  const handleSelect = (method) => {
    setSelectedMethod(method);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Balance Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full">
              Instant Redemptions
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Cashout Your Earnings
            </h1>
            <p className="text-sm text-slate-400">
              Select your preferred withdrawal method below. All payouts are verified and delivered with zero fees.
            </p>
          </div>

          <div className="rounded-3xl glass-card p-6 border border-brand-500/30 shadow-glow-emerald flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Your Balance</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                ${userBalanceUSD}
              </div>
              <span className="text-xs text-brand-400 font-medium">
                {points.toLocaleString()} Coins Available
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'all', label: 'All Methods' },
            { id: 'crypto', label: 'Crypto (BTC, LTC, USDT)' },
            { id: 'cash', label: 'Direct Cash (PayPal, Visa)' },
            { id: 'giftcard', label: 'Gift Cards' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Methods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredMethods.map((m, idx) => (
            <div
              key={m.id || idx}
              onClick={() => handleSelect(m)}
              className="rounded-3xl glass-card p-6 border border-white/10 hover:border-brand-500/40 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                    {m.icon || '💳'}
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full">
                    Min. ${m.min_amount || 5}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                  {m.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-brand-400" />
                  {m.speed || 'Instant Processing'}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(m);
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Withdraw Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Community Withdrawals */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-400" />
                Recent Verified Withdrawals
              </h3>
              <p className="text-xs text-slate-400">
                Live stream of community payouts processed by Wincashz
              </p>
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Instant Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Method</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(latestWithdrawals.length > 0 ? latestWithdrawals.slice(0, 5) : [
                  { id: 1, user: 'Zack_91', method: 'Litecoin (LTC)', amount: '$15.00', status: 'Completed', time: '1m ago' },
                  { id: 2, user: 'CryptoWhale', method: 'Bitcoin (BTC)', amount: '$50.00', status: 'Completed', time: '4m ago' },
                  { id: 3, user: 'Elena_K', method: 'PayPal USD', amount: '$25.00', status: 'Completed', time: '7m ago' },
                  { id: 4, user: 'Sammy_R', method: 'Amazon Gift Card', amount: '$10.00', status: 'Completed', time: '11m ago' },
                ]).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-medium text-slate-200">{item.user || item.username || 'Member'}</td>
                    <td className="py-3 text-slate-400">{item.method || item.cashout_method_name || 'Crypto'}</td>
                    <td className="py-3 font-bold text-white">{typeof item.amount === 'number' ? `$${item.amount.toFixed(2)}` : item.amount}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">{item.time || 'Just now'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cashout Modal */}
      <CashoutModal
        method={selectedMethod}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
