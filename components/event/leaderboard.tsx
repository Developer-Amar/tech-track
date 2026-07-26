"use client";

import { useState, useEffect } from "react";
import BentoCard from "@/components/bento-card";
import { Trophy } from "lucide-react";

type LeaderboardEntry = {
  rank: number;
  unit_id: string;
  name: string;
  unit_type: string;
  rounds_completed: number;
  total_points: number;
  last_completed_at: string | null;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLeaderboard() {
    const res = await fetch("/api/event/leaderboard");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.leaderboard);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <BentoCard glowColor="default" className="p-8 text-center bg-black/40 border-white/5">
        <p className="text-muted text-sm font-mono animate-pulse uppercase tracking-[0.2em]">[LOADING LEADERBOARD...]</p>
      </BentoCard>
    );
  }

  if (entries.length === 0) {
    return (
      <BentoCard glowColor="default" className="p-8 text-center bg-black/40 border-white/5">
        <p className="text-muted text-sm font-mono uppercase tracking-[0.2em]">No stats recorded yet.</p>
      </BentoCard>
    );
  }

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  const podiumStyles = [
    { text: "text-[#FFD700]", border: "border-[#FFD700]/30 bg-[#FFD700]/5", badge: "🥇 GOLD", glow: "shadow-[0_0_20px_rgba(255,215,0,0.15)]" },
    { text: "text-slate-300", border: "border-slate-300/30 bg-slate-300/5", badge: "🥈 SILVER", glow: "shadow-[0_0_20px_rgba(203,213,225,0.1)]" },
    { text: "text-[#CD7F32]", border: "border-[#CD7F32]/30 bg-[#CD7F32]/5", badge: "🥉 BRONZE", glow: "shadow-[0_0_20px_rgba(205,127,50,0.1)]" }
  ];

  return (
    <BentoCard glowColor="default" className="p-6 md:p-8 text-left relative overflow-hidden bg-black/40 border-white/5">
      <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7DF9FF] font-semibold flex items-center gap-2 mb-1">
            <Trophy className="w-3 h-3" /> STANDINGS
          </p>
          <h3 className="font-display text-3xl md:text-4xl font-extrabold text-white uppercase">
            Leaderboard
          </h3>
        </div>
        <p className="text-muted text-[10px] font-mono uppercase tracking-[0.2em] animate-pulse font-semibold border border-white/10 px-3 py-1.5 rounded-lg bg-white/5">
          LIVE · 30s
        </p>
      </div>

      {/* Podium for Top 3 */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {topThree.map((entry, idx) => {
            const style = podiumStyles[idx] || podiumStyles[2];
            return (
              <div
                key={entry.unit_id}
                className={`rounded-2xl border p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${style.border} ${style.glow}`}
              >
                <div className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-[0.2em] font-bold opacity-80 bg-black/40 px-2 py-1 rounded">
                  {style.badge}
                </div>
                <div className="mb-6 mt-2">
                  <p className="font-mono text-[10px] text-muted uppercase tracking-[0.2em] font-semibold mb-1">RANK 0{idx + 1}</p>
                  <h4 className={`font-display text-2xl md:text-3xl font-bold uppercase truncate ${style.text}`}>
                    {entry.name}
                  </h4>
                  <p className="font-mono text-xs text-muted capitalize opacity-70 mt-1">{entry.unit_type === "team" ? "👥 Team" : "👤 Solo"}</p>
                </div>
                <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-auto">
                  <div>
                    <p className="text-white font-mono text-xl font-bold">{entry.total_points}</p>
                    <p className="text-muted text-[9px] font-mono uppercase tracking-widest font-semibold mt-1">POINTS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono text-sm">{entry.rounds_completed}</p>
                    <p className="text-muted text-[9px] font-mono uppercase tracking-widest font-semibold mt-1">ROUNDS</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remaining Entries List */}
      <div className="space-y-3">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-mono text-muted uppercase tracking-[0.2em] font-semibold bg-black/60 rounded-xl border border-white/5">
          <div className="col-span-1">RK</div>
          <div className="col-span-4 md:col-span-5">TEAM NAME</div>
          <div className="col-span-2 text-center">PTS</div>
          <div className="col-span-2 text-center hidden md:block">ROUNDS</div>
          <div className="col-span-2 md:col-span-1">TYPE</div>
          <div className="col-span-3 md:col-span-2 text-right">LAST UPDATE</div>
        </div>

        {entries.map((entry) => (
          <div
            key={entry.unit_id}
            className={`grid grid-cols-12 gap-2 rounded-xl px-5 py-4 text-sm items-center border transition-all duration-300 ${
              entry.rank <= 3
                ? "bg-[#7DF9FF]/5 border-[#7DF9FF]/20 hover:border-[#7DF9FF]/40 hover:bg-[#7DF9FF]/10"
                : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5"
            }`}
          >
            <div className="col-span-1 font-mono font-bold text-[#7DF9FF]">
              {entry.rank < 10 ? `0${entry.rank}` : entry.rank}
            </div>
            <div className="col-span-4 md:col-span-5 font-display text-white text-lg uppercase truncate tracking-wide">
              {entry.name}
            </div>
            <div className="col-span-2 text-center font-mono font-bold text-[#7DF9FF]">
              {entry.total_points}
            </div>
            <div className="col-span-2 text-center font-mono text-white/90 hidden md:block">
              {entry.rounds_completed}
            </div>
            <div className="col-span-2 md:col-span-1 font-mono text-[10px] text-muted uppercase tracking-widest">
              {entry.unit_type === "team" ? "TEAM" : "SOLO"}
            </div>
            <div className="col-span-3 md:col-span-2 text-right font-mono text-[10px] text-muted tracking-wider">
              {entry.last_completed_at
                ? new Date(entry.last_completed_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
