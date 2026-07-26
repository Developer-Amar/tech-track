"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";
import { ShieldAlert, AlertTriangle, Radio, Users, CheckCircle2, XCircle } from "lucide-react";

type UnitInfo = {
  id: string;
  name: string | null;
  unit_type: string;
  locked: boolean;
  disqualified: boolean;
  leader_name: string;
  member_count: number;
};

export default function SuperAdminPanel({
  registrationOpen,
  eventLive,
  units,
  ideSmartFeatures,
}: {
  registrationOpen: boolean;
  eventLive: boolean;
  units: UnitInfo[];
  ideSmartFeatures: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  async function runOverride(body: Record<string, unknown>) {
    setLoading(body.action as string);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/admin/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({ error: "Request failed" }));

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setMessage(data.message || "Done");
    }

    setLoading(null);
    setConfirmAction(null);
    router.refresh();
  }

  return (
    <BentoCard glowColor="danger" className="p-6 md:p-8 bg-black/40 border-red-500/20 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-red-500/10 group-hover:scale-110" />
      
      <div className="border-b border-red-500/20 pb-4 mb-6 relative z-10">
        <p className="font-mono text-[10px] uppercase text-red-500 tracking-[0.2em] mb-2 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 animate-pulse" /> SUPER CONTROL PANEL
        </p>
        <h3 className="font-display text-3xl md:text-4xl font-bold text-white uppercase tracking-wider drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">
          SUPER ADMIN OVERRIDES
        </h3>
        <p className="text-muted text-sm font-body leading-relaxed mt-2 max-w-2xl">
          Emergency overrides. All mutations are logged in the audit trail. Proceed with extreme caution.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-signal/30 bg-signal/5 p-3">
          <p className="text-signal text-xs font-mono font-semibold">Success: {message}</p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-danger text-xs font-mono font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Global controls */}
      <div className="space-y-3">
        {/* Registration */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dormant/15 bg-void/40 p-4">
          <div>
            <p className="text-text font-display text-lg uppercase tracking-wide font-bold">REGISTRATION PORTAL</p>
            <p className="text-dormant font-mono text-xs uppercase font-semibold">
              Status: {registrationOpen ? "Open" : "Closed"}
            </p>
          </div>
          {!registrationOpen && (
            <button
              onClick={() => {
                if (confirmAction === "reopen") {
                  runOverride({ action: "reopen_registration" });
                } else {
                  setConfirmAction("reopen");
                }
              }}
              disabled={loading !== null}
              className="btn-cyber px-4 py-2 rounded-lg text-xs uppercase"
            >
              {confirmAction === "reopen" ? "CONFIRM REOPEN?" : "REOPEN PORTAL"}
            </button>
          )}
        </div>

        {/* Event */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dormant/15 bg-void/40 p-4">
          <div>
            <p className="text-text font-display text-lg uppercase tracking-wide font-bold">EVENT STATUS</p>
            <p className="text-dormant font-mono text-xs uppercase font-semibold">
              Status: {eventLive ? "LIVE" : "STOPPED"}
            </p>
          </div>
          <button
            onClick={() => runOverride({ action: "toggle_event_live" })}
            disabled={loading !== null}
            className={`btn-cyber px-4 py-2 rounded-lg text-xs uppercase ${
              eventLive ? "bg-danger hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white" : ""
            }`}
          >
            {loading === "toggle_event_live" ? "CHANGING..." : eventLive ? "STOP EVENT" : "START EVENT"}
          </button>
        </div>

        {/* IDE Smart Features Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dormant/15 bg-void/40 p-4">
          <div>
            <p className="text-text font-display text-lg uppercase tracking-wide font-bold">IDE Smart Features</p>
            <p className="text-dormant font-mono text-xs uppercase font-semibold">
              Status: {ideSmartFeatures ? "ENABLED (Auto-Close + Indentation Active)" : "DISABLED (Standard Textarea)"}
            </p>
          </div>
          <button
            onClick={() => runOverride({ action: "toggle_ide_smart_features", enabled: !ideSmartFeatures })}
            disabled={loading !== null}
            className={`btn-cyber px-4 py-2 rounded-lg text-xs uppercase ${
              !ideSmartFeatures ? "bg-amber-600 hover:shadow-[0_0_15px_rgba(217,119,6,0.4)] text-white" : ""
            }`}
          >
            {loading === "toggle_ide_smart_features" ? "CHANGING..." : ideSmartFeatures ? "DISABLE FEATURES" : "ENABLE FEATURES"}
          </button>
        </div>

        {/* Nuclear Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4">
          <div>
            <p className="text-danger font-display text-lg uppercase tracking-wide font-bold">GLOBAL PLATFORM RESET</p>
            <p className="text-dormant font-mono text-xs uppercase font-semibold">
              ⚠️ Warning: Wipes all teams, progress records, submissions, and codes.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirmAction === "nuke") {
                runOverride({ action: "reset_all_registrations" });
              } else {
                setConfirmAction("nuke");
              }
            }}
            disabled={loading !== null}
            className="rounded-lg bg-danger border border-danger/35 hover:bg-danger/80 transition-all text-white px-4 py-2 text-xs font-mono uppercase tracking-widest font-bold"
          >
            {confirmAction === "nuke" ? "CONFIRM RESET ALL" : "RESET ALL DATA"}
          </button>
        </div>
      </div>

      {/* Proctoring Controls */}
      <div className="pt-4 border-t border-dormant/10">
        <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-2 font-semibold">PROCTORING CONTROLS</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => runOverride({ action: "reset_tab_switches" })}
            disabled={loading !== null}
            className="btn-cyber px-4 py-2 rounded-lg text-xs uppercase"
          >
            RESET ALL TAB STRIKES
          </button>
          <button
            onClick={() => {
              const limit = prompt("New tab switch limit for ALL teams:");
              if (limit && parseInt(limit) > 0) {
                runOverride({ action: "set_tab_switch_limit", limit: parseInt(limit) });
              }
            }}
            disabled={loading !== null}
            className="btn-cyber-outline px-4 py-2 rounded-lg text-xs uppercase"
          >
            SET GLOBAL TAB LIMIT
          </button>
        </div>
      </div>

      {/* Broadcast Announcement */}
      <div className="pt-4 border-t border-dormant/10 space-y-3">
        <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1 font-semibold">BROADCAST ANNOUNCEMENT</p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            id="announcement-input"
            placeholder="Type announcement message..."
            className="flex-1 rounded-lg border border-signal/20 bg-void/50 px-4 py-2 text-text font-body text-sm focus:border-signal focus:outline-none"
          />
          <div className="flex gap-2 shrink-0">
            <select
              id="announcement-priority"
              className="rounded-lg border border-signal/20 bg-void/50 px-3 py-2 text-text font-mono text-xs focus:outline-none"
            >
              <option value="normal" className="bg-void">NORMAL</option>
              <option value="urgent" className="bg-void">URGENT</option>
            </select>
            <button
              onClick={async () => {
                const input = document.getElementById("announcement-input") as HTMLInputElement;
                const priority = document.getElementById("announcement-priority") as HTMLSelectElement;
                if (!input.value.trim()) return;
                setLoading("announcement");
                const res = await fetch("/api/admin/announcements", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: input.value.trim(), priority: priority.value }),
                });
                const data = await res.json();
                setMessage(data.success ? "Announcement sent!" : (data.error || "Failed"));
                if (data.success) input.value = "";
                setLoading(null);
              }}
              disabled={loading !== null}
              className="btn-cyber px-5 py-2 rounded-lg text-xs uppercase"
            >
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* Unit list */}
      {units.length > 0 && (
        <div className="pt-6 border-t border-dormant/10 space-y-3">
          <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-2 font-semibold">TEAMS ({units.length})</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {units.map((unit) => (
              <div
                key={unit.id}
                className={`rounded-xl border px-4 py-3 bg-void/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  unit.disqualified ? "border-danger/25 bg-danger/5" : "border-dormant/15"
                }`}
              >
                <div>
                  <p className="text-text font-display text-lg uppercase tracking-wide font-bold">
                    {unit.name || `SOLO — ${unit.leader_name}`}
                    <span className="ml-3 text-[10px] text-dormant font-mono uppercase font-semibold">
                      ({unit.unit_type})
                    </span>
                  </p>
                  <p className="text-dormant font-mono text-[10px] uppercase mt-1">
                    Status: {unit.locked ? "🔒 Locked" : "🔓 Unlocked"}
                    {unit.disqualified && " · ❌ Disqualified"}
                    {" · "}{unit.member_count} member{unit.member_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  {unit.locked && (
                    <button
                      onClick={() => runOverride({ action: "unlock_unit", unit_id: unit.id })}
                      disabled={loading !== null}
                      className="rounded-lg border border-signal/30 px-3 py-1.5 text-signal text-[10px] font-mono hover:bg-signal/15 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                    >
                      {loading === "unlock_unit" ? "..." : "UNLOCK"}
                    </button>
                  )}
                  {!unit.disqualified ? (
                    <button
                      onClick={() => runOverride({ action: "disqualify_unit", unit_id: unit.id, reason: "Disqualified by Super Admin" })}
                      disabled={loading !== null}
                      className="rounded-lg border border-danger/30 px-3 py-1.5 text-danger text-[10px] font-mono hover:bg-danger/15 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                    >
                      DISQUALIFY
                    </button>
                  ) : (
                    <button
                      onClick={() => runOverride({ action: "reinstate_unit", unit_id: unit.id })}
                      disabled={loading !== null}
                      className="rounded-lg border border-signal/30 px-3 py-1.5 text-signal text-[10px] font-mono hover:bg-signal/15 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                    >
                      REINSTATE
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirmAction === `del-${unit.id}`) {
                        runOverride({ action: "delete_unit", unit_id: unit.id });
                      } else {
                        setConfirmAction(`del-${unit.id}`);
                      }
                    }}
                    disabled={loading !== null}
                    className="rounded-lg border border-danger/35 px-3 py-1.5 text-danger text-[10px] font-mono hover:bg-danger/15 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                  >
                    {confirmAction === `del-${unit.id}` ? "CONFIRM WIPE?" : "WIPE TEAM"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BentoCard>
  );
}
