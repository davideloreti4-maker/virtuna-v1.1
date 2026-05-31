'use client';
import { Skeleton } from '@/components/ui/skeleton';
import type { InsightParts } from './audience-derive';

export interface AudienceHeroProps {
  /** Watch-through % (0-100, already rounded to int). Null while loading. */
  watchThroughPct: number | null;
  /** Status word — "Holds strong" / "Holds well" / "Leaky" / "Drops fast". */
  status: string;
  /** Sub line, e.g. "watch-through · top 15% of your niche". */
  sub: string;
  /** Insight sentence parts (lead / coral time / tail / addendum). */
  insight: InsightParts;
  /** When true, render shimmer placeholders instead of values. */
  isLoading: boolean;
}

/**
 * BLOCK A — hero number + status word + sub + insight sentence.
 *
 * 3 text levels only (0.94 / 0.55 / 0.34). Coral appears on at most the insight
 * time mark. Matches audience-sketch-v7 `.hero` / `.sub` / `.insight`.
 */
export function AudienceHero({ watchThroughPct, status, sub, insight, isLoading }: AudienceHeroProps) {
  return (
    <div className="flex flex-col">
      {/* hero: number + status, baseline-aligned */}
      <div className="flex items-baseline justify-between">
        {isLoading || watchThroughPct == null ? (
          <Skeleton className="h-[40px] w-[88px] rounded-[8px]" />
        ) : (
          <div
            className="leading-none tabular-nums"
            style={{
              fontSize: 40,
              fontWeight: 680,
              letterSpacing: '-1.8px',
              color: 'rgba(255,255,255,0.94)',
            }}
          >
            {watchThroughPct}
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                marginLeft: 1,
                letterSpacing: '-0.2px',
              }}
            >
              %
            </span>
          </div>
        )}
        {!isLoading && (
          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
            {status}
          </div>
        )}
      </div>

      {/* sub line */}
      {isLoading ? (
        <Skeleton className="mt-[9px] h-[13px] w-[180px] rounded-[4px]" />
      ) : (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.34)', marginTop: 9 }}>{sub}</div>
      )}

      {/* insight sentence */}
      {isLoading ? (
        <Skeleton className="mt-[14px] h-[15px] w-[90%] rounded-[4px]" />
      ) : (
        <p
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.94)',
            lineHeight: 1.46,
            marginTop: 14,
            fontWeight: 450,
            maxWidth: '90%',
          }}
        >
          {insight.lead}
          {insight.time != null && (
            <b style={{ color: '#FF7F50', fontWeight: 600 }}>{insight.time}</b>
          )}
          {insight.tail}
          {insight.addendum}
        </p>
      )}
    </div>
  );
}
