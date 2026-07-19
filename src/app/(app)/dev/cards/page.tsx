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
import { AudiencePresence } from "@/components/audience-lens/audience-presence";
import { useState } from "react";
import { ProgressChecklist } from "@/components/thread/progress-checklist";
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
    note: "The /test in-thread result (video-test-card, model:sim1-max). The full frame-by-frame /api/analyze Max pipeline runs underneath; its result is mapped onto THIS card so the Test lands in the thread like every other skill — no navigate-out. Bands/WORDS only (never the 0-100 score); the number + filmstrips/verbatim/Apollo live one door away (See the full breakdown → /analyze/[id]). Rendered via MessageBlocks (proves the registry routes video-test-card → the renderer).",
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
                  verdict: "Solid contender",
                  goNoGo: "go",
                  audienceName: "Skincare buyers",
                  band: "Mixed",
                  fraction: "6/10 stopped",
                  theOneFix:
                    "Open on the after-shot, not the intro — the payoff is buried behind three seconds of setup.",
                  ceiling:
                    "The hook lands but the middle sags — retention drops the moment the demo starts, so it caps below a breakout.",
                  reactions: [
                    { archetype: "skeptic", verdict: "scroll", quote: "Seen this exact format a hundred times — nothing new in the first second." },
                    { archetype: "collector", verdict: "stop", quote: "Saved it — the routine is specific enough to actually try." },
                    { archetype: "scanner", verdict: "stop", quote: "The on-screen text told me what I'd get. I stayed." },
                    { archetype: "converter", verdict: "scroll", quote: "No reason given to buy — it's a vibe, not a pitch." },
                  ],
                  postWindow: "Tue 18:00–21:00 UTC",
                  conceptText: "Three things I wish I knew before I started my skincare routine",
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
];

// ── Group A2: the IN-FLIGHT states — the run capsule, previewable at last (2026-07-19) ────────
// The 07-14 audit's lesson: a surface with no cheap way to LOOK at it will drift. The thread
// views' completed states preview above, and Reading's skeleton previews below — but the thread's
// LIVE loading states (the spine mid-run, the chat capsule, the field waits) were reachable only
// by spending a real paid run. These mount the REAL components in their mid-run shapes.
const INFLIGHT_VIEWS: { id: string; label: string; note: string; node: React.ReactNode }[] = [
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

export default function DevCardsPage() {
  const [readingState, setReadingState] = useState('complete');
  const active = READING_STATES.find((s) => s.id === readingState) ?? READING_STATES[1]!;

  const sections = [
    ...THREAD_VIEWS.map((v) => ({ id: v.id, label: v.label })),
    ...INFLIGHT_VIEWS.map((v) => ({ id: v.id, label: v.label })),
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

        {/* Group A2 — the in-flight states (the run capsule) */}
        <div className="flex flex-col gap-4 pt-14">
          <SectionKicker>In-flight · the run capsule (loading states, mid-run)</SectionKicker>
          {INFLIGHT_VIEWS.map((v) => (
            <section key={v.id} id={v.id} className="scroll-mt-6">
              <SectionHead label={v.label} code={`${v.id}`} note={v.note} />
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

            {/* P2 — the PERSISTENT rail presentation (variant='rail'). The same body as above, but
                hosted by AudiencePresence in-flow: no bloom, no z-[55] overlay, no collapse chevron.
                Boxed at a real rail width (340) × height (720) so the geometry reads like the ≥xl
                desktop rail. This is the A1 verify surface — prove it renders before A2 re-parents it
                into HomePageLayout. */}
            <div className="mt-6">
              <SectionHead
                label="The Room · persistent rail (P2)"
                code="AudiencePresence variant='rail'"
                note="variant='rail' — the panel body always shown in-flow inside a fixed-height column: never blooms, never collapses, no overlay. A2 re-parents THIS into the desktop rail (≥xl) / mobile header. The box below stands in for the rail column (340×720)."
              />
              <div className="flex flex-wrap gap-4">
                {/* Ranked-compare view (a batch of siblings → the ranked overview). */}
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
                {/* Drill view (drillIntoFocus → the brain/people readout, the taller state that
                    exercises the rail's internal scroll). */}
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
