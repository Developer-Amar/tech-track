"use client";

import { useState } from "react";
import TeamForm from "./team-form";
import InviteBanner from "./invite-banner";
import { Shield, Users } from "lucide-react";

type Invite = {
  unit_id: string;
  team_name: string | null;
  leader_name: string;
};

export default function RegistrationChoices({
  registrationOpen,
  pendingInvites,
}: {
  registrationOpen: boolean;
  pendingInvites: Invite[];
}) {
  const [view, setView] = useState<"choose" | "lead" | "join">("choose");

  if (!registrationOpen) {
    return (
      <div className="glass-panel-danger rounded-xl p-6 border border-danger/30">
        <h3 className="font-display text-2xl font-bold text-danger mb-2 uppercase tracking-wide">
          REGISTRATION CLOSED
        </h3>
        <p className="text-dormant text-sm font-body">
          Registration has closed. New teams can no longer sign up.
        </p>
      </div>
    );
  }

  if (view === "lead") {
    return <TeamForm onCancel={() => setView("choose")} />;
  }

  if (view === "join") {
    return (
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#7DF9FF]/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-mono text-[9px] uppercase text-[#7DF9FF] tracking-widest mb-1 font-semibold">
              INCOMING TRANSMISSIONS
            </p>
            <h3 className="font-display text-2xl font-extrabold text-white uppercase">
              TEAM INVITES
            </h3>
          </div>
          <button
            onClick={() => setView("choose")}
            className="btn-cyber-outline px-4 py-2 rounded-lg text-xs uppercase font-display"
          >
            ← BACK
          </button>
        </div>

        {pendingInvites.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-dormant mx-auto mb-4 opacity-40" />
            <p className="text-dormant text-sm font-body leading-relaxed">
              No team invites yet. Ask a team leader to invite you by your email.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <InviteBanner key={invite.unit_id} invite={invite} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: choose view
  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">
        TEAM REGISTRATION
      </p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-2">
        ENTER THE ARENA
      </h3>
      <p className="text-dormant text-sm font-body mb-6 leading-relaxed">
        Form a team of 2–4 members to compete. Create your own squad or join one
        you&apos;ve been invited to.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Lead a Team */}
        <button
          onClick={() => setView("lead")}
          className="group relative rounded-xl border border-[#7DF9FF]/20 bg-[#7DF9FF]/5 p-6 text-left transition-all hover:border-[#7DF9FF]/40 hover:bg-[#7DF9FF]/10 hover:shadow-[0_0_30px_rgba(125,249,255,0.08)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7DF9FF]/10 border border-[#7DF9FF]/25 mb-4 group-hover:shadow-[0_0_12px_rgba(125,249,255,0.2)] transition-shadow">
            <Shield className="w-5 h-5 text-[#7DF9FF]" />
          </div>
          <h4 className="font-display text-xl font-bold text-white uppercase tracking-wide mb-2">
            LEAD THE CHARGE
          </h4>
          <p className="text-dormant text-xs font-body leading-relaxed">
            Create a team, invite members by email, and lock your roster when
            ready.
          </p>
        </button>

        {/* Join a Team */}
        <button
          onClick={() => setView("join")}
          className="group relative rounded-xl border border-signal/20 bg-signal/5 p-6 text-left transition-all hover:border-signal/40 hover:bg-signal/10 hover:shadow-[0_0_30px_rgba(255,30,86,0.08)]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal/10 border border-signal/25 mb-4 group-hover:shadow-[0_0_12px_rgba(255,30,86,0.2)] transition-shadow">
            <Users className="w-5 h-5 text-signal" />
          </div>
          <h4 className="font-display text-xl font-bold text-white uppercase tracking-wide mb-2">
            JOIN A TEAM
          </h4>
          <p className="text-dormant text-xs font-body leading-relaxed">
            View and respond to team invites from other players.
          </p>
          {pendingInvites.length > 0 && (
            <span className="absolute top-4 right-4 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-signal animate-ping" />
              <span className="font-mono text-[9px] text-signal font-bold tracking-widest">
                {pendingInvites.length} INVITE{pendingInvites.length > 1 ? "S" : ""}
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
