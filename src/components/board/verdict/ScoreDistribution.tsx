import { cn } from '@/lib/utils';

/** Aggregate niche cohort stats — privacy-safe (no individual rows).
 *  histogram = 10 decile-bin counts [0-10),[10-20),…,[90-100]. */
export interface NicheCohort {
  median: number;
  p75: number;
  count: number;
  histogram: number[];
}

export interface ConfidenceRange {
  lo: number;
  hi: number;
}

interface ScoreDistributionProps {
  /** absolute 0-100 score */
  score: number;
  niche: NicheCohort | null;
  /** derived confidence interval; band always drawn, numeric text gated by caller */
  range: ConfidenceRange;
  /** show the "likely lo–hi" caption (caller suppresses for HIGH confidence) */
  showRangeText: boolean;
  className?: string;
}

// Plot geometry (px). x is expressed in %, so no DOM measurement is needed —
// SSR-safe and resolution-independent. Dots are fixed px → always round.
const PLOT_H = 84;
const BASE = 75; // baseline y from top of plot
const GAP = 6.4; // vertical stack spacing
const MAX_STACK = 7; // tallest dot column before we scale counts down

// Field mode needs a real cohort of reasonable size; below this we fall back to
// the precision lane (percentile position is still honest, the shape isn't).
const FIELD_MIN_COUNT = 20;

type Mode = 'field' | 'lane' | 'absolute';

function resolveMode(niche: NicheCohort | null): Mode {
  if (!niche) return 'absolute';
  const total = niche.histogram.reduce((a, b) => a + b, 0);
  if (niche.count >= FIELD_MIN_COUNT && total > 0) return 'field';
  return 'lane';
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function ScoreDistribution({
  score,
  niche,
  range,
  showRangeText,
  className,
}: ScoreDistributionProps) {
  const mode = resolveMode(niche);
  const x = clampPct(score);
  const lo = clampPct(range.lo);
  const hi = clampPct(range.hi);
  const bandLeft = Math.min(lo, hi);
  const bandWidth = Math.max(1.5, Math.abs(hi - lo));

  return (
    <div
      className={cn(
        'mt-[18px] rounded-[12px] border border-white/[0.06] px-4 pt-[34px]',
        className,
      )}
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0) 72%)',
      }}
      data-testid="score-distribution"
      data-mode={mode}
    >
      {mode === 'field' && niche ? (
        <FieldPlot score={x} niche={niche} bandLeft={bandLeft} bandWidth={bandWidth} />
      ) : (
        <LanePlot score={x} niche={niche} bandLeft={bandLeft} bandWidth={bandWidth} mode={mode} />
      )}

      {/* axis row */}
      <div className="relative h-[30px] text-[9.5px] text-white/40">
        <span className="absolute left-px top-[9px]">0</span>
        <span className="absolute right-px top-[9px]">100</span>
        {niche && (
          <span
            className="absolute top-[9px] -translate-x-1/2 uppercase tracking-[0.05em]"
            style={{ left: `${clampPct(niche.median)}%` }}
          >
            median
          </span>
        )}
        {showRangeText && (
          <span
            className="absolute top-[9px] -translate-x-1/2 whitespace-nowrap text-accent/70"
            style={{ left: `${clampPct((lo + hi) / 2)}%` }}
          >
            likely&nbsp;{Math.round(lo)}–{Math.round(hi)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- field: grounded dot-histogram from aggregate bin counts ---------- */

function FieldPlot({
  score,
  niche,
  bandLeft,
  bandWidth,
}: {
  score: number;
  niche: NicheCohort;
  bandLeft: number;
  bandWidth: number;
}) {
  const hist = niche.histogram;
  const maxBin = Math.max(1, ...hist);
  const dotScale = Math.max(1, Math.ceil(maxBin / MAX_STACK));

  const dots: { left: number; top: number; inBand: boolean }[] = [];
  hist.forEach((countInBin, b) => {
    if (countInBin <= 0) return;
    const n = Math.max(1, Math.round(countInBin / dotScale));
    const binCenter = b * 10 + 5;
    // bin overlaps the confidence band?
    const inBand = b * 10 < bandLeft + bandWidth && (b + 1) * 10 > bandLeft;
    for (let j = 0; j < n; j++) {
      dots.push({ left: binCenter, top: BASE - 5 - j * GAP, inBand });
    }
  });

  return (
    <div className="relative" style={{ height: PLOT_H }} data-testid="score-field">
      {/* confidence band */}
      <Band left={bandLeft} width={bandWidth} />
      {/* median + p75 reference ticks */}
      <MedianTick left={niche.median} />
      <P75Tick left={niche.p75} />
      {/* baseline + quartile ticks */}
      <Baseline />
      {/* cohort dots */}
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${d.left}%`,
            top: d.top,
            background: d.inBand ? 'rgba(255,127,80,0.34)' : 'rgba(255,255,255,0.19)',
          }}
        />
      ))}
      {/* you */}
      <YouMarker left={score} />
      {/* scale key */}
      {dotScale > 1 && (
        <span
          className="absolute right-0 top-0 text-[9px] text-white/30"
          data-testid="dot-scale-key"
        >
          each ● ≈ {dotScale}
        </span>
      )}
    </div>
  );
}

/* ---------- lane: precision percentile bar (thin cohort or no histogram) ---------- */

function LanePlot({
  score,
  niche,
  bandLeft,
  bandWidth,
  mode,
}: {
  score: number;
  niche: NicheCohort | null;
  bandLeft: number;
  bandWidth: number;
  mode: Mode;
}) {
  return (
    <div className="relative" style={{ height: PLOT_H }} data-testid="score-lane">
      {/* track centered vertically */}
      <div className="absolute left-0 right-0" style={{ top: BASE - 7 }}>
        <div
          className="relative h-[14px] rounded-full"
          style={{
            background: 'rgba(255,255,255,0.045)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 1px rgba(0,0,0,0.35)',
          }}
        >
          {/* fill to score only when we have a niche to rank against */}
          {mode === 'lane' && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${score}%`,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.22))',
              }}
            />
          )}
          {[25, 50, 75].map((q) => (
            <span
              key={q}
              className="absolute top-1/2 h-[6px] w-px -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${q}%`, background: 'rgba(255,255,255,0.10)' }}
            />
          ))}
        </div>
      </div>
      <Band left={bandLeft} width={bandWidth} />
      {niche && <MedianTick left={niche.median} />}
      {niche && <P75Tick left={niche.p75} />}
      <YouMarker left={score} label={mode === 'absolute' ? 'your score' : undefined} />
    </div>
  );
}

