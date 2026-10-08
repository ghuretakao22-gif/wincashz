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
  AlertCircle,
  Award
} from 'lucide-react';
import { api } from '../services/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (activeTab === 'completed') {
      setLoadingTasks(true);
      api.getProfileTabs('completed')
        .then((res) => {
          const rows = res.rows || res.data || [];
          setCompletedTasks(rows);
        })
        .catch((err) => console.error('Failed to load completed offers:', err))
        .finally(() => setLoadingTasks(false));
    }
  }, [activeTab]);

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
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'completed', label: 'Completed Offers' },
            { id: 'security', label: 'Security' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
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
                  <span className="font-mono text-slate-300">{user?.ip || '—'}</span>
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

        {activeTab === 'completed' && (
          <div className="rounded-3xl glass-card p-6 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-400" />
              Completed Offers History
            </h3>
            <p className="text-xs text-slate-400">
              Verified records of your completed partner offers and task completions.
            </p>

            {loadingTasks ? (
              <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                Loading completed offers...
              </div>
            ) : completedTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No completed offers found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10 font-semibold">
                      <th className="pb-3 font-semibold">Offer Name</th>
                      <th className="pb-3 font-semibold">Provider / Wall</th>
                      <th className="pb-3 font-semibold text-right">Reward</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {completedTasks.map((item, idx) => {
                      const offerName = item.offer || item.offerName || item.title || 'Offer Task';
                      const wall = item.wall || item.offerWall || item.offerWallName || item.offerwall_name || 'Offerwall';
                      const rewardVal = Number(item.amount || item.currencyReward || item.reward || 0);
                      const statusVal = item.status || 'completed';
                      const dateVal = item.date || item.createdAt || item.created_at || '—';

                      return (
                        <tr key={item.id || idx} className="hover:bg-white/[0.02]">
                          <td className="py-3 font-sans font-medium text-white">
                            {offerName}
                          </td>
                          <td className="py-3 font-sans text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                              {wall}
                            </span>
                          </td>
                          <td className="py-3 font-bold text-right text-brand-400">
                            {rewardVal.toFixed(2)} Coins
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10">
                              <CheckCircle2 className="w-3 h-3" />
                              {statusVal}
                            </span>
                          </td>
                          <td className="py-3 text-slate-400 text-right font-sans">
                            {typeof dateVal === 'string' ? dateVal.replace('T', ' ').substring(0, 19) : dateVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
