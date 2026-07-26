"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: process.env.NEXT_PUBLIC_GOOGLE_HD_DOMAIN || "chitkara.edu.in",
        },
      },
    });

    if (error) {
      console.error("OAuth error:", error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 relative z-10 selection:bg-[#7DF9FF] selection:text-black">
      <BentoCard className="w-full max-w-md p-10 text-center flex flex-col items-center" delay={0.1} glowColor="signal">
        
        <div className="mb-8 select-none w-full flex flex-col items-center">
          <Lock className="w-8 h-8 text-signal mb-4 opacity-80" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted mb-3 font-semibold">SECURITY CONTROL</span>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white mb-2 uppercase">
            <KineticText delay={0.2}>SIGN IN</KineticText>
          </h1>
          <div className="h-px bg-gradient-to-r from-transparent via-[#7DF9FF]/30 to-transparent w-full my-6" />
          <p className="text-muted font-body text-sm max-w-xs mx-auto">
            Authorize terminal access using your Chitkara University Google account to join the hunt.
          </p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-black/40 border border-[#7DF9FF]/20 hover:border-[#7DF9FF] hover:bg-[#7DF9FF]/10 px-6 py-4 text-white font-body font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_15px_rgba(125,249,255,0.02)] hover:shadow-[0_0_25px_rgba(125,249,255,0.2)]"
        >
          {/* Google "G" icon */}
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-display uppercase tracking-[0.1em] text-xs">
            {loading ? "Initializing..." : "Sign In with Google"}
          </span>
        </button>

        <p className="mt-8 text-[10px] text-muted font-mono uppercase tracking-[0.2em]">
          🔐 Chitkara Domains Only
        </p>
      </BentoCard>
    </main>
  );
}
