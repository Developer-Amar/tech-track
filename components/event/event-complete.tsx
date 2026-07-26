import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { CheckCircle2 } from "lucide-react";

export default function EventComplete({ totalRounds }: { totalRounds: number }) {
  return (
    <BentoCard glowColor="signal" className="p-10 md:p-12 text-center relative overflow-hidden group border-[#7DF9FF]/20 bg-[#7DF9FF]/5">
      <div className="absolute inset-0 bg-[#7DF9FF]/5 rounded-full blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-[#7DF9FF]/10" />

      <div className="flex justify-center mb-8 relative z-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#7DF9FF]/10 border border-[#7DF9FF]/40 shadow-[0_0_30px_rgba(125,249,255,0.3)]">
          <CheckCircle2 className="h-10 w-10 text-[#7DF9FF]" />
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase text-[#7DF9FF] tracking-[0.2em] mb-2 font-semibold relative z-10">TACTICAL STAGE COMPLETE</p>
      <h3 className="font-display text-4xl md:text-5xl font-extrabold text-white uppercase mb-4 relative z-10">
        <KineticText delay={0.1}>HUNT COMPLETE!</KineticText>
      </h3>
      <p className="text-muted text-sm md:text-base font-body max-w-lg mx-auto mb-10 leading-relaxed relative z-10">
        Congratulations! You have completed all {totalRounds} rounds of the hunt. Check the leaderboard to see where your team stands!
      </p>
      <div className="relative z-10">
        <a
          href="/event?tab=leaderboard"
          className="btn-cyber px-8 py-4 rounded-xl text-xs uppercase font-bold tracking-widest shadow-[0_0_20px_rgba(125,249,255,0.2)]"
        >
          View Leaderboard
        </a>
      </div>
    </BentoCard>
  );
}
