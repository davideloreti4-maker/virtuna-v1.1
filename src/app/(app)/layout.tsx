import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app";
import { ToastProvider } from "@/components/ui/toast";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Dashboard | Virtuna",
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
      <ToastProvider>
        <AppShell>
          {children}
        </AppShell>
      </ToastProvider>
    </Providers>
  );
}
