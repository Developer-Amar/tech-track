"use client";

import { useState, useEffect } from "react";
import BarcodeScanner from "@/components/barcode-scanner";
import { QrCode, Search, Key, ChevronDown, ChevronUp } from "lucide-react";

type CodeEntry = {
  unit_name: string;
  unit_type: string;
  round_number: number;
  location_name: string;
  secret_code: string;
};

export default function CheckpointCodesPanel({
  showScanner = true,
}: {
  showScanner?: boolean;
}) {
  const [codes, setCodes] = useState<CodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRound, setFilterRound] = useState<number | null>(null);
  const [scannerExpanded, setScannerExpanded] = useState(true);

  useEffect(() => {
    fetch("/api/admin/codes")
      .then((res) => res.json())
      .then((data) => {
        setCodes(data.codes ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const rounds = Array.from(new Set(codes.map((c) => c.round_number))).sort();

  const filtered = codes.filter((c) => {
    const matchesSearch =
      !search ||
      c.unit_name.toLowerCase().includes(search.toLowerCase()) ||
      c.secret_code.toLowerCase().includes(search.toLowerCase()) ||
      c.location_name.toLowerCase().includes(search.toLowerCase());
    const matchesRound = filterRound === null || c.round_number === filterRound;
    return matchesSearch && matchesRound;
  });

  const grouped = new Map<string, CodeEntry[]>();
  for (const c of filtered) {
    const key = c.unit_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  return (
    <div className="space-y-6 text-left">
      {/* ── Optional Inbuilt Pass Scanner ───────────────────────────── */}
      {showScanner && (
        <div className="glass-panel border-signal/25 bg-panel/40 p-5 rounded-2xl shadow-[0_0_25px_rgba(125,249,255,0.05)]">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-signal" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-signal font-semibold">
                INBUILT QR SCANNER & AUTO-ADVANCE
              </span>
            </div>
            <button
              onClick={() => setScannerExpanded(!scannerExpanded)}
              className="flex items-center gap-1 text-[10px] font-mono text-dormant hover:text-text uppercase tracking-wider transition-colors cursor-pointer"
            >
              {scannerExpanded ? (
                <>
                  <span>COLLAPSE SCANNER</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>EXPAND SCANNER</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {scannerExpanded && <BarcodeScanner />}
        </div>
      )}

      {/* ── Manual Codes Directory ────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[9px] uppercase text-signal tracking-widest mb-1.5 font-semibold flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-signal" />
            CHECKPOINT VERIFICATION PROTOCOL
          </p>
          <h3 className="font-display text-3xl font-extrabold text-white uppercase mb-1">
            CHECKPOINT MASTER KEYS
          </h3>
          <p className="text-dormant text-xs font-body mb-5 leading-relaxed">
            All registered squad verification codes per round. Search by team name or code to assist participants manually.
          </p>
        </div>

        {loading ? (
          <div className="glass-panel border-signal/15 bg-panel/30 p-8 rounded-2xl text-center">
            <p className="text-dormant text-sm font-mono animate-pulse uppercase tracking-wider">
              [Loading verification keys...]
            </p>
          </div>
        ) : codes.length === 0 ? (
          <div className="glass-panel border-signal/20 rounded-2xl p-6 text-left">
            <h4 className="font-display text-2xl font-bold text-text uppercase mb-2">
              Checkpoint Codes
            </h4>
            <p className="text-dormant text-sm font-mono uppercase tracking-widest font-semibold">
              🔐 No codes generated yet. Finalize team rosters and close registration to generate unique checkpoint codes.
            </p>
          </div>
        ) : (
          <>
            {/* Search + Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:flex-1">
                <Search className="w-4 h-4 text-dormant absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by team name, location, or secret code..."
                  className="w-full rounded-lg border border-signal/20 bg-void/50 pl-10 pr-4 py-2.5 text-text font-body text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all duration-300"
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  onClick={() => setFilterRound(null)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-mono tracking-wider transition-all uppercase font-semibold ${
                    filterRound === null
                      ? "bg-signal/25 border border-signal text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                      : "bg-void border border-dormant/20 text-dormant hover:border-dormant/40 hover:text-text"
                  }`}
                >
                  ALL
                </button>
                {rounds.map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilterRound(r)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-mono tracking-wider transition-all uppercase font-semibold ${
                      filterRound === r
                        ? "bg-signal/25 border border-signal text-signal shadow-[0_0_8px_rgba(255,30,86,0.15)]"
                        : "bg-void border border-dormant/20 text-dormant hover:border-dormant/40 hover:text-text"
                    }`}
                  >
                    R0{r}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mt-2 font-semibold">
              Showing {grouped.size} squad{grouped.size !== 1 ? "s" : ""} · {filtered.length} key{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Grouped Team Cards */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {Array.from(grouped.entries()).map(([unitName, entries]) => (
                <div
                  key={unitName}
                  className="rounded-xl border border-dormant/15 bg-void/40 px-4 py-3.5 relative overflow-hidden transition-all duration-300 hover:border-signal/25"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-dormant/10 pb-2">
                    <p className="text-text font-display text-lg uppercase tracking-wide font-bold">
                      {unitName}
                    </p>
                    <span className="rounded bg-void/60 border border-dormant/15 px-2 py-0.5 text-[9px] font-mono text-dormant uppercase tracking-wider font-semibold">
                      {entries[0].unit_type}
                    </span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {entries
                      .sort((a, b) => a.round_number - b.round_number)
                      .map((entry) => (
                        <div
                          key={`${unitName}-${entry.round_number}`}
                          className="flex items-center gap-3 rounded-lg border border-signal/15 bg-void/50 px-3 py-2 shadow-[0_0_8px_rgba(255,30,86,0.05)]"
                        >
                          <div className="text-left">
                            <p className="text-dormant text-[8px] font-mono uppercase tracking-widest leading-none mb-0.5 font-semibold">
                              ROUND 0{entry.round_number}
                            </p>
                            <p className="text-text font-mono text-[9px] max-w-[120px] truncate leading-none uppercase">
                              {entry.location_name}
                            </p>
                          </div>
                          <span className="text-signal font-mono text-base font-bold tracking-widest border-l border-dormant/20 pl-3">
                            {entry.secret_code}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
