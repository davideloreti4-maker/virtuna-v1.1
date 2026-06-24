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

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { PlatformContext } from '@/lib/platform-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ProgressChecklist } from '@/components/thread/progress-checklist';
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
}

export function IdeasThreadView({
  persistedBlocks,
  streamingBlocks,
  statusMessage,
  stages,
  followupText,
  isStreaming,
  error,
  platform,
  onRetry,
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

  return (
    <PlatformContext.Provider value={normalizedPlatform}>
      <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6 px-4 py-6">

        {/* Progress checklist — replaces the bare status line during streaming (STUDIO-01) */}
        {isStreaming && stages.length > 0 && (
          <ProgressChecklist stages={stages} />
        )}

        {/* Fallback status text when no stage events have arrived yet */}
        {isStreaming && stages.length === 0 && statusMessage && (
          <p
            className="text-sm text-foreground-muted/70 text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusMessage}
          </p>
        )}

        {/* Skill-run error block with tap-to-retry (W2) */}
        {error && !isStreaming && (
          <SkillRunError onRetry={onRetry} />
        )}

        {/* Streaming cards — in-flight (content-first: face + quote appears, band fills in) */}
        {hasStreamingContent && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-foreground-muted/50 uppercase tracking-wide">
              New ideas
            </p>
            <MessageBlocks body={streamingBody} />
          </div>
        )}

        {/* Model-authored follow-up turn (D-03 / STUDIO-02) */}
        {followupText && !isStreaming && (
          <div
            className="prose prose-invert prose-sm max-w-none"
            aria-label="Model follow-up"
          >
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
              {followupText}
            </ReactMarkdown>
          </div>
        )}

        {/* Persisted cards — rehydrated from the open thread on reload */}
        {hasPersistedContent && (
          <div className="flex flex-col gap-4">
            {hasStreamingContent && (
              <div className="border-t border-white/[0.06] pt-4">
                <p className="text-xs text-foreground-muted/50 uppercase tracking-wide mb-4">
                  Previous ideas
                </p>
              </div>
            )}
            <MessageBlocks body={persistedBody} />
          </div>
        )}
      </div>
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
