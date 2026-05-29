'use client';
import { useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePerfStore } from '@/lib/perf-tier';
import { cn } from '@/lib/utils';
import { EngineStageGlyph, formatStageDuration, type EngineStageStatus } from './EngineStageGlyph';
import type { StageEvent } from '@/lib/engine/events';

interface Stage {
  label: string;              // canonical
  plainEnglish: string;       // present-tense, streaming (R2.7 label)
  done: string;               // past-tense, history/complete
  waveMatch: (e: StageEvent) => boolean;
}

/** Guard: true only for stage_start / stage_end events (which carry .wave). */
function hasWave(e: StageEvent): e is Extract<StageEvent, { wave: unknown }> {
  return e.type === 'stage_start' || e.type === 'stage_end';
}

const STAGES: Stage[] = [
  { label: 'Qwen-VL segmentation', plainEnglish: 'Reading the hook…',    done: 'Segmented the video into beats', waveMatch: (e) => hasWave(e) && e.wave === 0 },
  { label: 'Hook decomp',          plainEnglish: 'Decomposing the hook…', done: 'Scored the first 3 seconds',     waveMatch: (e) => hasWave(e) && e.wave === 1 },
  { label: 'Retention model',      plainEnglish: 'Modeling retention…',   done: 'Modeled the watch-time curve',   waveMatch: (e) => hasWave(e) && e.wave === 2 },
  { label: 'Persona simulator',    plainEnglish: 'Simulating personas…',  done: 'Simulated 10 viewer personas',   waveMatch: (e) => hasWave(e) && e.wave === 3 },
  { label: 'Aggregator',           plainEnglish: 'Synthesizing…',         done: 'Synthesized the verdict',        waveMatch: (e) => hasWave(e) && e.wave === 'aggregator' },
];

/** Pure: derive a stage's status from the events array. */
export function deriveEngineStageStatus(
  stages: StageEvent[],
  stage: { waveMatch: (e: StageEvent) => boolean },
): EngineStageStatus {
  let ended = false;
  let started = false;
  for (const e of stages) {
    if (!stage.waveMatch(e)) continue;
    if (e.type === 'stage_start') started = true;
    if (e.type === 'stage_end') ended = true;
  }
  if (ended) return 'complete';
  if (started) return 'active';
  return 'waiting';
}

/** Per-stage duration from the latest matching stage_end event (live runs only). */
function durationForStage(stages: StageEvent[], stage: Stage): number | null {
  for (let i = stages.length - 1; i >= 0; i--) {
    const e = stages[i]!;
    if (stage.waveMatch(e) && e.type === 'stage_end') return e.duration_ms;
  }
  return null;
}

export function EngineGroup() {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const reducedMotion = usePrefersReducedMotion();
  const tier = usePerfStore((s) => s.tier);
  const effectiveReducedMotion = reducedMotion || tier === 'low';
  const transition = useBoardStore((s) => s.transition);
  const boardState = useBoardStore((s) => s.boardState);
  const currentStageLabel = useBoardStore((s) => s.currentStageLabel);
  const setActivePreset = useBoardStore((s) => s.setActivePreset);
  const currentPreset = useBoardStore((s) => s.activePreset);

  // Raw per-stage status from live events.
  const rawStatuses = STAGES.map((s) => deriveEngineStageStatus(stream.stages, s));
  const activeIdx = rawStatuses.findIndex((s) => s === 'active');
  const liveLabel = activeIdx >= 0 ? STAGES[activeIdx]!.plainEnglish : '';

  // History/permalink hydrates `result` but NOT the SSE `stages` array — a
  // completed result means all five stages ran, so render them all complete.
  const isHistory = stream.phase === 'complete' && stream.stages.length === 0;
  const statuses: EngineStageStatus[] = isHistory ? STAGES.map(() => 'complete') : rawStatuses;
  const isComplete = isHistory || statuses.every((s) => s === 'complete');

  // Total pipeline latency is persisted on the result row (per-stage timing is not).
  const result = stream.result as { latency_ms?: number } | null;
  const totalMs = isComplete && result?.latency_ms ? result.latency_ms : null;

  // Push the plain-English label into board store so the command bar shows it
  // (UI-SPEC: streaming placeholder = currentStageLabel).
  useEffect(() => {
    if (boardState === 'streaming' && liveLabel && liveLabel !== currentStageLabel) {
      transition({ type: 'STAGE_UPDATE', stage: liveLabel });
    }
  }, [liveLabel, boardState, currentStageLabel, transition]);

  // Camera auto-pan on wave boundary (plan 2.9 contract):
  //  - skip under reduced-motion / tier=low
  //  - skip if user interacted in last 3s (Pitfall 3)
  useEffect(() => {
    if (effectiveReducedMotion) return;
    if (boardState !== 'streaming') return;
    const last = useBoardStore.getState().lastUserInteractionAt;
    if (Date.now() - last < 3000) return;
    // One glide per active stage change (de-duplicated by activeIdx)
    if (activeIdx < 0) return;
    // Wave → preset mapping (D-09):
    //  activeIdx 0,1 → engine (Input + Engine column)
    //  activeIdx 2,3 → audience
    //  activeIdx 4 (aggregator) → verdict (hero pair)
    const presetKey =
      activeIdx <= 1 ? 'engine' :
      activeIdx <= 3 ? 'audience' :
      'verdict';
    // WR-03: skip if preset hasn't changed to avoid cancelling in-progress glides
    if (presetKey !== currentPreset) {
      setActivePreset(presetKey as Parameters<typeof setActivePreset>[0]);
    }
  }, [activeIdx, boardState, effectiveReducedMotion, setActivePreset, currentPreset]);

  return (
    <div className="flex h-full flex-col gap-3">
      <span aria-live="polite" className="sr-only">{liveLabel}</span>

      {/* Status header — fills the top of the (now taller) frame and states what ran.
          role="none" prevents an axe banner-landmark violation (the implicit
          <header> banner is nested inside the role=region GroupFrameOverlay). */}
      <header role="none" className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              isComplete ? 'bg-success' : 'bg-accent',
              !isComplete && !effectiveReducedMotion && 'animate-pulse',
            )}
          />
          <span className="text-xs font-medium text-white/85">
            {isComplete ? 'Pipeline complete' : (liveLabel || 'Waiting…')}
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-foreground-muted">
          Qwen · {STAGES.length} stages{totalMs != null ? ` · ${formatStageDuration(totalMs)}` : ''}
        </span>
      </header>

      {/* Vertical pipeline stepper — one row per stage, fills the frame body. */}
      <ol className="flex flex-1 flex-col" aria-label="Engine pipeline stages">
        {STAGES.map((s, i) => (
          <EngineStageGlyph
            key={s.label}
            label={s.label}
            subtitle={statuses[i] === 'complete' ? s.done : s.plainEnglish}
            status={statuses[i]!}
            durationMs={durationForStage(stream.stages, s)}
            isLast={i === STAGES.length - 1}
            reducedMotion={effectiveReducedMotion}
          />
        ))}
      </ol>
    </div>
  );
}
