"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  name: string;
  email: string;
  status: "pending" | "accepted" | "declined";
  is_leader: boolean;
};

export default function TeamRoster({
  unitId,
  teamName,
  initialMembers,
}: {
  unitId: string;
  teamName: string;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`roster-${unitId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "unit_members",
          filter: `unit_id=eq.${unitId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; status: string };
          setMembers((prev) =>
            prev.map((m) =>
              m.user_id === updated.user_id
                ? { ...m, status: updated.status as Member["status"] }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId]);

  const statusStyles: Record<string, string> = {
    accepted: "bg-signal/15 border border-signal/30 text-signal shadow-[0_0_10px_rgba(255,30,86,0.15)]",
    pending: "bg-dormant/10 border border-dormant/25 text-dormant",
    declined: "bg-danger/15 border border-danger/30 text-danger",
  };

  return (
    <div className="glass-panel border-signal/25 rounded-2xl p-4 sm:p-6 text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">TEAM MANAGEMENT</p>
      <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white uppercase mb-1 break-words">
        {teamName}
      </h3>
      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        Waiting for members to respond. Roster updates dynamically in real-time.
      </p>

      <div className="space-y-2.5 sm:space-y-3">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center justify-between rounded-xl border border-dormant/15 bg-void/30 p-3 sm:px-4 sm:py-3 gap-2 min-w-0"
          >
            <div className="min-w-0 flex-1 pr-1.5">
              <p className="text-text font-body text-sm font-semibold truncate flex items-center gap-1.5">
                <span className="truncate">{member.name}</span>
                {member.is_leader && (
                  <span className="text-[9px] text-signal font-mono uppercase tracking-wider font-bold shrink-0">
                    [LEADER]
                  </span>
                )}
              </p>
              <p className="text-dormant font-mono text-xs truncate max-w-full overflow-hidden text-ellipsis" title={member.email}>
                {member.email}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`rounded px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider font-bold whitespace-nowrap shrink-0 ${statusStyles[member.status] ?? ""}`}
              >
                {member.status}
              </span>
              {!member.is_leader && (
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${member.name} from the team?`)) return;
                    await fetch('/api/units/manage', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'remove_member', user_id: member.user_id }),
                    });
                    setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
                  }}
                  className="text-dormant hover:text-danger transition-colors p-1 shrink-0"
                  title="Remove Member"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="23" y2="12"></line><line x1="23" y1="8" x2="19" y2="12"></line></svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
