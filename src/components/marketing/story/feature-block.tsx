import { Placeholder } from "@/components/marketing/placeholder";
import { cn } from "@/lib/utils";

/**
 * FeatureBlock — STORY-03 leaf: a single two-column feature deep-dive row
 * (03-RESEARCH § Pattern 5 / § Code Examples "Alternating feature block",
 * 03-PATTERNS § feature-block.tsx).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered. It pairs a benefit headline (level-3) + one tight
 * Inter line of copy with exactly one labelled, aspect-locked <Placeholder>
 * visual (swappable later via `src`, no layout shift — Success Criterion 4).
 *
 * The column order flips per row via the `md:order-*` order-swap utility: when
 * `flip`, the copy column takes `md:order-2` and the visual takes `md:order-1`,
 * so the image side alternates left/right down the section (OpusClip/Linear
 * feature-deep-dive rhythm). Below `md` the grid collapses to one column and the
 * order utilities are inert, so the block stacks copy-over-visual on mobile
 * (responsive by construction — Pitfall 6, no fixed pixel widths).
 *
 * The heading is SANS the Newsreader serif (D-C) — the serif stays precious to
 * the hero. Coral is NOT used here (A6). Reference semantic tokens only — no
 * hardcoded hex, no glass/glow/blur.
 */
interface FeatureBlockProps {
  /** Benefit headline (renders as a level-3 heading). */
  title: string;
  /** One tight Inter line naming the real benefit. */
  body: string;
  /** Flip the column order on desktop (image left↔right per row). */
  flip?: boolean;
}

export function FeatureBlock({ title, body, flip }: FeatureBlockProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
      {/* Copy column — takes md:order-2 when flipped so the visual leads. */}
      <div className={cn(flip && "md:order-2")}>
        <h3 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-base text-foreground-secondary md:text-lg">
          {body}
        </p>
      </div>

      {/* The swappable product visual — labelled + aspect-locked (no-CLS).
          Takes md:order-1 when flipped so it sits left of the copy. */}
      <Placeholder
        variant="image"
        aspect="16/10"
        label={title}
        className={cn(flip && "md:order-1")}
      />
    </div>
  );
}
