"use client";

/**
 * /dev/cards — the thread design gallery (dev-only reference), 1:1 with a real thread.
 *
 * Group A mounts the REAL per-skill *-thread-view wrappers (IdeasThreadView, HooksThreadView, …)
 * in their just-completed state (userTurn → intro → progress receipt → cards → outro), fed
 * schema-valid fixtures. Group B renders the in-thread blocks through the SAME <MessageBlocks />
 * dispatch the thread uses (profile / simulate / predict / text-Read / primitives).
 *
 * Because every card here flows through the shipped renderers, editing any thread UI updates
 * this page live (HMR) — it can never drift from production the way the old static HTML sketch did.
 *
 * Lives in the (app) group to inherit AppShell + QueryClient/Toast/Tooltip providers
 * (SaveAffordance needs the query client). AppShell owns <main>; this is a plain content div.
 */

import { ThreadTurn, type LiveRun } from "@/components/thread/thread-turn";
import { ThreadShell } from "@/components/thread/thread-shell";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { RemixCardRenderer } from "@/components/thread/remix-card-block";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import { AudiencePresence } from "@/components/audience-lens/audience-presence";
import { AmbientOverviewRail } from "@/components/audience-lens/v2/AmbientOverviewRail";
import { AmbientOverviewSheet } from "@/components/audience-lens/v2/AmbientOverviewSheet";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import {
  CREATOR_LIVE_TEMPLATE,
  CREATOR_LIVE_TEXT_TEMPLATE,
} from "@/components/audience-lens/v2/detail-live-fixture";
import { ArmCard } from "@/components/audience-lens/v2/AmbientSimulate";
import { SimDoorReading } from "@/components/audience-lens/v2/SimulateDoorHost";
import { CollectStep, IntakeStep } from "@/components/audience-lens/v2/SimulateIntake";
import { buildSimulateData } from "@/lib/surfaces/ambient-v2-adapters";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import { useState, useEffect } from "react";
import { ProgressChecklist, SkillProgress } from "@/components/thread/progress-checklist";
import type { RunEvidence } from "@/lib/tools/evidence";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import { Reading } from "@/components/reading/reading";
import { ReadingSkeleton } from "@/components/reading/reading-skeleton";
import {
  makeReadingResult,
  makeUnavailableResult,
  makePartialResult,
  makeApolloNullResult,
  makeEmptyHeatmapResult,
  makeEmptyPersonasResult,
  makeSilentPersonasResult,
  makeEmptySegmentsResult,
  makeNoBehavioralResult,
} from "@/components/reading/__tests__/fixtures/reading-fixture";
import {
  IDEA_BLOCKS,
  HOOK_BLOCKS,
  SCRIPT_BLOCKS,
  REMIX_BLOCKS,
  REMIX_BEATS_PREVIEW,
  CHAT_BLOCKS,
  EXPLORE_BLOCKS,
  ACCOUNT_BLOCK,
  BLOCK_SECTIONS,
  COMPOSED_CARD_FIXTURES,
  COMPOSED_CARD_SECTIONS,
  SINGLE_AUDIENCE_READ_BLOCK,
  USER_TURNS,
  FOLLOWUPS,
  POPULATION_1K,
  doneStages,
} from "./fixtures";

const AUDIENCE = "Bootstrapped Founders";
const noop = () => {};

// ── The per-skill view adapters ──────────────────────────────────────────────────
//
// The seven `*-thread-view.tsx` wrappers this gallery used to mount are GONE. They were
// per-skill LIVE surfaces gated on `activeTool`, and that gating is exactly what made a
// finished run live outside the thread until the creator switched skills. Production now
// renders every turn — live or reloaded — through ONE <ThreadTurn>.
//
// These adapters keep the gallery's call sites intact while routing them at the real
// component, so this page stays what its header promises: 1:1 with a real thread. If it
// re-forked from production it would be worse than useless — a stale reference that reads
// as authoritative (which has already cost a design session once).
//
// A run's `live` half carries what a settled turn cannot re-derive (the stage receipt, the
// engine's outro text, degrade notices). Passing it with `isStreaming: false` is precisely
// the just-completed state each entry below wants to show.

type GalleryTurnProps = {
  userTurn?: string | null;
  blocks: unknown[];
  live?: Partial<LiveRun> & { skill: LiveRun["skill"] };
};

function GalleryTurn({ userTurn, blocks, live }: GalleryTurnProps) {
  return (
    <ThreadShell userTurn={undefined}>
      <ThreadTurn
        userTurn={userTurn ?? null}
        blocks={blocks}
        live={live ? { isStreaming: false, ...live } : null}
      />
    </ThreadShell>
  );
}

/** Shared shape of the generative skill views (ideas / hooks / script / remix). */
type SkillViewProps = {
  streamingBlocks?: unknown[];
  persistedBlocks?: unknown[];
  stages?: LiveRun["stages"];
  followupText?: string | null;
  warnings?: string[];
  outliersAvailable?: boolean;
  onFindOutliers?: () => void;
  isStreaming?: boolean;
  error?: string | null;
  platform?: string;
  userTurn?: string | null;
  audienceLabel?: string;
  inputHookLine?: string | null;
  // Accepted and ignored: the card CTAs ride context in production, never props.
  statusMessage?: string | null;
  onTestHook?: () => void;
  onWriteScriptHook?: () => void;
  onTestScript?: () => void;
  onDevelop?: () => void;
  onRetry?: () => void;
  skillLabel?: string;
};

function skillView(skill: LiveRun["skill"]) {
  return function SkillView(p: SkillViewProps) {
    const blocks = [...(p.streamingBlocks ?? []), ...(p.persistedBlocks ?? [])];
    return (
      <GalleryTurn
        userTurn={p.userTurn}
        blocks={blocks}
        live={{
          skill,
          isStreaming: p.isStreaming ?? false,
          stages: p.stages ?? [],
          followupText: p.followupText ?? null,
          warnings: p.warnings ?? [],
          error: p.error ?? null,
          outliersAvailable: p.outliersAvailable ?? false,
          onFindOutliers: p.onFindOutliers,
          onRetry: p.onRetry,
          audienceLabel: p.audienceLabel ?? AUDIENCE,
          platform: p.platform ?? "tiktok",
          hookLine: p.inputHookLine ?? null,
        }}
      />
    );
  };
}

const IdeasThreadView = skillView("ideas");
const HooksThreadView = skillView("hooks");
const ScriptThreadView = skillView("script");
const RemixThreadView = skillView("remix");
const ExploreThreadView = skillView("explore");

/** Chat turns carry no run stamp — <ThreadTurn> classifies them from their block types. */
function ChatThreadView(p: {
  persistedBlocks?: unknown[];
  persistedTurns?: { userTurn?: string | null; blocks: unknown[] }[];
  streamingBlocks?: unknown[];
  userTurn?: string | null;
  [k: string]: unknown;
}) {
  const turns =
    p.persistedTurns ??
    [{ userTurn: p.userTurn ?? null, blocks: [...(p.persistedBlocks ?? []), ...(p.streamingBlocks ?? [])] }];
  return (
    <ThreadShell userTurn={undefined}>
      {turns.map((t, i) => (
        <ThreadTurn key={i} userTurn={t.userTurn ?? null} blocks={t.blocks} />
      ))}
    </ThreadShell>
  );
}

function AccountReadThreadView(p: {
  block?: unknown;
  userTurn?: string | null;
  [k: string]: unknown;
}) {
  return <GalleryTurn userTurn={p.userTurn} blocks={p.block ? [p.block] : []} live={{ skill: "account" }} />;
}

