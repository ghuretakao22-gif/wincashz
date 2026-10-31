import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Returns current UTC YYYY-MM
 */
const getCurrentUtcYearMonth = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/**
 * Returns UTC YYYY-MM shifted by month offset
 */
const getAdjacentMonth = (yearMonthStr, offset) => {
  let ym = yearMonthStr;
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    ym = getCurrentUtcYearMonth();
  }
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const newY = d.getUTCFullYear();
  const newM = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

/**
 * Formats YYYY-MM to human readable (e.g. October 2026)
 */
const formatUtcMonthLabel = (yearMonthStr) => {
  if (!yearMonthStr || !/^\d{4}-\d{2}$/.test(yearMonthStr)) return '';
  const [y, m] = yearMonthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

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

  // Period filter state: 'this_month' (default) | 'last_month' | 'all_time' | 'custom'
  const [period, setPeriod] = useState('this_month');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentUtcYearMonth());
  const [periodMeta, setPeriodMeta] = useState({
    period: 'this_month',
    month_label: '',
    range_start: null,
    range_end: null,
    range_text: '',
    range_start_formatted: '',
    range_end_formatted: '',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMetrics = useCallback(async (isBackground = false, targetPeriod = period, targetMonth = selectedMonth) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const params = {};
      if (targetPeriod === 'all_time') {
        params.period = 'all_time';
      } else if (targetPeriod === 'this_month') {
        params.period = 'this_month';
        if (targetMonth) params.month = targetMonth;
      } else if (targetPeriod === 'last_month') {
        params.period = 'last_month';
        if (targetMonth) params.month = targetMonth;
      } else {
        if (targetMonth) params.month = targetMonth;
      }

      const res = await api.getAdminDashboard(params);
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

      setPeriodMeta({
        period: res?.period ?? summary.period ?? targetPeriod,
        month_label: res?.month_label ?? summary.month_label ?? '',
        range_start: res?.range_start ?? summary.range_start ?? null,
        range_end: res?.range_end ?? summary.range_end ?? null,
        range_text: res?.range_text ?? summary.range_text ?? '',
        range_start_formatted: res?.range_start_formatted ?? summary.range_start_formatted ?? '',
        range_end_formatted: res?.range_end_formatted ?? summary.range_end_formatted ?? '',
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
  }, [period, selectedMonth]);

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

  // Tab switch handlers
  const handleSelectThisMonth = () => {
    const cur = getCurrentUtcYearMonth();
    setPeriod('this_month');
    setSelectedMonth(cur);
    loadMetrics(false, 'this_month', cur);
  };

  const handleSelectLastMonth = () => {
    const last = getAdjacentMonth(getCurrentUtcYearMonth(), -1);
    setPeriod('last_month');
    setSelectedMonth(last);
    loadMetrics(false, 'last_month', last);
  };

  const handleSelectAllTime = () => {
    setPeriod('all_time');
    loadMetrics(false, 'all_time', null);
  };

  const handlePrevMonth = () => {
    const target = getAdjacentMonth(selectedMonth, -1);
    const cur = getCurrentUtcYearMonth();
    const last = getAdjacentMonth(cur, -1);
    let nextPeriod = 'custom';
    if (target === cur) nextPeriod = 'this_month';
    else if (target === last) nextPeriod = 'last_month';
    setPeriod(nextPeriod);
    setSelectedMonth(target);
    loadMetrics(false, nextPeriod, target);
  };

  const handleNextMonth = () => {
    const target = getAdjacentMonth(selectedMonth, 1);
    const cur = getCurrentUtcYearMonth();
    const last = getAdjacentMonth(cur, -1);
    let nextPeriod = 'custom';
    if (target === cur) nextPeriod = 'this_month';
    else if (target === last) nextPeriod = 'last_month';
    setPeriod(nextPeriod);
    setSelectedMonth(target);
    loadMetrics(false, nextPeriod, target);
  };

  const monthDisplayLabel = periodMeta.month_label || formatUtcMonthLabel(selectedMonth) || 'Current Month';

  const exactRangeText = useMemo(() => {
    if (periodMeta?.range_text) return periodMeta.range_text;
    if (periodMeta?.range_start_formatted && periodMeta?.range_end_formatted) {
      return `${periodMeta.range_start_formatted} → ${periodMeta.range_end_formatted}`;
    }
    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) return '';
    const nextMonth = getAdjacentMonth(selectedMonth, 1);
    return `${selectedMonth}-01 00:00:00 UTC → ${nextMonth}-01 00:00:00 UTC`;
  }, [periodMeta, selectedMonth]);

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

      {/* Period Selector & Month Navigation (Top of Dashboard Content) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-xl">
          {/* 3 Main Period Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSelectThisMonth}
              disabled={loading}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                period === 'this_month'
                  ? 'bg-gradient-to-r from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-500/25 border border-brand-400/40 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>This Month (UTC)</span>
            </button>

            <button
              type="button"
              onClick={handleSelectLastMonth}
              disabled={loading}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                period === 'last_month'
                  ? 'bg-gradient-to-r from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-500/25 border border-brand-400/40 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Last Month (UTC)</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAllTime}
              disabled={loading}
              className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                period === 'all_time'
                  ? 'bg-gradient-to-r from-brand-600 to-emerald-600 text-white shadow-lg shadow-brand-500/25 border border-brand-400/40 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Time</span>
            </button>
          </div>

          {/* Active Period Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-300">
            <span className="text-[11px] font-semibold text-slate-400">Viewing:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {period === 'all_time' ? 'All Time (Platform History)' : `${monthDisplayLabel} (UTC)`}
            </span>
          </div>
        </div>

        {/* Sub-header row for Month navigation when month mode is active */}
        {period !== 'all_time' ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                title="View Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev Month</span>
              </button>

              <div className="px-4 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-extrabold flex items-center gap-2 shadow-inner">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>{monthDisplayLabel} (UTC)</span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                title="View Next Month"
              >
                <span>Next Month</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 self-start sm:self-auto px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
              <span>{exactRangeText}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>Displaying platform cumulative statistics without date filtering (All Time).</span>
            </div>
          </div>
        )}
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {period === 'all_time' ? 'Total Registered Users' : 'Users Registered'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-white group-hover:text-brand-300 transition-colors">
              {loading ? '...' : stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {period === 'all_time'
                ? 'Full database registered member accounts'
                : `New user accounts registered in ${monthDisplayLabel}`}
            </p>
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {period === 'all_time' ? 'Total Completed Offers' : 'Completed Offers'}
            </span>
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
              {period === 'all_time' ? 'All-time verified postback logs' : `${monthDisplayLabel} verified postback logs`}
            </p>
          </div>
          <div className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <Zap className="w-3.5 h-3.5" /> View Completed Offers Grid →
          </div>
        </Link>

        {/* Total Gross Revenue USD */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {period === 'all_time' ? 'Total Gross Revenue' : 'Gross Revenue'}
            </span>
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
                period === 'all_time'
                  ? 'Cumulative provider payout received'
                  : `${monthDisplayLabel} provider payout received`
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {period === 'all_time' ? 'Total Chargebacks' : 'Chargebacks'}
            </span>
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {period === 'all_time' ? 'Pending Cashouts' : 'Pending Cashouts'}
            </span>
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
