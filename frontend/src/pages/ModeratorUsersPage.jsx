import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  ShieldAlert, 
  Mail, 
  Calendar,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Pagination
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
    from: 0,
    to: 0,
  });

  // 150ms debounce for responsive search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        per_page: perPage,
        view: 'all',
      };
      if (date) {
        params.date = date;
      } else if (month) {
        params.month = month;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await api.getModeratorUsers(params);
      if (res && res.data) {
        setUsers(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to load moderator users:', err);
      setError(err?.message || 'Failed to load users directory.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, debouncedSearch, date, month]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDateChange = (newDate) => {
    setDate(newDate);
    setMonth('');
    setCurrentPage(1);
  };

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    setDate('');
    setCurrentPage(1);
  };

  const handleClearDateFilters = () => {
    setDate('');
    setMonth('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Assigned Users
            </h1>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-500/15 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-md">
              {pagination.total || 0} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registered members linked to your My ID. Sensitive contact details are masked for privacy.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0c1015]/90 border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by User ID or username..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date (UTC) Picker */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date (UTC):</span>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          {/* Month (UTC) Picker */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Month (UTC):</span>
            <input
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          {(date || month) && (
            <button
              onClick={handleClearDateFilters}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
              title="Clear date/month filters"
            >
              <X className="w-3 h-3 text-rose-400" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-400">
          <span>Rows:</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="appearance-none bg-[#0e141d] border border-white/10 text-slate-300 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchUsers}
            className="underline font-bold hover:text-white cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table: 6 Columns per requirements */}
      <div className="bg-[#0c1015]/90 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4">User ID</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Email (Masked)</th>
                <th className="py-3.5 px-4">Join Date</th>
                <th className="py-3.5 px-4 text-center">Completed Offers</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading assigned users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No assigned users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* 1. User ID */}
                    <td className="py-3 px-4 font-mono font-bold text-brand-400 whitespace-nowrap">
                      <Link
                        to={`/moderator/completed-offers?user_id=${u.id}`}
                        className="hover:underline"
                        title="View completed offers for this user"
                      >
                        #{u.id}
                      </Link>
                    </td>

                    {/* 2. Username */}
                    <td className="py-3 px-4 text-white font-medium whitespace-nowrap">
                      {u.username || '—'}
                    </td>

                    {/* 3. Masked Email */}
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {u.masked_email || u.email || '—'}
                    </td>

                    {/* 4. Join Date */}
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {u.joined_at || '—'}
                    </td>

                    {/* 5. Completed Offers Count */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-white whitespace-nowrap">
                      <Link
                        to={`/moderator/completed-offers?user_id=${u.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/5 hover:bg-brand-500/15 hover:text-brand-300 border border-white/5 transition-colors"
                        title="Click to view individual offers"
                      >
                        {u.completed_offers_count ?? u.completed_offers ?? 0}
                      </Link>
                    </td>

                    {/* 6. Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {u.is_banned || u.status === 'Banned' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Action: Quick Link to Completed Offers */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/moderator/completed-offers?user_id=${u.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-brand-500/20 text-slate-300 hover:text-brand-300 border border-white/10 text-[11px] font-semibold transition-all"
                        title="Completed offers for this user"
                      >
                        <span>Offers</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
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
              Showing {pagination.from || 0} to {pagination.to || 0} of {pagination.total.toLocaleString()} users
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
