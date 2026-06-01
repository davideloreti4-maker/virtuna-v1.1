'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTileRow, type StatTileData } from '../_kit';
import type { CraftPillar, CraftPillarKey } from './content-analysis-types';
import { PILLAR_ORDER, PILLAR_LABELS } from './content-analysis-constants';

interface Props {
  pillars: CraftPillar[];
  weakKey: CraftPillarKey | null;
  isLoading: boolean;
}

/** Pillar → shared StatTile: caps label · numeral (+ /10) · one-line diagnosis.
 *  The weak link gets the accent tone — the single scalpel of coral. */
function pillarToTile(p: CraftPillar, weakKey: CraftPillarKey | null): StatTileData {
  return {
    k: p.label,
    v: p.value,
    u: p.showDenominator ? '/10' : undefined,
    s: p.caption,
    tone: p.key === weakKey ? 'accent' : 'default',
  };
}

/**
 * The reading rail: the quantitative legend for the filmstrip, now rendered in
 * the shared design language as a StatTileRow. Four craft pillars
 * (Hook · Pacing · Audio · CTA), each a tile — caps label, numeral, diagnosis.
 * The weak link reads in coral (accent tone) — the single scalpel of color.
 */
export function CraftRail({ pillars, weakKey, isLoading }: Props) {
  if (isLoading) {
    return (
      <div
        className="@container mt-[18px]"
        data-testid="craft-rail-loading"
      >
        <div className="grid grid-cols-2 gap-[9px] @[420px]:grid-cols-4">
          {PILLAR_ORDER.map((key) => (
            <div
              key={key}
              className="flex min-h-[72px] flex-col rounded-[11px] border border-white/[0.06] bg-white/[0.016] px-3 py-[11px]"
            >
              <div className="text-[9.5px] uppercase tracking-[0.08em] text-white/55">
                {PILLAR_LABELS[key]}
              </div>
              <Skeleton className="mt-auto h-[18px] w-[40px] rounded-[4px]" />
              <Skeleton className="mt-[7px] h-[10px] w-[84px] rounded-[3px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tiles = pillars.map((p) => pillarToTile(p, weakKey));
  return <StatTileRow tiles={tiles} className="mt-[18px]" />;
}
