"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Radio, AlertOctagon, X } from "lucide-react";

type BroadcastToast = {
  id: string;
  content: string;
  priority: "normal" | "urgent" | string;
  created_at: string;
  durationMs: number;
  remainingMs: number;
};

// Web Audio API zero-dependency chime synthesizer
function playBroadcastAudio(priority: string) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (priority === "urgent") {
      // 3-tone urgent alert siren (800Hz -> 1000Hz -> 800Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";

      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1050, now + 0.12);
      osc.frequency.setValueAtTime(800, now + 0.24);
      osc.frequency.setValueAtTime(1100, now + 0.36);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      // 2-tone melodic sci-fi ping (580Hz -> 880Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";

      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // AudioContext blocked by autoplay policy before first gesture - safely ignore
  }
}

export default function GlobalAnnouncements() {
  const [toasts, setToasts] = useState<BroadcastToast[]>([]);
  const toastsRef = useRef<BroadcastToast[]>([]);
  toastsRef.current = toasts;

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("global-announcements-broadcast")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
        },
        (payload) => {
          const newRow = payload.new as {
            id?: string;
            content?: string;
            message?: string;
            priority?: string;
            created_at?: string;
          };

          const text = (newRow?.content || newRow?.message || "").trim();
          if (!newRow || !text) return;
          // Ignore IDE feature toggles if stored in announcements
          if (text.startsWith("ide_smart_features:")) return;

          const priority = newRow.priority || "normal";
          const isUrgent = priority === "urgent";
          // 12s for urgent, 6s for normal
          const durationMs = isUrgent ? 12000 : 6000;

          const toastId = newRow.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          // Play sound
          playBroadcastAudio(priority);

          // Add to toasts
          setToasts((prev) => [
            {
              id: toastId,
              content: text,
              priority,
              created_at: newRow.created_at || new Date().toISOString(),
              durationMs,
              remainingMs: durationMs,
            },
            ...prev.slice(0, 3), // Keep maximum 4 visible toasts
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Timer loop to animate progress bars and auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      setToasts((prev) =>
        prev
          .map((t) => ({ ...t, remainingMs: t.remainingMs - 100 }))
          .filter((t) => t.remainingMs > 0)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:w-[420px] z-[9999] pointer-events-none flex flex-col gap-3">
      {toasts.map((toast) => {
        const isUrgent = toast.priority === "urgent";
        const progressPercent = Math.max(0, Math.min(100, (toast.remainingMs / toast.durationMs) * 100));

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-300 shadow-2xl ${
              isUrgent
                ? "bg-red-950/95 border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.45)] text-red-100 animate-pulse"
                : "bg-[#060c18]/95 border-[#7DF9FF]/60 shadow-[0_0_25px_rgba(125,249,255,0.25)] text-slate-100"
            }`}
          >
            {/* Header / Category Badge */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-white/10">
              <div className="flex items-center gap-2">
                {isUrgent ? (
                  <AlertOctagon className="w-4 h-4 text-red-400 animate-spin-slow" />
                ) : (
                  <Radio className="w-4 h-4 text-[#7DF9FF] animate-pulse" />
                )}
                <span
                  className={`font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] ${
                    isUrgent ? "text-red-400" : "text-[#7DF9FF]"
                  }`}
                >
                  {isUrgent ? "CRITICAL BROADCAST" : "SYSTEM DISPATCH"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-white/50">
                  {Math.ceil(toast.remainingMs / 1000)}s
                </span>
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="rounded p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss announcement"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Announcement Message Content */}
            <div className="px-4 py-3">
              <p className="font-body text-sm leading-relaxed text-white/95 break-words font-medium">
                {toast.content}
              </p>
              <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-white/40 uppercase tracking-wider">
                <span>COMMS NETWORK</span>
                <span>{new Date(toast.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {/* Progress Countdown Bar */}
            <div className="h-1 w-full bg-black/40 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ease-linear ${
                  isUrgent ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-[#7DF9FF] shadow-[0_0_8px_rgba(125,249,255,0.8)]"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
