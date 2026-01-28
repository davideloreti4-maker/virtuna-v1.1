import type { Metadata } from "next";
import localFont from "next/font/local";
import { Funnel_Display } from "next/font/google";
import { Sidebar } from "@/components/app";
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
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${satoshi.variable} ${funnelDisplay.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-[#0A0A0A]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
