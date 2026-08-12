"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * StyledQR — A QR code renderer that matches the holographic card aesthetic.
 * Renders rounded cyan dots on a transparent background instead of
 * the standard ugly black-and-white square grid.
 */
export default function StyledQR({
  data,
  size = 100,
  dotColor = "#7DF9FF",
  dimColor = "rgba(125,249,255,0.15)",
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

    // Generate QR matrix
    const qr = QRCode.create(data, {
      errorCorrectionLevel: "M",
    });

    const modules = qr.modules;
    const moduleCount = modules.size;
    const scale = (size * 2) / moduleCount; // 2x for retina
    const dotSize = scale * 0.72; // Dot takes 72% of cell — leaves spacing
    const radius = dotSize * 0.35; // Rounded corners

    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const color = active ? dotColor : dimColor;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const isDark = modules.get(row, col);
        if (!isDark) continue;

        const x = col * scale + (scale - dotSize) / 2;
        const y = row * scale + (scale - dotSize) / 2;

        // Check if this is part of the finder pattern (3 corner squares)
        const isFinderPattern =
          (row < 7 && col < 7) || // top-left
          (row < 7 && col >= moduleCount - 7) || // top-right
          (row >= moduleCount - 7 && col < 7); // bottom-left

        if (isFinderPattern) {
          // Finder patterns: draw as solid rounded rects with glow
          ctx.fillStyle = active ? dotColor : dimColor;
          ctx.shadowColor = active ? "rgba(125,249,255,0.3)" : "transparent";
          ctx.shadowBlur = active ? 4 : 0;
          drawRoundedRect(ctx, x, y, dotSize, dotSize, radius * 0.5);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
        } else {
          // Data dots: draw as small circles
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(
            x + dotSize / 2,
            y + dotSize / 2,
            dotSize / 2.3,
            0,
            Math.PI * 2
          );
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
        imageRendering: "auto",
      }}
    />
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
