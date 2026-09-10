"use client";

import { useState, useEffect } from "react";
import { Radio, AlertOctagon, X, RefreshCw, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  content: string;
  priority: "normal" | "urgent" | string;
  author_name: string;
  created_at: string;
};

export default function AnnouncementsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "urgent" | "normal">("all");

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch announcements", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncements();

    const supabase = createClient();
    const channel = supabase
      .channel("announcements-modal-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
    }
  }, [isOpen]);

  const urgentList = announcements.filter((a) => a.priority === "urgent");
  const normalList = announcements.filter((a) => a.priority !== "urgent");

  const displayedList =
    filter === "urgent"
      ? urgentList
      : filter === "normal"
      ? normalList
      : announcements;

  return (
    <>
      {/* Trigger Button on Dashboard */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative inline-flex items-center gap-2 rounded-xl bg-black/40 border border-[#7DF9FF]/30 hover:border-[#7DF9FF] hover:bg-[#7DF9FF]/10 px-4 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider text-[#7DF9FF] transition-all duration-300 shadow-[0_0_15px_rgba(125,249,255,0.08)] hover:shadow-[0_0_20px_rgba(125,249,255,0.25)] select-none group"
      >
        <Bell className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        <span>ANNOUNCEMENTS</span>
        {urgentList.length > 0 && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0a0f18] p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#7DF9FF]/10 border border-[#7DF9FF]/30 text-[#7DF9FF]">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                    SYSTEM BROADCASTS & DISPATCHES
                  </h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    Official event communications network
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAnnouncements}
                  disabled={loading}
                  className="rounded-lg p-2 text-muted hover:text-white hover:bg-white/5 transition-colors"
                  title="Refresh feeds"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#7DF9FF]" : ""}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-muted hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 pt-4 pb-3 shrink-0 border-b border-white/5">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border ${
                  filter === "all"
                    ? "bg-white/15 border-white/40 text-white font-bold"
                    : "bg-void/40 border-white/10 text-muted hover:text-white hover:border-white/20"
                }`}
              >
                ALL ({announcements.length})
              </button>
              <button
                onClick={() => setFilter("urgent")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                  filter === "urgent"
                    ? "bg-red-500/20 border-red-500/50 text-red-400 font-bold shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                    : "bg-void/40 border-white/10 text-muted hover:text-red-400 hover:border-red-500/30"
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                URGENT ({urgentList.length})
              </button>
              <button
                onClick={() => setFilter("normal")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                  filter === "normal"
                    ? "bg-[#7DF9FF]/20 border-[#7DF9FF]/50 text-[#7DF9FF] font-bold shadow-[0_0_12px_rgba(125,249,255,0.2)]"
                    : "bg-void/40 border-white/10 text-muted hover:text-[#7DF9FF] hover:border-[#7DF9FF]/30"
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-[#7DF9FF]" />
                NORMAL ({normalList.length})
              </button>
            </div>

            {/* Announcement List Body */}
            <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
              {loading && announcements.length === 0 ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#7DF9FF] mx-auto mb-2 opacity-60" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">
                    Decrypting communications frequency...
                  </p>
                </div>
              ) : displayedList.length === 0 ? (
                <div className="py-12 text-center border border-white/5 rounded-xl bg-void/20">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">
                    No {filter !== "all" ? filter : ""} broadcasts active in this frequency.
                  </p>
                </div>
              ) : (
                displayedList.map((item) => {
                  const isUrgent = item.priority === "urgent";
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl p-4 border transition-all duration-200 ${
                        isUrgent
                          ? "bg-red-950/25 border-red-500/40 hover:border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                          : "bg-void/40 border-[#7DF9FF]/20 hover:border-[#7DF9FF]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-mono font-bold uppercase tracking-widest text-red-400">
                              <AlertOctagon className="w-3 h-3 text-red-400" />
                              URGENT BROADCAST
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#7DF9FF]/10 border border-[#7DF9FF]/30 text-[9px] font-mono font-bold uppercase tracking-widest text-[#7DF9FF]">
                              <Radio className="w-3 h-3 text-[#7DF9FF]" />
                              STANDARD DISPATCH
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-muted tracking-wider">
                          {new Date(item.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="font-body text-sm text-white/90 leading-relaxed break-words">
                        {item.content}
                      </p>

                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-muted uppercase tracking-widest">
                        <span>ORIGIN: {item.author_name || "CONTROL HQ"}</span>
                        <span>NET_SEC_ID: {item.id.substring(0, 8)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between shrink-0">
              <span className="font-mono text-[9px] text-muted uppercase tracking-wider">
                ⚡ Realtime broadcast channel active
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="btn-cyber px-4 py-1.5 rounded-lg text-xs uppercase"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
