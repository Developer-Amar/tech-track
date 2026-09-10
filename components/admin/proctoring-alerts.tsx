"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Eye,
  Lock,
  RefreshCw,
  Unlock,
  ShieldAlert,
} from "lucide-react";

type ProctoringAlert = {
  id: string;
  unit_id: string;
  unit_name: string;
  round_number: number;
  tab_switches: number;
  tab_switch_limit: number;
  locked_out: boolean;
  ai_flags_count: number;
  flagged_at: string | null;
};

type ProctoringEvent = {
  id: string;
  unit_id: string;
  unit_name: string;
  round_number: number;
  event_type: string;
  severity: string;
  metadata: {
    snippet_preview?: string;
    char_count?: number;
    ai_score?: number;
    ai_suspicion?: number;
    confidence?: string;
    reasons?: string[];
    detail?: string;
    reported_by?: string;
  };
  occurred_at: string;
};

export default function ProctoringAlerts({ compact = false }: { compact?: boolean }) {
  const [alerts, setAlerts] = useState<ProctoringAlert[]>([]);
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [inspectEvent, setInspectEvent] = useState<ProctoringEvent | null>(null);
  const [activeTab, setActiveTab] = useState<"teams" | "events">("teams");

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/proctoring");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
        setEvents(data.recent_events ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch proctoring alerts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 6000); // 6s poll
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  async function handleResetStrikes(unitId: string) {
    setActing(unitId);
    try {
      await fetch("/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_tab_switches", unit_id: unitId }),
      });
      await fetchAlerts();
    } catch (err) {
      console.error(err);
    } finally {
      setActing(null);
    }
  }

  async function handleUnlockUnit(unitId: string) {
    setActing(unitId);
    try {
      await fetch("/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_unit", unit_id: unitId }),
      });
      await fetchAlerts();
    } catch (err) {
      console.error(err);
    } finally {
      setActing(null);
    }
  }

  const flaggedTeams = alerts.filter((a) => a.tab_switches > 0 || a.ai_flags_count > 0 || a.locked_out);

  if (loading) {
    return (
      <p className="text-dormant text-xs font-mono animate-pulse uppercase tracking-widest">
        [Loading AI Proctor Radar...]
      </p>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-dormant/15 pb-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <button
            onClick={() => setActiveTab("teams")}
            className={`px-2.5 py-1 rounded font-bold transition-all ${
              activeTab === "teams"
                ? "bg-signal/20 text-signal border border-signal/40"
                : "text-dormant hover:text-text"
            }`}
          >
            Flagged Teams ({flaggedTeams.length})
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`px-2.5 py-1 rounded font-bold transition-all ${
              activeTab === "events"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-dormant hover:text-text"
            }`}
          >
            AI Incident Stream ({events.length})
          </button>
        </div>

        <button
          onClick={fetchAlerts}
          className="text-dormant hover:text-signal transition-colors p-1"
          title="Refresh Feed"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab 1: Teams List */}
      {activeTab === "teams" && (
        <>
          {flaggedTeams.length === 0 ? (
            <div className="rounded-xl border border-signal/20 bg-signal/5 px-4 py-3.5">
              <p className="text-signal text-xs font-mono uppercase tracking-widest flex items-center gap-2 font-semibold">
                <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse" />
                All clear. No proctor warnings or AI flags active.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {flaggedTeams.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden transition-all ${
                    alert.locked_out
                      ? "border-danger/50 bg-danger/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                      : alert.ai_flags_count > 0
                      ? "border-purple-500/40 bg-purple-500/5"
                      : alert.tab_switches >= alert.tab_switch_limit - 1
                      ? "border-yellow-500/40 bg-yellow-500/10"
                      : "border-dormant/25 bg-void/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-text font-display text-base uppercase font-bold truncate">
                        {alert.unit_name}
                      </p>
                      <span className="text-dormant text-[10px] font-mono font-semibold">
                        Round {alert.round_number}
                      </span>
                      {alert.ai_flags_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 font-semibold">
                          <Bot className="w-2.5 h-2.5" /> {alert.ai_flags_count} AI Flag{alert.ai_flags_count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {alert.flagged_at && (
                      <p className="text-dormant text-[9px] font-mono uppercase tracking-wider mt-1">
                        Last Activity: {new Date(alert.flagged_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Strikes */}
                    <div className="text-center px-3 border-l border-dormant/15">
                      <p
                        className={`font-mono text-lg font-bold leading-tight ${
                          alert.locked_out
                            ? "text-danger"
                            : alert.tab_switches >= alert.tab_switch_limit - 1
                            ? "text-yellow-400"
                            : "text-text"
                        }`}
                      >
                        {alert.tab_switches}/{alert.tab_switch_limit}
                      </p>
                      <p className="text-dormant text-[8px] font-mono uppercase tracking-widest font-semibold">
                        STRIKES
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`rounded px-2.5 py-1 text-[9px] font-mono tracking-widest uppercase font-bold ${
                        alert.locked_out
                          ? "bg-danger text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {alert.locked_out ? "LOCKED" : "WARNING"}
                    </span>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      {alert.locked_out ? (
                        <button
                          onClick={() => handleUnlockUnit(alert.unit_id)}
                          disabled={acting === alert.unit_id}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] font-mono uppercase tracking-wider font-semibold transition-all flex items-center gap-1"
                          title="Unlock Team Console"
                        >
                          <Unlock className="w-3 h-3" /> Unlock
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResetStrikes(alert.unit_id)}
                          disabled={acting === alert.unit_id}
                          className="px-2 py-1 rounded bg-white/[0.06] text-dormant hover:text-white border border-white/[0.08] hover:bg-white/[0.1] text-[10px] font-mono uppercase tracking-wider transition-all flex items-center gap-1"
                          title="Pardon / Reset Tab Strikes"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: AI Incident Stream */}
      {activeTab === "events" && (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="text-dormant text-xs font-mono p-4 text-center">
              No recent proctoring telemetry recorded yet.
            </p>
          ) : (
            events.map((ev) => {
              const isAi = ev.event_type === "ai_code_flag";
              const isPaste = ev.event_type === "paste_detected";
              const isDevTools = ev.event_type === "devtools_opened";

              return (
                <div
                  key={ev.id}
                  className="rounded-lg border border-white/[0.07] bg-void/60 px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono hover:border-white/[0.15] transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`p-1 rounded ${
                        isAi
                          ? "bg-purple-500/20 text-purple-300"
                          : isDevTools
                          ? "bg-red-500/20 text-red-300"
                          : isPaste
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {isAi ? (
                        <Bot className="w-3.5 h-3.5" />
                      ) : isPaste ? (
                        <Clipboard className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="text-text font-bold truncate">
                        {ev.unit_name}
                        <span className="text-dormant font-normal ml-2 text-[10px]">
                          (R{ev.round_number})
                        </span>
                      </p>
                      <p className="text-[10px] text-dormant truncate">
                        {isAi && `AI Score: ${ev.metadata.ai_score}% — ${ev.metadata.reasons?.[0] || "LLM structure detected"}`}
                        {isPaste && `Pasted ${ev.metadata.char_count ?? "code"} characters`}
                        {ev.event_type === "tab_switch" && "Browser tab switched or minimized"}
                        {ev.event_type === "focus_loss" && "Window focus lost to external app"}
                        {isDevTools && "Browser Developer Tools triggered"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] text-dormant font-mono">
                      {new Date(ev.occurred_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>

                    {(isPaste || isAi) && (ev.metadata.snippet_preview || ev.metadata.reasons) && (
                      <button
                        onClick={() => setInspectEvent(ev)}
                        className="px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-dormant hover:text-white text-[9px] flex items-center gap-1 transition-all"
                        title="Inspect Incident Detail"
                      >
                        <Eye className="w-2.5 h-2.5" /> Inspect
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Snippet Inspector Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl border border-white/[0.15] bg-[#0A0D14] p-6 max-w-lg w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded bg-purple-500/20 text-purple-300">
                  <Bot className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-display text-base font-bold text-white uppercase">
                    Incident Inspector
                  </h4>
                  <p className="text-dormant text-[10px] font-mono">
                    Team: {inspectEvent.unit_name} · Round {inspectEvent.round_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectEvent(null)}
                className="text-dormant hover:text-white font-mono text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            {inspectEvent.metadata.ai_score !== undefined && (
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-purple-300 uppercase font-semibold">
                    AI Probability Index
                  </span>
                  <span className="font-mono text-sm text-purple-400 font-bold">
                    {inspectEvent.metadata.ai_score}%
                  </span>
                </div>
                {inspectEvent.metadata.reasons && inspectEvent.metadata.reasons.length > 0 && (
                  <ul className="text-[11px] text-text/80 space-y-1 mt-2 list-disc pl-4 font-mono">
                    {inspectEvent.metadata.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {inspectEvent.metadata.snippet_preview && (
              <div>
                <p className="font-mono text-[10px] text-dormant uppercase tracking-wider mb-1 font-semibold">
                  Captured Code / Paste Snippet:
                </p>
                <pre className="rounded-lg bg-black/60 border border-white/[0.08] p-3 text-emerald-400 font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {inspectEvent.metadata.snippet_preview}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-mono uppercase tracking-wider font-semibold transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
