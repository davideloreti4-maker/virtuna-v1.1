import type { Metadata, Viewport } from "next";
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
  title: "Virtuna | Social Media Intelligence Platform",
  description:
    "Track viral trends, analyze creator performance, and discover brand deal opportunities with AI-powered social media intelligence.",
  openGraph: {
    title: "Virtuna | Social Media Intelligence Platform",
    description:
      "Track viral trends, analyze creator performance, and discover brand deal opportunities with AI-powered social media intelligence.",
    type: "website",
    url: "https://virtuna.app",
    siteName: "Virtuna",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Virtuna - Social Media Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtuna | Social Media Intelligence Platform",
    description:
      "Track viral trends, analyze creator performance, and discover brand deal opportunities.",
    images: ["/images/og-image.png"],
  },
  metadataBase: new URL("https://virtuna.app"),
};

export const viewport: Viewport = {
  themeColor: "#07080a",
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
