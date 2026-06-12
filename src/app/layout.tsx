import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { DevLocator } from "@/components/dev/locator";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Voice serif — reserved for greeting/hero + verdict line ONLY (D-13).
// Variable font: no `weight` array needed; opsz axis auto via font-optical-sizing:auto.
// Self-hosted at build time by next/font — no runtime CDN fetch (T-01-FNT accepted).
const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://virtuna.ai"),
  title: "Numen — an honest verdict on your content, before you post",
  description:
    "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
  openGraph: {
    title: "Numen — an honest verdict on your content, before you post",
    description:
      "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
    url: "https://virtuna.ai",
    siteName: "Numen",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Numen — an honest verdict on your content, before you post",
    description:
      "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <DevLocator />
      </body>
    </html>
  );
}
