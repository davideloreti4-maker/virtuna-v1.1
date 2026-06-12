import { PillChip } from "@/components/numen/pill-chip";

/**
 * ProofStrip — PROOF-02/D-10 early thin credibility strip.
 *
 * A deliberately thin band (NOT a `py-24` section) mounted between #hero and
 * #how-it-works in page.tsx — credibility anchored early (D-10). Reads the SAME
 * count prop as SocialProof (one source, two surfaces; the page reads it once).
 * Static RSC.
 *
 * D-09 guard (same cutover as SocialProof): the compact count line shows the real
 * number only at/above THRESHOLD; below it, a qualitative anchor — NEVER "0 creators".
 *
 * Color by token NAME only — `border-y border-border` hairline, no accent.
 * Niche PillChips are quiet `text-text-muted` context, not a claim.
 */

/** D-09 cutover — must match social-proof.tsx (one honest threshold for both surfaces). */
const THRESHOLD = 50;

const NICHES = ["Comedy", "Fitness", "Cooking"] as const;

export function ProofStrip({ count }: { count: number }) {
  const aboveThreshold = count >= THRESHOLD;

  return (
    <div className="border-y border-border py-4 md:py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 md:flex-row md:justify-between md:px-6">
        <p className="text-sm text-text-muted md:text-base">
          {aboveThreshold
            ? `${count.toLocaleString()} creators on the waitlist`
            : "Be one of the first creators to read your content honestly."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {NICHES.map((niche) => (
            <PillChip key={niche}>{niche}</PillChip>
          ))}
        </div>
      </div>
    </div>
  );
}
