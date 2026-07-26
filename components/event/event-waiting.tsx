import BentoCard from "@/components/bento-card";
import { Clock } from "lucide-react";

export default function EventWaiting() {
  return (
    <BentoCard glowColor="default" className="p-10 md:p-12 text-center relative overflow-hidden group border-white/10">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none transition-all duration-500 group-hover:bg-white/10 group-hover:scale-110" />

      <div className="flex justify-center mb-8">
        <span className="flex h-6 w-6 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7DF9FF] opacity-50" />
          <span className="relative inline-flex rounded-full h-6 w-6 bg-[#7DF9FF] shadow-[0_0_15px_rgba(125,249,255,0.5)] items-center justify-center">
            <Clock className="w-3 h-3 text-black" />
          </span>
        </span>
      </div>

      <p className="font-mono text-[10px] uppercase text-[#7DF9FF] tracking-[0.2em] mb-2 font-semibold">EVENT LOBBY STANDBY</p>
      <h3 className="font-display text-4xl md:text-5xl font-extrabold text-white uppercase mb-4 tracking-wider">
        WAITING TO START
      </h3>
      <p className="text-muted text-sm md:text-base font-body max-w-lg mx-auto leading-relaxed">
        The organizers haven&apos;t started the event clock yet. Sit tight, prepare your code editors, and get ready. The hunt starts soon!
      </p>
    </BentoCard>
  );
}
