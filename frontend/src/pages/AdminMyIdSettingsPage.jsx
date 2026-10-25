import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Power, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Coins, 
  Hash, 
  Globe 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminMyIdSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [usdBdtRate, setUsdBdtRate] = useState('122.00');
  const [msg, setMsg] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.getAdminMyIdSettings();
      if (res.success && res.data) {
        setSystemEnabled(!!res.data.my_id_system_enabled);
        setStartDate(res.data.my_id_start_date || '');
        setUsdBdtRate(String(res.data.my_id_usd_bdt_rate || '122.00'));
      }
    } catch (err) {
      console.error('Failed to load My ID settings:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to connect to backend My ID settings API.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg(null);

    const numericRate = parseFloat(usdBdtRate);
    if (isNaN(numericRate) || numericRate <= 0) {
      setMsg({ type: 'error', text: 'USD→BDT rate must be a valid positive number.' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateAdminMyIdSettings({
        my_id_system_enabled: systemEnabled,
        my_id_start_date: startDate.trim(),
        my_id_usd_bdt_rate: numericRate,
      });

      if (res.success) {
        setSystemEnabled(!!res.data.my_id_system_enabled);
        setStartDate(res.data.my_id_start_date || '');
        setUsdBdtRate(String(res.data.my_id_usd_bdt_rate));
        setMsg({ type: 'success', text: 'My ID system settings successfully saved!' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save My ID settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrentUtc = () => {
    const now = new Date();
    const utcStr = now.toISOString().replace('T', ' ').substring(0, 19);
    setStartDate(utcStr);
  };

  // Preview conversion
  const parsedRate = parseFloat(usdBdtRate) || 122.00;
  const exampleUsd = 0.70;
  const exampleBdt = (exampleUsd * parsedRate).toFixed(2);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">My ID System Settings</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global activation switch, completion start date filter, and USD→BDT currency conversion rate
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/my-ids"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
            <span>My IDs</span>
          </Link>

          <Link
            to="/admin/payout-rules"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Payout Rules</span>
          </Link>

          <button
            onClick={fetchSettings}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs border ${
          msg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-12 rounded-3xl border border-white/5 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-400" />
          <span>Loading Settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Activation Switch */}
          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-white block">1. My ID Earning System Switch</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  When turned OFF, no completed offers are eligible for My ID worker earnings.
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                systemEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {systemEnabled ? 'SYSTEM ACTIVE' : 'SYSTEM DISABLED'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Power className={`w-5 h-5 ${systemEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    {systemEnabled ? 'My ID Earnings Enabled' : 'My ID Earnings Paused'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Toggle to immediately activate or suspend earning calculations.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSystemEnabled(!systemEnabled)}
                className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer ${
                  systemEnabled ? 'bg-brand-500 shadow-glow-emerald' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-slate-950 transition-all ${
                    systemEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 2: Start Date */}
          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
            <div>
              <span className="text-sm font-bold text-white block">2. Earning Start Date Filter</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Completed tasks created before this timestamp are strictly excluded from My ID worker calculations.
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Start Date Timestamp (UTC: YYYY-MM-DD HH:MM:SS)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="e.g. 2026-11-01 00:00:00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-xs font-mono font-bold text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSetCurrentUtc}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                  title="Fill current UTC time"
                >
                  Set Now (UTC)
                </button>
                {startDate && (
                  <button
                    type="button"
                    onClick={() => setStartDate('')}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-xs text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Timezone Strategy Box */}
              <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2.5">
                <Globe className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>
                  <strong>Timezone Strategy:</strong> Backend normalizes and compares all timestamps in UTC (`completed_tasks.created_at &gt;= my_id_start_date`). No silent mixing of local time.
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Global USD to BDT Rate */}
          <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
            <div>
              <span className="text-sm font-bold text-white block">3. Global USD → BDT Conversion Rate</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Exchange rate applied when displaying worker earnings in Bangladeshi Taka (BDT).
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  1 USD = BDT (৳)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={usdBdtRate}
                    onChange={(e) => setUsdBdtRate(e.target.value)}
                    placeholder="e.g. 122.00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono font-bold text-emerald-400"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setUsdBdtRate('122.00')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300"
                  >
                    Set 122.00
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsdBdtRate('125.00')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300"
                  >
                    Set 125.00
                  </button>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Live Conversion Preview
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-sm text-slate-300">$0.70 USD</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-mono text-xl font-black text-amber-400">৳{exampleBdt} BDT</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Formula: $0.70 × {parsedRate.toFixed(2)} = ৳{exampleBdt}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 hover:brightness-110 text-slate-950 text-sm font-bold transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-slate-950" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
