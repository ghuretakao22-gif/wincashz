import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Coins, 
  Wallet, 
  Gamepad2, 
  CheckCircle2, 
  Users, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Award,
  Lock,
  Globe2,
  TrendingUp,
  Flame
} from 'lucide-react';
import LiveDropTicker from '../components/LiveDropTicker';
import { api } from '../services/api';

export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState(null);
  const [offerwalls, setOfferwalls] = useState([]);
  const [cashoutMethods, setCashoutMethods] = useState([]);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const heroCardRef = useRef(null);

  useEffect(() => {
    // Fetch verified offerwalls and cashout methods
    api.getOfferwalls()
      .then((res) => {
        const list = res.offerwalls || res.data || [];
        if (list.length > 0) setOfferwalls(list);
      })
      .catch(() => {});

    api.getCashoutMethods()
      .then((res) => {
        const list = res.methods || res.rows || res.data || [];
        if (list.length > 0) setCashoutMethods(list);
      })
      .catch(() => {});
  }, []);

  // 3D Mouse Parallax on Desktop
  const handleMouseMove = (e) => {
    if (window.innerWidth < 768 || !heroCardRef.current) return;
    const rect = heroCardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (-y / (rect.height / 2)) * 6;
    const rotateY = (x / (rect.width / 2)) * 6;
    setCardTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setCardTilt({ x: 0, y: 0 });
  };

  const displayOfferwalls = offerwalls;

  const defaultMethods = [
    { id: 1, name: 'Bitcoin (BTC)', icon: '₿', min_amount: 5 },
    { id: 2, name: 'Litecoin (LTC)', icon: 'Ł', min_amount: 1 },
    { id: 3, name: 'Tether (USDT)', icon: '₮', min_amount: 2 },
    { id: 4, name: 'PayPal USD', icon: '🅿️', min_amount: 5 },
    { id: 5, name: 'Amazon Gift Card', icon: '🛍️', min_amount: 5 },
    { id: 6, name: 'Visa Prepaid Card', icon: '💳', min_amount: 10 },
  ];

  const displayMethods = cashoutMethods.length > 0 ? cashoutMethods : defaultMethods;

  const faqs = [
    {
      q: 'How do I start earning on Wincashz?',
      a: 'Create your free account, pick a verified offerwall partner (such as Torox, BitLabs, or AdGate), and complete gaming quests, surveys, or apps. Points credit automatically to your balance.'
    },
    {
      q: 'How does offer tracking and verification work?',
      a: 'We utilize direct Server-to-Server (S2S) postback tracking with HMAC hashing. As soon as a provider confirms task completion, your account is credited in real time.'
    },
    {
      q: 'Are there any withdrawal or payout fees?',
      a: 'No. Wincashz charges zero commission on your earned points. You receive 100% of your redeemed reward value.'
    },
    {
      q: 'Is Wincashz free to use?',
      a: 'Yes, 100% free! We never charge membership fees or hidden costs.'
    },
  ];

  return (
    <div className="min-h-screen bg-[#070a0e] text-slate-100 flex flex-col selection:bg-brand-500/30 selection:text-brand-300">
      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
        {/* Volumetric Layered Atmospheric Lighting */}
        <div className="volumetric-glow top-12 left-1/2 -translate-x-1/2" />
        <div className="volumetric-glow-secondary top-48 left-1/4" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-300">
                  Premium Rewards & Earning Network
                </span>
                <span className="text-xs text-brand-400 font-bold ml-1">Verified Partners</span>
              </div>

              {/* Dominant Cinematic Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
                Earn Real Cash & Crypto For{' '}
                <span className="gradient-text-brand">Gaming & Surveys</span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Connect with verified global offerwalls, play top-tier games, take surveys, and receive instant payouts with zero hidden fees.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  to="/register"
                  className="btn-shimmer w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 group"
                >
                  <Sparkles className="w-5 h-5 text-slate-950 group-hover:rotate-12 transition-transform" />
                  <span>Start Earning Free</span>
                  <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl text-base font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all text-center"
                >
                  Sign In
                </Link>
              </div>

              {/* Verified Platform Features (Real Value Props) */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-400" /> S2S Postback
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Instant Tracking</div>
                </div>
                <div>
                  <div className="text-sm sm:text-base font-bold text-brand-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-brand-400" /> Direct Payouts
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Fast Redemptions</div>
                </div>
                <div>
                  <div className="text-sm sm:text-base font-bold text-cyan-400 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-cyan-400" /> 0% Fees
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">100% Kept Rewards</div>
                </div>
              </div>
            </div>

            {/* Right 3D Perspective Focal Visual */}
            <div className="lg:col-span-5 perspective-container">
              <div
                ref={heroCardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  transform: `perspective(1000px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
                }}
                className="card-3d relative mx-auto max-w-md transition-transform"
              >
                {/* Layered floating background shadow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/30 to-cyan-500/30 rounded-3xl blur-xl opacity-50" />

                {/* Main Card */}
                <div className="relative rounded-3xl glass-card p-6 sm:p-7 shadow-2xl space-y-6">
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-400 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-base shadow-glow-emerald">
                        W
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Wincashz Network Hub</div>
                        <div className="text-xs text-brand-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping" />
                          Live Tracking Active
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                      S2S Verified
                    </span>
                  </div>

                  {/* Sample Live Earning Feed */}
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg">
                          🎯
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Torox Gaming Quest</div>
                          <div className="text-[11px] text-slate-400">Level 25 Objective • Instant</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-brand-400">+38,500 Coins</div>
                        <div className="text-[10px] text-slate-500">Verified S2S</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
                          📊
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">BitLabs Opinion Poll</div>
                          <div className="text-[11px] text-slate-400">10 Min Demographic Survey</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-brand-400">+4,200 Coins</div>
                        <div className="text-[10px] text-slate-500">Verified S2S</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                          📱
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">AdGate Mobile Quest</div>
                          <div className="text-[11px] text-slate-400">App Install & Verification</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-brand-400">+2,800 Coins</div>
                        <div className="text-[10px] text-slate-500">Verified S2S</div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Micro-Badge */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-brand-950/40 to-cyan-950/40 border border-brand-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-400" />
                      <span className="text-xs font-medium text-slate-200">Instant Automated Crediting</span>
                    </div>
                    <span className="text-xs font-bold text-brand-400">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Wincashz Works Section */}
      <section className="py-20 bg-[#0a0e14] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Simple 3-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              How Wincashz Works
            </h2>
            <p className="text-sm text-slate-400">
              Start earning rewards in three straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl glass-card hover:border-brand-500/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 text-xl font-bold mb-6 group-hover:scale-105 transition-transform">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Select a Task</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Choose an offer from certified providers: play mobile games, answer quick surveys, or test trending applications.
              </p>
            </div>

            <div className="p-8 rounded-3xl glass-card hover:border-cyan-500/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl font-bold mb-6 group-hover:scale-105 transition-transform">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Complete Requirements</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Follow the clear offer instructions. As soon as you finish, the provider sends a verified postback to credit your balance.
              </p>
            </div>

            <div className="p-8 rounded-3xl glass-card hover:border-amber-500/30 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold mb-6 group-hover:scale-105 transition-transform">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Redeem Rewards</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Cash out your coins directly through supported payout channels with verified processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Offerwalls Grid */}
      {displayOfferwalls.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                  Official Providers
                </span>
                <h2 className="text-3xl font-extrabold text-white mt-1">
                  Integrated Offerwalls
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Verified integrations with industry-standard earning networks.
                </p>
              </div>
              <Link
                to="/earn"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-400 hover:text-brand-300"
              >
                Browse All Offerwalls <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayOfferwalls.slice(0, 6).map((wall, idx) => (
                <div
                  key={wall.id || idx}
                  className="p-6 rounded-3xl glass-card hover:border-white/20 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                          {wall.icon || '⭐'}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-white">{wall.name}</h4>
                          <p className="text-xs text-slate-400">{wall.category || 'Surveys & Games'}</p>
                        </div>
                      </div>
                      {wall.bonus_multiplier && (
                        <span className="text-xs font-extrabold bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2.5 py-1 rounded-full">
                          +{wall.bonus_multiplier}% Bonus
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-400" /> S2S Enabled
                    </span>
                    <Link
                      to="/earn"
                      className="text-xs font-bold text-slate-200 hover:text-brand-400 flex items-center gap-1"
                    >
                      Open Wall <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cashout Methods Section */}
      <section className="py-20 bg-[#0a0e14] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Flexible Redemptions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Supported Cashout Channels
            </h2>
            <p className="text-sm text-slate-400">
              Redeem your points anytime through supported withdrawal options.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {displayMethods.map((m, idx) => (
              <div
                key={m.id || idx}
                className="p-5 rounded-2xl glass-card text-center hover:border-brand-500/30 transition-all group"
              >
                <div className="text-3xl mb-2 group-hover:scale-105 transition-transform">
                  {m.icon || '💳'}
                </div>
                <div className="text-xs font-bold text-white">{m.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {m.min_amount ? `Min. $${m.min_amount}` : 'Available'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Got Questions?
            </span>
            <h2 className="text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl glass-card overflow-hidden border border-white/10"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between font-bold text-sm sm:text-base text-white hover:text-brand-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-brand-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Conversion CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl glass-card p-10 sm:p-14 text-center overflow-hidden border border-brand-500/30 shadow-glow-emerald">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-cyan-500/10 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
                Ready to Start Earning with Wincashz?
              </h2>
              <p className="text-sm sm:text-base text-slate-300">
                Join our community today, complete offers, and cash out with verified tracking.
              </p>
              <div className="pt-2">
                <Link
                  to="/register"
                  className="btn-shimmer inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-slate-950 bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-[0.98] transition-all text-base"
                >
                  <Sparkles className="w-5 h-5" />
                  Create Free Account
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
