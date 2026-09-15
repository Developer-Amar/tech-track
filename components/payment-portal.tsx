"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  QrCode,
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
  ChevronUp
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
  }>;
  memberCount: number;
  requiredAmount: number;
  isLeader: boolean;
  settings: {
    payment_upi_id: string;
    payment_payee_name: string;
    require_payment_for_event: boolean;
    payment_deadline: string;
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
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [utrInput, setUtrInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showUtrGuide, setShowUtrGuide] = useState(false);

  const fetchPaymentInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/payment/info");
      if (!res.ok) return;
      const json = await res.json();
      if (json.hasTeam) {
        setData(json);
        if (json.unit.payment_utr) {
          setUtrInput(json.unit.payment_utr);
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

  // Generate UPI QR code
  useEffect(() => {
    if (!data?.hasTeam) return;

    const upiId = data.settings.payment_upi_id || "amardeveloper3@okhdfcbank";
    const payee = data.settings.payment_payee_name || "Tech Trek IEI x IETE";
    const amount = data.requiredAmount || data.unit.payment_amount || 100;
    const teamClean = data.unit.name.replace(/[^a-zA-Z0-9]/g, "_");
    const note = `TechTrek_${teamClean}`;

    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payee
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    QRCode.toDataURL(upiUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF"
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Generation error:", err));
  }, [data]);

  const copyToClipboard = (text: string, type: "upi" | "amount") => {
    navigator.clipboard.writeText(text);
    if (type === "upi") {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = utrInput.trim().toUpperCase();
    if (!clean) {
      setErrorMsg("Please enter the 12-digit UPI UTR transaction reference.");
      return;
    }

    if (!/^[A-Z0-9]{12}$/.test(clean)) {
      setErrorMsg("Invalid UTR format. Must be exactly 12 alphanumeric characters (e.g., 426189210452).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: clean })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit transaction reference.");
      }

      setSuccessMsg("UTR reference registered! Awaiting coordinator verification.");
      fetchPaymentInfo();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-[#0a0d14]/80 rounded-2xl border border-cyan-500/20 backdrop-blur-xl">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mr-3" />
        <span className="font-mono text-cyan-400 tracking-wider text-sm">
          SYNCHRONIZING PAYMENT CLEARANCE PROTOCOL...
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

  const { unit, members, memberCount, requiredAmount, isLeader, settings } = data;
  const status = unit.payment_status;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.payment_upi_id)}&pn=${encodeURIComponent(
    settings.payment_payee_name
  )}&am=${requiredAmount}&cu=INR&tn=${encodeURIComponent(`TechTrek_${unit.name.replace(/[^a-zA-Z0-9]/g, "_")}`)}`;

  return (
    <div className="w-full bg-[#080B11]/90 rounded-3xl border border-cyan-500/20 shadow-[0_0_50px_rgba(0,229,255,0.06)] backdrop-blur-2xl overflow-hidden p-6 md:p-8">
      {/* ── Header Badge & Title ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              GATEWAY PROTOCOL v2.0
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-white/5 text-slate-400 border border-white/10">
              ₹50 / PERSON
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-cyan-400" />
            Operational Clearance & Payment
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Complete team registration clearance before{" "}
            <span className="text-amber-400 font-mono font-medium">30 Sept 2026, 11:00 AM IST</span> to unlock the live event arena.
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
              <div className="text-sm font-bold text-rose-300">Previous Submission Rejected</div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                {unit.payment_notes || "The submitted UTR could not be verified in the coordinator records. Please double check the transaction reference in your UPI app and submit again."}
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
                <h3 className="text-lg font-bold text-emerald-300">Access Pass Authenticated & Cleared</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Team <span className="text-white font-mono font-bold">{unit.name}</span> has fulfilled all registration protocols. Your unit is cryptographically licensed for live competition entry on September 30th.
                </p>
                {unit.payment_utr && (
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-black/40 border border-emerald-500/30 font-mono text-xs text-emerald-400">
                    <span>UTR: {unit.payment_utr}</span>
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

      {/* ── Main Interactive Grid (Shown for unpaid, pending, or rejected) ── */}
      {status !== "verified" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: QR Code & Dynamic UPI Details (5 Cols) ─────── */}
          <div className="lg:col-span-5 flex flex-col items-center bg-[#0d121c] p-6 rounded-2xl border border-white/5 relative">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Official UPI QR Clearance</span>
            </div>

            {/* Glowing QR Container */}
            <div className="relative p-4 rounded-2xl bg-white shadow-[0_0_35px_rgba(0,229,255,0.2)]">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Tech Trek Entry UPI QR"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 bg-slate-100 flex items-center justify-center rounded-lg">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              )}
            </div>

            {/* Amount Badge */}
            <div className="mt-5 w-full bg-black/40 rounded-xl p-3 border border-cyan-500/20 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">Team Fee Total</div>
                <div className="text-xl font-mono font-black text-cyan-300">₹{requiredAmount}</div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(String(requiredAmount), "amount")}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors border border-white/10"
              >
                {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAmount ? "Copied" : "Copy ₹"}</span>
              </button>
            </div>

            {/* UPI ID Pill */}
            <div className="mt-3 w-full bg-black/40 rounded-xl p-3 border border-white/10 flex items-center justify-between">
              <div className="overflow-hidden mr-2">
                <div className="text-[10px] font-mono text-slate-400 uppercase">UPI Identifier</div>
                <div className="text-xs font-mono text-white truncate">{settings.payment_upi_id}</div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(settings.payment_upi_id, "upi")}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-mono text-cyan-400 flex items-center gap-1.5 transition-colors border border-cyan-500/30 shrink-0"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUpi ? "Copied" : "Copy UPI"}</span>
              </button>
            </div>

            {/* Mobile Direct Pay Deep-Link */}
            <div className="mt-4 w-full">
              <a
                href={upiUrl}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all"
              >
                <span>Pay via UPI App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-[10px] text-center text-slate-500 mt-1.5">
                (Tap to open Google Pay, PhonePe, Paytm, or BHIM)
              </p>
            </div>
          </div>

          {/* ── Right Column: Fee Breakdown & UTR Submission Form (7 Cols) ─ */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            {/* Team Breakdown Summary */}
            <div className="bg-[#0d121c] p-6 rounded-2xl border border-white/5 mb-6">
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Unit Composition & Calculation</span>
              </h3>

              <div className="space-y-2.5 mb-4">
                <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Team Name</span>
                  <span className="font-mono font-bold text-white">{unit.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Registered Roster</span>
                  <span className="font-mono text-cyan-400">{memberCount} Members ({members.map(m => m.name.split(" ")[0]).join(", ")})</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/5">
                  <span className="text-slate-400">Rate Schedule</span>
                  <span className="font-mono text-slate-300">₹50 per individual</span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 bg-cyan-950/20 px-3 rounded-xl border border-cyan-500/20 font-mono">
                  <span className="text-cyan-300 font-bold">Total Entry Fee:</span>
                  <span className="text-xl font-black text-cyan-400">₹{requiredAmount}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2.5 text-xs text-slate-400">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-200">Rule Protocol:</strong> Only the designated Team Leader submits payment on behalf of the whole unit. Individual payments by each member are not required.
                </span>
              </div>
            </div>

            {/* Leader Submission Form OR Member Waiting Terminal */}
            {isLeader ? (
              <div className="bg-[#0d121c] p-6 rounded-2xl border border-cyan-500/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Leader Submission Terminal</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    LEADER AUTHENTICATED
                  </span>
                </div>

                <form onSubmit={handleSubmitUtr} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 uppercase mb-2">
                      Enter 12-Digit UPI Transaction Reference (UTR)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={12}
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        placeholder="e.g. 426189210452"
                        className="w-full bg-black/60 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm font-mono text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 uppercase transition-all"
                      />
                      <div className="absolute right-3 top-3 text-[11px] font-mono text-slate-500">
                        {utrInput.length} / 12
                      </div>
                    </div>
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

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <button
                      type="submit"
                      disabled={submitting || utrInput.length !== 12}
                      className="flex-1 py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-bold text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Transmitting UTR...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{status === "pending" ? "Update UTR Reference" : "Submit UTR for Clearance"}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUtrGuide(!showUtrGuide)}
                      className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400 flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                    >
                      <span>Where is UTR?</span>
                      {showUtrGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </form>

                {/* Collapsible UTR Helper Guide */}
                <AnimatePresence>
                  {showUtrGuide && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-4 rounded-xl bg-black/50 border border-white/10 text-xs space-y-2 text-slate-300"
                    >
                      <div className="font-bold text-cyan-400 text-xs">Finding your 12-digit UTR in payment apps:</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                        <li>
                          <strong className="text-white">Google Pay:</strong> Open payment receipt → look for{" "}
                          <span className="text-cyan-300 font-mono">UPI Transaction ID</span> (12 digits starting with 4xxx...).
                        </li>
                        <li>
                          <strong className="text-white">PhonePe:</strong> View transaction history → locate{" "}
                          <span className="text-cyan-300 font-mono">UTR</span> under Transfer Details.
                        </li>
                        <li>
                          <strong className="text-white">Paytm:</strong> Open order details → find{" "}
                          <span className="text-cyan-300 font-mono">UPI Ref No.</span> (12 digits).
                        </li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Non-Leader Member View */
              <div className="bg-[#0d121c] p-6 rounded-2xl border border-white/10 text-center">
                <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-1">
                  Team Leader Designated Clearance
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Only your team leader{" "}
                  <span className="text-cyan-400 font-bold">
                    {members.find((m) => m.isLeader)?.name || "Leader"}
                  </span>{" "}
                  is authorized to submit the 12-digit UTR on this portal.
                </p>

                {status === "pending" && (
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-center gap-2 font-mono">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Leader has submitted UTR. Verification in progress...</span>
                  </div>
                )}

                {status === "unpaid" && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-center gap-2 font-mono">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Please remind your team leader to complete the ₹{requiredAmount} entry clearance.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
