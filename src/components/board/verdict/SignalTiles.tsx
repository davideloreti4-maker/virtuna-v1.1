export interface SignalTile {
  /** uppercase caps label */
  k: string;
  /** big value */
  v: string;
  /** unit suffix (e.g. "/10", "%", "/100") */
  u?: string;
  /** sub caption (plain text; emphasis applied to the leading token if `em` set) */
  s?: string;
  em?: string;
}

interface SignalTilesProps {
  tiles: ReadonlyArray<SignalTile>;
}

// Surfaces engine signals that were previously unused in the Score frame
// (weighted hook, completion, matched sound velocity, platform fit). Caller
// builds only the tiles whose data is present — renders 2-up on mobile, 4-up on
// desktop via the parent container's width.
export function SignalTiles({ tiles }: SignalTilesProps) {
  if (!tiles.length) return null;
  return (
    <div className="@container" data-testid="signal-tiles">
      <div className="grid grid-cols-2 gap-[9px] @[420px]:grid-cols-4">
        {tiles.map((t) => (
        <div
          key={t.k}
          className="flex min-h-[78px] flex-col rounded-[11px] border border-white/[0.06] bg-white/[0.016] px-3 py-[11px]"
          data-testid="signal-tile"
        >
          <div className="whitespace-nowrap text-[9.5px] uppercase tracking-[0.08em] text-white/55">
            {t.k}
          </div>
          <div className="mt-auto text-[18px] font-semibold leading-none tabular-nums text-white/95">
            {t.v}
            {t.u && <span className="text-[10px] font-medium text-white/40">{t.u}</span>}
          </div>
          {t.s && (
            <div className="mt-[7px] whitespace-nowrap text-[10px] text-white/55">
              {t.em && <span className="font-semibold text-white/75">{t.em} </span>}
              {t.s}
            </div>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}
