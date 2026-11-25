import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, 
  Search, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Hourglass, 
  DollarSign, 
  ShieldCheck, 
  Eye, 
  FileText, 
  Power, 
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminMyIdPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Settings & Summary
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [updatingSetting, setUpdatingSetting] = useState(false);
  const [summary, setSummary] = useState({
    total_requests: 0,
    waiting: 0,
    completed: 0,
    total_payable_bdt: 0,
    total_paid_bdt: 0,
  });

  // Filters & Data
  const [requests, setRequests] = useState([]);
  const [months, setMonths] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  // Modal / Status Edit State
  const [editingPayout, setEditingPayout] = useState(null);
  const [newStatus, setNewStatus] = useState('waiting');
  const [adminNotes, setAdminNotes] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Format YYYY-MM label
  const formatMonthLabel = (m) => {
    if (!m || m === 'all') return 'All Months';
    const [year, month] = m.split('-');
    if (!year || !month) return m;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const fetchPayouts = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: 20,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (monthFilter !== 'all') params.month = monthFilter;

      const res = await api.getAdminMyIdPayouts(params);
      if (res && res.success) {
        setRequests(res.data || []);
        setSummary(res.summary || {
          total_requests: 0,
          waiting: 0,
          completed: 0,
          total_payable_bdt: 0,
          total_paid_bdt: 0,
        });
        setMonths(res.months || []);
        setPayoutEnabled(!!res.payout_enabled);
        if (res.pagination) {
          setPagination(res.pagination);
          setCurrentPage(res.pagination.current_page);
        }
      } else {
        setError(res?.message || 'Failed to fetch payout requests.');
      }
    } catch (err) {
      setError(err?.message || 'Network error fetching payout requests.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, monthFilter]);

  useEffect(() => {
    fetchPayouts(1);
  }, [fetchPayouts]);

  // Toggle Global Setting
  const handleTogglePayoutSetting = async () => {
    const nextState = !payoutEnabled;
    setUpdatingSetting(true);
    try {
      const res = await api.updateAdminMyIdPayoutSettings({ payout_enabled: nextState });
      if (res && res.success) {
        setPayoutEnabled(nextState);
        setSuccessMsg(nextState ? 'Global payout submissions are now ENABLED.' : 'Global payout submissions are now DISABLED.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert(res?.message || 'Failed to update setting.');
      }
    } catch (err) {
      alert(err?.message || 'Error updating payout setting.');
    } finally {
      setUpdatingSetting(false);
    }
  };

  // Open Status Edit Modal
  const openEditModal = (p) => {
    setEditingPayout(p);
    setNewStatus(p.status);
    setAdminNotes(p.admin_notes || '');
  };

  const closeEditModal = () => {
    setEditingPayout(null);
    setSavingStatus(false);
  };

  // Save Status
  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!editingPayout) return;

    setSavingStatus(true);
    try {
      const res = await api.updateAdminMyIdPayoutStatus(editingPayout.id, {
        status: newStatus,
        admin_notes: adminNotes,
      });

      if (res && res.success) {
        setSuccessMsg(`Payout #${editingPayout.id} status updated to ${newStatus.toUpperCase()}`);
        setTimeout(() => setSuccessMsg(null), 4000);
        closeEditModal();
        fetchPayouts(currentPage);
      } else {
        alert(res?.message || 'Failed to update status.');
      }
    } catch (err) {
      alert(err?.message || 'Error saving status update.');
    } finally {
      setSavingStatus(false);
    }
  };

  // Status badge style helper
  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'waiting') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Hourglass className="w-3 h-3 animate-spin" />
          WAITING
        </span>
      );
    }
    if (s === 'review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <Clock className="w-3 h-3" />
          REVIEW
        </span>
      );
    }
    if (s === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <CheckCircle2 className="w-3 h-3" />
          ACCEPTED
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3 h-3" />
          PAID
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <AlertCircle className="w-3 h-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  // Payment method badge helper
  const getMethodBadge = (method) => {
    const m = String(method || '').toLowerCase();
    if (m === 'bkash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E2136E]/15 text-[#FF2E93] border border-[#E2136E]/40">
          <Smartphone className="w-3 h-3" />
          bKash
        </span>
      );
    }
    if (m === 'nagad') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/40">
          <Smartphone className="w-3 h-3" />
          Nagad
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/40">
        <Building2 className="w-3 h-3" />
        Bank
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d121a] p-5 rounded-2xl border border-white/5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <CreditCard className="w-7 h-7 text-brand-400" />
            My ID Payout Requests
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review monthly payout requests from My ID holders, manage status workflows, and track paid disbursements.
          </p>
        </div>

        {/* Global ON/OFF Switch & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePayoutSetting}
            disabled={updatingSetting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              payoutEnabled
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
            }`}
            title="Toggle global payout request ability for moderators"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Requests: {payoutEnabled ? 'ACTIVE' : 'PAUSED'}</span>
          </button>

          <button
            onClick={() => fetchPayouts(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95"
            title="Refresh requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Requests */}
        <div className="bg-[#0e141e] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Requests</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {summary.total_requests}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">All time submissions</div>
        </div>

        {/* Waiting */}
        <div className="bg-[#0e141e] border border-amber-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">Waiting Review</span>
            <Hourglass className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-2">
            {summary.waiting}
          </div>
          <div className="text-[11px] text-amber-500/80 mt-1">Action required</div>
        </div>

        {/* Completed */}
        <div className="bg-[#0e141e] border border-emerald-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Completed</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-2">
            {summary.completed}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Successfully paid</div>
        </div>

        {/* Total Payable BDT */}
        <div className="bg-[#0e141e] border border-sky-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-sky-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-400">Payable BDT</span>
            <span className="text-xs font-black text-sky-400">৳</span>
          </div>
          <div className="text-2xl font-black text-sky-300 mt-2">
            ৳{Number(summary.total_payable_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-sky-500/80 mt-1">Waiting / In-flight</div>
        </div>

        {/* Total Paid BDT */}
        <div className="bg-[#0e141e] border border-brand-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-brand-500/5 to-transparent col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-400">Total Paid BDT</span>
            <DollarSign className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-brand-300 mt-2">
            ৳{Number(summary.total_paid_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-brand-500/80 mt-1">Disbursed to moderators</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0d121a] border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by My ID, friendly name, or payment details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0e141e] text-slate-200">All Months</option>
              {months.map(m => (
                <option key={m} value={m} className="bg-[#0e141e] text-slate-200">
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0e141e]">All Statuses</option>
            <option value="waiting" className="bg-[#0e141e]">Waiting</option>
            <option value="review" className="bg-[#0e141e]">Review</option>
            <option value="accepted" className="bg-[#0e141e]">Accepted</option>
            <option value="completed" className="bg-[#0e141e]">Completed</option>
            <option value="rejected" className="bg-[#0e141e]">Rejected</option>
          </select>
        </div>
      </div>

      {/* Payout Requests Table */}
      <div className="bg-[#0d121a] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#080c12] text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-white/5">
              <tr>
                <th className="py-3 px-4">My ID / Holder</th>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4 text-center">Offers</th>
                <th className="py-3 px-4 text-right">USD Earn</th>
                <th className="py-3 px-4 text-right">Payable BDT</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Account Details</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    Loading payout requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    No payout requests found matching the current filters.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* My ID / Holder */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          {req.my_id_code}
                        </span>
                        {req.friendly_name && (
                          <span className="text-slate-300 text-xs">
                            ({req.friendly_name})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Req ID #{req.id}
                      </div>
                    </td>

                    {/* Month */}
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {formatMonthLabel(req.payout_month)}
                    </td>

                    {/* Offers */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-bold">
                        {req.total_offers}
                      </span>
                    </td>

                    {/* USD */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(req.total_usd || 0).toFixed(2)}
                    </td>

                    {/* BDT */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-300">
                      ৳{Number(req.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Method */}
                    <td className="py-3.5 px-4">
                      {getMethodBadge(req.payment_method)}
                    </td>

                    {/* Account Details */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {req.payment_method === 'bank' ? (
                        <div className="text-[11px] leading-tight space-y-0.5">
                          <div className="font-bold text-white">{req.payment_details?.bank_name}</div>
                          <div className="font-mono text-slate-400">A/C: {req.payment_details?.account_number}</div>
                          <div className="text-slate-500">Name: {req.payment_details?.account_holder_name}</div>
                          {req.payment_details?.branch_name && (
                            <div className="text-slate-500">Branch: {req.payment_details.branch_name}</div>
                          )}
                        </div>
                      ) : (
                        <div className="font-mono text-xs font-bold text-slate-200">
                          {req.payment_details?.mobile_number || 'N/A'}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(req.status)}
                      {req.admin_notes && (
                        <div className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate mx-auto" title={req.admin_notes}>
                          Note: {req.admin_notes}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openEditModal(req)}
                        className="px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 font-semibold text-xs transition-all active:scale-95"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.last_page > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <span className="font-bold text-white">{pagination.current_page}</span> of{' '}
              <span className="font-bold text-white">{pagination.last_page}</span> ({pagination.total} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPayouts(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchPayouts(currentPage + 1)}
                disabled={currentPage >= pagination.last_page || loading}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Status Modal */}
      {editingPayout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e141e] border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={closeEditModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <CreditCard className="w-5 h-5 text-brand-400" />
              Manage Payout #{editingPayout.id}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              My ID <span className="font-mono font-bold text-white">{editingPayout.my_id_code}</span> — {formatMonthLabel(editingPayout.payout_month)}
            </p>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              {/* Payout Details Summary Box */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Offers:</span>
                  <span className="font-mono font-bold text-white">{editingPayout.total_offers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total USD:</span>
                  <span className="font-mono font-bold text-emerald-400">${Number(editingPayout.total_usd).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payable Amount:</span>
                  <span className="font-mono font-black text-brand-300 text-sm">৳{Number(editingPayout.total_bdt).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1.5">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-bold uppercase text-white">{editingPayout.payment_method}</span>
                </div>
                {editingPayout.payment_method === 'bank' ? (
                  <div className="text-[11px] text-slate-300 bg-white/5 p-2 rounded-lg mt-1">
                    <div>Bank: {editingPayout.payment_details?.bank_name}</div>
                    <div>A/C: {editingPayout.payment_details?.account_number}</div>
                    <div>Holder: {editingPayout.payment_details?.account_holder_name}</div>
                    {editingPayout.payment_details?.branch_name && <div>Branch: {editingPayout.payment_details.branch_name}</div>}
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Number:</span>
                    <span className="font-mono font-bold text-white">{editingPayout.payment_details?.mobile_number}</span>
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Workflow Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="waiting" className="bg-[#0e141e]">WAITING (Under Initial Queue)</option>
                  <option value="review" className="bg-[#0e141e]">REVIEW (Auditing Offers)</option>
                  <option value="accepted" className="bg-[#0e141e]">ACCEPTED (Approved - Sending Money)</option>
                  <option value="completed" className="bg-[#0e141e]">COMPLETED (Disbursed / Paid)</option>
                  <option value="rejected" className="bg-[#0e141e]">REJECTED (Declined)</option>
                </select>
              </div>

              {/* Admin Notes / Transaction ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admin Notes / TrxID (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Paid via bKash TrxID #89283492 or reason for review..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-black transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingStatus ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Save Status
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
