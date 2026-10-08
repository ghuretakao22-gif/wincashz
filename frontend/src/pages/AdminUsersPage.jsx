import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShieldCheck, Ban, CheckCircle2, User, RefreshCw, AlertCircle, Copy, Check, Eye, X, Coins, FileSpreadsheet, Wallet, RotateCcw, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import TableExport from '../components/TableExport';
import { api, parseUsersResponse, getProviderUserId } from '../services/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [paginationInfo, setPaginationInfo] = useState({ currentPage: 1, lastPage: 1, perPage: 25, total: 0, from: 0, to: 0 });
  const [copiedId, setCopiedId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [parseError, setParseError] = useState(null);

  // User History Detail Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  const [userChargebacks, setUserChargebacks] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'withdrawals' | 'chargebacks'

  const fetchUsers = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setApiError(null);
    setParseError(null);
    try {
      const params = {
        page: currentPage,
        per_page: rowsPerPage,
      };
      if (search.trim()) {
        params.search = search.trim();
      }
      const res = await api.getAdminUsers(params);
      const list = parseUsersResponse(res);
      if (list === null) {
        setParseError('Users API response structure could not be parsed into a valid list format.');
        setUsers([]);
      } else {
        setUsers(list);
        if (res.pagination) {
          setPaginationInfo(res.pagination);
        } else {
          setPaginationInfo({
            currentPage: 1,
            lastPage: 1,
            perPage: list.length || 25,
            total: list.length || 0,
            from: list.length ? 1 : 0,
            to: list.length,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load users from backend:', err);
      if (!isBackground) setApiError(err.message || 'Failed to connect to backend users API.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentPage, rowsPerPage, search]);

  useEffect(() => {
    fetchUsers();

    const interval = setInterval(() => {
      fetchUsers(true);
    }, 20000);

    const handleSync = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setUsers(e.detail);
      }
    };
    window.addEventListener('wincashz-users-sync', handleSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('wincashz-users-sync', handleSync);
    };
  }, [fetchUsers]);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleInspectUser = async (u) => {
    const uid = getProviderUserId(u);
    setSelectedUser(u);
    setActiveTab('tasks');
    setModalLoading(true);
    try {
      const [tasksRes, withRes, cbRes] = await Promise.allSettled([
        api.getAdminCompletedTasks(),
        api.getAdminAllWithdrawals ? api.getAdminAllWithdrawals() : api.getAdminPendingWithdrawals(),
        api.getAdminChargebacks(),
      ]);

      if (tasksRes.status === 'fulfilled') {
        const allTasks = tasksRes.value?.tasks || tasksRes.value?.completed_tasks || tasksRes.value?.data || (Array.isArray(tasksRes.value) ? tasksRes.value : []);
        setUserTasks(allTasks.filter(t => String(t.user_id) === String(uid) || String(t.user_id) === String(u.id)));
      } else {
        setUserTasks([]);
      }

      if (withRes.status === 'fulfilled') {
        const allWith = withRes.value?.withdrawals || withRes.value?.all_withdrawals || withRes.value?.data || (Array.isArray(withRes.value) ? withRes.value : []);
        setUserWithdrawals(allWith.filter(w => String(w.user_id) === String(uid) || String(w.user_id) === String(u.id)));
      } else {
        setUserWithdrawals([]);
      }

      if (cbRes.status === 'fulfilled') {
        const allCb = cbRes.value?.chargebacks || cbRes.value?.data || (Array.isArray(cbRes.value) ? cbRes.value : []);
        setUserChargebacks(allCb.filter(c => String(c.user_id) === String(uid) || String(c.user_id) === String(u.id)));
      } else {
        setUserChargebacks([]);
      }
    } catch (e) {
      console.warn('Failed to load user history:', e);
    } finally {
      setModalLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const uid = String(getProviderUserId(u));
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.ip || '').toLowerCase().includes(q) ||
      (u.country || '').toLowerCase().includes(q) ||
      uid.includes(q) ||
      String(u.id).includes(q)
    );
  });

  const renderUserDetailsModal = () => {
    if (!selectedUser) return null;

    const uid = getProviderUserId(selectedUser);
    const rawBalance = Number(selectedUser.balance || 0);
    const currentBalanceCoins = Math.round(rawBalance >= 100 ? rawBalance : rawBalance * 1000);
    const totalCoinsEarned = userTasks.reduce((s, t) => s + Number(t.reward || t.points || 0), 0);
    const dateTimeParts = (selectedUser.created_at || '').split(' ');
    const regDate = dateTimeParts[0] || '—';
    const regTime = dateTimeParts[1] || '—';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6">
          {/* SECTION A: User Identity Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center font-bold text-base font-mono">
                {uid}
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  {selectedUser.name || selectedUser.username || 'Member Details'}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    selectedUser.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-slate-300'
                  }`}>
                    {selectedUser.role || 'user'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  User ID: <span className="text-brand-400 font-bold">{uid}</span> • {selectedUser.email}
                </p>
              </div>
            </div>

            <button onClick={() => setSelectedUser(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SECTION A & D: User Bio, IP & Country Specification */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/[0.02] p-4 rounded-2xl border border-white/5">
            <div>
              <span className="text-slate-400 text-[11px] block">Provider User ID</span>
              <span className="font-mono font-bold text-white text-sm">{uid}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Account Status</span>
              <span className={`font-bold ${selectedUser.ban ? 'text-rose-400' : 'text-emerald-400'}`}>
                {selectedUser.ban ? 'Banned' : 'Active Account'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Joined Date & Time</span>
              <span className="text-slate-200 font-mono">{regDate} {regTime}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Registration / Last Known IP</span>
              <span className="text-slate-200 font-mono">{selectedUser.ip || '—'} ({selectedUser.country || '—'})</span>
            </div>
          </div>

          {/* SECTION B: Coin & Activity Summary Cards (No USD/Revenue) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20">
              <span className="text-slate-400 block text-[11px]">Current Coin Balance</span>
              <span className="text-lg font-extrabold text-brand-400">
                {currentBalanceCoins.toLocaleString()} Coins
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-slate-400 block text-[11px]">Total Completed Offers</span>
              <span className="text-lg font-extrabold text-cyan-400">{userTasks.length} Offers</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-slate-400 block text-[11px]">Total Coins Earned</span>
              <span className="text-lg font-extrabold text-amber-400">{totalCoinsEarned.toLocaleString()} Coins</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-slate-400 block text-[11px]">Account Joined</span>
              <span className="text-sm font-extrabold text-purple-300 font-mono">{regDate}</span>
            </div>
          </div>

          {/* Section Heading */}
          <div className="border-b border-white/10 pb-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-400" />
              SECTION C: Completed Offer History ({userTasks.length})
            </h4>
          </div>

          {/* SECTION C: Completed Offer History Table */}
          {modalLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Fetching real user history records...
            </div>
          ) : userTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No completed offer records found for User ID {uid} in database.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                      <th className="py-2.5 px-3 border-r border-white/5 text-center">S.L</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Offerwall</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Offer Name</th>
                      <th className="py-2.5 px-3 border-r border-white/5 text-right">Reward / Coins</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Transaction ID</th>
                      <th className="py-2.5 px-3 border-r border-white/5">IP</th>
                      <th className="py-2.5 px-3 border-r border-white/5 text-center">Country</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Date</th>
                      <th className="py-2.5 px-3 border-r border-white/5">Time</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {userTasks.map((t, idx) => {
                      const coins = Number(t.reward || t.points || 0);
                      const tx = t.transaction_id || `TX-${t.id}`;
                      const taskDateTimeParts = (t.created_at || '').split(' ');
                      const dateStr = taskDateTimeParts[0] || '—';
                      const timeStr = taskDateTimeParts[1] || '—';

                      return (
                        <tr key={t.id || idx} className="hover:bg-white/[0.03]">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans text-slate-200">{t.offerwall_name || 'System'}</td>
                          <td className="py-2 px-3 font-sans font-medium text-white max-w-[180px] truncate" title={t.offer_name}>{t.offer_name || 'Task'}</td>
                          <td className="py-2 px-3 text-right font-bold text-brand-400">{coins.toLocaleString()} Coins</td>
                          <td className="py-2 px-3 text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[120px]" title={tx}>{tx}</span>
                              <button
                                onClick={() => handleCopy(tx, `utx-${t.id}`)}
                                className="p-0.5 text-slate-500 hover:text-white shrink-0"
                                title="Copy Transaction ID"
                              >
                                {copiedId === `utx-${t.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-400">{t.ip || '—'}</td>
                          <td className="py-2 px-3 text-center font-sans text-slate-300">{t.country || '—'}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans">{dateStr}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans">{timeStr}</td>
                          <td className="py-2 px-3 text-center font-sans">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              Completed
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-brand-400" />
            Registered Users Table
          </h1>
          <p className="text-xs text-slate-400">
            Dense, copy-friendly table of all registered user and admin accounts with real database user history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TableExport data={filtered} filename="wincashz_users" />
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-200">Database Connection Warning: </span>
              <span>{apiError}</span>
            </div>
          </div>
          <button onClick={fetchUsers} className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors">
            Retry
          </button>
        </div>
      )}

      {parseError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-200">API Response Audit Notice: </span>
              <span>{parseError}</span>
            </div>
          </div>
          <button onClick={fetchUsers} className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-semibold text-xs transition-colors">
            Re-Parse
          </button>
        </div>
      )}

      <div className="p-3 rounded-2xl glass-card border border-white/10 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by User ID, Username, Email, IP, Country..."
            className="w-full bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs font-semibold">Page Size:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setRowsPerPage(val);
                setCurrentPage(1);
              }}
              className="bg-[#0c1015] border border-white/10 text-xs font-bold text-brand-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={250}>250 / page</option>
              <option value={500}>500 / page</option>
              <option value={1000}>1000 / page</option>
              <option value="all">All ({paginationInfo.total.toLocaleString()})</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5 text-center">S.L</th>
                <th className="py-2.5 px-3 border-r border-white/5">User ID</th>
                <th className="py-2.5 px-3 border-r border-white/5">Name / Username</th>
                <th className="py-2.5 px-3 border-r border-white/5">Email</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">Balance / Coins</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">USD Equiv.</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Level</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Country</th>
                <th className="py-2.5 px-3 border-r border-white/5">IP Address</th>
                <th className="py-2.5 px-3 border-r border-white/5">Role</th>
                <th className="py-2.5 px-3 border-r border-white/5">Status</th>
                <th className="py-2.5 px-3">Created Date</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading users from database...' : (parseError || 'No registered user accounts found.')}
                  </td>
                </tr>
              ) : (
                users.map((u, index) => {
                  const uid = getProviderUserId(u);
                  const rawBalance = Number(u.balance || 0);
                  const coins = Math.round(rawBalance >= 100 ? rawBalance : rawBalance * 1000);
                  const usd = (coins / 1000).toFixed(2);
                  const sl = (paginationInfo.from || 1) + index;
                  return (
                    <tr key={u.id || index} className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap">
                      <td className="py-2 px-3 border-r border-white/5 text-center text-slate-500 font-sans">
                        {sl}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="text-brand-400 font-mono">{uid}</span>
                          <button
                            onClick={() => handleCopy(String(uid), `uid-${uid}`)}
                            className="p-0.5 text-slate-500 hover:text-white"
                            title="Copy User ID"
                          >
                            {copiedId === `uid-${uid}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 font-sans font-medium text-slate-100">
                        {u.name || u.username || 'User'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 font-sans text-slate-400">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 text-right font-bold text-brand-400">
                        {coins.toLocaleString()} Coins
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 text-right font-bold text-slate-200">
                        ${usd}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 text-center font-sans font-bold text-purple-400">
                        Lvl {u.level || 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 text-center font-sans">
                        {u.country || '—'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 text-slate-400">
                        {u.ip || '—'}
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-300'
                        }`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-white/5 font-sans">
                        {u.ban ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <Ban className="w-3 h-3" /> Banned
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">{u.created_at || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <button
                          onClick={() => handleInspectUser(u)}
                          className="px-2.5 py-1 text-xs font-bold text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg flex items-center gap-1 mx-auto transition-colors"
                          title="View Full User Details & Activity"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl glass-card border border-white/10 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <span>Total Registered Users: <strong className="text-white">{paginationInfo.total.toLocaleString()}</strong></span>
          {rowsPerPage !== 'all' && (
            <span>• Showing {paginationInfo.from || 0} to {paginationInfo.to || 0}</span>
          )}
        </div>

        {rowsPerPage !== 'all' && (
          <div className="flex items-center gap-3">
            <button
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 font-mono text-xs">
              Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{paginationInfo.lastPage || 1}</strong>
            </span>
            <button
              disabled={currentPage >= (paginationInfo.lastPage || 1) || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* USER DETAILS & REAL HISTORY DRAWER / MODAL */}
      {renderUserDetailsModal()}
    </div>
  );
}

