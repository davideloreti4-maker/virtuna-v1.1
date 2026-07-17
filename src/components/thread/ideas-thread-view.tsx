'use client';

/**
 * IdeasThreadView — renders the Ideas surface for the user's open thread (updated Plan 05-04, Task 3).
 *
 * Renders two sources of idea-card blocks:
 *  1. PERSISTED: idea-card messages already in the thread (rehydrates on reload)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-ideas-stream (content-first, IDEAS-02).
 *
 * Plan 05-04 additions:
 *  - ProgressChecklist renders while streaming (replaces bare status line) — STUDIO-01
 *  - followupText (model-authored markdown turn) renders below the card group — STUDIO-02/D-03
 *  - Skill-run error block with tap-to-retry renders when error is truthy — W2
 *  - onRetry prop wired to the retry affordance (re-invokes start from parent)
 *
 * Column width: same as /home (max-w-[760px]), readable column, THEME-06 flat-warm.
 * No colored tinting, no glow, coral only on CTA accents (per CLAUDE.md Raycast rules).
 *
 * Provides PlatformContext so IdeaCardRenderer can read the active platform for
 * the "Develop this →" CTA without threading it through MessageBlocks.
 *
 * Props:
 *  - persistedBlocks: IdeaCardBlock[] from the user's open thread (pass [] if none)
 *  - streamingBlocks: from useIdeasStream().toBlocks() (pass [] when idle)
 *  - statusMessage: from useIdeasStream().statusMessage — fallback while streaming
 *  - stages: from useIdeasStream().stages — Perplexity-style checklist rows
 *  - followupText: from useIdeasStream().followupText — model-authored markdown turn
 *  - isStreaming: from useIdeasStream().isStreaming
 *  - error: from useIdeasStream().error — truthy = skill run failed
 *  - platform: current platform selection (provided via PlatformContext)
 *  - onRetry?: callback re-invokes the skill run (W2 tap-to-retry)
 */

import { PlatformContext } from '@/lib/platform-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn } from '@/components/thread/thread-shell';
import { ThreadIntro, ThreadOutro } from '@/components/thread/conversational-frame';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

export interface IdeasThreadViewProps {
  /** Validated idea-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: IdeaCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: IdeaCardBlock[];
  /** Status message from the SSE stream — fallback text while streaming. */
  statusMessage: string | null;
  /** Pipeline stage states from SSE stage events (STUDIO-01 / Plan 05-04). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event (D-03 / Plan 05-04). */
  followupText: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = skill run failed — render W2 error block). */
  error: string | null;
  /** Current platform selection — provided to IdeaCardRenderer via PlatformContext. */
  platform: string;
  /**
   * Retry callback — re-invokes the skill run from the parent.
   * Called only on explicit tap (W2). Never fires on render.
   */
  onRetry?: () => void;
  userTurn?: string | null;
  skillLabel?: string;
  audienceLabel?: string;
}

export function IdeasThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  followupText,
  isStreaming,
  error,
  platform,
  onRetry,
  userTurn,
  audienceLabel = 'General',
}: IdeasThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isIdle = !isStreaming && !hasStreamingContent && !hasPersistedContent && !error && !followupText;

  if (isIdle) return null;

  // Convert IdeaCardBlocks to the raw body format MessageBlocks expects
  const persistedBody: unknown[] = persistedBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  // Normalize platform to the expected type (context defaults to "tiktok" on any unknown value)
  const normalizedPlatform = (['tiktok', 'instagram', 'youtube'] as const).find(
    (p) => p === platform,
  ) ?? 'tiktok';

  const hasAssistantContent =
    hasStreamingContent || hasPersistedContent || !!followupText || isStreaming;

  // Premium frame (PR-2): intro only for a fresh run (not a pure rehydrate).
  const isFreshRun = isStreaming || hasStreamingContent;

  return (
    <PlatformContext.Provider value={normalizedPlatform}>
      <ThreadShell userTurn={userTurn}>
        {error && !isStreaming && <SkillRunError onRetry={onRetry} />}

        {hasAssistantContent && (
          <ThreadAssistantTurn>
            {isFreshRun && (
              <ThreadIntro skill="ideas" audienceLabel={audienceLabel} platform={platform} />
            )}

            {/* Progress: live spine while generating; collapses to a receipt line on completion. */}
            <SkillProgress
              stages={stages}
              plan={STAGE_PLANS.ideas}
              isStreaming={isStreaming}
              summaryLabel="Ran your audience"
            />

            {/* Result: bare idea cards (no wrapper frame), revealed once complete (after the spine). */}
            {hasStreamingContent && !isStreaming && (
              <div className="reading-reveal flex flex-col gap-3">
                {/* Scroll-spy anchors: this run's cards render FIRST here but sit LAST in the
                    room's ledger ([...persisted, ...streaming]) — so the offset is the persisted
                    count. Anchor ids are LEDGER positions, never DOM positions. */}
                <MessageBlocks body={streamingBody} ambientBaseIndex={persistedBlocks.length} />
              </div>
            )}

            {/* Outro — the engine's real follow-up, restyled (no chips: the idea card
                carries its own "Develop into hooks →" handoff). */}
            {!isStreaming && <ThreadOutro text={followupText} />}

            {hasPersistedContent && !isStreaming && (
              <div className="flex flex-col gap-3">
                {hasStreamingContent && (
                  <p className="pt-1 text-[11px] uppercase tracking-wide text-foreground-muted/50">
                    Earlier
                  </p>
                )}
                <MessageBlocks body={persistedBody} ambientBaseIndex={0} />
              </div>
            )}
          </ThreadAssistantTurn>
        )}
      </ThreadShell>
    </PlatformContext.Provider>
  );
}

// ── SkillRunError ─────────────────────────────────────────────────────────────

/**
 * Skill-run error block with tap-to-retry (W2 — UI-SPEC §Copywriting).
 * Renders ONLY when error is truthy and the stream has ended.
 * The retry button calls onRetry ONLY on explicit tap — never on render.
 *
 * This same component shape is reused by the refine error path (Plan 05).
 */
interface SkillRunErrorProps {
  onRetry?: () => void;
}

function SkillRunError({ onRetry }: SkillRunErrorProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
        Couldn&rsquo;t finish that run.
      </p>
      <p className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
        The generation or SIM-1 pass dropped out. Tap to retry — nothing was charged.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-sm font-medium self-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
          style={{ color: 'var(--color-cream-secondary)' }}
          aria-label="Retry the ideas run"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
