'use client';

/**
 * HooksThreadView — renders the Hooks surface for the user's open thread (Plan 04-03, Task 1; updated Plan 05-04, Task 3).
 *
 * Renders two sources of hook-card blocks:
 *  1. PERSISTED: hook-card messages already in the thread (rehydrates on reload — Task 3)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight cards from use-hooks-stream (content-first, D-02).
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
 * Props:
 *  - persistedBlocks: HookCardBlock[] from the user's open thread (pass [] if none)
 *  - streamingBlocks: from useHooksStream().toBlocks() (pass [] when idle)
 *  - statusMessage: from useHooksStream().statusMessage — shown during generation
 *  - stages: from useHooksStream().stages — Perplexity-style checklist rows
 *  - followupText: from useHooksStream().followupText — model-authored markdown turn
 *  - isStreaming: from useHooksStream().isStreaming
 *  - error: from useHooksStream().error — truthy = skill run failed
 *  - platform: current platform selection (provided via PlatformContext)
 *  - onTestHook: callback passed down to HookCardRenderer via HookTestContext
 *  - onRetry?: callback re-invokes the skill run (W2 tap-to-retry)
 */

import { PlatformContext } from '@/lib/platform-context';
import { HookTestContext, HookWriteScriptContext } from '@/lib/hook-test-context';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn } from '@/components/thread/thread-shell';
import { ThreadIntro, ThreadOutro, outroFallback, type ForwardChip } from '@/components/thread/conversational-frame';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import type { StageState } from '@/components/thread/progress-checklist';
import type { HookCardBlock } from '@/lib/tools/blocks';

export interface HooksThreadViewProps {
  /** Validated hook-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: HookCardBlock[];
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: HookCardBlock[];
  /** Status message from the SSE stream — fallback text while streaming. */
  statusMessage: string | null;
  /** Pipeline stage states from SSE stage events (STUDIO-01 / Plan 05-04). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event (D-03 / Plan 05-04). */
  followupText: string | null;
  /**
   * Run-level degrade notices from the `warning` SSE event — e.g. per-persona targeting drifted
   * (target-assignment.ts) or grounding fell back to ungrounded. [] on a clean run. The route has
   * emitted these since grounding shipped; until 2026-07-17 nothing rendered them, so a degrade was
   * indistinguishable from a clean run at the glass.
   */
  warnings: string[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = skill run failed — render W2 error block). */
  error: string | null;
  /** Current platform selection — provided to HookCardRenderer via PlatformContext. */
  platform: string;
  /** "Test full →" handoff callback — called with the chosen hook's hookLine + audienceArchetype. */
  onTestHook?: (hookLine: string, audienceArchetype: string) => void;
  /** "Write script →" handoff callback (hooks→script) — called with the chosen hook's hookLine + audienceArchetype. */
  onWriteScriptHook?: (hookLine: string, audienceArchetype: string) => void;
  /**
   * Retry callback — re-invokes the skill run from the parent.
   * Called only on explicit tap (W2). Never fires on render.
   */
  onRetry?: () => void;
  userTurn?: string | null;
  skillLabel?: string;
  audienceLabel?: string;
}

