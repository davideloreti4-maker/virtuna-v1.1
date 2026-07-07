"use client";

/**
 * CalendarWorkspace v2 — the standalone /calendar planner. A REAL content calendar now:
 * pre-tested ideas (the /start ideas cache) are dragged or tapped onto days and persist as
 * planned_posts (snapshotted, so they survive the cache churn). Layout: an up-next hero, the
 * month grid (hero), and a right rail — the Ideas/Scheduled backlog, a cadence readout, and
 * the real content-pillar rail. Mobile-first (`lg:`); tap-to-place covers touch (drag is
 * desktop-only). Best-slot rings (recommendedDays) surface Maven's suggested days while placing.
 *
 * Honesty spine: every tone / stop-rate / verbatim reaction is derived from a post's frozen
 * Flash `personas` (personasToCardFace) — the reaction is real, the day is the creator's choice.
 * Writes are optimistic → schedule/move/unschedule server actions, reverted on failure.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { ReactionPersona } from "@/lib/tools/blocks";
import type { Pillar } from "@/lib/room-contract/mock-room";
import type { CurrentMonth } from "@/lib/calendar/current-month";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import type { PlannedPostRow, PlannedFormat } from "@/lib/planned-posts/planned-posts-repo";
import { monthLayout } from "@/lib/calendar/month-layout";
import {
  buildPlannedPlan,
  recommendedDays,
  cadenceNext7,
  nextPlanned,
  toISODate,
} from "@/lib/calendar/planned-plan";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import { ContentPillars } from "@/components/surfaces/sections/content-pillars";
import { RoomDrawer, type RoomFocus } from "@/components/surfaces/room-drawer";
import { schedulePost, movePost, unschedulePost } from "@/app/actions/planned-posts/actions";
import { MonthGrid } from "./month-grid";
import { UpNext } from "./up-next";
import { BacklogRail } from "./backlog-rail";

const WEEKLY_TARGET = 4; // cadence readout denominator (heuristic; a learned target swaps in later)

export function CalendarWorkspace({
  calendarMonth,
  initialIdeas = null,
  canWarm = false,
  pillars = [],
  initialPlanned = [],
}: {
  calendarMonth: CurrentMonth;
  /** Fresh cached ideas (Seams 1/2); null = warm lazily on first visit. */
  initialIdeas?: LiveIdeaCard[] | null;
  /** Gates the warm off for uncalibrated users (no audience to test against → empty backlog). */
  canWarm?: boolean;
  /** Real content pillars from the account's posts ([] = none yet → honest empty rail). */
  pillars?: Pillar[];
  /** The user's persisted plan (current month onward) — the REAL scheduled posts. */
  initialPlanned?: PlannedPostRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();

  // The backlog source: the same pre-tested ideas cache the /start daily-ideas section warms.
  const { items: ideas, status: ideasStatus } = useLazyWarm<LiveIdeaCard>(
    initialIdeas,
    "/api/surfaces/ideas",
    "ideas",
    canWarm,
  );

  // The persisted plan — mutated optimistically, reconciled with the server action results.
  const [plannedRows, setPlannedRows] = useState<PlannedPostRow[]>(initialPlanned);
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"ideas" | "scheduled">("ideas");
  const [placingId, setPlacingId] = useState<string | null>(null); // a backlog idea's contentId
  const [focus, setFocus] = useState<RoomFocus | null>(null);

  // What's currently being dragged (read on drop). A ref so it never triggers a re-render.
  const dragPayload = useRef<{ kind: "idea" | "move"; id: string } | null>(null);
  const tempCounter = useRef(0);

  // Escape cancels placement (unless the Room drawer is the top layer).
  useEffect(() => {
    if (!placingId || focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placingId, focus]);

  // Resolve the viewed month from the offset.
  const viewedMonthIndex = calendarMonth.monthIndex + monthOffset;
  const year = calendarMonth.year + Math.floor(viewedMonthIndex / 12);
  const monthIndex = ((viewedMonthIndex % 12) + 12) % 12;
  const { label, daysInMonth } = monthLayout(year, monthIndex);
  const monthShort = label.split(" ")[0]!;
  const isBaseMonth = monthOffset === 0;
  const todayDay = isBaseMonth ? calendarMonth.today : null;

  // Plans: the viewed month (grid) and the base month (cadence + first-run "today" anchor).
  const plan = useMemo(
    () => buildPlannedPlan(plannedRows, year, monthIndex),
    [plannedRows, year, monthIndex],
  );
  const basePlan = useMemo(
    () => buildPlannedPlan(plannedRows, calendarMonth.year, calendarMonth.monthIndex),
    [plannedRows, calendarMonth.year, calendarMonth.monthIndex],
  );

  const scheduledIds = useMemo(
    () => new Set(plannedRows.map((r) => r.content_id)),
    [plannedRows],
  );
  const pool = useMemo(
    () => ideas.filter((i) => !scheduledIds.has(i.contentId)),
    [ideas, scheduledIds],
  );
  const scheduledSorted = useMemo(
    () => [...plannedRows].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [plannedRows],
  );

  const occupied = useMemo(() => new Set(Object.keys(plan).map(Number)), [plan]);
  const recommended =
    placingId && isBaseMonth
      ? recommendedDays(occupied, calendarMonth.today, daysInMonth)
      : [];

  const todayISO = toISODate(calendarMonth.year, calendarMonth.monthIndex, calendarMonth.today);
  const upNextRow = useMemo(() => nextPlanned(plannedRows, todayISO), [plannedRows, todayISO]);
  const next7 = cadenceNext7(basePlan, calendarMonth.today);
  const plannedTotal = plannedRows.length;
  const warming = ideasStatus === "warming";

  // ── writes (optimistic → server action) ─────────────────────────────────────────

  const goMonth = (delta: number) => {
    setMonthOffset((o) => o + delta);
    setPlacingId(null);
  };

  /** Snapshot an idea onto a day (schedule). Bumps any post already on that day back to the pool. */
  const scheduleIdeaOnDay = (contentId: string, day: number) => {
    const idea = ideas.find((i) => i.contentId === contentId);
    if (!idea) return;
    const iso = toISODate(year, monthIndex, day);
    const bumped = plan[day] && plan[day]!.contentId !== contentId ? plan[day]! : null;
    const tempId = `temp-${++tempCounter.current}`;
    const row: PlannedPostRow = {
      id: tempId,
      scheduled_date: iso,
      content_id: contentId,
      title: idea.title,
      format: idea.type as PlannedFormat,
      personas: idea.personas as ReactionPersona[],
    };

    setPlannedRows((rows) =>
      rows.filter((r) => r.content_id !== contentId && (!bumped || r.id !== bumped.id)).concat(row),
    );
    setPlacingId(null);

    if (bumped && !bumped.id.startsWith("temp-")) void unschedulePost(bumped.id);

    const isTopPick = recommended[0] === day;
    schedulePost({ scheduledDate: iso, contentId, title: idea.title, format: idea.type, personas: idea.personas })
      .then((res) => {
        if (res.error) {
          setPlannedRows((rows) => rows.filter((r) => r.id !== tempId));
          toast({ variant: "error", title: "Couldn't schedule", description: res.error });
          return;
        }
        if (res.id) setPlannedRows((rows) => rows.map((r) => (r.id === tempId ? { ...r, id: res.id! } : r)));
        toast({
          variant: "success",
          title: `Scheduled · ${monthShort} ${day}${isTopPick ? " · Maven’s pick" : ""}`,
          description: `${idea.title} — pre-tested on your people.`,
        });
      })
      .catch(() => {
        setPlannedRows((rows) => rows.filter((r) => r.id !== tempId));
        toast({ variant: "error", title: "Couldn't schedule", description: "Try again." });
      });
  };

  /** Move an already-scheduled post to a different day (drag). Bumps any occupant. */
  const movePostToDay = (rowId: string, day: number) => {
    const row = plannedRows.find((r) => r.id === rowId);
    if (!row) return;
    const iso = toISODate(year, monthIndex, day);
    if (row.scheduled_date === iso) return;
    const bumped = plan[day] && plan[day]!.id !== rowId ? plan[day]! : null;
    const prevDate = row.scheduled_date;

    setPlannedRows((rows) =>
      rows
        .filter((r) => !bumped || r.id !== bumped.id)
        .map((r) => (r.id === rowId ? { ...r, scheduled_date: iso } : r)),
    );
    if (bumped && !bumped.id.startsWith("temp-")) void unschedulePost(bumped.id);
    if (rowId.startsWith("temp-")) return; // not yet persisted; the pending insert carries the date

    movePost(rowId, iso).then((res) => {
      if (res.error) {
        setPlannedRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, scheduled_date: prevDate } : r)));
        toast({ variant: "error", title: "Couldn't move", description: res.error });
      }
    });
  };

  /** Unschedule — the idea returns to the backlog (if still cached). */
  const unscheduleRow = (rowId: string) => {
    const row = plannedRows.find((r) => r.id === rowId);
    if (!row) return;
    setPlannedRows((rows) => rows.filter((r) => r.id !== rowId));
    if (rowId.startsWith("temp-")) return;
    unschedulePost(rowId).then((res) => {
      if (res.error) {
        setPlannedRows((rows) => [...rows, row]);
        toast({ variant: "error", title: "Couldn't unschedule", description: res.error });
      }
    });
  };

  // ── drag payload plumbing ────────────────────────────────────────────────────────
  const onDropDay = (day: number) => {
    const p = dragPayload.current;
    dragPayload.current = null;
    if (!p) return;
    if (p.kind === "idea") scheduleIdeaOnDay(p.id, day);
    else movePostToDay(p.id, day);
  };

  // ── Room + thread handoffs ─────────────────────────────────────────────────────────
  const openRoom = (personas: ReactionPersona[], title: string, contentId: string) => {
    setFocus({ cardId: contentId, title, kind: "Idea", metric: "would watch", personas, conceptText: title });
  };
  const launchThread = (input: string) => {
    setFocus(null);
    router.push(buildThreadLaunchHref({ input, verb: "Make", run: true }));
  };
  const handlePillar = (p: Pillar) => launchThread(`an idea for my “${p.name}” pillar`);

  const cadencePct = Math.min(100, Math.round((next7 / WEEKLY_TARGET) * 100));

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 lg:px-6">
        {/* Header — title + planned density + month nav */}
        <header className="rv-in mb-4 flex items-center gap-3" style={{ animationDelay: "0.02s" }}>
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              Calendar
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
              {warming
                ? "testing today’s ideas on your people…"
                : plannedTotal > 0
                  ? `${plannedTotal} planned · ${pool.length} tested ideas waiting · pre-tested on your people`
                  : "nothing planned yet · pre-tested on your people"}
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

        {/* Up next — the soonest planned post */}
        <div className="rv-in mb-4" style={{ animationDelay: "0.05s" }}>
          <UpNext
            next={upNextRow}
            onRoom={(r) => openRoom(r.personas, r.title, r.content_id)}
            onMake={(r) => launchThread(r.title)}
            onPlanFirst={() => setActiveTab("ideas")}
          />
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start lg:gap-6">
          {/* Hero — the month grid */}
          <div className="rv-in min-w-0" style={{ animationDelay: "0.08s" }}>
            <MonthGrid
              year={year}
              monthIndex={monthIndex}
              monthShort={monthShort}
              todayDay={todayDay}
              plan={plan}
              placing={Boolean(placingId)}
              recommended={recommended}
              onDropDay={onDropDay}
              onDragStartPost={(id) => (dragPayload.current = { kind: "move", id })}
              onDragEndPost={() => (dragPayload.current = null)}
              onTapEmpty={(day) => placingId && scheduleIdeaOnDay(placingId, day)}
              onClickPost={(post) => openRoom(post.personas, post.title, post.contentId)}
            />
            {!isBaseMonth && (
              <p className="mt-3 text-center font-mono text-[10px] text-foreground-muted">
                Planning ahead for {label} — tap an idea, then a day.
              </p>
            )}
          </div>

          {/* Right rail — backlog + cadence + pillars */}
          <aside className="mt-4 flex flex-col gap-3 lg:sticky lg:top-4 lg:mt-0">
            <div className="rv-in" style={{ animationDelay: "0.12s" }}>
              <BacklogRail
                activeTab={activeTab}
                onTab={setActiveTab}
                pool={pool}
                scheduled={scheduledSorted}
                placingId={placingId}
                warming={warming}
                onTapIdea={(id) => setPlacingId((cur) => (cur === id ? null : id))}
                onDragStartIdea={(id) => {
                  dragPayload.current = { kind: "idea", id };
                  setPlacingId(id);
                }}
                onDragEndIdea={() => {
                  dragPayload.current = null;
                  setPlacingId(null);
                }}
                onUnschedule={unscheduleRow}
              />
            </div>

            {/* Cadence readout — the plan's pulse */}
            <div
              className="rv-in flex items-center gap-2.5 rounded-xl border border-border bg-surface-elevated px-3.5 py-3"
              style={{ animationDelay: "0.15s" }}
            >
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-[color:var(--color-positive)]"
                  style={{ width: `${cadencePct}%` }}
                />
              </span>
              <span className="shrink-0 font-mono text-[9.5px] text-foreground-muted">
                Next 7 days · <span className="text-foreground-secondary">{next7} of ~{WEEKLY_TARGET}</span> planned
              </span>
            </div>

            <div className="rv-in" style={{ animationDelay: "0.18s" }}>
              <ContentPillars pillars={pillars} onPillar={handlePillar} />
            </div>
          </aside>
        </div>
      </div>

      {/* Placement banner — the tap-to-place affordance (mobile-friendly, shown while placing) */}
      {placingId && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[color:var(--color-accent)]/50 bg-surface-elevated py-2.5 pl-4 pr-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <span className="text-[12px] text-foreground">
            Placing — tap a <span className="text-[color:var(--color-accent-text)]">★ ringed</span> day, or any day
          </span>
          <button
            type="button"
            onClick={() => setPlacingId(null)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-foreground-muted transition-colors hover:border-border-hover hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tap a planned post / up-next "See the room" → the actual AmbientRoom on its real personas. */}
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
