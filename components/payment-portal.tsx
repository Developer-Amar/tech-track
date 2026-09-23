"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
  Users,
  ChevronDown,
  ChevronUp,
  FileText,
  UserCheck,
  Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PaymentInfo {
  hasTeam: boolean;
  unit: {
    id: string;
    name: string;
    leader_id: string;
    locked: boolean;
    payment_status: "unpaid" | "pending" | "verified" | "rejected";
    payment_amount: number;
    payment_utr: string | null;
    payment_submitted_at: string | null;
    payment_verified_at: string | null;
    payment_notes: string | null;
  };
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    isLeader: boolean;
    roll_no?: string | null;
    mobile_number?: string | null;
    branch?: string | null;
  }>;
  memberCount: number;
  requiredAmount: number;
  isLeader: boolean;
  settings: {
    payment_upi_id: string;
    payment_payee_name: string;
    require_payment_for_event: boolean;
    payment_deadline: string;
    chitkara_portal_url?: string;
  };
}

export default function PaymentPortal({
  initialData,
  onClearanceGranted
}: {
  initialData?: PaymentInfo | null;
  onClearanceGranted?: () => void;
}) {
  const [data, setData] = useState<PaymentInfo | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [txnInput, setTxnInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPaymentInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/payment/info");
      if (!res.ok) return;
      const json = await res.json();
      if (json.hasTeam) {
        setData(json);
        if (json.unit.payment_utr) {
          setTxnInput(json.unit.payment_utr);
        }
        if (json.unit.payment_status === "verified" && onClearanceGranted) {
          onClearanceGranted();
        }
      }
    } catch (err) {
      console.error("Error fetching payment info:", err);
    } finally {
      setLoading(false);
    }
  }, [onClearanceGranted]);

  useEffect(() => {
    if (!initialData) {
      fetchPaymentInfo();
    }
  }, [initialData, fetchPaymentInfo]);

  // Check URL params for checkout redirect errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const payErr = params.get("error") || params.get("payment_error");
      if (payErr) {
        if (payErr.includes("leader_only")) {
          setErrorMsg("Only the designated Team Leader is authorized to initiate payment on the Chitkara portal.");
        } else if (payErr.includes("min_members")) {
          setErrorMsg("Your team must have at least 2 accepted members to complete payment.");
        } else if (payErr.includes("chitkara_validation")) {
          setErrorMsg(`University portal error: ${decodeURIComponent(payErr.replace("chitkara_validation_", ""))}`);
        } else if (payErr.includes("server_unavailable")) {
          setErrorMsg("Chitkara University payment server is temporarily busy. Please try again or use the manual fallback link.");
        }
      }
    }
  }, []);

  // Subscribe to real-time changes on unit payment status
  useEffect(() => {
    if (!data?.unit?.id) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`unit_payment_${data.unit.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "units",
          filter: `id=eq.${data.unit.id}`
        },
        (payload) => {
          const updated = payload.new as any;
          setData((prev) => {
            if (!prev) return prev;
            const nextStatus = updated.payment_status || prev.unit.payment_status;
            if (nextStatus === "verified" && onClearanceGranted) {
              onClearanceGranted();
            }
            return {
              ...prev,
              unit: {
                ...prev.unit,
                payment_status: nextStatus,
                payment_utr: updated.payment_utr ?? prev.unit.payment_utr,
                payment_amount: updated.payment_amount ?? prev.unit.payment_amount,
                payment_submitted_at: updated.payment_submitted_at ?? prev.unit.payment_submitted_at,
                payment_verified_at: updated.payment_verified_at ?? prev.unit.payment_verified_at,
                payment_notes: updated.payment_notes ?? prev.unit.payment_notes
              }
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.unit?.id, onClearanceGranted]);

  /**
   * Copy individual field
   */
  const handleCopyField = (val: string, key: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  /**
   * Leader submits Chitkara Transaction ID / ICICI Ref No
   */
  const handleSubmitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = txnInput.trim().toUpperCase();
    if (!clean) {
      setErrorMsg("Please enter the Chitkara Transaction ID or ICICI Reference Number.");
      return;
    }

    if (clean.length < 6) {
      setErrorMsg("Invalid reference format. Please enter a valid Transaction ID from your Chitkara receipt.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: clean })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit transaction reference.");
      }

      setSuccessMsg("Transaction ID submitted! Clearance is pending coordinator verification.");
      fetchPaymentInfo();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Copy formatted team details sheet for Chitkara form
   */
  const handleCopyTeamSheet = () => {
    if (!data) return;
    const lines = [
      `=== TECH TREK TEAM REGISTRATION SHEET ===`,
      `Team Name: ${data.unit.name}`,
      `Total Members: ${data.memberCount}`,
      `Registration Fee: Rs. ${data.requiredAmount}`,
      `-----------------------------------------`,
      ...data.members.map((m, idx) =>
        `Member ${idx + 1} (${m.isLeader ? "LEADER" : "MEMBER"}):\n` +
        `  Name: ${m.name}\n` +
        `  Roll No: ${m.roll_no || "N/A"}\n` +
        `  Email: ${m.email}\n` +
        `  Contact No: ${m.mobile_number || "N/A"}\n` +
        (m.isLeader ? `  Department: ${m.branch || "ECE"}\n` : "")
      )
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedSheet(true);
    setTimeout(() => setCopiedSheet(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-[#0a0d14]/80 rounded-2xl border border-cyan-500/20 backdrop-blur-xl">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mr-3" />
        <span className="font-mono text-cyan-400 tracking-wider text-sm">
          SYNCHRONIZING CHITKARA PAYMENT PROTOCOL...
        </span>
      </div>
    );
  }

  if (!data || !data.hasTeam) {
    return (
      <div className="p-8 bg-[#0a0d14]/80 rounded-2xl border border-amber-500/20 text-center">
        <Users className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Team Registration Required</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          You must be part of an active team to initiate event entry clearance. Join or form a team on the dashboard first.
        </p>
      </div>
    );
  }

  const { unit, members, memberCount, requiredAmount, isLeader } = data;
  const status = unit.payment_status;
  const chitkaraManualUrl = data.settings.chitkara_portal_url || "https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/";

  // Sort members so leader is always #1
  const sortedMembers = [...members].sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0));
  const leaderMember = sortedMembers[0];

  return (
    <div className="w-full bg-[#080B11]/90 rounded-3xl border border-cyan-500/20 shadow-[0_0_50px_rgba(0,229,255,0.06)] backdrop-blur-2xl overflow-hidden p-6 md:p-8">
      {/* ── Header Badge & Title ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
              OFFICIAL CHITKARA UNIVERSITY GATEWAY
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-white/5 text-slate-400 border border-white/10">
              ₹50 / PERSON
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-cyan-400" />
            Official Event Payment Clearance
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            All registration fees must be completed through the official{" "}
            <strong className="text-white">Chitkara University Online Events Portal</strong>.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-3 shrink-0">
          {status === "verified" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/70">Clearance Status</div>
                <div className="text-sm font-black font-mono tracking-wider">CLEARED // LICENSED</div>
              </div>
            </div>
          )}

          {status === "pending" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
              <Clock className="w-5 h-5 text-cyan-400 animate-spin" />
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/70">Clearance Status</div>
                <div className="text-sm font-black font-mono tracking-wider">PENDING VERIFICATION</div>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300/70">Clearance Status</div>
                <div className="text-sm font-black font-mono tracking-wider">ACTION REQUIRED</div>
              </div>
            </div>
          )}

          {status === "unpaid" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300/70">Clearance Status</div>
                <div className="text-sm font-black font-mono tracking-wider">UNPAID // PENDING</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Rejection Banner (If Rejected) ──────────────────────────────── */}
      <AnimatePresence>
        {status === "rejected" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3"
          >
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-rose-300">Previous Submission Not Verified</div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                {unit.payment_notes || "The submitted Transaction ID could not be matched with Chitkara University bank accounts. Please re-check your receipt and submit again."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Verified Banner (If Verified) ──────────────────────────────── */}
      {status === "verified" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-300">Official Clearance Granted // Gate Unlocked</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Team <span className="text-white font-mono font-bold">{unit.name}</span> has fulfilled all university registration requirements. Your team is officially licensed for live competition entry on September 30th.
                </p>
                {unit.payment_utr && (
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-black/40 border border-emerald-500/30 font-mono text-xs text-emerald-400">
                    <span>Chitkara Ref: {unit.payment_utr}</span>
                  </div>
                )}
              </div>
            </div>

            <a
              href="/event"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm tracking-wide uppercase transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center gap-2 shrink-0 group"
            >
              <span>Enter Event Arena</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>
      )}

      {/* ── Main Interactive Flow (When Not Verified) ─────────────────── */}
      {status !== "verified" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: Express 1-Click Pay Hero + Fallback Drawer (7 Cols) ─── */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* 1. Official Express 1-Click Pay Hero Card */}
            <div className="bg-[#0d121c] p-6 rounded-2xl border border-rose-500/20 relative overflow-hidden shadow-[0_0_30px_rgba(225,29,72,0.1)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  STEP 1: EXPRESS 1-CLICK PAY
                </span>
                <span className="text-xs font-mono text-rose-400 font-bold">
                  ₹{requiredAmount} TOTAL DUE
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span>Official Chitkara × ICICI Bank Gateway</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                <strong className="text-cyan-400">Zero form filling required!</strong> Click below to automatically register all <strong className="text-white">{memberCount} members</strong> of team <strong className="text-white">{unit.name}</strong> into the university database and land straight on the official ICICI Bank checkout screen.
              </p>

              {/* Team Breakdown Summary Box */}
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-2 mb-5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Team Name:</span>
                  <span className="text-white font-bold">{unit.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Roster ({memberCount} members):</span>
                  <span className="text-cyan-300 font-bold">
                    {members.map((m) => m.name.split(" ")[0]).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Fee Calculation:</span>
                  <span className="text-slate-300">₹50 × {memberCount} members</span>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                  <span className="text-white">Amount to Pay:</span>
                  <span className="text-rose-400 text-lg font-black font-mono">₹{requiredAmount}/-</span>
                </div>
              </div>

              {/* Direct Instant Action Button (Leader Only) */}
              {isLeader ? (
                <div className="space-y-3">
                  <a
                    href="/api/payment/chitkara/checkout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(225,29,72,0.3)] flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Pay ₹{requiredAmount} via Official Chitkara Gateway (1-Click)</span>
                    <ExternalLink className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </a>

                  <p className="text-[11px] font-mono text-slate-400 text-center">
                    ⚡ Opens in a new tab. Pay via BHIM UPI, QR Code, Google Pay, PhonePe, Cards, or NetBanking.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center text-xs text-slate-400 font-mono">
                  <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  Only your designated Team Leader ({leaderMember?.name || "Leader"}) is authorized to initiate payment.
                </div>
              )}
            </div>

            {/* 2. Collapsible Fallback Drawer: For Emergency Manual Entry */}
            <div className="bg-[#0d121c] p-4 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setShowManualFallback(!showManualFallback)}
                className="w-full flex items-center justify-between text-xs font-mono text-slate-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Having trouble? Manual portal options & clipboard helper</span>
                </span>
                {showManualFallback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showManualFallback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/5 space-y-4"
                  >
                    <p className="text-xs text-slate-400 leading-relaxed">
                      If your browser has issues launching the 1-click gateway, open the blank Chitkara portal manually and use the copy helpers below:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href={chitkaraManualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-mono flex items-center justify-center gap-2 border border-white/10 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Open Blank Chitkara Form</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyTeamSheet}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-mono flex items-center justify-center gap-2 border border-cyan-500/30 transition-all"
                      >
                        {copiedSheet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSheet ? "Copied to Clipboard!" : "📋 Copy Full Details Sheet"}</span>
                      </button>
                    </div>

                    {/* Quick-Fill Member Roster Chips */}
                    <div className="space-y-3 pt-2">
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                        Individual Field Quick-Copy Chips:
                      </div>
                      {sortedMembers.map((m, idx) => {
                        const isFirst = idx === 0;
                        return (
                          <div
                            key={m.id}
                            className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
                                  {idx + 1}
                                </span>
                                {m.name} {m.isLeader && "(Leader)"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                              <div
                                onClick={() => handleCopyField(m.roll_no || "", `roll_${m.id}`)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <span className="text-slate-400 text-[11px]">Roll:</span>
                                <span className="text-white font-bold flex items-center gap-1">
                                  {m.roll_no || "N/A"}
                                  {copiedField === `roll_${m.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-500" />
                                  )}
                                </span>
                              </div>

                              <div
                                onClick={() => handleCopyField(m.mobile_number || "", `phone_${m.id}`)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <span className="text-slate-400 text-[11px]">Phone:</span>
                                <span className="text-white font-bold flex items-center gap-1">
                                  {m.mobile_number || "N/A"}
                                  {copiedField === `phone_${m.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-500" />
                                  )}
                                </span>
                              </div>

                              <div
                                onClick={() => handleCopyField(m.email, `email_${m.id}`)}
                                className="sm:col-span-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <span className="text-slate-400 text-[11px]">Email:</span>
                                <span className="text-white font-bold truncate ml-2 flex items-center gap-1">
                                  <span className="truncate">{m.email}</span>
                                  {copiedField === `email_${m.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-500 shrink-0" />
                                  )}
                                </span>
                              </div>

                              {isFirst && (
                                <div
                                  onClick={() => handleCopyField(m.branch || "ECE", `dept_${m.id}`)}
                                  className="sm:col-span-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <span className="text-slate-400 text-[11px]">Dept:</span>
                                  <span className="text-white font-bold flex items-center gap-1">
                                    {m.branch || "ECE"}
                                    {copiedField === `dept_${m.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500" />
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right Column: Chitkara Transaction ID Submission (5 Cols) ── */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="bg-[#0d121c] p-6 rounded-2xl border border-cyan-500/20 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Submit Payment Proof</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  STEP 2 OF 2
                </span>
              </div>

              {/* Instructions checklist */}
              <div className="mb-5 space-y-2.5 text-xs text-slate-300 font-mono">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <span>Click <strong>1-Click Pay</strong> to launch official ICICI Bank Gateway.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <span>Complete ₹{requiredAmount} payment via UPI QR, GPay, PhonePe, Cards, or NetBanking.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <span>Locate your <strong>Transaction ID</strong> on the ICICI receipt (e.g. 260923...).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                  <span>Paste it below and click Submit to clear your team.</span>
                </div>
              </div>

              {isLeader ? (
                <form onSubmit={handleSubmitReference} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 uppercase mb-2">
                      Chitkara Transaction ID / ICICI Ref No.
                    </label>
                    <input
                      type="text"
                      value={txnInput}
                      onChange={(e) => setTxnInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, ""))}
                      placeholder="e.g. 260923286047202 or EAZY..."
                      className="w-full bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm font-mono text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 uppercase transition-all"
                    />
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                      Found at the top of your ICICI payment screen or bank SMS confirmation.
                    </span>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || txnInput.trim().length < 6}
                    className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Reference...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{status === "pending" ? "Update Transaction ID" : "Submit Transaction Proof"}</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center font-mono text-xs text-slate-400">
                  <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                  Your Team Leader ({leaderMember?.name || "Leader"}) is submitting transaction proof. Once confirmed by coordinators, your arena unlocks automatically!
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#0d121c] border border-white/5 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Zero Refresh Required:</strong> As soon as accounts reconciliation or coordinator verification confirms your payment, this terminal auto-unlocks into the live arena in real time.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
