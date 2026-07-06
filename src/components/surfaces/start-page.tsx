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
import { useToast } from "@/components/ui/toast";
import type { Pillar, QuickAction as QuickActionData, StatCard } from "@/lib/room-contract/mock-room";
import { getMockStartPage } from "@/lib/room-contract/mock-room";
import type { LiveOutlierCard, LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import { buildLivePlan, planToWidgetDays, planToList } from "@/lib/surfaces/month-plan";
import type { CurrentMonth } from "@/lib/calendar/current-month";
import { monthLayout } from "@/lib/calendar/month-layout";
import type { Audience } from "@/lib/audience/audience-types";
import type { Verb } from "@/lib/room-contract/types";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import { TopChrome } from "./sections/top-chrome";
import { Greeting } from "./sections/greeting";
import { GreetingRings } from "./sections/greeting-rings";
import { StatRow, StatRowEmpty } from "./sections/stat-row";
import { DailyIdeas } from "./sections/daily-ideas";
import { Outliers } from "./sections/outliers";
import { MonthCalendar } from "./sections/month-calendar";
import { ContentPillars } from "./sections/content-pillars";
import { TodaysPlan } from "./sections/todays-plan";
import { QuickActions } from "./sections/quick-actions";
import { TheLoop } from "./sections/the-loop";
import { FirstRun } from "./sections/first-run";
import { SurfaceDock } from "./surface-dock";
// Seam 4 GRAFT — the Room-owned embeddable composer atom (was the surfaces `./embedded-composer`
// stub, now retired). One composer atom, Room-owned, so /start and /home never drift.
import { EmbeddedComposer } from "@/components/app/home/embedded-composer";
import { RoomDrawer, type RoomFocus } from "./room-drawer";

/** Real audience-row UUID (or null=General) — the only shapes the last-audience persist accepts
 *  (virtual preset ids aren't UUIDs → stay session-local, never PUT). Mirrors composer.tsx. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function StartPage({
  initialFirstRun = false,
  accountStats = null,
  audiences = [],
  initialSelectedAudienceId = null,
  initialOutliers = null,
  initialIdeas = null,
  calendarMonth,
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
}) {
  const router = useRouter();
  const { toast } = useToast();
  const data = useMemo(() => getMockStartPage(), []);

  const [firstRun, setFirstRun] = useState(initialFirstRun);

  // The audience key the pre-tested sections are warmed against (audienceKeyOf convention:
  // 'general' or a calibrated UUID). It advances only AFTER a dock switch is persisted (see
  // handleSelectAudience) — the refresh routes server-resolve the audience from that setting, so
  // the re-warm POST must follow the PUT. When it changes, both sections re-sim against the new
  // audience (a cache HIT server-side if that audience was already warmed today).
  const [warmAudienceKey, setWarmAudienceKey] = useState<string>(
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

  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(
    initialSelectedAudienceId,
  );
  const [verb, setVerb] = useState<Verb>("Make");
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const [focus, setFocus] = useState<RoomFocus | null>(null);
  const [reacting, setReacting] = useState(false);

  // The active audience the dock renders (null = General — the presence shows the General state).
  const activeAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;

  // Switch the dock's audience + persist it as the USER-level last-used (resolveUserAudience), so
  // the pick survives a reload and seeds /home's next thread — mirrors composer.handleSelectAudience.
  // Only a real UUID (or null=General) is a valid last-used pin; presets stay session-local.
  // The in-memory pick reflects instantly (dock); the pre-tested sections re-sim once the persist
  // lands — we advance `warmAudienceKey` in the PUT's success handler (NOT before), because the
  // refresh routes resolve the audience from this persisted setting (the POST must follow the PUT).
  const handleSelectAudience = (audience: Audience) => {
    const newId = audience.is_general ? null : audience.id;
    setSelectedAudienceId(newId);
    if (newId === null || UUID_PATTERN.test(newId)) {
      void fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: newId }),
      })
        .then((r) => {
          // Only re-warm once the switch is actually saved — a failed persist keeps the current
          // cards (honest: never attribute a section to an audience the server didn't record).
          if (r.ok) setWarmAudienceKey(newId ?? "general");
        })
        .catch(() => {});
    }
    // Presets (non-UUID) stay session-local — not persistable, so not server-resolvable → no
    // re-warm; the dock reflects the pick, the sections keep the last real-audience cards.
  };

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

  // Tapping a pillar seeds the composer to Make for that theme (fills the gap it flags).
  const handlePillar = (p: Pillar) => {
    setVerb("Make");
    seedComposer(`an idea for my “${p.name}” pillar`);
  };

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-40 pt-6 lg:px-6">
        <TopChrome
          onLayout={() =>
            toast({ variant: "default", title: "Layout options", description: "Coming soon — density + section order." })
          }
          onTheme={() =>
            toast({ variant: "default", title: "Theme", description: "Flat-warm charcoal is the one skin for now." })
          }
        />

        {firstRun ? (
          <FirstRun
            // The real connect = build a personal audience from the creator's @handle
            // (public scrape → ~10 named people). Route into the existing calibration flow;
            // on done it lands on the new audience, and /start then resolves to the briefing.
            onConnect={() => router.push("/audience/new")}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
            {/* Main column */}
            <div className="min-w-0">
              <div
                className="rv-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                style={{ animationDelay: "0.02s" }}
              >
                <Greeting headline={data.greeting.headline} line={data.greeting.line} />
                <GreetingRings rings={data.rings} />
              </div>
              <div
                className="rv-in mt-4 rounded-2xl bg-[#252320] px-4 py-4"
                style={{ animationDelay: "0.08s" }}
              >
                {accountStats ? <StatRow stats={accountStats} /> : <StatRowEmpty />}
              </div>
              <div
                className="rv-in mt-4 rounded-2xl bg-[#252320] px-4 pb-[18px]"
                style={{ animationDelay: "0.14s" }}
              >
                <DailyIdeas
                  ideas={ideas}
                  status={ideasStatus}
                  focusedCardId={focus?.cardId ?? null}
                  onOpen={openRoom}
                  onRefresh={() =>
                    toast({ variant: "default", title: "Refreshing ideas", description: "Re-scoring against your room…" })
                  }
                />
              </div>
              <div
                className="rv-in mt-4 rounded-2xl bg-[#252320] px-4 pb-[18px]"
                style={{ animationDelay: "0.2s" }}
              >
                <Outliers
                  outliers={outliers}
                  status={outliersStatus}
                  onOpen={openRoom}
                  onRemix={handleRemix}
                  onViewAll={() => router.push("/feed")}
                />
              </div>
            </div>

            {/* Right rail — stacks under the main column on mobile (prototype order) */}
            <aside className="mt-[18px] flex flex-col gap-3 lg:mt-[18px] lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto lg:pr-0.5 lg:sticky lg:top-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="rv-in" style={{ animationDelay: "0.24s" }}>
                <ContentPillars pillars={data.pillars} onPillar={handlePillar} />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.26s" }}>
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
              <div className="rv-in" style={{ animationDelay: "0.3s" }}>
                <TodaysPlan
                  plan={planList}
                  year={calendarMonth.year}
                  monthIndex={calendarMonth.monthIndex}
                  onOpen={openRoom}
                  onAdd={() => seedComposer("")}
                />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.34s" }}>
                <QuickActions actions={data.quickActions} onAction={handleQuickAction} />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.38s" }}>
                <TheLoop receipts={data.receipts} accuracy={data.accuracy} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Docked ambient presence + embedded composer — pinned bottom, one object */}
      <div className="sticky bottom-0 z-30">
        <div className="pointer-events-none h-6 bg-gradient-to-t from-[color:var(--color-background)] to-transparent" />
        <div className="bg-[color:var(--color-background)] px-4 pb-4">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 lg:max-w-[680px]">
            <SurfaceDock
              audience={activeAudience}
              audiences={audiences}
              selectedAudienceId={selectedAudienceId}
              onSelectAudience={handleSelectAudience}
              reacting={reacting}
            />
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
