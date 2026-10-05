import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Coins, 
  Wallet, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  ExternalLink, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Layers, 
  RefreshCw,
  Award,
  AlertCircle,
  Zap,
  ArrowUpRight,
  ListFilter
} from 'lucide-react';
import OfferwallModal from '../components/OfferwallModal';
import { api } from '../services/api';

export default function DashboardPage() {
  const { user, refreshBalance } = useAuth();
  const navigate = useNavigate();

  const [offerwalls, setOfferwalls] = useState([]);
  const [loadingOfferwalls, setLoadingOfferwalls] = useState(true);
  const [userActivity, setUserActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityTab, setActivityTab] = useState('completed'); // 'completed' | 'withdrawals'
  const [selectedOfferwall, setSelectedOfferwall] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch real offerwalls from API
  const fetchOfferwalls = useCallback(async () => {
    setLoadingOfferwalls(true);
    try {
      const res = await api.getOfferwalls();
      const list = res.offerwalls || res.rows || res.data || [];
      setOfferwalls(list);
    } catch (err) {
      console.warn('Failed to fetch offerwalls:', err);
      setOfferwalls([]);
    } finally {
      setLoadingOfferwalls(false);
    }
  }, []);

  // Fetch real user activity from /api/profile/tabs
  const fetchUserActivity = useCallback(async (tab = 'completed') => {
    setLoadingActivity(true);
    try {
      const res = await api.getProfileTabs(tab);
      const rows = res.rows || res.data || [];
      setUserActivity(rows);
    } catch (err) {
      console.warn('Failed to fetch user activity:', err);
      setUserActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    fetchOfferwalls();
    fetchUserActivity(activityTab);
  }, [fetchOfferwalls, fetchUserActivity, activityTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBalance(),
      fetchOfferwalls(),
      fetchUserActivity(activityTab),
    ]);
    setRefreshing(false);
  };

  const handleOpenOfferwall = (wall) => {
    setSelectedOfferwall(wall);
    setModalOpen(true);
  };

  // Real API metric calculations
  const balanceRaw = user?.balance ?? 0;
  const balanceUSD = Number(balanceRaw).toFixed(2);
  const balanceCoins = Math.round(Number(balanceRaw) * 1000);

  const totalEarningsUSD = Number(user?.total_earnings ?? user?.totalEarnings ?? 0).toFixed(2);
  const completedTasksCount = Number(user?.completed_tasks_count ?? user?.completedTasksCount ?? 0);
  const withdrawalsCount = Number(user?.withdrawals_count ?? user?.withdrawalsCount ?? 0);
  const userLevel = Number(user?.level || 1);

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 py-6 sm:py-10 selection:bg-brand-500/30 selection:text-brand-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Top Greeting & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome, {user?.name || user?.username || 'Member'}
              </h1>
              <span className="text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/25 px-2.5 py-0.5 rounded-full">
                Level {userLevel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Account ID: #{user?.id || '—'} • Country: {user?.country || 'Global'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              title="Refresh Account Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync Balance'}</span>
            </button>
            <Link
              to="/cashout"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 font-bold text-xs shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5 text-slate-950" />
              <span>Withdraw</span>
            </Link>
          </div>
        </div>

        {/* Focal Balance Hero & Real Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Balance Hero (Visual Focal Point) */}
          <div className="lg:col-span-7 rounded-3xl glass-card p-6 sm:p-8 border border-brand-500/20 shadow-glow-card relative overflow-hidden flex flex-col justify-between">
            {/* Background volumetric accent */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-brand-400" />
                  Available Real Balance
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 100% Verified
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {balanceCoins.toLocaleString()}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-brand-400">
                    Coins
                  </span>
                </div>
                <div className="text-sm sm:text-base font-semibold text-slate-300">
                  ≈ ${balanceUSD} USD Available
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>Zero redemption fees on verified payouts</span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/earn"
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2"
                >
                  <Coins className="w-4 h-4 text-brand-400" />
                  <span>Browse Offers</span>
                </Link>
                <Link
                  to="/cashout"
                  className="btn-shimmer px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4 text-slate-950" />
                  <span>Instant Cashout</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </Link>
              </div>
            </div>
          </div>

          {/* Real Account KPI Cards */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Total Lifetime Earnings */}
            <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Earned</span>
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  ${totalEarningsUSD}
                </div>
                <p className="text-xs text-slate-400 mt-1">Lifetime completed task revenue</p>
              </div>
              <div className="text-[11px] font-semibold text-brand-400 flex items-center gap-1 pt-2 border-t border-white/5">
                <Zap className="w-3 h-3" /> S2S Credited
              </div>
            </div>

            {/* Completed Offers Count */}
            <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Tasks</span>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {completedTasksCount.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">Verified partner completions</p>
              </div>
              <div className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1 pt-2 border-t border-white/5">
                <CheckCircle2 className="w-3 h-3" /> Recorded in DB
              </div>
            </div>

            {/* Total Cashout Orders */}
            <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cashout Orders</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                  {withdrawalsCount.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">Total redemption requests</p>
              </div>
              <Link to="/cashout" className="text-[11px] font-semibold text-amber-400 hover:underline pt-2 border-t border-white/5 flex items-center gap-1">
                <span>View Payout History</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Account Tier / Level */}
            <div className="rounded-3xl glass-card p-6 border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Tier</span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  Level {userLevel}
                </div>
                <p className="text-xs text-slate-400 mt-1">Standard member access</p>
              </div>
              <div className="text-[11px] font-semibold text-purple-400 flex items-center gap-1 pt-2 border-t border-white/5">
                <ShieldCheck className="w-3 h-3" /> Full Offerwall Access
              </div>
            </div>

          </div>
        </div>

        {/* Real Offerwalls Hub */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" />
                Available Earning Offerwalls
              </h2>
              <p className="text-xs text-slate-400">
                Direct integration with verified task and survey providers
              </p>
            </div>
            <Link to="/earn" className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1">
              <span>View All Offerwalls</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingOfferwalls ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-2xl glass-card animate-pulse border border-white/5" />
              ))}
            </div>
          ) : offerwalls.length === 0 ? (
            <div className="p-8 rounded-3xl glass-card border border-white/10 text-center space-y-2">
              <p className="text-sm text-slate-400">No active offerwalls currently configured in system.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offerwalls.map((wall) => (
                <div
                  key={wall.id}
                  onClick={() => handleOpenOfferwall(wall)}
                  className="p-5 rounded-2xl glass-card hover:border-brand-500/40 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center text-xl font-bold text-brand-400 group-hover:scale-105 transition-transform">
                      {wall.image_url ? (
                        <img src={wall.image_url} alt={wall.name} className="w-full h-full object-contain" />
                      ) : (
                        wall.name?.charAt(0) || 'W'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white group-hover:text-brand-300 transition-colors">
                          {wall.name}
                        </h3>
                        {wall.bonus_multiplier && Number(wall.bonus_multiplier) > 0 && (
                          <span className="text-[10px] font-extrabold bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded">
                            +{wall.bonus_multiplier}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {wall.description || 'Games, surveys & tasks'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white/5 group-hover:bg-brand-500 group-hover:text-slate-950 text-slate-400 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real User Activity Feed */}
        <div className="rounded-3xl glass-card p-6 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-400" />
                Your Recent Account Activity
              </h3>
              <p className="text-xs text-slate-400">
                Verified records of your completed tasks and withdrawal transactions
              </p>
            </div>

            {/* Tab switch */}
            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setActivityTab('completed')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  activityTab === 'completed'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Completed Tasks
              </button>
              <button
                onClick={() => setActivityTab('withdrawals')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  activityTab === 'withdrawals'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Withdrawals
              </button>
            </div>
          </div>

          {loadingActivity ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Loading recent activity...
            </div>
          ) : userActivity.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
                <ListFilter className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400">
                {activityTab === 'completed'
                  ? 'No completed tasks recorded yet. Launch an offerwall above to earn your first reward!'
                  : 'No withdrawal history found. Once you reach the minimum threshold, submit a cashout request.'}
              </p>
              {activityTab === 'completed' && (
                <Link
                  to="/earn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 font-bold text-xs"
                >
                  <Coins className="w-3.5 h-3.5" /> Start Earning Now
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-white/5">
                    <th className="pb-3 font-semibold">Event / Name</th>
                    <th className="pb-3 font-semibold">Provider / Method</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {userActivity.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-white/[0.02]">
                      <td className="py-3 font-medium text-white">
                        {item.offer || item.title || item.walletName || 'Task Completion'}
                      </td>
                      <td className="py-3 text-slate-400">
                        {item.wall || item.walletAddress || 'Offerwall'}
                      </td>
                      <td className="py-3 font-bold text-right text-brand-400">
                        {item.amount ? `+$${Number(item.amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'completed' || item.status === 'approved'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {item.status || 'Verified'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 text-right">
                        {item.createdAt || item.date || 'Recently'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Offerwall Launch Modal */}
      <OfferwallModal
        offerwall={selectedOfferwall}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
