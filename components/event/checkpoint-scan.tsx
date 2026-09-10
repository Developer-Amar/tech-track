"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";
import { ShieldCheck, Radio, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

/**
 * Web Audio synthesizer for crisp feedback without external audio assets.
 */
function playChime(type: "success" | "error") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // AudioContext blocked by browser policy
  }
}

export default function CheckpointScan({
  round,
  locationName,
}: {
  round: number;
  locationName: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [verifiedByStaff, setVerifiedByStaff] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Background Auto-Advance Sync ─────────────────────────────────────
  // Polls checkpoint status every 2.5s. As soon as staff scans any team
  // member's pass, the server marks checkpoint_done and this component
  // auto-advances the participant!
  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (verifiedByStaff || cancelled) return;

      try {
        const res = await fetch(`/api/event/checkpoint/status?round=${round}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.verified && !cancelled && !verifiedByStaff) {
          setVerifiedByStaff(true);
          playChime("success");
          setFeedback({
            correct: true,
            message: "Checkpoint verified by outpost staff! Opening coding stage...",
          });

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setTimeout(() => {
            router.refresh();
          }, 900);
        }
      } catch {
        // Network flutter; ignore and retry next tick
      }
    }

    // Initial check
    checkStatus();

    // 2.5 second polling
    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [round, router, verifiedByStaff]);

  // ── Manual Code Submission Fallback ──────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading || verifiedByStaff) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/event/checkpoint/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), round }),
      });

      const data = await res.json();

      if (data.correct) {
        playChime("success");
        setFeedback({ correct: true, message: data.message || "Code verified!" });
        setTimeout(() => router.refresh(), 900);
      } else {
        playChime("error");
        setFeedback({
          correct: false,
          message: data.message || "Wrong verification code.",
        });
        setLoading(false);
      }
    } catch {
      setFeedback({ correct: false, message: "Network error. Please try again." });
      setLoading(false);
    }
  }

  return (
    <BentoCard
      glowColor="signal"
      className="rounded-2xl p-6 md:p-8 text-left relative overflow-hidden group border-[#7DF9FF]/20 shadow-[0_0_30px_rgba(125,249,255,0.06)]"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#7DF9FF]/5 rounded-full blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-[#7DF9FF]/10 group-hover:scale-125" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <p className="font-mono text-[9px] uppercase text-signal tracking-widest font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-signal" />
          STAGE CHIEF: CHECKPOINT VERIFICATION
        </p>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-signal/10 border border-signal/20 text-signal font-mono text-[9px] uppercase tracking-wider animate-pulse">
          <Radio className="w-2.5 h-2.5" />
          AUTO-SYNC ACTIVE
        </div>
      </div>

      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1 tracking-tight">
        FIND THE CHECKPOINT
      </h3>
      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        Head to the outpost below. Present any team member&apos;s event pass QR code to the station staff for instant auto-check-in, or enter the secret station code manually.
      </p>

      {/* Target Location Card */}
      <div className="rounded-xl border border-signal/30 bg-signal/5 p-6 mb-5 text-center relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-signal/10 rounded-full blur-xl pointer-events-none" />
        <p className="font-mono text-[10px] text-signal uppercase tracking-widest mb-1.5 font-semibold">
          TARGET OUTPOST LOCATION
        </p>
        <p className="text-white font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wider drop-shadow-[0_0_12px_rgba(125,249,255,0.35)]">
          {locationName}
        </p>
        <p className="font-mono text-[9px] text-dormant uppercase tracking-widest mt-2">
          ROUND 0{round} PHYSICAL CHECKPOINT
        </p>
      </div>

      {/* Auto-advance notification state */}
      {verifiedByStaff ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center mb-5 animate-pulse">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-300 font-display font-bold text-lg uppercase tracking-wide">
            OUTPOST VERIFIED!
          </p>
          <p className="text-emerald-400/80 font-mono text-xs mt-1 uppercase tracking-wider">
            Staff scanned your pass. Opening coding challenge now...
          </p>
        </div>
      ) : (
        /* Manual Code Fallback Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-text font-semibold">
                Secret Station Code (Manual Fallback)
              </label>
              <span className="text-[10px] font-mono text-dormant">
                Optional if staff scans your pass
              </span>
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TYPE SECRET CODE..."
              className="w-full rounded-lg border border-signal/25 bg-void/50 px-4 py-3.5 text-text font-mono text-lg tracking-widest text-center focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300 uppercase shadow-inner"
              autoComplete="off"
              disabled={loading || verifiedByStaff}
            />
          </div>

          {feedback && (
            <div
              className={`rounded-lg p-3 border text-xs font-mono uppercase tracking-wider flex items-center gap-2 ${
                feedback.correct
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-danger/10 border-danger/30 text-danger"
              }`}
            >
              {feedback.correct ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || verifiedByStaff}
            className="w-full btn-cyber px-4 py-3.5 rounded-lg text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              feedback?.correct ? "Opening coding challenge..." : "Verifying code..."
            ) : (
              <>
                <span>VERIFY CODE MANUALLY</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Helpful Hint */}
      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-dormant uppercase tracking-wider">
        <span>⚡ TIP: Show your pass QR to outpost staff</span>
        <span>NO TYPING REQUIRED</span>
      </div>
    </BentoCard>
  );
}
