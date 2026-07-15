import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { DevMockPanel } from "@/components/dev/dev-mock-panel";

export const metadata: Metadata = {
  title: "Dashboard | Maven",
  description: "AI-powered content intelligence for TikTok creators.",
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Defense-in-depth: server-side auth check alongside middleware
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Providers>
      <TooltipProvider>
        <ToastProvider>
          <AppShell>
            {children}
          </AppShell>
          {/* Dev-only sandbox controls (self-gates on NODE_ENV; unmounted + tree-shaken in prod). */}
          <DevMockPanel />
        </ToastProvider>
      </TooltipProvider>
    </Providers>
  );
}
