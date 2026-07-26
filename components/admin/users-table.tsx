"use client";

import { useState, useEffect } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  mobile_number: string | null;
  roll_no: string | null;
  branch: string | null;
  semester: number | null;
  role: string;
  profile_completed: boolean;
  created_at: string;
  unit: { unit_name: string; unit_type: string; status: string } | null;
};

export default function UsersTable({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.roll_no ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function updateRole(userId: string, newRole: string) {
    setSaving(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, updates: { role: newRole } }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setSaving(null);
  }

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading player list...]</p>;

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter players by name, email, or roll no..."
          className="w-full sm:flex-1 rounded-lg border border-signal/20 bg-void/50 px-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
        <span className="rounded bg-void/60 border border-dormant/15 px-3 py-2 text-dormant text-xs font-mono tracking-widest whitespace-nowrap font-semibold">
          PLAYERS: {filtered.length} TOTAL
        </span>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-xl border border-dormant/15 bg-void/30 relative overflow-hidden transition-all duration-300 hover:border-signal/30">
            <button
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-void/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-text font-display text-lg uppercase tracking-wide truncate font-bold">{u.name}</p>
                <p className="text-dormant font-mono text-xs truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`rounded px-2.5 py-0.5 text-[9px] font-mono tracking-wider uppercase border font-bold ${
                    u.role === "super_admin"
                      ? "bg-danger/10 border-danger/40 text-danger"
                      : u.role === "admin"
                      ? "bg-signal/15 border-signal/40 text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                      : u.role === "checkpoint_staff"
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                      : "bg-void border-dormant/25 text-dormant"
                  }`}
                >
                  {u.role.replace("_", " ")}
                </span>
                {u.unit && (
                  <span className="rounded bg-void/60 border border-dormant/15 px-2.5 py-0.5 text-[9px] font-mono text-dormant uppercase tracking-wider font-semibold">
                    {u.unit.unit_name}
                  </span>
                )}
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    u.profile_completed
                      ? "bg-signal shadow-[0_0_8px_rgba(255,30,86,0.3)] animate-pulse"
                      : "bg-dormant/30"
                  }`}
                />
              </div>
            </button>

            {expanded === u.id && (
              <div className="border-t border-dormant/15 px-4 py-4 bg-void/60 select-text">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Roll No</p>
                    <p className="text-text">{u.roll_no || "—"}</p>
                  </div>
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Mobile</p>
                    <p className="text-text">{u.mobile_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Branch</p>
                    <p className="text-text">{u.branch || "—"}</p>
                  </div>
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Semester</p>
                    <p className="text-text">{u.semester ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Profile Status</p>
                    <p className={u.profile_completed ? "text-signal font-bold" : "text-danger"}>
                      {u.profile_completed ? "COMPLETE" : "INCOMPLETE"}
                    </p>
                  </div>
                  <div>
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Joined Date</p>
                    <p className="text-text">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-dormant text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Assigned Team</p>
                    <p className="text-text">
                      {u.unit ? `${u.unit.unit_name} (${u.unit.unit_type.toUpperCase()})` : "UNREGISTERED"}
                    </p>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="mt-4 pt-4 border-t border-dormant/10">
                    <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mb-2 font-semibold">MODIFY USER ROLE</p>
                    <div className="flex gap-2 flex-wrap">
                      {["participant", "checkpoint_staff", "admin", "super_admin"].map((role) => (
                        <button
                          key={role}
                          onClick={() => updateRole(u.id, role)}
                          disabled={saving === u.id || u.role === role}
                          className={`rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all border ${
                            u.role === role
                              ? "bg-signal/25 border-signal text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                              : "bg-void border-dormant/20 text-dormant hover:border-dormant/40 hover:text-text"
                          } disabled:opacity-50`}
                        >
                          {role.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
