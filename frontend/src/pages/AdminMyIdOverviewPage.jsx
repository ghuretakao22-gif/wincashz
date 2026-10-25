import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Hash, 
  Search, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Filter,
  Eye,
  Lock
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminMyIdOverviewPage() {
  const [data, setData] = useState({
    selected_month: '',
    months: [],
    summary: {
      total_my_ids: 0,
      total_linked_users: 0,
      total_offers: 0,
      total_usd: 0,
      total_bdt: 0,
    },
    data: [],
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Format YYYY-MM label
  const formatMonthLabel = (m) => {
    if (!m || m === 'all') return 'All Time';
    const [year, month] = m.split('-');
    if (!year || !month) return m;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (selectedMonth) params.month = selectedMonth;

      const res = await api.getAdminMyIdOverview(params);
      if (res && res.success) {
        setData(res);
        if (!selectedMonth && res.selected_month) {
          setSelectedMonth(res.selected_month);
        }
      }
    } catch (err) {
      console.error('Failed to load My ID overview:', err);
      setError(err?.message || 'Failed to load My ID Overview');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, selectedMonth]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const rows = useMemo(() => Array.isArray(data.data) ? data.data : [], [data.data]);
  const summary = data.summary || { total_my_ids: 0, total_linked_users: 0, total_offers: 0, total_usd: 0, total_bdt: 0 };

  return (
    <div className="space-y-6">
      {/* Top Header: Title, Description, Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <TrendingUp className="w-6 h-6 text-brand-400" />
              <span>My ID Overview</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Read-Only Summary</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated snapshot earnings by My ID. Raw provider payouts remain strictly protected.
          </p>
        </div>

        {/* Month Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0c1015] border border-white/10 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <select
              value={selectedMonth || data.selected_month || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={loading}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
              aria-label="Filter by month"
            >
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
            </select>
          </div>

          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50"
            title="Refresh Overview"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOverview}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total My IDs</span>
          <div className="mt-2 text-2xl font-black text-white">{summary.total_my_ids}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Matching criteria</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Linked Users</span>
          <div className="mt-2 text-2xl font-black text-brand-400">{summary.total_linked_users}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Assigned workers</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Offers</span>
          <div className="mt-2 text-2xl font-black text-amber-400">{summary.total_offers}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Completed offers</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total USD</span>
          <div className="mt-2 text-2xl font-black text-emerald-400">${Number(summary.total_usd || 0).toFixed(2)}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Snapshot USD total</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total BDT</span>
          <div className="mt-2 text-2xl font-black text-cyan-400">
            ৳{Number(summary.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Converted at snapshots</p>
        </div>
      </div>

      {/* Filter Bar: Search + Status Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0c1015]/80 border border-white/5">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search My ID code or label..."
            className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0c1015] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Main Table: My ID, Label, Linked Users, Total Offers, Total USD, Total BDT, Status */}
      <div className="rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4">My ID</th>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4 text-center">Linked Users</th>
                <th className="py-3 px-4 text-center">Total Offers</th>
                <th className="py-3 px-4 text-right">Total USD</th>
                <th className="py-3 px-4 text-right">Total BDT</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2" />
                    <span>Loading overview...</span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <Hash className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                    <div className="font-semibold text-slate-300">No My IDs found</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Try adjusting your search or status filter.</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* My ID */}
                    <td className="py-3.5 px-4 font-bold text-white">
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {row.my_id_code}
                      </span>
                    </td>

                    {/* Label */}
                    <td className="py-3.5 px-4 font-medium text-slate-300 max-w-[200px] truncate" title={row.label || '—'}>
                      {row.label || <span className="text-slate-600">—</span>}
                    </td>

                    {/* Linked Users */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 text-slate-200 font-bold border border-white/10">
                        <Users className="w-3.5 h-3.5 text-brand-400" />
                        <span>{row.linked_users}</span>
                      </span>
                    </td>

                    {/* Total Offers */}
                    <td className="py-3.5 px-4 text-center font-bold text-amber-400">
                      {row.total_offers}
                    </td>

                    {/* Total USD */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(row.total_usd).toFixed(2)}
                    </td>

                    {/* Total BDT */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-cyan-400">
                      ৳{Number(row.total_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {row.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 font-bold text-[10px] border border-slate-500/30">
                          <XCircle className="w-3 h-3" />
                          <span>Disabled</span>
                        </span>
                      )}
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
