import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function PinGate({ purpose = 'Wincashz', onVerified, onAdminBypass, errorMessage = null }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorMessage);
  const inputRef = useRef(null);
  const verifyingRef = useRef(false);

  // Sync external error if it changes
  useEffect(() => {
    if (errorMessage) setError(errorMessage);
  }, [errorMessage]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verifyPin = async (code) => {
    if (verifyingRef.current || code.length !== 4) return;
    verifyingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await api.verifySitePin(code);
      if (res?.success) {
        onVerified();
      } else {
        setError(res?.message || 'Incorrect PIN. Please try again.');
        setPin('');
        verifyingRef.current = false;
        setLoading(false);
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err?.message || 'Incorrect PIN. Please try again.');
      setPin('');
      verifyingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleInputChange = (e) => {
    if (loading || verifyingRef.current) return;
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (error) setError(null);

    // Auto-verify as soon as exactly 4 digits are entered
    if (val.length === 4) {
      verifyPin(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin.length === 4 && !loading && !verifyingRef.current) {
      verifyPin(pin);
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
              Enter 4-digit code to access {purpose}
            </p>
          </div>

          {/* Small Error Message */}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                disabled={loading}
                placeholder="••••"
                value={pin}
                onChange={handleInputChange}
                className="w-full py-3.5 px-4 text-center font-mono text-2xl font-extrabold tracking-[0.7em] pl-[1em] rounded-2xl glass-input text-brand-400 border border-white/10 focus:border-brand-500/60 focus:outline-none placeholder:text-slate-600 placeholder:tracking-widest disabled:opacity-60"
              />
              <div className="h-5 mt-1.5 flex items-center justify-center">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-brand-400 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Auto-verifies on 4 digits
                  </span>
                )}
              </div>
            </div>
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
            ) : purpose === 'Sign Up' ? (
              <p className="text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-400 font-bold hover:underline">
                  Sign In
                </Link>
              </p>
            ) : null}

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
