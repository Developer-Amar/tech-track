"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [unitId, setUnitId] = useState<string | null>(null);
  const [activeDeviceBlocked, setActiveDeviceBlocked] = useState(false);
  const [activeUserName, setActiveUserName] = useState<string | null>(null);

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
  useEffect(() => {
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
        if (data.active_device_blocked) {
          setActiveDeviceBlocked(true);
          setActiveUserName(data.active_user_name ?? "Another team member");
        } else {
          setActiveDeviceBlocked(false);
          setTabSwitches(data.tab_switches ?? 0);
          setLimit(data.tab_switch_limit ?? 3);
          setLockedOut(data.locked_out ?? false);
          if (data.unit_id) setUnitId(data.unit_id);
          if (data.locked_out) onLockout();
        }
        setLoaded(true);
      });
  }, [round, onLockout]);

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
    (eventType: "tab_switch" | "focus_loss" | "paste_detected") => {
      if (lockedOut || activeDeviceBlocked) return;

      fetch("/api/event/proctor/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round,
          action: "report_strike",
          event_type: eventType,
          session_token: sessionTokenRef.current,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          setTabSwitches(data.tab_switches);
          setLimit(data.tab_switch_limit);
          if (data.locked_out) {
            setLockedOut(true);
            onLockout();
          }
        });
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
      }, 300);
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
      clearTimeout(blurTimeout);
    };
  }, [reportStrike]);

  // ── 3. Realtime Team Proctor Sync (Supabase Realtime) ───────────────────
  useEffect(() => {
    if (!unitId) return;

    const channel = supabase
      .channel(`proctoring_${unitId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "proctoring_state", filter: `unit_id=eq.${unitId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated) {
          setTabSwitches(updated.tab_switches ?? 0);
          setLimit(updated.tab_switch_limit ?? 3);
          setLockedOut(updated.locked_out ?? false);
          if (updated.locked_out) {
            onLockout();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId, onLockout, supabase]);

  // ── 4. Clipboard & Context Menu Restrictions ────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-proctor-zone]")) {
        // Report paste event telemetry
        reportStrike("paste_detected");
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
      </div>
    );
  }

  const remaining = Math.max(0, limit - tabSwitches);

  return (
    <div data-proctor-zone>
      {tabSwitches > 0 && (
        <div
          className={`rounded-lg px-4 py-3 mb-4 border flex items-center gap-3 relative overflow-hidden transition-all duration-300 ${
            remaining <= 1
              ? "bg-danger/10 border-danger/45 text-text shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse"
              : "bg-yellow-500/5 border-yellow-500/25 text-text"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              remaining <= 1 ? "bg-danger animate-ping" : "bg-yellow-500"
            }`}
          />
          <div className="flex-1 min-w-0 font-mono text-xs uppercase tracking-wider">
            <span>
              Proctor Warning: Focus loss or tab switches detected ({tabSwitches}/{limit}) —{" "}
              {remaining === 1 ? "FINAL WARNING BEFORE LOCKOUT!" : `${remaining} warnings remaining`}
            </span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