/* ---------- shared marker primitives ---------- */

function Band({ left, width }: { left: number; width: number }) {
  return (
    <div
      className="absolute rounded-[7px]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: 2,
        height: BASE - 2,
        background: 'rgba(255,127,80,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(255,127,80,0.22), 0 0 18px rgba(255,127,80,0.10)',
      }}
      data-testid="confidence-band"
      aria-hidden
    />
  );
}

function MedianTick({ left }: { left: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${clampPct(left)}%`,
        top: 2,
        height: BASE - 2,
        borderLeft: '1px dashed rgba(255,255,255,0.22)',
        transform: 'translateX(-0.5px)',
      }}
      aria-hidden
    />
  );
}

function P75Tick({ left }: { left: number }) {
  return (
    <div
      className="absolute"
      title="75th percentile of the niche (p75)"
      style={{
        left: `${clampPct(left)}%`,
        top: 14,
        height: BASE - 14,
        borderLeft: '1px dotted rgba(255,255,255,0.14)',
        transform: 'translateX(-0.5px)',
      }}
      aria-hidden
    />
  );
}

function Baseline() {
  return (
    <>
      <div
        className="absolute left-0 right-0"
        style={{ top: BASE, height: 1, background: 'rgba(255,255,255,0.07)' }}
        aria-hidden
      />
      {[0, 25, 50, 75, 100].map((q) => (
        <span
          key={q}
          className="absolute h-[4px] w-px -translate-x-1/2"
          style={{ left: `${q}%`, top: BASE, background: 'rgba(255,255,255,0.10)' }}
          aria-hidden
        />
      ))}
    </>
  );
}

function YouMarker({ left, label = 'you' }: { left: number; label?: string }) {
  return (
    <>
      {/* pin */}
      <div
        className="absolute"
        style={{
          left: `${left}%`,
          top: -2,
          height: BASE + 2,
          width: 1.5,
          background: 'var(--color-accent)',
          transform: 'translateX(-0.75px)',
          boxShadow: '0 0 9px rgba(255,127,80,0.5)',
        }}
        aria-hidden
      />
      {/* dot on baseline */}
      <div
        className="absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${left}%`,
          top: BASE,
          background: 'var(--color-accent)',
          border: '1.5px solid var(--color-frame, #161719)',
          boxShadow: '0 0 13px rgba(255,127,80,0.7)',
        }}
        aria-hidden
      />
      {/* chip */}
      <div
        className="absolute -translate-x-1/2 whitespace-nowrap rounded-[7px] border px-2 py-[3px] text-[10px] font-semibold text-accent"
        style={{
          left: `${left}%`,
          top: -8,
          background: '#1c1d20',
          borderColor: 'rgba(255,127,80,0.42)',
          boxShadow: '0 4px 14px -4px rgba(0,0,0,0.6)',
        }}
        data-testid="you-chip"
      >
        {label}
      </div>
    </>
  );
}
