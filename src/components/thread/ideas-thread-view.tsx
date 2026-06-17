'use client';

/**
 * IdeasThreadView — renders the Ideas surface for the user's open thread.
 *
 * Renders two sources of idea-card blocks:
 *  1. PERSISTED: idea-card messages already in the thread (rehydrates on reload)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-ideas-stream (content-first, IDEAS-02).
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
 *  - statusMessage: from useIdeasStream().statusMessage — shown during generation
 *  - isStreaming: from useIdeasStream().isStreaming
 *  - platform: current platform selection (provided via PlatformContext)
 */

import { PlatformContext } from '@/lib/platform-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

export interface IdeasThreadViewProps {
  /** Validated idea-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: IdeaCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: IdeaCardBlock[];
  /** Status message from the SSE stream ("Generating ideas…" / "Scoring…"). */
  statusMessage: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Current platform selection — provided to IdeaCardRenderer via PlatformContext. */
  platform: string;
}

export function IdeasThreadView({
  persistedBlocks,
  streamingBlocks,
  statusMessage,
  isStreaming,
  platform,
}: IdeasThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isIdle = !isStreaming && !hasStreamingContent && !hasPersistedContent;

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

        {/* Status — legible wait indicator (RESEARCH Pitfall 4) */}
        {isStreaming && statusMessage && (
          <p
            className="text-sm text-foreground-muted/70 text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusMessage}
          </p>
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
