"use client";

import { useState, useEffect } from "react";
import { Trash2, Ban, AlertTriangle, Skull } from "lucide-react";

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

type ConfirmAction = {
  type: "delete" | "block" | "purge";
  userId?: string;
  userName?: string;
  userEmail?: string;
};

export default function UsersTable({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [purgeText, setPurgeText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  function fetchUsers() {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }

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

  async function executeAction() {
    if (!confirm) return;
    setActionLoading(true);

    try {
      const body: Record<string, string> = { action: confirm.type };
      if (confirm.userId) body.user_id = confirm.userId;
      if (confirm.type === "purge") body.confirmation = purgeText;

      const res = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Error: ${data.error}`);
      } else {
        // Refresh user list
        fetchUsers();
      }
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(false);
      setConfirm(null);
      setPurgeText("");
    }
  }

  if (loading) return <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-widest">[Loading player list...]</p>;

  return (
    <div className="space-y-4 text-left">
      {/* ── Confirmation Modal Overlay ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-[#0a0a0a] p-6 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-full p-2 ${confirm.type === "purge" ? "bg-red-900/40" : "bg-danger/10"}`}>
                {confirm.type === "purge" ? (
                  <Skull className="w-6 h-6 text-red-500" />
                ) : confirm.type === "block" ? (
                  <Ban className="w-6 h-6 text-red-500" />
                ) : (
                  <Trash2 className="w-6 h-6 text-red-500" />
                )}
              </div>
              <h3 className="font-display text-xl font-bold text-white uppercase tracking-wider">
                {confirm.type === "purge"
                  ? "PURGE ALL USERS"
                  : confirm.type === "block"
                  ? "BLOCK USER"
                  : "REMOVE USER"}
              </h3>
            </div>

            {confirm.type === "purge" ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-red-400 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    DANGER ZONE: This will permanently delete ALL registered users
                    and their teams, submissions, and progress data. Only the
                    primary super admin account will be preserved.
                  </p>
                </div>
                <p className="text-dormant text-xs font-mono">
                  Type <span className="text-red-400 font-bold">PURGE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={purgeText}
                  onChange={(e) => setPurgeText(e.target.value)}
                  placeholder="Type PURGE here..."
                  className="w-full rounded-lg border border-red-500/30 bg-void/60 px-4 py-2.5 text-red-400 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all placeholder:text-dormant/30"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-text/80 text-sm font-body">
                  {confirm.type === "block" ? (
                    <>
                      Are you sure you want to <span className="text-red-400 font-bold">permanently block</span>{" "}
                      <span className="text-white font-semibold">{confirm.userName}</span>?
                      They will be removed and can <span className="text-red-400 font-bold">never register again</span>.
                    </>
                  ) : (
                    <>
                      Are you sure you want to <span className="text-red-400 font-bold">permanently remove</span>{" "}
                      <span className="text-white font-semibold">{confirm.userName}</span>?
                      All their data will be deleted. They can re-register.
                    </>
                  )}
                </p>
                <p className="text-dormant font-mono text-[10px] truncate">{confirm.userEmail}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setConfirm(null);
                  setPurgeText("");
                }}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-dormant/20 bg-void/40 px-4 py-2.5 text-dormant text-xs font-mono uppercase tracking-wider hover:border-dormant/40 hover:text-text transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={
                  actionLoading ||
                  (confirm.type === "purge" && purgeText !== "PURGE")
                }
                className="flex-1 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-red-400 text-xs font-mono uppercase tracking-wider hover:bg-red-500/20 hover:text-red-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {actionLoading
                  ? "Processing..."
                  : confirm.type === "purge"
                  ? "EXECUTE PURGE"
                  : confirm.type === "block"
                  ? "BLOCK FOREVER"
                  : "DELETE USER"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search + Purge header ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter players by name, email, or roll no..."
          className="w-full sm:flex-1 rounded-lg border border-signal/20 bg-void/50 px-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
        <div className="flex gap-2 items-center">
          <span className="rounded bg-void/60 border border-dormant/15 px-3 py-2 text-dormant text-xs font-mono tracking-widest whitespace-nowrap font-semibold">
            PLAYERS: {filtered.length} TOTAL
          </span>
          {isSuperAdmin && (
            <button
              onClick={() => setConfirm({ type: "purge" })}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-red-400 text-[10px] font-mono uppercase tracking-wider hover:bg-red-500/15 hover:border-red-500/50 transition-all whitespace-nowrap"
            >
              <Skull className="w-3.5 h-3.5" />
              PURGE ALL
            </button>
          )}
        </div>
      </div>

      {/* ── User rows ── */}
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
                  <>
                    {/* Role modification */}
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

                    {/* Destructive actions — hidden for super_admin users */}
                    {u.role !== "super_admin" && (
                      <div className="mt-4 pt-4 border-t border-red-500/10">
                        <p className="text-red-400/60 text-[9px] font-mono uppercase tracking-widest mb-2 font-semibold">
                          DANGER ZONE
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() =>
                              setConfirm({
                                type: "delete",
                                userId: u.id,
                                userName: u.name,
                                userEmail: u.email,
                              })
                            }
                            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-red-500/20 bg-red-500/5 text-red-400/80 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove User
                          </button>
                          <button
                            onClick={() =>
                              setConfirm({
                                type: "block",
                                userId: u.id,
                                userName: u.name,
                                userEmail: u.email,
                              })
                            }
                            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-red-700/30 bg-red-900/10 text-red-500/80 hover:bg-red-900/20 hover:border-red-700/50 hover:text-red-500 transition-all"
                          >
                            <Ban className="w-3 h-3" />
                            Block Forever
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
