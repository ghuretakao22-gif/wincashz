import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Trash2, 
  ShieldCheck, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Eye,
  AlertCircle,
  Calendar,
  CalendarDays,
  FileSpreadsheet
} from 'lucide-react';
import TableExport from '../components/TableExport';
import { api } from '../services/api';

export default function AdminCompletedOffersPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wallFilter, setWallFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all'); // YYYY-MM or 'all'
  const [selectedDay, setSelectedDay] = useState('all'); // YYYY-MM-DD or 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25); // 25, 50, 100, 250, 500, 1000, 'all'
  const [paginationInfo, setPaginationInfo] = useState({ currentPage: 1, lastPage: 1, perPage: 25, total: 0, from: 0, to: 0 });
  const [actionError, setActionError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [availableOfferwalls, setAvailableOfferwalls] = useState([]);

  useEffect(() => {
    api.getOfferwalls().then((res) => {
      const list = res.offerwalls || [];
      const names = list.map((w) => w.name || w.postback_slug).filter(Boolean);
      setAvailableOfferwalls(names);
    }).catch(() => {});
  }, []);

  const fetchTasks = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setActionError(null);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        per_page: rowsPerPage,
      };
      if (search.trim()) params.search = search.trim();
      if (wallFilter && wallFilter !== 'all') params.wall = wallFilter;
      if (selectedDay && selectedDay !== 'all') {
        params.from_date = selectedDay;
        params.to_date = selectedDay;
      } else if (selectedMonth && selectedMonth !== 'all') {
        params.month = selectedMonth;
      }
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.getAdminCompletedTasks(params);
      const list = res.rows || res.tasks || res.completed_tasks || res.data || (Array.isArray(res) ? res : []);
      const normalized = (Array.isArray(list) ? list : []).map((item) => {
        const reward = Number(item.currencyReward ?? item.reward ?? item.points ?? 0);
        const revenue = Number(item.revenue ?? item.site_revenue ?? 0);
        const payout = Number(item.payout ?? item.offer_value ?? item.value ?? revenue);
        const createdAt = item.createdAt ?? item.created_at ?? item.date ?? '—';

        return {
          id: item.id,
          userId: item.userId ?? item.user_id ?? '—',
          userName: item.userName ?? item.user_name ?? item.username ?? '—',
          userEmail: item.userEmail ?? item.email ?? item.user_email ?? '—',
          offerWall: item.offerWall ?? item.offerwall_name ?? item.offer_wall_name ?? '—',
          offerName: item.offerName ?? item.offer_name ?? '—',
          reward,
          revenue,
          payout,
          transactionId: item.transactionId ?? item.transaction_id ?? `TX-${item.id}`,
          ip: item.ip ?? '—',
          country: item.country ?? '—',
          createdAt,
          raw: item,
        };
      });
      setTasks(normalized);
      if (res.pagination) {
        setPaginationInfo(res.pagination);
      } else {
        setPaginationInfo({
          currentPage: 1,
          lastPage: 1,
          perPage: normalized.length || 25,
          total: normalized.length || 0,
          from: normalized.length ? 1 : 0,
          to: normalized.length,
        });
      }
    } catch (err) {
      console.error('Failed to load completed tasks from backend:', err);
      if (!isBackground) setApiError(err.message || 'Failed to connect to backend completed tasks API.');
      if (!isBackground) setTasks([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [currentPage, rowsPerPage, search, wallFilter, selectedMonth, selectedDay, fromDate, toDate]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this completed task entry?')) return;
    try {
      await api.deleteCompletedTask(id);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      setActionError(err.message || 'Failed to delete task.');
    }
  };

  // Month options derived from current date & data
  const monthOptions = useMemo(() => {
    const set = new Set();
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(mStr);
    }
    const safeList = Array.isArray(tasks) ? tasks : [];
    safeList.forEach((t) => {
      const dt = String(t?.createdAt || '');
      if (dt.length >= 7 && dt.startsWith('202')) {
        set.add(dt.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [tasks]);

  // Dynamic Calendar Days for selectedMonth
  const calendarDays = useMemo(() => {
    if (selectedMonth === 'all') return [];
    const [yearStr, monthStr] = String(selectedMonth || '').split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (isNaN(year) || isNaN(month)) return [];

    const totalDays = new Date(year, month, 0).getDate();
    const safeList = Array.isArray(tasks) ? tasks : [];
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = safeList.filter((t) => {
        const dt = String(t?.createdAt || '');
        return dt.startsWith(dayKey);
      }).length;
      days.push({ day: d, dateKey: dayKey, count });
    }
    return days;
  }, [selectedMonth, tasks]);

  const offerwallNames = useMemo(() => {
    const set = new Set(Array.isArray(availableOfferwalls) ? availableOfferwalls : []);
    const safeList = Array.isArray(tasks) ? tasks : [];
    safeList.forEach((t) => {
      if (t?.offerWall && t.offerWall !== '—' && t.offerWall !== '-') {
        set.add(t.offerWall);
      }
    });
    return Array.from(set);
  }, [availableOfferwalls, tasks]);

  // Active Filter Summary label
  const filterSummary = useMemo(() => {
    let mLabel = selectedMonth === 'all' ? 'All Months' : selectedMonth;
    if (selectedMonth !== 'all') {
      try {
        const [y, m] = String(selectedMonth || '').split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        mLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      } catch (e) {}
    }
    const dLabel = selectedDay !== 'all' ? selectedDay : 'All Days';
    const totalCount = Number(paginationInfo?.total || 0);
    return `${mLabel} • ${dLabel} • ${totalCount.toLocaleString()} Total Offers`;
  }, [selectedMonth, selectedDay, paginationInfo?.total]);

  return (
    <div className="space-y-5">
      {/* Header & Export Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-400" />
            Completed Offers & Monthly Export Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit verified offer completions with month/calendar date filtering, page-size options, and instant XLSX export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TableExport 
            data={tasks} 
            allData={tasks} 
            selectedMonth={selectedMonth} 
            selectedDay={selectedDay} 
            filename={`wincashz-completed-offers-${selectedDay !== 'all' ? selectedDay : (selectedMonth !== 'all' ? selectedMonth : 'all-time')}`} 
          />
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Refresh Data from Backend"
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
              <span className="font-bold text-rose-200">Database Connection Error: </span>
              <span>{apiError}</span>
            </div>
          </div>
          <button onClick={fetchTasks} className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors">
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* MONTH & CALENDAR DAY FILTER BAR */}
      <div className="p-4 rounded-3xl glass-card border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-bold text-slate-300">Select Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedDay('all');
                  setCurrentPage(1);
                }}
                className="bg-[#0c1015] border border-white/15 text-xs font-bold text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-400 cursor-pointer"
              >
                <option value="all">All Months (All-Time)</option>
                {monthOptions.map((m) => {
                  let label = m;
                  try {
                    const [y, mon] = m.split('-');
                    label = new Date(Number(y), Number(mon) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                  } catch (e) {}
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10 text-xs text-slate-400">
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                className="bg-black/40 border border-white/10 text-xs text-white rounded-lg px-2 py-1 font-mono"
              />
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                className="bg-black/40 border border-white/10 text-xs text-white rounded-lg px-2 py-1 font-mono"
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Clear Range
                </button>
              )}
            </div>
          </div>

          {/* Filter Summary Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-bold flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-brand-400" />
            <span>{filterSummary}</span>
          </div>
        </div>

        {/* CALENDAR DAY PICKER GRID FOR SELECTED MONTH */}
        {selectedMonth !== 'all' && (
          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Daily Completed Offer Counts ({selectedMonth}):</span>
              <button
                type="button"
                onClick={() => { setSelectedDay('all'); setCurrentPage(1); }}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-all ${
                  selectedDay === 'all' ? 'bg-brand-500 text-slate-950' : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                All Days / Entire Month
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {calendarDays.map(({ day, dateKey, count }) => {
                const isSelected = selectedDay === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDay(isSelected ? 'all' : dateKey);
                      setCurrentPage(1);
                    }}
                    className={`flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-b from-brand-400 to-cyan-400 text-slate-950 border-brand-300 font-extrabold shadow-glow-emerald' 
                        : count > 0 
                          ? 'bg-white/5 border-white/10 text-white hover:border-brand-500/40 hover:bg-white/10' 
                          : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                    title={`${dateKey}: ${count} offers completed`}
                  >
                    <span className="text-[10px] font-bold opacity-80">{day}</span>
                    <span className={`text-[10px] font-extrabold ${isSelected ? 'text-slate-950' : count > 0 ? 'text-brand-400' : 'text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Filter & Page Size Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-card border border-white/10 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by User ID, Name, Email, Offer, TX ID..."
            className="w-full bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={wallFilter}
            onChange={(e) => {
              setWallFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#0c1015] border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Offerwalls</option>
            {offerwallNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

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
              <option value="all">All ({(Number(paginationInfo?.total) || (Array.isArray(tasks) ? tasks.length : 0)).toLocaleString()})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dense 15-Column Data Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 select-none whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5 w-10 text-center">1. S.L</th>
                <th className="py-2.5 px-3 border-r border-white/5">2. User ID</th>
                <th className="py-2.5 px-3 border-r border-white/5">3. Name</th>
                <th className="py-2.5 px-3 border-r border-white/5">4. Email</th>
                <th className="py-2.5 px-3 border-r border-white/5">5. Offerwall</th>
                <th className="py-2.5 px-3 border-r border-white/5 min-w-[160px]">6. Offer Name</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">7. Reward / Coins</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">8. Site Revenue</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">9. Offer Value</th>
                <th className="py-2.5 px-3 border-r border-white/5">10. Transaction ID</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">11. IP</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">12. Country</th>
                <th className="py-2.5 px-3 border-r border-white/5">13. Date</th>
                <th className="py-2.5 px-3 border-r border-white/5">14. Time</th>
                <th className="py-2.5 px-3 text-center">15. Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading completed offers...' : 'No completed offers found.'}
                  </td>
                </tr>
              ) : (
                tasks.map((item, index) => {
                  const sl = (Number(paginationInfo?.from) || 1) + index;
                  const uid = item?.userId ?? '—';
                  const txId = item?.transactionId ?? '—';
                  const coins = Number(item?.reward ?? 0);
                  const offerVal = Number(item?.payout ?? 0);
                  const siteRev = Number(item?.revenue ?? 0);
                  const dateTimeStr = String(item?.createdAt || '');
                  const cleanDT = dateTimeStr.replace('T', ' ').replace('Z', '').split('.')[0];
                  const parts = cleanDT.split(' ');
                  const dateVal = parts[0] || '—';
                  const timeVal = parts[1] || '—';

                  return (
                    <tr
                      key={item.id || index}
                      className="hover:bg-white/[0.03] transition-colors whitespace-nowrap text-slate-300"
                    >
                      <td className="py-2 px-3 border-r border-white/5 text-center text-slate-500 font-sans">
                        {sl}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-bold text-brand-400 font-mono">
                        #{uid}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-white">
                        {item.userName}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans text-slate-400">
                        {item.userEmail}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-200 font-medium">
                          {item.offerWall}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-slate-100 max-w-[180px] truncate" title={item.offerName}>
                        {item.offerName}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-right font-bold text-brand-400">
                        {coins.toLocaleString()} Coins
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-right font-bold text-purple-400">
                        ${siteRev.toFixed(2)} USD
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-right font-bold text-amber-400">
                        ${offerVal.toFixed(2)} USD
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-mono text-slate-400 max-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{txId}</span>
                          <button
                            onClick={() => handleCopy(txId, item.id)}
                            className="text-slate-500 hover:text-white transition-colors shrink-0"
                            title="Copy Transaction ID"
                          >
                            {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-mono text-slate-400">
                        {item.ip}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-sans">
                        {item.country}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-mono text-slate-400">
                        {dateVal}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-mono text-slate-400">
                        {timeVal}
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedTask(item)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          <span>Total Completed Offers: <strong className="text-white">{(Number(paginationInfo?.total) || 0).toLocaleString()}</strong></span>
          {rowsPerPage !== 'all' && (
            <span>• Showing {paginationInfo?.from ?? 0} to {paginationInfo?.to ?? 0}</span>
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
              Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{paginationInfo?.lastPage || 1}</strong>
            </span>
            <button
              disabled={currentPage >= (paginationInfo?.lastPage || 1) || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0e14] border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-400" />
                Task Completion Details
              </h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Transaction ID:</span>
                <span className="text-brand-400 font-bold">{selectedTask.transactionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">User ID / Username:</span>
                <span className="text-white">#{selectedTask.userId} ({selectedTask.userName})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">User Email:</span>
                <span className="text-slate-300 font-sans">{selectedTask.userEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Offerwall Provider:</span>
                <span className="text-white font-sans">{selectedTask.offerWall}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Offer Name:</span>
                <span className="text-slate-200 font-sans">{selectedTask.offerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">User Coins Awarded:</span>
                <span className="text-brand-400 font-bold">{Number(selectedTask.reward || 0).toFixed(2)} Coins</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Site Revenue:</span>
                <span className="text-purple-400 font-bold">${Number(selectedTask.revenue || 0).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">IP / Country:</span>
                <span className="text-slate-300">{selectedTask.ip} ({selectedTask.country})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400 font-sans">Timestamp:</span>
                <span className="text-slate-300">{selectedTask.createdAt}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs hover:brightness-110"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
