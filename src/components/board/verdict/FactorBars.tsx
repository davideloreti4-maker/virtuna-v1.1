import type { Factor } from '@/lib/engine/types';
import { cn } from '@/lib/utils';

interface FactorBarsProps {
  factors: ReadonlyArray<Factor>;
}

// Committed full-width factor bars. Reclaims factors[].score (0-10) — previously
// discarded after prose bucketing in assembleReasoningBuckets. Sorted strongest →
// weakest: the top factor earns a neutral "keep" tag (reinforcement), the single
// weakest renders as the coral fix bar (matches the ⚡ one-move + the "you" accent).
export function FactorBars({ factors }: FactorBarsProps) {
  if (!factors.length) return null;
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const topName = sorted[0]!.name;
  const weakName = sorted[sorted.length - 1]!.name;

  return (
    <div data-testid="factor-bars">
      {sorted.map((f) => {
        const isTop = f.name === topName && f.score >= 7;
        const isFix = f.name === weakName && sorted.length > 1 && f.score < 6;
        const pct = Math.max(0, Math.min(100, (f.score / (f.max_score || 10)) * 100));
        return (
          <div
            key={f.id || f.name}
            className="grid items-center gap-[15px] border-t border-white/[0.045] py-[8.5px] first:border-t-0
                       grid-cols-[130px_1fr_42px] sm:grid-cols-[152px_1fr_42px]"
            data-testid="factor-bar"
          >
            <div className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] font-medium text-white/95">
              {f.name}
              {isTop && (
                <span className="rounded-[3px] border border-white/[0.085] px-[4.5px] py-[1.5px] text-[8px] font-bold uppercase tracking-[0.08em] text-white/55">
                  keep
                </span>
              )}
            </div>
            <div className="h-[5px] rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isFix
                    ? 'linear-gradient(90deg, #E8703F, #FF7F50)'
                    : isTop
                      ? 'linear-gradient(90deg, rgba(255,255,255,0.30), rgba(255,255,255,0.46))'
                      : 'linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.30))',
                  boxShadow: isFix ? '0 0 10px rgba(255,127,80,0.5)' : undefined,
                }}
              />
            </div>
            <div
              className={cn(
                'text-right text-[13px] font-semibold tabular-nums',
                isFix ? 'text-accent' : 'text-white/95',
              )}
            >
              {f.score}
              <span className="text-[9.5px] font-medium text-white/40">/{f.max_score || 10}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
