import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Power, 
  X, 
  Check, 
  ArrowLeft, 
  Filter 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminPayoutRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState(null);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [provider, setProvider] = useState('');
  const [offerId, setOfferId] = useState('');
  const [offerName, setOfferName] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [userPayoutUsd, setUserPayoutUsd] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Edit Modal State
  const [editingRule, setEditingRule] = useState(null);
  const [editProvider, setEditProvider] = useState('');
  const [editOfferId, setEditOfferId] = useState('');
  const [editOfferName, setEditOfferName] = useState('');
  const [editCoinAmount, setEditCoinAmount] = useState('');
  const [editUserPayoutUsd, setEditUserPayoutUsd] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const fetchRules = useCallback(async (searchQuery = search, provFilter = providerFilter) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.getAdminPayoutRules({
        search: searchQuery,
        provider: provFilter || undefined,
      });
      const list = res.data || (Array.isArray(res) ? res : []);
      setRules(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load payout rules:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to connect to backend Payout Rules API.' });
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [search, providerFilter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRules(search, providerFilter);
  };

  const handleClearFilters = () => {
    setSearch('');
    setProviderFilter('');
    fetchRules('', '');
  };

  // Toggle active/disabled
  const handleToggleStatus = async (rule) => {
    const nextStatus = !rule.is_active;
    setActionLoading(rule.id);
    setMsg(null);
    try {
      const res = await api.updateAdminPayoutRule(rule.id, { is_active: nextStatus });
      if (res.success) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: nextStatus } : r));
        setMsg({ 
          type: 'success', 
          text: `Rule for ${rule.provider} (${rule.coin_amount} coins) successfully ${nextStatus ? 'enabled' : 'disabled'}.` 
        });
      }
    } catch (err) {
      setMsg({ 
        type: 'error', 
        text: err.message || 'Failed to update rule status.' 
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete rule
  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Are you sure you want to delete this rule for ${rule.provider} (${rule.coin_amount} coins)?`)) {
      return;
    }

    setActionLoading(rule.id);
    setMsg(null);
    try {
      const res = await api.deleteAdminPayoutRule(rule.id);
      if (res.success) {
        setRules(prev => prev.filter(r => r.id !== rule.id));
        setMsg({ type: 'success', text: 'Payout rule deleted successfully.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete rule.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Add rule submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);

    const cleanProvider = provider.trim();
    if (!cleanProvider) {
      setModalError('Please enter a provider name.');
      return;
    }

    if (!coinAmount || isNaN(Number(coinAmount)) || Number(coinAmount) < 0) {
      setModalError('Please enter a valid coin amount (0 or greater).');
      return;
    }

    if (!userPayoutUsd || isNaN(Number(userPayoutUsd)) || Number(userPayoutUsd) < 0) {
      setModalError('Please enter a valid user payout USD (0 or greater).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createAdminPayoutRule({
        provider: cleanProvider,
        offer_id: offerId.trim() || null,
        offer_name: offerName.trim() || null,
        coin_amount: Number(coinAmount),
        user_payout_usd: Number(userPayoutUsd),
        is_active: isActive,
      });

      if (res.success) {
        setShowAddModal(false);
        setProvider('');
        setOfferId('');
        setOfferName('');
        setCoinAmount('');
        setUserPayoutUsd('');
        setIsActive(true);
        setMsg({ type: 'success', text: `Payout rule for ${cleanProvider} created successfully.` });
        fetchRules();
      }
    } catch (err) {
      const validationMsgs = err.errors ? Object.values(err.errors).flat().join(' ') : null;
      setModalError(validationMsgs || err.message || 'Failed to create payout rule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (rule) => {
    setEditingRule(rule);
    setEditProvider(rule.provider || '');
    setEditOfferId(rule.offer_id || '');
    setEditOfferName(rule.offer_name || '');
    setEditCoinAmount(rule.coin_amount !== null ? String(rule.coin_amount) : '');
    setEditUserPayoutUsd(rule.user_payout_usd !== null ? String(rule.user_payout_usd) : '');
    setEditIsActive(!!rule.is_active);
    setEditError(null);
  };

  // Save edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRule) return;
    setEditError(null);

    const cleanProvider = editProvider.trim();
    if (!cleanProvider) {
      setEditError('Please enter a provider name.');
      return;
    }

    if (!editCoinAmount || isNaN(Number(editCoinAmount)) || Number(editCoinAmount) < 0) {
      setEditError('Please enter a valid coin amount (0 or greater).');
      return;
    }

    if (!editUserPayoutUsd || isNaN(Number(editUserPayoutUsd)) || Number(editUserPayoutUsd) < 0) {
      setEditError('Please enter a valid user payout USD (0 or greater).');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await api.updateAdminPayoutRule(editingRule.id, {
        provider: cleanProvider,
        offer_id: editOfferId.trim() || null,
        offer_name: editOfferName.trim() || null,
        coin_amount: Number(editCoinAmount),
        user_payout_usd: Number(editUserPayoutUsd),
        is_active: editIsActive,
      });

      if (res.success) {
        setRules(prev => prev.map(r => r.id === editingRule.id ? res.data : r));
        setEditingRule(null);
        setMsg({ type: 'success', text: `Payout rule #${editingRule.id} updated successfully.` });
      }
    } catch (err) {
      const validationMsgs = err.errors ? Object.values(err.errors).flat().join(' ') : null;
      setEditError(validationMsgs || err.message || 'Failed to update payout rule.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Stats
  const totalCount = rules.length;
  const activeCount = rules.filter(r => r.is_active).length;
  const disabledCount = totalCount - activeCount;
  const uniqueProviders = new Set(rules.map(r => (r.provider || '').toLowerCase()).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">My ID Payout Rules</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Map completed offers (Provider + Offer ID + Coins) to worker USD payout. Unmapped completions remain safe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/my-ids"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>My IDs</span>
          </Link>

          <button
            onClick={() => fetchRules()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Refresh rules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setProvider('');
              setOfferId('');
              setOfferName('');
              setCoinAmount('');
              setUserPayoutUsd('');
              setIsActive(true);
              setModalError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 shadow-glow-emerald cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {msg && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs border ${
          msg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Rules</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Active Rules</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{activeCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Disabled</span>
          <span className="text-2xl font-black text-slate-400 mt-1 block">{disabledCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">Providers Covered</span>
          <span className="text-2xl font-black text-cyan-400 mt-1 block">{uniqueProviders}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 rounded-2xl border border-white/5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by provider, offer ID, offer name, or coins..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
          >
            Filter
          </button>

          {(search || providerFilter) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Rules Table */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Provider</th>
                <th className="py-3.5 px-4">Offer ID / Name</th>
                <th className="py-3.5 px-4">Coins Credited</th>
                <th className="py-3.5 px-4">Worker Payout (USD)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    <span>Loading Payout Rules...</span>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-slate-400">No payout rules found</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {search ? 'Try clearing your search filters' : 'Add your first rule using the button above'}
                    </p>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const isActive = !!rule.is_active;
                  const isActioning = actionLoading === rule.id;
                  const createdDate = rule.created_at ? new Date(rule.created_at).toLocaleDateString() : '-';

                  return (
                    <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Provider */}
                      <td className="py-3 px-4 font-bold text-white">
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          {rule.provider}
                        </span>
                      </td>

                      {/* Offer ID / Name */}
                      <td className="py-3 px-4">
                        <div>
                          {rule.offer_name ? (
                            <span className="font-semibold text-slate-200 block">{rule.offer_name}</span>
                          ) : null}
                          {rule.offer_id ? (
                            <span className="font-mono text-[11px] text-slate-400 block">ID: {rule.offer_id}</span>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">All Offers (Wildcard)</span>
                          )}
                        </div>
                      </td>

                      {/* Coins */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {Number(rule.coin_amount).toLocaleString()} coins
                      </td>

                      {/* Payout USD */}
                      <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                        ${Number(rule.user_payout_usd).toFixed(2)} USD
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {createdDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Edit Rule"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(rule)}
                            disabled={isActioning}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                              isActive
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            }`}
                            title={isActive ? 'Disable Rule' : 'Enable Rule'}
                          >
                            <Power className={`w-3 h-3 ${isActioning ? 'animate-spin' : ''}`} />
                            <span className="text-[11px]">{isActive ? 'Disable' : 'Enable'}</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule)}
                            disabled={isActioning}
                            className="p-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                            title="Delete Rule"
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

      {/* ADD RULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Add New Payout Rule</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Provider <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="e.g. Vortex"
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Offer ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={offerId}
                    onChange={(e) => setOfferId(e.target.value)}
                    placeholder="e.g. prime_video_101"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Offer Name (Optional label)
                </label>
                <input
                  type="text"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  placeholder="e.g. Prime Video"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Credited Coins <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    User Payout USD <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={userPayoutUsd}
                    onChange={(e) => setUserPayoutUsd(e.target.value)}
                    placeholder="e.g. 0.70"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Initial Status</span>
                  <span className="text-[11px] text-slate-500">Enable this rule immediately for completion matching</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isActive ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                      isActive ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Rule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Edit Payout Rule #{editingRule.id}</h3>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Provider <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editProvider}
                    onChange={(e) => setEditProvider(e.target.value)}
                    placeholder="e.g. Vortex"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Offer ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={editOfferId}
                    onChange={(e) => setEditOfferId(e.target.value)}
                    placeholder="e.g. prime_video_101"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Offer Name (Optional label)
                </label>
                <input
                  type="text"
                  value={editOfferName}
                  onChange={(e) => setEditOfferName(e.target.value)}
                  placeholder="e.g. Prime Video"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Credited Coins <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editCoinAmount}
                    onChange={(e) => setEditCoinAmount(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    User Payout USD <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editUserPayoutUsd}
                    onChange={(e) => setEditUserPayoutUsd(e.target.value)}
                    placeholder="e.g. 0.70"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Status</span>
                  <span className="text-[11px] text-slate-500">Active rules are applied during completion resolution</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    editIsActive ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                      editIsActive ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {editSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Rule</span>
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
