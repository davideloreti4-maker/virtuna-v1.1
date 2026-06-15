import { cn } from "@/lib/utils";

/**
 * DriverRowsSkeleton — static shape hint of the Numen Simulation's three driver
 * rows (03-04 GAP-1, derived from the canonical numen-rework reading IA:
 * `reading/driver-rows.tsx`). Pure set-dressing — NO real data, NO engine hook,
 * NO import from the retired product UI.
 *
 * Composition (03-RESEARCH Pitfall 4 item 4):
 *  - exactly three rows in FIXED order: Hook · Retention · Shareability.
 *  - each row = a label + a neutral horizontal bar (a div with a flat-warm fill
 *    width %). Bars are neutral (cream-muted track + cream-secondary fill); the
 *    single weakest bar (Retention) MAY use the coral accent — kept to one (A6).
 *  - the Retention row carries a "drops at 0:07" caption (matches /\d:\d{2}/),
 *    the where-they-drop hint. No invented metrics, no number above 100.
 *
 * Pure RSC — no client directive. role="img" + aria-label exposes one accessible
 * name for the decorative group.
 */

interface DriverRow {
  /** Driver label (fixed order). */
  label: string;
  /** Bar fill width, 0-100 (set-dressing only — never a real metric). */
  fill: number;
  /** The single weakest row gets the lone coral hint. */
  weakest?: boolean;
  /** Optional where-they-drop caption (Retention only). */
  caption?: string;
}

// Fixed order — Hook · Retention · Shareability. Retention is the weakest row
// (the lone coral hint) and carries the drop timestamp.
const DRIVERS: readonly DriverRow[] = [
  { label: "Hook", fill: 82 },
  { label: "Retention", fill: 54, weakest: true, caption: "drops at 0:07" },
  { label: "Shareability", fill: 71 },
] as const;

export function DriverRowsSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Hook, Retention and Shareability (sample)"
      className={cn("flex flex-col gap-4", className)}
    >
      {DRIVERS.map((d) => (
        <div key={d.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground-secondary">
              {d.label}
            </span>
            {d.caption && (
              <span className="font-mono text-xs text-foreground-muted">
                {d.caption}
              </span>
            )}
          </div>
          {/* neutral bar — cream-muted track, fill is cream-secondary except the
              lone weakest row which earns the precious coral hint. */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground-muted/15">
            <div
              data-bar
              className={cn(
                "h-full rounded-full",
                d.weakest ? "bg-accent" : "bg-foreground-secondary"
              )}
              style={{ width: `${d.fill}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
