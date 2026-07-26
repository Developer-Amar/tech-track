type Member = {
  name: string;
  email: string;
  status: string;
  is_leader: boolean;
};

export default function LockedStatus({
  unitType,
  teamName,
  members,
}: {
  unitType: "solo" | "team";
  teamName: string | null;
  members: Member[];
}) {
  return (
    <div className="glass-panel border-signal/45 bg-signal/5 rounded-2xl p-6 text-left relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/15 border border-signal/40 shadow-[0_0_15px_rgba(255,30,86,0.2)]">
          <svg className="h-5 w-5 text-signal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-signal font-semibold">REGISTRATION STATUS: SECURED</p>
          <h3 className="font-display text-2xl font-extrabold text-white uppercase">
            {unitType === "solo"
              ? "Locked in — Solo"
              : `Locked in — ${teamName}`}
          </h3>
        </div>
      </div>

      {unitType === "team" && (
        <div className="space-y-2 mt-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-dormant mb-2 font-semibold">CONFIRMED TEAM MEMBERS</p>
          {members
            .filter((m) => m.status === "accepted")
            .map((member) => (
              <div
                key={member.email}
                className="flex items-center justify-between rounded-xl border border-dormant/15 bg-void/30 px-4 py-2.5"
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
                <span className="rounded bg-signal/10 border border-signal/25 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]">
                  LOCKED
                </span>
              </div>
            ))}
        </div>
      )}

      <div className="h-px bg-dormant/10 my-4" />
      <p className="text-dormant text-xs font-mono uppercase tracking-wider leading-relaxed">
        📡 Registration is final. The hunt will begin once the organizers start the event clock.
      </p>
    </div>
  );
}
