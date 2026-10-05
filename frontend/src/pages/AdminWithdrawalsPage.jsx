import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Check, 
  X, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Wallet,
  ShieldCheck 
} from 'lucide-react';
import TableExport from '../components/TableExport';
import { api } from '../services/api';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.getAdminPendingWithdrawals();
      const list = res.withdrawals || res.pending_withdrawals || res.data || (Array.isArray(res) ? res : []);
      setWithdrawals(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load pending withdrawals from backend:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to connect to backend pending withdrawals API.' });
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this withdrawal?`)) return;
    setActionLoading(id);
    setMsg(null);
    try {
      await api.updatePendingWithdrawal(id, action);
      setMsg({ type: 'success', text: `Withdrawal #${id} successfully marked as ${action}!` });
      setWithdrawals(withdrawals.filter((w) => w.id !== id));
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = withdrawals.filter((w) => {
    const q = search.toLowerCase();
    return (
      (w.user_name || '').toLowerCase().includes(q) ||
      (w.user_email || '').toLowerCase().includes(q) ||
      (w.method_name || '').toLowerCase().includes(q) ||
      (w.account || '').toLowerCase().includes(q) ||
      String(w.user_id || '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pending Cashouts Manager</h1>
          <p className="text-xs text-slate-400">
            Review, verify, approve, reject, or refund user withdrawal requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TableExport data={filtered} filename="wincashz_pending_withdrawals" />
          <button
            onClick={fetchWithdrawals}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {msg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Filter */}
      <div className="p-3 rounded-2xl glass-card border border-white/10 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by User ID, Email, Address..."
          className="w-full bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5">ID</th>
                <th className="py-2.5 px-3 border-r border-white/5">User</th>
                <th className="py-2.5 px-3 border-r border-white/5">Email</th>
                <th className="py-2.5 px-3 border-r border-white/5">Method</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-right">Amount ($)</th>
                <th className="py-2.5 px-3 border-r border-white/5">Destination Account</th>
                <th className="py-2.5 px-3 border-r border-white/5">Date Requested</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading requests...' : 'No pending withdrawals found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap">
                    <td className="py-2.5 px-3 border-r border-white/5 font-bold text-white">#{w.id}</td>
                    <td className="py-2.5 px-3 border-r border-white/5 font-sans font-medium text-slate-200">
                      {w.user_name || `User #${w.user_id}`}
                    </td>
                    <td className="py-2.5 px-3 border-r border-white/5 font-sans text-slate-400">{w.user_email || '—'}</td>
                    <td className="py-2.5 px-3 border-r border-white/5 font-sans font-medium text-brand-400">
                      {w.method_name || 'Crypto'}
                    </td>
                    <td className="py-2.5 px-3 border-r border-white/5 text-right font-bold text-white">
                      ${Number(w.amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-white/5 max-w-[200px] truncate text-slate-300" title={w.account}>
                      {w.account}
                    </td>
                    <td className="py-2.5 px-3 border-r border-white/5 font-sans text-slate-400">{w.created_at}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-sans">
                        <button
                          onClick={() => handleAction(w.id, 'approve')}
                          disabled={actionLoading === w.id}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-semibold text-[10px] flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleAction(w.id, 'refund')}
                          disabled={actionLoading === w.id}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-semibold text-[10px] flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Refund
                        </button>
                        <button
                          onClick={() => handleAction(w.id, 'reject')}
                          disabled={actionLoading === w.id}
                          className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-semibold text-[10px] flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
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
