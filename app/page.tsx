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
      <main className="min-h-screen flex flex-col justify-between py-6 sm:py-12 px-3 xs:px-4 sm:px-6 relative max-w-7xl mx-auto z-10 selection:bg-[#00E5FF] selection:text-black">
        {/* Top HUD Header */}
        <header className="w-full flex flex-col sm:flex-row justify-between items-center pb-6 text-[10px] font-mono text-muted uppercase tracking-[0.2em] gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center sm:justify-start">
            <div className="bg-white/95 p-1.5 sm:p-2.5 rounded-lg flex items-center justify-center backdrop-blur-md shadow-sm">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={160} height={45} className="object-contain h-9 sm:h-12 w-auto" priority />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse shadow-[0_0_10px_rgba(125,249,255,0.8)]" />
              <span>PORTAL ACTIVE // SECURE ACCESS GRANTED</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            <div className="hidden sm:block text-signal font-semibold">EST. 2026</div>
            {/* IEI x IETE Collab Badges */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-inner">
              <div className="bg-white/95 p-1.5 rounded-lg flex items-center justify-center">
                <Image src="/assets/IEI-logo.png" alt="IEI Club" width={44} height={44} className="object-contain h-8 sm:h-10 w-auto" />
              </div>
              <span className="text-white/40 font-display text-sm font-bold select-none">×</span>
              <div className="bg-white/95 p-1.5 rounded-lg flex items-center justify-center">
                <Image src="/assets/IETE-logo.png" alt="IETE Club" width={44} height={44} className="object-contain h-8 sm:h-10 w-auto" />
              </div>
              <span className="font-mono text-[9px] text-signal font-semibold tracking-widest hidden xs:inline ml-1">
                IEI × IETE
              </span>
            </div>
          </div>
        </header>

        {/* Main Layout: Asymmetric Bento Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 my-6 sm:my-12 items-stretch">
          
          {/* Left Side: Hero */}
          <BentoCard className="lg:col-span-8 p-5 xs:p-6 sm:p-8 md:p-12 flex flex-col justify-between min-h-[440px] sm:min-h-[500px]" delay={0.1} glowColor="signal">
            <div className="space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-signal font-mono text-[10px] xs:text-xs uppercase tracking-widest font-semibold max-w-full truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse shrink-0" />
                <span className="truncate">{isLive ? "THE HUNT IS ACTIVE" : "PRE-LAUNCH PREPARATIONS"}</span>
              </div>

              <h1 className="font-display text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white uppercase leading-[0.92] select-none break-words">
                <KineticText delay={0.2}>TECH TREK</KineticText>
              </h1>

              <p className="font-body text-sm sm:text-base md:text-xl text-muted leading-relaxed max-w-2xl font-light">
                Presented by <strong className="text-white font-semibold">IEI × IETE Student Chapters</strong>. Trek across Chitkara University, crack complex coding riddles, navigate to hidden checkpoints, and deploy code under pressure.
              </p>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 sm:px-5 py-3 sm:py-4 max-w-md backdrop-blur-md">
                  <p className="text-red-400 text-xs sm:text-sm font-mono uppercase tracking-wider">
                    Error: {errorMessage}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start select-none w-full sm:w-auto">
              <Link href="/login" className="btn-cyber px-6 xs:px-8 md:px-10 py-3.5 sm:py-4 md:py-5 rounded-xl text-xs md:text-sm uppercase tracking-[0.15em] font-bold flex items-center gap-3 w-full sm:w-auto justify-center min-h-[48px]">
                Launch Portal <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#rules" className="btn-cyber-outline px-6 xs:px-8 md:px-10 py-3.5 sm:py-4 md:py-5 rounded-xl text-xs md:text-sm uppercase tracking-[0.15em] font-bold w-full sm:w-auto text-center flex items-center justify-center min-h-[48px]">
                Mission Runbook
              </a>
            </div>
          </BentoCard>

          {/* Right Side: Telemetry Grid */}
          <div className="lg:col-span-4 flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-5 sm:gap-6 h-full">
            {/* Top telemetry panel */}
            <BentoCard className="p-5 xs:p-6 sm:p-8 flex-1 flex flex-col justify-between" delay={0.2} glowColor="purple">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 font-mono text-[10px] text-muted uppercase tracking-[0.15em]">
                <div>[ TELEMETRY MONITOR ]</div>
                <div className="text-[#A855F7] drop-shadow-[0_0_8px_rgba(75,0,130,0.8)] font-bold">LIVE_SYS_01</div>
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
            <BentoCard className="p-5 xs:p-6 bg-black/40 h-44 sm:h-48 flex flex-col" delay={0.3} glowColor="default">
              <p className="font-mono text-[9px] text-muted uppercase tracking-[0.2em] mb-4">[ LOGSTREAM ]</p>
              <div className="font-mono text-[10px] text-signal/80 space-y-2.5 overflow-hidden opacity-80 mix-blend-screen flex-1">
                <p className="opacity-70">&gt; Initializing spacetime manifold...</p>
                <p className="opacity-80">&gt; Establishing secure uplink...</p>
                <p className="opacity-90">&gt; Calibrating physics engine...</p>
                <p className="animate-pulse font-semibold">&gt; Waiting for authorized entry...</p>
              </div>
            </BentoCard>
          </div>
        </div>

        {/* Rules Section (Bento Grid 3x1) — Responsive padding, consistent height, fluid text */}
        <div id="rules" className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 w-full text-left my-8 sm:my-12 select-none scroll-mt-24">
          <BentoCard className="p-6 sm:p-8 group flex flex-col min-h-[260px] sm:min-h-[280px]" delay={0.4} glowColor="purple">
            <Terminal className="w-8 sm:w-10 h-8 sm:h-10 text-signal/40 mb-4 sm:mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-6xl sm:text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none select-none">01</div>
            <h3 className="text-white font-display text-xl sm:text-2xl font-bold mb-2 sm:mb-3 uppercase tracking-wide mt-auto">Solve Riddles</h3>
            <p className="text-muted text-xs sm:text-sm font-body leading-relaxed">
              Crack code logic, programming errors, or location hints that point to your target destination on campus.
            </p>
          </BentoCard>

          <BentoCard className="p-6 sm:p-8 group flex flex-col min-h-[260px] sm:min-h-[280px]" delay={0.5} glowColor="signal">
            <MapPin className="w-8 sm:w-10 h-8 sm:h-10 text-signal/40 mb-4 sm:mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-6xl sm:text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none select-none">02</div>
            <h3 className="text-white font-display text-xl sm:text-2xl font-bold mb-2 sm:mb-3 uppercase tracking-wide mt-auto">Reach Checkpoint</h3>
            <p className="text-muted text-xs sm:text-sm font-body leading-relaxed">
              Navigate to the physical location on campus, find the outpost staff member, and get verified via QR pass.
            </p>
          </BentoCard>

          <BentoCard className="p-6 sm:p-8 group flex flex-col min-h-[260px] sm:min-h-[280px]" delay={0.6} glowColor="danger">
            <Code className="w-8 sm:w-10 h-8 sm:h-10 text-signal/40 mb-4 sm:mb-6 group-hover:text-signal transition-colors duration-500 shrink-0" />
            <div className="text-white/5 font-display text-6xl sm:text-7xl font-extrabold group-hover:text-white/10 transition-colors duration-500 absolute top-4 right-6 pointer-events-none select-none">03</div>
            <h3 className="text-white font-display text-xl sm:text-2xl font-bold mb-2 sm:mb-3 uppercase tracking-wide mt-auto">Deploy Code</h3>
            <p className="text-muted text-xs sm:text-sm font-body leading-relaxed">
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
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono text-[10px] text-muted uppercase tracking-[0.25em] mb-8 sm:mb-10">
            [ ORGANIZED BY ]
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-10 mb-8">
            <div className="bg-white/95 p-2.5 sm:p-3.5 rounded-xl flex items-center justify-center backdrop-blur-md shadow-sm">
              <Image src="/assets/IEI-logo.png" alt="IEI Club" width={90} height={90} className="object-contain h-14 sm:h-20 w-auto" />
            </div>
            <span className="text-white/30 font-display text-2xl sm:text-3xl font-thin select-none">×</span>
            <div className="bg-white/95 p-2.5 sm:p-3.5 rounded-xl flex items-center justify-center backdrop-blur-md shadow-sm">
              <Image src="/assets/IETE-logo.png" alt="IETE Club" width={90} height={90} className="object-contain h-14 sm:h-20 w-auto" />
            </div>
            <span className="text-white/30 font-display text-2xl sm:text-3xl font-thin select-none">×</span>
            <div className="bg-white/95 p-2.5 sm:p-3.5 rounded-xl flex items-center justify-center backdrop-blur-md shadow-sm">
              <Image src="/assets/chitkara-university-logo.png" alt="Chitkara University" width={200} height={55} className="object-contain h-12 sm:h-16 w-auto" />
            </div>
          </div>
          <p className="text-muted text-xs sm:text-sm font-body tracking-wide font-medium">
            IEI Club × IETE Club · Chitkara University · EST. 2026
          </p>
        </div>
      </section>

      {/* Footer diagnostic block */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-muted border-t border-white/5 pt-6 pb-8 px-6">
        <div className="tracking-[0.1em] text-[10px] uppercase">[ CODE PIPELINE ESTABLISHED ]</div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] animate-pulse" />
          <span className="tracking-[0.1em] text-[10px]">SYSTEM SECURE</span>
        </div>
      </footer>
    </>
  );
}
