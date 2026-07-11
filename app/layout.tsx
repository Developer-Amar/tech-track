import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Track — IEI Club, Chitkara University",
  description:
    "A live campus-wide technical treasure hunt. Solve riddles, travel to checkpoints, and crack coding challenges — all on one platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
