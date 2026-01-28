import type { Metadata } from "next";
import localFont from "next/font/local";
import { Funnel_Display } from "next/font/google";
import { Header } from "@/components/layout/header";
import "../globals.css";

const satoshi = localFont({
  src: [
    { path: "../../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-funnel-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Artificial Societies | Human Behavior, Simulated",
  description:
    "AI personas that replicate real-world attitudes, beliefs, and opinions. Research that was impossible is now instant.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${satoshi.variable} ${funnelDisplay.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
