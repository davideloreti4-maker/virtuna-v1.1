import { VerdictSwatch } from "@/components/numen/verdict-swatch";
import { cn } from "@/lib/utils";

/**
 * VerdictThrone — the HERO-03 verdict, the focal "throne" of the Reading.
 *
 * Renders the calibrated GOOD band (muted green) + a confident label + a
 * specific one-line WHY. Reused by the hero loop (Wave 2) and the explainer's
 * third step (Wave 3) — the contract lives here ONCE.
 *
 * VOICE.md Rule 3 (HARD): the verdict is ALWAYS a band + one-line why, NEVER a
 * naked number / score / percentage. No `/100`, no `%` — not anywhere.
 *
 * The band is built on `VerdictSwatch verdict={verdict}` (D-03) — never a
 * hand-rolled colored div, never `bg-${verdict}` interpolation (Tailwind v4
 * cannot see dynamic strings; the literal classes live in VerdictSwatch to be
 * greppable).
 *
 * PARAMETRIZED (Plan 03-03): `verdict` + `label` + `why` are optional props that
 * DEFAULT to the Phase-2 good-band copy, so existing no-props call sites (hero
 * loop, how-it-works step 3, voice gate) render byte-identical output while the
 * Plan 03-03 reading-gallery can vary the band across cards to show a verdict
 * RANGE (good / mixed / bad — honesty by breadth). The band+why+plate contract
 * lives here ONCE for every consumer.
 *
 * PLATE DECISION (Plan 02-01 APCA gate): the verdict label `#f0ebe3` on the good
 * band `#7faf7a` measures APCA Lc 41.8 < 60 → FAIL. So the label sits on a SOLID
 * `bg-panel`/`border-border` plate (not directly on the band, not glass-over-photo
 * — Lightning CSS strips backdrop-filter; UI-SPEC forbids glass-over-photo). The
 * SAME plate discipline holds for the mixed + bad bands' labels (label always on
 * the plate, never on the band — for all three verdicts). Color by token NAME
 * only — no hex in JSX.
 *
 * Presentational (no `"use client"`).
 */
export interface VerdictThroneProps {
  /** Which verdict band to surface — good / mixed / bad. Default "good" (Phase-2). */
  verdict?: "good" | "mixed" | "bad";
  /** The confident band label. Default the Phase-2 good copy "This will likely land." */
  label?: string;
  /** The specific one-line WHY. Default the Phase-2 good why (names "hook"). */
  why?: string;
  /** Layout override — merged LAST via cn() so the hero/explainer can size/position. */
  className?: string;
}

export function VerdictThrone({
  verdict = "good",
  label = "This will likely land.",
  why = "Strong hook in the first 2 seconds — tighten the middle and it lands.",
  className,
}: VerdictThroneProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-panel p-4 md:p-6",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <VerdictSwatch verdict={verdict} size="md" />
        <span className="text-sm font-bold text-text md:text-base">
          {label}
        </span>
      </span>
      <p className="mt-2 text-sm leading-relaxed text-text-muted md:text-base">
        {why}
      </p>
    </div>
  );
}
