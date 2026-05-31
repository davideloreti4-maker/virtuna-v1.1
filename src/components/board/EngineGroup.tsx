'use client';
import { useEffect, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePerfStore } from '@/lib/perf-tier';
import { cn } from '@/lib/utils';
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

export type EngineStageStatus = 'waiting' | 'active' | 'complete';

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

/** Count fired-vs-total signals from the result's signal_availability map. */
function signalCount(sa: Record<string, unknown> | null | undefined): { on: number; total: number } | null {
  if (!sa) return null;
  const bools = Object.values(sa).filter((v) => typeof v === 'boolean') as boolean[];
  if (!bools.length) return null;
  return { on: bools.filter(Boolean).length, total: bools.length };
}

/** Title-case a raw token: "talking_head" → "Talking head". */
function pretty(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/[_-]+/g, ' ').trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const FORMAT_LABEL: Record<string, string> = {
  video_upload: 'Video',
  tiktok_url: 'TikTok',
  text: 'Post',
};

interface EngineResult {
  signal_availability?: Record<string, unknown> | null;
  niche?: string | null;
  content_type?: string | null;
  feature_vector?: { niche?: string | null; content_type?: string | null } | null;
  hook_decomposition?: { weakest_modality?: string | null } | null;
  heatmap?: { segments?: unknown[] | null } | null;
  input_mode?: string | null;
}

/** Defensive findings extraction — every row is optional, rendered only when present. */
function deriveFindings(r: EngineResult | null): { k: string; v: string; q?: string }[] {
  if (!r) return [];
  const rows: { k: string; v: string; q?: string }[] = [];

  const niche = pretty(r.niche ?? r.feature_vector?.niche ?? null);
  if (niche) rows.push({ k: 'Niche', v: niche });

  const rawFmt = r.content_type ?? r.feature_vector?.content_type ?? r.input_mode ?? null;
  const fmt = rawFmt ? (FORMAT_LABEL[rawFmt] ?? pretty(rawFmt)) : null;
  if (fmt) rows.push({ k: 'Format', v: fmt });

  const weak = pretty(r.hook_decomposition?.weakest_modality ?? null);
  if (weak) rows.push({ k: 'Hook', v: 'Strong', q: `· weak: ${weak.toLowerCase()}` });

  const beats = r.heatmap?.segments?.length ?? null;
  if (beats != null && beats > 0) rows.push({ k: 'Beats', v: String(beats) });

  const sc = signalCount(r.signal_availability);
  if (sc) rows.push({ k: 'Coverage', v: `${sc.on} of ${sc.total}` });

  return rows;
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
  // completed result means all five stages ran, so treat them all complete.
  const isHistory = stream.phase === 'complete' && stream.stages.length === 0;
  const statuses: EngineStageStatus[] = isHistory ? STAGES.map(() => 'complete') : rawStatuses;
  const isComplete = isHistory || statuses.every((s) => s === 'complete');
  const doneCount = statuses.filter((s) => s === 'complete').length;

  const result = stream.result as EngineResult | null;
  const findings = isComplete ? deriveFindings(result) : [];
  const coverage = signalCount(result?.signal_availability);

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
    if (activeIdx < 0) return;
    // Wave → preset mapping (D-09): 0,1 → engine column · 2,3 → audience · 4 → verdict
    const presetKey = activeIdx <= 1 ? 'engine' : activeIdx <= 3 ? 'audience' : 'verdict';
    if (presetKey !== currentPreset) {
      setActivePreset(presetKey as Parameters<typeof setActivePreset>[0]);
    }
  }, [activeIdx, boardState, effectiveReducedMotion, setActivePreset, currentPreset]);

  const renderState: 'running' | 'complete' | 'idle' = isComplete
    ? 'complete'
    : boardState === 'streaming'
      ? 'running'
      : 'idle';

  return (
    <EngineView
      state={renderState}
      liveLabel={liveLabel}
      activeIdx={activeIdx}
      doneCount={doneCount}
      total={STAGES.length}
      statuses={statuses}
      coverage={coverage}
      findings={findings}
    />
  );
}

export interface EngineViewProps {
  state: 'running' | 'complete' | 'idle';
  liveLabel: string;
  activeIdx: number;
  doneCount: number;
  total: number;
  statuses: EngineStageStatus[];
  coverage: { on: number; total: number } | null;
  findings: { k: string; v: string; q?: string }[];
  /** Preview/test hook — render with the findings list already open. */
  defaultFindingsOpen?: boolean;
}

/**
 * EngineView — pure presentational Engine frame in its three lives:
 * running (active stage + segmented progress), complete (one-line signal
 * coverage, expandable findings), idle (calm holding line). Data-free so it
 * can be previewed under /dev and unit-tested without the stream.
 */
export function EngineView({
  state,
  liveLabel,
  activeIdx,
  doneCount,
  total,
  statuses,
  coverage,
  findings,
  defaultFindingsOpen = false,
}: EngineViewProps) {
  const [findingsOpen, setFindingsOpen] = useState(defaultFindingsOpen);
  return (
    <div className="flex h-full flex-col" data-testid="engine-group" data-state={state}>
      <span aria-live="polite" className="sr-only">{liveLabel}</span>

      {/* ── RUNNING — active stage + segmented progress (no green-check wall) ── */}
      {state === 'running' && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-white/[0.95]">
              {(liveLabel || 'Starting').replace(/…$/, '')}
            </span>
            <span className="shrink-0 text-[12px] tabular-nums text-white/[0.38]">
              {(activeIdx >= 0 ? activeIdx + 1 : Math.max(1, doneCount))} / {total}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {statuses.map((s, i) => (
              <span
                key={i}
                className={cn(
                  'h-[3px] flex-1 rounded-full',
                  s === 'complete' && 'bg-accent/40',
                  s === 'active' && 'bg-accent',
                  s === 'waiting' && 'bg-white/[0.07]',
                )}
                style={s === 'active' ? { boxShadow: '0 0 10px -1px rgba(255,127,80,0.6)' } : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── COMPLETE — one-line summary, expands to a findings list ── */}
      {state === 'complete' && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setFindingsOpen((v) => !v)}
            aria-expanded={findingsOpen}
            className="group flex items-center justify-between gap-3 py-0.5 text-left"
          >
            <span className="text-[13px] text-white/[0.56]">
              {coverage ? (
                <><span className="tabular-nums text-white/[0.95]">{coverage.on} of {coverage.total}</span> signals</>
              ) : (
                'Analysis complete'
              )}
            </span>
            <span className="flex items-center gap-1 text-[11.5px] text-white/[0.38] group-hover:text-white/[0.56]">
              findings
              <Icon icon={findingsOpen ? CaretUp : CaretDown} size={16} />
            </span>
          </button>

          {findingsOpen && findings.length > 0 && (
            <div className="mt-3 flex flex-col">
              {findings.map((f) => (
                <div
                  key={f.k}
                  className="flex items-baseline justify-between gap-3 border-t border-white/[0.04] py-2.5 first:border-t-0"
                >
                  <span className="text-[13px] tracking-[0.05px] text-white/[0.56]">{f.k}</span>
                  <span className="text-[13.5px] font-semibold tabular-nums text-white/[0.95]">
                    {f.v}
                    {f.q && <span className="ml-1 font-normal text-white/[0.38]">{f.q}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── IDLE — calm holding line ── */}
      {state === 'idle' && (
        <div className="flex h-full items-center">
          <span className="text-[13px] text-white/[0.38]">Awaiting analysis</span>
        </div>
      )}
    </div>
  );
}
