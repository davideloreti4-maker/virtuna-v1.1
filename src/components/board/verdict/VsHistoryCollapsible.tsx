'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CaretDown } from '@phosphor-icons/react';
import { ChartTooltip } from '@/components/competitors/charts/chart-tooltip';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useComparisons } from './use-comparisons';
import { COPY, TELEMETRY } from './verdict-constants';
import { useBoardStore } from '@/stores/board-store';
import { logger } from '@/lib/logger';

interface VsHistoryCollapsibleProps {
  analysisId: string;
  currentScore: number;
}

const STORAGE_KEY = 'virtuna:vs-history-open';

function readPersistedOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function VsHistoryCollapsible({ analysisId, currentScore }: VsHistoryCollapsibleProps) {
  const { data, isLoading, isError } = useComparisons(analysisId);
  const prefersReducedMotion = usePrefersReducedMotion();
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);
  // ROADMAP SC: expand state survives navigation.
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    setIsOpen(readPersistedOpen());
  }, []);

  const handleToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      const open = event.currentTarget.open;
      setIsOpen(open);
      try {
        window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
      } catch {
        /* localStorage unavailable — keep in-memory state */
      }
      if (open) {
        logger.info?.(TELEMETRY.VERDICT_HISTORY_EXPANDED, { score: currentScore });
      }
    },
    [currentScore],
  );

  return (
    <details
      open={isOpen}
      onToggle={handleToggle}
      className="group rounded-[8px] border border-white/[0.06] bg-white/[0.02] open:bg-white/[0.04]"
      data-testid="vs-history-collapsible"
    >
      <summary className="flex cursor-pointer items-center justify-between p-2 text-sm font-medium list-none min-h-10">
        <span>{COPY.HISTORY_SUMMARY}</span>
        <CaretDown size={12} className="opacity-60 motion-safe:transition-transform group-open:rotate-180" />
      </summary>

      <div className="p-3 pt-0 text-xs">
        {isLoading && (
          <p className="text-xs italic text-foreground-muted" data-testid="vs-history-loading">
            {COPY.HISTORY_LOADING}
          </p>
        )}
        {isError && (
          <p className="text-xs italic text-foreground-muted" data-testid="vs-history-error">
            Could not load comparison data.
          </p>
        )}
        {data && data.history.length < 3 && (
          <div data-testid="vs-history-empty">
            <p className="text-xs italic text-foreground-muted">
              {COPY.HISTORY_EMPTY_STATE(data.history.length)}
            </p>
            <button
              type="button"
              onClick={openInputDrawer}
              className="mt-1 text-xs text-foreground-secondary hover:text-foreground"
              data-testid="vs-history-run-another"
            >
              → Run another analysis
            </button>
          </div>
        )}
        {data && data.history.length >= 3 && (
          <div className="flex flex-col gap-3">
            {/* Chart 1: vs last 10 analyses */}
            <section data-testid="vs-history-last-10">
              <h4 className="text-[10px] font-normal uppercase tracking-[0.04em] text-white/50 mb-1">
                {COPY.HISTORY_LAST_10_TITLE}
              </h4>
              <ResponsiveContainer width="100%" height={88}>
                <BarChart
                  layout="vertical"
                  data={[
                    { label: COPY.HISTORY_LABEL_NOW, value: currentScore, isCurrent: true },
                    ...data.history.map((v, i) => ({
                      label: `−${i + 1}`,
                      value: v,
                      isCurrent: false,
                    })),
                  ]}
                  margin={{ top: 4, right: 12, left: 24, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    stroke="var(--color-foreground-muted)"
                    width={24}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v: unknown) => `${Number(v).toFixed(0)}`} />} />
                  <Bar
                    dataKey="value"
                    isAnimationActive={!prefersReducedMotion}
                    radius={[0, 4, 4, 0]}
                  >
                    {[currentScore, ...data.history].map((_v, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? 'var(--color-cream-secondary)' : 'rgba(255,255,255,0.30)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
            {/* Niche comparison now lives in the verdict hero (ScoreDistribution) —
                this collapsible is the personal-history view only. */}
          </div>
        )}
      </div>
    </details>
  );
}
