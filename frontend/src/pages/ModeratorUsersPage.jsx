import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, RefreshCw, AlertCircle, X, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorUsersPage() {
  const [users, setUsers] = useState([]);
  const [totalRegisteredUsers, setTotalRegisteredUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [paginationInfo, setPaginationInfo] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
    from: 0,
    to: 0,
  });
  const [apiError, setApiError] = useState(null);

  // Fetch Total Registered Users from /api/moderator/stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.getModeratorStats();
      if (res && res.data && typeof res.data.total_users === 'number') {
        setTotalRegisteredUsers(res.data.total_users);
      }
    } catch (err) {
      console.error('Failed to load moderator stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Paginated User List from /api/moderator/users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        per_page: rowsPerPage,
      };
      if (activeSearch.trim()) {
        params.search = activeSearch.trim();
      }
      const res = await api.getModeratorUsers(params);
      if (res && res.data) {
        setUsers(res.data);
        if (res.pagination) {
          setPaginationInfo(res.pagination);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to load users from backend:', err);
      setApiError(err.message || 'Failed to load moderator user directory.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, activeSearch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setActiveSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setCurrentPage(1);
  };

  const handleRefreshAll = () => {
    fetchStats();
    fetchUsers();
  };

  // Format Coin Balance strictly without USD equivalent
  const formatCoins = (val) => {
    const num = Number(val ?? 0);
    if (isNaN(num)) return '0 Coins';
    const formatted = num % 1 === 0 
      ? num.toLocaleString() 
      : num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return `${formatted} Coins`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-brand-400" />
            <span>Moderator Panel</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Read-only platform directory for account inquiries and user verification.
          </p>
        </div>

        {/* Total Users Metric Card */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl glass-card border border-brand-500/20 bg-brand-500/5 shadow-inner">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Total Registered Users
              </div>
              <div className="text-lg font-black text-white font-mono leading-none mt-0.5">
                {statsLoading ? '...' : totalRegisteredUsers.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={handleRefreshAll}
            disabled={loading || statsLoading}
            className="p-3 rounded-2xl glass-card border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* API Error Notification */}
      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-200">System Notice: </span>
              <span>{apiError}</span>
            </div>
          </div>
          <button
            onClick={fetchUsers}
            className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls: Search Bar and Page Size */}
      <div className="p-3.5 rounded-2xl glass-card border border-white/10 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shadow-lg">
        {/* Search Form with Search Button and Clear (X) */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by User ID, Username, or Name"
              className="w-full bg-[#0c1015]/80 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 text-slate-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            Search
          </button>
        </form>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-slate-400 text-xs font-semibold">Page Size:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#0c1015] border border-white/10 text-xs font-bold text-brand-400 rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Active Search Pill */}
      {activeSearch && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Active filter:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/20 font-mono">
            "{activeSearch}"
            <button
              onClick={handleClearSearch}
              className="hover:text-white transition-colors"
              title="Remove filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <span className="text-slate-500">
            ({paginationInfo.total.toLocaleString()} {paginationInfo.total === 1 ? 'match' : 'matches'})
          </span>
        </div>
      )}

      {/* User Table (Strict 5 Columns) */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                <th className="py-3 px-4 border-r border-white/5 text-center w-16">S.L</th>
                <th className="py-3 px-4 border-r border-white/5 w-24">User ID</th>
                <th className="py-3 px-4 border-r border-white/5">Username</th>
                <th className="py-3 px-4 border-r border-white/5">Display Name</th>
                <th className="py-3 px-4 text-right">Coin Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
                      <span>Loading user directory...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    {activeSearch ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No users found matching "{activeSearch}"</p>
                        <p className="text-xs text-slate-500">Try searching with a different user ID, username, or name.</p>
                      </div>
                    ) : (
                      'No registered user accounts found.'
                    )}
                  </td>
                </tr>
              ) : (
                users.map((u, index) => {
                  const sl = (rowsPerPage * (currentPage - 1)) + index + 1;
                  return (
                    <tr
                      key={u.id || index}
                      className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap transition-colors"
                    >
                      {/* Column 1: S.L */}
                      <td className="py-3 px-4 border-r border-white/5 text-center text-slate-500 font-mono">
                        {sl}
                      </td>

                      {/* Column 2: User ID */}
                      <td className="py-3 px-4 border-r border-white/5 font-bold text-brand-400">
                        #{u.id}
                      </td>

                      {/* Column 3: Username */}
                      <td className="py-3 px-4 border-r border-white/5 font-sans font-semibold text-white">
                        {u.username}
                      </td>

                      {/* Column 4: Display Name */}
                      <td className="py-3 px-4 border-r border-white/5 font-sans text-slate-300">
                        {u.name || '—'}
                      </td>

                      {/* Column 5: Coin Balance (ONLY COINS, NO USD) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <Coins className="w-3.5 h-3.5 text-amber-400/80" />
                          <span>{formatCoins(u.balance)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        <div className="p-3.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="text-white font-mono font-semibold">
              {paginationInfo.total > 0 ? (rowsPerPage * (currentPage - 1)) + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-mono font-semibold">
              {Math.min(rowsPerPage * currentPage, paginationInfo.total)}
            </span>{' '}
            of{' '}
            <span className="text-white font-mono font-semibold">
              {paginationInfo.total.toLocaleString()}
            </span>{' '}
            users
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-white/10 glass-card hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 text-xs font-mono text-slate-300">
              Page {currentPage} of {paginationInfo.lastPage || 1}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(paginationInfo.lastPage || 1, p + 1))}
              disabled={currentPage >= (paginationInfo.lastPage || 1) || loading}
              className="px-3 py-1.5 rounded-xl border border-white/10 glass-card hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