export function HooksThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  followupText,
  warnings,
  isStreaming,
  error,
  platform,
  onTestHook,
  onWriteScriptHook,
  onRetry,
  userTurn,
  audienceLabel = 'General',
}: HooksThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isIdle = !isStreaming && !hasStreamingContent && !hasPersistedContent && !error && !followupText;

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

  const hasAssistantContent =
    hasStreamingContent || hasPersistedContent || !!followupText || isStreaming;

  // Premium frame (PR-2): the intro is the present-tense "you were heard" line — show it for a
  // FRESH run only (a pure rehydrate of a finished thread shouldn't read "I'm pulling hooks…").
  // The forward chip derives from the top (rank-1) card's REAL hook→script handoff; hook→test
  // is intentionally NOT offered (lane/polish §1.7 — a hook is only an opener).
  const isFreshRun = isStreaming || hasStreamingContent;
  const topHook = (streamingBlocks[0] ?? persistedBlocks[0])?.props;
  const chips: ForwardChip[] = topHook
    ? [
        {
          label: `Write a script from #${topHook.rank} →`,
          primary: true,
          onClick: onWriteScriptHook
            ? () => onWriteScriptHook(topHook.hookLine, topHook.audienceArchetype)
            : undefined,
        },
      ]
    : [];

  return (
    <PlatformContext.Provider value={normalizedPlatform}>
      <HookTestContext.Provider value={onTestHook ?? null}>
        <HookWriteScriptContext.Provider value={onWriteScriptHook ?? null}>
        <ThreadShell userTurn={userTurn}>
          {error && !isStreaming && <SkillRunError onRetry={onRetry} />}

          {hasAssistantContent && (
            <ThreadAssistantTurn>
              {isFreshRun && (
                <ThreadIntro skill="hooks" audienceLabel={audienceLabel} platform={platform} />
              )}

              {/* Progress: live spine while generating; collapses to a receipt line on completion. */}
              <SkillProgress
                stages={stages}
                plan={STAGE_PLANS.hooks}
                isStreaming={isStreaming}
                summaryLabel="Ran your audience"
              />

              {/* Result: bare hook cards (no wrapper frame), revealed once the run completes so
                  every card lands fully scored in one clean beat — not half-drawn mid-stream.
                  reading-reveal = the content fades/slides in AFTER the spine, never during. */}
              {hasStreamingContent && !isStreaming && (
                <div className="reading-reveal flex flex-col gap-3">
                  <MessageBlocks body={streamingBody} />
                </div>
              )}

              {/* Degrade notices — shown once the run settles, below the result. A degrade is not
                  a failure (the cards are real), so this reads as an informational note, not the
                  W2 error block. Hidden entirely on a clean run. */}
              {!isStreaming && warnings.length > 0 && <RunWarnings warnings={warnings} />}

              {/* Outro — the engine's real follow-up (restyled) + the forward chip. */}
              {!isStreaming && (
                <ThreadOutro
                  text={followupText ?? outroFallback('hooks', topHook?.rank)}
                  chips={chips}
                />
              )}

              {hasPersistedContent && !isStreaming && (
                <div className="flex flex-col gap-3">
                  {hasStreamingContent && (
                    <p className="pt-1 text-[11px] uppercase tracking-wide text-foreground-muted/50">
                      Earlier
                    </p>
                  )}
                  <MessageBlocks body={persistedBody} />
                </div>
              )}
            </ThreadAssistantTurn>
          )}
        </ThreadShell>
        </HookWriteScriptContext.Provider>
      </HookTestContext.Provider>
    </PlatformContext.Provider>
  );
}

// ── RunWarnings ───────────────────────────────────────────────────────────────

/**
 * Run-level degrade notices from the `warning` SSE event. A degrade is NOT a failure — the cards
 * are real and were charged — so this is a quiet informational note (role="status"), never the W2
 * error block. Renders the pipeline's own warning strings verbatim (e.g. a per-persona targeting
 * mismatch, or grounding falling back to ungrounded) so the reader sees exactly what shifted.
 * Caller guarantees warnings.length > 0.
 */
interface RunWarningsProps {
  warnings: string[];
}

function RunWarnings({ warnings }: RunWarningsProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-cream-muted)' }}>
        Heads up — this run degraded
      </p>
      {warnings.map((w, i) => (
        <p key={i} className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
          {w}
        </p>
      ))}
    </div>
  );
}

// ── SkillRunError ─────────────────────────────────────────────────────────────

/**
 * Skill-run error block with tap-to-retry (W2 — UI-SPEC §Copywriting).
 * Renders ONLY when error is truthy and the stream has ended.
 * The retry button calls onRetry ONLY on explicit tap — never on render.
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
          aria-label="Retry the hooks run"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
