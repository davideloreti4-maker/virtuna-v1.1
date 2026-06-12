import { Surface } from "@/components/numen/surface";

/**
 * SocialProof — PROOF-01/02 fuller #proof block (D-08/D-09).
 *
 * The live waitlist count is the PRIMARY proof (D-08), threaded in as a prop from
 * the single cached read in page.tsx (one source, two surfaces — D-10; this is the
 * fuller block, ProofStrip is the early strip). Static RSC.
 *
 * D-09 honesty guard (HARD): show the real number ONLY at/above THRESHOLD; below it,
 * a qualitative anchor — NEVER "0 creators", never a fake-precision or inflated line.
 * The threshold logic lives here (presentational), not in the read.
 *
 * Testimonials (D-08): structurally complete but placeholder-ready — the row renders
 * from an EMPTY array, so until real quotes exist (D-L4 / launch) it renders NOTHING.
 * NEVER a fabricated quote (fabricating would break the honesty moat).
 *
 * Color by token NAME only — no accent (accent is reserved for the form submit).
 * The count figure is a real count of real people, not a verdict and not a hype
 * metric, so it does NOT violate VOICE Rule 3.
 */

/** D-09 cutover (UI-SPEC §3 default). Below this → qualitative anchor, never "0 creators". */
const THRESHOLD = 50;

/**
 * Placeholder-ready testimonials. EMPTY until real quotes exist at launch (D-L4).
 * NEVER add a fabricated quote here — the row renders nothing while empty.
 */
const testimonials: { quote: string; attribution: string }[] = [];

export function SocialProof({ count }: { count: number }) {
  const aboveThreshold = count >= THRESHOLD;

  return (
    <div className="mt-6 flex flex-col gap-12 md:mt-8">
      {/* Count block — the primary live proof, on a solid plate. */}
      <div className="rounded-[12px] border border-border bg-panel p-4 md:p-6">
        {aboveThreshold ? (
          <p className="text-3xl font-bold tracking-tight text-text md:text-4xl">
            {count.toLocaleString()} creators are on the list.
          </p>
        ) : (
          <p className="text-3xl font-bold tracking-tight text-text md:text-4xl">
            Be one of the first creators to read your content honestly.
          </p>
        )}
      </div>

      {/* Testimonial row — placeholder-ready. Renders nothing while empty (D-08). */}
      {testimonials.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {testimonials.map((t) => (
            <Surface key={t.attribution} className="flex flex-col gap-4 p-4 md:p-6">
              <p className="text-base leading-relaxed text-text">{t.quote}</p>
              <p className="text-sm text-text-muted">{t.attribution}</p>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
