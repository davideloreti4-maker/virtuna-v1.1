'use client';
import { FILMSTRIP_KEYFRAME_FADE_MS } from './audience-constants';
import type { HeatmapPayload } from '@/lib/engine/types';

export interface FilmstripProps {
  segments: HeatmapPayload['segments'] | null;
  filmstrips: Record<number, string>;
  totalDurationSec: number;
  antiViralitySegmentIndices?: number[];
}

export function Filmstrip({
  segments,
  filmstrips = {},
  totalDurationSec,
  antiViralitySegmentIndices = [],
}: FilmstripProps) {
  const cells: HeatmapPayload['segments'] =
    segments ??
    (Array.from({ length: 10 }, (_, i) => ({
      idx: i,
      t_start: i * (totalDurationSec / 10),
      t_end: (i + 1) * (totalDurationSec / 10),
      label: undefined as unknown as string,
      is_hook_zone: i === 0,
      keyframe_uri: null,
    })) as HeatmapPayload['segments']);

  const totalLen = totalDurationSec > 0 ? totalDurationSec : cells.length;

  return (
    <figure
      className="relative flex h-28 w-full gap-px overflow-hidden rounded-[6px]"
      aria-label="Video keyframe filmstrip"
    >
      {cells.map((seg) => {
        const duration = seg.t_end - seg.t_start;
        const widthPct =
          totalDurationSec > 0
            ? (duration / totalLen) * 100
            : (1 / cells.length) * 100;
        const keyframe = filmstrips[seg.idx];
        const isWarn = antiViralitySegmentIndices.includes(seg.idx);

        return (
          <div
            key={seg.idx}
            role="img"
            aria-label={`Segment ${seg.idx}: ${seg.label ?? 'pending'}, ${seg.t_start.toFixed(1)}s to ${seg.t_end.toFixed(1)}s`}
            className="relative h-full"
            style={{ width: `${widthPct}%` }}
          >
            {/* Coral-band placeholder (per O-4) — subtle band, no per-cell text label */}
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(255,127,80,0.08)',
                opacity: keyframe ? 0 : 1,
                transition: `opacity ${FILMSTRIP_KEYFRAME_FADE_MS}ms linear`,
              }}
            />

            {/* Keyframe image — swaps in with cross-fade */}
            {keyframe && (
              <img
                src={keyframe}
                alt={seg.label ?? `Segment ${seg.idx}`}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: 1,
                  transition: `opacity ${FILMSTRIP_KEYFRAME_FADE_MS}ms linear`,
                }}
              />
            )}

            {/* Anti-virality ⚠ chip below cell */}
            {isWarn && (
              <div
                className="absolute inset-x-0 flex items-center justify-center text-xs"
                style={{
                  top: '100%',
                  height: 20,
                  color: 'var(--color-warning)',
                }}
                aria-label={`Warning: critical drop in segment ${seg.idx}`}
              >
                ⚠
              </div>
            )}
          </div>
        );
      })}
    </figure>
  );
}
