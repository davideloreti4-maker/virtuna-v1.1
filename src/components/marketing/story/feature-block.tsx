import Image from "next/image";

import { BrowserChrome } from "@/components/marketing/story/skeletons";
import { cn } from "@/lib/utils";

/**
 * FeatureBlock — STORY-03 leaf: a single two-column feature deep-dive row
 * (03-RESEARCH § Pattern 5 / § Code Examples "Alternating feature block",
 * 03-PATTERNS § feature-block.tsx).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered. It pairs a benefit headline (level-3) + one tight
 * Inter line of copy with ONE real screenshot of the running app, framed in
 * BrowserChrome so it reads as the product — not as set-dressing. The captures
 * are 2× crops with animations disabled, each cropped to 16:10 (the frame's
 * ratio) so nothing is scaled or letterboxed.
 *
 * GAP-3 (component-level): the grid is `items-start` (copy top-aligns with the
 * visual, never stranded against a tall image). Page-level whitespace is 03-06's
 * job (this leaf does not touch page.tsx).
 *
 * The column order flips per row via the `md:order-*` order-swap utility: when
 * `flip`, the copy column takes `md:order-2` and the visual takes `md:order-1`,
 * so the image side alternates left/right down the section (OpusClip/Linear
 * feature-deep-dive rhythm). Below `md` the grid collapses to one column and the
 * order utilities are inert, so the block stacks copy-over-visual on mobile
 * (responsive by construction — Pitfall 6, no fixed pixel widths).
 *
 * The visual wrapper carries `data-feature-visual` (the stable count hook the
 * 03-00 test gates "3–4 feature visuals" on) and an `aspect-[16/10]` box so the
 * image mount introduces no layout shift (no-CLS, Success Criterion 4).
 *
 * The heading is SANS the Newsreader serif (D-C) — the serif stays precious to
 * the hero. Coral is NOT used here (A6): the only colour inside a frame is the
 * product's own semantic banding (a green score, an amber drop). Reference
 * semantic tokens only — no hardcoded hex, no glass/glow/blur.
 */
interface FeatureBlockProps {
  /** Benefit headline (renders as a level-3 heading). */
  title: string;
  /** One tight Inter line naming the real benefit. */
  body: string;
  /** Public path of the app capture shown in this row's framed visual. */
  src: string;
  /** What the capture shows — the accessible name of the frame. */
  alt: string;
  /** Flip the column order on desktop (image left↔right per row). */
  flip?: boolean;
}

export function FeatureBlock({ title, body, src, alt, flip }: FeatureBlockProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
      {/* Copy column — takes md:order-2 when flipped so the visual leads. */}
      <div className={cn(flip && "md:order-2")}>
        <h3 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-base text-foreground-secondary md:text-lg">
          {body}
        </p>
      </div>

      {/* The app capture, framed in BrowserChrome — an aspect-stable 16/10 box
          (the captures' own ratio, so `object-cover` never actually crops).
          Takes md:order-1 when flipped so it sits left of the copy.
          `data-feature-visual` is the stable count hook for the 03-00 gate. */}
      <BrowserChrome className={cn(flip && "md:order-1")}>
        <div
          data-feature-visual
          className="relative aspect-[16/10] overflow-hidden bg-surface"
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 768px) 560px, 92vw"
            className="object-cover object-top"
          />
        </div>
      </BrowserChrome>
    </div>
  );
}
