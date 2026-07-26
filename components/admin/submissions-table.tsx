"use client";

import { useState, useEffect } from "react";

type Submission = {
  id: string;
  unit_name: string;
  round_number: number;
  language: string;
  passed: boolean;
  attempt_number: number;
  submitted_at: string;
  code: string;
  tab_switches?: number;
  flagged?: boolean;
  time_taken_seconds?: number;
  paste_count?: number;
  keystroke_count?: number;
};

export default function SubmissionsTable() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRound, setFilterRound] = useState<string>("");
  const [filterVerdict, setFilterVerdict] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterRound) params.set("round", filterRound);
    if (filterVerdict) params.set("passed", filterVerdict);

    fetch(`/api/admin/submissions?${params}`)
      .then((r) => r.json())
      .then((d) => setSubmissions(d.submissions ?? []))
      .finally(() => setLoading(false));
  }, [filterRound, filterVerdict]);

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading submissions...]</p>;

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterRound}
            onChange={(e) => {
              setLoading(true);
              setFilterRound(e.target.value);
            }}
            className="rounded border border-signal/20 bg-void/50 px-3 py-2 text-text font-mono text-xs focus:border-signal focus:outline-none"
          >
            <option value="" className="bg-void">ALL ROUNDS</option>
            <option value="1" className="bg-void">ROUND 1</option>
            <option value="2" className="bg-void">ROUND 2</option>
            <option value="3" className="bg-void">ROUND 3</option>
          </select>
          <select
            value={filterVerdict}
            onChange={(e) => {
              setLoading(true);
              setFilterVerdict(e.target.value);
            }}
            className="rounded border border-signal/20 bg-void/50 px-3 py-2 text-text font-mono text-xs focus:border-signal focus:outline-none"
          >
            <option value="" className="bg-void">ALL VERDICTS</option>
            <option value="true" className="bg-void">PASSED</option>
            <option value="false" className="bg-void">FAILED</option>
          </select>
        </div>
        <span className="rounded bg-void/60 border border-dormant/15 px-3 py-2 text-dormant text-xs font-mono tracking-widest whitespace-nowrap w-full sm:w-auto text-center sm:text-left font-semibold">
          SUBMISSIONS: {submissions.length} TOTAL
        </span>
      </div>

      {submissions.length === 0 ? (
        <p className="text-dormant text-sm font-mono uppercase tracking-wider">[No submissions recorded]</p>
      ) : (
        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {submissions.map((s) => {
            const isRapidCompletion = s.passed && s.time_taken_seconds && s.time_taken_seconds < 45;

            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-void/30 relative overflow-hidden transition-all duration-300 hover:border-signal/30 ${
                  s.flagged || isRapidCompletion ? "border-danger/40 hover:border-danger/60" : "border-dormant/15"
                }`}
              >
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-void/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-text font-display text-lg uppercase tracking-wide truncate font-bold">{s.unit_name}</p>
                      {isRapidCompletion && (
                        <span className="rounded bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[9px] font-mono px-2 py-0.5 uppercase tracking-wider font-bold">
                          ⚠️ Rapid Completion ({s.time_taken_seconds}s)
                        </span>
                      )}
                    </div>
                    <div className="text-dormant font-mono text-xs uppercase tracking-wider font-semibold flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                      <span>Round {s.round_number} · {s.language} · attempt #{s.attempt_number}</span>
                      {s.time_taken_seconds ? (
                        <span className="text-text">⏱️ {s.time_taken_seconds}s elapsed</span>
                      ) : null}
                      {s.paste_count !== undefined && s.paste_count > 0 && (
                        <span className="text-amber-400">📋 {s.paste_count} pastes</span>
                      )}
                      {s.tab_switches !== undefined && s.tab_switches > 0 && (
                        <span className="text-danger">🚨 {s.tab_switches} strikes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded px-2.5 py-0.5 text-[9px] font-mono tracking-wider uppercase border font-bold ${
                        s.passed
                          ? "bg-signal/15 border-signal/40 text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                          : "bg-danger/15 border-danger/40 text-danger"
                      }`}
                    >
                      {s.passed ? "PASS" : "FAIL"}
                    </span>
                    <span className="text-dormant font-mono text-xs font-semibold">
                      {new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>

                {expanded === s.id && (
                  <div className="border-t border-dormant/15 px-4 py-4 bg-void/60 select-text">
                    {/* Telemetry diagnostics header */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 bg-void/80 p-3 rounded-lg border border-dormant/10 text-xs font-mono">
                      <div>
                        <p className="text-dormant text-[9px] uppercase font-semibold">Time Elapsed</p>
                        <p className="text-text font-bold">{s.time_taken_seconds ?? "?"}s</p>
                      </div>
                      <div>
                        <p className="text-dormant text-[9px] uppercase font-semibold">Paste Events</p>
                        <p className={s.paste_count ? "text-amber-400 font-bold" : "text-text"}>{s.paste_count ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-dormant text-[9px] uppercase font-semibold">Proctor Strikes</p>
                        <p className={s.tab_switches ? "text-danger font-bold" : "text-text"}>{s.tab_switches ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-dormant text-[9px] uppercase font-semibold">Keystrokes</p>
                        <p className="text-text font-bold">{s.keystroke_count ?? "?"}</p>
                      </div>
                    </div>

                    <p className="font-mono text-[9px] uppercase tracking-widest text-dormant mb-2 font-semibold">Submitted Code ({s.language})</p>
                    <pre className="text-text font-mono text-xs bg-void/60 border border-dormant/10 rounded-lg p-4 overflow-x-auto max-h-64 whitespace-pre-wrap select-text">
                      {s.code}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
