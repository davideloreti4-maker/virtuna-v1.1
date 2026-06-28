import { cn } from "@/lib/utils";

/**
 * RetentionCurveSkeleton — static-SVG shape hint of the Numen Simulation's
 * watch-through retention curve (03-04 family, the "where viewers drop" view).
 * Pure set-dressing — NO real data, NO engine hook, NO import from the retired
 * product UI. It depicts the SHAPE so the marketing feature reads as the real
 * product, screenshot pending (FOUND-03).
 *
 * This is the correct visual for the "See exactly where viewers drop" feature —
 * a decay line (100% → tail) with ONE pronounced drop and a single coral marker
 * + "0:07" label at the drop moment (coral kept precious, A6 — one accent).
 *
 * Composition:
 *  - an area+line path: watch-through % decaying left→right, with a steep drop.
 *  - a faint dashed guide + a lone coral dot at the drop x, labelled "0:07".
 *  - a "{n}% reach the end" caption beneath (contains a number, no "simulat*").
 *
 * Flat-warm tokens only: area = cream-muted low-alpha, line = cream-secondary,
 * drop marker = the lone coral accent. Pure RSC — role="img" + aria-label.
 */

// Hand-authored decay points (viewBox 0 0 200 90). Deterministic — never random.
// y maps watch-through %: 100% ≈ y8 (top), 0% ≈ y82 (baseline). The steep segment
// between x48 and x60 is the drop at the hook (0:07).
const LINE = "M0,8 L26,12 L48,17 L60,32 L92,37 L124,41 L160,45 L200,48";
const AREA = `${LINE} L200,82 L0,82 Z`;
const DROP_X = 60;
const DROP_Y = 32;
const REACH_END = 44; // sample % reaching the end, set-dressing only

export function RetentionCurveSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Watch-through retention curve (sample)"
      className={cn("flex w-full flex-col gap-3", className)}
    >
      <svg viewBox="0 0 200 90" width="100%" aria-hidden="true" className="block">
        {/* baseline track */}
        <line
          x1="0"
          y1="82"
          x2="200"
          y2="82"
          className="stroke-foreground-muted/20"
          strokeWidth="1"
        />
        {/* area fill under the curve — cream-muted, very low alpha */}
        <path d={AREA} className="fill-foreground-muted/10" />
        {/* the retention line — cream-secondary */}
        <path
          d={LINE}
          fill="none"
          className="stroke-foreground-secondary"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* faint dashed guide at the drop */}
        <line
          x1={DROP_X}
          y1={DROP_Y}
          x2={DROP_X}
          y2="82"
          className="stroke-foreground-muted/30"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        {/* the lone coral drop marker (precious accent, A6) */}
        <circle cx={DROP_X} cy={DROP_Y} r="3.5" className="fill-accent" />
      </svg>

      {/* caption — the where-they-drop hint + the watch-through tail. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground-muted">
          <span className="font-semibold text-foreground-secondary">
            {REACH_END}%
          </span>{" "}
          reach the end
        </span>
        <span className="font-mono text-xs text-foreground-muted">
          drops at 0:07
        </span>
      </div>
    </div>
  );
}
