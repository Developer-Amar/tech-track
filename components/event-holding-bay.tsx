"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  Radio,
  Sparkles,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import PaymentPortal from "@/components/payment-portal";
import { createClient } from "@/lib/supabase/client";

interface EventHoldingBayProps {
  unit: {
    id: string;
    name: string | null;
    leader_id: string;
    payment_status?: string | null;
    payment_utr?: string | null;
  };
  settings: {
    payment_upi_id?: string;
    payment_payee_name?: string;
    require_payment_for_event?: boolean;
    payment_deadline?: string;
  };
  currentUserId: string;
}

export default function EventHoldingBay({
  unit,
  settings,
  currentUserId
}: EventHoldingBayProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(
    unit.payment_status || "unpaid"
  );
  const [isUnlocked, setIsUnlocked] = useState(unit.payment_status === "verified");
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Countdown to Sept 30, 11:00 AM IST
  useEffect(() => {
    const target = new Date("2026-09-30T11:00:00+05:30").getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to realtime unit changes for immediate unlock
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`holding_bay_${unit.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "units",
          filter: `id=eq.${unit.id}`
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.payment_status) {
            setCurrentStatus(updated.payment_status);
            if (updated.payment_status === "verified") {
              setIsUnlocked(true);
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unit.id]);

  const handleClearanceGranted = () => {
    setIsUnlocked(true);
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  return (
    <div className="w-full space-y-8">
      {/* ── Airlock Header Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#0B0F19] to-[#06080D] p-6 md:p-10 shadow-[0_0_80px_rgba(0,229,255,0.08)]">
        {/* Cyberpunk Scanline Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none opacity-30" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>TACTICAL AIRLOCK // HOLDING BAY</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase">
              {isUnlocked ? (
                <span className="text-emerald-400 flex items-center gap-3">
                  <Unlock className="w-8 h-8 md:w-12 md:h-12" />
                  ACCESS GRANTED
                </span>
              ) : (
                <span className="text-white flex items-center gap-3">
                  <Lock className="w-8 h-8 md:w-12 md:h-12 text-cyan-400" />
                  HOLDING BAY ENGAGED
                </span>
              )}
            </h1>

            <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
              {isUnlocked ? (
                <span className="text-emerald-300 font-mono">
                  Clearance authenticated! Airlock depressurizing — entering live event arena...
                </span>
              ) : (
                <>
                  Team <span className="text-white font-mono font-bold">{unit.name || "Your Team"}</span> is currently in the operational holding bay. All combatants must complete registration clearance before accessing the live riddle grid.
                </>
              )}
            </p>
          </div>

          {/* Countdown Clock */}
          <div className="bg-black/50 border border-cyan-500/30 rounded-2xl p-5 shrink-0 flex flex-col items-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>EVENT LIFTOFF IN</span>
            </div>
            <div className="flex items-center gap-2 text-center font-mono">
              <div className="bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                <div className="text-lg md:text-xl font-black text-white">{countdown.days}</div>
                <div className="text-[9px] text-slate-500 uppercase">Days</div>
              </div>
              <span className="text-cyan-400 font-bold">:</span>
              <div className="bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                <div className="text-lg md:text-xl font-black text-white">
                  {String(countdown.hours).padStart(2, "0")}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">Hrs</div>
              </div>
              <span className="text-cyan-400 font-bold">:</span>
              <div className="bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                <div className="text-lg md:text-xl font-black text-white">
                  {String(countdown.minutes).padStart(2, "0")}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">Min</div>
              </div>
              <span className="text-cyan-400 font-bold">:</span>
              <div className="bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                <div className="text-lg md:text-xl font-black text-cyan-300">
                  {String(countdown.seconds).padStart(2, "0")}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">Sec</div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Status Indicator */}
        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase">Airlock Sensor:</span>
            {currentStatus === "verified" ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> CLEARED FOR ARENA
              </span>
            ) : currentStatus === "pending" ? (
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin" /> CHITKARA CLEARANCE PENDING RECONCILIATION
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> ENTRY CLEARANCE MANDATORY
              </span>
            )}
          </div>

          <div className="text-slate-500">
            Auto-unlock enabled // Zero refresh required upon approval
          </div>
        </div>
      </div>

      {/* ── Interactive Payment Portal Terminal ───────────────────────────── */}
      <PaymentPortal onClearanceGranted={handleClearanceGranted} />
    </div>
  );
}
