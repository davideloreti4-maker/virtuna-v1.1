'use client';
import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { X } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/components/competitors/charts/chart-tooltip';
import { GlassPill } from '@/components/primitives';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePerfStore } from '@/lib/perf-tier';
import { cn } from '@/lib/utils';
import { COPY, TELEMETRY } from './content-analysis-constants';
import { logger } from '@/lib/logger';

interface EmotionArcPoint {
  timestamp_ms: number;
  intensity_0_1: number;
  label?: 'low' | 'mid' | 'high';
}

interface Props {
  points: ReadonlyArray<EmotionArcPoint> | null | undefined;
  className?: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const GRADIENT_ID = 'emotionArcGradient';
const CHART_HEIGHT = 140;
const EMPTY_BASELINE: EmotionArcPoint[] = [
  { timestamp_ms: 0, intensity_0_1: 0.5 },
  { timestamp_ms: 1, intensity_0_1: 0.5 },
];

export function EmotionArcNode({ points, className }: Props) {
  // Inline expander (no Sheet/popup) — the chart is always-on; tapping a peak/valley
  // dot expands the peaks & valleys list directly in-frame.
  const [detailOpen, setDetailOpen] = useState(false);
  const [ariaText, setAriaText] = useState('');
  const announcedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setContainerWidth] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();
  const tier = usePerfStore((s) => s.tier);
  const dotsInteractive = tier !== 'low'; // Per D-28: Low tier disables tap-popover

  const isEmpty = !points || points.length === 0;
  const chartData = isEmpty ? EMPTY_BASELINE : (points as EmotionArcPoint[]);

  const peakPoint = useMemo(() => {
    if (isEmpty || chartData.length === 0) return null;
    return chartData.reduce(
      (max, p) => (max === undefined || p.intensity_0_1 > max.intensity_0_1 ? p : max),
      undefined as EmotionArcPoint | undefined,
    ) ?? null;
  }, [chartData, isEmpty]);

  // Compute pixel positions for custom button overlays (W4).
  // Map timestamp_ms to x-pixel using min/max of timestamps; map intensity_0_1 to y-pixel using chart height.
  const minTs = chartData[0]?.timestamp_ms ?? 0;
  const maxTs = chartData[chartData.length - 1]?.timestamp_ms ?? 1;
  const tsRange = Math.max(1, maxTs - minTs);

  const positionFor = useCallback(
    (p: EmotionArcPoint) => {
      const xPct = ((p.timestamp_ms - minTs) / tsRange) * 100;
      // intensity 0 → bottom (100%), 1 → top (0%). Invert because CSS top grows downward.
      const yPct = (1 - p.intensity_0_1) * 100;
      return { left: `${xPct}%`, top: `${yPct}%` };
    },
    [minTs, tsRange],
  );

