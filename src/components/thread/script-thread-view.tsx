'use client';

/**
 * ScriptThreadView — renders the Script surface for the user's open thread (Plan 06-05).
 *
 * Mirrors HooksThreadView exactly for the script skill.
 *
 * Renders two sources of script-card blocks:
 *  1. PERSISTED: script-card messages already in the thread (rehydrates on reload — Pitfall 1)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-script-stream (content-first, D-02).
 *
 * Provides ScriptTestContext.Provider so ScriptCardRenderer can fire the "Test full →"
 * handoff without prop-drilling through MessageBlocks (mirrors HooksThreadView + HookTestContext).
 *
 * Column width: same as /home (max-w-[760px]), THEME-06 flat-warm.
 * No colored tinting, no glow, coral only on CTA accents.
 *
 * Props:
 *  - persistedBlocks: ScriptCardBlock[] from the user's open thread (pass [] if none)
 *  - streamingBlocks: from useScriptStream().toBlocks() (pass [] when idle)
 *  - stages: from useScriptStream().stages
 *  - followupText: from useScriptStream().followupText
 *  - isStreaming: from useScriptStream().isStreaming
 *  - error: from useScriptStream().error
 *  - platform: current platform selection
 *  - onTestScript: callback for script→test handoff (openingBeatLine + scriptBrief)
 *  - onRetry?: re-invokes the skill run (W2 tap-to-retry)
 */

import { PlatformContext } from '@/lib/platform-context';
import { ScriptTestContext } from '@/lib/script-test-context';
import type { OnTestScriptFn } from '@/lib/script-test-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn } from '@/components/thread/thread-shell';
import { ThreadIntro, ThreadOutro } from '@/components/thread/conversational-frame';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import type { StageState } from '@/components/thread/progress-checklist';
import type { ScriptCardBlock } from '@/lib/tools/blocks';

export interface ScriptThreadViewProps {
  /** Validated script-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: ScriptCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: ScriptCardBlock[];
  /** Pipeline stage states from SSE stage events (STUDIO-01). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event. */
  followupText: string | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = skill run failed — render W2 error block). */
  error: string | null;
  /** Current platform selection — provided to ScriptCardRenderer via PlatformContext. */
  platform: string;
  /** "Test full →" handoff callback — called with opening beat line + script brief. */
  onTestScript?: OnTestScriptFn;
  /**
   * Retry callback — re-invokes the skill run from the parent.
   * Called only on explicit tap (W2). Never fires on render.
   */
  onRetry?: () => void;
  userTurn?: string | null;
  skillLabel?: string;
  audienceLabel?: string;
  /** The input hook this script was anchored on (hooks→script handoff). Cited honestly in
   *  the intro — it's an INPUT, known at submit. Absent for a direct topic send. */
  inputHookLine?: string | null;
}

export function ScriptThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  followupText,
  isStreaming,
  error,
  platform,
  onTestScript,
  onRetry,
  userTurn,
  audienceLabel = 'General',
  inputHookLine,
}: ScriptThreadViewProps) {
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

  const hasAssistantContent =
    hasStreamingContent || hasPersistedContent || !!followupText || isStreaming;

  // Premium frame (PR-2): intro only for a fresh run (not a pure rehydrate). The script intro
  // cites the input hook (an INPUT, known at submit) when carried via the hooks→script handoff.
  const isFreshRun = isStreaming || hasStreamingContent;

  return (
    <PlatformContext.Provider value={normalizedPlatform}>
      <ScriptTestContext.Provider value={onTestScript ?? null}>
        <ThreadShell userTurn={userTurn}>
          {error && !isStreaming && <SkillRunError onRetry={onRetry} />}

          {hasAssistantContent && (
            <ThreadAssistantTurn>
              {isFreshRun && (
                <ThreadIntro
                  skill="script"
                  audienceLabel={audienceLabel}
                  platform={platform}
                  hookLine={inputHookLine}
                />
              )}

              {/* Progress: live spine while generating; collapses to a receipt line on completion. */}
              <SkillProgress
                stages={stages}
                plan={STAGE_PLANS.script}
                isStreaming={isStreaming}
                summaryLabel="Ran your audience"
              />

              {/* Result: bare script card (no wrapper frame), revealed once complete (after the spine). */}
              {hasStreamingContent && !isStreaming && (
                <div className="reading-reveal flex flex-col gap-3">
                  {/* Scroll-spy anchors: this run's cards render FIRST here but sit LAST in the
                      room's ledger ([...persisted, ...streaming]) — so the offset is the persisted
                      count. Anchor ids are LEDGER positions, never DOM positions. */}
                  <MessageBlocks body={streamingBody} ambientBaseIndex={persistedBlocks.length} />
                </div>
              )}

              {/* Outro — the engine's real follow-up, restyled (no chips: the script card
                  carries its own "Test full →" terminal handoff). */}
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
      </ScriptTestContext.Provider>
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
          aria-label="Retry the script run"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
