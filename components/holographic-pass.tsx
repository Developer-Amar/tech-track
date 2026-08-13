"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import StyledQR from "./styled-qr";

/* ═══════════════════════════════════════════════════════════════════
   HOLOGRAPHIC EVENT PASS  v3
   Crisp, high-DPI ID badge with styled QR code, Google avatar,
   role badge, unit status, and live field updates.
   ═══════════════════════════════════════════════════════════════════ */

interface HolographicPassProps {
  name: string;
  email: string;
  avatarUrl?: string;
  mobileNumber: string;
  rollNo: string;
  branch: string;
  semester: string;
  filledCount: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  passCode?: string;
  role?: string;
  unitInfo?: { type: "solo" | "team"; name: string } | null;
}

export default function HolographicPass({
  name,
  email,
  avatarUrl,
  mobileNumber,
  rollNo,
  branch,
  semester,
  filledCount,
  isSubmitting,
  isSuccess,
  isError,
  passCode,
  role,
  unitInfo,
}: HolographicPassProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      const glow = glowRef.current;
      if (!card || !glow) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateY = ((x - cx) / cx) * 6;
      const rotateX = ((cy - y) / cy) * 6;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      glow.style.opacity = "1";
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(125,249,255,0.06) 0%, transparent 60%)`;
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (card) card.style.transform = "";
    if (glow) glow.style.opacity = "0";
  }, []);

  // Decorative bars for pre-registration state
  const barcodeBars = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        key: i,
        width: Math.random() > 0.6 ? 2 : 1,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    []
  );

  // Dynamic styles based on form state
  const borderColor = isError
    ? "rgba(239,68,68,0.6)"
    : isSuccess
    ? "rgba(34,197,94,0.7)"
    : isSubmitting
    ? "rgba(125,249,255,0.5)"
    : filledCount === 4
    ? "rgba(125,249,255,0.35)"
    : filledCount > 0
    ? `rgba(125,249,255,${0.12 + filledCount * 0.06})`
    : "rgba(148,163,184,0.08)";

  const boxShadow = isSuccess
    ? "0 0 60px rgba(34,197,94,0.3), 0 0 120px rgba(34,197,94,0.1)"
    : isError
    ? "0 0 40px rgba(239,68,68,0.25)"
    : filledCount === 4
    ? "0 0 40px rgba(125,249,255,0.1), 0 0 80px rgba(125,249,255,0.03)"
    : "0 16px 48px rgba(0,0,0,0.5)";

  const statusDot = isSuccess
    ? "#22C55E"
    : isError
    ? "#EF4444"
    : isSubmitting
    ? "#7DF9FF"
    : filledCount === 4
    ? "#22C55E"
    : filledCount > 0
    ? "#F59E0B"
    : "#EF4444";

  const statusText = isSuccess
    ? "✓ REGISTERED"
    : isError
    ? "✗ ERROR — RETRY"
    : isSubmitting
    ? "PROCESSING..."
    : filledCount === 4
    ? "PASS READY"
    : filledCount > 0
    ? `BUILDING PASS (${filledCount}/4)`
    : "INCOMPLETE";

  const cardClasses = [
    "holo-card",
    isSuccess && "holo-success",
    isError && "holo-error",
    isSubmitting && "holo-pulse",
  ]
    .filter(Boolean)
    .join(" ");

  const showAvatar = avatarUrl && !imgError;
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const isReady = filledCount === 4;

  return (
    <div className="flex items-center justify-center w-full h-full select-none">
      <style>{`
        .holo-card {
          animation: holoFloat 5s ease-in-out infinite;
          transition: transform 0.15s ease-out, box-shadow 0.4s ease, border-color 0.4s ease;
          will-change: transform;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        @keyframes holoFloat {
          0%, 100% { transform: perspective(800px) translateY(0px); }
          50% { transform: perspective(800px) translateY(-10px); }
        }
        .holo-card:hover { animation-play-state: paused; }
        .holo-success { animation: holoFlip 1.2s ease-in-out forwards !important; }
        @keyframes holoFlip {
          0% { transform: perspective(800px) rotateY(0deg) scale(1); }
          50% { transform: perspective(800px) rotateY(180deg) scale(1.05); }
          100% { transform: perspective(800px) rotateY(360deg) scale(1); }
        }
        .holo-error { animation: holoShake 0.5s ease-in-out !important; }
        @keyframes holoShake {
          0%, 100% { transform: perspective(800px) translateX(0); }
          10%, 50%, 90% { transform: perspective(800px) translateX(-8px); }
          30%, 70% { transform: perspective(800px) translateX(8px); }
        }
        .holo-pulse { animation: holoPulse 1.5s ease-in-out infinite !important; }
        @keyframes holoPulse {
          0%, 100% { border-color: rgba(125,249,255,0.2); }
          50% { border-color: rgba(125,249,255,0.6); }
        }
        .holo-shimmer {
          background: linear-gradient(
            105deg, transparent 20%, rgba(125,249,255,0.03) 30%,
            rgba(167,139,250,0.04) 40%, rgba(255,30,86,0.03) 50%,
            rgba(125,249,255,0.04) 60%, transparent 80%
          );
          background-size: 200% 200%;
          animation: shimmer 4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { background-position: 200% 50%; }
          50% { background-position: 0% 50%; }
        }
        .holo-field-on { color: #e2e8f0; text-shadow: 0 0 6px rgba(125,249,255,0.15); }
        .holo-field-off { color: rgba(148,163,184,0.25); }
        .status-dot {
          animation: statusPulse 2s ease-in-out infinite;
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 8px currentColor; }
        }
        .avatar-ring {
          background: conic-gradient(from 0deg, #7DF9FF, #A78BFA, #FF1E56, #7DF9FF);
          padding: 2px;
          border-radius: 50%;
          display: inline-flex;
        }
      `}</style>

      <div
        ref={cardRef}
        className={cardClasses}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: "340px",
          borderRadius: "18px",
          border: `1px solid ${borderColor}`,
          background: "linear-gradient(170deg, rgba(12,12,24,0.95) 0%, rgba(6,6,14,0.98) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow,
          padding: "28px 24px",
          position: "relative",
          overflow: "hidden",
          cursor: "default",
        }}
      >
        {/* Holographic shimmer overlay */}
        <div
          className="holo-shimmer"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "18px",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Mouse-follow glow */}
        <div
          ref={glowRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "18px",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.3s ease",
            zIndex: 2,
          }}
        />

        {/* Content layer */}
        <div style={{ position: "relative", zIndex: 3 }}>

          {/* ─── Header: TECH TREK ─── */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                background: "#7DF9FF",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-display), monospace",
                fontSize: "16px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#7DF9FF",
                textTransform: "uppercase",
              }}
            >
              TECH TREK
            </span>
          </div>

          <div
            style={{
              height: "1px",
              background: "linear-gradient(to right, rgba(125,249,255,0.3), transparent)",
              marginBottom: "5px",
            }}
          />

          <span
            style={{
              fontFamily: "monospace",
              fontSize: "8px",
              letterSpacing: "0.25em",
              color: "rgba(148,163,184,0.45)",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "14px",
            }}
          >
            EVENT ACCESS PASS
          </span>

          {/* ─── Identity block ─── */}
          <div
            style={{
              background: "rgba(125,249,255,0.02)",
              border: "1px solid rgba(125,249,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            {/* Row: avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div className="avatar-ring" style={{ flexShrink: 0 }}>
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={name}
                    onError={() => setImgError(true)}
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: "rgba(125,249,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display), monospace",
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#7DF9FF",
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontFamily: "var(--font-display), sans-serif",
                    fontSize: "16px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#f1f5f9",
                    margin: 0,
                    lineHeight: 1.25,
                    wordBreak: "break-word",
                  }}
                >
                  {name || "\u2014"}
                </p>
              </div>
            </div>

            {/* Email — full width, never truncated */}
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "rgba(148,163,184,0.6)",
                margin: "10px 0 0",
                lineHeight: 1.3,
                letterSpacing: "0.01em",
                wordBreak: "break-all",
              }}
            >
              {email}
            </p>

            {/* Role + Unit labels */}
            {(role || unitInfo) && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(148,163,184,0.06)",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                {role && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "8px",
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: ROLE_COLORS[role]?.text ?? "#94A3B8",
                    }}
                  >
                    ◆ {ROLE_LABELS[role] ?? role.toUpperCase()}
                  </span>
                )}
                {unitInfo && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "8px",
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "#A78BFA",
                    }}
                  >
                    ◆ {unitInfo.type === "solo" ? "SOLO" : unitInfo.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ─── Data grid ─── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr 0.5fr",
              gap: "0",
              marginBottom: "14px",
            }}
          >
            <DataCell label="ROLL NO" value={rollNo} ready={isReady} />
            <DataCell label="BRANCH" value={branch} ready={isReady} />
            <DataCell label="SEM" value={semester} ready={isReady} />
          </div>

          {/* Mobile */}
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                letterSpacing: "0.2em",
                color: "rgba(148,163,184,0.35)",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "4px",
              }}
            >
              MOBILE
            </span>
            <span
              className={mobileNumber ? "holo-field-on" : "holo-field-off"}
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                letterSpacing: "0.06em",
                transition: "color 0.3s ease",
              }}
            >
              {mobileNumber || "— — — — —"}
            </span>
          </div>

          {/* ─── QR / Decorative area ─── */}
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {passCode ? (
              <>
                <StyledQR
                  data={passCode}
                  size={110}
                  active={isReady}
                />
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.3em",
                    color: isReady ? "#7DF9FF" : "rgba(148,163,184,0.3)",
                    textTransform: "uppercase",
                    transition: "color 0.4s ease",
                  }}
                >
                  {passCode}
                </span>
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "1.5px",
                  height: "28px",
                  width: "100%",
                }}
              >
                {barcodeBars.map((bar) => (
                  <div
                    key={bar.key}
                    style={{
                      width: `${bar.width}px`,
                      height: `${55 + Math.random() * 45}%`,
                      background: isReady
                        ? `rgba(125,249,255,${bar.opacity * 0.8})`
                        : `rgba(148,163,184,${bar.opacity * 0.3})`,
                      borderRadius: "1px",
                      flexShrink: 0,
                      transition: "background 0.6s ease",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── Status bar ─── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(148,163,184,0.05)",
            }}
          >
            <div
              className="status-dot"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: statusDot,
                color: statusDot,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                letterSpacing: "0.2em",
                color: statusDot,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Small helpers ─── */

function DataCell({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "8px",
          letterSpacing: "0.2em",
          color: "rgba(148,163,184,0.35)",
          textTransform: "uppercase",
          display: "block",
          marginBottom: "4px",
        }}
      >
        {label}
      </span>
      <span
        className={value ? "holo-field-on" : "holo-field-off"}
        style={{
          fontFamily: "monospace",
          fontSize: "14px",
          letterSpacing: "0.04em",
          transition: "color 0.3s ease",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

const ROLE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  super_admin: { text: "#FCD34D", bg: "rgba(252,211,77,0.06)", border: "rgba(252,211,77,0.18)" },
  admin: { text: "#7DF9FF", bg: "rgba(125,249,255,0.06)", border: "rgba(125,249,255,0.18)" },
  checkpoint_staff: { text: "#6EE7B7", bg: "rgba(110,231,183,0.06)", border: "rgba(110,231,183,0.18)" },
  participant: { text: "#94A3B8", bg: "rgba(148,163,184,0.04)", border: "rgba(148,163,184,0.12)" },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "SUPER ADMIN",
  admin: "ADMIN",
  checkpoint_staff: "CHECKPOINT STAFF",
  participant: "PARTICIPANT",
};
