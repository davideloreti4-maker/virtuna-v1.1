"use client";

/**
 * CalendarWorkspace — the standalone /calendar month planner. A full month grid + a day-detail
 * panel (desktop right rail · mobile bottom sheet) + the content-pillar rail. Mobile-first, `lg:`.
 *
 * The plan is REAL (Seams 1/2): the day's pre-tested ideas (the SAME `surface_reactions` cache the
 * /start daily-ideas section warms) projected onto upcoming days (buildLivePlan). A cache miss
 * warms lazily on first visit (useLazyWarm — the shared StrictMode-safe dedupe). Honesty spine:
 * each planned day's tone/score is the REAL Flash reaction (personasToCardFace); the DAY is a
 * labeled suggestion, and tapping "See the room" opens the actual AmbientRoom on those personas.
 * `pillars` stay MOCK for now (account-derived pillars is a separate follow-up).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { MOCK_PILLARS } from "@/lib/room-contract/mock-room";
import type { Pillar } from "@/lib/room-contract/mock-room";
import type { CurrentMonth } from "@/lib/calendar/current-month";
import { monthLayout } from "@/lib/calendar/month-layout";
import { buildLivePlan } from "@/lib/surfaces/month-plan";
import type { LivePlannedPost } from "@/lib/surfaces/month-plan";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import { ContentPillars } from "@/components/surfaces/sections/content-pillars";
import { RoomDrawer, type RoomFocus } from "@/components/surfaces/room-drawer";
import { MonthGrid } from "./month-grid";
import { DayDetail } from "./day-detail";

export function CalendarWorkspace({
  initialDay = null,
  calendarMonth,
  initialIdeas = null,
  canWarm = false,
}: {
  initialDay?: number | null;
  calendarMonth: CurrentMonth;
  /** Fresh cached ideas (Seams 1/2); null = warm lazily on first visit. */
  initialIdeas?: LiveIdeaCard[] | null;
  /** Gates the warm off for uncalibrated users (no audience to test against → honest empty grid). */
  canWarm?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const pillars = MOCK_PILLARS;

  // Real content source: the same pre-tested ideas cache the /start daily-ideas section warms.
  const { items: ideas, status: ideasStatus } = useLazyWarm<LiveIdeaCard>(
    initialIdeas,
    "/api/surfaces/ideas",
    "ideas",
    canWarm,
  );

  // Month nav: an offset (in months) from the current ("today") month.
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay);
  const [focus, setFocus] = useState<RoomFocus | null>(null);

  // Escape closes the mobile day sheet (only when the Room drawer isn't the top layer).
  useEffect(() => {
    if (selectedDay == null || focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay, focus]);

  // Resolve the viewed month from the offset.
  const viewedMonthIndex = calendarMonth.monthIndex + monthOffset;
  const year = calendarMonth.year + Math.floor(viewedMonthIndex / 12);
  const monthIndex = ((viewedMonthIndex % 12) + 12) % 12;
  const { label } = monthLayout(year, monthIndex);
  const monthShort = label.split(" ")[0]!;
  const isBaseMonth = monthOffset === 0;

  // Plan + today apply only to the current ("today") month — other months are honestly empty.
  const plan = useMemo<Record<number, LivePlannedPost>>(
    () =>
      isBaseMonth
        ? buildLivePlan(ideas, { today: calendarMonth.today, daysInMonth: calendarMonth.daysInMonth })
        : {},
    [isBaseMonth, ideas, calendarMonth.today, calendarMonth.daysInMonth],
  );
  const todayDay = isBaseMonth ? calendarMonth.today : null;
  const plannedCount = Object.keys(plan).length;
  const warming = isBaseMonth && ideasStatus === "warming";
  const selectedPost: LivePlannedPost | undefined = selectedDay != null ? plan[selectedDay] : undefined;

  // The desktop rail defaults to today's plan so it's never an empty "select a day" card. The
  // MOBILE sheet stays keyed on `selectedDay` (explicit tap only) so it never auto-opens on load.
  const railDay = selectedDay ?? todayDay;
  const railPost: LivePlannedPost | undefined = railDay != null ? plan[railDay] : undefined;

  const goMonth = (delta: number) => {
    setMonthOffset((o) => o + delta);
    setSelectedDay(null);
  };

  // Tap "See the room" → open the actual AmbientRoom on the post's REAL personas (Seam 1 → 2).
  const openRoom = (contentId: string) => {
    const idea = ideas.find((i) => i.contentId === contentId);
    if (idea) {
      setFocus({
        cardId: idea.contentId,
        title: idea.title,
        kind: "Idea",
        metric: "would watch",
        personas: idea.personas,
        conceptText: idea.title,
      });
    }
  };

  // Seam 4 — the one handoff: launch a thread to develop/test the idea (mirrors /start).
  const launchThread = (input: string) => {
    setFocus(null);
    router.push(buildThreadLaunchHref({ input, verb: "Make", run: true }));
  };

  const handleMake = (day: number, post?: LivePlannedPost) => {
    if (post) {
      launchThread(post.title);
    } else {
      toast({
        variant: "info",
        title: `Make · ${monthShort} ${day}`,
        description: "Launching a thread to make a new post, pre-tested on your people.",
      });
    }
  };
  const handlePillar = (p: Pillar) => launchThread(`an idea for my “${p.name}” pillar`);

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        {/* Header — title + planned density + month nav */}
        <header className="rv-in mb-4 flex items-center gap-3" style={{ animationDelay: "0.02s" }}>
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              Calendar
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
              {warming
                ? "testing today’s ideas on your people…"
                : plannedCount > 0
                  ? `${plannedCount} planned · pre-tested on your people`
                  : "nothing planned this month"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-lg border border-border text-foreground-secondary transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[104px] text-center text-[13px] font-medium text-foreground">
              {label}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-lg border border-border text-foreground-secondary transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          {/* Hero — the month grid */}
          <div className="rv-in min-w-0" style={{ animationDelay: "0.08s" }}>
            <MonthGrid
              year={year}
              monthIndex={monthIndex}
              monthShort={monthShort}
              todayDay={todayDay}
              plan={plan}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            {!isBaseMonth && (
              <p className="mt-3 text-center font-mono text-[10px] text-foreground-muted">
                Nothing planned for {label} yet — your pre-tested ideas slot into the current month.
              </p>
            )}
          </div>

          {/* Right rail — day detail (desktop, inline) + pillar rail */}
          <aside className="mt-4 flex flex-col gap-3 lg:sticky lg:top-4 lg:mt-0">
            <div className="hidden lg:block rv-in" style={{ animationDelay: "0.14s" }}>
              {railDay != null ? (
                <DayDetail
                  monthShort={monthShort}
                  day={railDay}
                  post={railPost}
                  onMake={handleMake}
                  onAdd={(d) => handleMake(d)}
                  onOpenRoom={openRoom}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center font-mono text-[10px] text-foreground-muted">
                  Pick a day to plan it.
                </div>
              )}
            </div>
            <div className="rv-in" style={{ animationDelay: "0.18s" }}>
              <ContentPillars pillars={pillars} onPillar={handlePillar} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile day detail — a bottom sheet (<lg only, via `lg:hidden`) */}
      {selectedDay != null && (
        <div className="fixed inset-0 z-40 flex items-end lg:hidden">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelectedDay(null)}
            className="absolute inset-0 cursor-default bg-black/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Plan · ${monthShort} ${selectedDay}`}
            className="rv-in relative flex max-h-[80vh] w-full flex-col rounded-t-[20px] border border-b-0 border-border-hover bg-background p-4 shadow-[0_-18px_44px_rgba(0,0,0,0.42)]"
          >
            <span className="mx-auto mb-2 h-1 w-[34px] shrink-0 rounded-full bg-white/20" />
            <div className="min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <DayDetail
                monthShort={monthShort}
                day={selectedDay}
                post={selectedPost}
                onMake={handleMake}
                onAdd={(d) => handleMake(d)}
                onOpenRoom={openRoom}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tap a planned day's "See the room" → the actual AmbientRoom on its real personas. */}
      <RoomDrawer
        focus={focus}
        onClose={() => setFocus(null)}
        onDevelop={(f) => launchThread(f.title)}
        onOpenFull={() =>
          toast({
            variant: "info",
            title: "The full Room",
            description: "Population swarm · rewrite loop · the whole cast — open in a thread.",
          })
        }
      />
    </div>
  );
}
