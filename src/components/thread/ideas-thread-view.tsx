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
import { followupsForKind } from '@/lib/tools/chat-followups';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import { OutliersOffer } from '@/components/thread/outliers-offer';
import { SkillRunError, RunWarnings } from '@/components/thread/run-notices';
import type { StageState } from '@/components/thread/progress-checklist';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

export interface IdeasThreadViewProps {
  /** Validated idea-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: IdeaCardBlock[];
  /**
   * Base offset into the unified ambient ledger for this view's streaming cards (thread-unification
   * Phase 4) — they render after every persisted block, so their scroll-spy anchors must be based at
   * the persisted block count. Defaults to persistedBlocks.length for the legacy self-contained render.
   */
  ambientBaseIndex?: number;
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: IdeaCardBlock[];
  /** Status message from the SSE stream — fallback text while streaming. */
  statusMessage: string | null;
  /** Pipeline stage states from SSE stage events (STUDIO-01 / Plan 05-04). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event (D-03 / Plan 05-04). */
  followupText: string | null;
  /**
   * Run-level degrade notices from the `warning` SSE event — [] on a clean run. The route
   * has emitted these since grounding shipped; rendering them is what makes a degrade
   * distinguishable from a clean run at the glass (mirrors HooksThreadView).
   */
  warnings?: string[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = skill run failed — render W2 error block). */
  error: string | null;
  /** Current platform selection — provided to IdeaCardRenderer via PlatformContext. */
  platform: string;
  /**
   * True when the server signalled (via the `outliers` SSE event) that a live scrape could find
   * proven outliers this run couldn't. Gates the "Find new outliers" affordance. Default false.
   */
  outliersAvailable?: boolean;
  /**
   * "Find new outliers" callback — re-runs the last send with a live outlier scrape authorized
   * (explicit spend). Called ONLY on tap, never on render. Absent → the affordance is not rendered.
   */
  onFindOutliers?: () => void;
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
  ambientBaseIndex,
  streamingBlocks,
  stages,
  followupText,
  outliersAvailable = false,
  onFindOutliers,
  warnings = [],
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
        {error && !isStreaming && <SkillRunError onRetry={onRetry} retryLabel="Retry the ideas run" />}

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
                <MessageBlocks body={streamingBody} ambientBaseIndex={ambientBaseIndex ?? persistedBlocks.length} />
              </div>
            )}

            {/* Find new outliers — offered only when the server says a live scrape would actually
                find some (outliersAvailable) and the run has settled. Tapping it spends: it re-runs
                the same subject with a live scan authorized. No offer on a clean grounded run. */}
            {!isStreaming && outliersAvailable && onFindOutliers && (
              <OutliersOffer onFindOutliers={onFindOutliers} />
            )}

            {/* Degrade notices — a degrade is not a failure (the cards are real), so this is an

                informational note below the result, hidden entirely on a clean run. */}

            {!isStreaming && warnings.length > 0 && <RunWarnings warnings={warnings} />}


            {/* Outro — the engine's real follow-up, restyled (no chips: the idea card
                carries its own "Develop into hooks →" handoff). */}
            {!isStreaming && (
              <ThreadOutro text={followupText} followups={followupsForKind('ideas')} />
            )}

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

