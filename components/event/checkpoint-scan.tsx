"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";

export default function CheckpointScan({
  round,
  locationName,
}: {
  round: number;
  locationName: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setFeedback(null);

    const res = await fetch("/api/event/checkpoint/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), round }),
    });

    const data = await res.json();

    if (data.correct) {
      setFeedback({ correct: true, message: data.message });
      setTimeout(() => router.refresh(), 1000);
    } else {
      setFeedback({ correct: false, message: data.message || "Wrong verification code." });
      setLoading(false);
    }
  }

  return (
    <BentoCard glowColor="signal" className="rounded-2xl p-6 md:p-8 text-left relative overflow-hidden group border-[#7DF9FF]/20">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#7DF9FF]/5 rounded-full blur-2xl pointer-events-none transition-all duration-500 group-hover:bg-[#7DF9FF]/10 group-hover:scale-110" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1.5 font-semibold">STAGE CHIEF: CHECKPOINT</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1">
        FIND THE CHECKPOINT
      </h3>
      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        Head to the location below. Find the posted outpost staff, verify your team details, and claim the secret checkpoint code to enter here.
      </p>

      {/* Target Location Card */}
      <div className="rounded-xl border border-signal/30 bg-signal/5 p-6 mb-5 text-center relative overflow-hidden">
        <p className="font-mono text-[10px] text-signal uppercase tracking-widest mb-1 font-semibold">GO TO LOCATION</p>
        <p className="text-white font-display text-3xl font-extrabold uppercase tracking-wider drop-shadow-[0_0_10px_rgba(255,30,86,0.3)]">{locationName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5 text-center">
            Secret Verification Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TYPE CODE..."
            className="w-full rounded-lg border border-signal/25 bg-void/40 px-4 py-3.5 text-text font-mono text-lg tracking-widest text-center focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300 uppercase"
            autoComplete="off"
          />
        </div>

        {feedback && (
          <div className={`rounded-lg p-3 border text-xs font-mono uppercase tracking-wider ${
            feedback.correct ? "bg-signal/5 border-signal/30 text-signal" : "bg-danger/5 border-danger/30 text-danger"
          }`}>
            {feedback.correct ? "Verified: " : "Error: "} {feedback.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full btn-cyber px-4 py-3.5 rounded-lg text-xs uppercase"
        >
          {loading ? (feedback?.correct ? "Opening coding stage..." : "Verifying...") : "Verify Code"}
        </button>
      </form>
    </BentoCard>
  );
}
