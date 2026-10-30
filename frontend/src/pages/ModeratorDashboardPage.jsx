import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  DollarSign, 
  Coins, 
  Clock, 
  TrendingUp, 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  Calendar, 
  ArrowRight, 
  Filter, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  Trophy,
  Award,
  Crown,
  Medal,
  ExternalLink
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
      today_completed_offers: 0,
      today_usd_earn: 0,
      today_bdt_earn: 0,
      chargebacks_count: 0,
      chargebacks_amount: 0,
    },
    offer_summary: [],
  });

  // Filter mode: 'today' | 'this_month' | 'all' | or custom YYYY-MM
  const [activeFilter, setActiveFilter] = useState('this_month');
  const [customMonth, setCustomMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination for Offer Summary Table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchDashboard = useCallback(async (filterMode = activeFilter, custom = customMonth) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (custom && filterMode === 'custom') {
        params.month = custom;
      } else {
        params.month = filterMode;
        params.period = filterMode;
      }

      const res = await api.getModeratorDashboard(params);
      if (res && (res.status === 'success' || res.data)) {
        const payload = res.data || res;
        setData(payload);
      } else {
        setError(res?.message || 'Failed to load Dashboard data');
      }
    } catch (err) {
      console.error('Failed to load moderator dashboard:', err);
      setError(err?.message || 'Failed to load Dashboard data');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, customMonth]);

  useEffect(() => {
    fetchDashboard(activeFilter, customMonth);
  }, [activeFilter, customMonth, fetchDashboard]);

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    setCustomMonth('');
    setCurrentPage(1);
  };

  const handleCustomMonthChange = (e) => {
    const val = e.target.value;
    setCustomMonth(val);
    if (val) {
      setActiveFilter('custom');
    } else {
      setActiveFilter('this_month');
    }
    setCurrentPage(1);
  };

  const summary = data.summary || {
    total_linked_users: data.total_linked_users || 0,
    total_completed_offers: 0,
    total_usd_earn: 0,
    total_bdt_earn: 0,
    today_completed_offers: 0,
    today_usd_earn: 0,
    today_bdt_earn: 0,
    chargebacks_count: 0,
  };

  const offerSummary = useMemo(() => {
    return Array.isArray(data.offer_summary) ? data.offer_summary : [];
  }, [data.offer_summary]);

  // Monthly Team Leaderboard (Top 10 teams on platform)
  const teamLeaderboard = useMemo(() => {
    return Array.isArray(data.team_leaderboard)
      ? data.team_leaderboard
      : Array.isArray(data.leaderboard?.team_leaderboard)
        ? data.leaderboard.team_leaderboard
        : Array.isArray(data.leaderboard?.teams)
          ? data.leaderboard.teams
          : Array.isArray(data.leaderboard?.top_10)
            ? data.leaderboard.top_10
            : [];
  }, [data]);

  // My Rank (Current Month team standing on the platform)
  const myRank = useMemo(() => {
    return data.my_rank || data.leaderboard?.my_rank || data.leaderboard?.own_rank || {
      rank: 1,
      total_teams: 1,
      my_id_code: data.my_id || '',
      team_name: data.friendly_name || data.my_id || '',
      total_offers: 0,
      total_income_usd: 0,
      total_income_bdt: 0,
      monthly_usd: 0,
      monthly_bdt: 0,
      is_in_top_10: true,
    };
  }, [data]);

  const isInTop10 = useMemo(() => {
    if (typeof myRank.is_in_top_10 === 'boolean') {
      return myRank.is_in_top_10;
    }
    return teamLeaderboard.some((t) => t.is_own_team || (myRank.my_id_code && t.my_id_code === myRank.my_id_code));
  }, [myRank, teamLeaderboard]);

  // Filter offer summary table by search query
  const filteredOfferSummary = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return offerSummary;
    return offerSummary.filter((row) => {
      const provider = String(row.provider || '').toLowerCase();
      const offerName = String(row.offer_name || '').toLowerCase();
      return provider.includes(query) || offerName.includes(query);
    });
  }, [offerSummary, searchQuery]);

  // Totals across all rows in the filtered table
  const totals = useMemo(() => {
    return filteredOfferSummary.reduce(
      (acc, row) => ({
        today_offers: acc.today_offers + (Number(row.today_offers) || 0),
        total_offers: acc.total_offers + (Number(row.total_offers || row.total_completed) || 0),
        net_usd: acc.net_usd + (Number(row.net_usd ?? row.earnings_usd) || 0),
        net_bdt: acc.net_bdt + (Number(row.net_bdt ?? row.earnings_bdt) || 0),
      }),
      { today_offers: 0, total_offers: 0, net_usd: 0, net_bdt: 0 }
    );
  }, [filteredOfferSummary]);

  // Paginated slice
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOfferSummary.slice(start, start + pageSize);
  }, [filteredOfferSummary, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredOfferSummary.length / pageSize));

  // 8 Top Summary Cards
  const summaryCards = [
    {
      label: 'Total Users',
      value: (summary.total_linked_users || 0).toLocaleString(),
      subtext: 'Assigned to your My ID',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30',
    },
    {
      label: 'Completed Offers',
      value: (summary.total_completed_offers || 0).toLocaleString(),
      subtext: activeFilter === 'today' ? 'Completed today (UTC)' : 'Completed in selected period',
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      label: 'Total Earning USD',
      value: `$${(Number(summary.total_usd_earn) || 0).toFixed(2)}`,
      subtext: 'Your moderator payout',
      icon: DollarSign,
      color: 'from-emerald-500/20 to-cyan-500/10 text-brand-300 border-brand-500/30',
    },
    {
      label: 'Total Earning BDT',
      value: `৳${Math.round(Number(summary.total_bdt_earn) || 0).toLocaleString()}`,
      subtext: 'At rule conversion rate',
      icon: Coins,
      color: 'from-cyan-500/20 to-blue-500/10 text-cyan-300 border-cyan-500/30',
    },
    {
      label: 'Today Offers',
      value: (summary.today_completed_offers || 0).toLocaleString(),
      subtext: 'Completed today (UTC)',
      icon: Clock,
      color: 'from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/30',
    },
    {
      label: 'Today Earning USD',
      value: `$${(Number(summary.today_usd_earn) || 0).toFixed(2)}`,
      subtext: 'Moderator payout today',
      icon: TrendingUp,
      color: 'from-emerald-500/20 to-brand-500/10 text-emerald-300 border-emerald-500/30',
    },
    {
      label: 'Today Earning BDT',
      value: `৳${Math.round(Number(summary.today_bdt_earn) || 0).toLocaleString()}`,
      subtext: 'BDT converted today',
      icon: Coins,
      color: 'from-purple-500/20 to-pink-500/10 text-purple-300 border-purple-500/30',
    },
    {
      label: 'Chargebacks',
      value: (summary.chargebacks_count || 0).toLocaleString(),
      subtext: summary.chargebacks_count > 0 ? 'Deducted/Reversed' : 'Zero chargebacks',
      icon: ShieldAlert,
      color: summary.chargebacks_count > 0
        ? 'from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30'
        : 'from-slate-500/20 to-slate-500/10 text-slate-400 border-white/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Moderator Dashboard
            </h1>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-500/15 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-md">
              {data.my_id || 'MY ID'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time performance metrics and offer summaries for your assigned My ID.
          </p>
        </div>

        {/* Controls: Quick Filters, Month Picker, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filter Buttons */}
          <div className="inline-flex rounded-xl bg-white/[0.04] p-1 border border-white/10">
            <button
              onClick={() => handleFilterClick('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'today'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleFilterClick('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'this_month'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handleFilterClick('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'all'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Historical Month Dropdown */}
          {Array.isArray(data.months) && data.months.length > 0 && (
            <div className="relative">
              <select
                value={customMonth}
                onChange={handleCustomMonthChange}
                className="appearance-none bg-[#0e141d] border border-white/10 text-slate-300 text-xs font-medium rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="">Historical Month...</option>
                {data.months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboard(activeFilter, customMonth)}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchDashboard(activeFilter, customMonth)}
            className="underline font-bold hover:text-white cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* A) EXACTLY 8 TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} bg-[#0c1015]/90 border backdrop-blur-sm transition-all hover:border-white/20`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 truncate">
                {card.label}
              </span>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 shrink-0">
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {card.value}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {card.subtext}
            </div>
          </div>
        ))}
      </div>

      {/* B) MONTHLY TEAM LEADERBOARD (UTC) */}
      <div className="bg-[#0c1015]/90 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        {/* Leaderboard Header with prominent "Your Rank" pill */}
        <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Monthly Team Leaderboard (UTC)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                  Top 10
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live monthly platform team rankings ordered by total income (USD) and completed offers.
              </p>
            </div>
          </div>

          {/* Prominent Your Rank display */}
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-brand-500/10 via-emerald-500/10 to-cyan-500/10 border border-brand-500/30 text-white shrink-0 shadow-lg shadow-brand-500/5">
            <Crown className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-bold text-slate-300">Your Rank:</span>
            <span className="font-mono font-black text-sm text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-emerald-300">
              #{myRank.rank}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              of {myRank.total_teams} {myRank.total_teams === 1 ? 'Team' : 'Teams'}
            </span>
          </div>
        </div>

        {/* Responsive Table: Exactly 5 Columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">Rank</th>
                <th className="py-3.5 px-4">My ID / Team</th>
                <th className="py-3.5 px-4 text-right">Total Offers</th>
                <th className="py-3.5 px-4 text-right">Total Income (USD)</th>
                <th className="py-3.5 px-4 text-right">Total Income (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading && teamLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-slate-500 font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading team leaderboard...
                  </td>
                </tr>
              ) : teamLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-slate-500">
                    No team activity recorded yet for this month.
                  </td>
                </tr>
              ) : (
                <>
                  {teamLeaderboard.map((row, idx) => {
                    const rankNum = row.rank || idx + 1;
                    const isOwn = row.is_own_team || (myRank.my_id_code && row.my_id_code === myRank.my_id_code);
                    return (
                      <tr
                        key={row.my_id_code || idx}
                        className={`transition-colors ${
                          isOwn
                            ? 'bg-brand-500/10 hover:bg-brand-500/15 border-y border-brand-500/30'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* 1. Rank */}
                        <td className="py-3 px-4 text-center">
                          {rankNum === 1 ? (
                            <div className="w-7 h-7 mx-auto rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center font-black text-sm shadow-sm shadow-amber-950/40">
                              🥇
                            </div>
                          ) : rankNum === 2 ? (
                            <div className="w-7 h-7 mx-auto rounded-xl bg-slate-300/20 text-slate-200 border border-slate-300/30 flex items-center justify-center font-black text-sm">
                              🥈
                            </div>
                          ) : rankNum === 3 ? (
                            <div className="w-7 h-7 mx-auto rounded-xl bg-amber-700/20 text-amber-400 border border-amber-700/30 flex items-center justify-center font-black text-sm">
                              🥉
                            </div>
                          ) : (
                            <div
                              className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                                isOwn
                                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                                  : 'bg-white/5 text-slate-400 border border-white/5'
                              }`}
                            >
                              #{rankNum}
                            </div>
                          )}
                        </td>

                        {/* 2. My ID / Team */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isOwn ? 'text-brand-300' : 'text-white'}`}>
                              {row.team_name || row.my_id_code || 'Unnamed Team'}
                            </span>
                            {row.my_id_code && row.team_name !== row.my_id_code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                                {row.my_id_code}
                              </span>
                            )}
                            {isOwn && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Total Offers */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5">
                            {Number(row.total_offers || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* 4. Total Income (USD) */}
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          ${(Number(row.total_income_usd) || 0).toFixed(2)}
                        </td>

                        {/* 5. Total Income (BDT) */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                          ৳{Math.round(Number(row.total_income_bdt) || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}

                  {/* If moderator is outside Top 10, display their row below Top 10 */}
                  {!isInTop10 && myRank.rank && (
                    <>
                      <tr>
                        <td
                          colSpan="5"
                          className="py-2 text-center text-slate-500 font-bold tracking-widest border-t border-b border-dashed border-white/10 bg-white/[0.01]"
                        >
                          •••
                        </td>
                      </tr>
                      <tr className="bg-brand-500/10 hover:bg-brand-500/15 border-y border-brand-500/30 transition-colors">
                        {/* 1. Rank */}
                        <td className="py-3 px-4 text-center">
                          <div className="w-7 h-7 mx-auto rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 flex items-center justify-center font-mono font-bold text-xs">
                            #{myRank.rank}
                          </div>
                        </td>

                        {/* 2. My ID / Team */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-300">
                              {myRank.team_name || myRank.my_id_code || 'Your Team'}
                            </span>
                            {myRank.my_id_code && myRank.team_name !== myRank.my_id_code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                                {myRank.my_id_code}
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm">
                              You
                            </span>
                          </div>
                        </td>

                        {/* 3. Total Offers */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/5">
                            {Number(myRank.total_offers || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* 4. Total Income (USD) */}
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          ${(Number(myRank.total_income_usd ?? myRank.monthly_usd) || 0).toFixed(2)}
                        </td>

                        {/* 5. Total Income (BDT) */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                          ৳{Math.round(Number(myRank.total_income_bdt ?? myRank.monthly_bdt) || 0).toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* C) OFFER SUMMARY TABLE */}
      <div className="bg-[#0c1015]/90 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white tracking-tight">
                Offer Summary Table
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30">
                {filteredOfferSummary.length} Offers
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown by provider and offer name with moderator net earnings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search offer or provider..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Link to Completed Offers */}
            <Link
              to="/moderator/completed-offers"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all shrink-0"
            >
              <span>Individual Logs</span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
            </Link>
          </div>
        </div>

        {/* Responsive Table (8 Columns) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Offer Name</th>
                <th className="py-3 px-4 text-right">Coin</th>
                <th className="py-3 px-4 text-right">Today Offers</th>
                <th className="py-3 px-4 text-right">Total Offers</th>
                <th className="py-3 px-4 text-right">Offer Price (USD)</th>
                <th className="py-3 px-4 text-right">Net USD</th>
                <th className="py-3 px-4 text-right">Net BDT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading && offerSummary.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500 font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading offer summary...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No completed offers found for the selected period.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px]">
                        {row.provider || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-medium max-w-xs truncate" title={row.offer_name}>
                      {row.offer_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-300">
                      {Number(row.coin || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-300">
                      {Number(row.today_offers || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {Number(row.total_offers || row.total_completed || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${(Number(row.offer_price) || 0).toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-300">
                      ${(Number(row.net_usd ?? row.earnings_usd) || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Math.round(Number(row.net_bdt ?? row.earnings_bdt) || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Footer Totals Row */}
            {filteredOfferSummary.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-brand-500/30 bg-brand-500/[0.04] text-xs font-black text-white">
                  <td colSpan="3" className="py-3.5 px-4 uppercase tracking-wider text-brand-300 font-bold">
                    Total Summary ({filteredOfferSummary.length} Offers)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-white">
                    {totals.today_offers.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-white">
                    {totals.total_offers.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-500 text-[11px]">
                    —
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-brand-300">
                    ${totals.net_usd.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-cyan-300">
                    ৳{Math.round(totals.net_bdt).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredOfferSummary.length)} of{' '}
              {filteredOfferSummary.length} rows
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
