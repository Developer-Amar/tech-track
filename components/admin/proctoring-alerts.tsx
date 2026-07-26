"use client";

import { useState, useEffect } from "react";

type ProctoringAlert = {
  id: string;
  unit_id: string;
  unit_name: string;
  round_number: number;
  tab_switches: number;
  tab_switch_limit: number;
  locked_out: boolean;
  flagged_at: string | null;
};

export default function ProctoringAlerts({ compact = false }: { compact?: boolean }) {
  const [alerts, setAlerts] = useState<ProctoringAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  async function fetchAlerts() {
    const res = await fetch("/api/admin/proctoring");
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    }
    setLoading(false);
  }

  const flagged = alerts.filter((a) => a.tab_switches > 0);

  if (loading) return <p className="text-dormant text-xs font-mono animate-pulse uppercase tracking-widest">[Loading warnings...]</p>;

  if (flagged.length === 0) {
    return (
      <div className="rounded-xl border border-signal/15 bg-signal/5 px-4 py-3.5">
        <p className="text-signal text-xs font-mono uppercase tracking-widest flex items-center gap-2 font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse" />
          No warnings or strikes detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center gap-2 mb-2 font-mono text-[9px] uppercase tracking-widest text-dormant font-semibold">
        <span className="inline-block h-2 w-2 rounded-full bg-danger animate-pulse" />
        <span className="text-danger">
          {flagged.length} team warning{flagged.length !== 1 ? "s" : ""} active
        </span>
        <span>· Auto-refresh 10s</span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {flagged.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border px-4 py-3.5 flex items-center justify-between gap-3 relative overflow-hidden transition-all duration-300 ${
              alert.locked_out
                ? "border-danger/40 bg-danger/10 shadow-[0_0_12px_rgba(239,68,68,0.15)] animate-pulse"
                : alert.tab_switches >= alert.tab_switch_limit - 1
                ? "border-yellow-500/40 bg-yellow-500/10"
                : "border-dormant/25 bg-void/50"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-text font-display text-lg uppercase truncate font-bold">
                {alert.unit_name}
                <span className="text-dormant text-[10px] font-mono ml-3 font-semibold">Round {alert.round_number}</span>
              </p>
              {alert.flagged_at && (
                <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mt-1">
                  Time: {new Date(alert.flagged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              )}
            </div>

            {/* Strikes count */}
            <div className="text-center shrink-0 border-l border-dormant/10 pl-4">
              <p className={`font-mono text-xl font-bold ${
                alert.locked_out ? "text-danger" : alert.tab_switches >= alert.tab_switch_limit - 1 ? "text-yellow-400" : "text-text"
              }`}>
                {alert.tab_switches}/{alert.tab_switch_limit}
              </p>
              <p className="text-dormant text-[9px] font-mono uppercase tracking-widest font-semibold">STRIKES</p>
            </div>

            {/* Status */}
            <span className={`rounded px-2.5 py-1 text-[9px] font-mono tracking-widest uppercase shrink-0 font-bold ${
              alert.locked_out
                ? "bg-danger text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {alert.locked_out ? "LOCKED" : "WARNING"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
