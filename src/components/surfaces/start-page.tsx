"use client";

/**
 * StartPage — the flagship Surfaces shell (docs/START-PAGE-BUILD-HANDOFF.md §4.2).
 *
 * The responsive start page that replaces the cold composer landing: greeting · stat row ·
 * daily ideas · outliers · month calendar · today's plan · quick actions · the loop, with
 * the app-wide ambient dock + embedded composer pinned at the bottom. Every card is a door
 * to the Room (stubbed here). Mobile-first (the v3 truth); `lg:` adds the desktop main-column
 * + sticky right-rail layout (handoff §3).
 *
 * Built AMBIENT-READY, not ambient-blind: the dock, the card verdicts, and the composer are
 * the real contract seams fed contract-shaped mock data (`mock-room.ts`) — swap stub → real
 * when The Room ships (a graft, not a rebuild).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useCreateThread } from "@/hooks/queries";
import { useBoardStore } from "@/stores/board-store";
import type { QuickAction as QuickActionData, StatCard } from "@/lib/room-contract/mock-room";
import { getMockStartPage } from "@/lib/room-contract/mock-room";
import type { LiveOutlierCard, LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import { buildLivePlan, planToWidgetDays, planToList } from "@/lib/surfaces/month-plan";
import type { CurrentMonth } from "@/lib/calendar/current-month";
import { monthLayout } from "@/lib/calendar/month-layout";
import type { Audience } from "@/lib/audience/audience-types";
import type { Verb } from "@/lib/room-contract/types";
import type { LoopReceipt, LoopAccuracy } from "@/lib/flywheel/loop-summary";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import { Greeting } from "./sections/greeting";
import { GreetingRings } from "./sections/greeting-rings";
import { StatRow, StatRowEmpty } from "./sections/stat-row";
import { DailyIdeas } from "./sections/daily-ideas";
import { OutcomeCapture } from "./sections/outcome-capture";
import { Outliers } from "./sections/outliers";
import { MonthCalendar } from "./sections/month-calendar";
import { TodaysPlan } from "./sections/todays-plan";
import { QuickActions } from "./sections/quick-actions";
import { TheLoop } from "./sections/the-loop";
import { FirstRun } from "./sections/first-run";
// Seam 4 GRAFT — the Room-owned embeddable composer atom (was the surfaces `./embedded-composer`
// stub, now retired). One composer atom, Room-owned, so /start and /home never drift.
import { EmbeddedComposer } from "@/components/app/home/embedded-composer";
import { RoomDrawer, type RoomFocus } from "./room-drawer";
// The loop's "recalibrate" step — propose→confirm nudge, self-gated (renders null below the
// server confidence gate). Mounted read-only here; it owns its own fetch (react-query).
import { RecalibrationNudge } from "@/components/flywheel/recalibration-nudge";


export function StartPage({
  initialFirstRun = false,
  accountStats = null,
  audiences = [],
  initialSelectedAudienceId = null,
  initialOutliers = null,
  initialIdeas = null,
  calendarMonth,
  loopReceipts = [],
  loopAccuracy = null,
}: {
  initialFirstRun?: boolean;
  /** Real stat-row tiles from the connected account (null = no snapshots yet → honest empty). */
  accountStats?: StatCard[] | null;
  /** The user's real audiences (Seam 3) — feeds the app-wide dock switcher (incl. General). */
  audiences?: Audience[];
  /** The user-level last-used audience id (null = General) — the dock's initial selection. */
  initialSelectedAudienceId?: string | null;
  /** Real pre-tested outliers from a fresh cache (Seams 1/2); null = warm lazily on first visit. */
  initialOutliers?: LiveOutlierCard[] | null;
  /** Real pre-tested daily ideas from a fresh cache (Seams 1/2); null = warm lazily on first visit. */
  initialIdeas?: LiveIdeaCard[] | null;
  /** Server-resolved current month (SSR-safe) — the month widget + today's-plan project the real
   *  ideas onto these days (buildLivePlan). Never read `new Date()` client-side (hydration). */
  calendarMonth: CurrentMonth;
  /** Real "the loop" receipts from the user's recent reconciliations (SSR); [] = honest empty. */
  loopReceipts?: LoopReceipt[];
  /** Aggregate match % across measured posts; null = nothing measured yet. */
  loopAccuracy?: LoopAccuracy | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const data = useMemo(() => getMockStartPage(), []);

  // "New thread" — a blank slate on /home where the HomeStarter quick-actions live
  // ("Test an idea on your audience" · "Profile a chat" · "Predict an outcome"). Mirrors the
  // sidebar's handleNewThread exactly: create a fresh thread, reset the composer, land on /home.
  const switchThread = useBoardStore((s) => s.switchThread);
  const createThread = useCreateThread();
  const handleNewThread = async () => {
    try {
      await createThread.mutateAsync();
    } catch {
      // Non-fatal: still reset the composer so the user gets a blank slate.
    }
    switchThread();
    router.push("/home");
  };

  const [firstRun, setFirstRun] = useState(initialFirstRun);

  // The audience key the pre-tested sections are warmed against (audienceKeyOf convention:
  // 'general' or a calibrated UUID). It advances only AFTER a dock switch is persisted (see
  // handleSelectAudience) — the refresh routes server-resolve the audience from that setting, so
  // the re-warm POST must follow the PUT. When it changes, both sections re-sim against the new
  // audience (a cache HIT server-side if that audience was already warmed today).
  const [warmAudienceKey] = useState<string>(
    initialSelectedAudienceId ?? "general",
  );

  // Real pre-tested cards (Seams 1/2). A fresh server cache seeds each section ready; a miss warms
  // lazily on the first visit of the day (owner cadence) — the client gens/sims + persists via the
  // refresh route. Gated off for first-run (no calibrated audience to test against). Re-warms when
  // `warmAudienceKey` changes (a persisted dock switch) so the room re-reacts as the new audience.
  const { items: outliers, status: outliersStatus } = useLazyWarm<LiveOutlierCard>(
    initialOutliers,
    "/api/surfaces/outliers",
    "outliers",
    !initialFirstRun,
    warmAudienceKey,
  );
  const { items: ideas, status: ideasStatus } = useLazyWarm<LiveIdeaCard>(
    initialIdeas,
    "/api/surfaces/ideas",
    "ideas",
    !initialFirstRun,
    warmAudienceKey,
  );

  // Real "plan" (Seams 1/2): the SAME warmed daily-ideas, projected onto upcoming days as a
  // suggested, pre-tested content plan — ONE source of truth feeding the month widget + today's
  // plan (the /calendar workspace reads the same ideas cache, so all three agree). Reactions are
  // real (personasToCardFace); the DAY is a labeled suggestion, never a fabricated reaction.
  const plan = useMemo(
    () => buildLivePlan(ideas, { today: calendarMonth.today, daysInMonth: calendarMonth.daysInMonth }),
    [ideas, calendarMonth.today, calendarMonth.daysInMonth],
  );
  const monthLabel = useMemo(
    () => monthLayout(calendarMonth.year, calendarMonth.monthIndex).label,
    [calendarMonth.year, calendarMonth.monthIndex],
  );
  const widgetDays = useMemo(
    () => planToWidgetDays(plan, calendarMonth.daysInMonth),
    [plan, calendarMonth.daysInMonth],
  );
  const planList = useMemo(() => planToList(plan), [plan]);

  const [selectedAudienceId] = useState<string | null>(
    initialSelectedAudienceId,
  );
  const [verb, setVerb] = useState<Verb>("Make");
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const [focus, setFocus] = useState<RoomFocus | null>(null);
  const [, setReacting] = useState(false);

  // The active audience the dock renders (null = General — the presence shows the General state).
  const activeAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;

  // Index every card so a tapped card can open the Room anchored on it (Seam 1 → 2). Both ideas
  // and outliers carry REAL Flash personas now → the actual Room (AmbientRoom).
  const roomFocusFor = (cardId: string): RoomFocus | null => {
    const idea = ideas.find((i) => i.contentId === cardId);
    if (idea)
      return {
        cardId: idea.contentId,
        title: idea.title,
        kind: "Idea",
        metric: "would watch",
        personas: idea.personas,
        conceptText: idea.title,
      };
    const outlier = outliers.find((o) => o.contentId === cardId);
    if (outlier)
      return {
        cardId: outlier.contentId,
        title: outlier.caption,
        kind: "Outlier",
        metric: "for your people",
        personas: outlier.personas,
        conceptText: outlier.caption,
      };
    return null;
  };

  const openRoom = (cardId: string) => {
    const f = roomFocusFor(cardId);
    if (f) setFocus(f);
  };
  const closeRoom = () => setFocus(null);

  // Seam 4 — the ONE handoff (THE-CONTRACT.md §3), now REAL. Carry the composed intent into the
  // thread host: there is no `/thread/:id` route — the thread lives on /home — so this pushes a
  // `/home?v=…&seed=…&run=1` URL that the /home Composer consumes (maps the verb → its skill,
  // pre-fills the field, and fires on arrival). The explicit send here IS the user's fire.
  // NOTE: the launch doesn't carry the audience id yet, but it no longer needs to — the dock's
  // switcher now persists the USER-level last-used audience (Seam 3, resolveUserAudience), and
  // /home seeds its next thread from that SAME read. So a pick on /start already follows into the
  // thread. (Passing the id explicitly on the URL is a later belt-and-suspenders enhancement.)
  const launchThread = (input: string, launchVerb: Verb) => {
    closeRoom();
    setReacting(true);
    router.push(buildThreadLaunchHref({ input, verb: launchVerb, run: true }));
  };

  const seedComposer = (text: string) =>
    setSeed({ text, nonce: (seed?.nonce ?? 0) + 1 });

  const handleRemix = (outlier: LiveOutlierCard) =>
    launchThread(`Remix ${outlier.handle} — ${outlier.caption}`, "Make");

  const handleDevelop = (f: RoomFocus) => launchThread(f.title, "Make");

  const handleQuickAction = (action: QuickActionData) => {
    setVerb(action.verb);
    seedComposer(""); // focus the composer on the chosen verb
  };

  return (
    <div className="relative min-h-full text-foreground">
      {/* pt-16 on mobile clears the floating hamburger (fixed top-4, ~50px tall) so it never
          overlaps the greeting; md: (≥768, where the sidebar is persistent) drops back to pt-10. */}
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-40 pt-16 md:pt-10 lg:px-6">
        {firstRun ? (
          <FirstRun
            // The real connect = build a personal audience from the creator's @handle
            // (public scrape → ~10 named people). Route into the existing calibration flow;
            // on done it lands on the new audience, and /start then resolves to the briefing.
            onConnect={() => router.push("/audience/new")}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-10">
            {/* Main column — bare sections on the page bg (no heavy #252320 boxes), generous
                vertical rhythm. Less is more: the eye reads greeting → numbers → ideas →
                outliers → what-landed, unboxed, the way Stanley lets content breathe. */}
            <div className="min-w-0 space-y-8 lg:space-y-10">
              <div
                className="rv-in flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                style={{ animationDelay: "0.02s" }}
              >
                <Greeting headline={data.greeting.headline} line={data.greeting.line} />
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* New thread — a clean slate on /home with the HomeStarter quick actions
                      (Test an idea / Profile a chat / Predict an outcome). Sits left of the rings. */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleNewThread()}
                    loading={createThread.isPending}
                    aria-label="Start a new thread"
                    className="shrink-0 gap-1.5 rounded-lg bg-[#1a1a19]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    <span>New thread</span>
                  </Button>
                  <GreetingRings rings={data.rings} />
                </div>
              </div>
              <div className="rv-in" style={{ animationDelay: "0.08s" }}>
                {accountStats ? <StatRow stats={accountStats} /> : <StatRowEmpty />}
              </div>
              <div className="rv-in" style={{ animationDelay: "0.14s" }}>
                <DailyIdeas
                  ideas={ideas}
                  status={ideasStatus}
                  focusedCardId={focus?.cardId ?? null}
                  onOpen={openRoom}
                  onRefresh={() =>
                    toast({ variant: "default", title: "Refreshing ideas", description: "Re-scoring against your room…" })
                  }
                />
                {/* The flywheel's "measure" entry (FLYWHEEL-01): posted a pre-tested idea?
                    Paste the link → real metrics reconciled vs this audience's prediction.
                    Audience-scoped (pins are rank-1/audience-keyed) — copy stays honest. */}
                <div className="mt-3">
                  <OutcomeCapture
                    audienceId={selectedAudienceId}
                    audienceLabel={activeAudience?.name ?? "your audience"}
                  />
                </div>
              </div>
              <div className="rv-in" style={{ animationDelay: "0.2s" }}>
                <Outliers
                  outliers={outliers}
                  status={outliersStatus}
                  onOpen={openRoom}
                  onRemix={handleRemix}
                  onViewAll={() => router.push("/feed")}
                />
              </div>
              {/* The loop — "what actually happened." The closing band: the page reads
                  who-you-are → your-numbers → today's-ideas → outliers → what-landed-last-time,
                  so the retrospective sits where the eye ends. Self-carded. */}
              <div className="rv-in" style={{ animationDelay: "0.26s" }}>
                <TheLoop receipts={loopReceipts} accuracy={loopAccuracy} />
              </div>
            </div>

            {/* Right rail — Stanley's exact 3: Calendar · Your plan · Quick actions. The Loop
                moved to the main column's closing band; Content pillars moved off /start entirely
                (it lives on /grow, the Analyze hub, where planning-strategy belongs — a glance
                page shouldn't carry it). Scrolls WITH the page (a plain column, not a sticky
                inner-scroll pane); stacks under the main column on mobile. */}
            <aside className="mt-8 flex flex-col gap-4 lg:mt-0">
              {/* Recalibration nudge (FLYWHEEL-04/06) — the loop's "recalibrate" step. Surfaces
                  ONLY when THIS audience's outcomes clear the server confidence gate (propose.ts:
                  N≥5 consistent same-direction posts). Renders null below the gate and for
                  General/preset → the self-collapsing wrapper ([&:empty]:hidden drops it from the
                  flex flow) leaves no phantom rail gap in the common empty case. */}
              <div className="rv-in [&:empty]:hidden" style={{ animationDelay: "0.22s" }}>
                {activeAudience && (
                  <RecalibrationNudge
                    audienceId={activeAudience.id}
                    audienceName={activeAudience.name}
                    source="outcome"
                  />
                )}
              </div>
              <div className="rv-in" style={{ animationDelay: "0.24s" }}>
                <MonthCalendar
                  month={monthLabel}
                  year={calendarMonth.year}
                  monthIndex={calendarMonth.monthIndex}
                  today={calendarMonth.today}
                  days={widgetDays}
                  // The widget is the glance; the full month workspace lives at /calendar.
                  // Tapping a day deep-links there anchored on it (planned or empty).
                  onEmptyDay={(d) => router.push(`/calendar?day=${d}`)}
                  onPlannedDay={(d) => router.push(`/calendar?day=${d}`)}
                />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.28s" }}>
                <TodaysPlan
                  plan={planList}
                  year={calendarMonth.year}
                  monthIndex={calendarMonth.monthIndex}
                  onOpen={openRoom}
                  onAdd={() => seedComposer("")}
                />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.32s" }}>
                <QuickActions actions={data.quickActions} onAction={handleQuickAction} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Docked embedded composer — pinned bottom, floats over the page. The backdrop is
          transparent (only a short gradient fade above) so the page content stays visible
          behind/under the composer instead of being masked by a solid block. The empty area
          is click-through (pointer-events-none) so taps land on the content beneath; the
          composer box itself re-enables pointer events. */}
      <div className="pointer-events-none sticky bottom-0 z-30">
        <div className="h-6 bg-gradient-to-t from-[color:var(--color-background)] to-transparent" />
        <div className="px-4 pb-4">
          <div className="pointer-events-auto mx-auto w-full max-w-[720px] lg:max-w-[680px]">
            <EmbeddedComposer
              verb={verb}
              onVerbChange={setVerb}
              seed={seed}
              onLaunch={launchThread}
              onAttach={() =>
                toast({ variant: "default", title: "Attach", description: "Drop a video to Test, or a reference to steer." })
              }
            />
          </div>
        </div>
      </div>

      <RoomDrawer
        focus={focus}
        onClose={closeRoom}
        onDevelop={handleDevelop}
        onOpenFull={() =>
          toast({
            variant: "info",
            title: "The full Room",
            description: "Population swarm · rewrite loop · the whole cast — open in a thread.",
          })
        }
      />

      {/* Dev-only state peek — first-run toggle (dev builds only, never shipped chrome). */}
      {process.env.NODE_ENV === "development" && (
        <button
          type="button"
          onClick={() => setFirstRun((v) => !v)}
          className="fixed bottom-1 right-1 z-50 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[9px] text-foreground-muted opacity-40 transition-opacity hover:opacity-100"
        >
          {firstRun ? "→ briefing" : "→ first-run"}
        </button>
      )}
    </div>
  );
}
