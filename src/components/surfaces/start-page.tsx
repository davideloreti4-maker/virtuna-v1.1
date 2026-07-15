"use client";

/**
 * StartPage — the flagship briefing shell (docs/START-PAGE-BUILD-HANDOFF.md §4.2).
 *
 * The launch briefing: greeting · stat row · daily ideas + outcome capture · the loop, with the
 * ambient Room reachable from every idea card. Mobile-first; `lg:` adds the main column + a right
 * rail (quick actions + the recalibrate nudge).
 *
 * MVP launch cut (lane/launch-prep, 2026-07-15): the hero is now REAL, not mock —
 *  • greeting = the user's name + time of day (was a hard-coded mock headline),
 *  • rings = the live loop accuracy + the sample it's measured across (null → hidden, never a
 *    fabricated score on a cold account),
 *  • quick actions = static product copy hoisted off the mock-room stub.
 * The Outliers, Month Calendar and Today's Plan sections were removed alongside Discover/Calendar
 * (off the core loop); restore them from git when those surfaces come back.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useCreateThread } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { useBoardStore } from "@/stores/board-store";
import type { QuickAction as QuickActionData, StatCard, RingStat } from "@/lib/room-contract/mock-room";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import type { Audience } from "@/lib/audience/audience-types";
import type { Verb } from "@/lib/room-contract/types";
import type { LoopReceipt, LoopAccuracy } from "@/lib/flywheel/loop-summary";
import { buildThreadLaunchHref } from "@/lib/room-contract/thread-launch";
import { Greeting } from "./sections/greeting";
import { GreetingRings } from "./sections/greeting-rings";
import { StatRow, StatRowEmpty } from "./sections/stat-row";
import { DailyIdeas } from "./sections/daily-ideas";
import { OutcomeCapture } from "./sections/outcome-capture";
import { QuickActions } from "./sections/quick-actions";
import { TheLoop } from "./sections/the-loop";
import { FirstRun } from "./sections/first-run";
import { RoomDrawer, type RoomFocus } from "./room-drawer";
// The loop's "recalibrate" step — propose→confirm nudge, self-gated (renders null below the
// server confidence gate). Mounted read-only here; it owns its own fetch (react-query).
import { RecalibrationNudge } from "@/components/flywheel/recalibration-nudge";

// The four composer entry verbs — static product copy (not per-user data), hoisted off the old
// mock-room stub. Each routes to the /home composer with its verb pre-selected.
const START_QUICK_ACTIONS: QuickActionData[] = [
  { icon: "sparkle", label: "Make ideas", desc: "ranked + pre-tested", verb: "Make" },
  { icon: "play", label: "Test a real video", desc: "the full Read before you post", verb: "Test" },
  { icon: "chat", label: "Ask the room", desc: "a raw thought, react instantly", verb: "Ask" },
  { icon: "repeat", label: "Repurpose a winner", desc: "remix a top performer", verb: "Make" },
];

export function StartPage({
  initialFirstRun = false,
  accountStats = null,
  audiences = [],
  initialSelectedAudienceId = null,
  initialIdeas = null,
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
  /** Real pre-tested daily ideas from a fresh cache (Seams 1/2); null = warm lazily on first visit. */
  initialIdeas?: LiveIdeaCard[] | null;
  /** Real "the loop" receipts from the user's recent reconciliations (SSR); [] = honest empty. */
  loopReceipts?: LoopReceipt[];
  /** Aggregate match % across measured posts; null = nothing measured yet → the rings hide. */
  loopAccuracy?: LoopAccuracy | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: profile } = useProfile();

  // "New thread" — a blank slate on /home where the HomeStarter quick-actions live. Mirrors the
  // sidebar's handleNewThread: create a fresh thread, reset the composer, land on /home.
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

  // Real greeting (was a mock headline): the user's first name + time of day. The daypart is
  // computed AFTER mount — server and client time zones differ, so rendering it during SSR would
  // hydrate-mismatch. Starts neutral ("Welcome back"), resolves to "Good {morning…}" on mount.
  const firstName = profile?.name?.trim().split(/\s+/)[0] ?? "";
  const [daypart, setDaypart] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    setDaypart(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
  }, []);
  const greetingHeadline = `${daypart ? `Good ${daypart}` : "Welcome back"}${firstName ? `, ${firstName}` : ""} 👋`;

  // Two real loop rings from the reconciliation history: accuracy (the moat metric — the ONE
  // terracotta arc) + the sample it's measured across. Both absent together until an outcome is
  // captured (honest: no fabricated score on a cold account). The Measured arc fills toward the
  // N≥5 confidence gate (propose.ts) — a partial ring reads "sample still building".
  const loopRings = useMemo<RingStat[]>(() => {
    if (!loopAccuracy) return [];
    return [
      { icon: "trend", pct: loopAccuracy.pct / 100, value: `${loopAccuracy.pct}`, accent: true, label: "Accuracy" },
      { icon: "upright", pct: Math.min(loopAccuracy.n / 5, 1), value: `${loopAccuracy.n}`, accent: false, label: "Measured" },
    ];
  }, [loopAccuracy]);

  // The audience key the pre-tested ideas are warmed against (audienceKeyOf convention:
  // 'general' or a calibrated UUID). Set once from the server-resolved selection.
  const [warmAudienceKey] = useState<string>(initialSelectedAudienceId ?? "general");

  // Real pre-tested ideas (Seams 1/2). A fresh server cache seeds the section ready; a miss warms
  // lazily on the first visit of the day. Gated off for first-run (no calibrated audience yet).
  const { items: ideas, status: ideasStatus } = useLazyWarm<LiveIdeaCard>(
    initialIdeas,
    "/api/surfaces/ideas",
    "ideas",
    !initialFirstRun,
    warmAudienceKey,
  );

  const [selectedAudienceId] = useState<string | null>(initialSelectedAudienceId);
  const [focus, setFocus] = useState<RoomFocus | null>(null);
  const [, setReacting] = useState(false);

  // The active audience the dock renders (null = General — the presence shows the General state).
  const activeAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;

  // A tapped idea card opens the Room anchored on it (Seam 1 → 2), carrying its REAL Flash personas.
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
    return null;
  };

  const openRoom = (cardId: string) => {
    const f = roomFocusFor(cardId);
    if (f) setFocus(f);
  };
  const closeRoom = () => setFocus(null);

  // Seam 4 — the ONE handoff, REAL: carry the composed intent into the thread host. There is no
  // `/thread/:id` route (the thread lives on /home), so this pushes `/home?v=…&seed=…&run=1` that
  // the /home Composer consumes (maps verb → skill, pre-fills, fires on arrival).
  const launchThread = (input: string, launchVerb: Verb) => {
    closeRoom();
    setReacting(true);
    router.push(buildThreadLaunchHref({ input, verb: launchVerb, run: true }));
  };

  const handleDevelop = (f: RoomFocus) => launchThread(f.title, "Make");

  // /start is a glance page — creation lives on /home. Quick actions open the real /home composer
  // with the chosen verb pre-selected + field focused (run:false = pre-fill only, the user's own
  // send is the fire).
  const handleQuickAction = (action: QuickActionData) => {
    router.push(buildThreadLaunchHref({ input: "", verb: action.verb, run: false }));
  };

  return (
    <div className="relative min-h-full text-foreground">
      {/* pt-16 on mobile clears the floating hamburger (fixed top-4, ~50px tall) so it never
          overlaps the greeting; md: (≥768, where the sidebar is persistent) drops back to pt-10. */}
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-16 md:pt-10 lg:px-6">
        {firstRun ? (
          <FirstRun
            // The real connect = build a personal audience from the creator's @handle
            // (public scrape → ~10 named people). Route into the existing calibration flow;
            // on done it lands on the new audience, and /start then resolves to the briefing.
            onConnect={() => router.push("/audience/new")}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-10">
            {/* Main column — bare sections on the page bg (no heavy boxes), generous vertical
                rhythm. The eye reads greeting → numbers → ideas → what-landed, unboxed. */}
            <div className="min-w-0 space-y-8 lg:space-y-10">
              <div
                className="rv-in flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                style={{ animationDelay: "0.02s" }}
              >
                <Greeting headline={greetingHeadline} line="" />
                <div className="flex shrink-0 items-start gap-3 sm:gap-4">
                  {/* New thread — a clean slate on /home with the HomeStarter quick actions.
                      Sits left of the rings, top-aligned with the ring glyphs. */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleNewThread()}
                    loading={createThread.isPending}
                    aria-label="Start a new thread"
                    className="h-10 shrink-0 gap-1.5 rounded-lg bg-[#1a1a19]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    <span>New thread</span>
                  </Button>
                  {/* Rings hide entirely until the loop has something real to show. */}
                  {loopRings.length > 0 && <GreetingRings rings={loopRings} />}
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
              {/* The loop — "what actually happened." The closing band: who-you-are → your-numbers
                  → today's-ideas → what-landed-last-time, so the retrospective sits where the eye ends. */}
              <div className="rv-in" style={{ animationDelay: "0.26s" }}>
                <TheLoop receipts={loopReceipts} accuracy={loopAccuracy} />
              </div>
            </div>

            {/* Right rail — the recalibrate nudge (self-hiding) + quick actions. Calendar, Today's
                plan and Outliers were removed with the launch cut; The Loop lives in the main
                column. Scrolls WITH the page; stacks under the main column on mobile. */}
            <aside className="mt-8 flex flex-col gap-4 lg:mt-0">
              {/* Recalibration nudge (FLYWHEEL-04/06) — the loop's "recalibrate" step. Surfaces
                  ONLY when THIS audience's outcomes clear the server confidence gate (N≥5). Renders
                  null below the gate and for General/preset → the self-collapsing wrapper
                  ([&:empty]:hidden) leaves no phantom rail gap in the common empty case. */}
              <div className="rv-in [&:empty]:hidden" style={{ animationDelay: "0.22s" }}>
                {activeAudience && (
                  <RecalibrationNudge
                    audienceId={activeAudience.id}
                    audienceName={activeAudience.name}
                    source="outcome"
                  />
                )}
              </div>
              <div className="rv-in" style={{ animationDelay: "0.32s" }}>
                <QuickActions actions={START_QUICK_ACTIONS} onAction={handleQuickAction} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* No docked composer on /start (2026-07-13): this is a glance/briefing page, not a
          creation surface. Creation lives on /home — reached via "New thread", the sidebar,
          every idea card (a door), and Quick actions (which route to /home with the composer focused). */}

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
