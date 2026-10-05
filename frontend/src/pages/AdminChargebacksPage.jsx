import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import TableExport from '../components/TableExport';
import { api } from '../services/api';

export default function AdminChargebacksPage() {
  const [chargebacks, setChargebacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wallFilter, setWallFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [apiError, setApiError] = useState(null);

  const fetchChargebacks = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.getAdminChargebacks();
      const list = res.chargebacks || res.data || (Array.isArray(res) ? res : []);
      setChargebacks(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load chargebacks from backend:', err);
      setApiError(err.message || 'Failed to connect to backend chargebacks API.');
      setChargebacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChargebacks();
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = chargebacks.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = 
      (c.user_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.offer_name || '').toLowerCase().includes(q) ||
      (c.transaction_id || '').toLowerCase().includes(q) ||
      (c.reason || '').toLowerCase().includes(q) ||
      String(c.user_id || '').includes(q);

    const matchesWall = wallFilter === 'all' || (c.offerwall_name || '').toLowerCase() === wallFilter.toLowerCase();
    return matchesSearch && matchesWall;
  });

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const offerwallNames = Array.from(new Set(chargebacks.map((c) => c.offerwall_name).filter(Boolean)));

  const totalReversedCoins = filtered.reduce((acc, c) => acc + Number(c.reward || 0), 0);
  const totalReversedUSD = filtered.reduce((acc, c) => acc + Number(c.payout || (c.reward || 0) / 1000), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Chargebacks & Reversals Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Dedicated audit table tracking all postback chargebacks, fraud reversals, and deducted user balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TableExport data={filtered} filename="wincashz_chargebacks_audit" />
          <button
            onClick={fetchChargebacks}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Refresh"
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
          <button onClick={fetchChargebacks} className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-semibold text-xs transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl glass-card border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Chargebacks</span>
            <div className="text-2xl font-extrabold text-rose-400 mt-0.5">{filtered.length} incidents</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deducted Coins</span>
            <div className="text-2xl font-extrabold text-white mt-0.5">-{totalReversedCoins.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reversed USD Value</span>
            <div className="text-2xl font-extrabold text-amber-400 mt-0.5">-${totalReversedUSD.toFixed(2)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            $
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl glass-card border border-white/10">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by User ID, Name, Email, Offer, TX ID, Reason..."
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
            className="bg-[#0c1015] border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Offerwalls</option>
            {offerwallNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#0c1015] border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Dense Chargeback Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 select-none whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5 w-12 text-center">S.L</th>
                <th className="py-2.5 px-3 border-r border-white/5">User ID</th>
                <th className="py-2.5 px-3 border-r border-white/5">User Name</th>
                <th className="py-2.5 px-3 border-r border-white/5">Email</th>
                <th className="py-2.5 px-3 border-r border-white/5">Offer Wall</th>
                <th className="py-2.5 px-3 border-r border-white/5 min-w-[160px]">Offer Name</th>
                <th className="py-2.5 px-3 border-r border-white/5">Original TX ID</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">Reversed Coins</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">Payout USD</th>
                <th className="py-2.5 px-3 border-r border-white/5 min-w-[200px]">Reason / Note</th>
                <th className="py-2.5 px-3 border-r border-white/5">IP Address</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Status</th>
                <th className="py-2.5 px-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading chargeback audit log...' : 'No chargeback records found.'}
                  </td>
                </tr>
              ) : (
                paginated.map((item, index) => {
                  const sl = (currentPage - 1) * rowsPerPage + index + 1;
                  const txId = item.transaction_id || `REV-${item.id}`;
                  return (
                    <tr
                      key={item.id || index}
                      className="hover:bg-white/[0.03] transition-colors whitespace-nowrap text-slate-300"
                    >
                      <td className="py-2 px-3 border-r border-white/5 text-center text-slate-500 font-sans">
                        {sl}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-bold text-slate-200">
                        #{item.user_id}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-white">
                        {item.user_name || item.username || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans text-slate-400">
                        {item.email || '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-200 font-medium">
                          {item.offerwall_name || 'Torox'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans font-medium text-slate-100 max-w-[200px] truncate" title={item.offer_name}>
                        {item.offer_name || 'Reversed Offer'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-mono text-slate-400 max-w-[140px] truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" title={txId}>{txId}</span>
                          <button
                            onClick={() => handleCopy(txId, `cb-tx-${item.id}`)}
                            className="p-1 hover:text-white"
                          >
                            {copiedId === `cb-tx-${item.id}` ? <Check className="w-3 h-3 text-rose-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-right font-bold text-rose-400">
                        -{Number(item.reward || item.points || 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-right font-bold text-amber-400">
                        -${Number(item.payout || ((item.reward || 0) / 1000)).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans text-rose-300/90 max-w-[220px] truncate" title={item.reason}>
                        {item.reason || 'Deducted via provider chargeback signal'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-slate-400">
                        {item.ip || '127.0.0.1'}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Reversed
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans">
                        {item.created_at || '—'}
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
    </div>
  );
}
