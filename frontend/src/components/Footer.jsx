import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { ShieldCheck, Zap, Lock, Award, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#070a0e] border-t border-white/5 pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/5">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Logo size="large" />
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Wincashz is the premier global rewards platform. Earn real cash, crypto, and top gift cards by completing verified tasks, playing games, and sharing opinions.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
              <span className="flex items-center gap-1.5 text-brand-400">
                <ShieldCheck className="w-4 h-4" /> 256-Bit SSL Encrypted
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Zap className="w-4 h-4" /> Instant Redemptions
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <Link to="/earn" className="hover:text-brand-400 transition-colors">
                  Browse Offers
                </Link>
              </li>
              <li>
                <Link to="/cashout" className="hover:text-brand-400 transition-colors">
                  Cashout Methods
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-brand-400 transition-colors">
                  User Dashboard
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-brand-400 transition-colors">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Trust */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Trust & Support
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <span className="hover:text-slate-200 cursor-pointer">Privacy Policy</span>
              </li>
              <li>
                <span className="hover:text-slate-200 cursor-pointer">Terms of Service</span>
              </li>
              <li>
                <span className="hover:text-slate-200 cursor-pointer">Offerwall Guidelines</span>
              </li>
              <li>
                <span className="hover:text-slate-200 cursor-pointer">Support Help Desk</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Wincashz (wincashz.com). All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              Built for top earners worldwide
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
