import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";

export const metadata: Metadata = {
  title: "Calendar | Juno",
  description: "Plan your month — every post pre-tested on your people before you make it.",
};

/**
 * /calendar — the standalone month-planning workspace (the milestone's second real surface
 * after /start). Lives inside the (app) route group so it inherits AppShell (sidebar +
 * ToastProvider the Seam-4 handoff uses) + the server auth gate. Auth-gated here too as
 * defense-in-depth (mirrors /start, /feed). AppShell owns the <main>; render a plain shell.
 *
 * v1 renders MOCK plan data (mock-room.ts) — the same fixtures the /start month widget
 * glances at, so widget → page stays consistent. `?day=N` deep-links a selected day (the
 * /start widget links here). Real planned_posts persistence is a follow-up PR.
 */
export default async function CalendarRoute({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { day } = await searchParams;
  const parsed = day ? Number(day) : NaN;
  const initialDay =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;

  return <CalendarWorkspace initialDay={initialDay} />;
}
