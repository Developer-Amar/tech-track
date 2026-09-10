"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import {
  Trophy,
  Search,
  RefreshCw,
  Shield,
  AlertTriangle,
  Users,
  TrendingUp,
  ArrowUpRight,
  Crown,
  Medal,
} from "lucide-react";

interface LeaderboardEntry {
  unit_id: string;
  name: string;
  members: string[];
  disqualified: boolean;
  disqualified_reason: string | null;
  qualified_for_round_2: boolean;
  is_back_entry: boolean;
  round_1: {
    total_points: number;
    questions_completed: number;
    last_completed_at: string | null;
  };
  round_2: {
    total_points: number;
    problems_solved: number;
  };
  total_points: number;
  proctoring: {
    tab_switches: number;
    locked_out: boolean;
  };
}

interface Settings {
  current_round_phase: number;
  round_1_stopped: boolean;
  round_2_active: boolean;
  round_2_stopped: boolean;
  total_rounds: number;
  event_live: boolean;
}

export default function AdminLiveLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
        setSettings(data.settings ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    // Real-time subscriptions
    const channel = supabase
      .channel("admin-live-leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_progress" },
        () => fetchLeaderboard()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_2_progress" },
        () => fetchLeaderboard()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "units" },
        () => fetchLeaderboard()
      )
      .subscribe();

    // Fallback polling every 30s
    const poll = setInterval(fetchLeaderboard, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [fetchLeaderboard, supabase]);

  const filtered = leaderboard.filter(
    (entry) =>
      entry.name?.toLowerCase().includes(search.toLowerCase()) ||
      (entry.members ?? []).some((m) =>
        m.toLowerCase().includes(search.toLowerCase())
      )
  );

  const totalRounds = settings?.total_rounds ?? 10;
  const activeRound = settings?.current_round_phase ?? 1;

  const getRankIcon = (index: number) => {
    if (index === 0)
      return <Crown className="w-5 h-5 text-[#F59E0B]" />;
    if (index === 1)
      return <Medal className="w-5 h-5 text-[#CBD5E1]" />;
    if (index === 2)
      return <Medal className="w-5 h-5 text-[#CD7F32]" />;
    return (
      <span className="font-mono text-sm text-dormant w-5 text-center">
        {index + 1}
      </span>
    );
  };

  const getRowStyle = (entry: LeaderboardEntry, index: number) => {
    if (entry.disqualified) return "border-danger/30 bg-danger/5";
    if (entry.proctoring.locked_out) return "border-gold/30 bg-gold/5";
    if (index === 0) return "border-gold/30 bg-gold/5";
    if (index === 1) return "border-white/10 bg-white/[0.03]";
    if (index === 2) return "border-[#CD7F32]/20 bg-[#CD7F32]/5";
    return "border-white/[0.06] bg-transparent";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BentoCard delay={0.1} className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal font-semibold flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> LIVE TELEMETRY
            </span>
            <h2 className="font-display text-2xl font-bold text-white mt-1">
              <KineticText delay={0.1}>LIVE LEADERBOARD</KineticText>
            </h2>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dormant" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams..."
                className="w-full sm:w-64 rounded-lg border border-white/[0.08] bg-void/60 pl-10 pr-4 py-2 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={fetchLeaderboard}
              className="rounded-lg border border-white/[0.08] bg-void/60 p-2.5 text-dormant hover:text-signal hover:border-signal/30 transition-all duration-300"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-signal" />
            <span className="font-mono text-xs text-dormant">
              {leaderboard.length} TEAMS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="font-mono text-xs text-dormant">
              ROUND {activeRound} {settings?.event_live ? "// LIVE" : "// PAUSED"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-dormant/60">
              LAST SYNC: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </BentoCard>

      {/* Table */}
      <BentoCard delay={0.2} className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.08] bg-void/60">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold w-12">
                  #
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold">
                  TEAM
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold text-center">
                  R1 PTS
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold text-center">
                  R1 QS
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold min-w-[200px]">
                  PROGRESS
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold text-center">
                  R2
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold text-center">
                  TOTAL
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-dormant font-semibold text-center">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-dormant font-mono text-sm">
                    {loading ? "Loading..." : "No teams found."}
                  </td>
                </tr>
              )}
              {filtered.map((entry, index) => {
                const progressPercent = Math.round(
                  (entry.round_1.questions_completed / totalRounds) * 100
                );
                return (
                  <tr
                    key={entry.unit_id}
                    className={`border-b transition-colors duration-200 hover:bg-white/[0.02] ${getRowStyle(entry, index)}`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">{getRankIcon(index)}</td>

                    {/* Team */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-display text-sm font-semibold text-white">
                          {entry.name ?? "Unnamed Team"}
                        </p>
                        <p className="font-mono text-[10px] text-dormant mt-0.5">
                          {(entry.members ?? []).join(" · ")}
                        </p>
                      </div>
                    </td>

                    {/* R1 Points */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm font-semibold text-signal">
                        {entry.round_1.total_points}
                      </span>
                    </td>

                    {/* R1 Questions */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm text-dormant">
                        {entry.round_1.questions_completed}/{totalRounds}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-void/80 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${progressPercent}%`,
                              background: entry.disqualified
                                ? "#EF4444"
                                : `linear-gradient(90deg, #00E5FF, ${
                                    progressPercent > 80
                                      ? "#22C55E"
                                      : "#00E5FF"
                                  })`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-dormant w-8 text-right">
                          {progressPercent}%
                        </span>
                      </div>
                    </td>

                    {/* R2 */}
                    <td className="px-4 py-3 text-center">
                      {entry.qualified_for_round_2 ? (
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-sm font-semibold text-gold">
                            {entry.round_2.total_points}
                          </span>
                          <span className="font-mono text-[9px] text-dormant">
                            {entry.round_2.problems_solved}/3
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-dormant/50">
                          —
                        </span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm font-bold text-white">
                        {entry.total_points}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {entry.disqualified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 border border-danger/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-danger uppercase">
                          <AlertTriangle className="w-3 h-3" /> DQ
                        </span>
                      ) : entry.proctoring.locked_out ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-gold uppercase">
                          <Shield className="w-3 h-3" /> LOCKED
                        </span>
                      ) : entry.qualified_for_round_2 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 border border-signal/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-signal uppercase">
                          <ArrowUpRight className="w-3 h-3" /> R2
                          {entry.is_back_entry && " ↩"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono font-semibold text-dormant uppercase">
                          ACTIVE
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BentoCard>
    </div>
  );
}
