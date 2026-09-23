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
  FileText
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
    roll_no?: string;
    mobile_number?: string;
    branch?: string;
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
  const [initiatingChitkara, setInitiatingChitkara] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showManualHelper, setShowManualHelper] = useState(false);

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
   * Express 1-Click Pay:
   * Calls /api/payment/chitkara/relay which pre-fills the Chitkara PHP server,
   * extracts the encrypted ICICI EazyPay form parameters, and auto-submits to the bank!
   */
  const handleExpressChitkaraPay = async () => {
    setErrorMsg(null);
    setInitiatingChitkara(true);

    try {
      const res = await fetch("/api/payment/chitkara/relay", {
        method: "POST"
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to initialize official Chitkara payment gateway.");
      }

      // Hand off the pre-registered token directly to Chitkara's official request.php
      // This ensures the browser arrives at paym.chitkara.edu.in first, and Chitkara itself
      // performs the native same-origin submission to ICICI Bank without cross-origin blocking!
      const form = document.createElement("form");
      form.method = "POST";
      form.action = json.chitkaraRequestUrl || "https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/request.php";
      form.target = "_blank"; // Opens Chitkara University official processor in a fresh tab

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "idA";
      input.value = json.registrationToken;
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      setSuccessMsg("Chitkara ICICI Bank Gateway opened in a new tab! Complete payment and paste your Transaction ID below.");
    } catch (err: any) {
      setErrorMsg(err.message || "Could not launch Chitkara payment relay. Please try again or use the manual fallback link.");
    } finally {
      setInitiatingChitkara(false);
    }
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
   * Copy formatted team details sheet for manual fallback
   */
  const handleCopyTeamSheet = () => {
    if (!data) return;
    const lines = [
      `=== TECH TREK TEAM PAYMENT SHEET ===`,
      `Team Name: ${data.unit.name}`,
      `Members Count: ${data.memberCount}`,
      `Registration Amount: Rs. ${data.requiredAmount}`,
      `------------------------------------`,
      ...data.members.map((m, idx) => `Member ${idx + 1}: ${m.name} | Roll: ${m.roll_no || "N/A"} | Phone: ${m.mobile_number || "N/A"} | Email: ${m.email}`)
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
  const chitkaraUrl = "https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/";

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
            All registration fees are collected securely through the official{" "}
            <span className="text-white font-semibold">Chitkara University ICICI EazyPay Portal</span>.
          </p>
        </div>

        {/* ── Status Pill ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {status === "verified" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/70">Clearance Status</div>
                <div className="text-sm font-black font-mono tracking-wider">VERIFIED // CLEARED</div>
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
          {/* ── Left Column: Express 1-Click Pay Hero Card (6 Cols) ─────── */}
          <div className="lg:col-span-6 flex flex-col bg-[#0d121c] p-6 rounded-2xl border border-rose-500/20 relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                EXPRESS 1-CLICK PAY
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">
                ₹{requiredAmount} TOTAL
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Chitkara University Online Gateway
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Our automated relay will pre-register all {memberCount} members of <strong className="text-white">{unit.name}</strong> directly into Chitkara University&apos;s database and take you straight to the official ICICI Bank EazyPay gateway (UPI, QR, Cards, NetBanking).
            </p>

            {/* Team Breakdown Summary */}
            <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-2 mb-6 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Team Name:</span>
                <span className="text-white font-bold">{unit.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Member Roster:</span>
                <span className="text-cyan-400">{memberCount} Members ({members.map(m => m.name.split(" ")[0]).join(", ")})</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Fee Schedule:</span>
                <span className="text-slate-300">₹50 × {memberCount}</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                <span className="text-white">Amount Due:</span>
                <span className="text-rose-400 text-lg font-black">₹{requiredAmount}/-</span>
              </div>
            </div>

            {/* Primary Action Button (Leader Only) */}
            {isLeader ? (
              <button
                type="button"
                onClick={handleExpressChitkaraPay}
                disabled={initiatingChitkara}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-black text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(225,29,72,0.3)] flex items-center justify-center gap-2 group"
              >
                {initiatingChitkara ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Chitkara Gateway...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Pay ₹{requiredAmount} via Official Chitkara Gateway</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center text-xs text-slate-400 font-mono">
                <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                Only your designated Team Leader can trigger the Chitkara University payment checkout.
              </div>
            )}

            {/* Subtle Fallback Link for Edge Cases */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Need to pay manually?</span>
              <button
                type="button"
                onClick={() => setShowManualHelper(!showManualHelper)}
                className="text-slate-400 hover:text-white underline transition-colors flex items-center gap-1"
              >
                <span>Manual Portal Options</span>
                {showManualHelper ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Collapsible Manual Fallback Drawer */}
            <AnimatePresence>
              {showManualHelper && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3.5 rounded-xl bg-black/60 border border-white/10 text-xs space-y-3"
                >
                  <p className="text-slate-400 text-[11px]">
                    If express checkout has issues with your browser, open the official Chitkara portal directly and use the copied details sheet:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={chitkaraUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-mono flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <span>Open Chitkara Form</span>
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyTeamSheet}
                      className="flex-1 py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[11px] font-mono flex items-center justify-center gap-1.5 border border-cyan-500/30"
                    >
                      {copiedSheet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSheet ? "Copied to Clipboard!" : "Copy Team Details Sheet"}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right Column: Chitkara Transaction ID Submission (6 Cols) ── */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div className="bg-[#0d121c] p-6 rounded-2xl border border-cyan-500/20 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Chitkara Payment Verification</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  STEP 2 OF 2
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                After completing your payment on the Chitkara ICICI Bank portal, enter the{" "}
                <strong className="text-white">Chitkara Transaction ID / ICICI Reference Number</strong> from your payment receipt or confirmation SMS.
              </p>

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
                      placeholder="e.g. 240923019842 or EAZY..."
                      className="w-full bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm font-mono text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 uppercase transition-all"
                    />
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                      Found on your Chitkara receipt screen or bank confirmation message.
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
                    className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center justify-center gap-2"
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
                  Your Team Leader ({members.find(m => m.isLeader)?.name || "Leader"}) is submitting transaction proof. Once confirmed by coordinators, your arena unlocks automatically!
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#0d121c] border border-white/5 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Zero Refresh Required:</strong> As soon as the Chitkara accounts reconciliation confirms your payment, this terminal will auto-unlock into the live arena in real time.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
