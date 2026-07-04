import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GrowView } from "@/components/grow/grow-view";

export const metadata: Metadata = {
  title: "Grow | Maven",
  description: "Turn your audience into income — offers pre-tested on your people.",
};

/**
 * /grow — the "Grow your business" strategy dashboard (the business-coach surface).
 * Auth-gated, inside (app) so it inherits AppShell + ToastProvider. A Surfaces-scoped
 * SURFACE (cards + Seam-4 handoffs), NOT a chat engine — The Room owns the thread. All
 * data MOCK for v1; readiness + offer forecasts are Directional (see GrowView).
 */
export default async function GrowRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <GrowView />;
}
