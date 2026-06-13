import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { DevLocator } from "@/components/dev/locator";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// [UAT] serif typeface — Newsreader (Frame A); may swap to Source Serif 4 at THEME-06.
// Voice moments ONLY (greeting/hero); 400 + italic (italic = name accent in the greeting). No element consumes it yet (plan 01-03).
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://virtuna.ai"),
  title: "Numen | AI Content Intelligence for TikTok Creators",
  description:
    "Know what will go viral before you post. AI-powered predictions, trend intelligence, and audience insights for TikTok creators.",
  openGraph: {
    title: "Numen | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
    url: "https://virtuna.ai",
    siteName: "Numen",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Numen | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <DevLocator />
      </body>
    </html>
  );
}
