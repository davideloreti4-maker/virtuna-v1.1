'use client';
import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePerfStore } from '@/lib/perf-tier';
import { EngineStageGlyph, type EngineStageStatus } from './EngineStageGlyph';
import type { StageEvent } from '@/lib/engine/events';

interface Stage {
  label: string;              // canonical
  plainEnglish: string;       // R2.7 label
  waveMatch: (e: StageEvent) => boolean;
}

/** Guard: true only for stage_start / stage_end events (which carry .wave). */
function hasWave(e: StageEvent): e is Extract<StageEvent, { wave: unknown }> {
  return e.type === 'stage_start' || e.type === 'stage_end';
}

const STAGES: Stage[] = [
  { label: 'Qwen-VL segmentation', plainEnglish: 'Reading the hook…',     waveMatch: (e) => hasWave(e) && e.wave === 0 },
  { label: 'Hook decomp',          plainEnglish: 'Reading the audience…', waveMatch: (e) => hasWave(e) && e.wave === 1 },
  { label: 'Retention model',      plainEnglish: 'Reading the audience…', waveMatch: (e) => hasWave(e) && e.wave === 2 },
  { label: 'Persona simulator',    plainEnglish: 'Reading the audience…', waveMatch: (e) => hasWave(e) && e.wave === 3 },
  { label: 'Aggregator',           plainEnglish: 'Synthesizing…',         waveMatch: (e) => hasWave(e) && e.wave === 'aggregator' },
];

/** Pure: derive a stage's status from the events array. */
export function deriveEngineStageStatus(stages: StageEvent[], stage: Stage): EngineStageStatus {
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

export function EngineGroup() {
  const stream = useAnalysisStream();
  const reducedMotion = usePrefersReducedMotion();
  const tier = usePerfStore((s) => s.tier);
  const effectiveReducedMotion = reducedMotion || tier === 'low';
  const transition = useBoardStore((s) => s.transition);
  const boardState = useBoardStore((s) => s.boardState);
  const currentStageLabel = useBoardStore((s) => s.currentStageLabel);
  const setActivePreset = useBoardStore((s) => s.setActivePreset);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (stream.phase === 'complete') setCollapsed(true);
  }, [stream.phase]);

  // Determine active stage's plain-English label for the aria-live region.
  const statuses = STAGES.map((s) => deriveEngineStageStatus(stream.stages, s));
  const activeIdx = statuses.findIndex((s) => s === 'active');
  const liveLabel = activeIdx >= 0 ? STAGES[activeIdx]!.plainEnglish : '';

  // Push the plain-English label into board store so command bar shows it
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
    setActivePreset(presetKey as Parameters<typeof setActivePreset>[0]);
  }, [activeIdx, boardState, effectiveReducedMotion, setActivePreset]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-white/[0.02]"
      >
        View pipeline →
      </button>
    );
  }

  return (
    <div>
      <span aria-live="polite" className="sr-only">{liveLabel}</span>
      <ol className="flex flex-col gap-1.5">
        {STAGES.map((s, i) => (
          <EngineStageGlyph
            key={s.label}
            label={s.label}
            plainEnglish={s.plainEnglish}
            status={statuses[i]!}
            reducedMotion={effectiveReducedMotion}
          />
        ))}
      </ol>
    </div>
  );
}
