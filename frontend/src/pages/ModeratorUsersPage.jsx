import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Search, 
  Users, 
  RefreshCw, 
  AlertCircle, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Calendar, 
  CalendarDays, 
  Eye, 
  Layers, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorUsersPage() {
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'coins'
  const [users, setUsers] = useState([]);
  const [totalRegisteredUsers, setTotalRegisteredUsers] = useState(0);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [dateCount, setDateCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'YYYY-MM' or 'all'
  const [selectedDate, setSelectedDate] = useState(''); // 'YYYY-MM-DD' or ''

  // Pagination State
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

  // User Activity Detail Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const requestIdRef = useRef(0);

  // 150ms Instant Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Check if a single specific date is actively selected
  const isSingleDate = useMemo(() => {
    return Boolean(selectedDate && selectedDate.trim() && selectedDate !== 'all');
  }, [selectedDate]);

  // Fetch Total Users, dynamic months, and date counts from /api/moderator/stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (selectedMonth && selectedMonth !== 'all') params.month = selectedMonth;
      if (selectedDate) params.date = selectedDate;

      const res = await api.getModeratorStats(params);
      if (res && res.data) {
        if (typeof res.data.total_users === 'number') {
          setTotalRegisteredUsers(res.data.total_users);
        }
        if (Array.isArray(res.data.months) && res.data.months.length > 0) {
          setAvailableMonths(res.data.months);
        }
        if (typeof res.data.date_count === 'number') {
          setDateCount(res.data.date_count);
        }
      }
    } catch (err) {
      console.error('Failed to load moderator stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedMonth, selectedDate]);

  // Fetch Paginated User Directory or Coin Activity (with Stale Request Protection)
  const fetchUsers = useCallback(async (isBackground = false) => {
    const currentRequestId = ++requestIdRef.current;
    if (!isBackground) setLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        per_page: isSingleDate ? 'all' : rowsPerPage,
        view: viewMode,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (selectedDate.trim()) {
        params.date = selectedDate.trim();
      } else if (selectedMonth && selectedMonth !== 'all') {
        params.month = selectedMonth.trim();
      }

      const res = await api.getModeratorUsers(params);
      // Stale response protection
      if (currentRequestId !== requestIdRef.current) return;

      if (res && res.data) {
        setUsers(res.data);
        if (res.pagination) {
          setPaginationInfo(res.pagination);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('Failed to load moderator users directory:', err);
      if (!isBackground) {
        setApiError(err.message || 'Failed to connect to backend users API.');
        setUsers([]);
      }
    } finally {
      if (!isBackground && currentRequestId === requestIdRef.current) setLoading(false);
    }
  }, [currentPage, rowsPerPage, debouncedSearch, selectedDate, selectedMonth, isSingleDate, viewMode]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleClearSearch = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedDate('');
    setCurrentPage(1);
  };

  const handleRefreshAll = () => {
    fetchStats();
    fetchUsers();
  };

  // Inspect User Activity Modal Handler
  const handleViewUserActivity = async (u) => {
    setSelectedUser(u);
    setUserActivity([]);
    setModalLoading(true);
    try {
      if (api.getModeratorUserActivity) {
        const res = await api.getModeratorUserActivity(u.id);
        setUserActivity(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load user activity:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Format Coin Balance strictly without USD equivalent
  const formatCoins = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '0 Coins';
    const formatted = num % 1 === 0 
      ? num.toLocaleString() 
      : num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return `${formatted} Coins`;
  };

  // Human-readable filter summary badge
  const filterSummary = useMemo(() => {
    if (selectedDate) {
      try {
        const d = new Date(selectedDate + 'T00:00:00');
        const formattedDate = d.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });
        const count = dateCount !== null ? dateCount : paginationInfo.total;
        return `${formattedDate} — ${count.toLocaleString()} ${viewMode === 'coins' ? 'coin credits' : 'records'}`;
      } catch (e) {
        return `Date: ${selectedDate}`;
      }
    }
    if (selectedMonth && selectedMonth !== 'all') {
      try {
        const [y, m] = selectedMonth.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        return `Month: ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      } catch (e) {
        return `Month: ${selectedMonth}`;
      }
    }
    return viewMode === 'coins' ? 'All-Time Coin Credits' : 'All-Time Directory';
  }, [selectedDate, selectedMonth, dateCount, paginationInfo.total, viewMode]);

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-brand-400" />
              <span>Wall User Monitoring</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              Read-Only
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time user directory with authoritative offerwall credit tracking, date filtering, and coin auditing.
          </p>
        </div>

        {/* Total Users Metric Card */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl glass-card border border-brand-500/20 bg-brand-500/5 shadow-inner">
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
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* API Error Notice */}
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
            onClick={() => fetchUsers()}
            className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* View Mode Toggle Tabs (All Users vs Coin Credits Activity) */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-card border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => {
            setViewMode('all');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'all'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>All Users</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('coins');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'coins'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Coin Credits Activity</span>
        </button>
      </div>

      {/* Month & Date Filter Bar */}
      <div className="p-4 rounded-3xl glass-card border border-white/10 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300">Select Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedDate('');
                  setCurrentPage(1);
                }}
                className="bg-[#0c1015] border border-white/15 text-xs font-bold text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-400 cursor-pointer"
              >
                <option value="all">All Months (All-Time)</option>
                {availableMonths.map((m) => {
                  let label = m;
                  try {
                    const [y, mon] = m.split('-');
                    label = new Date(Number(y), Number(mon) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                  } catch (e) {}
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>

            {/* Specific Date Picker */}
            <div className="flex items-center gap-2 pl-3 border-l border-white/10 text-xs text-slate-400">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Specific Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#0c1015] border border-white/15 text-xs text-white rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Clear Date Filters */}
            {(selectedMonth !== 'all' || selectedDate) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-4 transition-colors"
              >
                Clear Date Filter
              </button>
            )}
          </div>

          {/* Filter Summary Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-bold flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-brand-400" />
            <span>{filterSummary}</span>
          </div>
        </div>
      </div>

      {/* Main Search & Page Size Bar */}
      <div className="p-3.5 rounded-2xl glass-card border border-white/10 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shadow-lg">
        {/* Instant Search Input (150ms debounce) */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={viewMode === 'coins' ? "Search coin credits by User ID, Username, or Name..." : "Search by User ID, Username, or Name..."}
              className="w-full bg-[#0c1015]/80 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 text-slate-400 hover:text-white transition-colors"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Page Size Selector or Auto-All Date Indicator */}
        {isSingleDate ? (
          <div className="px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-brand-400" />
            <span>Showing all {paginationInfo.total.toLocaleString()} {viewMode === 'coins' ? 'coin credits' : 'matching users'} on this date</span>
          </div>
        ) : (
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
        )}
      </div>

      {/* Active Search & Filter Indicator */}
      {(debouncedSearch || selectedDate || (selectedMonth && selectedMonth !== 'all')) && (
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <span>Active filter:</span>
          {debouncedSearch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/20 font-mono">
              "{debouncedSearch}"
              <button onClick={handleClearSearch} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedDate && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
              Date: {selectedDate}
              <button onClick={() => { setSelectedDate(''); setCurrentPage(1); }} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedMonth !== 'all' && !selectedDate && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              Month: {selectedMonth}
              <button onClick={() => { setSelectedMonth('all'); setCurrentPage(1); }} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span className="text-slate-500">
            ({paginationInfo.total.toLocaleString()} {paginationInfo.total === 1 ? 'match' : 'matches'})
          </span>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          {viewMode === 'coins' ? (
            /* =========================================================================
               COINS VIEW MODE: Every credited coin transaction
               ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                  <th className="py-3 px-3 border-r border-white/5 text-center w-12">1. S.L</th>
                  <th className="py-3 px-3 border-r border-white/5 w-20">2. User ID</th>
                  <th className="py-3 px-3 border-r border-white/5">3. Username</th>
                  <th className="py-3 px-3 border-r border-white/5">4. Display Name</th>
                  <th className="py-3 px-3 border-r border-white/5">5. Wall / Provider</th>
                  <th className="py-3 px-3 border-r border-white/5 text-right">6. Credited Coins</th>
                  <th className="py-3 px-3 border-r border-white/5">7. Credit Date</th>
                  <th className="py-3 px-3 border-r border-white/5">8. Credit Time</th>
                  <th className="py-3 px-3 text-right">9. Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                        <span>Loading coin credits activity...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No coin credit activity found matching filter criteria.</p>
                        <p className="text-xs text-slate-500">Try adjusting your search query or selected date/month.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((item, index) => {
                    const sl = isSingleDate ? index + 1 : (rowsPerPage * (currentPage - 1)) + index + 1;

                    return (
                      <tr
                        key={item.id || index}
                        className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap transition-colors"
                      >
                        {/* 1. S.L */}
                        <td className="py-3 px-3 border-r border-white/5 text-center text-slate-500 font-mono">
                          {sl}
                        </td>

                        {/* 2. User ID */}
                        <td className="py-3 px-3 border-r border-white/5 font-bold text-brand-400">
                          #{item.user_id}
                        </td>

                        {/* 3. Username */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans font-semibold text-white">
                          {item.username}
                        </td>

                        {/* 4. Display Name */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans text-slate-300">
                          {item.name || '—'}
                        </td>

                        {/* 5. Wall / Provider */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-xs">
                            <Layers className="w-3 h-3 text-emerald-400" />
                            <span>{item.wall_name || '—'}</span>
                          </span>
                        </td>

                        {/* 6. Credited Coins */}
                        <td className="py-3 px-3 border-r border-white/5 text-right font-mono font-bold text-amber-400">
                          +{formatCoins(item.credited_coins)}
                        </td>

                        {/* 7. Credit Date */}
                        <td className="py-3 px-3 border-r border-white/5 font-mono text-slate-300">
                          {item.credit_date || '—'}
                        </td>

                        {/* 8. Credit Time */}
                        <td className="py-3 px-3 border-r border-white/5 font-mono text-slate-400">
                          {item.credit_time || '—'}
                        </td>

                        {/* 9. Current Balance */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <Coins className="w-3.5 h-3.5 text-amber-400/80" />
                            <span>{formatCoins(item.balance)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* =========================================================================
               ALL VIEW MODE: Full registered user directory with latest activity
               ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                  <th className="py-3 px-3 border-r border-white/5 text-center w-12">1. S.L</th>
                  <th className="py-3 px-3 border-r border-white/5 w-20">2. User ID</th>
                  <th className="py-3 px-3 border-r border-white/5">3. Username</th>
                  <th className="py-3 px-3 border-r border-white/5">4. Display Name</th>
                  <th className="py-3 px-3 border-r border-white/5 text-right">5. Current Balance</th>
                  <th className="py-3 px-3 border-r border-white/5">6. Latest Wall / Provider</th>
                  <th className="py-3 px-3 border-r border-white/5 text-right">7. Latest Coins</th>
                  <th className="py-3 px-3 border-r border-white/5">8. Latest Credit Date</th>
                  <th className="py-3 px-3 border-r border-white/5">9. Latest Credit Time</th>
                  <th className="py-3 px-3 text-center w-16">10. Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
                        <span>Loading user and wall activity directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-300">No users found matching current filter criteria.</p>
                        <p className="text-xs text-slate-500">Try adjusting your search query or selected date/month.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((u, index) => {
                    const sl = isSingleDate ? index + 1 : (rowsPerPage * (currentPage - 1)) + index + 1;
                    const hasWallActivity = u.latest_wall && u.latest_wall !== '—';

                    return (
                      <tr
                        key={u.id || index}
                        className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap transition-colors"
                      >
                        {/* 1. S.L */}
                        <td className="py-3 px-3 border-r border-white/5 text-center text-slate-500 font-mono">
                          {sl}
                        </td>

                        {/* 2. User ID */}
                        <td className="py-3 px-3 border-r border-white/5 font-bold text-brand-400">
                          #{u.id}
                        </td>

                        {/* 3. Username */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans font-semibold text-white">
                          {u.username}
                        </td>

                        {/* 4. Display Name */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans text-slate-300">
                          {u.name || '—'}
                        </td>

                        {/* 5. Current Coin Balance (ONLY COINS, NO USD) */}
                        <td className="py-3 px-3 border-r border-white/5 text-right font-mono font-bold text-amber-400">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <Coins className="w-3.5 h-3.5 text-amber-400/80" />
                            <span>{formatCoins(u.balance)}</span>
                          </span>
                        </td>

                        {/* 6. Latest Wall / Provider */}
                        <td className="py-3 px-3 border-r border-white/5 font-sans">
                          {hasWallActivity ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-xs">
                              <Layers className="w-3 h-3 text-emerald-400" />
                              <span>{u.latest_wall}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">No activity</span>
                          )}
                        </td>

                        {/* 7. Latest Credited Coins (ONLY COINS, NO USD) */}
                        <td className="py-3 px-3 border-r border-white/5 text-right font-mono font-bold">
                          {u.latest_coins !== null ? (
                            <span className="text-brand-400">
                              +{formatCoins(u.latest_coins)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* 8. Latest Credit Date */}
                        <td className="py-3 px-3 border-r border-white/5 font-mono text-slate-300">
                          {u.latest_credit_date || '—'}
                        </td>

                        {/* 9. Latest Credit Time */}
                        <td className="py-3 px-3 border-r border-white/5 font-mono text-slate-400">
                          {u.latest_credit_time || '—'}
                        </td>

                        {/* 10. Action: Read-Only Detail View */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewUserActivity(u)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[11px] font-semibold flex items-center gap-1 mx-auto transition-colors active:scale-95"
                            title="View Recent Wall Activity"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-400" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Server-Side Pagination Footer */}
        <div className="p-3.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="text-white font-mono font-semibold">
              {paginationInfo.total > 0 ? (isSingleDate ? 1 : (rowsPerPage * (currentPage - 1)) + 1) : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-mono font-semibold">
              {isSingleDate ? paginationInfo.total : Math.min(rowsPerPage * currentPage, paginationInfo.total)}
            </span>{' '}
            of{' '}
            <span className="text-white font-mono font-semibold">
              {paginationInfo.total.toLocaleString()}
            </span>{' '}
            {viewMode === 'coins' ? 'coin credits' : 'users'}
            {isSingleDate && (
              <span className="text-brand-400 font-semibold ml-2">• Showing all records for this date</span>
            )}
          </div>

          {!isSingleDate && paginationInfo.lastPage > 1 && (
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
          )}
        </div>
      </div>

      {/* Read-Only User Activity Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setSelectedUser(null)}
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-2xl bg-[#0c1015] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Wall Activity:</span>
                    <span className="text-brand-400 font-mono">@{selectedUser.username}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    User ID #{selectedUser.id} &bull; {selectedUser.name || 'No Display Name'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Summary (ONLY COINS, NO USD) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-semibold">Current Account Balance:</div>
              <div className="text-base font-black font-mono text-amber-400 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{formatCoins(selectedUser.balance)}</span>
              </div>
            </div>

            {/* Recent Completed Offerwall Tasks Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Recent Offerwall Credits (Read-Only):</span>
                <span className="text-[11px] text-slate-500 font-mono">Max 15 recent entries</span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.04] text-slate-400 font-semibold border-b border-white/10">
                      <th className="py-2.5 px-3">Provider / Wall</th>
                      <th className="py-2.5 px-3 text-right">Coins Credited</th>
                      <th className="py-2.5 px-3">Credit Date</th>
                      <th className="py-2.5 px-3">Credit Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {modalLoading ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                          <RefreshCw className="w-4 h-4 animate-spin text-brand-400 inline mr-2" />
                          Loading recent activity...
                        </td>
                      </tr>
                    ) : userActivity.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                          No recent offerwall completions recorded for this user.
                        </td>
                      </tr>
                    ) : (
                      userActivity.map((act) => (
                        <tr key={act.id} className="hover:bg-white/[0.02] text-slate-300">
                          <td className="py-2.5 px-3 font-sans font-semibold text-emerald-400">
                            {act.offer_wall_name}
                          </td>
                          <td className="py-2.5 px-3 text-right text-brand-400 font-bold">
                            +{formatCoins(act.currency_reward)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {act.credit_date}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {act.credit_time}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
