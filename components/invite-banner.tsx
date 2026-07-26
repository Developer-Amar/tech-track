"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteBanner({
  invite,
}: {
  invite: {
    unit_id: string;
    team_name: string | null;
    leader_name: string;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(response: "accepted" | "declined") {
    setLoading(response === "accepted" ? "accept" : "decline");
    setError(null);

    const res = await fetch("/api/units/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unit_id: invite.unit_id,
        response,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Something went wrong" }));
      setError(data.error || "Something went wrong");
      setLoading(null);
      return;
    }

    router.refresh();
  }

  return (
    <div className="glass-panel border-signal/30 bg-signal/5 p-5 mb-4 relative overflow-hidden rounded-2xl">
      <div className="absolute top-0 right-0 w-2 h-2 bg-signal animate-ping" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-signal mb-1.5 font-semibold">TEAM INVITATION</p>
          <p className="text-text font-body text-sm leading-relaxed">
            <span className="font-bold text-white uppercase">{invite.leader_name}</span> has invited you to join team{" "}
            <span className="font-bold text-signal underline">
              {invite.team_name ?? "their unit"}
            </span>
          </p>
          {error && (
            <p className="text-danger text-xs font-mono mt-1">Error: {error}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => handleRespond("declined")}
            disabled={loading !== null}
            className="flex-1 sm:flex-none btn-cyber-outline px-4 py-2 rounded-lg text-xs uppercase font-display border-danger/45 text-danger hover:bg-danger/10 hover:border-danger"
          >
            {loading === "decline" ? "..." : "Decline"}
          </button>
          <button
            onClick={() => handleRespond("accepted")}
            disabled={loading !== null}
            className="flex-1 sm:flex-none btn-cyber px-5 py-2 rounded-lg text-xs uppercase"
          >
            {loading === "accept" ? "..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
