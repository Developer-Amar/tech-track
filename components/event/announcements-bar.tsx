"use client";

import { useState, useEffect } from "react";
import BentoCard from "@/components/bento-card";
import { AlertOctagon, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  content: string;
  priority: string;
  author_name: string;
  created_at: string;
};

export default function AnnouncementsBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function fetchAnnouncements() {
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      }
    } catch {
      // Non-fatal
    }
  }

  useEffect(() => {
    fetchAnnouncements();

    // Supabase Realtime broadcast listener for instant announcements
    const supabase = createClient();
    const channel = supabase
      .channel("announcements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    const interval = setInterval(fetchAnnouncements, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-4 mb-8 text-left">
      {visible.map((a) => {
        const isUrgent = a.priority === "urgent";
        const Icon = isUrgent ? AlertOctagon : Radio;
        
        return (
          <BentoCard
            key={a.id}
            glowColor={isUrgent ? "danger" : "signal"}
            className={`p-4 md:p-5 flex items-start justify-between gap-4 ${isUrgent ? "bg-red-950/20 border-red-500/40" : "bg-[#00E5FF]/5 border-[#00E5FF]/30"}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${isUrgent ? "text-red-500 animate-pulse" : "text-[#00E5FF]"}`} />
                <span className={`font-mono text-[10px] uppercase tracking-[0.2em] font-bold ${isUrgent ? "text-red-500" : "text-[#00E5FF]"}`}>
                  {isUrgent ? "CRITICAL BROADCAST" : "DISPATCH"}
                </span>
              </div>
              <p className="text-sm md:text-base font-body leading-relaxed text-white/90">{a.content}</p>
              <p className="text-muted text-[10px] font-mono mt-2 uppercase tracking-widest">
                By: {a.author_name} · {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
              className="text-muted hover:text-white transition-colors text-xs font-mono select-none px-2 py-1 rounded hover:bg-white/5"
            >
              [dismiss]
            </button>
          </BentoCard>
        );
      })}
    </div>
  );
}
