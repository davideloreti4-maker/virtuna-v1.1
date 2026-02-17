import type { Metadata } from "next";
import { AppShell } from "@/components/app";
import { ToastProvider } from "@/components/ui/toast";
import { Providers } from "./providers";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Dashboard | Virtuna",
  description: "AI-powered content intelligence for TikTok creators.",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <ToastProvider>
            <AppShell>
              {children}
            </AppShell>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
