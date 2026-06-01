'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EMPTY_FRAME_BG } from './keyframe';

/**
 * KeyframeImage — a real video keyframe. Renders the signed `<img>` when it
 * loads, else a filmic fallback gradient (graded by `energy`). Optional badges:
 * `label` (top-left tag), `timecode` (bottom-left), `badge` (bottom-right, e.g.
 * duration), and a centre `play` glyph for posters. Mirrors CraftFilmstrip's
 * cell so the whole board renders frames the same way.
 */
export interface KeyframeImageProps {
  src?: string | null;
  alt?: string;
  ratio?: 'vertical' | 'square' | 'wide';
  /** 0..1 — grades brightness/saturation of the image and the fallback tint. */
  energy?: number;
  label?: string;
  timecode?: string;
  badge?: string;
  play?: boolean;
  marked?: boolean;
  /** Preview-only: a CSS background used instead of the flat fallback when no src. */
  fallbackScene?: string;
  className?: string;
}

const RATIO = {
  vertical: 'aspect-[9/16]',
  square: 'aspect-square',
  wide: 'aspect-video',
} as const;

export function KeyframeImage({
  src,
  alt = '',
  ratio = 'vertical',
  energy = 0.7,
  label,
  timecode,
  badge,
  play,
  marked,
  fallbackScene,
  className,
}: KeyframeImageProps) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;
  const grade = `saturate(${(0.65 + energy * 0.7).toFixed(2)}) brightness(${(0.7 + energy * 0.5).toFixed(2)})`;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border bg-[#0c0b10]',
        RATIO[ratio],
        marked ? 'border-accent/60' : 'border-white/[0.07]',
        className,
      )}
      data-testid="keyframe"
    >
      {showImg ? (
        // signed, dynamic keyframe URLs — plain <img> (matches CraftFilmstrip)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: grade }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: fallbackScene ?? EMPTY_FRAME_BG }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 30%, transparent 44%, rgba(0,0,0,0.5) 100%)' }}
      />
      {play && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
            <div className="ml-[2px] h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white/90" />
          </div>
        </div>
      )}
      {label && (
        <span className="absolute left-1 top-1 rounded-[3px] bg-accent px-1 text-[8px] font-semibold uppercase tracking-wide text-[#1a0f0a]">
          {label}
        </span>
      )}
      {timecode && (
        <span className="absolute bottom-1 left-1 rounded-[3px] bg-black/55 px-1 text-[8px] tabular-nums text-white/85">
          {timecode}
        </span>
      )}
      {badge && (
        <span className="absolute bottom-1 right-1 rounded-[3px] bg-black/55 px-1 text-[8px] tabular-nums text-white/85">
          {badge}
        </span>
      )}
    </div>
  );
}
