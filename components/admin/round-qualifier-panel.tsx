"use client";

import { useEffect, useState, useCallback } from "react";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import {
  Trophy, Play, Square, Users, CheckCircle, XCircle, ArrowUpRight,
  AlertTriangle, Loader2, ChevronDown, RotateCcw
} from "lucide-react";

interface RoundSettings {
  current_round_phase: number;
  round_1_stopped: boolean;
  round_2_active: boolean;
  round_2_stopped: boolean;
  event_live: boolean;
  total_rounds: number;
}

interface Qualifier {
  id: string;
  unit_id: string;
  is_back_entry: boolean;
  qualified_at: string;
  units: { name: string } | null;
}

interface TeamEntry {
  unit_id: string;
  name: string;
  round_1: { total_points: number; questions_completed: number };
  qualified_for_round_2: boolean;
  disqualified: boolean;
}

export default function RoundQualifierPanel() {
  const [settings, setSettings] = useState<RoundSettings | null>(null);
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [roundsRes, lbRes] = await Promise.all([
        fetch('/api/admin/rounds'),
        fetch('/api/admin/leaderboard'),
      ]);
      if (roundsRes.ok) {
        const data = await roundsRes.json();
        setSettings(data.settings);
        setQualifiers(data.qualifiers ?? []);
      }
      if (lbRes.ok) {
        const data = await lbRes.json();
        setTeams(data.leaderboard ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch round data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doAction = async (body: Record<string, unknown>) => {
    const actionName = body.action as string;
    setActionLoading(actionName);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message ?? 'Done' });
        setSelected(new Set());
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const qualifiedSet = new Set(qualifiers.map(q => q.unit_id));
  const unqualifiedTeams = teams.filter(t => !t.disqualified && !qualifiedSet.has(t.unit_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-signal animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal font-semibold flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" /> ROUND MANAGEMENT
        </span>
        <h2 className="font-display text-2xl font-bold text-white mt-1">
          <KineticText delay={0.1}>ROUND CONTROL</KineticText>
        </h2>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 ${
          !settings?.round_1_stopped
            ? 'border-signal/30 bg-signal/5'
            : 'border-white/[0.08] bg-void/50'
        }`}>
          <p className="font-mono text-[10px] text-dormant uppercase">Round 1</p>
          <p className="font-display text-lg font-bold text-white mt-1">
            {settings?.round_1_stopped ? 'STOPPED' : 'ACTIVE'}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${
          settings?.round_2_active
            ? 'border-gold/30 bg-gold/5'
            : 'border-white/[0.08] bg-void/50'
        }`}>
          <p className="font-mono text-[10px] text-dormant uppercase">Round 2</p>
          <p className="font-display text-lg font-bold text-white mt-1">
            {settings?.round_2_stopped ? 'STOPPED' : settings?.round_2_active ? 'ACTIVE' : 'NOT STARTED'}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-void/50 p-4">
          <p className="font-mono text-[10px] text-dormant uppercase">Qualified</p>
          <p className="font-display text-lg font-bold text-gold mt-1">
            {qualifiers.length} TEAMS
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {!settings?.round_1_stopped && (
          <button
            onClick={() => { if (confirm('Stop Round 1? This will freeze scores and make the leaderboard visible to all participants.')) doAction({ action: 'stop_round_1' }); }}
            disabled={actionLoading === 'stop_round_1'}
            className="btn-cyber px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 bg-danger text-white"
          >
            {actionLoading === 'stop_round_1' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            Stop Round 1
          </button>
        )}
        {settings?.round_1_stopped && !settings?.round_2_active && (
          <button
            onClick={() => { if (confirm('Re-open Round 1? This will allow more Round 1 submissions and hide the leaderboard.')) doAction({ action: 'reopen_round_1' } as any); }}
            disabled={actionLoading === 'reopen_round_1'}
            className="btn-cyber px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"
          >
            {actionLoading === 'reopen_round_1' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Re-open Round 1
          </button>
        )}
        {settings?.round_1_stopped && !settings?.round_2_active && !settings?.round_2_stopped && (
          <button
            onClick={() => { if (confirm('Start Round 2? Make sure you have qualified the teams first.')) doAction({ action: 'start_round_2' }); }}
            disabled={actionLoading === 'start_round_2' || qualifiers.length === 0}
            className="btn-cyber px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2"
          >
            {actionLoading === 'start_round_2' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Round 2
          </button>
        )}
        {settings?.round_2_active && !settings?.round_2_stopped && (
          <button
            onClick={() => { if (confirm('Stop Round 2? This will freeze final scores and make results visible to everyone.')) doAction({ action: 'stop_round_2' }); }}
            disabled={actionLoading === 'stop_round_2'}
            className="btn-cyber px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 bg-danger text-white"
          >
            {actionLoading === 'stop_round_2' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            Stop Round 2
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-mono ${
          message.type === 'success'
            ? 'border-signal/30 bg-signal/5 text-signal'
            : 'border-danger/30 bg-danger/5 text-danger'
        }`}>
          {message.text}
        </div>
      )}

      {/* Qualified Teams */}
      {qualifiers.length > 0 && (
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wider text-dormant mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-signal" /> Qualified Teams ({qualifiers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {qualifiers.map(q => (
              <div key={q.id} className="rounded-lg border border-signal/20 bg-signal/5 px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-body text-sm text-white">{(q.units as any)?.name ?? 'Unknown'}</span>
                  {q.is_back_entry && <span className="ml-2 text-[9px] font-mono text-gold uppercase">BACK ENTRY</span>}
                </div>
                <button
                  onClick={() => doAction({ action: 'remove_qualifier', unit_id: q.unit_id })}
                  className="text-dormant hover:text-danger transition-colors p-1"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Selection for Qualification */}
      {settings?.round_1_stopped && !settings?.round_2_stopped && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-dormant flex items-center gap-2">
              <Users className="w-4 h-4" /> Select Teams for Round 2
            </h3>
            {selected.size > 0 && (
              <button
                onClick={() => doAction({ action: 'qualify_teams', unit_ids: Array.from(selected) })}
                disabled={actionLoading === 'qualify_teams'}
                className="btn-cyber px-4 py-2 rounded-lg text-xs uppercase tracking-wider flex items-center gap-2"
              >
                {actionLoading === 'qualify_teams' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
                Qualify {selected.size} Teams
              </button>
            )}
          </div>

          <div className="space-y-1">
            {unqualifiedTeams.map((team, i) => (
              <div
                key={team.unit_id}
                onClick={() => toggleSelect(team.unit_id)}
                className={`rounded-lg border px-4 py-2.5 flex items-center gap-4 cursor-pointer transition-all duration-200 ${
                  selected.has(team.unit_id)
                    ? 'border-signal/30 bg-signal/5'
                    : 'border-white/[0.06] bg-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  selected.has(team.unit_id) ? 'border-signal bg-signal' : 'border-dormant/40'
                }`}>
                  {selected.has(team.unit_id) && <CheckCircle className="w-3 h-3 text-black" />}
                </div>
                <span className="font-mono text-xs text-dormant w-6">{i + 1}</span>
                <span className="font-body text-sm text-white flex-1">{team.name}</span>
                <span className="font-mono text-sm text-signal font-semibold">{team.round_1.total_points} pts</span>
                <span className="font-mono text-xs text-dormant">{team.round_1.questions_completed}Q</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
