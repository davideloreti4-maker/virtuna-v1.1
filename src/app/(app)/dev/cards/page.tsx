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
import { useState, useEffect } from "react";
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
  MULTI_AUDIENCE_READ_BLOCK,
  SINGLE_AUDIENCE_READ_BLOCK,
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
    note: "The Read skill — /api/tools/read. An in-thread card: the chat agent calls request_input(action:read), the creator's concept POSTs to the route, and this multi-audience-read block renders in the thread (billed action:read). One audience: band + interpretation + Lever + who-not-for + reaction drill. Rendered via MessageBlocks (proves the registry routes multi-audience-read → the renderer).",
    node: <MessageBlocks body={[SINGLE_AUDIENCE_READ_BLOCK]} />,
  },
  {
    id: "read-compare",
    label: "Text Read — compare (2 audiences)",
    note: "The same multi-audience-read card in its 2-audience shape — the side-by-side compare (wins-for-X / bombs-for-Y). Produced by the Audience Manager's Compare flow (audience-manager.tsx handleCompare), not the in-thread path, but the same renderer. The CompareVerdictRow header was de-boxed 2026-07-22.",
    node: <MessageBlocks body={[MULTI_AUDIENCE_READ_BLOCK]} />,
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
type Status = "live" | "flag-off" | "legacy";

const STATUS_META: Record<Status, { label: string; dot: string; tone: string }> = {
  live: { label: "Live", dot: "bg-[var(--color-accent)]", tone: "text-foreground-secondary" },
  "flag-off": { label: "Flag off", dot: "ring-1 ring-inset ring-white/30", tone: "text-foreground-muted" },
  legacy: { label: "Legacy", dot: "bg-white/25", tone: "text-foreground-muted/80" },
};

// Skills, in thread order. Their outlier / degraded run-states NEST under the base skill
// (they are the same run + one SSE affordance) instead of competing as peer sections.
const SKILL_ORDER = ["ideas", "hooks", "script", "remix", "chat", "explore", "account", "read", "read-compare", "video-test-card"] as const;
const VARIANT_OF: Record<string, string> = {
  "ideas-outliers": "ideas",
  "hooks-degraded": "hooks",
  "hooks-outliers": "hooks",
  "script-outliers": "script",
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
  { id: "room", label: "The Room", blurb: "The ambient audience panel body — what the dock blooms open (brain ⇄ people ⇄ population) + the persistent rail." },
  { id: "blocks", label: "Blocks", blurb: "The live in-thread blocks rendered through the SAME MessageBlocks dispatch the thread uses." },
  { id: "hidden", label: "Hidden & legacy", blurb: "Renderers kept alive but NOT shippable today: the horizontal verbs behind HORIZONTAL_ENABLED (flag off) + the standalone primitives no live skill emits (legacy)." },
];

export default function DevCardsPage() {
  const [tab, setTab] = useState("overview");
  const [readingState, setReadingState] = useState("complete");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

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
    room: 2,
    blocks: liveBlocks.length,
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
        <p className="max-w-2xl pt-5 text-[12.5px] leading-relaxed text-foreground-muted">
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
              status="live"
              onOpen={() => goTo("room")}
              chips={[
                { id: "room-bloom", label: "Bloom (brain ⇄ people ⇄ population)", status: "live", onClick: () => goTo("room", "room-bloom") },
                { id: "room-rail", label: "Persistent rail", status: "live", onClick: () => goTo("room", "room-rail") },
              ]}
            />
            <OverviewGroup
              title="In-thread blocks"
              status="live"
              onOpen={() => goTo("blocks")}
              chips={liveBlocks.map((s) => ({ id: s.type, label: s.label, status: "live" as Status, onClick: () => goTo("blocks", s.type) }))}
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
            <section id="room-bloom" className="scroll-mt-32">
              <SectionHead
                label="The Room · bloom"
                code="AmbientRoom.tsx"
                note="What the audience dock blooms open: The brain (simulated neural read — the landing view) ⇄ The people (named voices) ⇄ The population. Fed a fixture focus; the box stands in for the panel."
                status="live"
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

            {/* The PERSISTENT rail presentation (variant='rail') — same body, in-flow, no bloom. */}
            <section id="room-rail" className="scroll-mt-32">
              <SectionHead
                label="The Room · persistent rail (P2)"
                code="AudiencePresence variant='rail'"
                note="variant='rail' — the panel body always shown in-flow inside a fixed-height column: never blooms, never collapses, no overlay. The box below stands in for the rail column (340×720)."
                status="live"
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

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-white/[0.06] bg-surface-sunken px-3 py-2.5 text-[11px] text-foreground-muted">
      <span className="uppercase tracking-[0.06em] text-foreground-muted/60">Legend</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" /> Live — a skill emits it today</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-white/30" /> Flag off — behind HORIZONTAL_ENABLED</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/25" /> Legacy — no live producer</span>
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
      <p className="text-[12.5px] leading-relaxed text-foreground-muted">{note}</p>
    </div>
  );
}
