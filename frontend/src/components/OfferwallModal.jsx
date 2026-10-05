import React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OfferwallModal({ offerwall, isOpen, onClose }) {
  const { user } = useAuth();

  if (!isOpen || !offerwall) return null;

  // Build the live iframe URL injecting user_id
  let iframeUrl = offerwall.iframe_url || offerwall.url || '';
  if (user && iframeUrl) {
    iframeUrl = iframeUrl
      .replace(/\{user_id\}/gi, encodeURIComponent(user.id))
      .replace(/\{subId\}/gi, encodeURIComponent(user.id))
      .replace(/\{userId\}/gi, encodeURIComponent(user.id))
      .replace(/\[USER_ID\]/gi, encodeURIComponent(user.id))
      .replace(/\[USERID\]/gi, encodeURIComponent(user.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[95vh] sm:h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl glass-panel border border-white/10 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-white/10 bg-[#0c1015]/95 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center font-bold text-brand-400 text-xs shrink-0 overflow-hidden">
              {offerwall.image_url || offerwall.logo_url ? (
                <img
                  src={offerwall.image_url || offerwall.logo_url}
                  alt={offerwall.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                offerwall.icon || offerwall.name?.charAt(0) || '⭐'
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-base text-white truncate">
                  {offerwall.display_name || offerwall.name}
                </h3>
                {offerwall.bonus_multiplier && Number(offerwall.bonus_multiplier) > 0 && (
                  <span className="text-[10px] font-bold bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full border border-brand-500/30 shrink-0">
                    +{offerwall.bonus_multiplier}%
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Verified S2S Active</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-200 hover:text-rose-400 transition-colors"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Iframe */}
        <div className="flex-1 w-full bg-[#05070a] relative">
          {iframeUrl ? (
            <iframe
              src={iframeUrl}
              title={offerwall.name}
              className="w-full h-full border-0"
              allow="clipboard-write; camera; microphone"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8 space-y-4">
              <p className="text-slate-400 text-xs sm:text-sm max-w-sm">
                Offerwall portal session initialized. Complete offers on the provider portal to receive instant reward credits.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs hover:bg-brand-400 transition-all"
              >
                Return to Earn Hub
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
