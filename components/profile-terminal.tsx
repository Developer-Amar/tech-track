"use client";

import { useState, useCallback } from "react";
import SentinelCanvas, { type SentinelState } from "./sentinel";
import CompleteProfileForm from "./complete-profile-form";

/**
 * ProfileTerminal — 2-column layout wrapper.
 * Left: 3D Sentinel that reacts to form state.
 * Right: Glassmorphic profile completion form.
 * Manages shared SentinelState between both panels.
 */
export default function ProfileTerminal({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [sentinelState, setSentinelState] = useState<SentinelState>({
    mode: "idle",
    focusedField: null,
    filledCount: 0,
    keystrokeId: 0,
  });

  const updateSentinel = useCallback((update: Partial<SentinelState>) => {
    setSentinelState((prev) => ({ ...prev, ...update }));
  }, []);

  // Dynamic status label text
  const statusText = (() => {
    switch (sentinelState.mode) {
      case "submitting":
        return "PROCESSING CREDENTIALS...";
      case "success":
        return "CLEARANCE GRANTED";
      case "error":
        return "VERIFICATION FAILED";
      default:
        return `SENTINEL ACTIVE · ${sentinelState.filledCount}/4 VERIFIED`;
    }
  })();

  // Dynamic status dot color
  const statusColor =
    sentinelState.mode === "error"
      ? "#EF4444"
      : sentinelState.mode === "success"
      ? "#22C55E"
      : "#7DF9FF";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 relative py-12 z-10 selection:bg-[#7DF9FF] selection:text-black">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">
        {/* ── Left Column: Sentinel Canvas (desktop) ── */}
        <div className="hidden md:flex flex-col items-center h-[520px] relative">
          <SentinelCanvas state={sentinelState} />

          {/* Status readout below sentinel */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{
                backgroundColor: statusColor,
                boxShadow: `0 0 8px ${statusColor}`,
              }}
            />
            <span className="font-mono text-[9px] text-[#94A3B8] uppercase tracking-[0.2em]">
              {statusText}
            </span>
          </div>
        </div>

        {/* ── Mobile: Compact Sentinel ── */}
        <div className="md:hidden h-[200px] relative mb-4">
          <SentinelCanvas state={sentinelState} />
        </div>

        {/* ── Right Column: Form Panel ── */}
        <div className="glass-panel hud-corner-card rounded-2xl p-8 relative overflow-hidden">
          {/* Ambient glow accent */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#7DF9FF]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="mb-6 text-left select-none">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7DF9FF] mb-1.5 font-semibold block">
              SECURITY CLEARANCE
            </span>
            <h1 className="font-display text-3xl font-extrabold text-white uppercase tracking-tight">
              COMPLETE PROFILE
            </h1>
            <p className="text-[#94A3B8] font-body text-sm mt-1">
              The sentinel is scanning. Provide your credentials to proceed.
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-[#7DF9FF]/20 to-transparent w-full my-4" />
          </div>

          <CompleteProfileForm
            name={name}
            email={email}
            onSentinelUpdate={updateSentinel}
          />
        </div>
      </div>
    </main>
  );
}
