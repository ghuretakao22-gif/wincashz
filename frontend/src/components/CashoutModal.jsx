import React, { useState } from 'react';
import { X, ShieldCheck, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function CashoutModal({ method, isOpen, onClose, onSuccess }) {
  const { user, refreshBalance } = useAuth();
  const [amount, setAmount] = useState(method?.min_amount || 5);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen || !method) return null;

  const userBalanceUSD = ((user?.balance ?? user?.points ?? 0) / 1000);
  const minRequired = method.min_amount || 5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (userBalanceUSD < amount) {
      setError(`Insufficient balance. You need at least $${amount} to cash out.`);
      return;
    }

    if (!address.trim()) {
      setError('Please provide a valid destination address or account email.');
      return;
    }

    setLoading(true);
    try {
      await api.submitWithdrawal({
        cashout_method_id: method.id,
        amount: Number(amount),
        account: address.trim(),
      });

      setSuccessMsg('Withdrawal request submitted successfully! Funds will arrive shortly.');
      await refreshBalance();
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [5, 10, 25, 50, 100];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl glass-card border border-white/10 shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center">
              {method.image_url ? (
                <img src={method.image_url} alt={method.name} className="w-full h-full object-contain" />
              ) : (
                <span className="font-bold text-lg text-brand-400">{method.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Withdraw via {method.name}</h3>
              <p className="text-xs text-slate-400">Min. ${minRequired} • Fast Processing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Preset Amounts */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Amount ($ USD)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {presetAmounts.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`py-2 rounded-xl font-bold text-sm transition-all ${
                    amount === val
                      ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {method.type === 'crypto'
                ? `${method.name} Wallet Address`
                : 'Account Email / Destination'}
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                method.type === 'crypto'
                  ? `Enter your ${method.name} address`
                  : 'Enter your email or account ID'
              }
              className="w-full px-4 py-3 rounded-xl glass-input text-sm"
            />
          </div>

          {/* Summary Box */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Your Balance:</span>
              <span className="font-semibold text-white">${userBalanceUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Withdraw Amount:</span>
              <span className="font-semibold text-brand-400">${Number(amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 pt-1 border-t border-white/5">
              <span>Remaining Balance:</span>
              <span className="font-semibold text-slate-300">
                ${Math.max(0, userBalanceUSD - amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading || userBalanceUSD < amount}
            className="w-full py-3.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Processing...' : `Confirm Cashout $${amount}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
