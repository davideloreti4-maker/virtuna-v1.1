'use client';
import { useState } from 'react';
import { CaretDown, CaretUp, Wrench } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';
import { FIXES_COPY, TELEMETRY } from './actions-constants';
import { logger } from '@/lib/logger';
import { formatTime } from '@/lib/script-utils';
import type { CounterfactualSuggestionItem, Factor } from '@/lib/engine/types';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  analysisId: string | null;
  phase: string;
  suggestions?: CounterfactualSuggestionItem[];
  factors?: Factor[];
}

const MAX_FIXES = 3;

const CHIP: Record<CounterfactualSuggestionItem['type'], { label: string; cls: string; style?: React.CSSProperties }> = {
  fix: {
    label: FIXES_COPY.TYPE_FIX,
    cls: 'text-[#FF7F50]',
    style: { backgroundColor: 'rgba(255,127,80,0.12)', border: '1px solid rgba(255,127,80,0.25)' },
  },
  stretch: {
    label: FIXES_COPY.TYPE_STRETCH,
    cls: 'text-white/70',
    style: { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' },
  },
  reinforcement: {
    label: FIXES_COPY.TYPE_REINFORCEMENT,
    cls: 'text-emerald-300/90',
    style: { backgroundColor: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.2)' },
  },
};

export function ActionsFixesSlot({ className, style, analysisId, phase, suggestions, factors }: Props) {
  // Pre-complete: reserve the slot with a placeholder (mirrors the other slots).
  if (phase !== 'complete' || !analysisId) {
    return (
      <div className={className} style={style} data-testid="actions-fixes-slot">
        <PlaceholderCard
          label={FIXES_COPY.SECTION_LABEL}
          phase="6"
          icon={Wrench}
          data-testid="actions-fixes-placeholder"
        />
      </div>
    );
  }

  const fixes = (suggestions ?? []).slice(0, MAX_FIXES);
  const hasFactors = (factors?.length ?? 0) > 0;

  // Nothing to surface (fallback runs with neither signal) → render nothing.
  if (fixes.length === 0 && !hasFactors) return null;

  return (
    <div
      className={className}
      style={style}
      data-testid="actions-fixes-slot"
    >
      <div className="flex h-full w-full flex-col gap-2 rounded-[8px] border border-white/[0.06] p-3">
        <div className="flex items-center gap-1">
          <Wrench size={12} weight="regular" aria-hidden />
          <span className="text-xs font-medium text-white/85">{FIXES_COPY.SECTION_LABEL}</span>
        </div>

        {fixes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fixes.map((s, i) => (
              <FixRow key={`fix-${i}`} item={s} />
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-white/40">{FIXES_COPY.EMPTY}</p>
        )}

        {hasFactors && <Scorecard factors={factors!} analysisId={analysisId} />}
      </div>
    </div>
  );
}

function FixRow({ item }: { item: CounterfactualSuggestionItem }) {
  const chip = CHIP[item.type] ?? CHIP.fix;
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span
          className={`rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${chip.cls}`}
          style={chip.style}
        >
          {chip.label}
        </span>
        {item.timestamp_ms > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-white/45">
            {formatTime(item.timestamp_ms)}
          </span>
        )}
        <span className="flex-1 truncate text-xs text-white/85">{item.headline}</span>
      </div>
      {item.detail && (
        <p className="pl-1 text-[10px] leading-snug text-white/50 line-clamp-2">{item.detail}</p>
      )}
    </li>
  );
}

function Scorecard({ factors, analysisId }: { factors: Factor[]; analysisId: string }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      logger.info(TELEMETRY.ACTIONS_SCORECARD_EXPANDED, {
        analysis_id: analysisId,
        factor_count: factors.length,
      });
    }
  }

  return (
    <div className="mt-1 border-t border-dashed border-white/[0.06] pt-2" data-testid="actions-scorecard">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">
          {FIXES_COPY.SCORECARD_LABEL}
        </span>
        {open ? (
          <CaretUp size={12} weight="regular" className="text-white/55" aria-hidden />
        ) : (
          <CaretDown size={12} weight="regular" className="text-white/55" aria-hidden />
        )}
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2" data-testid="actions-scorecard-list">
          {factors.map((f, i) => {
            const max = f.max_score > 0 ? f.max_score : 10;
            const pct = Math.max(0, Math.min(100, Math.round((f.score / max) * 100)));
            return (
              <li key={f.id ?? `factor-${i}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-white/85">{f.name}</span>
                  <span className="font-mono text-[10px] tabular-nums text-white/55">
                    {f.score}/{max}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: '#FF7F50' }}
                  />
                </div>
                {f.improvement_tip && (
                  <p className="text-[10px] leading-snug text-white/50">{f.improvement_tip}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
