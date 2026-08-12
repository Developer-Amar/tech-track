"use client";

import { useState, useCallback } from "react";
import HolographicPass from "./holographic-pass";
import CompleteProfileForm from "./complete-profile-form";

/**
 * ProfileTerminal — 2-column layout wrapper.
 * Left: Holographic Event Pass that fills in live.
 * Right: Glassmorphic profile completion form.
 * Manages shared pass state between both panels.
 */

type PassState = {
  mobileNumber: string;
  rollNo: string;
  branch: string;
  semester: string;
  filledCount: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
};

export default function ProfileTerminal({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string;
}) {
  const [passState, setPassState] = useState<PassState>({
    mobileNumber: "",
    rollNo: "",
    branch: "",
    semester: "",
    filledCount: 0,
    isSubmitting: false,
    isSuccess: false,
    isError: false,
  });

  const updatePass = useCallback((update: PassState) => {
    setPassState(update);
  }, []);

  // Progress text for mobile header
  const progressText = passState.isSuccess
    ? "PASS CREATED ✓"
    : passState.isSubmitting
    ? "PROCESSING..."
    : `${passState.filledCount}/4 COMPLETE`;

  const progressColor = passState.isSuccess
    ? "#22C55E"
    : passState.filledCount === 4
    ? "#22C55E"
    : passState.filledCount > 0
    ? "#F59E0B"
    : "#94A3B8";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 relative py-12 z-10 selection:bg-[#7DF9FF] selection:text-black">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">
        {/* ── Left Column: Holographic Pass (desktop) ── */}
        <div className="hidden md:flex flex-col items-center justify-center h-[560px] relative">
          <HolographicPass
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            mobileNumber={passState.mobileNumber}
            rollNo={passState.rollNo}
            branch={passState.branch}
            semester={passState.semester}
            filledCount={passState.filledCount}
            isSubmitting={passState.isSubmitting}
            isSuccess={passState.isSuccess}
            isError={passState.isError}
          />
        </div>

        {/* ── Mobile: Compact Pass ── */}
        <div className="md:hidden h-[420px] relative mb-4 flex items-center justify-center">
          <HolographicPass
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            mobileNumber={passState.mobileNumber}
            rollNo={passState.rollNo}
            branch={passState.branch}
            semester={passState.semester}
            filledCount={passState.filledCount}
            isSubmitting={passState.isSubmitting}
            isSuccess={passState.isSuccess}
            isError={passState.isError}
          />
        </div>

        {/* ── Right Column: Form Panel ── */}
        <div className="glass-panel hud-corner-card rounded-2xl p-8 relative overflow-hidden">
          {/* Ambient glow accent */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#7DF9FF]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="mb-6 text-left select-none">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7DF9FF] mb-1.5 font-semibold block">
              EVENT REGISTRATION
            </span>
            <h1 className="font-display text-3xl font-extrabold text-white uppercase tracking-tight">
              BUILD YOUR PASS
            </h1>
            <p className="text-[#94A3B8] font-body text-sm mt-1">
              Fill in your details to create your Tech Trek event pass.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-1.5 rounded-full bg-void/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(passState.filledCount / 4) * 100}%`,
                    background:
                      passState.filledCount === 4
                        ? "linear-gradient(90deg, #22C55E, #7DF9FF)"
                        : "linear-gradient(90deg, #7DF9FF, #A78BFA)",
                  }}
                />
              </div>
              <span
                className="font-mono text-[9px] uppercase tracking-widest font-semibold"
                style={{ color: progressColor }}
              >
                {progressText}
              </span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-[#7DF9FF]/20 to-transparent w-full my-4" />
          </div>

          <CompleteProfileForm
            name={name}
            email={email}
            onPassUpdate={updatePass}
          />
        </div>
      </div>
    </main>
  );
}
