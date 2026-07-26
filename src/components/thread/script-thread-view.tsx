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
import { followupsForKind } from '@/lib/tools/chat-followups';
import { SkillProgress, STAGE_PLANS } from '@/components/thread/progress-checklist';
import { OutliersOffer } from '@/components/thread/outliers-offer';
import { SkillRunError, RunWarnings } from '@/components/thread/run-notices';
import type { StageState } from '@/components/thread/progress-checklist';
import type { ScriptCardBlock } from '@/lib/tools/blocks';

export interface ScriptThreadViewProps {
  /** Validated script-card blocks from the persisted open thread (rehydration). */
  persistedBlocks: ScriptCardBlock[];
  /**
   * Base offset into the unified ambient ledger for this view's streaming cards (thread-unification
   * Phase 4) — they render after every persisted block, so their scroll-spy anchors must be based at
   * the persisted block count. Defaults to persistedBlocks.length for the legacy self-contained render.
   */
  ambientBaseIndex?: number;
  /** In-flight streamed cards (partial during stream, full after scoring). */
  streamingBlocks: ScriptCardBlock[];
  /** Pipeline stage states from SSE stage events (STUDIO-01). */
  stages: StageState[];
  /** Model-authored follow-up text from the followup SSE event. */
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
  /** Current platform selection — provided to ScriptCardRenderer via PlatformContext. */
  platform: string;
  /** "Test full →" handoff callback — called with opening beat line + script brief. */
  onTestScript?: OnTestScriptFn;
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
  /** The input hook this script was anchored on (hooks→script handoff). Cited honestly in
   *  the intro — it's an INPUT, known at submit. Absent for a direct topic send. */
  inputHookLine?: string | null;
}

export function ScriptThreadView({
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
          {error && !isStreaming && <SkillRunError onRetry={onRetry} retryLabel="Retry the script run" />}

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


              {/* Outro — the engine's real follow-up, restyled (no chips: the script card
                  carries its own "Test full →" terminal handoff). */}
              {!isStreaming && (
                <ThreadOutro text={followupText} followups={followupsForKind('script')} />
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
      </ScriptTestContext.Provider>
    </PlatformContext.Provider>
  );
}

