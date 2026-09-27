"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * DashboardRealtimeSync
 *
 * Invisible background client coordinator that guarantees instantaneous synchronization:
 * 1. Supabase Realtime WebSocket subscriptions (unit_members, units, event_settings)
 * 2. Instant cross-component dispatch via "tech_track_refresh" CustomEvent
 * 3. Immediate sync on window focus and tab visibility change
 * 4. Fallback interval polling for active state transitions (invites, roster lock, payment)
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

  const triggerRefresh = useCallback((source = "realtime") => {
    // 1. Immediately notify all local client components on the page
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tech_track_refresh", {
          detail: { userId, unitId, source, timestamp: Date.now() },
        })
      );
    }

    // 2. Debounce router.refresh() to update server components without spamming
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 250);
  }, [userId, unitId, router]);

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
          triggerRefresh("user_membership_change");
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
            triggerRefresh("team_membership_change");
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
            triggerRefresh("unit_update");
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
          triggerRefresh("settings_update");
        }
      )
      .subscribe();
    channels.push(settingsChannel);

    // 5. Window focus & visibility recovery: sync immediately when tab becomes visible
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        triggerRefresh("focus_or_visible");
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // 6. Safety heartbeat: every 3s when waiting for a team, or every 6s when in a team
    const pollIntervalMs = unitId ? 5000 : 3000;
    const safetyTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        // Send internal event so client widgets poll without full RSC re-fetch
        window.dispatchEvent(
          new CustomEvent("tech_track_refresh", {
            detail: { userId, unitId, source: "safety_heartbeat", timestamp: Date.now() },
          })
        );
      }
    }, pollIntervalMs);

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      clearInterval(safetyTimer);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, unitId, triggerRefresh]);

  return null;
}
