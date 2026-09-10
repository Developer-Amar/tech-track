"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Zap,
  Users,
  QrCode,
  Volume2,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED PASS SCANNER & AUTO-VERIFICATION ECOSYSTEM
   For Checkpoint Staff, Admins, and Super Admins.
   • Scans ID pass QR of ANY team member (leader or member)
   • Resolves team roster, active round, and secret outpost code
   • Auto-advances the team immediately if Auto-Verify is toggled ON
   • Features Outpost Mismatch protection & manual fallback controls
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

type RoundInfo = {
  round_number: number;
  checkpoint_id: string;
  location_name: string;
  secret_code: string | null;
  status: string;
  points: number;
  completed_at: string | null;
  is_active: boolean;
};

type ActiveRound = {
  round_number: number;
  checkpoint_id: string;
  location_name: string;
  secret_code: string | null;
  status: string;
  canVerify: boolean;
  isVerified: boolean;
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
  teamMembers: {
    name: string;
    email: string;
    pass_code: string | null;
    roll_no?: string;
    branch?: string;
    semester?: number;
  }[];
  rounds: RoundInfo[];
  activeRound: ActiveRound | null;
  allRoundsCompleted: boolean;
  scannedAt: string;
};

/**
 * Web Audio sound effects (synthesized on-the-fly, no asset network lag).
 */
function playAudioTone(type: "scan" | "success" | "warn") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "warn") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.setValueAtTime(190, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Short scan blip
      osc.type = "sine";
      osc.frequency.setValueAtTime(950, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // AudioContext blocked by policy
  }
}

