"use client";

import { useState } from "react";
import BentoCard from "@/components/bento-card";
import { UserPlus, UserMinus, XCircle, Loader2, Send, Settings } from "lucide-react";

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

  return (
    <BentoCard delay={0.1} className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-signal" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-dormant font-semibold">Team Management</h3>
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
        <div>
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
    </BentoCard>
  );
}
