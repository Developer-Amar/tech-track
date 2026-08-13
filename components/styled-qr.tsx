"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * StyledQR v2 — Crisp, high-DPI QR renderer.
 * Uniform small circles with clean finder patterns.
 */
export default function StyledQR({
  data,
  size = 110,
  dotColor = "#7DF9FF",
  dimColor = "rgba(125,249,255,0.12)",
  active = true,
}: {
  data: string;
  size?: number;
  dotColor?: string;
  dimColor?: string;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const qr = QRCode.create(data, { errorCorrectionLevel: "M" });
    const modules = qr.modules;
    const moduleCount = modules.size;

    // 4x supersampling for razor-sharp rendering
    const dpr = 4;
    const canvasSize = size * dpr;
    const cellSize = canvasSize / moduleCount;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const color = active ? dotColor : dimColor;

    // Helper: is this cell part of a finder pattern?
    const isFinder = (r: number, c: number) =>
      (r < 7 && c < 7) ||
      (r < 7 && c >= moduleCount - 7) ||
      (r >= moduleCount - 7 && c < 7);

    // Helper: is this cell on the outer ring of a finder?
    const isFinderOuter = (r: number, c: number) => {
      if (!isFinder(r, c)) return false;
      // Outer ring = first/last row or col within each 7x7 block
      const blocks = [
        { r0: 0, c0: 0 },
        { r0: 0, c0: moduleCount - 7 },
        { r0: moduleCount - 7, c0: 0 },
      ];
      for (const b of blocks) {
        const lr = r - b.r0;
        const lc = c - b.c0;
        if (lr >= 0 && lr < 7 && lc >= 0 && lc < 7) {
          if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
          if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
        }
      }
      return false;
    };

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const isDark = modules.get(row, col);
        if (!isDark) continue;

        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;

        ctx.fillStyle = color;

        if (isFinder(row, col)) {
          // Finder patterns: slightly larger squares with rounded corners
          const s = cellSize * 0.88;
          const r = s * 0.15;
          const x = cx - s / 2;
          const y = cy - s / 2;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + s - r, y);
          ctx.quadraticCurveTo(x + s, y, x + s, y + r);
          ctx.lineTo(x + s, y + s - r);
          ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
          ctx.lineTo(x + r, y + s);
          ctx.quadraticCurveTo(x, y + s, x, y + s - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Data modules: clean circles
          const radius = cellSize * 0.30;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [data, size, dotColor, dimColor, active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
