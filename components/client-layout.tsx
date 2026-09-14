"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";

const WebGLBackground = dynamic(() => import("./webgl-background"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[-1] bg-[#000000] pointer-events-none" />,
});

const RealtimeSync = dynamic(() => import("./realtime-sync"), {
  ssr: false,
});

const GlobalAnnouncements = dynamic(() => import("./global-announcements"), {
  ssr: false,
});

const PWARegister = dynamic(() => import("./pwa-register"), {
  ssr: false,
});

const PWAInstallBanner = dynamic(() => import("./pwa-install-banner"), {
  ssr: false,
});

gsap.registerPlugin(ScrollTrigger);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      syncTouch: false,
    });

    // Synchronize Lenis scroll with GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker for perfectly synchronized animation frames
    const tickerFn = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerFn);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <WebGLBackground />
      <RealtimeSync />
      <GlobalAnnouncements />
      <PWARegister />
      <PWAInstallBanner />
      <div className="relative z-10 w-full min-h-screen">
        {children}
      </div>
    </>
  );
}
