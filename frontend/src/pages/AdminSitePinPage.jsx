import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, CheckCircle2, Trash2, Save, Info, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function AdminSitePinPage() {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('success');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminSitePin();
      setHasPin(!!res.has_pin);
    } catch (err) {
      setMessage(err.message || 'Failed to load PIN status.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (message) setMessage(null);
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (pin.length !== 4) {
      setMessage('PIN must be exactly 4 digits (0-9).');
      setMessageType('error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveAdminSitePin(pin);
      if (res.success) {
        setHasPin(true);
        setPin('');
        setMessage(res.message || 'Site PIN successfully saved and activated.');
        setMessageType('success');
      } else {
        setMessage(res.message || 'Failed to save PIN.');
        setMessageType('error');
      }
    } catch (err) {
      setMessage(err.message || 'Failed to save PIN.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePin = async () => {
    if (!window.confirm('Are you sure you want to delete the Site PIN? This will disable the PIN gate for all users.')) {
      return;
    }

    setDeleting(true);
    setMessage(null);
    try {
      const res = await api.deleteAdminSitePin();
      if (res.success) {
        setHasPin(false);
        setPin('');
        setMessage('Site PIN deleted. PIN gate is now disabled.');
        setMessageType('success');
      } else {
        setMessage(res.message || 'Failed to delete PIN.');
        setMessageType('error');
      }
    } catch (err) {
      setMessage(err.message || 'Failed to delete PIN.');
      setMessageType('error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Site Access PIN</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage the 4-digit gate protection for User Signup & Login
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center gap-3 ${
            messageType === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {messageType === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Status Card */}
      <div className="rounded-3xl glass-card border border-white/10 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Current Gate Status</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                hasPin ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-slate-500'
              }`}
            />
            <div>
              <div className="text-base font-bold text-white">
                {hasPin ? 'Gate ACTIVE (Protected)' : 'Gate DISABLED (Open)'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {hasPin
                  ? 'All users visiting /login or /register must enter the 4-digit PIN before proceeding.'
                  : 'Users can access /login and /register directly without PIN verification.'}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                hasPin
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
              }`}
            >
              {hasPin ? 'Protected' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Set / Change PIN Form */}
      <div className="rounded-3xl glass-card border border-white/10 p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-white">
            {hasPin ? 'Change Site PIN' : 'Set New 4-Digit Site PIN'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter a 4-digit numeric code. It will be securely hashed with Bcrypt on the server.
          </p>
        </div>

        <form onSubmit={handleSavePin} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              4-Digit PIN Code
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={handlePinChange}
              className="w-full py-3 px-4 font-mono text-xl tracking-[0.6em] text-center rounded-xl glass-input border border-white/10 focus:border-brand-500/60 focus:outline-none text-brand-400 placeholder:text-slate-600"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Only numbers (0-9). Example: 1234
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pin.length !== 4 || saving}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-glow-emerald"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : hasPin ? 'Update PIN' : 'Activate PIN Gate'}</span>
            </button>

            {hasPin && (
              <button
                type="button"
                onClick={handleDeletePin}
                disabled={deleting}
                className="py-3 px-4 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Deleting...' : 'Delete PIN'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Admin Safety & Recovery Info Card */}
      <div className="rounded-3xl bg-cyan-950/20 border border-cyan-500/20 p-5 space-y-2">
        <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
          <Info className="w-4 h-4 shrink-0" />
          <span>Admin Access & Emergency Recovery</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Administrators are never locked out. You can sign in directly via{' '}
          <code className="text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded font-mono">/admin/login</code> or by clicking the{' '}
          <strong className="text-white">Admin Login</strong> link on the user PIN gate.
          If non-admin users attempt to sign in through the admin portal, they are automatically rejected and redirected back to the PIN gate.
        </p>
      </div>
    </div>
  );
}
