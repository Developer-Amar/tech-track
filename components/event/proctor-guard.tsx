"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Zero-dependency Web Audio API alert sound synthesizer
function playStrikeAlertSound(strikeNumber: number) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (strikeNumber >= 3) {
      // Strike 3 (Lockout siren): descending glide
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.65);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (strikeNumber === 2) {
      // Strike 2 (Urgent warning alarm): 3 rapid harsh pulses
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        const startTime = now + i * 0.16;
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, startTime);
        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.13);
      }
    } else {
      // Strike 1 (Attention chime): Dual harmonic chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(600, now);
      osc2.frequency.setValueAtTime(450, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);
    }
  } catch {
    // Autoplay policy before user interaction — safely ignore
  }
}

export default function ProctorGuard({
  round,
  children,
  onLockout,
}: {
  round: number;
  children: React.ReactNode;
  onLockout: () => void;
}) {
  const [tabSwitches, setTabSwitches] = useState(0);
  const [limit, setLimit] = useState(3);
  const [lockedOut, setLockedOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [activeDeviceBlocked, setActiveDeviceBlocked] = useState(false);
  const [activeUserName, setActiveUserName] = useState<string | null>(null);
  const prevTabSwitchesRef = useRef<number>(0);

  // Generate unique device session token
  const sessionTokenRef = useRef<string>(
    typeof window !== "undefined"
      ? (sessionStorage.getItem("device_session_token") ??
          (() => {
            const tok = `dev_${Math.random().toString(36).substring(2)}_${Date.now()}`;
            sessionStorage.setItem("device_session_token", tok);
            return tok;
          })())
      : ""
  );

  const supabase = createClient();

  // ── Initial setup & Single Device Registration ──────────────────────────
  const registerDevice = useCallback(() => {
    setLoadError(false);
    fetch(`/api/event/proctor/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round,
        action: "register_device",
        session_token: sessionTokenRef.current,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to register proctor session");
        return r.json();
      })
      .then((data) => {
        if (data.active_device_blocked) {
          setActiveDeviceBlocked(true);
          setActiveUserName(data.active_user_name ?? "Another team member");
        } else {
          setActiveDeviceBlocked(false);
          const initialSwitches = data.tab_switches ?? 0;
          setTabSwitches(initialSwitches);
          prevTabSwitchesRef.current = initialSwitches;
          setLimit(data.tab_switch_limit ?? 3);
          setLockedOut(data.locked_out ?? false);
          if (data.unit_id) setUnitId(data.unit_id);
          if (data.locked_out) onLockout();
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Proctor registration error:", err);
        setLoadError(true);
      });
  }, [round, onLockout]);

  useEffect(() => {
    registerDevice();
  }, [registerDevice]);

  // Heartbeat every 20s to keep device session active
  useEffect(() => {
    if (activeDeviceBlocked || lockedOut) return;

    const interval = setInterval(() => {
      fetch("/api/event/proctor/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          action: "heartbeat",
          session_token: sessionTokenRef.current,
        }),
      });
    }, 20000);

    return () => clearInterval(interval);
  }, [round, activeDeviceBlocked, lockedOut]);

  // ── Strike Reporting Helper ─────────────────────────────────────────────
  const reportStrike = useCallback(
    (
      eventType: "tab_switch" | "focus_loss" | "paste_detected" | "devtools_opened",
      extra?: { snippet?: string; char_count?: number }
    ) => {
      if (lockedOut || activeDeviceBlocked) return;

      fetch("/api/event/proctor/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          action: "report_strike",
          event_type: eventType,
          session_token: sessionTokenRef.current,
          ...extra,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.tab_switches === "number") {
            if (data.tab_switches > prevTabSwitchesRef.current) {
              playStrikeAlertSound(data.tab_switches);
              prevTabSwitchesRef.current = data.tab_switches;
            }
            setTabSwitches(data.tab_switches);
          }
          if (typeof data.tab_switch_limit === "number") {
            setLimit(data.tab_switch_limit);
          }
          if (data.locked_out) {
            setLockedOut(true);
            onLockout();
          }
        })
        .catch((err) => console.error("Proctor report error:", err));
    },
    [round, lockedOut, activeDeviceBlocked, onLockout]
  );

  // ── 1. Tab Switch (visibilitychange) ────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportStrike("tab_switch");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [reportStrike]);

  // ── 2. Focus Loss (window.onblur - detects AI sidebars & extensions) ────
  useEffect(() => {
    let blurTimeout: NodeJS.Timeout;

    const handleBlur = () => {
      // Debounce focus check to avoid false positives on simple clicks
      blurTimeout = setTimeout(() => {
        if (!document.hasFocus() && !document.hidden) {
          reportStrike("focus_loss");
        }
      }, 400);
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
      clearTimeout(blurTimeout);
    };
  }, [reportStrike]);

  // ── 3. DevTools Detection ───────────────────────────────────────────────
  useEffect(() => {
    const checkDevTools = () => {
      // Bypass on mobile/touch screens or when active form inputs are focused
      // (virtual keyboards shrink innerHeight by 250-400px without altering outerHeight)
      const isTouchDevice =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
      if (isTouchDevice) return;

      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true" ||
          activeEl.classList.contains("monaco-editor"));
      if (isInputFocused) return;

      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      if (widthThreshold || heightThreshold) {
        reportStrike("devtools_opened");
      }
    };

    const interval = setInterval(checkDevTools, 5000);
    return () => clearInterval(interval);
  }, [reportStrike]);

  // ── 4. Realtime Team Proctor & Device Sync (Supabase Realtime) ─────────
  useEffect(() => {
    if (!unitId) return;

    const channel = supabase
      .channel(`proctoring_${unitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "proctoring_state",
          filter: `unit_id=eq.${unitId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated) {
            const newSwitches = updated.tab_switches ?? 0;
            if (newSwitches > prevTabSwitchesRef.current) {
              playStrikeAlertSound(newSwitches);
              prevTabSwitchesRef.current = newSwitches;
            }
            setTabSwitches(newSwitches);
            setLimit(updated.tab_switch_limit ?? 3);
            setLockedOut(updated.locked_out ?? false);
            if (updated.locked_out) {
              onLockout();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unit_device_sessions",
          filter: `unit_id=eq.${unitId}`,
        },
        (payload) => {
          const session = payload.new as any;
          if (session && session.session_token !== sessionTokenRef.current) {
            setActiveDeviceBlocked(true);
            setActiveUserName(session.user_name ?? "Another team member");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId, onLockout, supabase]);

  // ── 5. Clipboard & Context Menu Restrictions with AI Telemetry ─────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-proctor-zone]")) {
        const text = e.clipboardData?.getData("text") || "";
        // Only strike and report large external paste dumps (over 40 characters)
        if (text.length > 40) {
          reportStrike("paste_detected", {
            snippet: text.slice(0, 250),
            char_count: text.length,
          });
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-proctor-zone]")) {
        e.preventDefault();
      }
    };

    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [reportStrike]);

  // ── 6. Auto-poll while lockedOut to guarantee recovery when admin unlocks ────
  useEffect(() => {
    if (!lockedOut) return;

    const interval = setInterval(() => {
      fetch(`/api/event/proctor/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          action: "register_device",
          session_token: sessionTokenRef.current,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.locked_out) {
            setLockedOut(false);
            setTabSwitches(data.tab_switches ?? 0);
            prevTabSwitchesRef.current = data.tab_switches ?? 0;
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [lockedOut, round]);

  if (loadError && !loaded) {
    return (
      <div className="glass-panel border border-red-500/40 p-6 text-center my-6">
        <div className="text-red-400 font-mono text-sm uppercase mb-3">
          [CONNECTION ERROR]: Unable to initialize secure proctored session.
        </div>
        <button
          onClick={registerDevice}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!loaded) return null;

  // Render Single Device Lock Screen
  if (activeDeviceBlocked) {
    return (
      <div className="glass-panel border border-amber-500/40 p-8 text-center relative overflow-hidden select-none">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/35 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <span className="font-mono text-2xl font-bold text-amber-500">💻</span>
        </div>
        <h3 className="font-display text-2xl font-extrabold text-white uppercase mb-2">
          SINGLE ACTIVE DEVICE LOCK
        </h3>
        <p className="text-amber-400 font-mono text-xs uppercase tracking-widest mb-4 font-semibold">
          [SECURITY RESTRICTION]: Concurrent team logins are prohibited.
        </p>
        <p className="text-dormant text-xs font-mono uppercase tracking-wider leading-relaxed max-w-md mx-auto border-t border-amber-500/10 pt-4">
          Your team member <strong className="text-text">{activeUserName}</strong> is currently active in the coding workspace on another device. Only one device per team is allowed inside the IDE at a time.
        </p>
      </div>
    );
  }

  // Render Team Lockout Screen
  if (lockedOut) {
    return (
      <div className="glass-panel-danger rounded-2xl border border-danger/40 p-8 text-center relative overflow-hidden select-none">
        <div className="absolute top-0 right-0 w-3 h-3 bg-danger animate-ping" />
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-danger/10 border border-danger/35 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <span className="font-mono text-2xl font-bold text-danger">🚨</span>
        </div>
        <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-2">
          TEAM LOCKED OUT
        </h3>
        <p className="text-danger font-mono text-sm uppercase tracking-widest mb-4 font-semibold">
          [GLOBAL TEAM LOCKOUT]: Exceeded strike limit ({limit} strikes).
        </p>
        <p className="text-dormant text-xs font-mono uppercase tracking-wider leading-relaxed max-w-md mx-auto border-t border-danger/10 pt-4">
          Your current progress has been auto-submitted. Your team console is locked on all devices. Please contact the organizers or staff to unlock your screen.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={() => {
              fetch(`/api/event/proctor/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  round,
                  action: "register_device",
                  session_token: sessionTokenRef.current,
                }),
              })
                .then((r) => r.json())
                .then((data) => {
                  if (!data.locked_out) {
                    setLockedOut(false);
                    setTabSwitches(data.tab_switches ?? 0);
                    prevTabSwitchesRef.current = data.tab_switches ?? 0;
                  } else {
                    alert("Console is still locked by the proctor system. Please wait for an administrator to pardon or unlock your team.");
                  }
                })
                .catch(() => alert("Network error checking status. Please try again."));
            }}
            className="btn-cyber px-5 py-2.5 rounded-xl text-xs uppercase font-mono tracking-wider font-semibold"
          >
            CHECK UNLOCK STATUS
          </button>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, limit - tabSwitches);

  // Dynamic visual escalation for IDE coding area
  const escalationClasses =
    tabSwitches === 1
      ? "p-3 sm:p-4 rounded-2xl bg-amber-950/20 border-2 border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.25),inset_0_0_25px_rgba(245,158,11,0.1)] transition-all duration-500"
      : tabSwitches >= 2
      ? "p-3 sm:p-4 rounded-2xl bg-red-950/30 border-2 border-red-500/70 shadow-[0_0_55px_rgba(239,68,68,0.4),inset_0_0_35px_rgba(239,68,68,0.2)] animate-pulse transition-all duration-500"
      : "p-1 rounded-2xl border border-transparent transition-all duration-500";

  return (
    <div data-proctor-zone className={escalationClasses}>
      {tabSwitches > 0 && (
        <div
          className={`rounded-xl px-4 py-3.5 mb-4 border flex items-center justify-between gap-3 relative overflow-hidden transition-all duration-300 ${
            remaining <= 1
              ? "bg-red-950/90 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              : "bg-amber-950/90 border-amber-500/70 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full shrink-0 ${
                remaining <= 1 ? "bg-red-500 animate-ping" : "bg-amber-400 animate-pulse"
              }`}
            />
            <div className="font-mono text-xs uppercase tracking-wider">
              <span className="font-bold block sm:inline">
                {remaining <= 1
                  ? "🚨 CRITICAL WARNING: STRIKE 2 OF 3 DETECTED!"
                  : "⚠️ ATTENTION: STRIKE 1 OF 3 DETECTED (FOCUS LOSS)"}
              </span>
              <span className="opacity-80 block sm:inline sm:ml-2">
                {remaining <= 1
                  ? "NEXT TAB SWITCH WILL LOCK OUT ENTIRE TEAM FROM CONSOLE!"
                  : `1 tab switch recorded. ${remaining} chances remaining.`}
              </span>
            </div>
          </div>
          <div className="shrink-0 font-mono text-xs font-bold px-2.5 py-1 rounded bg-black/50 border border-white/15">
            STRIKES: {tabSwitches}/{limit}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
