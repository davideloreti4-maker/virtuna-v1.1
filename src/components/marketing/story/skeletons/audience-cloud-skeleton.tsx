import { cn } from "@/lib/utils";

/**
 * AudienceCloudSkeleton — static-SVG shape hint of the Numen Simulation
 * audience persona cloud (03-04 GAP-1/GAP-2, derived from the canonical
 * numen-rework reading IA: `reading/persona-cloud.tsx`). Pure set-dressing — NO
 * real data, NO engine hook, NO import from the retired product UI.
 *
 * Composition (03-RESEARCH Pitfall 4 item 3):
 *  - a dot-cloud (one dot per persona) with deterministic, hand-authored
 *    coordinates (NO Math.random — no hydration concern). >= 16 <circle> dots.
 *  - EXACTLY ONE dot tinted with the coral accent (the worst-cluster hint; coral
 *    kept precious, A6) — every other dot is cream-muted at low opacity.
 *  - a "{n}% watch-through" caption beside the cloud (contains "%").
 *
 * Pure RSC — no client directive. role="img" + aria-label exposes one accessible
 * name; the SVG internals are aria-hidden.
 */

// Hand-authored persona coordinates (viewBox 0 0 100 100). Deterministic so SSR
// and client markup match exactly — never Math.random (the hydration landmine).
// One entry flagged `worst` is the single coral-tinted cluster hint.
const DOTS: ReadonlyArray<{ cx: number; cy: number; r: number; worst?: boolean }> = [
  { cx: 14, cy: 22, r: 3.5 },
  { cx: 28, cy: 14, r: 4 },
  { cx: 42, cy: 24, r: 3 },
  { cx: 56, cy: 16, r: 3.5 },
  { cx: 70, cy: 26, r: 4 },
  { cx: 84, cy: 18, r: 3 },
  { cx: 20, cy: 40, r: 4 },
  { cx: 36, cy: 46, r: 3.5 },
  { cx: 50, cy: 38, r: 4.5 },
  { cx: 64, cy: 48, r: 3 },
  { cx: 78, cy: 40, r: 3.5 },
  { cx: 90, cy: 50, r: 3, worst: true },
  { cx: 16, cy: 62, r: 3.5 },
  { cx: 32, cy: 70, r: 4 },
  { cx: 48, cy: 64, r: 3 },
  { cx: 62, cy: 72, r: 3.5 },
  { cx: 76, cy: 66, r: 4 },
  { cx: 88, cy: 74, r: 3 },
];

const WATCH_THROUGH = 68; // sample watch-through %, set-dressing only

export function AudienceCloudSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Audience reaction (sample)"
      className={cn("flex flex-col gap-3", className)}
    >
      <svg
        viewBox="0 0 100 90"
        width="100%"
        aria-hidden="true"
        className="block"
      >
        {DOTS.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            className={
              d.worst
                ? "fill-accent"
                : "fill-foreground-muted/35"
            }
          />
        ))}
      </svg>
      {/* watch-through caption beside the cloud — contains "%" */}
      <p className="text-sm text-foreground-muted">
        <span className="font-semibold text-foreground-secondary">
          {WATCH_THROUGH}%
        </span>{" "}
        watch-through
      </p>
    </div>
  );
}
