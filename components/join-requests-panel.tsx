"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import BentoCard from "@/components/bento-card";
import { UserPlus, Check, X, Loader2, Inbox } from "lucide-react";

interface JoinRequest {
  id: string;
  user_id: string;
  unit_id: string;
  status: string;
  users: { name: string; email: string } | null;
}

export default function JoinRequestsPanel({ unitId }: { unitId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('unit_members')
        .select('id, user_id, unit_id, status, users:user_id (name, email)')
        .eq('unit_id', unitId)
        .eq('status', 'requested');
      setRequests((data as unknown as JoinRequest[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch join requests:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, unitId]);

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('join-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_members', filter: `unit_id=eq.${unitId}` }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests, supabase, unitId]);

  const respond = async (userId: string, response: 'accepted' | 'declined') => {
    setActionLoading(userId);
    try {
      await fetch('/api/units/request/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, user_id: userId, response }),
      });
      await fetchRequests();
    } catch (err) {
      console.error('Failed to respond:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <BentoCard delay={0.1} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Inbox className="w-4 h-4 text-signal" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-dormant">
          Join Requests ({requests.length})
        </h3>
      </div>

      <div className="space-y-2">
        {requests.map(req => (
          <div key={req.id} className="rounded-lg border border-white/[0.08] bg-void/50 p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-body text-sm text-white font-semibold truncate">{(req.users as any)?.name ?? 'Unknown'}</p>
              <p className="font-mono text-xs text-dormant truncate max-w-full overflow-hidden text-ellipsis">{(req.users as any)?.email ?? ''}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {actionLoading === req.user_id ? (
                <Loader2 className="w-4 h-4 text-signal animate-spin" />
              ) : (
                <>
                  <button
                    onClick={() => respond(req.user_id, 'accepted')}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-signal/10 border border-signal/30 p-2 text-signal hover:bg-signal/20 transition-colors"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => respond(req.user_id, 'declined')}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-danger/10 border border-danger/30 p-2 text-danger hover:bg-danger/20 transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
