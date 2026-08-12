"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";

/* ═══════════════════════════════════════════════════════════════════
   BARCODE SCANNER
   Camera-based barcode scanner for checkpoint staff & admin.
   Scans Code128 barcodes from event passes and fetches user data.
   ═══════════════════════════════════════════════════════════════════ */

type ScannedUser = {
  id: string;
  name: string;
  email: string;
  mobile_number: string;
  roll_no: string;
  branch: string;
  semester: number;
  role: string;
  avatar_url: string | null;
  pass_code: string;
  created_at: string;
};

type ScanResult = {
  valid: boolean;
  user: ScannedUser;
  unit: {
    id: string;
    name: string;
    unit_type: string;
    locked: boolean;
    disqualified: boolean;
    disqualified_reason: string | null;
  } | null;
  teamMembers: { name: string; email: string; pass_code: string | null }[];
  roundProgress: {
    checkpoint_id: string;
    status: string;
    completed_at: string | null;
  }[];
  scannedAt: string;
};

export default function BarcodeScanner() {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "barcode-scanner-viewport";

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const lookupCode = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/scan?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Lookup failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error — check connection");
    } finally {
      setLoading(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 2.0,
        },
        async (decodedText) => {
          // Stop scanning after first successful read
          await scanner.stop().catch(() => {});
          setScanning(false);
          lookupCode(decodedText);
        },
        () => {
          // Scan error (expected while searching) — ignore
        }
      );
    } catch (err: any) {
      setError("Camera access denied or not available");
      setScanning(false);
    }
  }, [lookupCode]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(() => {});
    }
    setScanning(false);
  }, []);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      lookupCode(manualCode.trim().toUpperCase());
    }
  };

  return (
    <div className="space-y-4">
      {/* Scanner controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex items-center justify-center gap-2 btn-cyber px-4 py-2.5 rounded-lg text-xs uppercase font-display flex-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10"
              />
            </svg>
            SCAN BARCODE
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="flex items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-danger text-xs uppercase font-display flex-1 hover:bg-danger/15 transition-all"
          >
            STOP SCANNER
          </button>
        )}

        {/* Manual code entry */}
        <form onSubmit={handleManualLookup} className="flex gap-2 flex-1">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="TYPE CODE..."
            maxLength={8}
            className="flex-1 rounded-lg border border-signal/20 bg-void/40 px-3 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all uppercase tracking-widest text-center"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || loading}
            className="btn-cyber-outline px-4 py-2.5 rounded-lg text-xs uppercase font-display disabled:opacity-30"
          >
            LOOKUP
          </button>
        </form>
      </div>

      {/* Camera viewport */}
      {scanning && (
        <div className="rounded-xl overflow-hidden border border-signal/20 bg-void/60">
          <div id={scannerDivId} style={{ width: "100%" }} />
          <p className="text-center text-dormant text-[9px] font-mono uppercase tracking-widest py-2 animate-pulse">
            Point camera at barcode on event pass...
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-6">
          <div className="inline-block w-6 h-6 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
          <p className="text-dormant text-xs font-mono mt-2">SCANNING DATABASE...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-danger text-xs font-mono">✗ {error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-signal/20 bg-void/30 overflow-hidden">
          {/* User header */}
          <div className="p-4 border-b border-signal/10 flex items-center gap-3">
            {result.user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.user.avatar_url}
                alt={result.user.name}
                className="w-10 h-10 rounded-full border border-signal/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-signal/10 flex items-center justify-center text-signal font-display font-bold text-sm">
                {result.user.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-text font-display font-bold text-lg uppercase truncate">
                {result.user.name}
              </p>
              <p className="text-dormant font-mono text-[10px] truncate">
                {result.user.email}
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono uppercase px-2 py-0.5">
                ✓ VERIFIED
              </span>
            </div>
          </div>

          {/* User details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-dormant/5">
            <DetailCell label="Roll No" value={result.user.roll_no} />
            <DetailCell label="Branch" value={result.user.branch} />
            <DetailCell label="Sem" value={String(result.user.semester)} />
            <DetailCell label="Mobile" value={result.user.mobile_number} />
          </div>

          {/* Team info */}
          {result.unit && (
            <div className="border-t border-signal/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-signal font-semibold">
                  {result.unit.unit_type === "solo" ? "SOLO" : "TEAM"}: {result.unit.name}
                </span>
                <div className="flex gap-2">
                  {result.unit.locked && (
                    <span className="text-[8px] font-mono uppercase bg-signal/10 text-signal px-1.5 py-0.5 rounded">
                      LOCKED
                    </span>
                  )}
                  {result.unit.disqualified && (
                    <span className="text-[8px] font-mono uppercase bg-danger/10 text-danger px-1.5 py-0.5 rounded">
                      DQ
                    </span>
                  )}
                </div>
              </div>

              {/* Team members */}
              {result.teamMembers.length > 1 && (
                <div className="space-y-1 mb-3">
                  {result.teamMembers.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[10px] font-mono text-dormant"
                    >
                      <span className={m.email === result.user.email ? "text-signal" : ""}>
                        {m.name}
                      </span>
                      <span className="text-dormant/40">{m.pass_code || "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Round progress */}
              {result.roundProgress.length > 0 && (
                <div className="border-t border-dormant/10 pt-2 mt-2">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-dormant/50 block mb-1.5">
                    CHECKPOINT PROGRESS
                  </span>
                  <div className="flex gap-1.5">
                    {result.roundProgress.map((rp, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full ${
                          rp.status === "completed"
                            ? "bg-emerald-500/60"
                            : rp.status === "in_progress"
                            ? "bg-amber-500/60 animate-pulse"
                            : "bg-dormant/15"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result.unit && (
            <div className="border-t border-dormant/10 p-4">
              <p className="text-amber-500 text-[10px] font-mono uppercase">
                ⚠ No team/solo unit assigned yet
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-void/30 p-3">
      <span className="text-[8px] font-mono uppercase tracking-wider text-dormant/50 block mb-0.5">
        {label}
      </span>
      <span className="text-text font-mono text-xs">{value}</span>
    </div>
  );
}
