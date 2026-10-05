import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Shield, 
  Coins, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Camera, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    api.getProfileTabs()
      .then((res) => setProfileData(res))
      .catch(() => {});
  }, []);

  const points = user?.balance ?? user?.points ?? 0;
  const dollarValue = (points / 1000).toFixed(2);

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Profile Header Card */}
        <div className="rounded-3xl glass-card p-6 sm:p-8 border border-white/10 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-brand-400 to-cyan-400 p-1 flex items-center justify-center shadow-glow-emerald">
              {user?.user_avatar || user?.google_avatar ? (
                <img
                  src={user.user_avatar || user.google_avatar}
                  alt={user.username}
                  className="w-full h-full rounded-2xl object-cover bg-background"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-background-surface flex items-center justify-center text-2xl font-black text-white">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {user?.name || user?.username || 'User Profile'}
              </h1>
              <span className="text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full">
                Level {user?.level || 1} Earner
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 pt-1">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {user?.email}
            </p>
            <p className="text-xs text-slate-500">
              User ID: #{user?.id || '—'} • Country: {user?.country || 'Global'}
            </p>
          </div>

          {/* Quick Balance Stat */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center sm:text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold">Balance</span>
            <div className="text-2xl font-extrabold text-white mt-0.5">
              ${dollarValue}
            </div>
            <span className="text-xs text-brand-400 font-medium">
              {points.toLocaleString()} Coins
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          {['overview', 'security'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl glass-card p-6 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-brand-400" />
                Account Overview
              </h3>
              <div className="space-y-3 text-xs divide-y divide-white/5">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400">Username</span>
                  <span className="font-semibold text-white">{user?.username}</span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400">Email Address</span>
                  <span className="font-semibold text-white">{user?.email}</span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400">Registration IP</span>
                  <span className="font-mono text-slate-300">{user?.ip || '127.0.0.1'}</span>
                </div>
                <div className="pt-3 flex justify-between">
                  <span className="text-slate-400">Account Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active & Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl glass-card p-6 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                Optional Profile Customization
              </h3>
              <p className="text-xs text-slate-400">
                You can optionally update your visual avatar anytime. This does not affect your earnings.
              </p>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
                DiceBear avatar is automatically generated based on your user ID.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="rounded-3xl glass-card p-6 border border-white/10 max-w-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-400" />
              Security & Credentials
            </h3>
            <p className="text-xs text-slate-400">
              Your account is protected by 256-bit encryption. For password resets or email changes, reach out to our help desk.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
