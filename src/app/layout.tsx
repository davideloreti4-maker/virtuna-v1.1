import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://virtuna.ai"),
  title: "Virtuna | AI Content Intelligence for TikTok Creators",
  description:
    "Know what will go viral before you post. AI-powered predictions, brand deal matching, and audience insights for TikTok creators.",
  openGraph: {
    title: "Virtuna | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
    url: "https://virtuna.ai",
    siteName: "Virtuna",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Virtuna - AI Content Intelligence",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtuna | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions and audience insights for TikTok creators.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
