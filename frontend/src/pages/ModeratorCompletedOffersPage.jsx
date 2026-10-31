import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  DollarSign, 
  Coins, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  User, 
  X,
  Layers,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorCompletedOffersPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters
  const initialUserId = searchParams.get('user_id') || '';
  const [period, setPeriod] = useState('this_month'); // 'today' | 'this_month' | 'all'
  const [provider, setProvider] = useState('');
  const [search, setSearch] = useState('');
  const [userIdFilter, setUserIdFilter] = useState(initialUserId);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Data State
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_records: 0, sum_usd: 0, sum_bdt: 0 });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
    from: 0,
    to: 0,
  });
  const [providersList, setProvidersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Keep search params in sync if user_id changes
  useEffect(() => {
    if (initialUserId !== userIdFilter) {
      setUserIdFilter(initialUserId);
      setCurrentPage(1);
    }
  }, [initialUserId]);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        period,
        page: currentPage,
        per_page: perPage,
      };
      if (provider) params.provider = provider;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (userIdFilter.trim()) params.user_id = userIdFilter.trim();

      const res = await api.getModeratorCompletedOffers(params);
      if (res && res.status === 'success' && res.data) {
        setData(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
        if (Array.isArray(res.data.providers) && res.data.providers.length > 0) {
          setProvidersList(res.data.providers);
        }
      } else {
        setError(res?.message || 'Failed to fetch completed offers.');
      }
    } catch (err) {
      console.error('Failed to load moderator completed offers:', err);
      setError(err?.message || 'Failed to load completed offers.');
    } finally {
      setLoading(false);
    }
  }, [period, provider, debouncedSearch, userIdFilter, currentPage, perPage]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setPeriod('this_month');
    setProvider('');
    setSearch('');
    setUserIdFilter('');
    setCurrentPage(1);
    setSearchParams({});
  };

  // Export Handler (Server-side XLSX with client fallback)
  const handleExport = async (format = 'xlsx') => {
    try {
      const params = { period };
      if (provider) params.provider = provider;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (userIdFilter.trim()) params.user_id = userIdFilter.trim();
      if (format === 'csv') params.format = 'csv';
      await api.exportModeratorCompletedOffers(params);
    } catch {
      handleExportCSV();
    }
  };

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = [
      'S.L',
      'Date (UTC)',
      'Time (UTC)',
      'User ID',
      'Username',
      'Email',
      'Provider',
      'Offer ID',
      'Offer Name',
      'Coin',
      'Payout USD',
      'Payout BDT',
      'Status',
      'My ID',
      'Transaction ID',
      'IP Address',
      'Country',
    ];
    const rows = data.map((r, idx) => {
      const rawDate = r.completed_at || '';
      const cleanDT = String(rawDate).replace('T', ' ').replace('Z', '').split('.')[0];
      const parts = cleanDT.split(' ');
      const dateVal = parts[0] || '';
      const timeVal = parts[1] || '';

      return [
        idx + 1,
        `"${dateVal}"`,
        `"${timeVal}"`,
        `"${r.user_id ?? ''}"`,
        `"${String(r.username || `user_${r.user_id}`).replace(/"/g, '""')}"`,
        `"${String(r.user_email || '—').replace(/"/g, '""')}"`,
        `"${String(r.provider || 'Unknown').replace(/"/g, '""')}"`,
        `"${String(r.offer_id || '—').replace(/"/g, '""')}"`,
        `"${String(r.offer_name || 'Standard Offer').replace(/"/g, '""')}"`,
        Number(r.coin_amount) || 0,
        Number(r.payout_usd) || 0,
        Number(r.payout_bdt) || 0,
        `"${String(r.status || 'Completed').replace(/"/g, '""')}"`,
        `"${String(r.my_id || '—').replace(/"/g, '""')}"`,
        `"${String(r.transaction_id || `TX-${r.id}`).replace(/"/g, '""')}"`,
        `"${String(r.ip || '—').replace(/"/g, '""')}"`,
        `"${String(r.country || '—').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moderator-completed-offers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Status Badge Styling Helper
  const renderStatusBadge = (status) => {
    const s = String(status || 'Completed').toLowerCase();
    if (s.includes('chargeback') || s.includes('reversed')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Reversed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        Completed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Completed Offers
            </h1>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-500/15 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-md">
              Audit Logs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detailed log of all individual offer credits generated by users under your My ID.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Export Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={fetchOffers}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#0c1015]/90 border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Total Filtered Records</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              {(summary.total_records || pagination.total || 0).toLocaleString()}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 text-slate-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0c1015]/90 border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Sum Moderator Payout (USD)</div>
            <div className="text-lg font-black text-brand-300 font-mono mt-0.5">
              ${(Number(summary.sum_usd) || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0c1015]/90 border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Sum Moderator Payout (BDT)</div>
            <div className="text-lg font-black text-cyan-300 font-mono mt-0.5">
              ৳{Math.round(Number(summary.sum_bdt) || 0).toLocaleString()}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Coins className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0c1015]/90 border border-white/5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Period Buttons */}
          <div className="inline-flex rounded-xl bg-white/[0.04] p-1 border border-white/10">
            <button
              onClick={() => handlePeriodChange('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'today'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePeriodChange('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'this_month'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handlePeriodChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'all'
                  ? 'bg-brand-500 text-slate-950 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Active user_id filter pill */}
          {userIdFilter && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-300 border border-brand-500/30 text-xs font-semibold">
              <User className="w-3.5 h-3.5" />
              <span>User ID: #{userIdFilter}</span>
              <button
                onClick={() => {
                  setUserIdFilter('');
                  setSearchParams({});
                }}
                className="hover:text-white ml-1"
                title="Remove User ID filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Inputs: Search, Provider Dropdown, User ID, Rows Per Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search by username or offer name */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user or offer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Provider Dropdown */}
          <div className="relative">
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-[#0e141d] border border-white/10 text-slate-300 text-xs font-medium rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">All Providers</option>
              {providersList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* User ID Direct Match */}
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by User ID..."
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* Per Page selector */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-[11px] text-slate-400">Rows:</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="appearance-none bg-[#0e141d] border border-white/10 text-slate-300 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            {(provider || search || userIdFilter) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchOffers}
            className="underline font-bold hover:text-white cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Paginated Table: 9 Columns */}
      <div className="bg-[#0c1015]/90 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Date/Time (UTC)</th>
                <th className="py-3.5 px-4">User ID</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Provider</th>
                <th className="py-3.5 px-4">Offer Name / ID</th>
                <th className="py-3.5 px-4 text-right">Coin</th>
                <th className="py-3.5 px-4 text-right">Payout USD</th>
                <th className="py-3.5 px-4 text-right">Payout BDT</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading completed offers...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    No completed offers found matching your filters.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                      {row.completed_at || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-brand-400 font-bold whitespace-nowrap">
                      <Link
                        to={`/moderator/completed-offers?user_id=${row.user_id}`}
                        className="hover:underline"
                        title="Filter by this User ID"
                      >
                        #{row.user_id ?? '—'}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-white font-medium whitespace-nowrap">
                      {row.username || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px] font-medium text-slate-300">
                        {row.provider || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-xs truncate" title={row.offer_name || row.offer_id}>
                      {row.offer_name || row.offer_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-300 font-bold">
                      {Number(row.coin_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-300">
                      ${(Number(row.payout_usd) || 0).toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Math.round(Number(row.payout_bdt) || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {renderStatusBadge(row.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing {pagination.from || 0} to {pagination.to || 0} of {pagination.total.toLocaleString()} records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.currentPage <= 1 || loading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 rounded-lg bg-white/[0.04] font-mono font-bold text-white border border-white/5">
                {pagination.currentPage} / {pagination.lastPage || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.lastPage || 1, p + 1))}
                disabled={pagination.currentPage >= pagination.lastPage || loading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
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
