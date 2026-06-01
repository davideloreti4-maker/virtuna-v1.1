import { cn } from '@/lib/utils';
import { Delta, type DeltaProps } from './Delta';

/**
 * StatTile — one metric tile: caps label · huge tabular value · optional delta.
 * Generalizes the prior verdict SignalTiles into the shared kit.
 */
export interface StatTileData {
  /** Uppercase caps label. */
  k: string;
  /** Big value (pre-formatted string). */
  v: string;
  /** Unit suffix, e.g. '%', '/10'. */
  u?: string;
  /** Optional change indicator (vs niche / previous). */
  delta?: DeltaProps;
  /** Sub-caption under the value. */
  s?: string;
  /** Emphasized leading token in the sub-caption. */
  em?: string;
  /** 'accent' highlights this tile (e.g. the weak link). */
  tone?: 'accent' | 'default';
}

export function StatTile({ k, v, u, delta, s, em, tone = 'default' }: StatTileData) {
  return (
    <div
      className={cn(
        'flex min-h-[72px] flex-col rounded-[12px] border px-3 py-[11px]',
        tone === 'accent'
          ? 'border-accent/25 bg-accent/[0.035]'
          : 'border-white/[0.06] bg-white/[0.016]',
      )}
      data-testid="stat-tile"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[9.5px] uppercase leading-[1.25] tracking-[0.08em] text-white/55">
          {k}
        </span>
        {delta && (
          <span className="shrink-0">
            <Delta {...delta} />
          </span>
        )}
      </div>
      <div className="mt-auto pt-2 text-[18px] font-semibold leading-none tabular-nums text-white/95">
        {v}
        {u && <span className="ml-[1px] text-[10px] font-medium text-white/40">{u}</span>}
      </div>
      {s && (
        <div className="mt-[7px] truncate text-[10px] text-white/55">
          {em && <span className="font-semibold text-white/75">{em} </span>}
          {s}
        </div>
      )}
    </div>
  );
}

/**
 * StatTileRow — responsive grid of tiles. 2-up on mobile; 3/4-up at ≥420px
 * (container query — must sit inside a width-constrained parent).
 */
export function StatTileRow({
  tiles,
  className,
}: {
  tiles: ReadonlyArray<StatTileData>;
  className?: string;
}) {
  if (!tiles.length) return null;
  const cols =
    tiles.length <= 2
      ? 'grid-cols-2'
      : tiles.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 @[420px]:grid-cols-4';
  return (
    <div className={cn('@container', className)} data-testid="stat-tile-row">
      <div className={cn('grid gap-[9px]', cols)}>
        {tiles.map((t) => (
          <StatTile key={t.k} {...t} />
        ))}
      </div>
    </div>
  );
}
