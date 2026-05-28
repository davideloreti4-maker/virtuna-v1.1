'use client';
import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
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
import { EmotionArcInspector } from './EmotionArcInspector';
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
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
      setInspectorOpen(true);
    },
    [dotsInteractive],
  );

  const peaks = isEmpty ? [] : chartData.filter((p) => p.label === 'high');
  const valleys = isEmpty ? [] : chartData.filter((p) => p.label === 'low');

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

      <EmotionArcInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        points={points}
      />
    </div>
  );
}
