import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ShieldAlert, 
  Wallet, 
  FileSpreadsheet, 
  Settings,
  Layers,
  Star,
  Zap,
  Activity
} from 'lucide-react';
import { api, parseUsersResponse } from '../services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    dailyRevenue: 0.00,
    totalCompletedOffers: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsAmount: 0.00,
    totalChargebacks: 0,
    activeOfferwalls: 0,
    featuredOfferwalls: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, tasksRes, cbRes, withRes, wallsRes] = await Promise.allSettled([
        api.getAdminDashboard(),
        api.getAdminUsers(),
        api.getAdminCompletedTasks(),
        api.getAdminChargebacks(),
        api.getAdminPendingWithdrawals(),
        api.getAdminOfferwalls(),
      ]);

      const backendStats = dashRes.status === 'fulfilled' ? dashRes.value?.stats || {} : {};
      const usersParsed = usersRes.status === 'fulfilled' ? parseUsersResponse(usersRes.value) : null;
      const usersList = usersParsed || [];
      const tasksList = tasksRes.status === 'fulfilled' ? (tasksRes.value?.tasks || tasksRes.value?.completed_tasks || tasksRes.value?.data || (Array.isArray(tasksRes.value) ? tasksRes.value : [])) : [];
      const cbList = cbRes.status === 'fulfilled' ? (cbRes.value?.chargebacks || cbRes.value?.data || (Array.isArray(cbRes.value) ? cbRes.value : [])) : [];
      const withList = withRes.status === 'fulfilled' ? (withRes.value?.withdrawals || withRes.value?.pending_withdrawals || withRes.value?.data || (Array.isArray(withRes.value) ? withRes.value : [])) : [];
      const wallsList = wallsRes.status === 'fulfilled' ? (wallsRes.value?.offerwalls || wallsRes.value?.data || (Array.isArray(wallsRes.value) ? wallsRes.value : [])) : [];

      setStats({
        totalUsers: usersList.length > 0 ? usersList.length : Number(backendStats.totalUsers ?? 0),
        dailyRevenue: Number(backendStats.dailyRevenue ?? 0),
        totalCompletedOffers: Number(backendStats.totalCompletedOffers ?? tasksList.length),
        pendingWithdrawalsCount: Number(backendStats.pendingWithdrawalsCount ?? withList.length),
        pendingWithdrawalsAmount: Number(backendStats.pendingWithdrawalsAmount ?? withList.reduce((sum, w) => sum + Number(w.amount || 0), 0)),
        totalChargebacks: Number(backendStats.totalChargebacks ?? cbList.length),
        activeOfferwalls: Number(backendStats.activeOfferwalls ?? wallsList.filter(w => w.status !== false && w.status !== 0).length),
        featuredOfferwalls: Number(backendStats.featuredOfferwalls ?? wallsList.filter(w => Boolean(w.is_featured)).length),
      });
    } catch (e) {
      console.error('Failed to load admin metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Admin Summary Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            High-level operational metrics and direct shortcuts to dedicated administration consoles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Backend System Online
          </span>
        </div>
      </div>

      {/* KPI Summary Cards - Interactive & Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Total Users */}
        <Link
          to="/admin/users"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-brand-500/50 hover:shadow-glow-emerald cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</span>
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-white group-hover:text-brand-300 transition-colors">
              {stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">Registered member accounts</p>
          </div>
          <div className="text-[11px] font-semibold text-brand-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Open Users Table →
          </div>
        </Link>

        {/* Completed Offers */}
        <Link
          to="/admin/completed-offers"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-cyan-500/50 hover:shadow-glow-cyan cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Offers</span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
              {stats.totalCompletedOffers.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">13-column verified task logs</p>
          </div>
          <div className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <Zap className="w-3.5 h-3.5" /> View Dense Grid →
          </div>
        </Link>

        {/* Pending Cashouts */}
        <Link
          to="/admin/withdrawals"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Cashouts</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-amber-400">
              ${stats.pendingWithdrawalsAmount.toFixed(2)}
            </div>
            <p className="text-xs text-slate-400 mt-1">{stats.pendingWithdrawalsCount} awaiting admin approval</p>
          </div>
          <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <Wallet className="w-3.5 h-3.5" /> Manage Payouts →
          </div>
        </Link>

        {/* Chargebacks / Reversals */}
        <Link
          to="/admin/chargebacks"
          className="rounded-3xl glass-card p-6 border border-white/10 hover:border-rose-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chargebacks Log</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold text-rose-400">
              {stats.totalChargebacks} Incidents
            </div>
            <p className="text-xs text-slate-400 mt-1">Reversal audit & fraud deduction</p>
          </div>
          <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 pt-2 border-t border-white/5">
            <ShieldAlert className="w-3.5 h-3.5" /> View Reversal Log →
          </div>
        </Link>
      </div>

      {/* Direct Module Navigation Grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Dedicated Administration Consoles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Offerwall Management */}
          <Link
            to="/admin/offerwalls"
            className="p-6 rounded-3xl glass-card hover:border-brand-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-brand-300">
                  Offerwalls & Postbacks
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add unlimited providers, configure auto postback URLs, and parameter mappings.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors shrink-0 mt-1" />
          </Link>

          {/* Featured Walls */}
          <Link
            to="/admin/featured"
            className="p-6 rounded-3xl glass-card hover:border-amber-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-amber-300">
                  Featured Walls Curation
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Reorder and pin top-performing offerwalls on the Earn page top carousel.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
          </Link>

          {/* Website Settings */}
          <Link
            to="/admin/settings"
            className="p-6 rounded-3xl glass-card hover:border-purple-500/40 transition-all flex items-start justify-between group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-purple-300">
                  Website Settings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage site branding, logo preview & URL, conversion economics, and domain.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors shrink-0 mt-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
