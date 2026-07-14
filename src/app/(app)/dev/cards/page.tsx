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
import { Reading } from "@/components/reading/reading";
import { makeReadingResult } from "@/components/reading/__tests__/fixtures/reading-fixture";
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
    note: "Ask skill. Grounded answer in a SkillResultCard + suggested chain-step CTAs.",
    node: (
      <ChatThreadView
        persistedBlocks={CHAT_BLOCKS}
        streamingBlocks={[]}
        isStreaming={false}
        coldStart={false}
        nudgeShown={false}
        error={null}
        platform="tiktok"
        onSuggestChain={noop}
        userTurn={USER_TURNS.chat}
        skillLabel="Ask"
        audienceLabel={AUDIENCE}
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
];

const READING_RESULT = makeReadingResult();

export default function DevCardsPage() {
  const sections = [
    ...THREAD_VIEWS.map((v) => ({ id: v.id, label: v.label })),
    { id: "reading", label: "Test / Reading" },
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
              note="Real-video Read: score hero + drivers + audience + Fix First + Deeper read + follow-up chat. Rendered via the real <Reading> with a fixture result (overrideData seam)."
            />
            {/* `transform` makes this the containing block for Reading's position:fixed
                ReadingChat composer, so it docks inside the section instead of floating
                over the whole gallery. overflow-hidden clips it to the card. */}
            <div
              className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-background py-2"
              style={{ transform: "translateZ(0)" }}
            >
              <Reading overrideData={READING_RESULT} />
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
