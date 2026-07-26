"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type UnitUser = { name: string; email: string; roll_no: string | null; status: string };
type UnitDetail = {
  id: string;
  name: string;
  unit_type: string;
  locked: boolean;
  disqualified: boolean;
  members: UnitUser[];
};

export default function UnitsTable({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    const users = data.users ?? [];

    const codesRes = await fetch("/api/admin/codes");
    const codesData = await codesRes.json();
    const codes = codesData.codes ?? [];

    const unitMap = new Map<string, UnitDetail>();

    for (const u of users) {
      if (!u.unit) continue;
      const key = u.unit.unit_name;
      if (!unitMap.has(key)) {
        unitMap.set(key, {
          id: key,
          name: key,
          unit_type: u.unit.unit_type,
          locked: false,
          disqualified: false,
          members: [],
        });
      }
      unitMap.get(key)!.members.push({
        name: u.name,
        email: u.email,
        roll_no: u.roll_no,
        status: u.unit.status,
      });
    }

    setUnits(Array.from(unitMap.values()));
    setLoading(false);
  }

  const filtered = units.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.members.some(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
  );

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading teams...]</p>;

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter teams by name or member name..."
          className="w-full sm:flex-1 rounded-lg border border-signal/20 bg-void/50 px-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
        <span className="rounded bg-void/60 border border-dormant/15 px-3 py-2 text-dormant text-xs font-mono tracking-widest whitespace-nowrap font-semibold">
          TEAMS: {filtered.length} TOTAL
        </span>
      </div>

      {msg && (
        <div className="rounded border border-signal/30 bg-signal/5 p-3">
          <p className="text-signal text-xs font-mono">{msg}</p>
        </div>
      )}

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((unit) => (
          <div key={unit.id} className="rounded-xl border border-dormant/15 bg-void/30 relative overflow-hidden transition-all duration-300 hover:border-signal/30">
            <button
              onClick={() => setExpanded(expanded === unit.id ? null : unit.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-void/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-text font-display text-lg uppercase tracking-wide truncate font-bold">{unit.name}</p>
                <p className="text-dormant font-mono text-xs uppercase tracking-wider font-semibold">
                  {unit.unit_type} · {unit.members.length} member{unit.members.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-xs font-mono text-dormant font-semibold">
                {expanded === unit.id ? "[Collapse]" : "[Expand]"}
              </span>
            </button>

            {expanded === unit.id && (
              <div className="border-t border-dormant/15 px-4 py-4 bg-void/60 select-text">
                <p className="font-mono text-[9px] uppercase tracking-widest text-dormant mb-3 font-semibold">Team Members</p>
                <div className="space-y-2">
                  {unit.members.map((m) => (
                    <div key={m.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-void/30 border border-dormant/10 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-text text-sm font-body truncate font-semibold">{m.name}</p>
                        <p className="text-dormant font-mono text-xs truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-text font-mono text-xs">{m.roll_no || "—"}</span>
                        <span
                          className={`rounded px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border font-bold ${
                            m.status === "accepted"
                              ? "bg-signal/15 border-signal/40 text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                              : m.status === "pending"
                              ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                              : "bg-danger/15 border-danger/30 text-danger"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isSuperAdmin && (
        <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mt-4 font-semibold">
          🔐 Manage locks, disqualifications, and deletes under the settings panel.
        </p>
      )}
    </div>
  );
}
