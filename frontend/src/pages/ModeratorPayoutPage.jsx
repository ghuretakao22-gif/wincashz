import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Calendar, 
  Coins, 
  DollarSign, 
  Layers, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Hourglass, 
  ShieldCheck, 
  Smartphone, 
  Building2, 
  Send,
  Info,
  Lock,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorPayoutPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Core Data
  const [payoutData, setPayoutData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState([]);

  // Form State
  const [paymentMethod, setPaymentMethod] = useState('bkash'); // bkash, nagad, bank
  const [mobileNumber, setMobileNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [formError, setFormError] = useState(null);

  // Format YYYY-MM label
  const formatMonthLabel = (m) => {
    if (!m) return '';
    const [year, month] = m.split('-');
    if (!year || !month) return m;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const fetchPayoutDetails = useCallback(async (monthToFetch) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (monthToFetch) {
        params.month = monthToFetch;
      }
      const res = await api.getModeratorPayouts(params);
      if (res && res.status === 'success' && res.data) {
        setPayoutData(res.data);
        setMonths(res.data.months || []);
        setSelectedMonth(res.data.selected_month || '');
      } else {
        setError(res?.message || 'Failed to load payout details.');
      }
    } catch (err) {
      setError(err?.message || 'Network error loading payout details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayoutDetails();

    // Pre-fill payout default preferences from moderator settings if configured
    api.getModeratorSettings()
      .then((res) => {
        const pref = res?.data?.payout_preferences;
        if (pref) {
          if (pref.default_method) setPaymentMethod(pref.default_method);
          if (pref.account_number) {
            setMobileNumber(pref.account_number);
            setAccountNumber(pref.account_number);
          }
          if (pref.account_holder_name) setAccountHolderName(pref.account_holder_name);
          if (pref.bank_name) setBankName(pref.bank_name);
          if (pref.branch_name) setBranchName(pref.branch_name);
        }
      })
      .catch(() => {});
  }, [fetchPayoutDetails]);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchPayoutDetails(newMonth);
    setSuccessMsg(null);
    setFormError(null);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    // Frontend validations
    if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      const cleanNum = mobileNumber.trim();
      if (!cleanNum) {
        setFormError(`Please enter your ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} mobile number.`);
        return;
      }
      if (cleanNum.length < 11 || !/^[0-9+\s-]+$/.test(cleanNum)) {
        setFormError('Please enter a valid 11-digit mobile number.');
        return;
      }
    } else if (paymentMethod === 'bank') {
      if (!accountHolderName.trim()) {
        setFormError('Account holder name is required.');
        return;
      }
      if (!accountNumber.trim()) {
        setFormError('Bank account number is required.');
        return;
      }
      if (!bankName.trim()) {
        setFormError('Bank name is required.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        month: selectedMonth,
        payment_method: paymentMethod,
      };

      if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
        payload.mobile_number = mobileNumber.trim();
      } else if (paymentMethod === 'bank') {
        payload.account_holder_name = accountHolderName.trim();
        payload.account_number = accountNumber.trim();
        payload.bank_name = bankName.trim();
        if (branchName.trim()) {
          payload.branch_name = branchName.trim();
        }
      }

      const res = await api.submitModeratorPayout(payload);
      if (res && (res.status === 'success' || res.data)) {
        setSuccessMsg(`Payout request for ${formatMonthLabel(selectedMonth)} submitted successfully!`);
        // Reset inputs
        setMobileNumber('');
        setAccountHolderName('');
        setAccountNumber('');
        setBankName('');
        setBranchName('');
        // Refresh details
        fetchPayoutDetails(selectedMonth);
      } else {
        setFormError(res?.message || 'Failed to submit payout request.');
      }
    } catch (err) {
      setFormError(err?.message || 'Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for status badge
  const renderStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'WAITING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Hourglass className="w-3.5 h-3.5 animate-spin" />
          WAITING FOR REVIEW
        </span>
      );
    }
    if (s === 'REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <Clock className="w-3.5 h-3.5" />
          UNDER REVIEW
        </span>
      );
    }
    if (s === 'ACCEPTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          ACCEPTED / PROCESSING
        </span>
      );
    }
    if (s === 'COMPLETED' || s === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          PAID
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/30">
        NOT REQUESTED
      </span>
    );
  };

  const monthData = payoutData?.selected_month_data || {
    total_offers: 0,
    total_usd: 0,
    total_bdt: 0,
    payout_status: 'NOT_REQUESTED',
    can_submit: false,
    existing_payout: null,
  };

  const history = payoutData?.history || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d121a] p-5 rounded-2xl border border-white/5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <Wallet className="w-7 h-7 text-brand-400" />
            Payout & Withdrawals
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Request and track monthly earnings disbursements for My ID{' '}
            <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-white/5 border border-white/10">
              {payoutData?.my_id || '---'}
            </span>
            {payoutData?.friendly_name && (
              <span className="text-slate-300 ml-1">({payoutData.friendly_name})</span>
            )}
          </p>
        </div>

        {/* Month Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2">
            <Calendar className="w-4 h-4 text-brand-400" />
            <select
              value={selectedMonth}
              onChange={handleMonthChange}
              disabled={loading || months.length === 0}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {months.map((m) => (
                <option key={m} value={m} className="bg-[#0e141e] text-slate-200">
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchPayoutDetails(selectedMonth)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95"
            title="Refresh details"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Payout Disabled Alert Banner */}
      {payoutData && !payoutData.payout_enabled && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold">Payout Requests Paused</div>
            <div className="text-xs text-amber-400/80 mt-0.5">
              Monthly payout request submissions are temporarily disabled by the administrator. Please check back later.
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Month Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Selected Month */}
        <div className="bg-[#0e141e] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Payable Period</span>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-lg font-bold text-white mt-2 truncate">
            {formatMonthLabel(selectedMonth)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Calendar month cycle</div>
        </div>

        {/* Completed Offers */}
        <div className="bg-[#0e141e] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Completed Offers</span>
            <Layers className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">
            {monthData.total_offers}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Matched payout rules</div>
        </div>

        {/* Total USD */}
        <div className="bg-[#0e141e] border border-emerald-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span>Total USD Earn</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-2 font-mono">
            ${Number(monthData.total_usd || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Snapshot ledger total</div>
        </div>

        {/* Total BDT (Payable Amount) */}
        <div className="bg-[#0e141e] border border-brand-500/20 p-4 rounded-2xl relative overflow-hidden bg-gradient-to-b from-brand-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-brand-400">
            <span>Payable Amount</span>
            <span className="text-xs font-black text-brand-400">৳</span>
          </div>
          <div className="text-2xl font-black text-brand-300 mt-2 font-mono">
            ৳{Number(monthData.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-brand-500/80 mt-1">Status: {monthData.payout_status}</div>
        </div>
      </div>

      {/* Main Action Panel: Payout Request Form OR Status Display */}
      <div className="bg-[#0d121a] border border-white/5 rounded-2xl p-6 shadow-xl">
        {monthData.existing_payout ? (
          /* ALREADY REQUESTED STATE */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-400" />
                  Payout Request Submitted for {formatMonthLabel(selectedMonth)}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  You have already submitted a payout request for this month. A month cannot be requested twice.
                </p>
              </div>
              <div>
                {renderStatusBadge(monthData.existing_payout.status)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                <div className="text-xs text-slate-400">Payment Method</div>
                <div className="text-sm font-bold text-white uppercase mt-1 flex items-center gap-2">
                  {monthData.existing_payout.payment_method === 'bank' ? (
                    <Building2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-brand-400" />
                  )}
                  {monthData.existing_payout.payment_method}
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                <div className="text-xs text-slate-400">Payable Amount</div>
                <div className="text-base font-black text-brand-300 font-mono mt-1">
                  ৳{Number(monthData.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 ml-1.5">
                    (${Number(monthData.total_usd || 0).toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                <div className="text-xs text-slate-400">Destination Details</div>
                <div className="text-xs text-white font-mono mt-1">
                  {monthData.existing_payout.payment_method === 'bank' ? (
                    <div>
                      <div>{monthData.existing_payout.payment_details?.bank_name}</div>
                      <div className="text-slate-400">A/C: {monthData.existing_payout.payment_details?.account_number}</div>
                    </div>
                  ) : (
                    <div>{monthData.existing_payout.payment_details?.mobile_number || 'N/A'}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-300">
              <Info className="w-4 h-4 text-brand-400 shrink-0" />
              <span>
                Our finance team reviews requests sequentially. Once processed, status will transition to{' '}
                <strong className="text-emerald-400">PAID</strong> and disbursement will reflect in your account.
              </span>
            </div>
          </div>
        ) : monthData.can_submit ? (
          /* SUBMIT REQUEST FORM */
          <div>
            <div className="border-b border-white/5 pb-4 mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-400" />
                Submit Payout Request for {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select your preferred cashout method and enter your accurate payment receiving details.
              </p>
            </div>

            {formError && (
              <div className="p-3.5 mb-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-6">
              {/* Payment Method Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                  1. Select Payment Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* bKash */}
                  <label
                    onClick={() => setPaymentMethod('bkash')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'bkash'
                        ? 'bg-[#E2136E]/15 border-[#E2136E] text-white shadow-lg shadow-[#E2136E]/10'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="bkash"
                      checked={paymentMethod === 'bkash'}
                      onChange={() => setPaymentMethod('bkash')}
                      className="sr-only"
                    />
                    <div className="w-8 h-8 rounded-lg bg-[#E2136E]/20 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-[#FF2E93]" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">bKash</div>
                      <div className="text-[11px] text-slate-400">Personal / Agent</div>
                    </div>
                  </label>

                  {/* Nagad */}
                  <label
                    onClick={() => setPaymentMethod('nagad')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'nagad'
                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="nagad"
                      checked={paymentMethod === 'nagad'}
                      onChange={() => setPaymentMethod('nagad')}
                      className="sr-only"
                    />
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Nagad</div>
                      <div className="text-[11px] text-slate-400">Personal / Agent</div>
                    </div>
                  </label>

                  {/* Bank */}
                  <label
                    onClick={() => setPaymentMethod('bank')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'bank'
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="bank"
                      checked={paymentMethod === 'bank'}
                      onChange={() => setPaymentMethod('bank')}
                      className="sr-only"
                    />
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Bank Transfer</div>
                      <div className="text-[11px] text-slate-400">Any Bangladesh Bank</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dynamic Input Fields */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Enter Payment Details
                </label>

                {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} Mobile Number (11 Digits)
                    </label>
                    <input
                      type="text"
                      placeholder="017XXXXXXXX or 018XXXXXXXX"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                      required
                    />
                  </div>
                )}

                {paymentMethod === 'bank' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Account Holder Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mohammad Rahim"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Bank Account Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2050123456789"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Bank Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Islami Bank Bangladesh Ltd / DBBL"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Branch Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dhanmondi Branch"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation Summary & Submit Button */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">Total Payable Amount:</div>
                  <div className="text-xl font-black text-brand-300 font-mono">
                    ৳{Number(monthData.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs text-emerald-400 font-normal ml-2">
                      (${Number(monthData.total_usd || 0).toFixed(2)})
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-600 text-black transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-brand-500/20"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Request Payout
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* NOT ELIGIBLE / 0 EARNINGS */
          <div className="py-8 text-center text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
            <div className="font-bold text-white">No Eligible Earnings to Request</div>
            <div className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              There are no completed offers with matched payout rules recorded for {formatMonthLabel(selectedMonth)}. Payout requests require at least 1 completed eligible offer.
            </div>
          </div>
        )}
      </div>

      {/* Monthly Payout History */}
      <div className="bg-[#0d121a] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-400" />
            Monthly Payout History
          </h3>
          <span className="text-xs text-slate-400">{history.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#080c12] text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4 text-center">Offers</th>
                <th className="py-3 px-4 text-right">USD Earn</th>
                <th className="py-3 px-4 text-right">Payable BDT</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Requested Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-slate-500">
                    No payout request history found for My ID {payoutData?.my_id}.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {formatMonthLabel(h.month)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">
                      {h.offers}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(h.usd || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-brand-300">
                      ৳{Number(h.bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 uppercase font-bold text-white text-[11px]">
                      {h.method}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {h.method === 'bank' ? (
                        <span>{h.details?.bank_name} ({h.details?.account_number})</span>
                      ) : (
                        <span>{h.details?.mobile_number}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(h.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                      {h.requested_date || 'N/A'}
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
