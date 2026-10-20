import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { Lock, AlertCircle, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../services/api';

export default function PinGate({ purpose = 'Sign In', onVerified, onAdminBypass, errorMessage = null }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorMessage);

  // Sync external error if it changes
  React.useEffect(() => {
    if (errorMessage) setError(errorMessage);
  }, [errorMessage]);

  const handleInputChange = (e) => {
    // Keep numeric digits only, max 4
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (pin.length !== 4) {
      setError('Please enter a 4-digit numeric PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifySitePin(pin);
      if (res.success) {
        onVerified();
      } else {
        setError(res.message || 'Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (err) {
      setError(err.message || 'Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-[#070a0e] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[260px] bg-brand-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand Logo */}
        <div className="text-center mb-6">
          <Logo size="large" />
          <p className="text-xs text-slate-400 mt-2">
            Protected Rewards Platform
          </p>
        </div>

        {/* PIN Entry Card */}
        <div className="rounded-3xl glass-card border border-white/10 p-6 sm:p-8 shadow-2xl space-y-5 text-center">
          <div className="space-y-1">
            <div className="w-11 h-11 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400 mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white">Site Access PIN</h1>
            <p className="text-xs text-slate-400">
              Enter the 4-digit PIN to continue to {purpose}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-center gap-1.5 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={pin}
                onChange={handleInputChange}
                className="w-full py-3.5 px-4 text-center font-mono text-2xl font-extrabold tracking-[0.7em] pl-[1em] rounded-2xl glass-input text-brand-400 border border-white/10 focus:border-brand-500/60 focus:outline-none placeholder:text-slate-600 placeholder:tracking-widest"
              />
              <p className="text-[10px] text-slate-500 mt-1.5">
                4-digit numeric code required
              </p>
            </div>

            <button
              type="submit"
              disabled={pin.length !== 4 || loading}
              className="w-full py-3 rounded-2xl text-xs font-bold text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Verifying PIN...' : `Continue to ${purpose}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Switch Link & Admin Recovery Option */}
          <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
            {purpose === 'Sign In' ? (
              <p className="text-slate-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-brand-400 font-bold hover:underline">
                  Sign Up
                </Link>
              </p>
            ) : (
              <p className="text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-400 font-bold hover:underline">
                  Sign In
                </Link>
              </p>
            )}

            {onAdminBypass && (
              <div>
                <button
                  type="button"
                  onClick={onAdminBypass}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Admin Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
