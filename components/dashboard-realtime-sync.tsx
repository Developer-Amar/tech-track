"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * DashboardRealtimeSync
 *
 * Invisible background client coordinator that listens to all critical Supabase
 * Realtime events for this user, their unit, and global settings.
 *
 * When an invite arrives, a member accepts/leaves, the team gets locked,
 * payment is cleared, or admin starts/stops event:
 * Automatically re-renders the dashboard via debounced router.refresh()
 * with zero manual browser reloads required.
 */
export default function DashboardRealtimeSync({
  userId,
  unitId,
}: {
  userId: string;
  unitId: string | null;
}) {
  const router = useRouter();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedRefresh = () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 350);
  };

  useEffect(() => {
    const supabase = createClient();
    const channels: any[] = [];

    // 1. Personal membership changes (incoming invites, acceptances, cancels)
    const userChannel = supabase
      .channel(`dash_sync_user_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unit_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedRefresh();
        }
      )
      .subscribe();
    channels.push(userChannel);

    // 2. Team membership changes (teammates accepting, being invited, or leaving)
    if (unitId) {
      const teamChannel = supabase
        .channel(`dash_sync_team_${unitId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "unit_members",
            filter: `unit_id=eq.${unitId}`,
          },
          () => {
            debouncedRefresh();
          }
        )
        .subscribe();
      channels.push(teamChannel);

      // 3. Unit changes (leader locks team, payment status verified/rejected, name change)
      const unitChannel = supabase
        .channel(`dash_sync_unit_${unitId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "units",
            filter: `id=eq.${unitId}`,
          },
          () => {
            debouncedRefresh();
          }
        )
        .subscribe();
      channels.push(unitChannel);
    }

    // 4. Global settings (registration open/closed, event started/stopped)
    const settingsChannel = supabase
      .channel("dash_sync_settings")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "event_settings",
          filter: "id=eq.1",
        },
        () => {
          debouncedRefresh();
        }
      )
      .subscribe();
    channels.push(settingsChannel);

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, unitId]);

  return null;
}
