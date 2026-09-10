"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type UnitUser = { id: string; name: string; email: string; roll_no: string | null; status: string };
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

  // Edit states
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [mergingTeam, setMergingTeam] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  const doAction = async (action: string, payload: any) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/teams/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`Success: ${data.message}`);
        setEditingTeam(null);
        setMergingTeam(null);
        loadData();
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setMsg("Network error.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

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
      const key = u.unit.unit_id; // Use real UUID
      if (!unitMap.has(key)) {
        unitMap.set(key, {
          id: key,
          name: u.unit.unit_name,
          unit_type: u.unit.unit_type,
          locked: false,
          disqualified: false,
          members: [],
        });
      }
      unitMap.get(key)!.members.push({
        id: u.id,
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
                <div className="flex justify-between items-center mb-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-dormant font-semibold">Team Members</p>
                  <div className="flex gap-2">
                    {editingTeam === unit.id ? (
                      <div className="flex gap-1 items-center">
                        <input
                          autoFocus
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="bg-void/50 border border-signal/30 text-text text-xs px-2 py-1 rounded"
                          placeholder="New Name"
                        />
                        <button onClick={() => doAction("rename_team", { unit_id: unit.id, name: newName })} className="text-signal text-[10px] font-mono px-2 py-1 border border-signal/30 rounded hover:bg-signal/10 uppercase">Save</button>
                        <button onClick={() => setEditingTeam(null)} className="text-dormant text-[10px] font-mono px-2 py-1 uppercase">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingTeam(unit.id); setNewName(unit.name); }} className="text-dormant text-[10px] hover:text-signal font-mono uppercase tracking-wider">[Rename]</button>
                    )}
                    <button onClick={() => setMergingTeam(unit.id)} className="text-dormant text-[10px] hover:text-[#00E5FF] font-mono uppercase tracking-wider">[Merge]</button>
                  </div>
                </div>

                <div className="space-y-2">
                  {unit.members.map((m) => (
                    <div key={m.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-void/30 border border-dormant/10 px-4 py-2.5 hover:border-dormant/30 transition-colors">
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
                        <button
                          onClick={() => { if (confirm(`Remove ${m.name}?`)) doAction("remove_member", { unit_id: unit.id, user_id: m.id }); }}
                          className="text-dormant hover:text-danger p-1 opacity-50 hover:opacity-100"
                          title="Remove Member"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
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

      {/* Merge Modal */}
      {mergingTeam && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-void border border-dormant/30 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-white font-display text-xl uppercase mb-2">Merge Team</h3>
            <p className="text-dormant text-sm font-mono mb-4">
              Merge <span className="text-[#00E5FF] font-bold">{units.find(u => u.id === mergingTeam)?.name}</span> into another team.
              Type the exact name or ID of the target team below.
            </p>
            <input
              type="text"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              placeholder="Target Team Name or ID"
              className="w-full bg-void/50 border border-signal/30 text-white rounded p-2 mb-4 font-mono text-sm focus:outline-none focus:border-signal"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setMergingTeam(null)} className="text-dormant font-mono text-sm px-4 py-2 uppercase hover:text-white">Cancel</button>
              <button
                onClick={() => {
                  const target = units.find(u => u.id === mergeTarget || u.name.toLowerCase() === mergeTarget.toLowerCase());
                  if (!target) return alert("Target team not found.");
                  if (confirm(`Merge into ${target.name}? This will delete the source team.`)) {
                    doAction("merge_teams", { source_unit_id: mergingTeam, target_unit_id: target.id });
                  }
                }}
                disabled={actionLoading}
                className="bg-signal text-void font-mono font-bold text-sm px-4 py-2 rounded uppercase hover:bg-white hover:text-void transition-colors"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
