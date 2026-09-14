"use client";

import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { CheckCircle2, Lock, Terminal } from "lucide-react";

export default function RoundHeader({
  round,
  totalRounds,
  step,
}: {
  round: number;
  totalRounds: number;
  step: "riddle" | "checkpoint" | "code";
}) {
  const steps = [
    { key: "riddle", label: "01. Decode Enigma", icon: Lock },
    { key: "checkpoint", label: "02. Breach Checkpoint", icon: CheckCircle2 },
    { key: "code", label: "03. Execute Sequence", icon: Terminal },
  ];

  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <BentoCard glowColor="purple" className="p-5 xs:p-6 md:p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E5FF]/5 rounded-bl-full pointer-events-none transition-all duration-300 group-hover:bg-[#00E5FF]/10 group-hover:scale-110" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#00E5FF] font-semibold mb-1.5">ACTIVE HUNT LEVEL</p>
          <h2 className="font-display text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold text-white uppercase flex items-baseline gap-2 flex-wrap">
            <KineticText delay={0.1}>{`ROUND ${round}`}</KineticText>
            <span className="text-muted font-mono text-xs sm:text-sm uppercase tracking-normal">/ {totalRounds}</span>
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 sm:gap-3 font-mono text-[9px] sm:text-[10px] text-muted uppercase tracking-[0.2em] bg-black/40 border border-[#00E5FF]/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg select-none backdrop-blur-sm self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-[#00E5FF] animate-ping relative">
             <span className="absolute inset-0 rounded-full bg-[#00E5FF]" />
          </span>
          <span>STAGE: R_{String(round).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex-1 flex items-center gap-2 sm:gap-3">
              <div
                className={`flex-1 flex items-center justify-between rounded-xl border px-3.5 sm:px-4 py-2.5 sm:py-3.5 text-xs font-mono transition-all duration-300 ${
                  i < currentIdx
                    ? "bg-[#00E5FF]/5 border-[#00E5FF]/30 text-[#00E5FF]/70"
                    : i === currentIdx
                    ? "bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF] shadow-[0_0_20px_rgba(125,249,255,0.15)] scale-[1.01] sm:scale-[1.02]"
                    : "bg-black/40 border-white/10 text-muted"
                }`}
              >
                <span className="uppercase tracking-wider font-semibold flex items-center gap-2 truncate">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{s.label}</span>
                </span>
                {i < currentIdx ? (
                  <span className="text-[10px] font-bold shrink-0 ml-2">[DONE]</span>
                ) : i === currentIdx ? (
                  <span className="text-[10px] font-bold animate-pulse shrink-0 ml-2">[ACTIVE]</span>
                ) : (
                  <span className="text-[10px] font-bold shrink-0 ml-2">[STDBY]</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <span className="hidden sm:inline text-muted font-mono text-sm opacity-30">→</span>
              )}
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
