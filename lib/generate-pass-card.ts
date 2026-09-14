"use client";

import QRCode from "qrcode";

export interface GeneratePassOptions {
  name: string;
  email: string;
  avatarUrl?: string;
  mobileNumber: string;
  rollNo: string;
  branch: string;
  semester: string;
  passCode: string;
  role?: string;
  unitInfo?: { name: string } | null;
}

/**
 * Safely loads an image without throwing a fatal CORS exception.
 * If cross-origin loading is blocked, resolves to null so initials fallback can be used.
 */
function safelyLoadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // CORS blocked or image unreachable
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Generates a high-DPI (900x1350) holographic event pass PNG blob using Canvas2D.
 * Completely immune to DOM-cloning, CSS 3D transforms, and tainted canvas errors.
 */
export async function generatePassBlob(options: GeneratePassOptions): Promise<Blob> {
  const {
    name,
    email,
    avatarUrl,
    mobileNumber,
    rollNo,
    branch,
    semester,
    passCode,
    role = "participant",
    unitInfo,
  } = options;

  const width = 900;
  const height = 1350;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context");
  }

  // 1. Dark Void Base Background
  ctx.fillStyle = "#04060C";
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Cyber Gradient Glows
  const topGlow = ctx.createRadialGradient(width / 2, 100, 10, width / 2, 100, 450);
  topGlow.addColorStop(0, "rgba(0, 229, 255, 0.12)");
  topGlow.addColorStop(1, "transparent");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 500);

  const bottomGlow = ctx.createRadialGradient(width / 2, height - 150, 10, width / 2, height - 150, 500);
  bottomGlow.addColorStop(0, "rgba(168, 85, 247, 0.1)");
  bottomGlow.addColorStop(1, "transparent");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, height - 600, width, 600);

  // 3. Cyber Circuit Background Grid Lines
  ctx.strokeStyle = "rgba(125, 249, 255, 0.04)";
  ctx.lineWidth = 1;
  const gridSize = 45;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 4. Card Outer Border with Cut Corners
  const pad = 36;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const cut = 24;

  ctx.save();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 229, 255, 0.35)";
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(pad + cut, pad);
  ctx.lineTo(pad + cardW - cut, pad);
  ctx.lineTo(pad + cardW, pad + cut);
  ctx.lineTo(pad + cardW, pad + cardH - cut);
  ctx.lineTo(pad + cardW - cut, pad + cardH);
  ctx.lineTo(pad + cut, pad + cardH);
  ctx.lineTo(pad, pad + cardH - cut);
  ctx.lineTo(pad, pad + cut);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Corner Accent Brackets
  const drawCornerBracket = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + dx * 28, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * 28);
    ctx.stroke();
  };
  drawCornerBracket(pad + 12, pad + 12, 1, 1);
  drawCornerBracket(pad + cardW - 12, pad + 12, -1, 1);
  drawCornerBracket(pad + 12, pad + cardH - 12, 1, -1);
  drawCornerBracket(pad + cardW - 12, pad + cardH - 12, -1, -1);

  // 5. Header: Organization & Event Title
  ctx.fillStyle = "#94A3B8";
  ctx.font = "bold 15px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("CHITKARA UNIVERSITY · IEI × IETE", width / 2, pad + 55);

  ctx.fillStyle = "#00E5FF";
  ctx.font = "900 40px 'Arial Black', Impact, sans-serif";
  ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
  ctx.shadowBlur = 16;
  ctx.fillText("TECH TREK 2026", width / 2, pad + 105);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.fillText("OFFICIAL EVENT ACCESS PASS", width / 2, pad + 130);

  // Horizontal Accent Divider
  const gradLine = ctx.createLinearGradient(pad + 60, pad + 150, pad + cardW - 60, pad + 150);
  gradLine.addColorStop(0, "transparent");
  gradLine.addColorStop(0.5, "rgba(0, 229, 255, 0.6)");
  gradLine.addColorStop(1, "transparent");
  ctx.strokeStyle = gradLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + 40, pad + 150);
  ctx.lineTo(pad + cardW - 40, pad + 150);
  ctx.stroke();

  // 6. Identity Box
  const idBoxX = pad + 40;
  const idBoxY = pad + 175;
  const idBoxW = cardW - 80;
  const idBoxH = 175;

  ctx.fillStyle = "rgba(12, 18, 30, 0.85)";
  ctx.strokeStyle = "rgba(0, 229, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(idBoxX, idBoxY, idBoxW, idBoxH, 16);
  ctx.fill();
  ctx.stroke();

  // Avatar / Initials Handling
  const avatarSize = 100;
  const avatarX = idBoxX + 25;
  const avatarY = idBoxY + (idBoxH - avatarSize) / 2;

  let loadedAvatarImg: HTMLImageElement | null = null;
  if (avatarUrl) {
    loadedAvatarImg = await safelyLoadImage(avatarUrl);
  }

  if (loadedAvatarImg) {
    // Render user avatar with circular clipping
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(loadedAvatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Circular neon ring
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Monogram Initials Avatar Fallback
    ctx.save();
    ctx.fillStyle = "rgba(0, 229, 255, 0.1)";
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const initials = (name || "TT")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 38px 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();
  }

  // Name & Email inside Identity Box
  const textLeft = avatarX + avatarSize + 25;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px 'Arial Black', sans-serif";
  const displayName = name.length > 20 ? name.substring(0, 19) + "…" : name;
  ctx.fillText(displayName.toUpperCase(), textLeft, avatarY + 36);

  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.font = "16px 'Courier New', monospace";
  const displayEmail = email.length > 26 ? email.substring(0, 25) + "…" : email;
  ctx.fillText(displayEmail, textLeft, avatarY + 64);

  // Role & Team Badges
  let badgeX = textLeft;
  const badgeY = avatarY + 76;

  // Role Pill
  const roleUpper = (role || "ATTENDEE").toUpperCase().replace("_", " ");
  ctx.font = "bold 12px 'Courier New', monospace";
  const roleMetrics = ctx.measureText(roleUpper);
  const roleW = roleMetrics.width + 20;

  ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
  ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, roleW, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#00E5FF";
  ctx.fillText(roleUpper, badgeX + 10, badgeY + 17);
  badgeX += roleW + 12;

  // Team Pill (if exists)
  if (unitInfo?.name) {
    const teamText = `TEAM: ${unitInfo.name.toUpperCase()}`;
    const teamMetrics = ctx.measureText(teamText);
    const teamW = teamMetrics.width + 20;

    ctx.fillStyle = "rgba(196, 181, 253, 0.12)";
    ctx.strokeStyle = "rgba(196, 181, 253, 0.4)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, teamW, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#C4B5FD";
    ctx.fillText(teamText, badgeX + 10, badgeY + 17);
  }

  // 7. Academic / Contact Credentials Grid
  const gridY = idBoxY + idBoxH + 30;
  const cols = [
    { label: "ROLL NO", value: rollNo || "N/A", x: pad + 45 },
    { label: "BRANCH", value: branch || "CSE", x: pad + 250 },
    { label: "SEMESTER", value: semester ? `SEM ${semester}` : "N/A", x: pad + 455 },
    { label: "MOBILE", value: mobileNumber || "N/A", x: pad + 630 },
  ];

  cols.forEach(({ label, value, x }) => {
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText(label, x, gridY);

    ctx.fillStyle = "#F1F5F9";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText(value, x, gridY + 28);
  });

  // 8. QR Code Container Box
  const qrBoxY = gridY + 65;
  const qrBoxH = 500;
  const qrBoxW = cardW - 80;

  ctx.fillStyle = "rgba(8, 12, 22, 0.9)";
  ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pad + 40, qrBoxY, qrBoxW, qrBoxH, 20);
  ctx.fill();
  ctx.stroke();

  // Generate QR Code via QRCode library directly onto an in-memory canvas
  const qrSize = 300;
  const qrX = width / 2 - qrSize / 2;
  const qrY = qrBoxY + 35;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, passCode, {
    width: qrSize,
    margin: 2,
    color: {
      dark: "#00E5FF",
      light: "#070B14",
    },
    errorCorrectionLevel: "M",
  });

  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Pass ID Box below QR
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillText("OFFICIAL PASS IDENTIFIER", width / 2, qrY + qrSize + 40);

  ctx.fillStyle = "#00E5FF";
  ctx.font = "900 36px 'Courier New', monospace";
  ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
  ctx.shadowBlur = 12;
  ctx.fillText(passCode, width / 2, qrY + qrSize + 85);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("PRESENT AT CHECKPOINTS FOR INSTANT TEAM CLEARANCE", width / 2, qrY + qrSize + 115);

  // 9. Footer Security Watermark
  const footerY = height - pad - 45;
  ctx.strokeStyle = "rgba(0, 229, 255, 0.2)";
  ctx.beginPath();
  ctx.moveTo(pad + 60, footerY - 20);
  ctx.lineTo(pad + cardW - 60, footerY - 20);
  ctx.stroke();

  ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
  ctx.font = "11px 'Courier New', monospace";
  ctx.fillText("ENCRYPTED ACCESS TOKEN · TECH TREK ARENA PROTOCOL · NON-TRANSFERABLE", width / 2, footerY);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to export pass canvas as PNG blob"));
      }
    }, "image/png");
  });
}
