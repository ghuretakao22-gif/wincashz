import React, { useState, useEffect, useCallback } from 'react';
import { 
  Hash, 
  Search, 
  Plus, 
  Pencil, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Power, 
  Users, 
  X, 
  Check,
  Coins,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminMyIdsPage() {
  const [myIds, setMyIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [createActive, setCreateActive] = useState(true);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const fetchMyIds = useCallback(async (searchQuery = search) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.getAdminMyIds({ search: searchQuery });
      const list = res.data || (Array.isArray(res) ? res : []);
      setMyIds(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load My IDs:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to connect to backend My IDs API.' });
      setMyIds([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchMyIds();
  }, [fetchMyIds]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMyIds(search);
  };

  const handleClearSearch = () => {
    setSearch('');
    fetchMyIds('');
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (item) => {
    const nextStatus = !item.is_active;
    const actionName = nextStatus ? 'enable' : 'disable';
    setActionLoading(item.id);
    setMsg(null);
    try {
      const res = await api.updateAdminMyId(item.id, { is_active: nextStatus });
      if (res.success) {
        setMyIds(prev => prev.map(m => m.id === item.id ? { ...m, is_active: nextStatus } : m));
        setMsg({ 
          type: 'success', 
          text: `My ID ${item.my_id_code} successfully ${nextStatus ? 'enabled' : 'disabled'}.` 
        });
      }
    } catch (err) {
      setMsg({ 
        type: 'error', 
        text: err.message || `Failed to ${actionName} My ID.` 
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Create My ID
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);

    const cleanCode = createCode.trim();
    if (!cleanCode) {
      setCreateError('Please enter a My ID code.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await api.createAdminMyId({
        my_id_code: cleanCode,
        label: createLabel.trim() || null,
        is_active: createActive,
      });

      if (res.success) {
        setShowCreateModal(false);
        setCreateCode('');
        setCreateLabel('');
        setCreateActive(true);
        setMsg({ type: 'success', text: `My ID ${cleanCode} created successfully.` });
        fetchMyIds();
      }
    } catch (err) {
      const validationMsgs = err.errors ? Object.values(err.errors).flat().join(' ') : null;
      setCreateError(validationMsgs || err.message || 'Failed to create My ID.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Label Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditLabel(item.label || '');
    setEditError(null);
  };

  // Save Edit Label
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      const res = await api.updateAdminMyId(editingItem.id, {
        label: editLabel.trim(),
      });
      if (res.success) {
        setMyIds(prev => prev.map(m => m.id === editingItem.id ? { ...m, label: editLabel.trim() || null } : m));
        setEditingItem(null);
        setMsg({ type: 'success', text: `Label for My ID ${editingItem.my_id_code} updated successfully.` });
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update label.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Summary counts
  const totalCount = myIds.length;
  const activeCount = myIds.filter(m => m.is_active).length;
  const disabledCount = totalCount - activeCount;
  const totalLinkedUsers = myIds.reduce((sum, m) => sum + (Number(m.users_count) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Hash className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">My ID Management</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create, label, and manage active status of system My IDs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/my-id-overview"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-500/10 to-cyan-500/10 hover:from-brand-500/20 hover:to-cyan-500/20 border border-brand-500/25 text-xs font-semibold text-brand-300 transition-all flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Earnings Overview</span>
          </Link>

          <Link
            to="/admin/payout-rules"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Payout Rules</span>
          </Link>

          <button
            onClick={() => fetchMyIds()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Refresh My IDs list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setCreateCode('');
              setCreateLabel('');
              setCreateActive(true);
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 shadow-glow-emerald cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create My ID</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
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
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total My IDs</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Active</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{activeCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Disabled</span>
          <span className="text-2xl font-black text-slate-400 mt-1 block">{disabledCount}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-white/5">
          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">Total Linked Users</span>
          <span className="text-2xl font-black text-cyan-400 mt-1 block">{totalLinkedUsers}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-white/5">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by My ID code (e.g. 1001) or label..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
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
            Search
          </button>
        </form>
      </div>

      {/* Table Card */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">My ID</th>
                <th className="py-3.5 px-4">Label</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Linked Users</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                    <span>Loading My IDs...</span>
                  </td>
                </tr>
              ) : myIds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Hash className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-slate-400">No My IDs found</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {search ? 'Try clearing your search query' : 'Create your first My ID using the button above'}
                    </p>
                  </td>
                </tr>
              ) : (
                myIds.map((item) => {
                  const isActive = !!item.is_active;
                  const isActioning = actionLoading === item.id;
                  const usersCount = Number(item.users_count) || 0;
                  const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : '-';

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* My ID Code */}
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <span className="px-2 py-1 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400">
                          #{item.my_id_code}
                        </span>
                      </td>

                      {/* Label */}
                      <td className="py-3 px-4 text-slate-300">
                        {item.label ? (
                          <span className="font-medium">{item.label}</span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No label</span>
                        )}
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

                      {/* Linked Users Count */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-mono font-semibold text-slate-200">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{usersCount}</span>
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {createdDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Label Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Edit Label"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Status (Disable / Enable) */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            disabled={isActioning}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              isActive
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            }`}
                            title={isActive ? 'Disable My ID (prevents new signups)' : 'Enable My ID'}
                          >
                            <Power className={`w-3.5 h-3.5 ${isActioning ? 'animate-spin' : ''}`} />
                            <span>{isActive ? 'Disable' : 'Enable'}</span>
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

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Create New My ID</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  My ID Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  placeholder="e.g. 1002"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm font-mono font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">Must be unique across all My IDs.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="e.g. VIP Campaign / Affiliate Group 1"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Initial Status</span>
                  <span className="text-[11px] text-slate-500">Allow users to link this ID immediately</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateActive(!createActive)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    createActive ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                      createActive ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {createSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Create My ID</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LABEL MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Edit My ID Label</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
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
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  My ID Code
                </label>
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-sm font-bold text-brand-400">
                  #{editingItem.my_id_code}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">My ID codes are permanent identifiers.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Primary Campaign"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
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
                      <span>Save Changes</span>
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
