"use client";

import { useState, useEffect } from "react";

type AuditEntry = {
  id: string;
  actor_name: string;
  actor_email: string;
  action_type: string;
  action_detail: Record<string, unknown>;
  created_at: string;
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit?limit=${limit}&offset=${offset}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [offset]);

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading audit logs...]</p>;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-signal font-semibold">ADMIN ACTION LOGS</p>
        <p className="text-dormant text-xs font-mono uppercase tracking-widest font-semibold">
          RECORDS: {total} TOTAL
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="text-dormant text-sm font-mono uppercase tracking-wider">[No logs found]</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-dormant/15 bg-void/40 px-4 py-3 hover:border-signal/20 transition-all duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-text font-body text-sm leading-relaxed">
                    <span className="text-signal font-bold uppercase font-display tracking-wider text-base">{log.actor_name}</span>{" "}
                    <span className="text-dormant font-mono text-xs">[{log.action_type}]</span>
                  </p>
                  {log.action_detail && Object.keys(log.action_detail).length > 0 && (
                    <pre className="text-dormant font-mono text-[10px] bg-void/50 p-2 rounded border border-dormant/5 mt-1.5 overflow-x-auto select-text max-h-32">
                      {JSON.stringify(log.action_detail, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-dormant font-mono text-xs whitespace-nowrap shrink-0 border-l border-dormant/10 pl-3">
                  {new Date(log.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="flex gap-2 mt-4 justify-center items-center font-mono">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="btn-cyber-outline px-3 py-1.5 rounded text-xs uppercase"
          >
            ← PREV
          </button>
          <span className="text-dormant text-xs uppercase tracking-widest px-4 font-semibold">
            {offset + 1}–{Math.min(offset + limit, total)} OF {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="btn-cyber-outline px-3 py-1.5 rounded text-xs uppercase"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
