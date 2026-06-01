'use client';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FrameHero, PersonaGraph, type HeroTone, type PersonaNode } from '../_kit';

export interface AudienceHeroProps {
  /** The 10 personas mapped into the graph node shape. */
  nodes: PersonaNode[];
  /** Weighted watch-through % (0-100, already rounded). Null while loading. */
  watchThroughPct: number | null;
  /** One-word verdict + tone, by band. */
  verdict: { word: string; tone: HeroTone };
  /** One-line takeaway (who leaves / where). May carry an inline coral time mark. */
  insight: ReactNode;
  /** Pass-through for prefers-reduced-motion (kills the float animation). */
  reducedMotion: boolean;
  /** When true, render a shimmer placeholder instead of the graph. */
  isLoading: boolean;
}

/**
 * Audience hero — an Artificial-Societies-style persona node-graph as the hero
 * visual (via FrameHero's `children` slot), with the weighted watch-through %
 * overlaid top-left as the dominant number, plus a one-word verdict and a
 * one-line insight. The retention curve now lives in the Retention tab.
 */
export function AudienceHero({
  nodes,
  watchThroughPct,
  verdict,
  insight,
  reducedMotion,
  isLoading,
}: AudienceHeroProps) {
  if (isLoading || watchThroughPct == null) {
    return (
      <FrameHero label="Audience watch-through">
        <Skeleton className="h-[220px] w-full rounded-[12px]" />
      </FrameHero>
    );
  }

  return (
    <FrameHero
      label="Audience watch-through"
      status={{ word: verdict.word, tone: verdict.tone }}
      insight={insight}
    >
      <div className="relative w-full">
        {/* weighted watch-through % overlaid top-left, clean over the cloud */}
        <div className="pointer-events-none absolute left-0 top-0 z-10">
          <div className="text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
            {watchThroughPct}
            <span className="ml-1 text-[16px] font-medium text-white/40">%</span>
          </div>
        </div>

        {nodes.length > 0 ? (
          <PersonaGraph personas={nodes} reducedMotion={reducedMotion} />
        ) : (
          <div style={{ height: 220 }} />
        )}
      </div>
    </FrameHero>
  );
}
