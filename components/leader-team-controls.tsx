"use client";

import { useState } from "react";
import BentoCard from "@/components/bento-card";
import { UserPlus, UserMinus, XCircle, Loader2, Send, Settings, Lock, AlertTriangle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

interface Member {
  user_id: string;
  name: string;
  email: string;
  status: string;
}

export default function LeaderTeamControls({
  unitId,
  members,
}: {
  unitId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);

  const doAction = async (action: string, extra: Record<string, string> = {}) => {
    setLoading(action + (extra.user_id ?? extra.email ?? ''));
    setMessage(null);
    try {
      const res = await fetch('/api/units/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message ?? 'Done' });
        setEmail("");
        setShowLockModal(false);
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(null);
    }
  };

  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const pendingMembers = members.filter(m => m.status === 'pending');
  const canLock = acceptedMembers.length >= 2 && acceptedMembers.length <= 4;

  return (
    <>
      <BentoCard delay={0.1} className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-signal" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-dormant font-semibold">Team Management</h3>
          </div>
          <span className="font-mono text-[10px] text-signal bg-signal/10 px-2 py-0.5 rounded border border-signal/20">
            {acceptedMembers.length}/4 Members
          </span>
        </div>

        {message && (
          <div className={`rounded-lg border px-3 py-2 text-xs font-mono mb-4 ${
            message.type === 'success' ? 'border-signal/30 bg-signal/5 text-signal' : 'border-danger/30 bg-danger/5 text-danger'
          }`}>{message.text}</div>
        )}

        {/* Invite Member */}
        <div className="mb-4">
          <label className="font-mono text-[10px] text-dormant uppercase block mb-1.5 font-semibold">Invite New Member</label>
          <div className="flex flex-col xs:flex-row gap-2 w-full">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="member@chitkara.edu.in"
              className="min-w-0 flex-1 w-full rounded-lg border border-white/[0.08] bg-void/60 px-3.5 py-2.5 text-text font-mono text-xs sm:text-sm focus:border-signal focus:outline-none transition-all"
            />
            <button
              onClick={() => doAction('invite_member', { email })}
              disabled={!email.trim() || Boolean(loading?.startsWith('invite_member'))}
              className="min-h-[42px] btn-cyber px-4 py-2 rounded-lg text-xs font-mono uppercase font-bold flex items-center justify-center gap-1.5 shrink-0 w-full xs:w-auto shadow-md"
            >
              {loading?.startsWith('invite_member') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Invite</span>
            </button>
          </div>
        </div>

        {/* Pending Invites */}
        {pendingMembers.length > 0 && (
          <div className="mb-5">
            <p className="font-mono text-[9px] text-dormant uppercase mb-1.5 font-semibold">Pending Invites</p>
            <div className="space-y-1.5">
              {pendingMembers.map(m => (
                <div key={m.user_id} className="rounded-lg border border-gold/15 bg-gold/5 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-body text-sm text-white truncate inline-block max-w-[140px] align-bottom">{m.name}</span>
                    <span className="font-mono text-[9px] text-gold ml-2 uppercase px-1.5 py-0.5 rounded border border-gold/20 bg-gold/10">Pending</span>
                  </div>
                  <button
                    onClick={() => doAction('cancel_invite', { user_id: m.user_id })}
                    disabled={loading === 'cancel_invite' + m.user_id}
                    className="text-dormant hover:text-danger transition-colors p-1.5 shrink-0 rounded hover:bg-white/5"
                    title="Cancel Invite"
                  >
                    {loading === 'cancel_invite' + m.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Lock Team Action */}
        <div className="pt-4 border-t border-white/5">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowLockModal(true)}
              disabled={!canLock || Boolean(loading?.startsWith('lock_team'))}
              className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
                canLock
                  ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] cursor-pointer"
                  : "bg-void/40 border border-white/5 text-dormant cursor-not-allowed opacity-60"
              }`}
            >
              {loading?.startsWith('lock_team') ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span>Lock & Finalize Team Roster</span>
            </button>
            <p className="text-[10px] font-mono text-muted text-center">
              {canLock
                ? "🔒 Ready to finalize: Lock team to proceed with fee payment."
                : `⚠️ Minimum 2 accepted members required to lock (Currently ${acceptedMembers.length}/4).`}
            </p>
          </div>
        </div>
      </BentoCard>

      {/* Confirmation Warning Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0D1017] border border-amber-500/40 rounded-2xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">
                  Lock Team Roster?
                </h3>
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold">
                  Action Irreversible
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 mb-4 text-xs font-body text-amber-200/90 leading-relaxed">
              Locking your team means you will no longer be able to edit or invite members, and your roster will be finalized. Are you sure you want to proceed?
            </div>

            <div className="mb-5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-dormant mb-2 font-semibold">
                Finalized Roster ({acceptedMembers.length} Members):
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {acceptedMembers.map((m, idx) => (
                  <div key={m.user_id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs">
                    <span className="text-white font-medium truncate max-w-[180px]">{m.name}</span>
                    <span className="font-mono text-[9px] text-signal/80 uppercase">
                      {idx === 0 ? "Leader" : "Member"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                disabled={Boolean(loading?.startsWith('lock_team'))}
                className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-mono uppercase text-muted hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doAction('lock_team')}
                disabled={Boolean(loading?.startsWith('lock_team'))}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-mono text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
              >
                {loading?.startsWith('lock_team') ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Locking...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Yes, Lock Team</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
