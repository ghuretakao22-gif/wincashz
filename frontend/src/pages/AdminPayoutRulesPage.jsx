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
  Sliders, 
  Calendar, 
  Save, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Clock,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

function extractErrorMessage(err, fallback = 'Operation failed.') {
  if (!err) return fallback;
  if (err.errors && typeof err.errors === 'object') {
    const messages = Object.values(err.errors).flat().filter(Boolean);
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  if (err.message && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return fallback;
}

export default function AdminPayoutRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [msg, setMsg] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    perPage: 20,
    total: 0,
  });

  // Summary counts across all rules
  const [summary, setSummary] = useState({
    total_rules: 0,
    active_rules: 0,
    disabled_rules: 0,
    today_completions: 0,
    total_completions: 0,
  });

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [usdBdtRate, setUsdBdtRate] = useState('122.00');
  const [settingsMsg, setSettingsMsg] = useState(null);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [provider, setProvider] = useState('');
  const [offerId, setOfferId] = useState('');
  const [offerName, setOfferName] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [userPayoutUsd, setUserPayoutUsd] = useState('');
  const [ruleUsdBdtRate, setRuleUsdBdtRate] = useState('122.00');
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
  const [editUsdBdtRate, setEditUsdBdtRate] = useState('122.00');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Fetch Rules from Backend API
  const fetchRules = useCallback(async (
    searchQuery = search,
    provFilter = providerFilter,
    statFilter = statusFilter,
    pageNumber = page,
    limit = perPage,
    clearMsg = true
  ) => {
    setLoading(true);
    if (clearMsg) {
      setMsg(null);
    }
    try {
      const res = await api.getAdminPayoutRules({
        search: (searchQuery || '').trim(),
        provider: provFilter && provFilter !== 'all' ? provFilter.trim() : undefined,
        status: statFilter && statFilter !== 'all' ? statFilter.trim() : undefined,
        page: pageNumber,
        per_page: limit,
      });

      const list = res.data || (Array.isArray(res) ? res : []);
      setRules(Array.isArray(list) ? list : []);

      if (res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({
          current_page: pageNumber,
          last_page: 1,
          perPage: limit,
          total: list.length,
        });
      }

      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load payout rules:', err);
      setMsg({ type: 'error', text: extractErrorMessage(err, 'Failed to connect to backend Payout Rules API.') });
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [search, providerFilter, statusFilter, page, perPage]);

  // Fetch Global System Settings
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await api.getAdminMyIdSettings();
      if (res && res.data) {
        setSystemEnabled(!!res.data.my_id_system_enabled);
        setPayoutEnabled(!!res.data.my_id_payout_enabled);
        setStartDate(res.data.my_id_start_date || '');
        setUsdBdtRate(String(res.data.my_id_usd_bdt_rate || '122.00'));
      }
    } catch (err) {
      console.error('Failed to load My ID settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules(search, providerFilter, statusFilter, page, perPage);
  }, [fetchRules, page, perPage]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRules(search, providerFilter, statusFilter, 1, perPage);
  };

  const handleClearFilters = () => {
    setSearch('');
    setProviderFilter('');
    setStatusFilter('all');
    setPage(1);
    fetchRules('', '', 'all', 1, perPage);
  };

  // Manual sync all completed offers
  const handleSyncAllOffers = async () => {
    setSyncingAll(true);
    setMsg(null);
    try {
      const res = await api.syncAdminPayoutRules();
      const updatedCount = res?.sync_summary?.updated_tasks_count ?? 0;
      const affectedUsers = res?.sync_summary?.affected_users_count ?? 0;
      setMsg({
        type: 'success',
        text: `Live sync complete — ${updatedCount} completed offer(s) updated across ${affectedUsers} user(s).`,
      });
      await fetchRules(search, providerFilter, statusFilter, page, perPage, false);
    } catch (err) {
      setMsg({
        type: 'error',
        text: extractErrorMessage(err, 'Failed to sync completed offers.'),
      });
    } finally {
      setSyncingAll(false);
    }
  };

  // Toggle active/disabled
  const handleToggleStatus = async (rule) => {
    const nextStatus = !rule.is_active;
    setActionLoading(rule.id);
    try {
      const res = await api.updateAdminPayoutRule(rule.id, { is_active: nextStatus });
      if (res.success || res.data) {
        const updatedCount = res?.sync_summary?.updated_tasks_count ?? 0;
        setMsg({ 
          type: 'success', 
          text: `Rule for ${rule.provider} (${Number(rule.coin_amount)} coins) ${nextStatus ? 'enabled' : 'disabled'} — ${updatedCount} completed offer(s) updated instantly.` 
        });
        await fetchRules(search, providerFilter, statusFilter, page, perPage, false);
      }
    } catch (err) {
      setMsg({ 
        type: 'error', 
        text: extractErrorMessage(err, 'Failed to update rule status.') 
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete rule
  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Are you sure you want to delete this rule for ${rule.provider} (${rule.coin_amount} coins)? All matching completed offers will be recalculated immediately.`)) {
      return;
    }

    setActionLoading(rule.id);
    try {
      const res = await api.deleteAdminPayoutRule(rule.id);
      if (res.success) {
        const updatedCount = res?.sync_summary?.updated_tasks_count ?? 0;
        setMsg({
          type: 'success',
          text: `Payout rule #${rule.id} deleted — ${updatedCount} completed offer(s) updated instantly.`,
        });
        await fetchRules(search, providerFilter, statusFilter, page, perPage, false);
      }
    } catch (err) {
      setMsg({ type: 'error', text: extractErrorMessage(err, 'Failed to delete rule.') });
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

    if (coinAmount === '' || coinAmount === null || coinAmount === undefined || isNaN(Number(coinAmount)) || Number(coinAmount) < 0) {
      setModalError('Please enter a valid coin amount (0 or greater).');
      return;
    }

    if (userPayoutUsd === '' || userPayoutUsd === null || userPayoutUsd === undefined || isNaN(Number(userPayoutUsd)) || Number(userPayoutUsd) < 0) {
      setModalError('Please enter a valid user payout USD (0 or greater).');
      return;
    }

    if (!ruleUsdBdtRate || isNaN(Number(ruleUsdBdtRate)) || Number(ruleUsdBdtRate) <= 0) {
      setModalError('Please enter a valid positive 1 USD = BDT conversion rate (e.g. 122.00).');
      return;
    }

    const cleanOfferId = offerId.trim();

    setSubmitting(true);
    try {
      const res = await api.createAdminPayoutRule({
        provider: cleanProvider,
        offer_id: cleanOfferId && cleanOfferId !== '-' ? cleanOfferId : null,
        offer_name: offerName.trim() || null,
        coin_amount: Number(coinAmount),
        user_payout_usd: Number(userPayoutUsd),
        usd_bdt_rate: Number(ruleUsdBdtRate),
        is_active: isActive,
      });

      if (res.success || res.data) {
        const updatedCount = res?.sync_summary?.updated_tasks_count ?? 0;
        setShowAddModal(false);
        setProvider('');
        setOfferId('');
        setOfferName('');
        setCoinAmount('');
        setUserPayoutUsd('');
        setRuleUsdBdtRate('122.00');
        setIsActive(true);
        setSearch('');
        setProviderFilter('');
        setStatusFilter('all');
        setPage(1);
        setMsg({ 
          type: 'success', 
          text: `Rule saved (${cleanProvider} $${Number(userPayoutUsd).toFixed(2)}) — ${updatedCount} completed offer(s) updated instantly.` 
        });
        await fetchRules('', '', 'all', 1, perPage, false);
      }
    } catch (err) {
      setModalError(extractErrorMessage(err, 'Failed to create payout rule.'));
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
    setEditCoinAmount(rule.coin_amount !== null && rule.coin_amount !== undefined ? String(rule.coin_amount) : '');
    setEditUserPayoutUsd(rule.user_payout_usd !== null && rule.user_payout_usd !== undefined ? String(rule.user_payout_usd) : '');
    setEditUsdBdtRate(rule.usd_bdt_rate !== null && rule.usd_bdt_rate !== undefined ? String(rule.usd_bdt_rate) : '122.00');
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

    if (editCoinAmount === '' || editCoinAmount === null || editCoinAmount === undefined || isNaN(Number(editCoinAmount)) || Number(editCoinAmount) < 0) {
      setEditError('Please enter a valid coin amount (0 or greater).');
      return;
    }

    if (editUserPayoutUsd === '' || editUserPayoutUsd === null || editUserPayoutUsd === undefined || isNaN(Number(editUserPayoutUsd)) || Number(editUserPayoutUsd) < 0) {
      setEditError('Please enter a valid user payout USD (0 or greater).');
      return;
    }

    if (!editUsdBdtRate || isNaN(Number(editUsdBdtRate)) || Number(editUsdBdtRate) <= 0) {
      setEditError('Please enter a valid positive 1 USD = BDT conversion rate (e.g. 122.00).');
      return;
    }

    const cleanOfferId = editOfferId.trim();

    setEditSubmitting(true);
    try {
      const res = await api.updateAdminPayoutRule(editingRule.id, {
        provider: cleanProvider,
        offer_id: cleanOfferId && cleanOfferId !== '-' ? cleanOfferId : null,
        offer_name: editOfferName.trim() || null,
        coin_amount: Number(editCoinAmount),
        user_payout_usd: Number(editUserPayoutUsd),
        usd_bdt_rate: Number(editUsdBdtRate),
        is_active: editIsActive,
      });

      if (res.success || res.data) {
        const updatedId = editingRule.id;
        const updatedCount = res?.sync_summary?.updated_tasks_count ?? 0;
        setEditingRule(null);
        setMsg({
          type: 'success',
          text: `Rule #${updatedId} saved — ${updatedCount} completed offer(s) updated instantly.`,
        });
        await fetchRules(search, providerFilter, statusFilter, page, perPage, false);
      }
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update payout rule.'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Save Global Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg(null);

    const numericRate = parseFloat(usdBdtRate);
    if (isNaN(numericRate) || numericRate <= 0) {
      setSettingsMsg({ type: 'error', text: 'USD→BDT rate must be a valid positive number.' });
      return;
    }

    setSavingSettings(true);
    try {
      const res = await api.updateAdminMyIdSettings({
        my_id_system_enabled: systemEnabled,
        my_id_payout_enabled: payoutEnabled,
        my_id_start_date: startDate.trim(),
        my_id_usd_bdt_rate: numericRate,
      });

      if (res.success) {
        setSystemEnabled(!!res.data.my_id_system_enabled);
        setPayoutEnabled(!!res.data.my_id_payout_enabled);
        setStartDate(res.data.my_id_start_date || '');
        setUsdBdtRate(String(res.data.my_id_usd_bdt_rate));
        setSettingsMsg({ type: 'success', text: 'My ID system settings successfully saved!' });
      }
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to save My ID settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSetCurrentUtc = () => {
    const now = new Date();
    const utcStr = now.toISOString().replace('T', ' ').substring(0, 19);
    setStartDate(utcStr);
  };

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

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/admin/my-ids"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>My IDs</span>
          </Link>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              showSettings 
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' 
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showSettings ? 'Hide Settings' : 'System Settings'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAllOffers}
            disabled={syncingAll}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Recalculate all completed offers against current payout rules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            <span>{syncingAll ? 'Syncing...' : 'Sync All Offers Now'}</span>
          </button>

          <button
            onClick={() => fetchRules(search, providerFilter, statusFilter, page, perPage)}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
              setRuleUsdBdtRate('122.00');
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

      {/* Global Settings Collapsible Card */}
      {showSettings && (
        <div className="glass-card p-5 rounded-2xl border border-brand-500/20 bg-brand-500/[0.02] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Global My ID Settings</h3>
            </div>
            <span className="text-[11px] text-slate-400">Settings affect all My ID accounts platform-wide</span>
          </div>

          {settingsMsg && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
              settingsMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {settingsMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{settingsMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* System Enabled */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">My ID System</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border border-white/10'
                }`}>
                  {systemEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Master switch for earning recording</p>
              <button
                type="button"
                onClick={() => setSystemEnabled(!systemEnabled)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  systemEnabled 
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{systemEnabled ? 'Turn OFF System' : 'Turn ON System'}</span>
              </button>
            </div>

            {/* Payout Enabled */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Monthly Payouts</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  payoutEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border border-white/10'
                }`}>
                  {payoutEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Allow moderator payout requests</p>
              <button
                type="button"
                onClick={() => setPayoutEnabled(!payoutEnabled)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  payoutEnabled 
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{payoutEnabled ? 'Disable Payouts' : 'Enable Payouts'}</span>
              </button>
            </div>

            {/* USD -> BDT Rate */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
              <label className="text-xs font-semibold text-white block">USD → BDT Rate</label>
              <p className="text-[11px] text-slate-400">Used for BDT conversion snapshot</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={usdBdtRate}
                  onChange={(e) => setUsdBdtRate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs font-mono"
                  placeholder="122.00"
                />
              </div>
            </div>

            {/* Start Date (UTC) */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white">Start Date (UTC)</label>
                <button
                  type="button"
                  onClick={handleSetCurrentUtc}
                  className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold"
                >
                  Set Now
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Earnings before this are ignored</p>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="YYYY-MM-DD HH:MM:SS"
                className="w-full px-3 py-1.5 rounded-lg glass-input text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStartDate('')}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
              >
                Clear Start Date
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-1.5 rounded-xl bg-brand-400 hover:bg-brand-300 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

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

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Rules</span>
          <span className="text-2xl font-black text-white mt-1 block">{summary.total_rules || rules.length}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{summary.active_rules || 0} Active, {summary.disabled_rules || 0} Disabled</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Active Rules</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{summary.active_rules || 0}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Currently matching postbacks</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">Today Completions</span>
          <span className="text-2xl font-black text-cyan-400 mt-1 block flex items-center gap-1.5">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>{summary.today_completions || 0}</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Matched earnings today (UTC)</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider block">Total Completions</span>
          <span className="text-2xl font-black text-brand-400 mt-1 block flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-brand-400" />
            <span>{summary.total_completions || 0}</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">All-time matched earnings</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 rounded-2xl border border-white/5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              fetchRules(search, providerFilter, e.target.value, 1, perPage);
            }}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all" className="bg-[#0c1015] text-white">All Statuses</option>
            <option value="active" className="bg-[#0c1015] text-white">Active Only</option>
            <option value="inactive" className="bg-[#0c1015] text-white">Disabled Only</option>
          </select>

          {/* Per Page */}
          <select
            value={perPage}
            onChange={(e) => {
              const newPer = Number(e.target.value);
              setPerPage(newPer);
              setPage(1);
              fetchRules(search, providerFilter, statusFilter, 1, newPer);
            }}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 focus:outline-none"
          >
            <option value={20} className="bg-[#0c1015] text-white">20 / page</option>
            <option value={50} className="bg-[#0c1015] text-white">50 / page</option>
            <option value={100} className="bg-[#0c1015] text-white">100 / page</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
          >
            Filter
          </button>

          {(search || providerFilter || statusFilter !== 'all') && (
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
                <th className="py-3.5 px-4">Offer ID</th>
                <th className="py-3.5 px-4">Offer Name</th>
                <th className="py-3.5 px-4">Coin</th>
                <th className="py-3.5 px-4">Payout (USD)</th>
                <th className="py-3.5 px-4 text-right">1 USD = BDT</th>
                <th className="py-3.5 px-4 text-center">Today Count</th>
                <th className="py-3.5 px-4 text-center">Total Count</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    <span>Loading Payout Rules...</span>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-slate-400">No payout rules found</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {search ? 'Try clearing your search filters' : 'Add your first rule using the button above'}
                    </p>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const isRuleActive = !!rule.is_active;
                  const isActioning = actionLoading === rule.id;

                  return (
                    <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Provider */}
                      <td className="py-3 px-4 font-bold text-white">
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          {rule.provider}
                        </span>
                      </td>

                      {/* Offer ID */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {rule.offer_id ? (
                          <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] border border-white/10 font-bold">
                            {rule.offer_id}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold">-</span>
                        )}
                      </td>

                      {/* Offer Name */}
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {rule.offer_name || <span className="text-slate-500 italic text-[11px]">(All Offers)</span>}
                      </td>

                      {/* Coin */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {Number(rule.coin_amount).toLocaleString()}
                      </td>

                      {/* Payout (USD) */}
                      <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                        ${Number(rule.user_payout_usd).toFixed(2)}
                      </td>

                      {/* 1 USD = BDT */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-300 text-right">
                        ৳{Number(rule.usd_bdt_rate || 122).toFixed(2)}
                      </td>

                      {/* Today Count */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                          (rule.today_count || 0) > 0 
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' 
                            : 'bg-white/5 text-slate-500 border border-white/5'
                        }`}>
                          {rule.today_count || 0}
                        </span>
                      </td>

                      {/* Total Count */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                          (rule.total_count || 0) > 0 
                            ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30' 
                            : 'bg-white/5 text-slate-500 border border-white/5'
                        }`}>
                          {rule.total_count || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isRuleActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Inactive
                          </span>
                        )}
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
                              isRuleActive
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            }`}
                            title={isRuleActive ? 'Disable Rule' : 'Enable Rule'}
                          >
                            <Power className={`w-3 h-3 ${isActioning ? 'animate-spin' : ''}`} />
                            <span className="text-[11px]">{isRuleActive ? 'Disable' : 'Enable'}</span>
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

        {/* Pagination Footer */}
        {pagination.last_page > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {((pagination.current_page - 1) * perPage) + 1} to {Math.min(pagination.current_page * perPage, pagination.total)} of {pagination.total} rules
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1 font-semibold text-white">
                Page {pagination.current_page} of {pagination.last_page}
              </span>

              <button
                type="button"
                onClick={() => setPage(prev => Math.min(pagination.last_page, prev + 1))}
                disabled={page >= pagination.last_page || loading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD RULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 sm:p-6 rounded-3xl border border-white/10 shadow-2xl relative space-y-5">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-400" />
                <span>Add Payout Rule</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Define the worker USD payout when a user under a My ID completes this offer.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {/* Provider */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Provider <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. Vortex, Torox, RevU, CPALead"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input"
                />
              </div>

              {/* Offer ID */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Offer ID <span className="text-slate-500 font-normal">(Optional — Leave empty or '-' to match all offers)</span>
                </label>
                <input
                  type="text"
                  value={offerId}
                  onChange={(e) => setOfferId(e.target.value)}
                  placeholder="e.g. prime_video_101 or leave empty"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input font-mono"
                />
              </div>

              {/* Offer Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Offer Name <span className="text-slate-500 font-normal">(Optional descriptive label)</span>
                </label>
                <input
                  type="text"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  placeholder="e.g. Prime Video 30-Day Free Trial"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input"
                />
              </div>

              {/* Coin Amount, Payout USD & 1 USD = BDT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Coins Credited <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payout (USD) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      value={userPayoutUsd}
                      onChange={(e) => setUserPayoutUsd(e.target.value)}
                      placeholder="e.g. 0.70"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl glass-input font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    1 USD = BDT <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={ruleUsdBdtRate}
                      onChange={(e) => setRuleUsdBdtRate(e.target.value)}
                      placeholder="e.g. 122.00"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl glass-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="rule-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-400 focus:ring-brand-400 cursor-pointer"
                />
                <label htmlFor="rule-active" className="text-slate-300 font-medium cursor-pointer">
                  Activate rule immediately upon creation
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 font-bold transition-all shadow-glow-emerald cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating Rule...' : 'Create Payout Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 sm:p-6 rounded-3xl border border-white/10 shadow-2xl relative space-y-5">
            <button
              onClick={() => setEditingRule(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-400" />
                <span>Edit Payout Rule #{editingRule.id}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Updating will apply to future earned completions. Existing snapshot earnings in ledger will remain unchanged.
              </p>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Provider */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Provider <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input"
                />
              </div>

              {/* Offer ID */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Offer ID <span className="text-slate-500 font-normal">(Leave empty or '-' to match all offers)</span>
                </label>
                <input
                  type="text"
                  value={editOfferId}
                  onChange={(e) => setEditOfferId(e.target.value)}
                  placeholder="e.g. prime_video_101 or empty"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input font-mono"
                />
              </div>

              {/* Offer Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Offer Name <span className="text-slate-500 font-normal">(Optional descriptive label)</span>
                </label>
                <input
                  type="text"
                  value={editOfferName}
                  onChange={(e) => setEditOfferName(e.target.value)}
                  placeholder="e.g. Prime Video 30-Day Free Trial"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input"
                />
              </div>

              {/* Coin Amount, Payout USD & 1 USD = BDT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Coins Credited <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={editCoinAmount}
                    onChange={(e) => setEditCoinAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payout (USD) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      value={editUserPayoutUsd}
                      onChange={(e) => setEditUserPayoutUsd(e.target.value)}
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl glass-input font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    1 USD = BDT <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={editUsdBdtRate}
                      onChange={(e) => setEditUsdBdtRate(e.target.value)}
                      placeholder="e.g. 122.00"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl glass-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="edit-rule-active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-400 focus:ring-brand-400 cursor-pointer"
                />
                <label htmlFor="edit-rule-active" className="text-slate-300 font-medium cursor-pointer">
                  Rule is active
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 font-bold transition-all shadow-glow-emerald cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
