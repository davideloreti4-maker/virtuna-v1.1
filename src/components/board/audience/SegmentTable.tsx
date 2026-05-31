'use client';
import { Skeleton } from '@/components/ui/skeleton';
import type { SegmentGroup, SlotKey } from './audience-derive';

export interface SegmentTableProps {
  groups: SegmentGroup[];
  /** Key of the single group rendered with coral "bad" treatment (or null). */
  badKey: SlotKey | null;
  isLoading: boolean;
}

/**
 * BLOCK C — "Who leaves / Watch-through" shaped rows.
 *
 * 4 slot groups (rows with 0 personas are hidden). Inline bar width = group %.
 * At most ONE row is coral (the worst group below ~40%). Matches
 * audience-sketch-v7 `.seg` / `.seg-head` / `.row`.
 *
 * Grid: [label] [bar] [value]. On very narrow widths the desc line wraps under
 * the label naturally (label column is the first grid cell, not fixed-width on
 * mobile — see the responsive grid template below).
 */
export function SegmentTable({ groups, badKey, isLoading }: SegmentTableProps) {
  const visible = groups.filter((g) => g.count > 0);

  return (
    <div className="mt-[26px]">
      {/* header */}
      <div
        className="flex justify-between border-b border-white/[0.06] pb-[10px]"
        style={{ fontSize: 11, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.34)', fontWeight: 500 }}
      >
        <span>Who leaves</span>
        <span>Watch-through</span>
      </div>

      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-[14px] border-b border-white/[0.06] py-[13px] last:border-b-0"
              style={{ gridTemplateColumns: 'minmax(96px,128px) 1fr 44px' }}
            >
              <Skeleton className="h-[13px] w-[80px] rounded-[4px]" />
              <Skeleton className="h-[3px] w-full rounded-[2px]" />
              <Skeleton className="h-[13px] w-[32px] justify-self-end rounded-[4px]" />
            </div>
          ))
        : visible.map((g) => {
            const bad = g.key === badKey;
            const pct = Math.round(g.pct);
            return (
              <div
                key={g.key}
                className="grid items-center gap-[14px] border-b border-white/[0.06] py-[13px] last:border-b-0"
                style={{ gridTemplateColumns: 'minmax(96px,128px) 1fr 44px' }}
              >
                <div className="min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 13, color: 'rgba(255,255,255,0.94)', fontWeight: 500 }}
                  >
                    {g.label}
                  </div>
                  <div
                    className="truncate"
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.34)', marginTop: 2, fontWeight: 400 }}
                  >
                    {g.desc}
                  </div>
                </div>
                <div
                  className="overflow-hidden rounded-[2px]"
                  style={{ height: 3, background: 'rgba(255,255,255,0.07)' }}
                >
                  <i
                    className="block h-full rounded-[2px]"
                    style={{
                      width: `${Math.min(100, Math.max(0, pct))}%`,
                      background: bad ? '#FF7F50' : 'rgba(255,255,255,0.45)',
                    }}
                  />
                </div>
                <div
                  className="text-right tabular-nums"
                  style={{ fontSize: 13, color: bad ? '#FF7F50' : 'rgba(255,255,255,0.55)', fontWeight: 500 }}
                >
                  {pct}%
                </div>
              </div>
            );
          })}
    </div>
  );
}
