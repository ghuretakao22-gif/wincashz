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
  const [selectedMonth, setSelectedMonth] = useState('2026-10'); // YYYY-MM or 'all'
  const [selectedDay, setSelectedDay] = useState('all'); // YYYY-MM-DD or 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState('all'); // 25, 50, 100, 250, 500, 'all'
  const [actionError, setActionError] = useState(null);
  const [apiError, setApiError] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setActionError(null);
    setApiError(null);
    try {
      const res = await api.getAdminCompletedTasks();
      const list = res.tasks || res.completed_tasks || res.data || (Array.isArray(res) ? res : []);
      setTasks(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load completed tasks from backend:', err);
      setApiError(err.message || 'Failed to connect to backend completed tasks API.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

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

  // Month options derived from data + defaults
  const monthOptions = useMemo(() => {
    const set = new Set(['2026-10', '2026-09', '2026-08']);
    tasks.forEach(t => {
      const dt = t.created_at || t.date || '';
      if (dt.length >= 7 && dt.startsWith('202')) {
        set.add(dt.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [tasks]);

  // Dynamic Calendar Days for selectedMonth
  const calendarDays = useMemo(() => {
    if (selectedMonth === 'all') return [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (isNaN(year) || isNaN(month)) return [];

    const totalDays = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = tasks.filter(t => {
        const dt = t.created_at || t.date || '';
        return dt.startsWith(dayKey);
      }).length;
      days.push({ day: d, dateKey: dayKey, count });
    }
    return days;
  }, [selectedMonth, tasks]);

  // Multi-tier Filtering
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const dtStr = t.created_at || t.date || '';
      const dateKey = dtStr.substring(0, 10);
      const monthKey = dtStr.substring(0, 7);

      const matchesSearch = !search.trim() || 
        (t.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.offer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.transaction_id || '').toLowerCase().includes(search.toLowerCase()) ||
        String(t.user_id || '').includes(search);
      
      const matchesWall = wallFilter === 'all' || (t.offerwall_name || '').toLowerCase() === wallFilter.toLowerCase();
      const matchesMonth = selectedMonth === 'all' || monthKey === selectedMonth;
      const matchesDay = selectedDay === 'all' || dateKey === selectedDay;
      const matchesFrom = !fromDate || dateKey >= fromDate;
      const matchesTo = !toDate || dateKey <= toDate;

      return matchesSearch && matchesWall && matchesMonth && matchesDay && matchesFrom && matchesTo;
    });
  }, [tasks, search, wallFilter, selectedMonth, selectedDay, fromDate, toDate]);

  // Page Size & Pagination
  const limit = rowsPerPage === 'all' ? (filtered.length || 1) : Number(rowsPerPage);
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filtered.length / limit) || 1;
  const paginated = rowsPerPage === 'all' ? filtered : filtered.slice((currentPage - 1) * limit, currentPage * limit);

  const offerwallNames = Array.from(new Set(tasks.map((t) => t.offerwall_name).filter(Boolean)));
  const [selectedTask, setSelectedTask] = useState(null);

  // Active Filter Summary label
  const filterSummary = useMemo(() => {
    let mLabel = selectedMonth === 'all' ? 'All Months' : selectedMonth;
    if (selectedMonth !== 'all') {
      try {
        const [y, m] = selectedMonth.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        mLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      } catch (e) {}
    }
    const dLabel = selectedDay !== 'all' ? selectedDay : 'All Days';
    return `${mLabel} • ${dLabel} • ${filtered.length.toLocaleString()} Offers`;
  }, [selectedMonth, selectedDay, filtered.length]);

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
            data={filtered} 
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
              <option value="all">All ({filtered.length.toLocaleString()})</option>
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
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading completed offers...' : 'No completed offers found.'}
                  </td>
                </tr>
              ) : (
                paginated.map((item, index) => {
                  const sl = (currentPage - 1) * rowsPerPage + index + 1;
                  const uid = item.user_id ? (Number(item.user_id) >= 101 ? item.user_id : 100 + Number(item.user_id)) : '101';
                  const txId = item.transaction_id || `TX-${item.id}`;
                  const coins = Number(item.reward || item.points || 0);
                  const offerVal = Number(item.offer_value ?? item.value ?? item.payout ?? (coins ? coins / 1000 : 0));
                  const siteRev = Number(item.site_revenue ?? item.revenue ?? (offerVal * 0.7));
                  const dateTimeStr = item.created_at || '2026-10-02 22:50:00';
                  const parts = dateTimeStr.split(' ');
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
                        {uid}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-white">
                        {item.user_name || item.name || item.username || 'Member'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans text-slate-400">
                        {item.email || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-200 font-medium">
                          {item.offerwall_name || 'System'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-slate-100 max-w-[180px] truncate" title={item.offer_name}>
                        {item.offer_name || 'Offer Task'}
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
                          <span className="truncate" title={txId}>{txId}</span>
                          <button
                            onClick={() => handleCopy(txId, `tx-${item.id}`)}
                            className="p-1 hover:text-white shrink-0"
                            title="Copy Transaction ID"
                          >
                            {copiedId === `tx-${item.id}` ? <Check className="w-3 h-3 text-brand-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center text-slate-400">
                        {item.ip || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-sans font-semibold text-slate-300">
                        {item.country || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-slate-400 font-sans">
                        {dateVal}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-slate-400 font-sans">
                        {timeVal}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedTask(item)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-brand-400 transition-colors"
                            title="View Full Transaction Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
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

        {/* Pagination Bottom Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-t border-white/5 text-xs text-slate-400">
          <div>
            Showing {filtered.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length} entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-white">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FULL TRANSACTION DETAILS MODAL */}
      {selectedTask && (() => {
        const uid = selectedTask.user_id ? (Number(selectedTask.user_id) >= 101 ? selectedTask.user_id : 100 + Number(selectedTask.user_id)) : '101';
        const txId = selectedTask.transaction_id || `TX-${selectedTask.id}`;
        const coins = Number(selectedTask.reward || selectedTask.points || 0);
        const offerVal = Number(selectedTask.offer_value ?? selectedTask.value ?? selectedTask.payout ?? (coins ? coins / 1000 : 0));
        const siteRev = Number(selectedTask.site_revenue ?? selectedTask.revenue ?? (offerVal * 0.7));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl rounded-3xl glass-panel border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Transaction Log Details</h3>
                    <p className="text-xs text-slate-400 font-mono">TX: {txId}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Provider User ID</span>
                  <span className="font-mono font-bold text-brand-400 text-sm">{uid}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Member Account</span>
                  <span className="font-bold text-white">{selectedTask.user_name || selectedTask.name || 'Member'} ({selectedTask.email || '—'})</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Offerwall Provider</span>
                  <span className="font-bold text-slate-200">{selectedTask.offerwall_name || 'Torox'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Offer Task Title</span>
                  <span className="font-bold text-slate-100">{selectedTask.offer_name || 'Task Completion'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20">
                  <span className="text-slate-400 text-[11px] block">Reward Credited</span>
                  <span className="font-extrabold text-brand-400 text-sm">+{coins.toLocaleString()} Coins</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-slate-400 text-[11px] block">Offer Value (USD)</span>
                  <span className="font-extrabold text-amber-400 text-sm">${offerVal.toFixed(2)} USD</span>
                </div>
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-slate-400 text-[11px] block">Site Revenue</span>
                  <span className="font-extrabold text-purple-400 text-sm">${siteRev.toFixed(2)} USD</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400 text-[11px] block">Recorded IP & Country</span>
                  <span className="font-mono text-slate-300">{selectedTask.ip || '—'} ({selectedTask.country || '—'})</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div>Date & Time: <span className="text-white font-mono">{selectedTask.created_at || '—'}</span></div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-all"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
