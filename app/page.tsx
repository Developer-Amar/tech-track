import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/server";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import ScrollTimeline from "@/components/scroll-timeline";
import { ArrowRight, Code, MapPin, Terminal } from "lucide-react";

export const revalidate = 0; // Fresh render to check live status

export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessages: Record<string, string> = {
    domain: "Access Denied: Only @chitkara.edu.in Google accounts are allowed.",
    auth_failed: "Sign in failed. Please try again.",
    no_code: "Callback payload missing. Please sign in again.",
  };

  const errorMessage = searchParams.error
    ? errorMessages[searchParams.error] ?? "An unexpected error occurred."
    : null;

  // Fetch settings dynamically to show status
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("event_settings")
    .select("event_live, registration_open, total_rounds")
    .eq("id", 1)
    .single();

  const isLive = settings?.event_live ?? false;
  const registrationOpen = settings?.registration_open ?? true;

  // Fetch some quick stats to display in the telemetry dashboard
  const { count: totalPlayers } = await admin
    .from("users")
    .select("id", { count: "exact", head: true });

  const { count: totalTeams } = await admin
    .from("units")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <main className="min-h-screen flex flex-col justify-between py-12 px-6 relative max-w-7xl mx-auto z-10 selection:bg-[#7DF9FF] selection:text-black">
        {/* Top HUD Header */}
        <header className="w-full flex flex-col sm:flex-row justify-between items-center pb-6 text-[10px] font-mono text-muted uppercase tracking-[0.2em] gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/90 p-2 rounded flex items-center justify-center backdrop-blur-md">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={150} height={40} className="object-contain h-10 w-auto" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse shadow-[0_0_10px_rgba(125,249,255,0.8)]" />
              <span>PORTAL ACTIVE // SECURE ACCESS GRANTED</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-signal">EST. 2026</div>
            <div className="bg-white/90 p-2 rounded flex items-center justify-center backdrop-blur-md">
              <Image src="/assets/IEI-logo.png" alt="IEI Club" width={60} height={60} className="object-contain h-[60px] w-auto" />
            </div>
          </div>
        </header>

        {/* Main Layout: Asymmetric Bento Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-12 items-stretch">
          
          {/* Left Side: Hero */}
          <BentoCard className="lg:col-span-8 p-8 md:p-12 flex flex-col justify-between min-h-[500px]" delay={0.1} glowColor="signal">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#7DF9FF]/10 border border-[#7DF9FF]/30 text-signal font-mono text-xs uppercase tracking-widest font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                {isLive ? "THE HUNT IS ACTIVE" : "PRE-LAUNCH PREPARATIONS"}
              </div>

              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white uppercase leading-[0.9] select-none">
                <KineticText delay={0.2}>TECH TREK</KineticText>
              </h1>

              <p className="font-body text-base md:text-xl text-muted leading-relaxed max-w-2xl font-light">
                Prepare to trek across Chitkara University. Crack complex coding riddles, navigate to hidden checkpoints across campus, and deploy code under pressure to conquer the ultimate technical hunt.
              </p>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 max-w-md backdrop-blur-md">
                  <p className="text-red-400 text-sm font-mono uppercase tracking-wider">
                    Error: {errorMessage}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 items-start select-none">
              <Link href="/login" className="btn-cyber px-8 md:px-10 py-4 md:py-5 rounded-xl text-xs md:text-sm uppercase tracking-[0.15em] font-bold flex items-center gap-3 w-full sm:w-auto justify-center">
                Launch Portal <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#rules" className="btn-cyber-outline px-8 md:px-10 py-4 md:py-5 rounded-xl text-xs md:text-sm uppercase tracking-[0.15em] font-bold w-full sm:w-auto text-center">
                Mission Runbook
              </a>
            </div>
          </BentoCard>

          {/* Right Side: Telemetry Grid */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            {/* Top telemetry panel */}
            <BentoCard className="p-6 md:p-8 flex-1 flex flex-col justify-between" delay={0.2} glowColor="purple">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 font-mono text-[10px] text-muted uppercase tracking-[0.15em]">
                <div>[ TELEMETRY MONITOR ]</div>
                <div className="text-[#4B0082] drop-shadow-[0_0_8px_rgba(75,0,130,0.8)] font-bold">LIVE_SYS_01</div>
              </div>

              <div className="space-y-4 mt-6 font-mono text-sm tracking-wide">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-muted text-xs">REGISTRATION</span>
                  <span className={registrationOpen ? "text-signal font-bold" : "text-red-400 font-bold"}>
                    {registrationOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-muted text-xs">ACTIVE ROUNDS</span>
                  <span className="text-white font-bold">{settings?.total_rounds ?? 3} STAGES</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-muted text-xs">SECURED PLAYERS</span>
                  <span className="text-signal font-bold">{totalPlayers ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted text-xs">ACTIVE COHORTS</span>
                  <span className="text-white font-bold">{totalTeams ?? 0}</span>
                </div>
              </div>
            </BentoCard>

            {/* Log Stream Panel */}
            <BentoCard className="p-6 bg-black/40 h-48 flex flex-col" delay={0.3} glowColor="default">
              <p className="font-mono text-[9px] text-muted uppercase tracking-[0.2em] mb-4">[ LOGSTREAM ]</p>
              <div className="font-mono text-[10px] text-signal/80 space-y-3 overflow-hidden opacity-80 mix-blend-screen flex-1">
                <p className="opacity-70">&gt; Initializing spacetime manifold...</p>
                <p className="opacity-80">&gt; Establishing secure uplink...</p>
                <p className="opacity-90">&gt; Calibrating physics engine...</p>
                <p className="animate-pulse font-semibold">&gt; Waiting for authorized entry...</p>
              </div>
            </BentoCard>
          </div>
        </div>

        {/* Rules Section (Bento Grid 3x1) — Fixed formatting: consistent height, full-width text */}
        <div id="rules" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left my-12 select-none scroll-mt-24">
          <BentoCard className="p-8 group flex flex-col min-h-[280px]" delay={0.4} glowColor="purple">
            <Terminal className="w-10 h-10 text-signal/40 mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none">01</div>
            <h3 className="text-white font-display text-2xl font-bold mb-3 uppercase tracking-wide mt-auto">Solve Riddles</h3>
            <p className="text-muted text-sm font-body leading-relaxed">
              Crack code logic, programming errors, or location hints that point to your target destination on campus.
            </p>
          </BentoCard>

          <BentoCard className="p-8 group flex flex-col min-h-[280px]" delay={0.5} glowColor="signal">
            <MapPin className="w-10 h-10 text-signal/40 mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none">02</div>
            <h3 className="text-white font-display text-2xl font-bold mb-3 uppercase tracking-wide mt-auto">Reach Checkpoint</h3>
            <p className="text-muted text-sm font-body leading-relaxed">
              Navigate to the physical location on campus, find the outpost staff member, and get the verified code.
            </p>
          </BentoCard>

          <BentoCard className="p-8 group flex flex-col min-h-[280px]" delay={0.6} glowColor="danger">
            <Code className="w-10 h-10 text-signal/40 mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none">03</div>
            <h3 className="text-white font-display text-2xl font-bold mb-3 uppercase tracking-wide mt-auto">Deploy Code</h3>
            <p className="text-muted text-sm font-body leading-relaxed">
              Write code to solve technical challenge suites. Be careful — window switches are actively monitored!
            </p>
          </BentoCard>
        </div>
      </main>

      {/* ═══════════════════════════════════════════
          CINEMATIC SCROLL TIMELINE — Z-axis camera flight
          ═══════════════════════════════════════════ */}
      <ScrollTimeline />

      {/* ═══════════════════════════════════════════
          POWERED BY — Credits & Organizers
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.25em] mb-10">
            [ ORGANIZED BY ]
          </p>
          <div className="flex items-center justify-center gap-8 md:gap-12 mb-8">
            <div className="bg-white/90 p-3 rounded-lg flex items-center justify-center backdrop-blur-md">
              <Image src="/assets/IEI-logo.png" alt="IEI Club" width={80} height={80} className="object-contain h-16 w-auto" />
            </div>
            <span className="text-white/20 font-display text-3xl font-thin select-none">×</span>
            <div className="bg-white/90 p-3 rounded-lg flex items-center justify-center backdrop-blur-md">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={180} height={50} className="object-contain h-12 w-auto" />
            </div>
          </div>
          <p className="text-muted text-sm font-body tracking-wide">
            IEI Club · Chitkara University · EST. 2026
          </p>
        </div>
      </section>

      {/* Footer diagnostic block */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-muted border-t border-white/5 pt-6 pb-8 px-6">
        <div className="tracking-[0.1em] text-[10px] uppercase">[ CODE PIPELINE ESTABLISHED ]</div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7DF9FF] shadow-[0_0_10px_#7DF9FF] animate-pulse" />
          <span className="tracking-[0.1em] text-[10px]">SYSTEM SECURE</span>
        </div>
      </footer>
    </>
  );
}
