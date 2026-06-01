'use client';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { GeminiAudioSignals } from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import type { CraftCell } from './content-analysis-types';
import { COPY } from './content-analysis-constants';
import { energyGradeFilter, buildWaveBars, formatTimeSec } from './content-analysis-derive';

// Flat neutral cell surface shown when a keyframe is missing/failed. Deliberately
// NOT the old warm `fallbackCellGradient` — a neutral placeholder keeps the strip's
// shape without impersonating footage that didn't load.
const EMPTY_CELL_BG = 'rgba(255,255,255,0.016)';

// Film grain — a single fractal-noise tile, blended over the whole strip so the
// cut keyframes read as one graded video rather than flat color swatches.
const GRAIN_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.55'/></svg>\")";

interface Props {
  cells: CraftCell[];
  durationSec: number;
  arc: EmotionArcPoint[];
  audio: GeminiAudioSignals | null;
  /** Audio mix caption from the Audio pillar (e.g. "Voiceover-led"). */
  audioCaption: string;
  ctaPresent: boolean;
  isLoading: boolean;
}

/** One energy-graded keyframe cell. Hides its <img> on load error → fallback gradient shows. */
function Cell({ cell }: { cell: CraftCell }) {
  const [failed, setFailed] = useState(false);
  const showImg = cell.url != null && !failed;
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ flex: `1 1 ${cell.widthPct}%`, background: EMPTY_CELL_BG }}
      data-testid="craft-cell"
      data-hook={cell.isHook ? 'true' : 'false'}
    >
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cell.url as string}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: energyGradeFilter(cell.intensity) }}
        />
      )}
      {/* per-cell vignette + seam highlight → reads as filmed, not flat */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          boxShadow:
            'inset 0 0 26px rgba(0,0,0,.5), inset -1px 0 0 rgba(0,0,0,.3), inset 1px 0 0 rgba(255,255,255,.02)',
        }}
      />
      {/* hook zone: quiet brighter top edge — the strong open */}
      {cell.isHook && (
        <div
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            boxShadow: 'inset 0 2px 0 0 rgba(255,255,255,.34)',
            background: 'linear-gradient(180deg, rgba(255,255,255,.07), transparent 26%)',
          }}
        />
      )}
    </div>
  );
}

export function CraftFilmstrip({ cells, durationSec, arc, audio, audioCaption, ctaPresent, isLoading }: Props) {
  const waveBars = useMemo(() => buildWaveBars(arc, durationSec), [arc, durationSec]);
  const hasArc = arc.length > 0;
  // Only apply the footage-grading passes (warm soft-light grade + film grain)
  // when at least one cell resolved a real keyframe. Over neutral placeholders
  // they'd re-introduce the "this is filmed video" impression we just removed.
  const hasFrames = cells.some((c) => c.url != null);

  if (isLoading) {
    return (
      <div className="mt-[18px] flex flex-col gap-[10px]" data-testid="craft-filmstrip-loading">
        <Skeleton className="h-[118px] w-full rounded-[9px]" />
        <Skeleton className="h-[26px] w-full rounded-[4px]" />
      </div>
    );
  }

  return (
    <div className="mt-[18px]" data-testid="craft-filmstrip">
      {/* marker lane */}
      <div className="relative mb-2 h-[18px]">
        {cells.some((c) => c.isHook) && (
          <div
            className="absolute bottom-0 left-0 text-[10px] font-medium uppercase tracking-[0.13em] text-white/40"
            data-testid="craft-mark-hook"
          >
            {COPY.HOOK_MARK}
            <span className="mt-1 block h-[6px] w-px bg-current opacity-50" />
          </div>
        )}
        <div
          className="absolute bottom-0 right-0 text-right text-[10px] font-medium uppercase tracking-[0.13em]"
          style={{ color: ctaPresent ? 'rgba(255,255,255,0.4)' : 'var(--color-accent)' }}
          data-testid="craft-mark-close"
        >
          {ctaPresent ? COPY.CLOSE_MARK : COPY.NO_CLOSE_MARK}
          <span className="ml-auto mt-1 block h-[6px] w-px bg-current opacity-50" />
        </div>
      </div>

      {/* the graded keyframe strip */}
      <div
        className="relative flex h-[118px] gap-[1.5px] overflow-hidden rounded-[9px]"
        style={{
          border: '1px solid rgba(255,255,255,.07)',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,.05), 0 1px 2px rgba(0,0,0,.4)',
        }}
        data-testid="craft-strip"
      >
        {cells.map((cell) => (
          <Cell key={cell.idx} cell={cell} />
        ))}

        {hasFrames && (
          <>
            {/* one grade pass unifies the cuts into a single graded video */}
            <div
              className="pointer-events-none absolute inset-0 z-[3]"
              style={{
                background:
                  'linear-gradient(160deg, rgba(255,150,90,.10), rgba(20,24,40,.18) 70%)',
                mixBlendMode: 'soft-light',
              }}
            />
            {/* film grain across the whole strip */}
            <div
              className="pointer-events-none absolute inset-0 z-[4] opacity-[0.45]"
              style={{ backgroundImage: GRAIN_URI, mixBlendMode: 'overlay' }}
            />
          </>
        )}
        {/* coral end-cap: the abrupt close. one scalpel of color, only when no CTA. */}
        {!ctaPresent && (
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-[5] w-[30%]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,127,80,.14))' }}
            data-testid="craft-endcap"
          >
            <div
              className="absolute bottom-0 right-0 top-0 w-[2px]"
              style={{ background: 'var(--color-accent)', boxShadow: '0 0 10px rgba(255,127,80,.55)' }}
            />
          </div>
        )}
      </div>

      {/* audio activity band + caption */}
      <div className="mt-[10px] flex items-center gap-3.5" data-testid="craft-audio">
        <div className="flex h-[26px] flex-1 items-center gap-px">
          {audio
            ? waveBars.map((amp, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    height: `${Math.max(2, amp * 100)}%`,
                    background: 'rgba(244,244,245,.26)',
                    opacity: 0.5 + (hasArc ? amp * 0.5 : 0),
                  }}
                />
              ))
            : <div className="h-px w-full" style={{ background: 'rgba(244,244,245,.16)' }} />}
        </div>
        <span className="whitespace-nowrap text-[11px] tabular-nums text-white/40">
          {audio
            ? `${audioCaption} · ${Math.round(audio.silence_ratio * 100)}% silence`
            : COPY.AUDIO_NONE_CAPTION}
        </span>
      </div>

      {/* time axis */}
      <div className="mt-[9px] flex justify-between text-[10.5px] tabular-nums text-white/[0.22]">
        <span>0:00</span>
        <span>{formatTimeSec(durationSec)}</span>
      </div>
    </div>
  );
}