export default function BarcodeScanner({
  initialOutpost,
}: {
  initialOutpost?: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState<string | null>(null);
  const [autoVerify, setAutoVerify] = useState(true);
  const [selectedOutpost, setSelectedOutpost] = useState<string>(
    initialOutpost || "ALL"
  );
  const [availableOutposts, setAvailableOutposts] = useState<
    { round: number; location: string }[]
  >([]);
  const [copiedCode, setCopiedCode] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "barcode-scanner-viewport";

  // Fetch available checkpoints from codes API if available
  useEffect(() => {
    fetch("/api/admin/codes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.codes && Array.isArray(data.codes)) {
          const map = new Map<number, string>();
          for (const item of data.codes) {
            if (item.round_number && item.location_name) {
              map.set(item.round_number, item.location_name);
            }
          }
          const outposts = Array.from(map.entries())
            .map(([round, location]) => ({ round, location }))
            .sort((a, b) => a.round - b.round);
          setAvailableOutposts(outposts);
        }
      })
      .catch(() => {});
  }, []);

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Auto-Advance / Verify Team Action ─────────────────────────────────
  const verifyTeamAtCheckpoint = useCallback(
    async (unitId: string, checkpointId: string, roundNumber?: number) => {
      setVerifying(true);
      setVerifySuccessMsg(null);
      setError(null);

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit_id: unitId,
            checkpoint_id: checkpointId,
            round: roundNumber,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          playAudioTone("warn");
          setError(data.error || data.message || "Failed to verify checkpoint.");
          return;
        }

        playAudioTone("success");
        setVerifySuccessMsg(
          data.message ||
            "⚡ Checkpoint verified! Team has advanced to Coding Challenge."
        );

        // Update local result state so badge reflects completion immediately
        setResult((prev) => {
          if (!prev) return null;
          const updatedRounds = prev.rounds.map((r) =>
            r.checkpoint_id === checkpointId
              ? { ...r, status: "checkpoint_done", points: Math.max(r.points, 20) }
              : r
          );
          const updatedActive = prev.activeRound
            ? {
                ...prev.activeRound,
                status: "checkpoint_done",
                canVerify: false,
                isVerified: true,
              }
            : null;

          return {
            ...prev,
            rounds: updatedRounds,
            activeRound: updatedActive,
          };
        });
      } catch {
        playAudioTone("warn");
        setError("Network error while verifying team.");
      } finally {
        setVerifying(false);
      }
    },
    []
  );

  // ── Lookup Pass Code and Apply Auto-Verification ─────────────────────
  const lookupCode = useCallback(
    async (code: string, triggeredByCamera = false) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setVerifySuccessMsg(null);

      try {
        const res = await fetch(`/api/scan?code=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          playAudioTone("warn");
          setError(data.error || `Invalid pass code: "${code}"`);
          return;
        }

        // Play scan beep
        playAudioTone("scan");
        setResult(data);

        // Populate available outposts if not yet populated
        if (data.rounds && data.rounds.length > 0) {
          const outposts = data.rounds.map((r: RoundInfo) => ({
            round: r.round_number,
            location: r.location_name,
          }));
          setAvailableOutposts((prev) =>
            prev.length >= outposts.length ? prev : outposts
          );
        }

        // ── Auto-Verify Logic ──
        if (autoVerify && data.unit && data.activeRound) {
          const activeCp = data.activeRound;

          // Check if station filter is set to a specific round
          if (selectedOutpost !== "ALL") {
            const selectedRoundNum = parseInt(selectedOutpost, 10);
            if (activeCp.round_number !== selectedRoundNum) {
              playAudioTone("warn");
              setError(
                `⚠️ OUTPOST MISMATCH: Team is currently on Round ${activeCp.round_number} (${activeCp.location_name}), but this scanner is locked to Round ${selectedRoundNum}. Team was NOT auto-advanced.`
              );
              return;
            }
          }

          // If eligible to verify and not already verified
          if (activeCp.canVerify && !activeCp.isVerified) {
            await verifyTeamAtCheckpoint(
              data.unit.id,
              activeCp.checkpoint_id,
              activeCp.round_number
            );
          }
        }
      } catch {
        playAudioTone("warn");
        setError("Network failure — check server connection.");
      } finally {
        setLoading(false);
      }
    },
    [autoVerify, selectedOutpost, verifyTeamAtCheckpoint]
  );

  // ── Camera Scanner Controls ──────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScanning(true);
    setResult(null);
    setError(null);
    setVerifySuccessMsg(null);

    try {
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Stop camera after successful detection
          await scanner.stop().catch(() => {});
          setScanning(false);
          lookupCode(decodedText, true);
        },
        () => {
          // Frame scan miss (normal during scanning)
        }
      );
    } catch {
      setError("Camera access denied or device has no accessible camera.");
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
      lookupCode(manualCode.trim().toUpperCase(), false);
    }
  };

  const copySecretCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-4 text-left">
      {/* HUD Header Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border border-signal/20 bg-void/60 backdrop-blur-md">
        {/* Station Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-dormant shrink-0">
            STATION OUTPOST:
          </label>
          <select
            value={selectedOutpost}
            onChange={(e) => setSelectedOutpost(e.target.value)}
            className="rounded-lg border border-signal/30 bg-void px-3 py-1.5 text-text font-mono text-xs focus:border-signal focus:outline-none transition-all"
          >
            <option value="ALL">🌐 ALL OUTPOSTS (FLOATING ADMIN)</option>
            {availableOutposts.map((op) => (
              <option key={op.round} value={String(op.round)}>
                ROUND 0{op.round} — {op.location}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-Verify on Scan Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoVerify}
            onChange={(e) => setAutoVerify(e.target.checked)}
            className="w-4 h-4 rounded border-signal/30 text-signal focus:ring-0 focus:ring-offset-0 bg-void accent-[#FF1E56] cursor-pointer"
          />
          <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${autoVerify ? "text-signal animate-pulse" : "text-dormant"}`} />
            AUTO-VERIFY ON SCAN
          </span>
        </label>
      </div>

      {/* Camera Trigger & Manual Input Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex items-center justify-center gap-2 btn-cyber px-4 py-3 rounded-lg text-xs uppercase font-display flex-1 shadow-[0_0_15px_rgba(255,30,86,0.15)]"
          >
            <Camera className="w-4 h-4" />
            START CAMERA SCANNER
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="flex items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger text-xs uppercase font-display flex-1 hover:bg-danger/20 transition-all"
          >
            <CameraOff className="w-4 h-4" />
            STOP CAMERA SCANNER
          </button>
        )}

        {/* Manual code input fallback */}
        <form onSubmit={handleManualLookup} className="flex gap-2 flex-1">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="TYPE PASS CODE (e.g. 7A8B9C10)..."
            maxLength={12}
            className="flex-1 rounded-lg border border-signal/25 bg-void/50 px-3.5 py-2.5 text-text font-mono text-sm focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal/30 transition-all uppercase tracking-widest text-center shadow-inner"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || loading}
            className="btn-cyber-outline px-4 py-2.5 rounded-lg text-xs uppercase font-display disabled:opacity-30 shrink-0"
          >
            LOOKUP
          </button>
        </form>
      </div>

      {/* Camera Viewport */}
      {scanning && (
        <div className="rounded-xl overflow-hidden border border-signal/30 bg-void/80 relative shadow-[0_0_25px_rgba(125,249,255,0.08)]">
          <div id={scannerDivId} style={{ width: "100%", minHeight: "260px" }} />
          <div className="p-2.5 bg-void/90 border-t border-signal/15 text-center flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-signal animate-ping" />
            <p className="text-dormant text-[10px] font-mono uppercase tracking-widest">
              AIM AT QR CODE ON PARTICIPANT ID PASS...
            </p>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-6 glass-panel rounded-xl border border-signal/20">
          <Loader2 className="w-6 h-6 text-signal animate-spin mx-auto mb-2" />
          <p className="text-dormant text-xs font-mono uppercase tracking-widest">
            LOOKING UP PARTICIPANT & TEAM STATUS...
          </p>
        </div>
      )}

      {/* Error / Warning Alert */}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-danger font-mono text-xs font-semibold uppercase tracking-wider">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Verification Success Toast */}
      {verifySuccessMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3 animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider">
              {verifySuccessMsg}
            </p>
          </div>
        </div>
      )}

      {/* Detailed Result Card */}
      {result && (
        <div className="rounded-2xl border border-signal/25 bg-panel/50 overflow-hidden shadow-[0_0_30px_rgba(125,249,255,0.05)] text-left">
          {/* Attendee Profile Header */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-void/40">
            <div className="flex items-center gap-3">
              {result.user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.user.avatar_url}
                  alt={result.user.name}
                  className="w-12 h-12 rounded-full border border-signal/30 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center text-signal font-display font-bold text-base">
                  {result.user.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <div>
                <p className="text-white font-display text-xl font-extrabold uppercase tracking-wide">
                  {result.user.name}
                </p>
                <p className="text-dormant font-mono text-xs">
                  {result.user.email} · PASS: <span className="text-signal font-bold">{result.user.pass_code}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-signal/10 border border-signal/25 text-signal text-[9px] font-mono uppercase px-2.5 py-1 font-semibold">
                ROLE: {result.user.role?.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Attendee Academic Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 border-b border-white/5">
            <DetailItem label="Roll Number" value={result.user.roll_no || "—"} />
            <DetailItem label="Department" value={result.user.branch || "—"} />
            <DetailItem label="Semester" value={String(result.user.semester || "—")} />
            <DetailItem label="Mobile" value={result.user.mobile_number || "—"} />
          </div>

          {/* Team and Active Outpost Section */}
          {result.unit ? (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-dormant text-[9px] font-mono uppercase tracking-widest block mb-0.5">
                    ASSIGNED SQUAD
                  </span>
                  <p className="text-white font-display text-2xl font-bold uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-5 h-5 text-signal" />
                    {result.unit.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded bg-void/60 border border-white/10 px-2 py-1 text-[10px] font-mono text-text uppercase">
                    TYPE: {result.unit.unit_type}
                  </span>
                  {result.unit.locked && (
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                      ROSTER LOCKED
                    </span>
                  )}
                  {result.unit.disqualified && (
                    <span className="rounded bg-danger/10 border border-danger/30 px-2 py-1 text-[10px] font-mono text-danger uppercase font-semibold">
                      DISQUALIFIED
                    </span>
                  )}
                </div>
              </div>

              {/* Active Checkpoint HUD Card */}
              {result.activeRound ? (
                <div className="rounded-xl border border-signal/30 bg-signal/5 p-4 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-signal/20 border border-signal/40 px-2 py-0.5 text-[9px] font-mono text-signal font-bold uppercase tracking-wider">
                          ACTIVE ROUND 0{result.activeRound.round_number}
                        </span>
                        <span className="text-dormant font-mono text-xs uppercase tracking-wider">
                          TARGET: {result.activeRound.location_name}
                        </span>
                      </div>

                      {/* Secret code display */}
                      <div className="pt-2">
                        <span className="text-[9px] font-mono uppercase text-dormant tracking-wider block mb-1">
                          STATION SECRET CODE:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xl md:text-3xl font-extrabold tracking-widest text-signal select-all bg-void/60 border border-signal/30 px-3 py-1 rounded-lg">
                            {result.activeRound.secret_code || "UNSET"}
                          </span>
                          {result.activeRound.secret_code && (
                            <button
                              onClick={() =>
                                copySecretCode(result.activeRound!.secret_code!)
                              }
                              className="btn-cyber-outline px-3 py-2 rounded-lg text-[10px] font-mono uppercase flex items-center gap-1.5"
                            >
                              {copiedCode ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>COPIED!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>COPY</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification Status & Manual Trigger */}
                    <div className="flex flex-col items-start md:items-end justify-center gap-2">
                      {result.activeRound.isVerified ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold uppercase">
                          <CheckCircle2 className="w-4 h-4" />
                          CHECKPOINT VERIFIED (ON CODE STAGE)
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            verifyTeamAtCheckpoint(
                              result.unit!.id,
                              result.activeRound!.checkpoint_id,
                              result.activeRound!.round_number
                            )
                          }
                          disabled={verifying}
                          className="btn-cyber px-5 py-3 rounded-xl text-xs uppercase font-display flex items-center gap-2 shadow-[0_0_20px_rgba(255,30,86,0.25)] hover:scale-105 transition-all"
                        >
                          {verifying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              VERIFYING & ADVANCING...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 text-white" />
                              VERIFY & ADVANCE TEAM
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : result.allRoundsCompleted ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-emerald-300 font-display font-bold text-lg uppercase">
                    ALL ROUNDS COMPLETED!
                  </p>
                  <p className="text-dormant font-mono text-xs">
                    This team has finished all rounds of the competition.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-void/40 p-4 text-center">
                  <p className="text-dormant font-mono text-xs uppercase">
                    No active round available or registration not finalized.
                  </p>
                </div>
              )}

              {/* Teammates Roster */}
              {result.teamMembers && result.teamMembers.length > 0 && (
                <div className="pt-2">
                  <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mb-2 font-semibold">
                    TEAM MEMBERS ({result.teamMembers.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.teamMembers.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono ${
                          m.email === result.user.email
                            ? "bg-signal/10 border-signal/30 text-white"
                            : "bg-void/40 border-white/5 text-dormant"
                        }`}
                      >
                        <span className="truncate max-w-[150px] font-medium">
                          {m.name} {m.email === result.user.email && "(Scanned)"}
                        </span>
                        <span className="text-[10px] text-signal font-bold shrink-0">
                          {m.pass_code || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Rounds Mini HUD */}
              {result.rounds && result.rounds.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-dormant text-[9px] font-mono uppercase tracking-widest mb-2 font-semibold">
                    ROUND PROGRESSION OVERVIEW
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {result.rounds.map((r) => (
                      <div
                        key={r.checkpoint_id}
                        className={`p-2.5 rounded-lg border text-left ${
                          r.is_active
                            ? "bg-signal/10 border-signal/40 shadow-[0_0_10px_rgba(255,30,86,0.1)]"
                            : r.status === "passed" || r.status === "skipped"
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-void/40 border-white/5 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono font-bold uppercase text-white">
                            R0{r.round_number}
                          </span>
                          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${
                            r.status === "checkpoint_done"
                              ? "bg-signal/20 text-signal"
                              : r.status === "passed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/5 text-dormant"
                          }`}>
                            {r.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-dormant text-[10px] truncate uppercase">
                          {r.location_name}
                        </p>
                        <p className="text-white font-mono text-xs font-bold tracking-wider mt-1">
                          {r.secret_code || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center border-t border-white/5">
              <p className="text-amber-400 font-mono text-xs uppercase tracking-wider">
                ⚠️ THIS PARTICIPANT IS NOT YET ASSIGNED TO ANY SQUAD/TEAM.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-void/40 p-3">
      <span className="text-[8px] font-mono uppercase tracking-wider text-dormant/60 block mb-0.5">
        {label}
      </span>
      <span className="text-text font-mono text-xs truncate block">{value}</span>
    </div>
  );
}
