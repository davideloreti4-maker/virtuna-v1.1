"use client";

/**
 * CalendarWorkspace — the standalone /calendar month planner (the milestone's second real
 * surface after /start). The dedicated page behind the glanceable /start month widget:
 * a full month grid + a day-detail panel (desktop right rail · mobile bottom sheet) + the
 * content-pillar rail. Mobile-first, `lg:` desktop.
 *
 * All data is MOCK for v1 (real `planned_posts` persistence is a follow-up PR). Honesty
 * spine: predicted tone/score = a labeled Directional forecast, never a fabricated live
 * reaction. The "Make" handoff is the one Seam-4 launch (stubbed as the /start page stubs
 * it) — grafted to a real thread when The Room ships.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getMockCalendar } from "@/lib/room-contract/mock-room";
import type { Pillar, PlannedPost } from "@/lib/room-contract/mock-room";
import { monthLayout } from "@/lib/calendar/month-layout";
import { ContentPillars } from "@/components/surfaces/sections/content-pillars";
import { MonthGrid } from "./month-grid";
import { DayDetail } from "./day-detail";

export function CalendarWorkspace({ initialDay = null }: { initialDay?: number | null }) {
  const { toast } = useToast();
  const base = useMemo(() => getMockCalendar(), []);
  const pillarsById = useMemo(
    () => new Map(base.pillars.map((p) => [p.id, p.name])),
    [base.pillars],
  );
  const pillarName = (id: string) => pillarsById.get(id) ?? id;

  // Month nav: an offset (in months) from the populated base month (July 2026).
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay);

  // Escape closes the mobile day sheet.
  useEffect(() => {
    if (selectedDay == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay]);

  // Resolve the viewed month from the offset.
  const viewedMonthIndex = base.monthIndex + monthOffset;
  const year = base.year + Math.floor(viewedMonthIndex / 12);
  const monthIndex = ((viewedMonthIndex % 12) + 12) % 12;
  const { label } = monthLayout(year, monthIndex);
  const monthShort = label.split(" ")[0]!;
  const isBaseMonth = monthOffset === 0;

  // Plan + today apply only to the populated base month — other months are honestly empty.
  const plan = isBaseMonth ? base.plan : {};
  const todayDay = isBaseMonth ? base.today : null;
  const plannedCount = Object.keys(plan).length;
  const selectedPost: PlannedPost | undefined = selectedDay != null ? plan[selectedDay] : undefined;

  const goMonth = (delta: number) => {
    setMonthOffset((o) => o + delta);
    setSelectedDay(null);
  };

  // Seam 4 — the one handoff (stubbed as /start stubs it; grafted to a real thread later).
  const handleMake = (day: number, post?: PlannedPost) => {
    toast({
      variant: "info",
      title: `Make · ${monthShort} ${day}`,
      description: post
        ? `“${post.title}” — launching a thread to test it with your people. (Seam 4: create thread → /thread/:id.)`
        : `A new post for ${monthShort} ${day}, pre-tested on your people. (Seam 4: create thread → /thread/:id.)`,
    });
  };
  const handlePillar = (p: Pillar) => {
    toast({
      variant: "default",
      title: `Make for “${p.name}”`,
      description: "Seeds a thread scoped to that pillar. (Seam 4.)",
    });
  };

  return (
    <div
      className="relative min-h-full text-foreground"
      style={{
        background: "radial-gradient(120% 80% at 50% -10%, #2c2a27, var(--color-background) 60%)",
      }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        {/* Header — title + planned density + month nav */}
        <header className="mb-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              Calendar
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
              {plannedCount > 0 ? `${plannedCount} planned this month` : "nothing planned this month"}
              {" · pre-tested on your people"}
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
          <div className="min-w-0">
            <MonthGrid
              year={year}
              monthIndex={monthIndex}
              monthShort={monthShort}
              todayDay={todayDay}
              plan={plan}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              pillarName={pillarName}
            />
            {!isBaseMonth && (
              <p className="mt-3 text-center font-mono text-[10px] text-foreground-muted">
                Nothing planned for {label} yet — tap a day to add an idea.
              </p>
            )}
          </div>

          {/* Right rail — day detail (desktop, inline) + pillar rail */}
          <aside className="mt-4 flex flex-col gap-3 lg:sticky lg:top-4 lg:mt-0">
            <div className="hidden lg:block">
              {selectedDay != null ? (
                <DayDetail
                  monthShort={monthShort}
                  day={selectedDay}
                  post={selectedPost}
                  pillarName={pillarName}
                  onMake={handleMake}
                  onAdd={(d) => handleMake(d)}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-center font-mono text-[10px] text-foreground-muted">
                  Select a day to see its plan.
                </div>
              )}
            </div>
            <ContentPillars pillars={base.pillars} onPillar={handlePillar} />
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
                pillarName={pillarName}
                onMake={handleMake}
                onAdd={(d) => handleMake(d)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
