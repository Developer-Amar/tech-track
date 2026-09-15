"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Copy,
  Check,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Users,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UnitPaymentRow {
  id: string;
  name: string;
  leader_id: string;
  leader_name: string;
  leader_email: string;
  locked: boolean;
  disqualified: boolean;
  payment_status: "unpaid" | "pending" | "verified" | "rejected";
  payment_amount: number;
  payment_utr: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_verified_by_name: string | null;
  payment_notes: string | null;
  member_count: number;
  created_at: string;
}

interface PaymentStats {
  totalUnits: number;
  verifiedCount: number;
  pendingCount: number;
  unpaidCount: number;
  rejectedCount: number;
  totalRevenue: number;
  expectedRevenue: number;
}

interface PaymentSettings {
  payment_upi_id: string;
  payment_payee_name: string;
  require_payment_for_event: boolean;
  payment_deadline: string;
}

export default function PaymentsPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [units, setUnits] = useState<UnitPaymentRow[]>([]);
  const [settings, setSettings] = useState<PaymentSettings>({
    payment_upi_id: "amardeveloper3@okhdfcbank",
    payment_payee_name: "Tech Trek IEI x IETE",
    require_payment_for_event: true,
    payment_deadline: "2026-09-30T11:00:00+05:30"
  });

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingUnit, setRejectingUnit] = useState<UnitPaymentRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempUpiId, setTempUpiId] = useState("");
  const [tempPayee, setTempPayee] = useState("");
  const [tempRequirePayment, setTempRequirePayment] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/payments");
      if (!res.ok) throw new Error("Failed to fetch payments data");
      const data = await res.json();
      setStats(data.stats);
      setUnits(data.units || []);
      if (data.settings) {
        setSettings(data.settings);
        setTempUpiId(data.settings.payment_upi_id);
        setTempPayee(data.settings.payment_payee_name);
        setTempRequirePayment(data.settings.require_payment_for_event);
      }
    } catch (err) {
      console.error("Fetch payments error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Real-time subscription to units table
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin_payments_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "units" },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPayments]);

  const handleVerify = async (unitId: string) => {
    setActionLoading(unitId);
    try {
      const res = await fetch("/api/admin/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, action: "verify" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to verify unit");
      fetchPayments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingUnit) return;
    setActionLoading(rejectingUnit.id);
    try {
      const res = await fetch("/api/admin/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: rejectingUnit.id,
          action: "reject",
          notes: rejectReason.trim() || "Invalid UTR or transaction could not be located."
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reject unit");
      setRejectingUnit(null);
      setRejectReason("");
      fetchPayments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upiId: tempUpiId,
          payeeName: tempPayee,
          requirePayment: tempRequirePayment
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update settings");
      setSettings(json.settings);
      setEditingSettings(false);
      setSettingsMsg({ type: "success", text: "Payment configuration updated successfully!" });
      setTimeout(() => setSettingsMsg(null), 4000);
    } catch (err: any) {
      setSettingsMsg({ type: "error", text: err.message });
    } finally {
      setSettingsSaving(false);
    }
  };

  const copyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // Filtered units list
  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.leader_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.leader_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.payment_utr && u.payment_utr.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    return u.payment_status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-mono uppercase tracking-wider flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            Payment Operations & Clearance Terminal
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time reconciliation, 1-click clearance authorization, and live UPI gateway management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchPayments}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 border border-white/10 flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Refresh</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setEditingSettings(!editingSettings)}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-mono text-cyan-400 border border-cyan-500/30 flex items-center gap-2 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{editingSettings ? "Hide Settings" : "Configure UPI Gateway"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Settings Alert Notification ──────────────────────────────────── */}
      {settingsMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-mono flex items-center gap-2 ${
            settingsMsg.type === "success"
              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
          }`}
        >
          {settingsMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{settingsMsg.text}</span>
        </div>
      )}

      {/* ── Super Admin Settings Drawer ─────────────────────────────────── */}
      {editingSettings && isSuperAdmin && (
        <div className="p-6 rounded-2xl bg-[#0b0f19] border border-cyan-500/30 shadow-[0_0_30px_rgba(0,229,255,0.06)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              Dynamic UPI Gateway Configuration
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SUPER ADMIN
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                Active Receiver UPI ID
              </label>
              <input
                type="text"
                value={tempUpiId}
                onChange={(e) => setTempUpiId(e.target.value)}
                placeholder="e.g. amardeveloper3@okhdfcbank"
                className="w-full bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                All participant QR codes will instantly bind to this UPI handle.
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                Payee Organization Name
              </label>
              <input
                type="text"
                value={tempPayee}
                onChange={(e) => setTempPayee(e.target.value)}
                placeholder="e.g. Tech Trek IEI x IETE"
                className="w-full bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Displayed on the participant receipt & UPI intent prompt.
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requirePaymentToggle"
                checked={tempRequirePayment}
                onChange={(e) => setTempRequirePayment(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-black text-cyan-500 focus:ring-cyan-400"
              />
              <label htmlFor="requirePaymentToggle" className="text-xs font-mono text-slate-300 select-none">
                Enforce Payment Clearance to enter Live Event Arena (/event)
              </label>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setEditingSettings(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,229,255,0.2)] disabled:opacity-50"
              >
                {settingsSaving ? "Updating..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Financial & Operational KPI Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Collected */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-emerald-500/30 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Collected</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1.5">
            ₹{stats?.totalRevenue ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
            of ₹{stats?.expectedRevenue ?? 0} expected
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-cyan-500/30 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Pending</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400 mt-1.5 flex items-center gap-2">
            <span>{stats?.pendingCount ?? 0}</span>
            {(stats?.pendingCount ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Need review</div>
        </div>

        {/* Verified Units */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-white/5 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Cleared</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1.5">
            {stats?.verifiedCount ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Teams cleared</div>
        </div>

        {/* Unpaid Units */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-white/5 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Unpaid</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1.5">
            {stats?.unpaidCount ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">No UTR submitted</div>
        </div>

        {/* Rejected Units */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-white/5 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Rejected</span>
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1.5">
            {stats?.rejectedCount ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Flagged</div>
        </div>

        {/* Total Teams */}
        <div className="p-4 rounded-2xl bg-[#0d121c] border border-white/5 relative overflow-hidden">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Total Teams</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-300 mt-1.5">
            {stats?.totalUnits ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Registered</div>
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by team, leader name, email, or UTR..."
            className="w-full bg-[#0d121c] border border-white/10 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending Review" },
            { key: "verified", label: "Cleared" },
            { key: "unpaid", label: "Unpaid" },
            { key: "rejected", label: "Rejected" }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors border ${
                statusFilter === f.key
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold"
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Payments Data Grid ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/5 bg-[#0d121c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 bg-black/40 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Leader</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Fee</th>
                <th className="py-3 px-4">UTR Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No teams found matching current query or filter.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => {
                  const isActioning = actionLoading === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Team Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white font-mono">{u.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {u.locked ? "🔒 Locked" : "🔓 Open"}
                        </div>
                      </td>

                      {/* Leader */}
                      <td className="py-3 px-4">
                        <div className="text-white truncate max-w-[160px]">{u.leader_name}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{u.leader_email}</div>
                      </td>

                      {/* Members */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[10px]">
                          {u.member_count} Members
                        </span>
                      </td>

                      {/* Fee */}
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        ₹{u.payment_amount}
                      </td>

                      {/* UTR */}
                      <td className="py-3 px-4">
                        {u.payment_utr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                              {u.payment_utr}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyUtr(u.payment_utr!)}
                              title="Copy UTR to clipboard"
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                              {copiedUtr === u.payment_utr ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">— None —</span>
                        )}
                        {u.payment_submitted_at && (
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            {new Date(u.payment_submitted_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.payment_status === "verified" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" /> CLEARED
                          </span>
                        )}
                        {u.payment_status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse">
                            <Clock className="w-3 h-3" /> PENDING
                          </span>
                        )}
                        {u.payment_status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> REJECTED
                          </span>
                        )}
                        {u.payment_status === "unpaid" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" /> UNPAID
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.payment_status !== "verified" && (
                            <button
                              type="button"
                              onClick={() => handleVerify(u.id)}
                              disabled={isActioning}
                              title="Approve & Clear Team for Arena"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>{isActioning ? "..." : "Clear"}</span>
                            </button>
                          )}

                          {u.payment_status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingUnit(u);
                                setRejectReason("");
                              }}
                              disabled={isActioning}
                              title="Reject UTR"
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Rejection Confirmation Modal ────────────────────────────────── */}
      {rejectingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0d121c] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Reject Payment UTR</h3>
                <p className="text-xs text-slate-400 font-mono">Team: {rejectingUnit.name}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
              <div>
                <span className="text-slate-500">Submitted UTR:</span>{" "}
                <span className="text-white font-bold">{rejectingUnit.payment_utr || "None"}</span>
              </div>
              <div>
                <span className="text-slate-500">Leader:</span> {rejectingUnit.leader_name} ({rejectingUnit.leader_email})
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                Reason for Rejection (Visible to Leader)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not found in bank statement, amount mismatch, etc."
                className="w-full bg-black/60 border border-white/10 focus:border-rose-400 rounded-xl p-3 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setRejectingUnit(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionLoading === rejectingUnit.id}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] disabled:opacity-50"
              >
                {actionLoading === rejectingUnit.id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
