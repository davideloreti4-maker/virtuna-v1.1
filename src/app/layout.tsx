import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { FunnelProvider } from "@/components/analytics/funnel-provider";
import { DevLocator } from "@/components/dev/locator";
import "./globals.css";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// [UAT] serif typeface — Newsreader (Frame A); may swap to Source Serif 4 at THEME-06.
// Voice moments ONLY (hero headline); 400 + italic. No element consumes it yet (lands Phase 2);
// --font-serif resolves to it via the ported globals.css (D-05).
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
  title: "Maven | AI Content Intelligence for TikTok Creators",
  description:
    "Know what will go viral before you post. AI-powered predictions, trend intelligence, and audience insights for TikTok creators.",
  openGraph: {
    title: "Maven | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
    url: "https://virtuna.ai",
    siteName: "Maven",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maven | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
  },
  // Config-based, not src/app/icon.svg, so the flag can pick the tile: file-based icons override
  // `icons` and cannot be switched. Legacy = cream gull on charcoal; new look = coral mark on ink.
  icons: NEW_LOOK_ENABLED
    ? {
        icon: [{ url: "/brand/next-icon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/brand/next-apple-icon.svg", type: "image/svg+xml" }],
      }
    : {
        icon: [{ url: "/brand/icon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/brand/apple-icon.svg", type: "image/svg+xml" }],
      },
};

// With the flag on, <html> carries the new look. The server always renders "light"; the head
// script corrects it before first paint, which is why React must not warn about the attribute.
const NEXT_LOOK_ATTRS = NEW_LOOK_ENABLED
  ? ({ "data-look": "next", "data-theme": "light", suppressHydrationWarning: true } as const)
  : {};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} {...NEXT_LOOK_ATTRS}>
      {NEW_LOOK_ENABLED && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
      )}
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        {/* The funnel's event sink (DESIGN §8) — root-level so /go and / are covered. */}
        <FunnelProvider />
        <DevLocator />
      </body>
    </html>
  );
}
