import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/client-layout";

export const metadata: Metadata = {
  title: "Tech Trek — IEI Club, Chitkara University",
  description:
    "A live campus-wide technical treasure hunt. Solve riddles, trek to checkpoints, and crack coding challenges — all on one platform.",
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
