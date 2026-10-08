import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ShieldAlert, 
  Wallet, 
  FileSpreadsheet, 
  Settings,
  Layers,
  Star,
  Zap,
  Activity,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompletedOffers: 0,
    todayCompletedOffers: 0,
    totalRevenueUsd: 0.00,
    todayRevenueUsd: 0.00,
    totalChargebackUsd: 0.00,
    todayChargebackUsd: 0.00,
    totalChargebacks: 0,
    netRevenueUsd: 0.00,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsAmount: 0.00,
    allWithdrawalsCount: 0,
    allWithdrawalsAmount: 0.00,
    activeOfferwalls: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMetrics = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const res = await api.getAdminDashboard();
      const summary = res?.summary || res?.stats || {};
      
      const totalUsers = Number(summary.totalUsers ?? 0);
      const totalCompletedOffers = Number(summary.totalCompletedOffers ?? 0);
      const todayCompletedOffers = Number(summary.todayCompletedOffers ?? 0);
      const totalRevenueUsd = Number(summary.totalRevenueUsd ?? 0);
      const todayRevenueUsd = Number(summary.todayRevenueUsd ?? 0);
      const totalChargebackUsd = Number(summary.totalChargebackUsd ?? 0);
      const todayChargebackUsd = Number(summary.todayChargebackUsd ?? 0);
      const totalChargebacks = Number(summary.totalChargebacks ?? 0);
      const netRevenueUsd = Number(summary.netRevenueUsd ?? (totalRevenueUsd - totalChargebackUsd));
      const pendingWithdrawalsCount = Number(summary.pendingWithdrawalsCount ?? 0);
      const pendingWithdrawalsAmount = Number(summary.pendingWithdrawalsAmount ?? 0);
      const allWithdrawalsCount = Number(summary.allWithdrawalsCount ?? 0);
      const allWithdrawalsAmount = Number(summary.allWithdrawalsAmount ?? 0);
      const activeOfferwalls = Number(summary.activeOfferwalls ?? 0);

      setStats({
        totalUsers,
        totalCompletedOffers,
        todayCompletedOffers,
        totalRevenueUsd,
        todayRevenueUsd,
        totalChargebackUsd,
        todayChargebackUsd,
        totalChargebacks,
        netRevenueUsd,
        pendingWithdrawalsCount,
        pendingWithdrawalsAmount,
        allWithdrawalsCount,
        allWithdrawalsAmount,
        activeOfferwalls,
      });
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to load admin dashboard summary:', e);
      if (!isBackground) {
        setError(e.message || 'Failed to connect to backend dashboard API.');
      }
    } finally {
      if (!isBackground) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics(false);

    // Live update every 30 seconds
    const interval = setInterval(() => {
      loadMetrics(true);
    }, 30000);

    // Refetch when window gains focus
    const onFocus = () => {
      loadMetrics(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMetrics(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadMetrics]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-brand-400" />
            Admin Summary Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform aggregate analytics calculated from live database records.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={() => loadMetrics(false)}
            disabled={loading || refreshing}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live DB Synced
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-200">Database Connection Error: </span>
              <span>{error}</span>
            </div>
          </div>
          <button onClick={() => loadMetrics(false)} className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* KPI Summary Cards - Interactive & Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
        {/* Total Users */}
        <Link
          to="/admin/users"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-brand-500/50 hover:shadow-glow-emerald cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registered Users</span>
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-white group-hover:text-brand-300 transition-colors">
              {loading ? '...' : stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">Full database registered member accounts</p>
          </div>
          <div className="text-[11px] font-semibold text-brand-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Open Users Table ({stats.totalUsers.toLocaleString()}) →
          </div>
        </Link>

        {/* Total Completed Offers */}
        <Link
          to="/admin/completed-offers"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-cyan-500/50 hover:shadow-glow-cyan cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Completed Offers</span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
              {loading ? '...' : stats.totalCompletedOffers.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.todayCompletedOffers > 0 ? (
                <span className="text-emerald-400 font-semibold">+{stats.todayCompletedOffers} today • </span>
              ) : null}
              All-time verified postback logs
            </p>
          </div>
          <div className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <Zap className="w-3.5 h-3.5" /> View Completed Offers Grid →
          </div>
        </Link>

        {/* Total Gross Revenue USD */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gross Revenue</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-emerald-400">
              {loading ? '...' : `$${stats.totalRevenueUsd.toFixed(2)} USD`}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.todayRevenueUsd > 0 ? (
                <span className="text-emerald-400 font-semibold">+${stats.todayRevenueUsd.toFixed(2)} earned today</span>
              ) : (
                'Cumulative provider payout received'
              )}
            </p>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <span className="text-emerald-400">●</span> Authoritative offerwall revenue sum
          </div>
        </div>

        {/* Total Chargebacks USD */}
        <Link
          to="/admin/chargebacks"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-rose-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Chargebacks</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-rose-400">
              {loading ? '...' : `$${stats.totalChargebackUsd.toFixed(2)} USD`}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.totalChargebacks} reversed fraud incident{stats.totalChargebacks === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <ShieldAlert className="w-3.5 h-3.5" /> View Reversal Log →
          </div>
        </Link>

        {/* Net Revenue USD */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Platform Revenue</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-indigo-300">
              {loading ? '...' : `$${stats.netRevenueUsd.toFixed(2)} USD`}
            </div>
            <p className="text-xs text-slate-400 mt-1">Gross Revenue minus Chargebacks</p>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <span className="text-indigo-400">●</span> Retained platform net profit
          </div>
        </div>

        {/* Pending Cashouts */}
        <Link
          to="/admin/withdrawals"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Cashouts</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-amber-400">
              {loading ? '...' : `$${stats.pendingWithdrawalsAmount.toFixed(2)}`}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.pendingWithdrawalsCount} payout request{stats.pendingWithdrawalsCount === 1 ? '' : 's'} awaiting approval
            </p>
          </div>
          <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <Wallet className="w-3.5 h-3.5" /> Manage Payouts →
          </div>
        </Link>
      </div>

      {/* Direct Module Navigation Grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Dedicated Administration Consoles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Offerwall Management */}
          <Link
            to="/admin/offerwalls"
            className="p-6 rounded-3xl glass-card hover:border-brand-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-brand-300">
                  Offerwalls & Postbacks
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add unlimited providers, configure auto postback URLs, and parameter mappings.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors shrink-0 mt-1" />
          </Link>

          {/* Featured Walls */}
          <Link
            to="/admin/featured"
            className="p-6 rounded-3xl glass-card hover:border-amber-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-amber-300">
                  Featured Walls Curation
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Reorder and pin top-performing offerwalls on the Earn page top carousel.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
          </Link>

          {/* Website Settings */}
          <Link
            to="/admin/settings"
            className="p-6 rounded-3xl glass-card hover:border-purple-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-purple-300">
                  Website Settings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage site branding, logo preview & URL, conversion economics, and domain.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors shrink-0 mt-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
