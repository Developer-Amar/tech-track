import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/client-layout";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Tech Trek — IEI × IETE, Chitkara University",
  description:
    "A live campus-wide technical treasure hunt presented by IEI & IETE Student Chapters, Chitkara University. Solve riddles, trek to checkpoints, and crack coding challenges — all on one platform.",
  applicationName: "Tech Trek",
  appleWebApp: {
    capable: true,
    title: "Tech Trek",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
  ...rest
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth bg-black text-white">
      <body className="antialiased bg-transparent">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
