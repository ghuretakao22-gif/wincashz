import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Lock, 
  Wallet, 
  Info, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Building2,
  Clock,
  Save
} from 'lucide-react';
import { api } from '../services/api';

export default function ModeratorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState(null);
  const [prefError, setPrefError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(null);
  const [pwError, setPwError] = useState(null);

  // Settings Data
  const [profile, setProfile] = useState(null);
  const [myId, setMyId] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);

  // Form State: Payout Preferences
  const [defaultMethod, setDefaultMethod] = useState('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');

  // Form State: Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    setPrefError(null);
    try {
      const res = await api.getModeratorSettings();
      if (res && res.status === 'success' && res.data) {
        const d = res.data;
        setProfile(d.profile || null);
        setMyId(d.my_id || null);
        setSystemInfo(d.system_info || null);

        if (d.payout_preferences) {
          setDefaultMethod(d.payout_preferences.default_method || 'bkash');
          setAccountNumber(d.payout_preferences.account_number || '');
          setAccountHolderName(d.payout_preferences.account_holder_name || '');
          setBankName(d.payout_preferences.bank_name || '');
          setBranchName(d.payout_preferences.branch_name || '');
        }
      } else {
        setPrefError(res?.message || 'Failed to load settings.');
      }
    } catch (err) {
      console.error('Failed to load moderator settings:', err);
      setPrefError(err?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPreferences(true);
    setPrefSuccess(null);
    setPrefError(null);
    try {
      const payload = {
        payout_preferences: {
          default_method: defaultMethod,
          account_number: accountNumber.trim(),
          account_holder_name: accountHolderName.trim(),
          bank_name: bankName.trim(),
          branch_name: branchName.trim(),
        },
      };

      const res = await api.updateModeratorSettings(payload);
      if (res && res.status === 'success') {
        setPrefSuccess('Preferred payout defaults updated successfully.');
      } else {
        setPrefError(res?.message || 'Failed to update payout defaults.');
      }
    } catch (err) {
      setPrefError(err?.message || 'Failed to save payout preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPwSuccess(null);
    setPwError(null);

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      setSavingPassword(false);
      return;
    }

    try {
      const payload = {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      };

      const res = await api.updateModeratorSettings(payload);
      if (res && res.status === 'success') {
        setPwSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwError(res?.message || 'Failed to change password.');
      }
    } catch (err) {
      setPwError(err?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="pb-2 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-brand-400" />
            Moderator Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal profile, security credentials, and preferred payout defaults.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card + System Notices */}
        <div className="space-y-6">
          {/* Section 1: Profile Information */}
          <div className="p-5 rounded-3xl bg-[#0c1015]/90 border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/30 flex items-center justify-center font-black text-base text-brand-300">
                {profile?.username?.charAt(0)?.toUpperCase() || 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">
                  {profile?.username || 'Moderator'}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Moderator Role
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-white text-[11px] truncate max-w-[170px]">
                  {profile?.email || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Joined:</span>
                <span className="text-slate-300 font-medium">
                  {profile?.joined_at || '—'}
                </span>
              </div>
            </div>

            {/* My ID Prominent Badge */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-brand-400" />
                  Assigned My ID
                </span>
                <span className="text-[9px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Read-Only
                </span>
              </div>
              <div className="text-base font-mono font-black text-white tracking-wider">
                {myId?.code || 'UNASSIGNED'}
              </div>
              {myId?.friendly_name && (
                <div className="text-xs text-brand-300 font-semibold truncate">
                  {myId.friendly_name}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Read-Only System Information & Notices */}
          <div className="p-5 rounded-3xl bg-[#0c1015]/90 border border-white/5 space-y-3.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Platform Notice (Read-Only)</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Timezone Policy</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {systemInfo?.timezone_notice || 'All reporting times and audit statistics are strictly computed in UTC.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Payout Rates & Conversion</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {systemInfo?.rate_notice || 'Payout rates and USD-to-BDT conversion rates are configured exclusively by Admin.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Payout Defaults + Security Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 2: Preferred Payout Method Defaults */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0c1015]/90 border border-white/5 space-y-5">
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <Wallet className="w-5 h-5 text-brand-400" />
                Preferred Payout Method Defaults
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure your default payout receiver accounts. These will automatically pre-fill when requesting monthly payouts.
              </p>
            </div>

            {prefSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{prefSuccess}</span>
              </div>
            )}

            {prefError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{prefError}</span>
              </div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-4">
              {/* Method Selection Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Default Payment Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    onClick={() => setDefaultMethod('bkash')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      defaultMethod === 'bkash'
                        ? 'bg-[#E2136E]/15 border-[#E2136E] text-white'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-[#FF2E93]" />
                    <span className="font-bold text-xs text-white">bKash</span>
                  </label>

                  <label
                    onClick={() => setDefaultMethod('nagad')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      defaultMethod === 'nagad'
                        ? 'bg-orange-500/15 border-orange-500 text-white'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-xs text-white">Nagad</span>
                  </label>

                  <label
                    onClick={() => setDefaultMethod('bank')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      defaultMethod === 'bank'
                        ? 'bg-cyan-500/15 border-cyan-500 text-white'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-slate-400'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs text-white">Bank Transfer</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Fields */}
              {(defaultMethod === 'bkash' || defaultMethod === 'nagad') ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Default {defaultMethod === 'bkash' ? 'bKash' : 'Nagad'} Number
                  </label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mohammad Rahim"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2050123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Islami Bank Ltd / DBBL"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dhanmondi Branch"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPreferences}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition-all shadow-glow-emerald disabled:opacity-50 cursor-pointer"
                >
                  {savingPreferences ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Payout Defaults</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Password / Security */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0c1015]/90 border border-white/5 space-y-5">
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-400" />
                Security & Password
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Change your login password to maintain account security.
              </p>
            </div>

            {pwSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 disabled:opacity-50 cursor-pointer"
                >
                  {savingPassword ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
