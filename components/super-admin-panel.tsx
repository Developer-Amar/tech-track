"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";
import { ShieldAlert, AlertTriangle, Radio, Users, CheckCircle2, XCircle, Send, Loader2, Unlock, Lock } from "lucide-react";

type UnitInfo = {
  id: string;
  name: string | null;
  unit_type: string;
  locked: boolean;
  disqualified: boolean;
  leader_name: string;
  member_count: number;
  proctor_locked: boolean;
  tab_switches: number;
  tab_switch_limit: number;
  ai_flags_count: number;
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
  const [announcementState, setAnnouncementState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
    <BentoCard glowColor="danger" hoverScale={false} className="p-6 md:p-8 bg-black/40 border-red-500/20 relative overflow-hidden group">
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
        <div className="rounded-xl border border-[#7DF9FF]/40 bg-[#7DF9FF]/10 p-3 flex items-center justify-between animate-in fade-in duration-200">
          <p className="text-[#7DF9FF] text-xs font-mono font-semibold flex items-center gap-2">
            <span>✓ SUCCESS:</span> {message}
          </p>
          <button onClick={() => setMessage(null)} className="text-[#7DF9FF]/60 hover:text-[#7DF9FF] text-xs font-mono p-1">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex items-center justify-between animate-in fade-in duration-200">
          <p className="text-red-400 text-xs font-mono font-semibold flex items-center gap-2">
            <span>⚠️ ERROR:</span> {error}
          </p>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-xs font-mono p-1">✕</button>
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
        {units.filter((u) => u.proctor_locked).length > 0 && (
          <div className="mb-3 p-3 rounded-xl border border-red-500/40 bg-red-950/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
              <span className="text-red-300 font-mono text-xs uppercase font-bold">
                {units.filter((u) => u.proctor_locked).length} TEAM(S) CURRENTLY LOCKED OUT BY PROCTOR
              </span>
            </div>
            <button
              onClick={() => runOverride({ action: "reset_tab_switches" })}
              disabled={loading !== null}
              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] uppercase font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              UNLOCK ALL LOCKED TEAMS
            </button>
          </div>
        )}
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
              <option value="normal">Normal Priority</option>
              <option value="urgent">Urgent Priority</option>
            </select>
            <button
              onClick={async () => {
                const input = document.getElementById("announcement-input") as HTMLInputElement;
                const priority = document.getElementById("announcement-priority") as HTMLSelectElement;
                if (!input.value.trim() || announcementState === "sending") return;
                setAnnouncementState("sending");
                setLoading("announcement");
                setMessage(null);
                setError(null);
                try {
                  const res = await fetch("/api/admin/announcements", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: input.value.trim(), priority: priority.value }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setAnnouncementState("sent");
                    setMessage("Announcement broadcasted successfully to all screens!");
                    setError(null);
                    input.value = "";
                    setTimeout(() => {
                      setAnnouncementState("idle");
                      setMessage(null);
                    }, 4000);
                  } else {
                    setAnnouncementState("error");
                    setError(data.error || "Broadcast failed");
                    setMessage(null);
                    setTimeout(() => {
                      setAnnouncementState("idle");
                      setError(null);
                    }, 6000);
                  }
                } catch {
                  setAnnouncementState("error");
                  setError("Network error broadcasting announcement");
                  setMessage(null);
                  setTimeout(() => {
                    setAnnouncementState("idle");
                    setError(null);
                  }, 6000);
                } finally {
                  setLoading(null);
                }
              }}
              disabled={loading !== null || announcementState === "sending"}
              className={`px-5 py-2 rounded-lg text-xs uppercase font-mono font-semibold flex items-center justify-center gap-2 transition-all duration-300 min-w-[120px] select-none ${
                announcementState === "sending"
                  ? "bg-[#7DF9FF]/20 border border-[#7DF9FF] text-[#7DF9FF] cursor-wait"
                  : announcementState === "sent"
                  ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-105"
                  : announcementState === "error"
                  ? "bg-red-500/20 border border-red-500 text-red-400"
                  : "btn-cyber hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {announcementState === "sending" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7DF9FF]" />
                  <span>DISPATCHING...</span>
                </>
              ) : announcementState === "sent" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DISPATCHED!</span>
                </>
              ) : announcementState === "error" ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>FAILED</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND</span>
                </>
              )}
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
                className={`rounded-xl border px-4 py-3.5 bg-void/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  unit.proctor_locked
                    ? "border-red-500/50 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                    : unit.disqualified
                    ? "border-danger/25 bg-danger/5"
                    : "border-dormant/15"
                }`}
              >
                <div>
                  <p className="text-text font-display text-lg uppercase tracking-wide font-bold">
                    {unit.name || unit.leader_name || "Unnamed Team"}
                    <span className="ml-3 text-[10px] text-dormant font-mono uppercase font-semibold">
                      ({unit.unit_type})
                    </span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${
                      unit.locked ? "bg-white/5 border-white/10 text-muted" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      Roster: {unit.locked ? "Locked 🔒" : "Open 🔓"}
                    </span>

                    {unit.proctor_locked ? (
                      <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded border border-red-500 bg-red-950/80 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse flex items-center gap-1">
                        🚨 PROCTOR LOCKED OUT ({unit.tab_switches}/{unit.tab_switch_limit} STRIKES)
                      </span>
                    ) : unit.tab_switches > 0 ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-amber-500/50 bg-amber-950/50 text-amber-300 font-semibold flex items-center gap-1">
                        ⚠️ {unit.tab_switches}/{unit.tab_switch_limit} STRIKES
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[#7DF9FF]/20 bg-[#7DF9FF]/5 text-[#7DF9FF] font-semibold">
                        🛡️ PROCTOR: OK
                      </span>
                    )}

                    {unit.ai_flags_count > 0 && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-purple-500/50 bg-purple-950/50 text-purple-300 font-semibold">
                        🤖 {unit.ai_flags_count} AI FLAG{unit.ai_flags_count > 1 ? "S" : ""}
                      </span>
                    )}

                    {unit.disqualified && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-red-500/50 bg-red-950/50 text-red-400 font-semibold">
                        ❌ Disqualified
                      </span>
                    )}

                    <span className="text-[10px] text-muted font-mono uppercase">
                      · {unit.member_count} member{unit.member_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0 items-center">
                  {/* PROCTOR UNLOCK: Prominent glowing button whenever team is locked out or has strikes */}
                  {(unit.proctor_locked || unit.tab_switches > 0) && (
                    <button
                      onClick={() => runOverride({ action: "reset_tab_switches", unit_id: unit.id })}
                      disabled={loading !== null}
                      className="rounded-lg border border-emerald-500 bg-emerald-500/20 px-3 py-1.5 text-emerald-300 text-[10px] font-mono hover:bg-emerald-500/30 transition-all duration-300 disabled:opacity-50 uppercase font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-1.5"
                      title="Clear proctor lockout, reset strikes to 0, and unblock device session"
                    >
                      <Unlock className="w-3 h-3" />
                      {loading === "reset_tab_switches" ? "UNLOCKING..." : "UNLOCK PROCTOR"}
                    </button>
                  )}

                  {/* Roster Controls */}
                  {unit.locked ? (
                    <button
                      onClick={() => runOverride({ action: "unlock_unit", unit_id: unit.id })}
                      disabled={loading !== null}
                      className="rounded-lg border border-signal/30 px-3 py-1.5 text-signal text-[10px] font-mono hover:bg-signal/15 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                      title="Unlock roster to allow team member edits"
                    >
                      {loading === "unlock_unit" ? "..." : "UNLOCK ROSTER"}
                    </button>
                  ) : (
                    <button
                      onClick={() => runOverride({ action: "lock_unit", unit_id: unit.id })}
                      disabled={loading !== null}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-muted hover:text-white text-[10px] font-mono hover:bg-white/5 transition-all duration-300 disabled:opacity-50 uppercase font-semibold"
                      title="Lock roster to finalize team registration"
                    >
                      {loading === "lock_unit" ? "..." : "LOCK ROSTER"}
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
