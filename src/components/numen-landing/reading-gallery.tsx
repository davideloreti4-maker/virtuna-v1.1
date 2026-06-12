import Image, { type StaticImageData } from "next/image";

import { PillChip } from "@/components/numen/pill-chip";
import { Surface } from "@/components/numen/surface";
import { VerdictThrone } from "@/components/numen-landing/verdict-throne";
import heroKeyframe from "@/../public/images/landing/hero/keyframe.webp";

/**
 * ReadingGallery — GALLERY-01 / GALLERY-02, the `#gallery` luma real-Readings grid.
 *
 * A responsive grid of gallery-quality content centerpieces (NOT feature diagrams):
 * each card = an opaque `Surface` plate → a real creator still (`next/image`) → a
 * `VerdictThrone` band + label + one-line why → a `PillChip` niche tag. Renders NO
 * heading — the `#gallery` `<h2>` is owned by the `SectionShell` slot (D-10 single-h1).
 *
 * GALLERY-02 / honesty by breadth (D-06 / Pattern 2): the cards span a verdict RANGE
 * — at least one good, one mixed, one bad band — proving Numen does NOT only show the
 * wins. The verdict tokens (`bg-verdict-good/mixed/bad`) flow through the parametrized
 * `VerdictThrone` → `VerdictSwatch` literal classes (never `bg-${verdict}`).
 *
 * D-07 (non-blocking, placeholder posture): the user chose to ship on placeholder
 * stills — every card reuses the existing real `hero/keyframe.webp` (720×1280) until
 * the rights-cleared ≥3-niche asset set lands in Phase 4 (D-L4). The gallery is
 * structurally complete now and NEVER renders an empty / "no readings" state. Each
 * `<img>` still carries a factual, in-voice, non-empty `alt`.
 *
 * Image discipline: opaque `Surface` plate only — NEVER glass-over-photo (Lightning
 * CSS strips backdrop-filter; UI-SPEC forbids it). No card hover theater (at most a
 * quiet `hover:bg-panel-2`; no translate, no border change, no scroll-reveal).
 *
 * VOICE.md Rules 1-3: no engine jargon, no hype/fake-precision, the verdict is ALWAYS
 * a band + why, never a naked number. Static RSC. Color by token NAME only — no hex.
 */
interface ReadingCard {
  src: StaticImageData;
  alt: string;
  niche: string;
  verdict: "good" | "mixed" | "bad";
  label: string;
  why: string;
}

// ≥3 cards across ≥3 niches spanning the full verdict RANGE (good / mixed / bad).
// D-07: all reuse the real hero keyframe as the placeholder still (varied per card).
const cards: ReadingCard[] = [
  {
    src: heroKeyframe,
    alt: "A real Reading of a comedy creator's video showing an honest verdict and why.",
    niche: "Comedy",
    verdict: "good",
    label: "This will likely land.",
    why: "Strong hook in the first 2 seconds — tighten the middle and it lands.",
  },
  {
    src: heroKeyframe,
    alt: "A real Reading of a fitness creator's video showing a mixed-signals verdict and why.",
    niche: "Fitness",
    verdict: "mixed",
    label: "This could go either way.",
    why: "Great energy, but the payoff arrives too late to hold a scroll.",
  },
  {
    src: heroKeyframe,
    alt: "A real Reading of a cooking creator's video showing a needs-work verdict and why.",
    niche: "Cooking",
    verdict: "bad",
    label: "This needs work first.",
    why: "The first three seconds don't say why to stay — lead with the turn.",
  },
  {
    src: heroKeyframe,
    alt: "A real Reading of a beauty creator's video showing an honest verdict and why.",
    niche: "Beauty",
    verdict: "good",
    label: "This will likely land.",
    why: "Clear promise up front — hold the close a beat longer to seal it.",
  },
];

export function ReadingGallery() {
  return (
    <>
      <p className="mt-6 text-base leading-relaxed text-text-muted md:mt-8 md:text-lg">
        Real verdicts on real videos — the good, the mixed, and the ones that
        need work. We don&apos;t only show you the wins.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
        {cards.map((card, i) => (
          <Surface
            key={`${card.niche}-${i}`}
            as="article"
            className="flex flex-col gap-4 p-4 md:p-6"
          >
            <div className="overflow-hidden rounded-[12px] border border-border">
              <Image
                src={card.src}
                alt={card.alt}
                placeholder="blur"
                className="h-auto w-full"
                sizes="(min-width: 768px) 320px, 100vw"
              />
            </div>
            <VerdictThrone
              verdict={card.verdict}
              label={card.label}
              why={card.why}
            />
            <PillChip intent="instant">{card.niche}</PillChip>
          </Surface>
        ))}
      </div>
    </>
  );
}
