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
import { getMockStartPage, MOCK_AUDIENCES } from "@/lib/room-contract/mock-room";
import type { OutlierCard as OutlierCardData } from "@/lib/room-contract/mock-room";
import type { Verb } from "@/lib/room-contract/types";
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
import { EmbeddedComposer } from "./embedded-composer";
import { RoomDrawer, type RoomFocus } from "./room-drawer";

export function StartPage({
  initialFirstRun = false,
  accountStats = null,
}: {
  initialFirstRun?: boolean;
  /** Real stat-row tiles from the connected account (null = no snapshots yet → honest empty). */
  accountStats?: StatCard[] | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const data = useMemo(() => getMockStartPage(), []);

  const [firstRun, setFirstRun] = useState(initialFirstRun);
  const [audienceId, setAudienceId] = useState(MOCK_AUDIENCES[0]!.id);
  const [verb, setVerb] = useState<Verb>("Make");
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const [focus, setFocus] = useState<RoomFocus | null>(null);
  const [reacting, setReacting] = useState(false);

  const activeAudience = MOCK_AUDIENCES.find((a) => a.id === audienceId) ?? MOCK_AUDIENCES[0]!;

  // Index every card so a tapped card can open the Room anchored on it (Seam 1 → 2).
  const roomFocusFor = (cardId: string): RoomFocus | null => {
    const idea = data.ideas.find((i) => i.cardId === cardId);
    if (idea) return { read: idea.read, title: idea.title, kind: "Idea", metric: idea.metric };
    const outlier = data.outliers.find((o) => o.cardId === cardId);
    if (outlier)
      return { read: outlier.read, title: outlier.caption, kind: "Outlier", metric: outlier.metric };
    return null;
  };

  const openRoom = (cardId: string) => {
    const f = roomFocusFor(cardId);
    if (f) setFocus(f);
  };
  const closeRoom = () => setFocus(null);

  // Seam 4 — the ONE handoff. In the app: create thread with audience + seed → /thread/:id.
  // Stubbed until The Room's composer rework lands (don't couple to the old /home composer).
  const launchThread = (input: string, launchVerb: Verb) => {
    closeRoom();
    setReacting(true);
    window.setTimeout(() => setReacting(false), 1600);
    toast({
      variant: "info",
      title: `${launchVerb} · launching a thread`,
      description: `“${input.length > 48 ? `${input.slice(0, 47)}…` : input}” — with ${activeAudience.name}. (Seam 4: create thread → /thread/:id, carrying audience + seed.)`,
    });
  };

  const seedComposer = (text: string) =>
    setSeed({ text, nonce: (seed?.nonce ?? 0) + 1 });

  const handleRemix = (outlier: OutlierCardData) =>
    launchThread(`Remix @${outlier.handle} — ${outlier.caption}`, "Make");

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
                  ideas={data.ideas}
                  focusedCardId={focus?.read.contentId ?? null}
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
                  outliers={data.outliers}
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
                  month={data.calendar.month}
                  today={data.calendar.today}
                  days={data.calendar.days}
                  // The widget is the glance; the full month workspace lives at /calendar.
                  // Tapping a day deep-links there anchored on it (planned or empty).
                  onEmptyDay={(d) => router.push(`/calendar?day=${d}`)}
                  onPlannedDay={(d) => router.push(`/calendar?day=${d}`)}
                />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.3s" }}>
                <TodaysPlan plan={data.plan} onOpen={openRoom} onAdd={() => seedComposer("")} />
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
              audience={firstRun ? null : activeAudience}
              audiences={MOCK_AUDIENCES}
              onSwitch={setAudienceId}
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
            description: "Persona chat · population · rewrite — grafted from The Room at integration.",
          })
        }
        onAskPerson={(name) =>
          toast({ variant: "default", title: `Ask ${name}`, description: "Persona chat lives in the full Room." })
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
