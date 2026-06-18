'use client';

/**
 * HooksThreadView — renders the Hooks surface for the user's open thread (Plan 04-03, Task 1).
 *
 * Renders two sources of hook-card blocks:
 *  1. PERSISTED: hook-card messages already in the thread (rehydrates on reload — Task 3)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-hooks-stream (content-first, D-02).
 *
 * Column width: same as /home (max-w-[760px]), readable column, THEME-06 flat-warm.
 * No colored tinting, no glow, coral only on CTA accents (per CLAUDE.md Raycast rules).
 *
 * Provides PlatformContext so HookCardRenderer can read the active platform for
 * the "Test full →" CTA without threading it through MessageBlocks (mirrors
 * IdeasThreadView / IdeaCardRenderer pattern for "Develop this →").
 *
 * Cards are rendered in RANK order (#1 first) — the runner (04-02) already ordered them;
 * rendering in array order produces rank order.
 *
 * Props:
 *  - persistedBlocks: HookCardBlock[] from the user's open thread (pass [] if none)
 *  - streamingBlocks: from useHooksStream().toBlocks() (pass [] when idle)
 *  - statusMessage: from useHooksStream().statusMessage — shown during generation
 *  - isStreaming: from useHooksStream().isStreaming
 *  - platform: current platform selection (provided via PlatformContext)
 *  - onTestHook: callback passed down to HookCardRenderer via PlatformContext seam
 *    for the "Test full →" CTA (Task 2 wires the real deep-link)
 */

import { PlatformContext } from '@/lib/platform-context';
import { HookTestContext } from '@/lib/hook-test-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import type { HookCardBlock } from '@/lib/tools/blocks';

export interface HooksThreadViewProps {
  /** Validated hook-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: HookCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: HookCardBlock[];
  /** Status message from the SSE stream ("Generating hooks…" / "Scoring on your audience…"). */
  statusMessage: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Current platform selection — provided to HookCardRenderer via PlatformContext. */
  platform: string;
  /** "Test full →" handoff callback — called with the chosen hook's hookLine + audienceArchetype. */
  onTestHook?: (hookLine: string, audienceArchetype: string) => void;
}

export function HooksThreadView({
  persistedBlocks,
  streamingBlocks,
  statusMessage,
  isStreaming,
  platform,
  onTestHook,
}: HooksThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isIdle = !isStreaming && !hasStreamingContent && !hasPersistedContent;

  if (isIdle) return null;

  // Convert HookCardBlocks to the raw body format MessageBlocks expects
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
      <HookTestContext.Provider value={onTestHook ?? null}>
        <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6 px-4 py-6">

          {/* Status — legible wait indicator during streaming */}
          {isStreaming && statusMessage && (
            <p
              className="text-sm text-foreground-muted/70 text-center"
              aria-live="polite"
              aria-atomic="true"
            >
              {statusMessage}
            </p>
          )}

          {/* Streaming cards — in-flight (content-first: hookLine + archetype tag + rank + quote → band chip) */}
          {hasStreamingContent && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-foreground-muted/50 uppercase tracking-wide">
                New hooks
              </p>
              <MessageBlocks body={streamingBody} />
            </div>
          )}

          {/* Persisted cards — rehydrated from the open thread on reload (Task 3) */}
          {hasPersistedContent && (
            <div className="flex flex-col gap-4">
              {hasStreamingContent && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-xs text-foreground-muted/50 uppercase tracking-wide mb-4">
                    Previous hooks
                  </p>
                </div>
              )}
              <MessageBlocks body={persistedBody} />
            </div>
          )}
        </div>
      </HookTestContext.Provider>
    </PlatformContext.Provider>
  );
}
