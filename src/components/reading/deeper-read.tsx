'use client';

import type { ApolloDimension } from '@/lib/engine/types';
import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

// DeeperRead — the light inline-expand of the remaining 3 Apollo dimensions
// (READ-08, D-10/D-13). The hero gauge + DriverRows own the headline funnel
// (hook / retention / share_pull); this surfaces the secondary trio —
// clarity / substance / credibility — behind a collapsed "Deeper read" affordance.
//
// Two-tier disclosure (D-10): this is the LIGHT half — an inline Radix Accordion that
// expands IN THE THREAD, never a drawer/modal (the heavy half is the drill panel, owned
// by DriverRows). The vendored ui/accordion.tsx handles a11y (roles, keyboard) + reduced-motion.
//
// D-13 (correctness): when apollo_reasoning is null the engine emits no dimensions, so
// none of the three are present → the component renders NOTHING (returns null). It never
// fabricates a dim. Partial Apollo (only some of the three) → render only what's present,
// omitting the missing silently. The hero/rows still resolve from overall_score elsewhere.
//
// READ-10 / threat T-02-08: only whitelisted fields (name / score / band) are rendered.

const BAND_LABEL: Record<string, string> = {
  strong: 'Strong',
  mid: 'Mid',
  weak: 'Weak',
};

// Repointed from InsightHeroFrame BAND_COLOR (L75-79, OLD emerald/amber/red palette)
// → the THEME-06 score-zone tokens (same language as the hero gauge + driver rows).
const BAND_COLOR: Record<string, string> = {
  strong: 'text-success',
  mid: 'text-warning',
  weak: 'text-error',
};

const DIM_NAME_LABEL: Record<string, string> = {
  clarity: 'Clarity',
  substance: 'Substance',
  credibility: 'Credibility',
};

// The deeper trio, in a stable display order.
const DEEPER_DIMS = ['clarity', 'substance', 'credibility'] as const;

function DimensionRow({ dim }: { dim: ApolloDimension }) {
  const bandColor = BAND_COLOR[dim.band] ?? 'text-foreground-muted';
  return (
    <div
      data-testid="deeper-read-row"
      className="flex items-center justify-between gap-2 py-1"
    >
      <span className="text-[12px] text-foreground-secondary">
        {DIM_NAME_LABEL[dim.name] ?? dim.name}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[12px] tabular-nums text-foreground-muted">{dim.score}</span>
        <span className={`text-[12px] font-medium ${bandColor}`}>
          {BAND_LABEL[dim.band] ?? dim.band}
        </span>
      </span>
    </div>
  );
}

export interface DeeperReadProps {
  /** Apollo dimensions (length-6, 0-100). Null/undefined when the reasoner is
   *  unavailable (DeepSeek circuit-breaker open) — the expand then renders nothing. */
  dimensions: ApolloDimension[] | null | undefined;
}

export function DeeperRead({ dimensions }: DeeperReadProps) {
  // Select the three remaining dims, in DEEPER_DIMS order, keeping only those present.
  const rows = DEEPER_DIMS.map((name) => dimensions?.find((d) => d.name === name)).filter(
    (d): d is ApolloDimension => Boolean(d),
  );

  // D-13: none of the deeper dims present (apollo_reasoning null / partial) → render nothing.
  if (rows.length === 0) return null;

  return (
    <AccordionRoot type="single" collapsible data-testid="deeper-read">
      <AccordionItem
        value="deeper-read"
        // De-boxed (2026-07-18, B+tweak): a borderless expand row at the column edge, matching
        // the Score-drivers rows — a top hairline instead of a rounded panel, so the whole
        // Reading reads as one calm column, not a stack of boxes. `rounded-none border-0` FIRST
        // to reset the vendored AccordionItem's default rounded+border (same as ITEM_CLASS in
        // reading-accordion), THEN the single top hairline.
        className="rounded-none border-0 border-t border-[var(--color-border)] bg-transparent"
      >
        <AccordionTrigger className="px-0.5 py-[15px] text-[13px] font-medium text-foreground hover:text-foreground/80 [&>svg]:text-foreground-muted">
          Deeper read
        </AccordionTrigger>
        <AccordionContent className="px-0.5 pb-3 pt-0">
          <div className="divide-y divide-[var(--color-border)]">
            {rows.map((dim) => (
              <DimensionRow key={dim.name} dim={dim} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}

DeeperRead.displayName = 'DeeperRead';
