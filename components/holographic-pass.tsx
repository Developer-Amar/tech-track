"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import StyledQR from "./styled-qr";

/* ═══════════════════════════════════════════════════════════════════
   HOLOGRAPHIC EVENT PASS
   A floating 3D-tilt ID badge with styled QR code, Google avatar,
   and live field updates. Pure CSS + JS animations.
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
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 24;
      const rotateX = -(y - 0.5) * 24;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      glow.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(125,249,255,0.25) 0%, transparent 60%)`;
      glow.style.opacity = "1";
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (card) card.style.transform = "";
    if (glow) glow.style.opacity = "0";
  }, []);

  // Decorative barcode (used when no passCode yet)
  const barcodeBars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        width: Math.random() > 0.5 ? 3 : 1.5,
        opacity: 0.3 + Math.random() * 0.5,
        key: i,
      })),
    []
  );

  // Dynamic styles
  const borderColor = isError
    ? "rgba(239,68,68,0.6)"
    : isSuccess
    ? "rgba(34,197,94,0.7)"
    : isSubmitting
    ? "rgba(125,249,255,0.5)"
    : filledCount === 4
    ? "rgba(125,249,255,0.5)"
    : filledCount > 0
    ? `rgba(125,249,255,${0.12 + filledCount * 0.08})`
    : "rgba(148,163,184,0.1)";

  const boxShadow = isSuccess
    ? "0 0 60px rgba(34,197,94,0.3), 0 0 120px rgba(34,197,94,0.1)"
    : isError
    ? "0 0 40px rgba(239,68,68,0.25)"
    : filledCount === 4
    ? "0 0 50px rgba(125,249,255,0.15), 0 0 100px rgba(125,249,255,0.05)"
    : "0 20px 60px rgba(0,0,0,0.5)";

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

  // Avatar: Google profile photo or initials
  const showAvatar = avatarUrl && !imgError;
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex items-center justify-center w-full h-full select-none">
      <style>{`
        .holo-card {
          animation: holoFloat 5s ease-in-out infinite;
          transition: transform 0.15s ease-out, box-shadow 0.4s ease, border-color 0.4s ease;
          will-change: transform;
        }
        @keyframes holoFloat {
          0%, 100% { transform: perspective(800px) translateY(0px); }
          50% { transform: perspective(800px) translateY(-12px); }
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
        .holo-field-filled {
          color: #e2e8f0;
          text-shadow: 0 0 8px rgba(125,249,255,0.2);
        }
        .holo-field-empty { color: rgba(148,163,184,0.25); }
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
        }
      `}</style>

      <div
        ref={cardRef}
        className={cardClasses}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: "320px",
          borderRadius: "16px",
          border: `1.5px solid ${borderColor}`,
          background: "rgba(8, 8, 18, 0.88)",
          backdropFilter: "blur(16px)",
          boxShadow,
          padding: "24px 22px",
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
            borderRadius: "16px",
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
            borderRadius: "16px",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.3s ease",
            zIndex: 2,
          }}
        />

        {/* Card content */}
        <div style={{ position: "relative", zIndex: 3 }}>
          {/* Header */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  background: "#7DF9FF",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-display), monospace",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
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
                background:
                  "linear-gradient(to right, rgba(125,249,255,0.4), transparent)",
                marginBottom: "6px",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                letterSpacing: "0.25em",
                color: "rgba(148,163,184,0.5)",
                textTransform: "uppercase",
              }}
            >
              EVENT ACCESS PASS
            </span>
          </div>

          {/* Avatar + Name + Role block */}
          <div
            style={{
              background: "rgba(125,249,255,0.03)",
              border: "1px solid rgba(125,249,255,0.08)",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            {/* Top: Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              {/* Profile photo */}
              <div className="avatar-ring" style={{ flexShrink: 0 }}>
                {showAvatar ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    onError={() => setImgError(true)}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(125,249,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display), monospace",
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#7DF9FF",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Name only */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontFamily: "var(--font-display), sans-serif",
                    fontSize: "15px",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                    color: "#e2e8f0",
                    margin: 0,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {name || "\u2014"}
                </p>
              </div>
            </div>

            {/* Email — full width below avatar row */}
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "rgba(148,163,184,0.7)",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "0.02em",
              }}
            >
              {email}
            </p>

            {/* Role + Unit badges */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              {role && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: getRoleBadgeColor(role),
                    background: getRoleBadgeBg(role),
                    border: `1px solid ${getRoleBadgeColor(role)}33`,
                    borderRadius: "4px",
                    padding: "3px 8px",
                  }}
                >
                  {formatRole(role)}
                </span>
              )}
              {unitInfo && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#A78BFA",
                    background: "rgba(167,139,250,0.08)",
                    border: "1px solid rgba(167,139,250,0.2)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                  }}
                >
                  {unitInfo.type === "solo" ? "SOLO" : `TEAM: ${unitInfo.name}`}
                </span>
              )}
            </div>
          </div>

          {/* Data fields row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "2px",
              marginBottom: "12px",
            }}
          >
            <FieldCell label="ROLL NO" value={rollNo} placeholder="—" />
            <FieldCell label="BRANCH" value={branch} placeholder="—" />
            <FieldCell label="SEM" value={semester} placeholder="—" />
          </div>

          {/* Mobile row */}
          <div style={{ marginBottom: "14px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                letterSpacing: "0.2em",
                color: "rgba(148,163,184,0.4)",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "3px",
              }}
            >
              MOBILE
            </span>
            <span
              className={
                mobileNumber ? "holo-field-filled" : "holo-field-empty"
              }
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                letterSpacing: "0.08em",
                transition: "color 0.3s ease, text-shadow 0.3s ease",
              }}
            >
              {mobileNumber || "— — — — —"}
            </span>
          </div>

          {/* QR Code: Styled (if passCode) or decorative dots */}
          <div
            style={{
              marginBottom: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {passCode ? (
              <>
                <StyledQR
                  data={passCode}
                  size={90}
                  active={filledCount === 4}
                />
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.25em",
                    color: filledCount === 4 ? "#7DF9FF" : "rgba(148,163,184,0.4)",
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
                      background:
                        filledCount === 4
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

          {/* Status bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingTop: "10px",
              borderTop: "1px solid rgba(148,163,184,0.06)",
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

/* ─── Small helper: labelled data cell ─── */
function FieldCell({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder: string;
}) {
  return (
    <div style={{ padding: "6px 0" }}>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "8px",
          letterSpacing: "0.2em",
          color: "rgba(148,163,184,0.4)",
          textTransform: "uppercase",
          display: "block",
          marginBottom: "3px",
        }}
      >
        {label}
      </span>
      <span
        className={value ? "holo-field-filled" : "holo-field-empty"}
        style={{
          fontFamily: "monospace",
          fontSize: "13px",
          letterSpacing: "0.05em",
          transition: "color 0.3s ease, text-shadow 0.3s ease",
        }}
      >
        {value || placeholder}
      </span>
    </div>
  );
}

/* ─── Role badge color helpers ─── */
function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "super_admin": return "#F59E0B";
    case "admin": return "#7DF9FF";
    case "checkpoint_staff": return "#34D399";
    default: return "#94A3B8";
  }
}

function getRoleBadgeBg(role: string): string {
  switch (role) {
    case "super_admin": return "rgba(245,158,11,0.08)";
    case "admin": return "rgba(125,249,255,0.08)";
    case "checkpoint_staff": return "rgba(52,211,153,0.08)";
    default: return "rgba(148,163,184,0.06)";
  }
}

function formatRole(role: string): string {
  switch (role) {
    case "super_admin": return "SUPER ADMIN";
    case "admin": return "ADMIN";
    case "checkpoint_staff": return "CHECKPOINT STAFF";
    case "participant": return "PARTICIPANT";
    default: return role.toUpperCase();
  }
}
