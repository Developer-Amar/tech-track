"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BentoCard from "@/components/bento-card";
import { Lightbulb, ChevronDown, ChevronUp, Eye, EyeOff, Sparkles, Compass } from "lucide-react";

export default function RiddleChallenge({
  round,
  riddleText,
  hints = [],
}: {
  round: number;
  riddleText: string;
  hints?: string[];
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  // Sub-hints revelation state
  const [hintsExpanded, setHintsExpanded] = useState(false);
  const [revealedHints, setRevealedHints] = useState<{ [index: number]: boolean }>({});

  const validHints = hints.filter((h) => h && h.trim().length > 0);

  const toggleHint = (idx: number) => {
    setRevealedHints((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const revealAll = () => {
    const all: { [index: number]: boolean } = {};
    validHints.forEach((_, i) => {
      all[i] = true;
    });
    setRevealedHints(all);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/event/riddle/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim(), round }),
      });

      const data = await res.json();

      if (res.ok && data.correct) {
        setFeedback({ correct: true, message: data.message });
        router.refresh();
      } else {
        setFeedback({
          correct: false,
          message: data.error || data.message || "Incorrect location. Check the riddle or clues and give it another try!",
        });
        setLoading(false);
      }
    } catch {
      setFeedback({
        correct: false,
        message: "Network error. Please check your connection and try again.",
      });
      setLoading(false);
    }
  }

  return (
    <BentoCard glowColor="purple" className="rounded-2xl p-6 md:p-8 text-left relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E5FF]/5 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:bg-[#00E5FF]/10 group-hover:scale-110" />

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

      {/* 3 Sub-Hints Section (Progressive revelation) */}
      {validHints.length > 0 && (
        <div className="mb-6 rounded-xl border border-cyan-500/25 bg-cyan-950/20 overflow-hidden backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setHintsExpanded(!hintsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/15 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#00E5FF] animate-pulse" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
                Intel Assistance: {validHints.length} Campus Sub-Hint{validHints.length > 1 ? "s" : ""} Available
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-300 uppercase tracking-widest">
              <span>{hintsExpanded ? "Hide Clues" : "Show Clues"}</span>
              {hintsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {hintsExpanded && (
            <div className="p-4 space-y-3 border-t border-cyan-500/20">
              <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase tracking-wider mb-1">
                <span>Reveal clues progressively to maintain challenge points</span>
                <button
                  type="button"
                  onClick={revealAll}
                  className="text-signal hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" /> Reveal All
                </button>
              </div>

              {validHints.map((hint, idx) => {
                const isRevealed = Boolean(revealedHints[idx]);
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 transition-all duration-300 ${
                      isRevealed
                        ? "bg-black/60 border-cyan-400/40 shadow-[0_0_15px_rgba(0,229,255,0.08)]"
                        : "bg-void/40 border-dormant/20 hover:border-cyan-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Compass className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span className="font-mono text-[10px] uppercase font-bold text-white tracking-wider">
                          Sub-Hint 0{idx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleHint(idx)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all ${
                          isRevealed
                            ? "bg-cyan-500/20 text-[#00E5FF] hover:bg-cyan-500/30"
                            : "bg-signal/20 text-signal hover:bg-signal/30 font-bold shadow-[0_0_8px_rgba(255,30,86,0.2)]"
                        }`}
                      >
                        {isRevealed ? (
                          <>
                            <EyeOff className="w-3 h-3" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> Reveal Clue
                          </>
                        )}
                      </button>
                    </div>

                    {isRevealed ? (
                      <p className="mt-2.5 font-mono text-xs text-cyan-100 leading-relaxed pl-5 border-l-2 border-signal">
                        {hint}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-mono text-dormant italic">
                        [Encrypted Intel · Click &quot;Reveal Clue&quot; to decrypt location data]
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-mono uppercase tracking-wider text-text">
              Your Answer (Location Name)
            </label>
            <span className="text-[10px] font-mono text-dormant uppercase tracking-wider">
              Flexible matching active
            </span>
          </div>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type answer here (e.g. Library, Library Gate, etc.)..."
            className="w-full rounded-lg border border-signal/25 bg-void/40 px-4 py-3 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
          />
          <p className="text-[10px] font-mono text-dormant mt-1.5">
            💡 Common location variations, aliases, and abbreviations are accepted.
          </p>
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