// ── Group A: the real skill thread views, in their just-completed state ──────────
// Each is fed the fresh-run-complete combo (streamingBlocks populated + isStreaming:false +
// done stages + followupText) so it renders intro + progress receipt + cards + outro — exactly
// what you see the moment a run finishes.
const THREAD_VIEWS: { id: string; label: string; note: string; node: React.ReactNode }[] = [
  {
    id: "ideas",
    label: "Ideas",
    note: "Make → Ideas skill. Full run: user turn → intro → progress receipt → idea cards → outro.",
    node: (
      <IdeasThreadView
        persistedBlocks={[]}
        streamingBlocks={IDEA_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Simulating your audience", "Ranking"])}
        followupText={FOLLOWUPS.ideas}
        isStreaming={false}
        error={null}
        platform="tiktok"
        userTurn={USER_TURNS.ideas}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "ideas-outliers",
    label: "Ideas (find new outliers)",
    note: "Same run, with the `outliers` SSE event populated — the shared OutliersOffer affordance below the cards. Set by the server only when a live scrape could find outliers this (ungrounded/partial) run couldn't.",
    node: (
      <IdeasThreadView
        persistedBlocks={[]}
        streamingBlocks={IDEA_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Simulating your audience", "Ranking"])}
        followupText={FOLLOWUPS.ideas}
        outliersAvailable
        onFindOutliers={noop}
        isStreaming={false}
        error={null}
        platform="tiktok"
        userTurn={USER_TURNS.ideas}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "hooks",
    label: "Hooks",
    note: "Make → Hooks skill. Ranked hook cards with 'Test full →' / 'Write script →' handoffs.",
    node: (
      <HooksThreadView
        persistedBlocks={[]}
        streamingBlocks={HOOK_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Simulating your audience", "Ranking"])}
        followupText={FOLLOWUPS.hooks}
        warnings={[]}
        isStreaming={false}
        error={null}
        platform="tiktok"
        onTestHook={noop}
        onWriteScriptHook={noop}
        userTurn={USER_TURNS.hooks}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "hooks-projected",
    label: "Hooks (projected — the shape a real run actually emits)",
    note: "⚠️ The `Hooks` entry above carries NO `provenance`, so it renders as a MEASURED card — a shape the generation path has not emitted since 2026-07-22. This is the real one. On a projected card the sim door prints no band and no fraction (sim-door.tsx:118 gates both on `!projected`), and since 2026-08-05 there is no `#N` gutter either: `rank` comes from sorting on `hook.personaStops` — the hook-writing model's estimate of its OWN hooks (hooks-runner.ts:669, \"the WRITER'S self-estimate, not a measured room reaction\") — so a numeral asserted a ranking nothing measured. Diff against `Hooks` above, which keeps its `#1` because a measured card earned it. The ORDER is identical in both: an order claims sequence, a numeral claims a measurement.",
    node: (
      <HooksThreadView
        persistedBlocks={[]}
        streamingBlocks={HOOK_BLOCKS.map((b) => ({
          ...b,
          props: { ...(b.props as Record<string, unknown>), provenance: "projected" },
        })) as typeof HOOK_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Ranking"])}
        followupText={FOLLOWUPS.hooks}
        warnings={[]}
        isStreaming={false}
        error={null}
        platform="tiktok"
        onTestHook={noop}
        onWriteScriptHook={noop}
        userTurn={USER_TURNS.hooks}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "hooks-degraded",
    label: "Hooks (degraded run)",
    note: "Same run, with the `warning` SSE event populated — the RunWarnings notice below the cards. Fires on per-persona targeting drift or a grounding fall-back; empty on a clean run.",
    node: (
      <HooksThreadView
        persistedBlocks={[]}
        streamingBlocks={HOOK_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Simulating your audience", "Ranking"])}
        followupText={FOLLOWUPS.hooks}
        warnings={[
          'Hook "Editing is a trap." targeted "The Overwhelmed Beginner" but was assigned "The Plateaued Pro" — reporting the model\'s target',
          "grounding degraded to ungrounded — no proven outliers matched this ask",
        ]}
        isStreaming={false}
        error={null}
        platform="tiktok"
        onTestHook={noop}
        onWriteScriptHook={noop}
        userTurn={USER_TURNS.hooks}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "hooks-outliers",
    label: "Hooks (find new outliers)",
    note: "Same run, with the `outliers` SSE event populated — the OutliersOffer affordance below the cards. The server sets it only when a live scrape could find outliers this (ungrounded/partial) run couldn't; tapping it authorizes the scan. Absent on a clean grounded run or a non-scrapable platform.",
    node: (
      <HooksThreadView
        persistedBlocks={[]}
        streamingBlocks={HOOK_BLOCKS}
        statusMessage={null}
        stages={doneStages(["Generating", "Simulating your audience", "Ranking"])}
        followupText={FOLLOWUPS.hooks}
        warnings={[]}
        outliersAvailable
        onFindOutliers={noop}
        isStreaming={false}
        error={null}
        platform="tiktok"
        onTestHook={noop}
        onWriteScriptHook={noop}
        userTurn={USER_TURNS.hooks}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "script",
    label: "Script",
    note: "Make → Script skill. Beat structure card; intro cites the input hook it was anchored on.",
    node: (
      <ScriptThreadView
        persistedBlocks={[]}
        streamingBlocks={SCRIPT_BLOCKS}
        stages={doneStages(["Generating", "Simulating your audience"])}
        followupText={FOLLOWUPS.script}
        isStreaming={false}
        error={null}
        platform="tiktok"
        inputHookLine="Stop editing your videos. Do this instead."
        onTestScript={noop}
        userTurn={USER_TURNS.script}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "script-outliers",
    label: "Script (find new outliers)",
    note: "Same run, with the `outliers` SSE event populated — the shared OutliersOffer affordance below the card. Set by the server only when a live scrape could find outliers this (ungrounded/partial) run couldn't.",
    node: (
      <ScriptThreadView
        persistedBlocks={[]}
        streamingBlocks={SCRIPT_BLOCKS}
        stages={doneStages(["Generating", "Simulating your audience"])}
        followupText={FOLLOWUPS.script}
        outliersAvailable
        onFindOutliers={noop}
        isStreaming={false}
        error={null}
        platform="tiktok"
        inputHookLine="Stop editing your videos. Do this instead."
        onTestScript={noop}
        userTurn={USER_TURNS.script}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "remix",
    label: "Remix",
    note: "Make → Remix skill. Niche-adapted hook + source decode; 'Develop into hooks →' handoff.",
    node: (
      <RemixThreadView
        persistedBlocks={[]}
        streamingBlocks={REMIX_BLOCKS}
        stages={doneStages(["Resolving", "Decoding", "Adapting", "Simulating your audience"])}
        followupText={FOLLOWUPS.remix}
        isStreaming={false}
        error={null}
        platform="tiktok"
        onDevelop={noop}
        userTurn={USER_TURNS.remix}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "remix-shoot-sheet",
    label: "Remix · shoot sheet",
    note: "The SAME remix card with its beat-by-beat sheet mounted. The entry above renders without one — `RemixBeats` fetches by blueprintId and the fixture has none, so in production the section only appears once a run has written a remix_blueprints row. Mounted directly (not through the thread view) because the sheet is a component prop, never a block field: the model must not be able to hand the card a sheet.",
    node: (
      <RemixCardRenderer
        block={REMIX_BLOCKS[0]!}
        beatsPreview={REMIX_BEATS_PREVIEW}
        onDevelop={noop}
      />
    ),
  },
  {
    id: "chat",
    label: "Ask (chat)",
    note: "Chat-as-agent answer. A plain answer offers the generative entry points as follow-up chips (context-aware — see the skill-specific sets below).",
    node: (
      <ChatThreadView
        persistedBlocks={CHAT_BLOCKS}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
        userTurn={USER_TURNS.chat}
        skillLabel="Ask"
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "chat-followups",
    label: "Chat follow-ups",
    note: "The context-aware follow-up chips (chat-followups.ts). Each row is a completed chat turn of a different kind — the chips reflect WHAT RAN, never the old hardcoded idea handoff. Tapping sends the prompt back into the same chat thread.",
    node: (
      <div className="flex flex-col gap-6">
        {[
          { k: "after a plain answer", turn: { userTurn: "how often should I post?", blocks: [{ type: "markdown", props: { text: "Three times a week beats daily if each one earns the slot." } }] } },
          { k: "after ideas ran", turn: { userTurn: "give me ideas about morning routines", blocks: IDEA_BLOCKS.slice(0, 1) } },
          { k: "after hooks ran", turn: { userTurn: "write hooks for the 5am myth", blocks: HOOK_BLOCKS.slice(0, 1) } },
          { k: "after a script ran", turn: { userTurn: "write a script for it", blocks: SCRIPT_BLOCKS.slice(0, 1) } },
        ].map(({ k, turn }) => (
          <div key={k} className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.06em] text-foreground-muted">{k}</p>
            <ChatThreadView
              persistedBlocks={[]}
              persistedTurns={[turn]}
              streamingBlocks={[]}
              isStreaming={false}
              coldStart={false}
              nudgeShown={false}
              error={null}
              platform="tiktok"
              onFollowup={noop}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "in-thread-link",
    label: "In-thread link field (remix)",
    note: "The agent-surfaced input affordance (input-request block → request_input tool, action:remix). When you ask to remix/adapt a video without a link, the agent shows this inline LINK field IN THE THREAD; pasting a link runs the Remix in-place. Rendered via MessageBlocks (proves the registry routes input-request → the renderer).",
    node: (
      <div className="flex flex-col gap-4">
        <ChatThreadView
          persistedBlocks={[]}
          persistedTurns={[
            {
              userTurn: "adapt this trending video for me",
              blocks: [
                {
                  type: "input-request",
                  props: {
                    kind: "link",
                    action: "remix",
                    label: "Paste the video link and I'll adapt it for your audience.",
                    placeholder: "https://…",
                    platform: "tiktok",
                  },
                },
                { type: "markdown", props: { text: "Drop the link and I'll adapt it for your audience.", origin: "chat-agent" } },
              ],
            },
          ]}
          streamingBlocks={[]}
          isStreaming={false}
          coldStart={false}
          nudgeShown={false}
          error={null}
          platform="tiktok"
          onFollowup={noop}
        />
      </div>
    ),
  },
  {
    id: "in-thread-account",
    label: "In-thread account field (none)",
    note: "request_input(action:account) → a kind:'none' field: it needs nothing typed, so it renders a single confirm-to-run button. The tap runs the Account Read on its own 300s route (persist:true) and reloads the thread.",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        persistedTurns={[
          {
            userTurn: "read my account",
            blocks: [
              {
                type: "input-request",
                props: {
                  kind: "none",
                  action: "account",
                  label: "I'll read your latest posts and pull the patterns.",
                  platform: "tiktok",
                },
              },
              { type: "markdown", props: { text: "Press the button and I'll read your account.", origin: "chat-agent" } },
            ],
          },
        ]}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
      />
    ),
  },
  {
    id: "in-thread-explore",
    label: "In-thread niche field (explore)",
    note: "request_input(action:explore) → a kind:'text' field for the niche (empty is allowed — an un-niched trending pull). Submit runs Explore on its own route and reloads.",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        persistedTurns={[
          {
            userTurn: "show me what's working right now",
            blocks: [
              {
                type: "input-request",
                props: {
                  kind: "text",
                  action: "explore",
                  label: "Name a niche or a competitor to scan — or leave it blank to pull your niche.",
                  placeholder: "e.g. fitness coaches, @creator…",
                  platform: "tiktok",
                },
              },
              { type: "markdown", props: { text: "Name a niche below, or leave it blank and I'll pull your niche.", origin: "chat-agent" } },
            ],
          },
        ]}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
      />
    ),
  },
  {
    id: "in-thread-read",
    label: "In-thread concept field (read)",
    note: "request_input(action:read) → a kind:'text' field PRE-FILLED with the concept the model extracted from the message (still editable). Submit POSTs to /api/tools/read and reloads with the multi-audience-read card.",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        persistedTurns={[
          {
            userTurn: "what would my audience think of a video on cold plunges?",
            blocks: [
              {
                type: "input-request",
                props: {
                  kind: "text",
                  action: "read",
                  label: "What should I run past your audience?",
                  placeholder: "Paste a hook, concept, or draft…",
                  prefill: "a video on cold plunges",
                  platform: "tiktok",
                },
              },
              { type: "markdown", props: { text: "Here's what I'll read — tweak it and hit read.", origin: "chat-agent" } },
            ],
          },
        ]}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
      />
    ),
  },
  {
    id: "in-thread-upload",
    label: "In-thread video field (test)",
    note: "request_input(action:test) → a kind:'upload' field: a video FILE drop OR a TikTok URL. On submit it runs the FULL /api/analyze Max pipeline on its own 300s route, then POSTs the analysisId to /api/tools/test/card, which drops the video-test-card in the thread — no navigate-out. A run with no honest audience reaction degrades to a link-out to /analyze/[id].",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        persistedTurns={[
          {
            userTurn: "test this video for me",
            blocks: [
              {
                type: "input-request",
                props: {
                  kind: "upload",
                  action: "test",
                  label: "Drop the video (or paste its link) and I'll test it against your audience.",
                  placeholder: "https://tiktok.com/…",
                  platform: "tiktok",
                },
              },
              { type: "markdown", props: { text: "Drop the video below (or paste a TikTok link) and I'll test it.", origin: "chat-agent" } },
            ],
          },
        ]}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
      />
    ),
  },
  {
    id: "explore",
    label: "Explore",
    note: "Discover → Explore skill. Measured outlier grid in a SkillResultCard (Remix / Track per tile).",
    node: (
      <ExploreThreadView
        persistedBlocks={EXPLORE_BLOCKS}
        streamingBlocks={[]}
        stages={[]}
        isStreaming={false}
        error={null}
        platform="tiktok"
        userTurn={USER_TURNS.explore}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "account",
    label: "Account Read",
    note: "Analyze → Account Read. Real scrape header + analyzed-post covers + working/fix + track record.",
    node: (
      <AccountReadThreadView
        block={ACCOUNT_BLOCK}
        isStreaming={false}
        error={null}
        fallbackMessage={null}
        onRun={noop}
        userTurn={USER_TURNS.account}
      />
    ),
  },
  {
    id: "video-test-card",
    label: "Video Test card (test)",
    note: "The /test in-thread CRAFT teardown (video-test-card, model:sim1-max) — 'the editor's cut'. Reworked 2026-07-21 for the Test/Simulation split: a frame-by-frame read of how well-MADE the video is. Header = craft score ring (owner-locked KEEP the number, craft-subset dims only) + driver bars; then the filmstrip of THEIR video, the working/not-working ledger, and the director's fixes (frame → diagnosis → neutral 'why' → move → optional PROVEN corpus receipt on the top fixes). Reception (retention curve, the crowd, reach, who-stops) is NOT here — it lives on the Simulation surface, reached via the ONE door out 'Simulate it →'. Frames show a play-tile in the gallery (no signed keyframes off-route). Rendered via MessageBlocks (proves the registry routes video-test-card → the renderer).",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        persistedTurns={[
          {
            userTurn: "test this video for me",
            blocks: [
              {
                type: "video-test-card",
                props: {
                  craftScore: 77,
                  drivers: [
                    { name: "Hook", score: 87, band: "strong" },
                    { name: "Credibility", score: 80, band: "strong" },
                    { name: "Clarity", score: 72, band: "strong" },
                    { name: "Substance", score: 70, band: "strong" },
                  ],
                  filmstrip: [
                    { idx: 0, label: "Cold open", atMs: 0, mark: "asset", keyframeUrl: null },
                    { idx: 1, label: "Setup", atMs: 3000, mark: null, keyframeUrl: null },
                    { idx: 2, label: "Stall", atMs: 6000, mark: "weak", keyframeUrl: null },
                    { idx: 3, label: "Payoff", atMs: 9000, mark: null, keyframeUrl: null },
                    { idx: 4, label: "Close", atMs: 12000, mark: null, keyframeUrl: null },
                  ],
                  dropLabel: "0:06 drop",
                  durationLabel: "0:15",
                  working: [
                    "Keep the cold open",
                    "Hook — strong cold open, visual stop power high",
                    "Credibility — natural delivery, no over-production",
                  ],
                  notWorking: [
                    { text: "Recut the open", atMs: 8000 },
                    { text: "Tighten the text overlay", atMs: 1000 },
                    { text: "Add an explicit CTA", atMs: 14000 },
                  ],
                  fixes: [
                    {
                      title: "Recut the open",
                      lever: "Momentum",
                      atMs: 8000,
                      keyframeUrl: null,
                      diagnosis:
                        "You lose them at 0:08 — the setup runs long and the payoff doesn't land until 0:09, the longest flat stretch in the cut.",
                      why: "Attention holds on open loops. When a beat resolves nothing and opens nothing, the mind is free to leave — a pattern interrupt reopens the loop.",
                      move: null,
                      proof: {
                        handle: "explore_create_capture",
                        videoUrl: "https://www.tiktok.com/@explore_create_capture",
                        coverUrl: null,
                        hookTemplate: "The [editing trick] everyone sleeps on for [retention].",
                        archetype: "secret-reveal-breakdown",
                        multiplier: 14.2,
                        views: 2400000,
                        baselineLabel: "vs their usual",
                        fitLabel: "structural",
                      },
                    },
                    {
                      title: "Sharpen the open",
                      lever: "Stakes",
                      atMs: 0,
                      keyframeUrl: null,
                      diagnosis:
                        "Your open — “Here are three things nobody tells you about freelancing”. It works as a list promise, but the stakes stay abstract.",
                      why: "A low-stakes open is a cheap skip — nothing is at risk, so there's little reason to stay. Naming a concrete stake widens the curiosity gap.",
                      move: "I lost $4k before I learned these three freelancing rules",
                      proof: {
                        handle: "successwithumar",
                        videoUrl: "https://www.tiktok.com/@successwithumar",
                        coverUrl: null,
                        hookTemplate: "Why your [hooks] stop working after [10k followers].",
                        archetype: "problem",
                        multiplier: 6.8,
                        views: 820000,
                        baselineLabel: "vs their usual",
                        fitLabel: "structural",
                      },
                    },
                    {
                      title: "Add an explicit CTA",
                      lever: "CTA",
                      atMs: 14000,
                      keyframeUrl: null,
                      diagnosis:
                        "The last 2s trail off. Ask for the follow while attention is still on the payoff — one clear line, on screen and spoken.",
                      why: "The end of a watch is the moment a viewer remembers most. An explicit ask, made while attention is still high, turns that peak into an action.",
                      move: null,
                      proof: null,
                    },
                  ],
                  audienceName: "Skincare buyers",
                  analysisId: "dev-fixture-id",
                  model: "sim1-max",
                  tier: "Directional",
                },
              },
              { type: "markdown", props: { text: "Tested — here's how your audience reacts to the real video. Tap through for the full frame-by-frame.", origin: "chat-agent" } },
            ],
          },
        ]}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
      />
    ),
  },
  {
    id: "read",
    label: "Text Read (concept read)",
    note: "The Read skill — /api/tools/read. An in-thread card: the chat agent calls request_input(action:read), the creator's concept POSTs to the route, and this multi-audience-read block renders in the thread (billed action:read). One audience: band + interpretation + Lever + who-not-for + reaction drill. Rendered via MessageBlocks (proves the registry routes multi-audience-read → the renderer). NOTE: the 2-audience COMPARE shape is intentionally NOT previewed here — it never renders in-thread (only the /audience Compare button produces it, gated on 2+ calibrated audiences), so it isn't a Skills card. Its block shape stays drift-validated via ALL_FIXTURE_BLOCKS.",
    node: <MessageBlocks body={[SINGLE_AUDIENCE_READ_BLOCK]} />,
  },
];

/**
 * EVIDENCE fixtures for the in-flight previews (2026-07-31).
 *
 * The evidence rail is the newest thing on the most-watched surface, and — like every other
 * in-flight state — it exists ONLY during a live paid run, which is exactly how the loading states
 * drifted unseen before these previews existed. Declared here (not beside the Reading fixtures
 * further down) because INFLIGHT_VIEWS builds its JSX at module load: a `const` declared below
 * would be in the temporal dead zone.
 *
 * The images are app screenshots that already ship in /public, so the tiles render REAL pictures
 * (true crop, aspect and load behaviour) with no network fixture. The numbers are made up because
 * this is a GALLERY — in a live run every one of them comes off a retrieved corpus row.
 */
const EVIDENCE_OUTLIERS: RunEvidence = {
  headline: "Drafting against 3 proven videos",
  items: [
    {
      kind: "video",
      image: "/images/landing/hero-read.png",
      label: "zachking",
      metric: "44× vs followers",
      href: "https://www.tiktok.com/@zachking/video/1234567890123",
    },
    {
      kind: "video",
      image: "/images/landing/feature-audience.png",
      label: "mkbhd",
      metric: "2.4M views",
    },
    // No cover — the tile falls back to the handle's initial and keeps its footprint, which is
    // what a real expired TikTok-CDN URL looks like a few hours after a scrape.
    { kind: "video", label: "cleoabram", metric: "12× vs followers" },
  ],
};

const EVIDENCE_REMIX_SOURCE: RunEvidence = {
  headline: "Reworking this video",
  items: [
    {
      kind: "video",
      image: "/images/landing/showcase-read.png",
      label: "danielleaskyoutube",
      // Views only — the creator pasted this link, so nothing measured it against a baseline and
      // no multiplier is implied (mirrors the remix card's own receipt, which passes fitLabel null).
      metric: "890K views",
      href: "https://www.tiktok.com/@x/video/1",
    },
  ],
};

const EVIDENCE_FILMSTRIP: RunEvidence = {
  headline: "Reading your footage",
  slots: 8,
  items: [
    { kind: "frame", image: "/images/landing/hero-read.png", idx: 0 },
    { kind: "frame", image: "/images/landing/feature-audience.png", idx: 1 },
    { kind: "frame", image: "/images/landing/feature-drivers.png", idx: 2 },
    { kind: "frame", image: "/images/landing/feature-hook.png", idx: 3 },
    { kind: "frame", image: "/images/landing/feature-retention.png", idx: 4 },
  ],
};

/**
 * The full run LIFECYCLE on a loop — pending → active → done → the collapsed receipt.
 *
 * Every other in-flight preview is a frozen mid-run shape, which cannot show the two things the
 * 2026-08-01 craft pass actually changed: the CHOREOGRAPHY (node landing, the rail leg filling,
 * the label shimmer handing off) and the MEASURED receipt ("Generated in 0:32"). The receipt's
 * total is real client-measured state — there is no prop that fakes it — so the only way to look
 * at it is to let a run genuinely play out. This runs a compressed one, forever.
 */
function RunLifecycleLoop() {
  const PLAN = SKILL_RUN_META.hooks!.plan;
  const [step, setStep] = useState(0);
  useEffect(() => {
    // One beat past the last step = settled; two more hold the receipt before looping.
    const id = setInterval(() => setStep((s) => (s + 1) % (PLAN.length + 3)), 1800);
    return () => clearInterval(id);
  }, [PLAN.length]);

  const settled = step >= PLAN.length;
  return (
    <SkillProgress
      stages={PLAN.map((name, i) => ({
        name,
        status: settled ? 'done' : i < step ? 'done' : i === step ? 'active' : 'pending',
      }))}
      plan={PLAN}
      isStreaming={!settled}
      summaryLabel={SKILL_RUN_META.hooks!.done}
      runningLabel={SKILL_RUN_META.hooks!.running}
      tookLabel={SKILL_RUN_META.hooks!.took}
      evidence={!settled && step === 1 ? EVIDENCE_OUTLIERS : null}
    />
  );
}

// ── Group A2: the IN-FLIGHT states — the run capsule, previewable at last (2026-07-19) ────────
// The 07-14 audit's lesson: a surface with no cheap way to LOOK at it will drift. The thread
// views' completed states preview above, and Reading's skeleton previews below — but the thread's
// LIVE loading states (the spine mid-run, the chat capsule, the field waits) were reachable only
// by spending a real paid run. These mount the REAL components in their mid-run shapes.
const INFLIGHT_VIEWS: { id: string; label: string; note: string; node: React.ReactNode }[] = [
  {
    id: "loading-run-lifecycle",
    label: "In-flight · Full run lifecycle (loops)",
    note:
      "The 2026-08-01 craft pass end to end: 7px marks, a hairline rail whose filled leg IS the completion signal (the per-step ✓ is gone — neither Claude nor ChatGPT uses one), finished rows receding to muted, ONE clock in the head, and the collapse to a real measured total. Loops every ~9s; click the receipt to see each step's true duration.",
    node: <RunLifecycleLoop />,
  },
  {
    id: "loading-hooks",
    label: "In-flight · Hooks (skill view)",
    note: "A hooks run mid-generation: intro voice line + the plan-seeded spine (Generating done, Simulating active with rotating honest sub-copy). What every composer-mode skill wait looks like.",
    node: (
      <HooksThreadView
        persistedBlocks={[]}
        streamingBlocks={[]}
        statusMessage={null}
        stages={[
          { name: "Generating", status: "done" },
          { name: "Simulating your audience", status: "active" },
        ]}
        followupText={null}
        warnings={[]}
        isStreaming={true}
        error={null}
        platform="tiktok"
        userTurn={USER_TURNS.hooks}
        audienceLabel={AUDIENCE}
      />
    ),
  },
  {
    id: "loading-chat-dispatch",
    label: "In-flight · Chat agent dispatch",
    note: "The agent routed 'write me hooks…' to the hooks skill: the `dispatch` SSE event labels the capsule ('Writing hooks — for …') and seeds the FULL hooks plan before the first stage event. Pre-capsule this was an unlabeled spine growing one row at a time.",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        streamingBlocks={[]}
        streamingCardBlocks={[]}
        stages={[{ name: "Generating", status: "active" }]}
        dispatchedSkill="hooks"
        audienceLabel={AUDIENCE}
        isStreaming={true}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        userTurn="write me hooks about why over-editing hurts your reach"
      />
    ),
  },
  {
    id: "chat-receipt",
    label: "Chat agent · run receipt",
    note: "The same dispatched run one beat later: stages all landed, the capsule collapsed to the ✓ receipt (expandable step history) ABOVE the cards — the run's provenance no longer vanishes when the cards arrive. Identical grammar to the per-skill views.",
    node: (
      <ChatThreadView
        persistedBlocks={[]}
        streamingBlocks={[{ type: "markdown", props: { text: "Two angles that hold — want a script for #1?" } }]}
        streamingCardBlocks={[IDEA_BLOCKS[0]]}
        stages={[
          { name: "Generating", status: "done" },
          { name: "Simulating your audience", status: "done" },
          { name: "Ranking", status: "done" },
        ]}
        dispatchedSkill="ideas"
        audienceLabel={AUDIENCE}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onFollowup={noop}
        userTurn="give me ideas about morning routines"
      />
    ),
  },
  {
    id: "loading-field-test",
    label: "In-flight · Test field (the 2-minute wait)",
    note: "The in-thread /test run mid-analysis — the SAME 3-step plan as the /analyze skeleton, derived from real phase boundaries + elapsed floors. Composition matches UploadField's busy branch 1:1 (the field itself can't be forced mid-run without a live pipeline).",
    node: (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-4">
        <p className="text-[13px] font-medium text-foreground-secondary">{SKILL_RUN_META.test!.running}</p>
        <ProgressChecklist
          stages={[
            { name: "Fetching your video", status: "done" },
            { name: "Watching it frame by frame", status: "active" },
            { name: "Simulating your audience", status: "pending" },
          ]}
          plan={SKILL_RUN_META.test!.plan}
        />
      </div>
    ),
  },
  {
    id: "loading-evidence-grounded",
    label: "In-flight · grounded run (the evidence rail)",
    note: "A grounded hooks/ideas/script run mid-generation. Retrieval settles ~40s BEFORE the first card exists, so the outliers the model is drafting against are shown under the step that is using them — cover, @handle and the measured multiplier, straight off the corpus rows. The third row has no cover (an expired CDN URL) and falls back to its initial rather than a broken tile. Absent on an ungrounded run: the rail renders nothing rather than an empty frame.",
    node: (
      <div className="mx-auto w-full max-w-[760px]">
        <ProgressChecklist
          stages={[
            { name: "Finding proven outliers", status: "done" },
            { name: "Generating", status: "active" },
          ]}
          plan={SKILL_RUN_META.hooks!.plan}
          evidence={EVIDENCE_OUTLIERS}
        />
      </div>
    ),
  },
  {
    id: "loading-evidence-remix",
    label: "In-flight · Remix (the post it resolved)",
    note: "Remix holds its evidence longest: the resolve step returns the cover, @handle and views within seconds, then Decoding + Adapting take ~50s. That whole stretch used to be words about a video the creator couldn't see. No multiplier is shown — they pasted this link, so nothing measured it against a baseline.",
    node: (
      <div className="mx-auto w-full max-w-[760px]">
        <ProgressChecklist
          stages={[
            { name: "Resolving", status: "done" },
            { name: "Decoding", status: "active" },
          ]}
          plan={SKILL_RUN_META.remix!.plan}
          evidence={EVIDENCE_REMIX_SOURCE}
        />
      </div>
    ),
  },
  {
    id: "loading-evidence-filmstrip",
    label: "In-flight · Test (the filmstrip, in-thread)",
    note: "The 2-minute Test wait, now showing the creator's OWN keyframes as the extractor cuts them — the same reveal signals the flagship /analyze skeleton uses, in the thread's rail idiom. All 8 planned slots are drawn up front and fill in order (5 of 8 here), so the strip reads as progress and never reflows.",
    node: (
      <div className="mx-auto w-full max-w-[760px]">
        <ProgressChecklist
          stages={[
            { name: "Fetching your video", status: "done" },
            { name: "Watching it frame by frame", status: "active" },
            { name: "Simulating your audience", status: "pending" },
          ]}
          plan={SKILL_RUN_META.test!.plan}
          evidence={EVIDENCE_FILMSTRIP}
        />
      </div>
    ),
  },
  {
    id: "loading-scoring-card",
    label: "In-flight · card scoring shimmer",
    note: "A hook card streamed-in before its `score` event lands (scored:false): the ProofUnit renders the matte 'Scoring with your reactors…' shimmer strip, then resolves in place. The last visible beat of every generator run.",
    node: (
      <div className="mx-auto w-full max-w-[760px]">
        <MessageBlocks
          body={[
            {
              type: "hook-card",
              props: { ...(HOOK_BLOCKS[0]!.props as Record<string, unknown>), scored: false },
            },
          ]}
        />
      </div>
    ),
  },
];

/**
 * The Reading's STATES — every one of them, not just the happy path (2026-07-14).
 *
 * The 07-14 audit found /analyze had drifted badly (seven label stacks, a retired accent still
 * being painted) for one reason: it is the only surface with no cheap way to LOOK at it. It was
 * previewable here, but ONLY complete-and-healthy. Its degraded states were reachable solely by
 * getting a real, paid analysis to fail in exactly the right way — so `makeUnavailableResult`,
 * `makePartialResult`, `makeApolloNullResult`, the three empty-panel cases and
 * `makeNoBehavioralResult` had sat in the repo as fixtures that **no human had ever seen render**.
 *
 * A `/dev/reading` route was considered and rejected: <Reading> already mounts here through the
 * real component, so a second route would duplicate the surface and give it a second place to
 * drift. The gap was never the route — it was the states. This is the whole value at a fraction
 * of the cost.
 *
 * `loading` is NOT a fixture: `overrideData` hard-sets isLoading=false (it is a preview seam, not
 * a fetch mock), so the skeleton is unreachable through it and <ReadingSkeleton> is mounted
 * directly instead. It is first in the list on purpose — it is the state every user sees on every
 * single Read, and it has had the least scrutiny of any of them.
 */
/**
 * Stand-in keyframes for the `loading-frames` preview. In a live run these are signed URLs to
 * real JPEGs cut from the user's video; here they are app screenshots that already ship in
 * /public, so the strip renders REAL images (correct crop, aspect, load behaviour) with no
 * network fixture. Five of eight — so the preview shows a strip mid-fill, not a full one.
 */
/** The user's calibrated reactors — the cast, known before the run starts. */
const PREVIEW_ROSTER = [
  { archetype: 'skeptic', label: 'Maya — the skeptic' },
  { archetype: 'scanner', label: 'Sam — the scanner' },
  { archetype: 'collector', label: 'Priya — the collector' },
  { archetype: 'connector', label: 'Leo — the connector' },
  { archetype: 'lurker', label: 'Dana — the lurker' },
  { archetype: 'converter', label: 'Alex — the converter' },
];

/** The scrape receipt, as it arrives seconds into a real tiktok_url run. */
const PREVIEW_SOURCE = {
  cover_url: '/images/landing/hero-read.png',
  handle: 'zachking',
  views: 12_400_000,
  video_url: 'https://www.tiktok.com/@zachking/video/1234567890123',
};

const PREVIEW_FRAMES = [
  { idx: 0, uri: '/images/landing/hero-read.png' },
  { idx: 1, uri: '/images/landing/feature-audience.png' },
  { idx: 2, uri: '/images/landing/feature-drivers.png' },
  { idx: 3, uri: '/images/landing/hero-read.png' },
  { idx: 4, uri: '/images/landing/feature-audience.png' },
];

/** All 8 frames in — the footage has been fully read. */
const PREVIEW_FRAMES_FULL = [
  ...PREVIEW_FRAMES,
  { idx: 5, uri: '/images/landing/feature-drivers.png' },
  { idx: 6, uri: '/images/landing/hero-read.png' },
  { idx: 7, uri: '/images/landing/feature-audience.png' },
];

const READING_STATES: { id: string; label: string; note: string; node: React.ReactNode }[] = [
  {
    id: 'loading',
    label: 'Loading · waiting',
    note: 'The in-flight skeleton in its FIRST seconds — before the extractor has cut a single frame. Mounted directly: overrideData forces isLoading=false, so this state is unreachable via the fixture seam.',
    node: <ReadingSkeleton id="preview" />,
  },
  {
    id: 'loading-source',
    label: 'Loading · source landed',
    note: 'Seconds into the run: the scrape has resolved, so the wait can show the post it went and fetched (cover + author + views) long before any frame is cut. In video_upload mode nothing is scraped, so no receipt renders — we never dress an absence up as a source.',
    node: (
      <ReadingSkeleton
        id="preview"
        preview={{ source: PREVIEW_SOURCE }}
      />
    ),
  },
  {
    id: 'loading-frames',
    label: 'Loading · frames landing',
    note: 'The SAME skeleton mid-run: real keyframes of the user\'s own video appearing as the engine reads them (5 of 8 here). This is what the 2-minute wait actually looks like once the footage starts landing — and it was invisible to everyone until this preview existed, because it only occurs during a live run.',
    node: (
      <ReadingSkeleton
        id="preview"
        preview={{
          source: PREVIEW_SOURCE,
          roster: PREVIEW_ROSTER,
          frameTotal: 8,
          frames: PREVIEW_FRAMES,
          keyframeCount: 5,
        }}
      />
    ),
  },
  {
    id: 'loading-audience',
    label: 'Loading · audience watching',
    note: 'The back half of the wait: the footage has been read (all 8 frames in) and the audience sim is running — the ~60s stretch that used to be completely empty. Their REACTIONS are what the Read produces and are never guessed here; only the cast is shown.',
    node: (
      <ReadingSkeleton
        id="preview"
        preview={{
          source: PREVIEW_SOURCE,
          roster: PREVIEW_ROSTER,
          frameTotal: 8,
          frames: PREVIEW_FRAMES_FULL,
          keyframeCount: 8,
        }}
      />
    ),
  },
  {
    id: 'complete',
    label: 'Complete',
    note: 'The healthy Read — score hero + drivers + audience + Fix First + Deeper read + follow-up chat. Until 2026-07-14 this was the ONLY state anyone could see.',
    node: <Reading overrideData={makeReadingResult()} />,
  },
  {
    id: 'partial',
    label: 'Partial',
    note: 'Some panels resolved, others did not. Watch for panels that render an ABSENCE as though it were a finding.',
    node: <Reading overrideData={makePartialResult()} />,
  },
  {
    id: 'apollo-null',
    label: 'Apollo null',
    note: 'The interpreter returned nothing. The engine numbers survive; the prose does not.',
    node: <Reading overrideData={makeApolloNullResult()} />,
  },
  {
    id: 'empty-personas',
    label: 'Empty personas',
    note: 'NO personas at all — the roster degrades to PanelEmpty. (This state used to claim it produced the "no words" line. It cannot: with zero personas there are no rows, so there are no quote slots. See "Silent personas" for that.)',
    node: <Reading overrideData={makeEmptyPersonasResult()} />,
  },
  {
    id: 'silent-personas',
    label: 'Silent personas',
    note: 'The room is FULL and nobody said a word — every persona present, not one verbatim. The ONLY state that renders the "No words recorded." line. It is stated as an absence (dashed, muted, NOT italic), because italic is this app\'s verbatim idiom and an absence must never wear a quote\'s clothing.',
    node: <Reading overrideData={makeSilentPersonasResult()} />,
  },
  {
    id: 'empty-heatmap',
    label: 'Empty heatmap',
    note: 'No retention curve — the scrubber has nothing to draw.',
    node: <Reading overrideData={makeEmptyHeatmapResult()} />,
  },
  {
    id: 'empty-segments',
    label: 'Empty segments',
    note: 'No audience segments resolved.',
    node: <Reading overrideData={makeEmptySegmentsResult()} />,
  },
  {
    id: 'no-behavioral',
    label: 'No behavioral',
    note: 'Behavioral signals absent — the drivers lose their evidence.',
    node: <Reading overrideData={makeNoBehavioralResult()} />,
  },
  {
    id: 'unavailable',
    label: 'Unavailable',
    note: 'The Read could not be produced at all. The terminal failure a user actually hits.',
    node: <Reading overrideData={makeUnavailableResult()} />,
  },
];

// The GROUNDED brain's dev stand-in: a real video + a real-shaped retention curve (holds through
// the hook, breaks at ~45%, bleeds out). In production both come from the Read — the audience's
// MEASURED curve and the analyzed video. The mp4 is a local dev asset (public/dev/ is gitignored),
// so this preview is blank on a fresh clone; that is fine, it is a workbench.
const DEV_RETENTION: [number, number][] = [
  [0, 1], [0.1, 0.94], [0.2, 0.9], [0.3, 0.86], [0.42, 0.82],
  [0.5, 0.55], [0.6, 0.47], [0.75, 0.4], [0.9, 0.34], [1, 0.3],
];
const DEV_BRAIN_SOURCE = {
  videoSrc: "/dev/sample-video.mp4",
  durationS: 28,
  retentionAt: (u: number) => {
    const x = Math.min(1, Math.max(0, u));
    for (let i = 1; i < DEV_RETENTION.length; i++) {
      const [x1, y1] = DEV_RETENTION[i]!;
      const [x0, y0] = DEV_RETENTION[i - 1]!;
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
    return DEV_RETENTION[DEV_RETENTION.length - 1]![1];
  },
};

// ── The Room — the LEGACY ambient audience panel body (The brain ⇄ The people ⇄ Population). ──
// ⚠️ This is the room the app renders ONLY while `AMBIENT_V2_ENABLED` is false. With the flag on
// (the dev default) the composer mounts the v2 surfaces below instead — see ROOM_V2_* and the
// "which room this build ships" banner in the Room tab, which reads the real flag.
// The same <AmbientRoom> the dock blooms open, fed a fixture focus so the three scales are
// previewable without running a skill. Non-embedded (h-full) → it lives in a fixed-height box
// that stands in for the panel.
const ROOM_FOCUS = {
  conceptText: "Stop editing your videos. Do this instead.",
  fraction: "6/10 stop",
  // The GENERAL_ROSTER ten (real registry enums) → the named cast + `ask →` chat are live here.
  personas: [
    { archetype: "high_engager", verdict: "stop" as const, quote: "Wait — do WHAT instead? I need the answer." },
    { archetype: "tough_crowd", verdict: "scroll" as const, quote: "Every editor says this. Prove it in 3 seconds." },
    { archetype: "saver", verdict: "stop" as const, quote: "Saving this before I forget it." },
    { archetype: "lurker", verdict: "stop" as const, quote: "" },
    { archetype: "sharer", verdict: "stop" as const, quote: "Sending this to my editor right now." },
    { archetype: "purposeful_viewer", verdict: "scroll" as const, quote: "The hook promises more than the caption delivers." },
    { archetype: "loyalist", verdict: "stop" as const, quote: "You never post filler — I'm staying." },
    { archetype: "niche_deep_buyer", verdict: "scroll" as const, quote: "Nothing here tells me what it costs me." },
    { archetype: "niche_deep_scout", verdict: "stop" as const, quote: "That's my exact problem, honestly." },
    { archetype: "cross_niche_curiosity", verdict: "scroll" as const, quote: "Feels like last month's advice." },
  ],
};

// The persistent RAIL presentation (P2, ambient-room-v2) — the SAME AmbientRoom body, but hosted
// by AudiencePresence's `variant='rail'` (in-flow, always-open, no bloom, no collapse). Boxed at a
// real rail width×height so the geometry reads like the desktop rail. Same fixture focus as ROOM.
const RAIL_FOCUS = {
  id: "h3",
  conceptText: ROOM_FOCUS.conceptText,
  fraction: ROOM_FOCUS.fraction,
  scrollQuote: "Wait — do WHAT instead? I need the answer.",
  personas: ROOM_FOCUS.personas,
};
const RAIL_SIBLINGS = [
  { id: "h1", conceptText: "The edit nobody tells you about.", fraction: "9/10 stop" },
  { id: "h2", conceptText: "I deleted 40 hours of B-roll.", fraction: "7/10 stop" },
  { id: "h3", conceptText: "Stop editing your videos. Do this instead.", fraction: "6/10 stop" },
  { id: "h4", conceptText: "Your cuts are why they leave.", fraction: "4/10 stop" },
  { id: "h5", conceptText: "Editing is a trap.", fraction: "2/10 stop" },
];

// ─────────────────────────────────────────────────────────────────────────────
// The Room, v2 (ambient-audience-v2) — what the composer ACTUALLY mounts today.
//
// The rail is `<AmbientOverviewRail>` (≥xl right column) and the <xl header is
// `<AmbientOverviewSheet>`, both behind `AMBIENT_V2_ENABLED`. Everything below feeds them the
// SAME prop shapes composer.tsx passes — a real `Audience`, the thread's `AmbientCardDescriptor[]`
// ledger, and the `threads.sim_seals` map — so this previews the real component, not a mock of it.
// ─────────────────────────────────────────────────────────────────────────────

/** The real General constant the app serves a new creator (drives the "not calibrated" chip). */
const ROOM_V2_AUDIENCE = GENERAL_AUDIENCE;

/** The projected-card ledger `use-ambient-focus` builds from a thread's cards. Same five hooks as
 *  the legacy fixture above, so the two rooms are diffable on identical input. */
const ROOM_V2_DESCRIPTORS: AmbientCardDescriptor[] = [
  { id: "h1", kind: "hook", conceptText: "The edit nobody tells you about.", fraction: "9/10 stop", scrollQuote: "Every editor says this. Prove it in 3 seconds." },
  { id: "h2", kind: "hook", conceptText: "I deleted 40 hours of B-roll.", fraction: "7/10 stop", scrollQuote: "Nothing here tells me what it costs me." },
  { id: "h3", kind: "hook", conceptText: "Stop editing your videos. Do this instead.", fraction: "6/10 stop", scrollQuote: "The hook promises more than the caption delivers." },
  { id: "h4", kind: "hook", conceptText: "Your cuts are why they leave.", fraction: "4/10 stop", scrollQuote: "Feels like last month's advice." },
  { id: "h5", kind: "idea", conceptText: "Editing is a trap.", fraction: "2/10 stop", scrollQuote: "Too vague to act on." },
];

/**
 * One SEALED row, rehydrated the way `/api/threads/open` rehydrates `threads.sim_seals` — keyed by
 * TRIMMED concept text, carrying the MEASURED verdict plus the Phase-C depth payload.
 *
 * Sealing h3 is what makes this gallery worth opening: without a seal every row is honestly queued
 * and the depth drill is unreachable, because the drill only opens on a row that has a population.
 * The numbers are deliberately reconciled — `pct: 54` is `POPULATION_1K.stopPct` (54.4) rounded, so
 * the row's verdict and the page it drills into cannot disagree. It also reads as the real story the
 * surface exists to tell: the projection said 6/10, the measured sim said 54%.
 *
 * Tapping "Simulate →" on a QUEUED row still POSTs the real `/api/tools/react` — there is no thread
 * here, so it fails and the row falls honestly back to queued (fireSim's catch). That is the real
 * failure path, not a gallery stub.
 */
const ROOM_V2_SEALS: WireSimSealMap = {
  "Stop editing your videos. Do this instead.": {
    pct: 54,
    band: "Mixed",
    at: "2026-07-28T09:00:00.000Z",
    population: POPULATION_1K,
    personas: ROOM_FOCUS.personas,
    scrollQuote: "The hook promises more than the caption delivers.",
  },
  // A SEALED row that produced NO population — the state that used to be invisible (2026-08-05).
  // A run's verdict and its depth fail INDEPENDENTLY: `pct` comes from the flash reaction, the
  // population from the projection, so a row can carry a perfectly real 38% and still have nothing
  // behind it (an audience whose signature has no v2 axes, or a characterize failure). It used to
  // render as an ordinary door whose tap hit an empty `else` — no error, no log, nothing — which is
  // the defect the owner spent two sessions chasing. It now reads `verdict only` and is not a
  // button. Keep this fixture: it is the ONLY place the state can be seen without breaking an
  // audience on purpose.
  "I deleted 40 hours of B-roll.": {
    pct: 38,
    band: "Mixed",
    at: "2026-08-05T09:00:00.000Z",
    personas: ROOM_FOCUS.personas,
    scrollQuote: "Nothing here tells me what it costs me.",
  },
};

/**
 * ⑤ SIMULATE — the ＋ door's five states, built from the SAME adapter the door uses.
 *
 * `buildSimulateData` + `audienceToMeta` are exactly what `SimulateDoorHost` calls, so the dials,
 * slices and scene options below are the real ones for this audience rather than a hand-written
 * echo that can drift from them.
 *
 * ⚠️ GEOMETRY IS PART OF THE FIXTURE. The three ARM variants do NOT share a container in
 * production, and rendering them as if they did is how a redesign gets costed against the wrong
 * budget: ① `develop` is mounted `connected` INSIDE the rail (a 400px column, full panel height,
 * so it can end in dead space), while ② and ③ come through `SimulateDoorHost`, which mounts them
 * un-`connected` as a floating 460px sheet that is exactly as tall as its content. Each is boxed
 * below at the geometry its own host gives it.
 */
const SIM_DEV_DATA = buildSimulateData({
  audience: audienceToMeta(ROOM_V2_AUDIENCE),
  // The develop entry's pre-filled stimulus: a card already on the board, plus the rank it deepens.
  stimulus: { text: "Stop editing your videos. Do this instead.", kind: "hook" },
  develop: { sourceLabel: "Hooks run" },
});

/** The cold doors, as the intake itself classifies them — picked out by kind, never re-declared. */
const SIM_DRAFT_DOOR = SIM_DEV_DATA.intake.find((o) => o.kind === "draft")!;
const SIM_VIDEO_DOOR = SIM_DEV_DATA.intake.find((o) => o.kind === "video")!;

/** What a creator brought through each cold door — the shape `CollectStep` emits. */
const SIM_BROUGHT_TEXT = {
  kind: "draft" as const,
  text: "Three years of footage and nobody watched past the first second.",
};
// A video's `text` is its NAME (a filename or the link), never a stimulus to feed a text run.
const SIM_BROUGHT_VIDEO = { kind: "video" as const, text: "cold-open-v3.mp4" };

// ─────────────────────────────────────────────────────────────────────────────
// The classification — production status + category for every renderable above.
// DERIVED, never duplicated: the node JSX stays in the arrays; this only sorts it
// into tabs and tags each with its real production status, so the page is an honest
// inventory instead of a flat pile. See the audit that seeded this (2026-07-21):
//   Live     — a live skill emits it today (SKILL_RUN_META + a real block producer).
//   Flag off — behind HORIZONTAL_ENABLED (=false): hidden, kept only so old threads render.
//   Legacy   — 0 live producers; the standalone block exists only as a prop inside cards,
//              registry-kept for persisted history. (band, personas.)
// ─────────────────────────────────────────────────────────────────────────────
// "unwired" is NOT a synonym for the other three, and the difference is the whole point of this
// page carrying a status at all. A `flag-off` renderer has a live producer behind a switch; a
// `legacy` one had one and lost it. A composed card has never had one: the block type is registered
// and renders, but nothing emits it until the `emit_card` tool is wired into the agent loop. Filed
// as "live" it would present a shape no thread can currently produce as the product — the exact
// drift the RoomFlagBanner below exists to stop, which this page shipped for weeks.
type Status = "live" | "flag-off" | "legacy" | "unwired";

// The Room has TWO implementations and they are mutually exclusive, decided at BUILD time by
// AMBIENT_V2_ENABLED. Deriving both statuses from the real flag is what stops this page drifting
// again: it labels whichever room this build actually ships, in every build.
const V2_STATUS: Status = AMBIENT_V2_ENABLED ? "live" : "flag-off";
const LEGACY_ROOM_STATUS: Status = AMBIENT_V2_ENABLED ? "flag-off" : "live";

const STATUS_META: Record<Status, { label: string; dot: string; tone: string }> = {
  live: { label: "Live", dot: "bg-[var(--color-accent)]", tone: "text-foreground-secondary" },
  "flag-off": { label: "Flag off", dot: "ring-1 ring-inset ring-white/30", tone: "text-foreground-muted" },
  legacy: { label: "Legacy", dot: "bg-white/25", tone: "text-foreground-muted/80" },
  unwired: { label: "Not wired", dot: "bg-white/10 ring-1 ring-inset ring-white/40", tone: "text-foreground-muted" },
};

// Skills, in thread order. Their outlier / degraded run-states NEST under the base skill
// (they are the same run + one SSE affordance) instead of competing as peer sections.
const SKILL_ORDER = ["ideas", "hooks", "script", "remix", "chat", "explore", "account", "read", "video-test-card"] as const;
const VARIANT_OF: Record<string, string> = {
  "ideas-outliers": "ideas",
  "hooks-degraded": "hooks",
  "hooks-outliers": "hooks",
  "hooks-projected": "hooks",
  "script-outliers": "script",
  // The remix card WITH its shoot sheet. A run-state of the same card, not a second skill: the
  // sheet appears only once a run has written a remix_blueprints row, so the bare entry above is
  // the other half of the same contract.
  "remix-shoot-sheet": "remix",
};

// The in-thread input affordances (request_input) + the context-aware chat follow-ups.
const INPUT_ORDER = [
  "chat-followups",
  "in-thread-read",
  "in-thread-link",
  "in-thread-account",
  "in-thread-explore",
  "in-thread-upload",
] as const;

// BLOCK_SECTIONS (in-thread blocks) → status. Anything unlisted is a live in-thread block.
const BLOCK_STATUS: Record<string, Status> = {
  "profile-read": "flag-off",
  "reaction-distribution": "flag-off",
  "prediction-gauge": "flag-off",
  band: "legacy",
  personas: "legacy",
};
// Honest note for the legacy standalone blocks (band / personas). Prepended so the page never
// presents a not-emitted primitive as if a live skill produced it.
const LEGACY_NOTE =
  "LEGACY — no live skill emits this standalone block; it survives only as a prop inside the cards. Kept in the registry so persisted history still renders. ";

type Tab = { id: string; label: string; blurb: string };
const TABS: Tab[] = [
  { id: "overview", label: "Overview", blurb: "Every renderable the thread can mount, grouped by role and tagged with its real production status. Pick a tab to inspect one group at a time." },
  { id: "skills", label: "Skills", blurb: "The live generative + analysis skills, each rendered through its real *-thread-view — 1:1 with the chat, just-completed state. Outlier / degraded run-states nest under their base skill." },
  { id: "loading", label: "Loading", blurb: "The in-flight states — the run capsule mid-run. Reachable in production only by spending a real paid run; mounted here in their live mid-run shapes." },
  { id: "inputs", label: "Inputs", blurb: "The agent-surfaced in-thread affordances (request_input fields) + the context-aware chat follow-up chips." },
  { id: "reading", label: "Reading", blurb: "The Test skill's full /analyze surface — every state, not just the happy path. Each option mounts the REAL component." },
  { id: "room", label: "The Room", blurb: "The audience surface beside the thread. The Ambient v2 surfaces the composer mounts today — the ≥xl rail, the <xl header sheet, the depth drill a sealed row opens, and ⑤ the ＋ door's arm screen — plus the legacy pre-v2 room, which still ships wherever the flag is off." },
  { id: "blocks", label: "Blocks", blurb: "The live in-thread blocks rendered through the SAME MessageBlocks dispatch the thread uses." },
  { id: "composer", label: "Composer", blurb: "The composed card — ONE block type whose slot tree a RECIPE validates, one entry per recipe. Not wired: the type is registered and renders, but nothing emits it until emit_card lands, so read these as the contract, not as something a thread produces today. Every card here sorts its slots into the §0.5 spine itself — the model composes a set of slots, never a layout." },
  { id: "hidden", label: "Hidden & legacy", blurb: "Renderers kept alive but NOT shippable today: the horizontal verbs behind HORIZONTAL_ENABLED (flag off) + the standalone primitives no live skill emits (legacy)." },
];

export default function DevCardsPage() {
  const [tab, setTab] = useState("overview");
  const [readingState, setReadingState] = useState("complete");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  // The <xl header sheet is a controlled surface (composer.tsx owns `roomExpanded`); the gallery
  // owns it here so the collapsed bar AND the full-screen room are both reachable.
  const [roomSheetOpen, setRoomSheetOpen] = useState(false);

  const active = READING_STATES.find((s) => s.id === readingState) ?? READING_STATES[1]!;

  // Grouped once from the arrays above (node JSX untouched — this only sorts + tags).
  const viewById = new Map(THREAD_VIEWS.map((v) => [v.id, v]));
  const skills = SKILL_ORDER.map((id) => ({
    base: viewById.get(id)!,
    variants: THREAD_VIEWS.filter((v) => VARIANT_OF[v.id] === id),
  }));
  const inputs = INPUT_ORDER.map((id) => viewById.get(id)!).filter(Boolean);
  const liveBlocks = BLOCK_SECTIONS.filter((s) => !BLOCK_STATUS[s.type]);
  const hiddenBlocks = BLOCK_SECTIONS.filter((s) => BLOCK_STATUS[s.type]);

  // Overview → jump into a tab and scroll to the picked item (after the tab renders).
  const goTo = (tabId: string, anchor?: string) => {
    setTab(tabId);
    setPendingAnchor(anchor ?? null);
  };
  useEffect(() => {
    if (!pendingAnchor) return;
    const el = document.getElementById(pendingAnchor);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingAnchor(null);
  }, [tab, pendingAnchor]);

  // The counts the overview leads with — a genuine at-a-glance census.
  const counts = {
    skills: skills.length,
    loading: INFLIGHT_VIEWS.length,
    inputs: inputs.length,
    reading: READING_STATES.length,
    room: 6, // 4 v2 surfaces (rail · sheet · depth · ⑤ arm) + the 2 legacy ones, kept while the flag can flip

    blocks: liveBlocks.length,
    composer: COMPOSED_CARD_FIXTURES.length,
    hidden: hiddenBlocks.length,
  };

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[880px] px-4 pb-24">
        {/* Slim sticky header + tab bar — solid (opaque) app-bg bar with a defining bottom edge.
            Uses bg-background (= --color-charcoal-app, the same fill AppShell paints) so it's fully
            opaque and content scrolls cleanly underneath — never see-through. */}
        <div className="sticky top-0 z-20 -mx-4 border-b border-white/[0.06] bg-background px-4 pt-4 pb-2.5">
          <div className="flex items-baseline gap-2.5 pb-2.5">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">What the thread renders</h1>
            <span className="text-[10px] uppercase tracking-[0.08em] text-foreground-muted/60">
              Dev reference
            </span>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const on = t.id === tab;
              const count = counts[t.id as keyof typeof counts];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goTo(t.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                    on
                      ? "border-white/[0.10] bg-surface-elevated text-foreground"
                      : "border-white/[0.06] text-foreground-muted hover:border-white/[0.10] hover:text-foreground-secondary"
                  }`}
                >
                  {t.label}
                  {count !== undefined && (
                    <span className={`ml-1.5 tabular-nums ${on ? "text-foreground-muted" : "text-foreground-muted/60"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active-tab blurb */}
        <p className="max-w-2xl pt-5 text-[12px] leading-relaxed text-foreground-muted">
          {TABS.find((t) => t.id === tab)?.blurb}
        </p>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="flex flex-col gap-3 pt-6">
            <StatusLegend />
            <OverviewGroup
              title="Skills"
              status="live"
              onOpen={() => goTo("skills")}
              chips={skills.map((s) => ({ id: s.base.id, label: s.base.label, status: "live" as Status, onClick: () => goTo("skills", s.base.id) }))}
            />
            <OverviewGroup
              title="Loading states"
              status="live"
              onOpen={() => goTo("loading")}
              chips={INFLIGHT_VIEWS.map((v) => ({ id: v.id, label: v.label, status: "live" as Status, onClick: () => goTo("loading", v.id) }))}
            />
            <OverviewGroup
              title="Inputs & affordances"
              status="live"
              onOpen={() => goTo("inputs")}
              chips={inputs.map((v) => ({ id: v.id, label: v.label, status: "live" as Status, onClick: () => goTo("inputs", v.id) }))}
            />
            <OverviewGroup
              title="Reading surface"
              status="live"
              onOpen={() => goTo("reading")}
              chips={READING_STATES.map((s) => ({ id: s.id, label: s.label, status: "live" as Status, onClick: () => { setReadingState(s.id); goTo("reading"); } }))}
            />
            <OverviewGroup
              title="The Room"
              status={V2_STATUS}
              onOpen={() => goTo("room")}
              chips={[
                { id: "room-rail", label: "Rail · Ambient v2", status: V2_STATUS, onClick: () => goTo("room", "room-rail") },
                { id: "room-sheet", label: "Header sheet (<xl)", status: V2_STATUS, onClick: () => goTo("room", "room-sheet") },
                { id: "room-detail", label: "Depth drill (brain ⇄ audience)", status: V2_STATUS, onClick: () => goTo("room", "room-detail") },
                { id: "room-simulate", label: "Arm a simulation (the ＋ door)", status: V2_STATUS, onClick: () => goTo("room", "room-simulate") },
                { id: "room-bloom", label: "Legacy bloom", status: LEGACY_ROOM_STATUS, onClick: () => goTo("room", "room-bloom") },
                { id: "room-legacy-rail", label: "Legacy rail", status: LEGACY_ROOM_STATUS, onClick: () => goTo("room", "room-legacy-rail") },
              ]}
            />
            <OverviewGroup
              title="In-thread blocks"
              status="live"
              onOpen={() => goTo("blocks")}
              chips={liveBlocks.map((s) => ({ id: s.type, label: s.label, status: "live" as Status, onClick: () => goTo("blocks", s.type) }))}
            />
            <OverviewGroup
              title="Composed cards (one per recipe)"
              status="unwired"
              onOpen={() => goTo("composer")}
              chips={COMPOSED_CARD_FIXTURES.map((f) => ({
                id: `composed-card--${f.props.recipe}`,
                label: COMPOSED_CARD_SECTIONS[f.props.recipe].label,
                status: "unwired" as Status,
                onClick: () => goTo("composer", `composed-card--${f.props.recipe}`),
              }))}
            />
            <OverviewGroup
              title="Hidden & legacy"
              status="flag-off"
              onOpen={() => goTo("hidden")}
              chips={hiddenBlocks.map((s) => ({ id: s.type, label: s.label.replace(/ · HIDDEN$/, ""), status: BLOCK_STATUS[s.type]!, onClick: () => goTo("hidden", s.type) }))}
            />
          </div>
        )}

        {/* ── SKILLS ───────────────────────────────────────────────────────── */}
        {tab === "skills" && (
          <div className="flex flex-col gap-8 pt-6">
            {skills.map(({ base, variants }) => (
              <section key={base.id} id={base.id} className="scroll-mt-32">
                <SectionHead label={base.label} code={`${base.id}-thread-view`} note={base.note} status="live" />
                <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2">
                  {base.node}
                </div>
                {variants.length > 0 && (
                  <div className="mt-4 flex flex-col gap-4 border-l-2 border-white/[0.06] pl-4">
                    <p className="text-[11px] uppercase tracking-[0.06em] text-foreground-muted/70">
                      Run states — same run, one SSE affordance toggled
                    </p>
                    {variants.map((v) => (
                      <section key={v.id} id={v.id} className="scroll-mt-32">
                        <SectionHead label={v.label} code={v.id} note={v.note} status="live" compact />
                        <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2">
                          {v.node}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {/* ── LOADING ──────────────────────────────────────────────────────── */}
        {tab === "loading" && (
          <div className="flex flex-col gap-6 pt-6">
            {INFLIGHT_VIEWS.map((v) => (
              <section key={v.id} id={v.id} className="scroll-mt-32">
                <SectionHead label={v.label} code={v.id} note={v.note} status="live" />
                <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2">
                  {v.node}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── INPUTS ───────────────────────────────────────────────────────── */}
        {tab === "inputs" && (
          <div className="flex flex-col gap-6 pt-6">
            {inputs.map((v) => (
              <section key={v.id} id={v.id} className="scroll-mt-32">
                <SectionHead label={v.label} code={v.id} note={v.note} status="live" />
                <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2">
                  {v.node}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── READING ──────────────────────────────────────────────────────── */}
        {tab === "reading" && (
          <div className="pt-6">
            <SectionHead label="Test / Reading" code="reading.tsx" note={active.note} status="live" />
            {/* State switcher — the flagship has many states and only one was ever visible.
                Every option mounts the REAL component, so it cannot drift from production. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {READING_STATES.map((s) => {
                const on = s.id === readingState;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setReadingState(s.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      on
                        ? "border-white/[0.10] bg-surface-elevated text-foreground"
                        : "border-white/[0.06] text-foreground-muted hover:border-white/[0.10] hover:text-foreground-secondary"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            {/* `transform` makes this the containing block for Reading's position:fixed composer.
                `key` forces a real remount per state (Reading holds reveal/cascade refs). */}
            <div
              key={active.id}
              className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2"
              style={{ transform: "translateZ(0)" }}
            >
              {active.node}
            </div>
          </div>
        )}

        {/* ── THE ROOM ─────────────────────────────────────────────────────── */}
        {tab === "room" && (
          <div className="flex flex-col gap-8 pt-6">
            {/* Which room THIS build ships. Read off the real flag, so the page cannot claim a
                room the composer isn't mounting (it did exactly that until 2026-07-28). */}
            <RoomFlagBanner />

            {/* ── v2 · the rail the composer mounts at ≥xl ─────────────────── */}
            <section id="room-rail" className="scroll-mt-32">
              <SectionHead
                label="The Room · rail (Ambient v2)"
                code="AmbientOverviewRail"
                note="The ≥xl right column, exactly as composer.tsx mounts it: a real Audience, the thread's projected-card ledger, and the sim_seals map. Boxed at the real host geometry (400px wide, full height). Rows h1/h2/h4/h5 are honestly QUEUED; h3 is SEALED from a rehydrated seal — tap it to drill into the real depth. Tapping Simulate → on a QUEUED row spends nothing: it opens the ARM panel (⑤) so a lens and a slice are picked first — config before the run, never a run that back-fills into a config. ⚠️ It is that panel's own 'Simulate ↑' that POSTs the real /api/tools/react, and react has cost 1 CREDIT since 2026-07-28 — the only control on this page that spends money."
                status={V2_STATUS}
              />
              <div className="flex flex-wrap gap-4">
                <div className="h-[860px] w-[400px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06]">
                  <AmbientOverviewRail
                    audience={ROOM_V2_AUDIENCE}
                    descriptors={ROOM_V2_DESCRIPTORS}
                    persistedSeals={ROOM_V2_SEALS}
                  />
                </div>
                {/* The EMPTY rail — a thread with no projected cards yet. The state a creator
                    actually opens on, and the one a fixture-only gallery never showed. */}
                <div className="h-[860px] w-[400px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06]">
                  <AmbientOverviewRail audience={ROOM_V2_AUDIENCE} descriptors={[]} />
                </div>
              </div>
            </section>

            {/* ── v2 · the <xl header sheet ────────────────────────────────── */}
            <section id="room-sheet" className="scroll-mt-32">
              <SectionHead
                label="The Room · header sheet (<xl)"
                code="AmbientOverviewSheet"
                note="What a phone gets: a collapsed bar (room glyph · audience · calibration · N ranked · caret) that opens the SAME rail full screen. The box below is a 390px phone width; the open room portals to <body>, so it takes the whole viewport here exactly as it does on a device — Escape closes it."
                status={V2_STATUS}
              />
              <div className="w-[390px] max-w-full rounded-[var(--radius-lg)] border border-white/[0.06] p-2">
                <AmbientOverviewSheet
                  audience={ROOM_V2_AUDIENCE}
                  descriptors={ROOM_V2_DESCRIPTORS}
                  persistedSeals={ROOM_V2_SEALS}
                  open={roomSheetOpen}
                  onOpenChange={setRoomSheetOpen}
                />
              </div>
            </section>

            {/* ── v2 · the depth drill ─────────────────────────────────────── */}
            <section id="room-detail" className="scroll-mt-32">
              <SectionHead
                label="The Room · depth drill (The brain ⇄ The audience)"
                code="AmbientDetail"
                note="Where a sealed row opens. Both templates are built by the REAL adapters over realistic persisted input — left is a tested VIDEO (buildVideoDomainTemplate: attention scrubber, craft signals, measured-dip why-this-second), right is a TEXT sim (buildDomainTemplate), whose brain tab is honestly unavailable because a concept has no attention read. onBack omitted on purpose — a back button that goes nowhere is a dead control."
                status={V2_STATUS}
              />
              <div className="flex flex-wrap gap-4">
                <div id="detail-video" className="h-[800px] w-[400px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06]">
                  <AmbientDetail template={CREATOR_LIVE_TEMPLATE} />
                </div>
                <div id="detail-text" className="h-[800px] w-[400px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06]">
                  <AmbientDetail template={CREATOR_LIVE_TEXT_TEMPLATE} />
                </div>
              </div>
            </section>

            {/* ── v2 · ⑤ the ＋ door: intake → collect → arm ─────────────────── */}
            <section id="room-simulate" className="scroll-mt-32">
              <SectionHead
                label="The Room · ⑤ arm a simulation (the ＋ door)"
                code="AmbientSimulate · SimulateIntake"
                note="Every state of the spend moment, which in production is reachable only by clicking through a real run. COLD is three steps (pick a door → bring the thing → arm it); DEVELOP skips straight to the arm card pre-filled from a rank. Each state is mounted DIRECTLY rather than advanced into, so the controls that would move between them are inert here — this is a state inspector, and the state each one leads to is the box beside it. NOTE the two geometries, because they are not interchangeable: ① develop mounts CONNECTED inside the rail (400px column, full panel height, so it can end in dead space), ② and ③ come through SimulateDoorHost as a floating 460px sheet sized to its content. There is no ＋ door in this gallery — the door only renders where a host can run what comes through it, and a gallery cannot; the intake is mounted directly instead, which is what /ambient-v2 does."
                status={V2_STATUS}
              />
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">intake · what are you testing?</div>
                  <IntakeStep data={SIM_DEV_DATA} onPick={() => {}} />
                </div>
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">collect · draft</div>
                  <CollectStep data={SIM_DEV_DATA} opt={SIM_DRAFT_DOOR} onCollect={() => {}} />
                </div>
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">collect · video (file or link)</div>
                  <CollectStep data={SIM_DEV_DATA} opt={SIM_VIDEO_DOOR} onCollect={() => {}} />
                </div>
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                    arm ② · cold · text — every dial live
                  </div>
                  <ArmCard
                    data={SIM_DEV_DATA}
                    stimulus={SIM_BROUGHT_TEXT}
                    brought={SIM_BROUGHT_TEXT}
                    onBack={() => {}}
                  />
                </div>
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                    arm ③ · cold · video — lens/slice/scene LOCKED, ten reactors
                  </div>
                  <ArmCard
                    data={SIM_DEV_DATA}
                    stimulus={SIM_BROUGHT_VIDEO}
                    brought={SIM_BROUGHT_VIDEO}
                    onBack={() => {}}
                  />
                </div>
                <div className="w-[460px] max-w-full">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                    the sealed wait — between the POST and its answer
                  </div>
                  <SimDoorReading stimulus={SIM_BROUGHT_TEXT.text} audienceName={ROOM_V2_AUDIENCE.name} />
                  <p className="mt-2 max-w-[460px] text-[11px] leading-relaxed text-foreground-muted">
                    The one state of ⑤ that is not a step: it exists only while the read is in
                    flight, so seeing it in production means spending a credit and being quick. NO
                    NUMBER appears — a verdict withheld until n-of-n decide is the sealed-verdict
                    law. If the read never comes back, one line joins it below the sheet
                    (&ldquo;That read didn&rsquo;t come back. Nothing was sealed — try it
                    again.&rdquo;) and the stimulus stays put.
                  </p>
                </div>
                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground-muted">
                    arm ① · develop — the tie-back band, at REAL rail geometry
                  </div>
                  <div className="h-[860px] w-[400px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06]">
                    <ArmCard
                      data={SIM_DEV_DATA}
                      stimulus={SIM_DEV_DATA.stimulus}
                      develop={SIM_DEV_DATA.develop}
                      connected
                      presentation="rail"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── LEGACY · the pre-v2 room ─────────────────────────────────── */}
            <section id="room-bloom" className="scroll-mt-32">
              <SectionHead
                label="The Room · bloom (legacy, pre-v2)"
                code="AmbientRoom.tsx"
                note="The room the dock bloomed open BEFORE Ambient v2: The brain (simulated neural read) ⇄ The people (named voices) ⇄ The population. Still the shipped room in any build where AMBIENT_V2_ENABLED is false — which is why it stays here instead of being deleted. Do not diff new work against it."
                status={LEGACY_ROOM_STATUS}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-[var(--color-surface-elevated)]">
                  <AmbientRoom
                    flatPersonas={ROOM_FOCUS.personas}
                    conceptText={ROOM_FOCUS.conceptText}
                    fraction={ROOM_FOCUS.fraction}
                    kindLabel="Hook"
                    // ON here so the gallery PREVIEWS the counterfactual — the brain card's rewrite
                    // CTA is a real state, and a state you can't cheaply look at drifts. No-op handler.
                    canRewrite
                    onRewrite={async () => {}}
                    // A real batch, so the readout's SCALE ("#3 of your 5") previews too.
                    focusId="h3"
                    initialCompareOpen={false}
                    siblings={[
                      { id: "h1", conceptText: "The edit nobody tells you about.", fraction: "9/10 stop" },
                      { id: "h2", conceptText: "I deleted 40 hours of B-roll.", fraction: "7/10 stop" },
                      { id: "h3", conceptText: "Stop editing your videos. Do this instead.", fraction: "6/10 stop" },
                      { id: "h4", conceptText: "Your cuts are why they leave.", fraction: "4/10 stop" },
                      { id: "h5", conceptText: "Editing is a trap.", fraction: "2/10 stop" },
                    ]}
                  />
                </div>
                {/* The GROUNDED brain — a real video stimulus + a real retention curve as the drive. */}
                <div className="h-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-[var(--color-surface-elevated)]">
                  <AmbientRoom
                    flatPersonas={ROOM_FOCUS.personas}
                    conceptText={ROOM_FOCUS.conceptText}
                    fraction={ROOM_FOCUS.fraction}
                    kindLabel="Hook"
                    canRewrite={false}
                    brainSource={DEV_BRAIN_SOURCE}
                  />
                </div>
              </div>
            </section>

            {/* The PERSISTENT legacy rail (variant='rail') — same body, in-flow, no bloom. */}
            <section id="room-legacy-rail" className="scroll-mt-32">
              <SectionHead
                label="The Room · persistent rail (legacy, pre-v2)"
                code="AudiencePresence variant='rail'"
                note="variant='rail' — the legacy panel body always shown in-flow inside a fixed-height column: never blooms, never collapses, no overlay. Superseded by AmbientOverviewRail above; it still fills the ≥xl rail whenever AMBIENT_V2_ENABLED is false. The box stands in for the old rail column (340×720)."
                status={LEGACY_ROOM_STATUS}
              />
              <div className="flex flex-wrap gap-4">
                {/* Ranked-compare view (a batch → the ranked overview). */}
                <div id="rail-ranked" className="h-[720px] w-[340px] max-w-full">
                  <AudiencePresence
                    variant="rail"
                    audience={null}
                    audiences={[]}
                    selectedAudienceId={null}
                    onSelectAudience={() => {}}
                    focus={RAIL_FOCUS}
                    focusList={RAIL_SIBLINGS}
                    onStep={() => {}}
                    kindLabel="Hook"
                    open={false}
                    onOpenChange={() => {}}
                  />
                </div>
                {/* Drill view (drillIntoFocus → the taller readout that exercises internal scroll). */}
                <div id="rail-drill" className="h-[720px] w-[340px] max-w-full">
                  <AudiencePresence
                    variant="rail"
                    audience={null}
                    audiences={[]}
                    selectedAudienceId={null}
                    onSelectAudience={() => {}}
                    focus={RAIL_FOCUS}
                    focusList={RAIL_SIBLINGS}
                    onStep={() => {}}
                    kindLabel="Hook"
                    drillIntoFocus
                    open={false}
                    onOpenChange={() => {}}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── BLOCKS (live in-thread) ──────────────────────────────────────── */}
        {tab === "blocks" && (
          <div className="flex flex-col gap-6 pt-6">
            {liveBlocks.map((s) => (
              <section key={s.type} id={s.type} className="scroll-mt-32">
                <SectionHead label={s.label} code={s.type} note={s.note} status="live" />
                <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background p-4">
                  <div className="mx-auto max-w-[760px]">
                    <MessageBlocks body={s.body} />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── COMPOSER (composed cards, one per recipe) ────────────────────── */}
        {tab === "composer" && (
          <div className="flex flex-col gap-6 pt-6">
            {COMPOSED_CARD_FIXTURES.map((f) => {
              const meta = COMPOSED_CARD_SECTIONS[f.props.recipe];
              return (
                <section key={f.props.recipe} id={`composed-card--${f.props.recipe}`} className="scroll-mt-32">
                  <SectionHead label={meta.label} code={`composed-card · ${f.props.recipe}`} note={meta.note} status="unwired" />
                  <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background p-4">
                    <div className="mx-auto max-w-[760px]">
                      {/* The SAME dispatch the thread uses, so the gallery cannot drift from
                          production — and deliberately WITHOUT `ambientBaseIndex` / `blockOrigins`.
                          Both are positional ledger seams: this body is not part of any thread's
                          ledger, so passing them would mint a colliding card id and hand the
                          ambient room another card's reaction (message-blocks.tsx). */}
                      <MessageBlocks body={[f]} />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ── HIDDEN & LEGACY ──────────────────────────────────────────────── */}
        {tab === "hidden" && (
          <div className="flex flex-col gap-6 pt-6">
            {hiddenBlocks.map((s) => {
              const status = BLOCK_STATUS[s.type]!;
              const note = status === "legacy" ? LEGACY_NOTE + s.note : s.note;
              return (
                <section key={s.type} id={s.type} className="scroll-mt-32">
                  <SectionHead label={s.label.replace(/ · HIDDEN$/, "")} code={s.type} note={note} status={status} />
                  <div className="rounded-[var(--radius-lg)] border border-dashed border-white/[0.08] bg-background p-4">
                    <div className="mx-auto max-w-[760px] opacity-90">
                      <MessageBlocks body={s.body} />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status pill — the one honest signal per renderable ───────────────────────
function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] ${m.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Which room this build ships ──────────────────────────────────────────────
// `AMBIENT_V2_ENABLED` is a build-time NEXT_PUBLIC constant, so this reads the same value the
// composer branches on. Printing it here is the whole anti-drift device: the page can no longer
// present a retired room as the product (it did, from the v2 cutover until 2026-07-28 — long
// enough that /go was built against the wrong reference).
function RoomFlagBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-sunken px-3 py-2.5 text-[11px] text-foreground-muted">
      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-foreground-secondary">
        NEXT_PUBLIC_AMBIENT_V2={String(AMBIENT_V2_ENABLED)}
      </code>
      <span>
        {AMBIENT_V2_ENABLED
          ? "→ this build mounts the Ambient v2 rail + header sheet. The legacy room below is unreachable here; it is kept only because the flag can be flipped back."
          : "→ this build still mounts the LEGACY room. The Ambient v2 surfaces below are unreachable here; set the env var and restart the dev server to render them for real."}
      </span>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-sunken px-3 py-2.5 text-[11px] text-foreground-muted">
      <span className="uppercase tracking-[0.06em] text-foreground-muted/60">Legend</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" /> Live — a skill emits it today</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-white/30" /> Flag off — a flag hides it in this build</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/25" /> Legacy — no live producer</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/10 ring-1 ring-inset ring-white/40" /> Not wired — renders, but nothing emits it yet</span>
    </div>
  );
}

// ── Overview group — a role, its status, and its members as jump-chips ───────
function OverviewGroup({
  title,
  status,
  chips,
  onOpen,
}: {
  title: string;
  status: Status;
  chips: { id: string; label: string; status: Status; onClick: () => void }[];
  onOpen: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-surface-sunken p-3.5">
      <div className="mb-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="text-[13px] font-semibold text-foreground transition-colors hover:text-foreground-secondary"
        >
          {title}
        </button>
        <span className="text-[11px] tabular-nums text-foreground-muted/60">{chips.length}</span>
        <StatusPill status={status} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={c.onClick}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-surface-elevated px-2.5 py-1 text-[11px] text-foreground-muted transition-colors hover:border-white/[0.10] hover:text-foreground-secondary"
          >
            {c.status !== "live" && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot}`} />}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHead({
  label,
  code,
  note,
  status,
  compact,
}: {
  label: string;
  code: string;
  note: string;
  status?: Status;
  compact?: boolean;
}) {
  return (
    <div className="mb-3 flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className={`font-semibold text-foreground ${compact ? "text-[13px]" : "text-[15px]"}`}>{label}</h2>
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-foreground-muted">{code}</code>
        {status && <StatusPill status={status} />}
      </div>
      <p className="text-[12px] leading-relaxed text-foreground-muted">{note}</p>
    </div>
  );
}
