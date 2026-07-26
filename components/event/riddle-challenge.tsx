"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";

export default function RiddleChallenge({
  round,
  riddleText,
}: {
  round: number;
  riddleText: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;

    setLoading(true);
    setFeedback(null);

    const res = await fetch("/api/event/riddle/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer.trim(), round }),
    });

    const data = await res.json();

    if (data.correct) {
      setFeedback({ correct: true, message: data.message });
      setTimeout(() => router.refresh(), 1000);
    } else {
      setFeedback({ correct: false, message: data.message || "Incorrect. Give it another try!" });
      setLoading(false);
    }
  }

  return (
    <BentoCard glowColor="purple" className="rounded-2xl p-6 md:p-8 text-left relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#7DF9FF]/5 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:bg-[#7DF9FF]/10 group-hover:scale-110" />

      <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1.5 font-semibold">STAGE CHIEF: RIDDLE</p>
      <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1">
        SOLVE THE RIDDLE
      </h3>
      <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
        The solution points to a physical location on campus. Solve it and type the correct location name below.
      </p>

      {/* Riddle display box */}
      <div className="rounded-xl border border-signal/15 bg-void/50 p-6 mb-5 relative select-text">
        <div className="absolute top-2.5 left-3 font-mono text-[8px] text-dormant uppercase tracking-widest font-semibold">[RIDDLE_TEXT]</div>
        <p className="text-text font-mono text-sm leading-relaxed whitespace-pre-wrap mt-3 select-text italic">
          &ldquo;{riddleText}&rdquo;
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-text mb-1.5">
            Your Answer (Location Name)
          </label>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type answer here..."
            className="w-full rounded-lg border border-signal/25 bg-void/40 px-4 py-3 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
        </div>

        {feedback && (
          <div className={`rounded-lg p-3 border text-xs font-mono uppercase tracking-wider ${
            feedback.correct ? "bg-signal/5 border-signal/30 text-signal" : "bg-danger/5 border-danger/30 text-danger"
          }`}>
            {feedback.correct ? "Success: " : "Error: "} {feedback.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !answer.trim()}
          className="w-full btn-cyber px-4 py-3.5 rounded-lg text-xs uppercase"
        >
          {loading ? (feedback?.correct ? "Loading next stage..." : "Verifying...") : "Verify Answer"}
        </button>
      </form>
    </BentoCard>
  );
}
