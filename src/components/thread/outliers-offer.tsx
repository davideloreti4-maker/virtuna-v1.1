'use client';

/**
 * OutliersOffer — the explicit-spend "Find new outliers" affordance, shared by the hooks, ideas,
 * and script thread views.
 *
 * Rendered ONLY when the server signalled (via the `outliers` SSE event → the stream hook's
 * `outliersAvailable`) that a live scrape would find proven outliers this run couldn't. Tapping it
 * authorizes a live scan (allowScrape: true) that re-runs the same subject; the scrape's
 * write-through then keeps the subject grounded for free next time. Copy is honest for both the
 * fully-ungrounded and the grounded-on-a-partial cases — either way, this run skipped the live scan.
 *
 * The CTA carries the primary action treatment (bg --color-action) on purpose: authorizing a spend
 * is a genuine, deliberate action — exactly the liveness moment the near-zero accent dosage is for.
 * A status note (role="status"), never the error alert — nothing failed, the cards are real.
 */
import { CardPrimaryAction } from './card-primitives';

export interface OutliersOfferProps {
  onFindOutliers: () => void;
}

export function OutliersOffer({ onFindOutliers }: OutliersOfferProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1.5"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
        Want live proof for this?
      </p>
      <p className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
        This run skipped the live outlier scan. Run it now to pull fresh proven outliers on this
        topic — a few seconds, and they&rsquo;re cached for next time.
      </p>
      <CardPrimaryAction
        onClick={onFindOutliers}
        className="mt-1.5 self-start"
        aria-label="Find new outliers with a live scan"
      >
        Find new outliers →
      </CardPrimaryAction>
    </div>
  );
}
