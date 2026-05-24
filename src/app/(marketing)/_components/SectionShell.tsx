/**
 * SectionShell.tsx — Reusable placeholder section wrapper.
 *
 * Server component (no client directive) consumed 9 times by /v3/page.tsx (Plan 05).
 * Renders a <section> with id slug, aria-label, alternating background, and centered
 * H2 + body label placeholder content per UI-SPEC § Section Shell Visual Contract.
 *
 * Implements FOUND-01: rendering the 9 placeholder sections on /v3 requires this primitive.
 *
 * Typography:
 *   H2:   30px font-semibold (600), leading-tight, tracking-tight, --color-foreground-muted
 *   Body: 16px font-regular (400),  --color-foreground-muted at 60% opacity
 *
 * Spacing (UI-SPEC § Spacing Scale):
 *   Section padding: py-12 px-6 (48px vertical / 24px horizontal)
 *   Inner max-width: max-w-7xl mx-auto
 *
 * Color rhythm (UI-SPEC § Section Shell Visual Contract):
 *   variant='odd'  → bg-background          (#07080a, --color-gray-950)
 *   variant='even' → bg-background-elevated (#1a1b1e, --color-gray-900)
 *
 * Min-height:
 *   isHero=true (Hero shell)        → min-h-[100dvh] (iOS Safari fix, PITFALLS § 22)
 *   isHero unset / false (others)   → min-h-[400px]
 *
 * Raycast restraint (CLAUDE.md): no border-top/border-bottom (background alternation
 * provides separation), no translate-y hover, no shadow, no border-change on hover.
 */

import type { JSX } from "react";

export interface SectionShellProps {
  id: 'hero' | 'demo' | 'how-it-works' | 'surfaces' | 'comparison' | 'science' | 'social-proof' | 'pricing' | 'final-cta';
  label: string;
  shipsInPhase: number;
  variant: 'odd' | 'even';
  isHero?: boolean;
}

export function SectionShell({
  id,
  label,
  shipsInPhase,
  variant,
  isHero,
}: SectionShellProps): JSX.Element {
  const bgClass = variant === 'odd' ? 'bg-background' : 'bg-background-elevated';
  const minHeightClass = isHero ? 'min-h-[100dvh]' : 'min-h-[400px]';

  return (
    <section
      id={id}
      aria-label={`${label} section`}
      className={`${bgClass} ${minHeightClass} py-12 px-6`}
    >
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center h-full">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground-muted">
          {label}
        </h2>
        <p className="mt-4 text-base font-normal text-foreground-muted/60">
          {label} — content ships in Phase {shipsInPhase}
        </p>
      </div>
    </section>
  );
}
