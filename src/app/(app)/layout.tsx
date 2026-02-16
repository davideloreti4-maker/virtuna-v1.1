import type { Metadata } from "next";
import { AppShell } from "@/components/app";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Dashboard | Virtuna",
  description: "AI-powered content intelligence for TikTok creators.",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <AppShell>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
