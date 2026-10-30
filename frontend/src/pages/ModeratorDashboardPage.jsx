import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  DollarSign, 
  Users, 
  Coins, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Hash, 
  Trophy, 
  Award, 
  Lock, 
  UserCheck,
  Sparkles,
  Layers,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorDashboardPage() {
  const [data, setData] = useState({
    my_id: null,
    friendly_name: null,
    has_my_id: false,
    total_linked_users: 0,
    active_period: 'this_month',
    selected_month: '',
    months: [],
    summary: {
      my_id: null,
      friendly_name: null,
      total_linked_users: 0,
      total_completed_offers: 0,
      total_usd_earn: 0,
      total_bdt_earn: 0,
    },
    offer_summary: [],
    items: [],
    leaderboard: {
      top_5: [],
      own_rank: null,
    },
  });

  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Month label formatter: '2026-10' -> 'October 2026'
  const formatMonthLabel = (m) => {
    if (!m || m === 'this_month') return 'This Month';
    if (m === 'today') return 'Today';
    if (m === 'all') return 'All Time';
    const [year, month] = m.split('-');
    if (!year || !month) return m;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedMonth) params.month = selectedMonth;

      const res = await api.getModeratorDashboard(params);
      if (res && (res.status === 'success' || res.data)) {
        const payload = res.data || res;
        setData(payload);
        if (!selectedMonth && payload.selected_month) {
          setSelectedMonth(payload.selected_month);
        }
      }
    } catch (err) {
      console.error('Failed to load moderator dashboard:', err);
      setError(err?.message || 'Failed to load Dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const summary = data.summary || {
    my_id: data.my_id,
    friendly_name: data.friendly_name,
    total_linked_users: data.total_linked_users || 0,
    total_completed_offers: 0,
    total_usd_earn: 0,
    total_bdt_earn: 0,
  };

  const offerSummary = useMemo(() => Array.isArray(data.offer_summary) ? data.offer_summary : [], [data.offer_summary]);
  const items = useMemo(() => Array.isArray(data.items) ? data.items : [], [data.items]);
  const top5 = useMemo(() => Array.isArray(data.leaderboard?.top_5) ? data.leaderboard.top_5 : [], [data.leaderboard]);
  const ownRank = data.leaderboard?.own_rank;

  // Rank badge styling helper
  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 font-black text-xs">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/30 font-black text-xs">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/20 text-amber-500 border border-amber-600/30 font-black text-xs">
          🥉 3
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/5 text-slate-400 font-bold text-xs border border-white/5">
        #{rank}
      </span>
    );
  };

  const activePeriod = data.active_period || (selectedMonth === 'today' ? 'today' : (selectedMonth === 'all' ? 'all' : 'this_month'));

  return (
    <div className="space-y-6">
      {/* Top Header: Title, My ID info, Time Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <LayoutDashboard className="w-6 h-6 text-brand-400" />
              <span>Moderator Dashboard</span>
            </h1>
            {data.my_id && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-500/15 text-brand-400 border border-brand-500/30 font-mono">
                My ID: {data.my_id}
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Read-Only</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monthly earnings ledger, linked worker performance, and system leaderboard.
          </p>
        </div>

        {/* Quick Filter Tabs & Month Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Filter Buttons: Today, This Month, All Time */}
          <div className="flex items-center bg-[#0c1015] border border-white/10 rounded-xl p-1 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setSelectedMonth('today')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'today'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedMonth('')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'this_month'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setSelectedMonth('all')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'all'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Historical Month Dropdown */}
          <div className="flex items-center gap-2 bg-[#0c1015] border border-white/10 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <select
              value={selectedMonth || data.selected_month || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={loading}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
              aria-label="Filter dashboard by month"
            >
              <option value="today" className="bg-[#0c1015] text-white">Today</option>
              {data.months && data.months.length > 0 ? (
                data.months.map((m) => (
                  <option key={m} value={m} className="bg-[#0c1015] text-white">
                    {formatMonthLabel(m)}
                  </option>
                ))
              ) : (
                <option value={data.selected_month || ''} className="bg-[#0c1015] text-white">
                  {formatMonthLabel(data.selected_month)}
                </option>
              )}
              <option value="all" className="bg-[#0c1015] text-white">All Time</option>
            </select>
          </div>

          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboard}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Unassigned Warning Notice */}
      {!data.has_my_id && !loading && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-white">No My ID Associated</div>
            <p className="text-amber-300/80 mt-0.5">
              Your moderator account is not currently linked to an active My ID. Please contact an administrator to assign your My ID.
            </p>
          </div>
        </div>
      )}

      {/* 6 TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: My ID */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">My ID</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-brand-400 font-mono truncate">
            {data.my_id ? `#${data.my_id}` : 'None'}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Assigned code</p>
        </div>

        {/* Card 2: Friendly Name */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Friendly Name</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-white truncate" title={data.friendly_name || 'Not set'}>
            {data.friendly_name || <span className="text-slate-500 italic text-base">Not set</span>}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Display handle</p>
        </div>

        {/* Card 3: Total Linked Users */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-cyan-400 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>{summary.total_linked_users || 0}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Linked to your My ID</p>
        </div>

        {/* Card 4: Total Completed Offers */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Completed Offers</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{summary.total_completed_offers || 0}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{formatMonthLabel(data.selected_month)}</p>
        </div>

        {/* Card 5: Total USD Earn */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total USD</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-400 font-mono truncate">
            ${Number(summary.total_usd_earn || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Snapshot USD rate</p>
        </div>

        {/* Card 6: Total BDT Earn */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total BDT</span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-cyan-300 font-mono truncate">
            ৳{Number(summary.total_bdt_earn || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Converted snapshot</p>
        </div>
      </div>

      {/* OFFER SUMMARY TABLE (AGGREGATE PER OFFER) */}
      <div className="rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>Offer Summary — {formatMonthLabel(data.selected_month)}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aggregated completions and earnings grouped by offer and provider for your My ID.
            </p>
          </div>

          <span className="text-xs text-slate-400 self-start sm:self-auto font-medium">
            Distinct Offers: <span className="text-white font-bold">{offerSummary.length}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4">Offer Name</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4 text-center">Total Completed</th>
                <th className="py-3 px-4 text-right">Earnings (USD)</th>
                <th className="py-3 px-4 text-right">Earnings (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && offerSummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-1" />
                    <span>Loading offer summary...</span>
                  </td>
                </tr>
              ) : offerSummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    <Coins className="w-7 h-7 mx-auto mb-1 text-slate-600 opacity-40" />
                    <p className="font-semibold text-slate-400">No earnings recorded for this period</p>
                  </td>
                </tr>
              ) : (
                offerSummary.map((row, idx) => (
                  <tr key={`${row.provider}_${row.offer_name}_${idx}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {row.offer_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-[11px]">
                        {row.provider}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-400">
                      {row.total_completed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(row.earnings_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Number(row.earnings_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEADERBOARD SECTION: Top 5 & Your Rank */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Leaderboard Table (2 Columns Span) */}
        <div className="lg:col-span-2 rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Top 5 Leaderboard — {formatMonthLabel(data.selected_month)}
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Top Performers
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">My ID</th>
                  <th className="py-3 px-4">Friendly Name</th>
                  <th className="py-3 px-4 text-center">Completed Offers</th>
                  <th className="py-3 px-4 text-right">Total BDT Earn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {loading && top5.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-1" />
                      <span>Loading leaderboard...</span>
                    </td>
                  </tr>
                ) : top5.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">
                      <Trophy className="w-7 h-7 mx-auto mb-1 text-slate-600 opacity-40" />
                      <p className="font-semibold text-slate-400">No earnings recorded this month</p>
                    </td>
                  </tr>
                ) : (
                  top5.map((row) => {
                    const isCurrentUser = data.my_id && row.my_id_code === data.my_id;
                    return (
                      <tr 
                        key={row.my_id_code} 
                        className={`transition-colors ${
                          isCurrentUser 
                            ? 'bg-brand-500/10 border-l-2 border-brand-400' 
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3 px-4 text-center">
                          {getRankBadge(row.rank)}
                        </td>

                        {/* My ID */}
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 text-brand-300 border border-white/10">
                            #{row.my_id_code}
                          </span>
                          {isCurrentUser && (
                            <span className="ml-2 text-[10px] text-emerald-400 font-bold uppercase">(You)</span>
                          )}
                        </td>

                        {/* Friendly Name */}
                        <td className="py-3 px-4 font-semibold text-white">
                          {row.friendly_name || <span className="text-slate-500 italic font-normal">Anonymous</span>}
                        </td>

                        {/* Completed Offers */}
                        <td className="py-3 px-4 text-center font-bold text-amber-400">
                          {row.completed_offers}
                        </td>

                        {/* Total BDT */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                          ৳{Number(row.total_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* "Your Rank" Highlight Card (1 Column Span) */}
        <div className="rounded-2xl bg-[#0c1015]/80 border border-brand-500/20 p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Standing</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/25">
                {formatMonthLabel(data.selected_month)}
              </span>
            </div>

            {/* Rank Status & Number */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Your Rank</span>
              <div className="mt-1 flex items-center justify-center gap-2">
                {ownRank ? (
                  <span className="text-3xl font-black text-brand-400 font-mono tracking-tight">
                    {ownRank.completed_offers > 0 ? `#${ownRank.rank}` : (top5.length > 0 ? `#${ownRank.rank}` : 'Unranked')}
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-slate-500">Unranked</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {ownRank && ownRank.completed_offers > 0
                  ? (ownRank.rank <= 5 ? 'Top 5 Leaderboard Winner' : 'Keep going to enter Top 5!')
                  : 'Complete offers this month to earn rank'}
              </p>
            </div>

            {/* Moderator Metadata Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400 font-medium">My ID</span>
                <span className="font-mono font-bold text-white">{data.my_id ? `#${data.my_id}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400 font-medium">Friendly Name</span>
                <span className="font-semibold text-brand-300">{data.friendly_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400 font-medium">Completed Offers</span>
                <span className="font-bold text-amber-400">{ownRank?.completed_offers || 0}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400 font-medium">Total BDT Earn</span>
                <span className="font-mono font-black text-cyan-300">
                  ৳{Number(ownRank?.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 text-center">
            Snapshot earnings automatically update on credit.
          </div>
        </div>
      </div>

      {/* GROUPED EARNING BREAKDOWN TABLE */}
      <div className="rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-brand-400" />
              <span>Completed Offers Breakdown — {formatMonthLabel(data.selected_month)}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Grouped by Provider, Offer, Coins, and Payout Rates.
            </p>
          </div>

          <span className="text-xs text-slate-400 self-start sm:self-auto font-medium">
            Total Groups: <span className="text-white font-bold">{items.length}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4 w-12 text-center">SL</th>
                <th className="py-3 px-4">Wall / Provider</th>
                <th className="py-3 px-4">Offer Name / ID</th>
                <th className="py-3 px-4 text-right">Coins</th>
                <th className="py-3 px-4 text-center">Quantity</th>
                <th className="py-3 px-4 text-right">USD Rate</th>
                <th className="py-3 px-4 text-right">BDT Rate</th>
                <th className="py-3 px-4 text-right">Total BDT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-1" />
                    <span>Loading earnings...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    <Coins className="w-7 h-7 mx-auto mb-1 text-slate-600 opacity-40" />
                    <p className="font-semibold text-slate-400">No completed offers found for this period</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={`${row.provider}_${row.offer}_${row.coins}_${row.sl}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {row.sl}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        {row.provider}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {row.offer}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {Number(row.coins).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {row.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${Number(row.rate_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ৳{Number(row.rate_bdt).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Number(row.total_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
