import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Globe, 
  Mail, 
  DollarSign, 
  Image as ImageIcon, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  ShieldCheck,
  Zap,
  Eye,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import Logo from '../components/Logo';
import { api } from '../services/api';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    site_name: 'Wincashz',
    site_tagline: 'Get Paid Real Cash For Gaming & Micro Tasks',
    site_domain: 'wincashz.com',
    support_email: 'support@wincashz.com',
    coins_per_dollar: 1000,
    min_payout_usd: 1.00,
    referral_bonus_rate: 10,
    logo_url: '',
    logo_text: 'WINCASHZ',
    favicon_url: '/favicon.ico',
    maintenance_mode: false,
    require_email_verify: false,
    default_postback_domain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) 
      ? import.meta.env.VITE_API_BASE_URL 
      : (typeof window !== 'undefined' && window.VITE_API_BASE_URL ? window.VITE_API_BASE_URL : 'https://wincashz.com'),
  });

  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    // Try to load saved settings from localStorage or api
    try {
      const saved = localStorage.getItem('wincashz_site_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed }));
        if (parsed.logo_url) setLogoPreview(parsed.logo_url);
      }
    } catch (e) {}
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      localStorage.setItem('wincashz_site_settings', JSON.stringify(formData));
      // Notify components if custom event used
      window.dispatchEvent(new Event('site-settings-updated'));
      setMsg({ type: 'success', text: 'Website settings and branding updated successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to persist settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPostbackBase = () => {
    const url = `${formData.default_postback_domain}/api/offerwall-postback/{slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-400" />
            Website Settings & Brand Configuration
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure site identity, logo branding, live conversion rates, support channels, and postback root endpoints.
          </p>
        </div>
      </div>

      {msg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo & Brand Management Card */}
        <div className="rounded-3xl glass-card border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white text-base">Brand & Logo Management</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Logo Settings Fields */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Site Title / Brand Name</label>
                <input
                  type="text"
                  required
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Custom Logo Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://wincashz.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, logo_url: val });
                    setLogoPreview(val);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 font-mono text-[11px]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Leave empty to use the built-in SVG vector 3D logo with radiant badge.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Site Tagline</label>
                <input
                  type="text"
                  value={formData.site_tagline}
                  onChange={(e) => setFormData({ ...formData, site_tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-300"
                />
              </div>
            </div>

            {/* Live Logo Preview Box */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-brand-400" /> Live Render Preview
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
              </div>

              <div className="h-24 rounded-xl bg-background-surface/80 border border-white/5 flex items-center justify-center p-4">
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo Preview" className="max-h-12 object-contain" />
                ) : (
                  <Logo size="medium" />
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                This logo will render across the Header Navigation, Footer, Authentication, and Member Dashboards.
              </p>
            </div>
          </div>
        </div>

        {/* Financial & Conversion Economics */}
        <div className="rounded-3xl glass-card border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Conversion Rates & Economy Rules</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Coin Conversion Rate</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.coins_per_dollar}
                  onChange={(e) => setFormData({ ...formData, coins_per_dollar: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-brand-400 font-bold"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Coins = $1.00 USD</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Default: 1,000 Coins = $1.00 USD ($0.001 per coin)</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Minimum Cashout ($ USD)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formData.min_payout_usd}
                  onChange={(e) => setFormData({ ...formData, min_payout_usd: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white font-bold"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">USD</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Threshold required for user withdrawal requests.</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Referral Commission (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.referral_bonus_rate}
                  onChange={(e) => setFormData({ ...formData, referral_bonus_rate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-cyan-400 font-bold"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">%</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Percentage credited to referrer on completed offers.</span>
            </div>
          </div>
        </div>

        {/* Domain, Postback & Security Endpoints */}
        <div className="rounded-3xl glass-card border border-white/10 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Domain, Communications & Postback Endpoints</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Primary Production Domain</label>
              <input
                type="text"
                value={formData.site_domain}
                onChange={(e) => setFormData({ ...formData, site_domain: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Support & Contact Email</label>
              <input
                type="email"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Universal Postback URL Template
              </span>
              <button
                type="button"
                onClick={handleCopyPostbackBase}
                className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy Format'}
              </button>
            </div>
            <div className="font-mono text-xs text-white bg-black/40 p-2.5 rounded-xl border border-white/5 select-all">
              {`${formData.default_postback_domain}/api/offerwall-postback/{slug}`}
            </div>
            <p className="text-[11px] text-slate-400">
              Each registered offerwall automatically generates its slug-based endpoint using this secure root route.
            </p>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 font-bold text-xs shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <Save className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Saving Settings...' : 'Save Website Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
