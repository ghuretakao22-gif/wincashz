import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Megaphone, 
  Power, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Lock, 
  Sparkles,
  ArrowLeft,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminModeratorNoticePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [msg, setMsg] = useState(null);

  const fetchNotice = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.getAdminModeratorNotice();
      if (res && res.success && res.data) {
        setEnabled(!!res.data.enabled);
        setHeadline(res.data.headline || '');
        setText(res.data.text || '');
        setUpdatedAt(res.data.updated_at || '');
      }
    } catch (err) {
      console.error('Failed to load moderator notice:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to load moderator notice settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotice();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const res = await api.updateAdminModeratorNotice({
        enabled,
        headline: headline.trim(),
        text: text.trim(),
      });

      if (res && res.success && res.data) {
        setEnabled(!!res.data.enabled);
        setHeadline(res.data.headline || '');
        setText(res.data.text || '');
        setUpdatedAt(res.data.updated_at || '');
        setMsg({ 
          type: 'success', 
          text: `Moderator live notice saved successfully. ${enabled ? 'Notice is now LIVE for moderators.' : 'Notice is currently DISABLED.'}` 
        });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save moderator notice.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Megaphone className="w-6 h-6 text-brand-400" />
              <span>Moderator Live Notice</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Moderator Only</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Publish urgent live announcements exclusively visible to active moderators. Normal users will never see this notice.
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
            onClick={fetchNotice}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Refresh notice settings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Main Grid: Settings Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Toggle Card */}
            <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Power className={`w-4 h-4 ${enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>Live Notice Status</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Toggle notice visibility on all moderator portal pages
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer ${
                    enabled ? 'bg-emerald-500 shadow-glow-emerald' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle notice enabled"
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                      enabled ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Current Status:</span>
                <span className={`font-bold ${enabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {enabled ? 'ACTIVE (Broadcast to Moderators)' : 'DISABLED (Hidden)'}
                </span>
              </div>
            </div>

            {/* Notice Content Fields Card */}
            <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
              {/* Headline */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Notice Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Critical Rate Adjustment Tonight"
                  maxLength={255}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white font-medium"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                  <span>Shown in the top notice bar and popup modal</span>
                  <span>{headline.length}/255</span>
                </div>
              </div>

              {/* Text Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Notice Content / Instructions
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter detailed notice for moderators (e.g. payout updates, offer guidance, campaign instructions)..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs text-white leading-relaxed resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                  <span>Supports multiline text and clear announcements</span>
                  <span>{text.length} chars</span>
                </div>
              </div>

              {/* Dismissal Behavior Note */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Automatic Re-Broadcast Rule</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  When a moderator clicks <strong>"Got it / বুঝেছি"</strong>, the notice stays hidden for them. When you click <strong>Save Notice Changes</strong>, a new timestamp is generated, automatically re-showing the updated notice to all moderators!
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  {updatedAt ? `Last Saved: ${new Date(updatedAt).toLocaleString()}` : 'Never saved'}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Notice...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Notice Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Moderator View Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Preview</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                enabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
              }`}>
                {enabled ? 'Visible to Mods' : 'Currently Hidden'}
              </span>
            </div>

            {/* Banner Preview */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Top Notice Bar Preview
              </span>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {headline || 'Notice Headline Preview'}
                    </div>
                    <div className="text-[11px] text-amber-300/80 truncate">
                      {text ? text.slice(0, 70) + (text.length > 70 ? '...' : '') : 'Notice text preview will appear here.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                    Read More
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Got it / বুঝেছি</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Popup Preview */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Popup Dialog Preview
              </span>
              <div className="rounded-2xl bg-[#0c1015] border border-white/10 p-5 shadow-2xl space-y-3 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white leading-tight">
                        {headline || 'Official Moderator Notice'}
                      </div>
                      <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                        Important Announcement
                      </div>
                    </div>
                  </div>
                  <X className="w-4 h-4 text-slate-600" />
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {text || 'Notice details, operational instructions, or rate updates will appear here in full.'}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-white/5">
                  <span className="text-[10px] text-slate-500">Admin Broadcast</span>
                  <div className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Got it / বুঝেছি</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
