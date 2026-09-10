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
    <BentoCard delay={0.1} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-signal" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-dormant">Team Management</h3>
      </div>

      {message && (
        <div className={`rounded-lg border px-3 py-2 text-xs font-mono mb-4 ${
          message.type === 'success' ? 'border-signal/30 bg-signal/5 text-signal' : 'border-danger/30 bg-danger/5 text-danger'
        }`}>{message.text}</div>
      )}

      {/* Invite Member */}
      <div className="mb-4">
        <label className="font-mono text-[10px] text-dormant uppercase block mb-1">Invite New Member</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="member@chitkara.edu.in"
            className="flex-1 rounded-lg border border-white/[0.08] bg-void/60 px-3 py-2 text-text font-mono text-sm focus:border-signal focus:outline-none"
          />
          <button
            onClick={() => doAction('invite_member', { email })}
            disabled={!email.trim() || loading === 'invite_member' + email}
            className="btn-cyber px-4 py-2 rounded-lg text-xs flex items-center gap-1"
          >
            {loading?.startsWith('invite_member') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Invite
          </button>
        </div>
      </div>

      {/* Pending Invites */}
      {pendingMembers.length > 0 && (
        <div>
          <p className="font-mono text-[9px] text-dormant uppercase mb-1">Pending Invites</p>
          <div className="space-y-1">
            {pendingMembers.map(m => (
              <div key={m.user_id} className="rounded-lg border border-gold/15 bg-gold/5 px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-body text-sm text-white">{m.name}</span>
                  <span className="font-mono text-[10px] text-gold ml-2">Pending</span>
                </div>
                <button
                  onClick={() => doAction('cancel_invite', { user_id: m.user_id })}
                  disabled={loading === 'cancel_invite' + m.user_id}
                  className="text-dormant hover:text-danger transition-colors p-1"
                >
                  {loading === 'cancel_invite' + m.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </BentoCard>
  );
}
