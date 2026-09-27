"use client";

import { useEffect, useRef } from "react";
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

  const debouncedRefresh = () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 350);
  };

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
          debouncedRefresh();
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
          debouncedRefresh();
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
          debouncedRefresh();
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
          debouncedRefresh();
        }
      )
      .subscribe();
    channels.push(qualChannel);

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [unitId]);

  return null;
}
