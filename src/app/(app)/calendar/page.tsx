import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAudiences } from "@/lib/audience/audience-repo";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import type { Audience } from "@/lib/audience/audience-types";
import { getFreshSurfaceCards, audienceKeyOf } from "@/lib/surfaces/surface-reactions-repo";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { currentMonth } from "@/lib/calendar/current-month";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";

export const metadata: Metadata = {
  title: "Calendar | Maven",
  description: "Plan your month — every post pre-tested on your people before you make it.",
};

/**
 * /calendar — the standalone month-planning workspace (the milestone's second real surface
 * after /start). Lives inside the (app) route group so it inherits AppShell (sidebar +
 * ToastProvider the Seam-4 handoff uses) + the server auth gate. Auth-gated here too as
 * defense-in-depth (mirrors /start, /feed). AppShell owns the <main>; render a plain shell.
 *
 * The plan is REAL (Seams 1/2): the SAME pre-tested daily-ideas the /start section warms
 * (surface_reactions, kind='idea') projected onto upcoming days (buildLivePlan) — so the /start
 * month widget and this workspace read off ONE source and agree. Reactions are real; the day is
 * a labeled suggestion. Uncalibrated (no scrape-calibrated audience) → no warm, honest empty grid
 * (mirrors /start's first-run honesty). `?day=N` deep-links a selected day.
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

  // Same honesty gate as /start: only a scrape-calibrated audience can be tested against. On any
  // read error, fall back to no-warm (never fabricate a plan for a user we can't confirm connected).
  let audiences: Audience[] = [];
  try {
    audiences = await listAudiences(supabase);
  } catch {
    audiences = [];
  }
  const canWarm = audiences.some((a) => !a.is_general && a.signature != null);

  // A FRESH cached ideas batch for the active audience renders the plan instantly; a miss (or the
  // first visit of the day) leaves this null → the workspace warms it lazily (POST /api/surfaces/ideas).
  const activeAudience = await resolveUserAudience(supabase, user.id);
  let initialIdeas: LiveIdeaCard[] | null = null;
  if (canWarm) {
    initialIdeas = await getFreshSurfaceCards<LiveIdeaCard>(
      supabase,
      user.id,
      audienceKeyOf(activeAudience),
      "idea",
    );
  }

  return (
    <CalendarWorkspace
      initialDay={initialDay}
      calendarMonth={currentMonth()}
      initialIdeas={initialIdeas}
      canWarm={canWarm}
    />
  );
}
