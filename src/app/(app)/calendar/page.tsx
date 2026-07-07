import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAudiences } from "@/lib/audience/audience-repo";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import type { Audience } from "@/lib/audience/audience-types";
import { getFreshSurfaceCards, audienceKeyOf } from "@/lib/surfaces/surface-reactions-repo";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { currentMonth } from "@/lib/calendar/current-month";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import { listPlannedPosts, type PlannedPostRow } from "@/lib/planned-posts/planned-posts-repo";
import { toISODate } from "@/lib/calendar/planned-plan";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";

export const metadata: Metadata = {
  title: "Calendar | Maven",
  description: "Plan your month — every post pre-tested on your people before you make it.",
};

/**
 * /calendar — the standalone content-calendar workspace (the milestone's second real surface
 * after /start). Lives inside the (app) route group so it inherits AppShell (sidebar +
 * ToastProvider) + the server auth gate. Auth-gated here too as defense-in-depth.
 *
 * The plan is REAL and PERSISTED (planned_posts): the user drags/taps pre-tested ideas (the
 * SAME cache the /start daily-ideas section warms) onto days, and each placement is snapshotted
 * so it survives the rolling ideas-cache churn. Uncalibrated (no scrape-calibrated audience) →
 * no warm backlog (honest empty state, mirrors /start's first-run honesty).
 */
export default async function CalendarRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Same honesty gate as /start: only a scrape-calibrated audience can be tested against.
  let audiences: Audience[] = [];
  try {
    audiences = await listAudiences(supabase);
  } catch {
    audiences = [];
  }
  const canWarm = audiences.some((a) => !a.is_general && a.signature != null);

  // A FRESH cached ideas batch renders the backlog instantly; a miss warms lazily on first visit.
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

  // Real content pillars (the creator's themes) for the rail.
  let pillars: Pillar[] = [];
  try {
    pillars = await buildContentPillars(supabase, user.id);
  } catch {
    pillars = [];
  }

  // The persisted plan — the current month onward (past days aren't planning surface).
  const cm = currentMonth();
  let initialPlanned: PlannedPostRow[] = [];
  try {
    initialPlanned = await listPlannedPosts(
      supabase,
      user.id,
      toISODate(cm.year, cm.monthIndex, 1),
    );
  } catch {
    initialPlanned = [];
  }

  return (
    <CalendarWorkspace
      calendarMonth={cm}
      initialIdeas={initialIdeas}
      canWarm={canWarm}
      pillars={pillars}
      initialPlanned={initialPlanned}
    />
  );
}
