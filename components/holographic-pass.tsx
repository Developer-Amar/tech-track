"use client";

import { useRef, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   HOLOGRAPHIC EVENT PASS
   A floating 3D-tilt ID badge that fills in live as the user types.
   Pure CSS + JS — no Three.js, no canvas, no heavy deps.
   ═══════════════════════════════════════════════════════════════════ */

interface HolographicPassProps {
  name: string;
  email: string;
  mobileNumber: string;
  rollNo: string;
  branch: string;
  semester: string;
  filledCount: number;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export default function HolographicPass({
  name,
  email,
  mobileNumber,
  rollNo,
  branch,
  semester,
  filledCount,
  isSubmitting,
  isSuccess,
  isError,
}: HolographicPassProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (card) card.style.transform = "";
    if (glow) glow.style.opacity = "0";
  }, []);

  // Decorative barcode
  const barcodeBars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        width: Math.random() > 0.5 ? 3 : 1.5,
        opacity: 0.3 + Math.random() * 0.5,
        key: i,
      })),
    []
  );

  // Dynamic border color
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
        .holo-card:hover {
          animation-play-state: paused;
        }
        .holo-success {
          animation: holoFlip 1.2s ease-in-out forwards !important;
        }
        @keyframes holoFlip {
          0% { transform: perspective(800px) rotateY(0deg) scale(1); }
          50% { transform: perspective(800px) rotateY(180deg) scale(1.05); }
          100% { transform: perspective(800px) rotateY(360deg) scale(1); }
        }
        .holo-error {
          animation: holoShake 0.5s ease-in-out !important;
        }
        @keyframes holoShake {
          0%, 100% { transform: perspective(800px) translateX(0); }
          10%, 50%, 90% { transform: perspective(800px) translateX(-8px); }
          30%, 70% { transform: perspective(800px) translateX(8px); }
        }
        .holo-pulse {
          animation: holoPulse 1.5s ease-in-out infinite !important;
        }
        @keyframes holoPulse {
          0%, 100% { border-color: rgba(125,249,255,0.2); }
          50% { border-color: rgba(125,249,255,0.6); }
        }
        .holo-shimmer {
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(125,249,255,0.03) 30%,
            rgba(167,139,250,0.04) 40%,
            rgba(255,30,86,0.03) 50%,
            rgba(125,249,255,0.04) 60%,
            transparent 80%
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
        .holo-field-empty {
          color: rgba(148,163,184,0.25);
        }
        .barcode-bar {
          transition: opacity 0.3s ease;
        }
        .status-dot {
          animation: statusPulse 2s ease-in-out infinite;
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
          50% { opacity: 0.6; box-shadow: 0 0 8px currentColor; }
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
          <div style={{ marginBottom: "20px" }}>
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

          {/* Name + Email block */}
          <div
            style={{
              background: "rgba(125,249,255,0.03)",
              border: "1px solid rgba(125,249,255,0.08)",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "18px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#e2e8f0",
                margin: 0,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {name || "—"}
            </p>
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "rgba(148,163,184,0.5)",
                margin: "4px 0 0",
                lineHeight: 1,
              }}
            >
              {email}
            </p>
          </div>

          {/* Data fields row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "2px",
              marginBottom: "14px",
            }}
          >
            <FieldCell
              label="ROLL NO"
              value={rollNo}
              placeholder="—"
            />
            <FieldCell label="BRANCH" value={branch} placeholder="—" />
            <FieldCell
              label="SEM"
              value={semester}
              placeholder="—"
            />
          </div>

          {/* Mobile row */}
          <div style={{ marginBottom: "18px" }}>
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
              className={mobileNumber ? "holo-field-filled" : "holo-field-empty"}
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

          {/* Decorative barcode */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "1.5px",
              height: "28px",
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {barcodeBars.map((bar) => (
              <div
                key={bar.key}
                className="barcode-bar"
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

          {/* Status bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingTop: "12px",
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
