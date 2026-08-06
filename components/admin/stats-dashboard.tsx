"use client";

import { useState, useEffect } from "react";
import ProctoringAlerts from "@/components/admin/proctoring-alerts";
import BentoCard from "@/components/bento-card";
import { Activity, ShieldAlert, CheckCircle2, XCircle, Database, Server, RefreshCw } from "lucide-react";

type Stats = {
  users: { total: number; profile_complete: number };
  units: { total: number; locked: number; solo: number; team: number };
  submissions: { total: number; passed: number };
  invites: { pending: number };
  rounds: { passed: number; in_progress: number };
  settings: { registration_open: boolean; event_live: boolean; total_rounds: number } | null;
};

type HealthData = {
  status: string;
  service: string;
  timestamp: string;
  total_response_ms: number;
  telemetry: {
    database: { status: string; latency_ms: number };
    judge0: { status: string };
  };
};

export default function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);

  const fetchHealth = () => {
    setPinging(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth(null))
      .finally(() => setPinging(false));
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ])
      .then(([statsData, healthData]) => {
        setStats(statsData);
        setHealth(healthData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <p className="text-[#7DF9FF] text-sm font-mono animate-pulse uppercase tracking-widest flex items-center gap-2">
        <Activity className="w-4 h-4 animate-spin" /> [ESTABLISHING UPLINK TO TELEMETRY DATA...]
      </p>
    </div>
  );
  if (!stats) return <p className="text-red-500 text-sm font-mono flex items-center gap-2"><XCircle className="w-4 h-4" /> [ERROR: TELEMETRY UPLINK FAILED]</p>;

  const cards = [
    { label: "REGISTERED PLAYERS", value: stats.users.total, sub: `${stats.users.profile_complete} completed profiles` },
    { label: "TOTAL PARTICIPATING TEAMS", value: stats.units.total, sub: `${stats.units.solo} solo units · ${stats.units.team} teams` },
    { label: "LOCKED TEAMS", value: stats.units.locked, sub: `out of ${stats.units.total} total teams` },
    { label: "CODE SUBMISSIONS", value: stats.submissions.total, sub: `${stats.submissions.passed} passed test suites` },
    { label: "ACTIVE ROUNDS", value: stats.rounds.in_progress, sub: `${stats.rounds.passed} rounds completed` },
    { label: "PENDING TEAM INVITES", value: stats.invites.pending, sub: "waiting for member responses" },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* HUD status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`rounded-lg border px-3 py-1.5 text-[10px] font-mono tracking-widest font-semibold flex items-center gap-1.5 ${
            stats.settings?.registration_open
              ? "bg-[#7DF9FF]/5 border-[#7DF9FF]/30 text-[#7DF9FF] shadow-[0_0_10px_rgba(125,249,255,0.1)]"
              : "bg-red-500/5 border-red-500/30 text-red-500"
          }`}>
            {stats.settings?.registration_open ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            REGISTRATION: {stats.settings?.registration_open ? "OPEN" : "CLOSED"}
          </div>
          <div className={`rounded-lg border px-3 py-1.5 text-[10px] font-mono tracking-widest font-semibold flex items-center gap-1.5 ${
            stats.settings?.event_live
              ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)] animate-pulse"
              : "bg-black/40 border-white/10 text-muted"
          }`}>
            <Activity className="w-3 h-3" />
            EVENT STATUS: {stats.settings?.event_live ? "LIVE" : "DORMANT"}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-mono text-white/80 tracking-widest font-semibold">
            ROUNDS: {stats.settings?.total_rounds} TOTAL
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={pinging}
          className="rounded-lg border border-[#7DF9FF]/30 bg-[#7DF9FF]/10 hover:bg-[#7DF9FF]/20 px-3 py-1.5 text-[10px] font-mono text-[#7DF9FF] tracking-widest font-semibold flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${pinging ? "animate-spin" : ""}`} />
          {pinging ? "PINGING DB..." : "PING SYSTEM HEARTBEAT"}
        </button>
      </div>

      {/* System Infrastructure Telemetry Card */}
      <BentoCard glowColor="purple" className="p-6 bg-black/50 border-[#7DF9FF]/20 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#7DF9FF]" />
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
              Supabase & Infrastructure Telemetry
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#7DF9FF] bg-[#7DF9FF]/10 px-2.5 py-1 rounded border border-[#7DF9FF]/30">
            AUTO KEEP-ALIVE CRON: ACTIVE (EVERY 3 DAYS)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3.5 rounded-xl border border-white/5 bg-void/60 flex flex-col justify-between">
            <span className="text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-signal" /> Supabase Database
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${health?.telemetry.database.status === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-500'}`} />
              <span className="text-white font-bold text-sm uppercase">
                {health?.telemetry.database.status || "UNKNOWN"}
              </span>
            </div>
            <span className="text-muted/70 text-[10px] mt-2">
              Latency: {health?.telemetry.database.latency_ms ?? -1} ms
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-white/5 bg-void/60 flex flex-col justify-between">
            <span className="text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-purple-400" /> Judge0 Execution Engine
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${health?.telemetry.judge0.status === 'configured' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
              <span className="text-white font-bold text-sm uppercase">
                {health?.telemetry.judge0.status || "UNKNOWN"}
              </span>
            </div>
            <span className="text-muted/70 text-[10px] mt-2">
              Compiler API Uplink
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-white/5 bg-void/60 flex flex-col justify-between">
            <span className="text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-signal" /> Total Endpoint Latency
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-signal font-bold text-sm">
                {health?.total_response_ms ?? 0} ms
              </span>
            </div>
            <span className="text-muted/70 text-[10px] mt-2 truncate">
              Last Ping: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "N/A"}
            </span>
          </div>
        </div>
      </BentoCard>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <BentoCard key={card.label} glowColor="signal" className="rounded-2xl p-5 md:p-6 relative overflow-hidden group bg-black/40 border-white/5 transition-all duration-300 hover:border-[#7DF9FF]/30 hover:bg-[#7DF9FF]/5">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#7DF9FF]/5 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:bg-[#7DF9FF]/10 group-hover:scale-125" />
            <p className="text-muted text-[10px] font-mono tracking-widest uppercase mb-2 font-semibold group-hover:text-white/80 transition-colors">{card.label}</p>
            <p className="text-white font-display text-4xl md:text-5xl font-extrabold tracking-wider mb-2 group-hover:text-[#7DF9FF] transition-colors duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:drop-shadow-[0_0_15px_rgba(125,249,255,0.4)]">
              {card.value}
            </p>
            <p className="text-muted/70 text-xs font-body font-medium">{card.sub}</p>
          </BentoCard>
        ))}
      </div>

      {/* Live proctoring alerts */}
      <div className="mt-8 pt-6">
        <BentoCard glowColor="danger" className="p-6 md:p-8 bg-black/40 border-red-500/10">
          <h3 className="font-display text-2xl md:text-3xl font-bold text-red-500 uppercase mb-4 tracking-wider flex items-center gap-3 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
            <ShieldAlert className="w-8 h-8 animate-pulse" /> 
            Live Proctoring Alerts
          </h3>
          <ProctoringAlerts />
        </BentoCard>
      </div>
    </div>
  );
}
