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

import { IdeasThreadView } from "@/components/thread/ideas-thread-view";
import { HooksThreadView } from "@/components/thread/hooks-thread-view";
import { ScriptThreadView } from "@/components/thread/script-thread-view";
import { RemixThreadView } from "@/components/thread/remix-thread-view";
import { ChatThreadView } from "@/components/thread/chat-thread-view";
import { ExploreThreadView } from "@/components/thread/explore-thread-view";
import { AccountReadThreadView } from "@/components/thread/account-read-thread-view";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import { useState } from "react";
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
  CHAT_BLOCKS,
  EXPLORE_BLOCKS,
  ACCOUNT_BLOCK,
  BLOCK_SECTIONS,
  USER_TURNS,
  FOLLOWUPS,
  doneStages,
} from "./fixtures";

const AUDIENCE = "Bootstrapped Founders";
const noop = () => {};

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
    label: "In-thread link field",
    note: "The agent-surfaced input affordance (input-request block → request_link tool). When you ask to remix/adapt a video without a link, the agent shows this inline field IN THE THREAD; pasting a link runs the Remix in-place. Rendered via MessageBlocks (proves the registry routes input-request → the renderer).",
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

// ── The Room — the ambient audience panel body (The brain ⇄ The people ⇄ Population). ──
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

export default function DevCardsPage() {
  const [readingState, setReadingState] = useState('complete');
  const active = READING_STATES.find((s) => s.id === readingState) ?? READING_STATES[1]!;

  const sections = [
    ...THREAD_VIEWS.map((v) => ({ id: v.id, label: v.label })),
    { id: "reading", label: "Test / Reading" },
    { id: "room", label: "The Room" },
    ...BLOCK_SECTIONS.map((s) => ({ id: s.type, label: s.label })),
  ];

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-6">
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-5">
          <span className="text-[11px] uppercase tracking-[0.06em] text-foreground-muted">
            Dev · design reference
          </span>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Thread — every skill output</h1>
          <p className="max-w-2xl text-sm text-foreground-muted">
            Every skill rendered through its real thread view, 1:1 with the chat — just-completed
            state (your turn → intro → progress receipt → cards → follow-up). Edit any thread
            component and this page updates live.
          </p>
          <nav className="flex flex-wrap gap-1.5 pt-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-white/[0.06] bg-surface-elevated px-2.5 py-1 text-[11px] text-foreground-muted transition-colors hover:border-white/[0.10] hover:text-foreground-secondary"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </header>

        {/* Group A — real skill thread views */}
        <div className="flex flex-col gap-4 pt-8">
          <SectionKicker>Skill thread views · 1:1 with the chat</SectionKicker>
          {THREAD_VIEWS.map((v) => (
            <section key={v.id} id={v.id} className="scroll-mt-6">
              <SectionHead label={v.label} code={`${v.id}-thread-view`} note={v.note} />
              {/* Neutral thread backdrop so proportions read like /home. The view owns its 760px column. */}
              <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2">
                {v.node}
              </div>
            </section>
          ))}
        </div>

        {/* Group C — the Test / real-video Reading surface (its own page, not a thread card) */}
        <div className="flex flex-col gap-4 pt-14">
          <SectionKicker>Test skill · the full Reading surface (/analyze/[id])</SectionKicker>
          <section id="reading" className="scroll-mt-6">
            <SectionHead
              label="Test / Reading"
              code="reading.tsx"
              note={active.note}
            />

            {/* State switcher — the flagship has NINE states and only one of them was ever
                visible. Every option below mounts the REAL component, so this cannot drift from
                production the way a static mock would. */}
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
                        ? 'border-white/[0.10] bg-surface-elevated text-foreground'
                        : 'border-white/[0.06] text-foreground-muted hover:border-white/[0.10] hover:text-foreground-secondary'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* `transform` makes this the containing block for Reading's position:fixed
                ReadingChat composer, so it docks inside the section instead of floating
                over the whole gallery. overflow-hidden clips it to the card.
                `key` forces a real remount per state — Reading holds reveal/cascade refs
                (sawSkeleton) that would otherwise carry across a state switch and show you a
                transition that no real user ever gets. */}
            <div
              key={active.id}
              className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2"
              style={{ transform: "translateZ(0)" }}
            >
              {active.node}
            </div>
          </section>
        </div>

        {/* Group D — the ambient Room panel body (the dock's bloom) */}
        <div className="flex flex-col gap-4 pt-14">
          <SectionKicker>The Room · the ambient audience panel body</SectionKicker>
          <section id="room" className="scroll-mt-6">
            <SectionHead
              label="The Room"
              code="AmbientRoom.tsx"
              note="What the audience dock blooms open: The brain (simulated neural read — the landing view) ⇄ The people (named voices) ⇄ Population · 1,000. Fed a fixture focus; the box stands in for the panel."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-[var(--color-surface-elevated)]">
                <AmbientRoom
                  flatPersonas={ROOM_FOCUS.personas}
                  conceptText={ROOM_FOCUS.conceptText}
                  fraction={ROOM_FOCUS.fraction}
                  kindLabel="Hook"
                  // ON here so the gallery actually PREVIEWS the counterfactual — the brain card's
                  // rewrite CTA is a real state, and a state you cannot cheaply look at is one that
                  // drifts. The handler is a no-op: the dev page has no composer to re-run a skill.
                  canRewrite
                  onRewrite={async () => {}}
                  // A real batch, so the readout's SCALE ("#3 of your 5") previews too. Same reason.
                  // `initialCompareOpen={false}` because a batch otherwise lands the Room on its
                  // ranked-compare overview — correct in the product, but it would hide the brain
                  // in the gallery, which exists precisely to LOOK at the brain.
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
              {/* The GROUNDED brain — a real video as the stimulus + a real retention curve as the
                  drive. Here the curve is a fixture (holds, then breaks at 45%); in the Read it is
                  the audience's measured curve. */}
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
        </div>

        {/* Group B — in-thread blocks via MessageBlocks */}
        <div className="flex flex-col gap-4 pt-14">
          <SectionKicker>In-thread blocks · rendered via MessageBlocks</SectionKicker>
          {BLOCK_SECTIONS.map((s) => (
            <section key={s.type} id={s.type} className="scroll-mt-6">
              <SectionHead label={s.label} code={s.type} note={s.note} />
              <div className="rounded-[var(--radius-lg)] border border-white/[0.06] bg-background p-4">
                <div className="mx-auto max-w-[760px]">
                  <MessageBlocks body={s.body} />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-foreground-muted/70">
      {children}
    </p>
  );
}

function SectionHead({ label, code, note }: { label: string; code: string; note: string }) {
  return (
    <div className="mb-3 flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">{label}</h2>
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-foreground-muted">{code}</code>
      </div>
      <p className="text-[12.5px] text-foreground-muted">{note}</p>
    </div>
  );
}