  // Track container width for any pixel-perfect peak positioning sanity.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Aria-live: announce peak timestamp 500ms after data ready.
  useEffect(() => {
    if (!peakPoint || announcedRef.current || isEmpty) return;
    announcedRef.current = true;
    const handle = window.setTimeout(() => {
      setAriaText(`Emotion arc peak at ${formatTime(peakPoint.timestamp_ms)}`);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [peakPoint, isEmpty]);

  const handleDotTap = useCallback(
    (point: EmotionArcPoint) => {
      if (!dotsInteractive) return; // Low tier: dots are static
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (logger as any).event?.(TELEMETRY.EMOTION_ARC_PEAK_TAPPED, { timestamp_ms: point.timestamp_ms });
      setDetailOpen(true);
    },
    [dotsInteractive],
  );

  const peaks = isEmpty ? [] : chartData.filter((p) => p.label === 'high');
  const valleys = isEmpty ? [] : chartData.filter((p) => p.label === 'low');

  // Peaks & valleys merged + chronologically ordered for the inline detail list.
  const peaksAndValleys = useMemo(
    () =>
      isEmpty
        ? []
        : chartData
            .filter((p) => p.label === 'high' || p.label === 'low')
            .slice()
            .sort((a, b) => a.timestamp_ms - b.timestamp_ms),
    [chartData, isEmpty],
  );

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)} data-testid="emotion-arc-node">
      <span className="sr-only" aria-live="polite" data-testid="emotion-arc-aria-live">
        {ariaText}
      </span>

      {/* Headline strip — role="none" prevents banner landmark violation (axe landmark-banner-is-top-level)
          since this header is nested inside role=region (GroupFrameOverlay). */}
      <header role="none" className="flex items-center justify-between">
        <span className="text-xs font-medium" data-testid="emotion-arc-title">
          {COPY.EMOTION_ARC_TITLE}
        </span>
        {peakPoint && !isEmpty && (
          <GlassPill size="sm" data-testid="emotion-arc-peak-pill">
            {COPY.EMOTION_ARC_PEAK_PREFIX} {formatTime(peakPoint.timestamp_ms)}
          </GlassPill>
        )}
      </header>

      {/* Chart body — container is positioned `relative` so button overlays can be `absolute` */}
      <div
        ref={containerRef}
        className="relative"
        style={{ height: CHART_HEIGHT }}
        data-testid="emotion-arc-chart-container"
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                {/* Top → bottom: coral (60%) → coral mid (30%) → gray (10%) */}
                <stop
                  offset="0%"
                  stopColor={isEmpty ? 'rgba(132,133,134,0.5)' : 'var(--color-accent)'}
                  stopOpacity={isEmpty ? 0.1 : 0.6}
                />
                <stop
                  offset="60%"
                  stopColor={isEmpty ? 'rgba(132,133,134,0.5)' : 'var(--color-accent)'}
                  stopOpacity={isEmpty ? 0.1 : 0.3}
                />
                <stop offset="100%" stopColor="rgba(132,133,134,0.1)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp_ms" hide />
            <YAxis domain={[0, 1]} hide />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v: unknown) => `${Math.round(Number(v) * 100)}%`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="intensity_0_1"
              stroke={isEmpty ? 'rgba(132,133,134,0.3)' : 'var(--color-accent)'}
              strokeWidth={2}
              fill={`url(#${GRADIENT_ID})`}
              isAnimationActive={!prefersReducedMotion}
              data-testid="emotion-arc-area"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* W4: Custom button overlays for peaks (6px coral) and valleys (4px gray).
            Rendered OUTSIDE the SVG (as siblings of ResponsiveContainer) so they're
            queryable + clickable in happy-dom. Position via % computed from the data.
            W4: custom button overlays replace the Recharts SVG-level dot approach. */}
        {peaks.map((p, i) => {
          const pos = positionFor(p);
          return (
            <button
              key={`peak-${p.timestamp_ms}-${i}`}
              type="button"
              data-testid="emotion-arc-peak"
              data-timestamp-ms={p.timestamp_ms}
              onClick={() => handleDotTap(p)}
              disabled={!dotsInteractive}
              aria-label={`Peak at ${formatTime(p.timestamp_ms)}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0"
              style={{
                left: pos.left,
                top: pos.top,
                width: 12,
                height: 12,
                background: 'var(--color-accent)',
                border: 'none',
                cursor: dotsInteractive ? 'pointer' : 'default',
              }}
            />
          );
        })}
        {valleys.map((p, i) => {
          const pos = positionFor(p);
          return (
            <button
              key={`valley-${p.timestamp_ms}-${i}`}
              type="button"
              data-testid="emotion-arc-valley"
              data-timestamp-ms={p.timestamp_ms}
              onClick={() => handleDotTap(p)}
              disabled={!dotsInteractive}
              aria-label={`Valley at ${formatTime(p.timestamp_ms)}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0"
              style={{
                left: pos.left,
                top: pos.top,
                width: 8,
                height: 8,
                background: 'rgba(132,133,134,0.6)',
                border: 'none',
                cursor: dotsInteractive ? 'pointer' : 'default',
              }}
            />
          );
        })}

        {isEmpty && (
          <p
            className="absolute inset-0 flex items-center justify-center text-xs italic text-foreground-muted"
            data-testid="emotion-arc-empty-caption"
          >
            {COPY.EMOTION_ARC_UNAVAILABLE}
          </p>
        )}
      </div>

      {/* Inline detail — replaces the former EmotionArcInspector Sheet.
          Lists each peak/valley with timestamp + intensity directly in-frame. */}
      {detailOpen && peaksAndValleys.length > 0 && (
        <div
          id="emotion-arc-detail"
          data-testid="emotion-arc-detail"
          className="flex flex-col gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[10px] font-normal uppercase tracking-[0.04em] text-white/45">
              Peaks &amp; valleys
            </h4>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              aria-label="Close emotion arc detail"
              className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {peaksAndValleys.map((p, i) => (
              <li
                key={`${p.timestamp_ms}-${i}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: p.label === 'high' ? 8 : 6,
                      height: p.label === 'high' ? 8 : 6,
                      background:
                        p.label === 'high' ? 'var(--color-accent)' : 'rgba(132,133,134,0.6)',
                    }}
                  />
                  <span
                    className={cn(
                      'capitalize',
                      p.label === 'high' ? 'text-accent' : 'text-foreground-muted',
                    )}
                  >
                    {p.label === 'high' ? 'Peak' : 'Valley'}
                  </span>
                  <span className="tabular-nums text-white/55">{formatTime(p.timestamp_ms)}</span>
                </span>
                <span className="tabular-nums text-white/90">
                  {Math.round(p.intensity_0_1 * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
