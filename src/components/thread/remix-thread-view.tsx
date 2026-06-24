'use client';

/**
 * RemixThreadView — renders the Remix surface for the user's open thread (Plan 06-05).
 *
 * Mirrors HooksThreadView for the remix skill.
 *
 * Renders two sources of remix-card blocks:
 *  1. PERSISTED: remix-card messages already in the thread (rehydrates on reload — Pitfall 1)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-remix-stream (content-first, D-02).
 *
 * Provides RemixDevelopContext.Provider so RemixCardRenderer can fire the "Develop into
 * hooks →" card-POST handoff without prop-drilling through MessageBlocks.
 * Also provides PlatformContext so the card's onDevelop can include the correct platform.
 *
 * Column width: same as /home (max-w-[760px]), THEME-06 flat-warm.
 * No colored tinting, no glow, coral only on CTA accents.
 *
 * Props:
 *  - persistedBlocks: RemixCardBlock[] from the user's open thread (pass [] if none)
 *  - streamingBlocks: from useRemixStream().toBlocks() (pass [] when idle)
 *  - stages: from useRemixStream().stages
 *  - followupText: from useRemixStream().followupText
 *  - isStreaming: from useRemixStream().isStreaming
 *  - error: from useRemixStream().error
 *  - platform: current platform selection
 *  - onDevelop: callback for remix→hooks handoff (adaptedHook + platform)
 *  - onRetry?: re-invokes the skill run (W2 tap-to-retry)
 */

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { PlatformContext } from '@/lib/platform-context';
import { RemixDevelopContext } from '@/lib/remix-develop-context';
import type { OnDevelopRemixFn } from '@/lib/remix-develop-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ProgressChecklist } from '@/components/thread/progress-checklist';
import type { StageState } from '@/components/thread/progress-checklist';
import type { RemixCardBlock } from '@/lib/tools/blocks';

export interface RemixThreadViewProps {
  /** Validated remix-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: RemixCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: RemixCardBlock[];
  /** Pipeline stage states from SSE stage events (STUDIO-01). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event. */
  followupText: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = skill run failed — render W2 error block). */
  error: string | null;
  /** Current platform selection — provided via PlatformContext to RemixCardRenderer. */
  platform: string;
  /** "Develop into hooks →" handoff callback — fires a card-POST to the develop endpoint. */
  onDevelop?: OnDevelopRemixFn;
  /**
   * Retry callback — re-invokes the skill run from the parent.
   * Called only on explicit tap (W2). Never fires on render.
   */
  onRetry?: () => void;
}

export function RemixThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  followupText,
  isStreaming,
  error,
  platform,
  onDevelop,
  onRetry,
}: RemixThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isIdle = !isStreaming && !hasStreamingContent && !hasPersistedContent && !error && !followupText;

  if (isIdle) return null;

  const persistedBody: unknown[] = persistedBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  const normalizedPlatform = (['tiktok', 'instagram', 'youtube'] as const).find(
    (p) => p === platform,
  ) ?? 'tiktok';

  return (
    <PlatformContext.Provider value={normalizedPlatform}>
      <RemixDevelopContext.Provider value={onDevelop ?? null}>
        <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6 px-4 py-6">

          {/* Progress checklist — real pipeline stages during streaming (STUDIO-01) */}
          {isStreaming && stages.length > 0 && (
            <ProgressChecklist stages={stages} />
          )}

          {/* Skill-run error block with tap-to-retry (W2) */}
          {error && !isStreaming && (
            <SkillRunError onRetry={onRetry} />
          )}

          {/* Streaming cards — in-flight (content-first) */}
          {hasStreamingContent && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-foreground-muted/50 uppercase tracking-wide">
                New remix
              </p>
              <MessageBlocks body={streamingBody} />
            </div>
          )}

          {/* Model-authored follow-up turn */}
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

          {/* Persisted cards — rehydrated from the open thread on reload (Pitfall 1 closed) */}
          {hasPersistedContent && (
            <div className="flex flex-col gap-4">
              {hasStreamingContent && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-xs text-foreground-muted/50 uppercase tracking-wide mb-4">
                    Previous remix
                  </p>
                </div>
              )}
              <MessageBlocks body={persistedBody} />
            </div>
          )}
        </div>
      </RemixDevelopContext.Provider>
    </PlatformContext.Provider>
  );
}

// ── SkillRunError ─────────────────────────────────────────────────────────────

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
          aria-label="Retry the remix run"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
