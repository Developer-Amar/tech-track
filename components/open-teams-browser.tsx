"use client";

import { useEffect, useState, useCallback } from "react";
import BentoCard from "@/components/bento-card";
import KineticText from "@/components/kinetic-text";
import { Users, Search, UserPlus, Clock, CheckCircle, Loader2 } from "lucide-react";

interface OpenTeam {
  id: string;
  name: string;
  leader_name: string;
  member_count: number;
  members: string[];
}

export default function OpenTeamsBrowser() {
  const [teams, setTeams] = useState<OpenTeam[]>([]);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/units/open-teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams ?? []);
        setRequestedIds(new Set(data.requested_team_ids ?? []));
      }
    } catch (err) {
      console.error('Failed to fetch open teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const sendRequest = async (unitId: string) => {
    setSendingTo(unitId);
    setMessage(null);
    try {
      const res = await fetch('/api/units/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Join request sent!' });
        setRequestedIds(prev => new Set([...Array.from(prev), unitId]));
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to send request' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSendingTo(null);
    }
  };

  const filtered = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.leader_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal font-semibold flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> BROWSE OPEN TEAMS
        </span>
        <h2 className="font-display text-2xl font-bold text-white mt-1">
          <KineticText delay={0.1}>FIND YOUR TEAM</KineticText>
        </h2>
        <p className="font-body text-sm text-dormant mt-2">
          Browse available teams and send a join request. The team leader will accept or decline your request.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dormant" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams by name or leader..."
          className="w-full rounded-lg border border-white/[0.08] bg-void/60 pl-10 pr-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
        />
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-mono ${
          message.type === 'success' ? 'border-signal/30 bg-signal/5 text-signal' : 'border-danger/30 bg-danger/5 text-danger'
        }`}>{message.text}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-signal animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-dormant font-mono text-sm">
          {search ? 'No teams match your search.' : 'No open teams available right now.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(team => {
            const isRequested = requestedIds.has(team.id);
            const isSending = sendingTo === team.id;
            return (
              <BentoCard key={team.id} delay={0.1} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">{team.name}</h3>
                    <p className="font-mono text-[10px] text-dormant uppercase mt-0.5">Led by {team.leader_name}</p>
                  </div>
                  <span className="font-mono text-xs text-dormant bg-void/60 rounded px-2 py-1">
                    {team.member_count}/4
                  </span>
                </div>

                {/* Members */}
                <div className="mb-4">
                  <p className="font-mono text-[9px] text-dormant uppercase mb-1">Members</p>
                  <div className="flex flex-wrap gap-1">
                    {team.members.map((m, i) => (
                      <span key={i} className="rounded bg-void/60 border border-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-dormant">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action */}
                {isRequested ? (
                  <div className="flex items-center gap-2 text-signal font-mono text-xs">
                    <Clock className="w-4 h-4" /> Request Pending
                  </div>
                ) : (
                  <button
                    onClick={() => sendRequest(team.id)}
                    disabled={isSending}
                    className="btn-cyber w-full py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Request to Join
                  </button>
                )}
              </BentoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
