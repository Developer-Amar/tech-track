"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * EventRealtimeSync
 *
 * Background coordinator for the live event arena (/event).
 * Synchronizes all teammate devices in real time without manual reloads:
 * - Event start / pause / stop from admin (event_settings)
 * - Round progress (teammate solving riddle, scanning QR, or passing code)
 * - Round 2 qualification and arena transitions
 * - Announcements and disqualification alerts
 */
export default function EventRealtimeSync({
  unitId,
}: {
  unitId: string;
}) {
  const router = useRouter();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRefresh = useCallback((source = "realtime") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tech_track_refresh", {
          detail: { unitId, source, timestamp: Date.now() },
        })
      );
    }

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 250);
  }, [unitId, router]);

  useEffect(() => {
    if (!unitId) return;
    const supabase = createClient();
    const channels: any[] = [];

    // 1. Team Round Progress (riddle solved, QR scanned, code passed by any teammate)
    const progressChannel = supabase
      .channel(`event_sync_progress_${unitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_progress",
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          triggerRefresh("progress_update");
        }
      )
      .subscribe();
    channels.push(progressChannel);

    // 2. Global Event Settings (organizer starting hunt, stopping Round 1, starting Round 2)
    const settingsChannel = supabase
      .channel("event_sync_settings")
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

    // 3. Team Status (payment clearance, disqualification)
    const unitChannel = supabase
      .channel(`event_sync_unit_${unitId}`)
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

    // 4. Round 2 Qualification
    const qualChannel = supabase
      .channel(`event_sync_qual_${unitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_qualifiers",
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          triggerRefresh("qualifiers_update");
        }
      )
      .subscribe();
    channels.push(qualChannel);

    // 5. Window focus & visibility recovery
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        triggerRefresh("focus_or_visible");
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // 6. Safety heartbeat: every 5s during live event
    const safetyTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        window.dispatchEvent(
          new CustomEvent("tech_track_refresh", {
            detail: { unitId, source: "event_heartbeat", timestamp: Date.now() },
          })
        );
      }
    }, 5000);

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      clearInterval(safetyTimer);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [unitId, triggerRefresh]);

  return null;
}
