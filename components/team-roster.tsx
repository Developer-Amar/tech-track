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
    <div className="glass-panel border-signal/25 rounded-2xl p-6 text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">TEAM MANAGEMENT</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1">
        {teamName}
      </h3>
      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        Waiting for members to respond. Roster updates dynamically in real-time.
      </p>

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center justify-between rounded-xl border border-dormant/15 bg-void/30 px-4 py-3"
          >
            <div>
              <p className="text-text font-body text-sm font-semibold">
                {member.name}
                {member.is_leader && (
                  <span className="ml-2 text-[9px] text-signal font-mono uppercase tracking-wider font-bold">
                    [LEADER]
                  </span>
                )}
              </p>
              <p className="text-dormant font-mono text-xs">{member.email}</p>
            </div>
            <span
              className={`rounded px-3 py-1 text-[9px] font-mono uppercase tracking-wider ${statusStyles[member.status] ?? ""}`}
            >
              {member.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
