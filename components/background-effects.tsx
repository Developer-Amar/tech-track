"use client";

export default function BackgroundEffects() {
  return (
    <>
      {/* Background Video Layer */}
      <div className="bg-video-wrap">
        <video autoPlay loop muted playsInline>
          <source src="/bg-loop.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Aurora Ambient Nebulae Layer */}
      <div className="aurora-container">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Subtle Scanline Overlay */}
      <div className="screen-scanline" />

      {/* Technical Grid Overlay */}
      <div className="hud-grid-overlay" />

      {/* Vignette Overlay */}
      <div className="hud-vignette" />
    </>
  );
}
