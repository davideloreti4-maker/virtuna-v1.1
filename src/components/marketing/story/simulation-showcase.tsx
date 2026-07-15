import Image from "next/image";

import { FadeInUp } from "@/components/motion";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

/**
 * SimulationShowcase — STORY-02, "The Simulation" output showcase (CONTEXT D-D
 * Layout A, 03-RESEARCH § Pattern 4 / Pitfall 4, 03-PATTERNS § simulation-showcase.tsx).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered — only the `FadeInUp` entrance is a client leaf,
 * imported as an island. It shows creators WHAT THEY GET, framed as the real
 * product (the Phase-2 pivot lesson: show the product's shape, not abstract
 * effects).
 *
 * Composition (D-D Layout A):
 *   1. Sans `<h2>` reading EXACTLY "The Simulation" (LOCKED — matches the
 *      `#the-simulation` anchor; the Newsreader serif stays precious to the
 *      hero, D-C) + a one-line cream-secondary subhead.
 *   2. ONE prominent flat-warm device-framed product visual — the browser-window
 *      chrome reused from the hero (overflow-hidden window + slim bar with 3
 *      dots + a maven.app pill + the layered DARK drop shadow + the faint warm
 *      "seat") — whose body is a REAL capture of a reading in the running app:
 *      the score, how far the video gets pushed, and the levers beneath. It
 *      replaced the static-SVG skeleton fill (FOUND-03 landed): the skeletons
 *      showed the SHAPE of a reading and read as a template; this shows the
 *      reading itself.
 *   3. The THREE named outputs surfaced as labelled text chips beneath:
 *      Audience reaction · Watch-through % · Hook · Retention (where viewers
 *      drop) · Shareability.
 *
 * NO real product component is imported — none of the retired product UI trees
 * (the board, the reading view, the viral results), and no engine or data hook.
 * The canonical IA was a SHAPE reference read during research, never an import
 * (anti-pattern guard / D-D). The skeletons are pure static set-dressing.
 *
 * Coral (`text-accent`) is kept precious (A6) — not used here. Reference
 * semantic tokens only; no hardcoded hex (except the hero's explicit, commented
 * dark-shadow + warm-seat rgba, both flat-warm-legal); no glass/glow/blur.
 */

interface NamedOutput {
  /** The output label (cream, slightly stronger). */
  label: string;
  /** A one-line clarifier (cream-muted). */
  detail: string;
}

const NAMED_OUTPUTS: readonly NamedOutput[] = [
  {
    // NOTE: this label must NOT contain "simulat" — the LOCKED <h2>"The
    // Simulation" is the single /simulat/i match the 03-00 test resolves; a
    // second "simulation" here would make getByText(/simulat/i) ambiguous.
    label: "Audience reaction",
    detail: "A synthetic crowd watches and reacts, frame by frame.",
  },
  {
    label: "Watch-through %",
    detail: "How far the average viewer gets before they tap away.",
  },
  {
    label: "Hook · Retention · Shareability",
    detail: "Your three levers — see exactly where viewers drop off.",
  },
] as const;

export function SimulationShowcase({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* 1 — Section heading. SANS font-semibold (D-C / A3); serif reserved to
          the hero. The h2 text is LOCKED VERBATIM "The Simulation" (matches the
          #the-simulation anchor; the 03-00 test asserts it exactly + as the sole
          /simulat/i node — so the eyebrow must NOT contain "simulat"). */}
      <SectionHeading eyebrow="The output" title="The Simulation" />

      {/* one-line subhead — cream-secondary, names what you get back. Avoids the
          tokens the 03-00 test queries (audience/simulat/retention) so each
          required token resolves to exactly one text node below. */}
      <p className="mt-4 max-w-[60ch] text-base text-foreground-secondary md:text-lg">
        Paste a TikTok and Maven returns the full picture — the shape of your
        prediction, before you post.
      </p>

      {/* 2 — the one prominent flat-warm device-framed product visual. */}
      <FadeInUp className="relative mt-12">
        {/* Soft warm seat — a faint matte pool that floats the frame off the
            flat page (cream at very low alpha; NOT a glow — copied verbatim from
            hero.tsx lines 99-108). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10"
          style={{
            background:
              "radial-gradient(68% 60% at 50% 36%, rgba(236,231,222,0.07), transparent 70%)",
          }}
        />

        {/* Browser-window chrome reused from the hero — the lightest surface so
            it reads as a window floating on the page; the inline box-shadow is a
            layered DARK drop shadow (flat-warm-legal depth), NOT a glow. */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72),0_14px_30px_-12px_rgba(0,0,0,0.5)]">
          {/* window chrome — slim browser bar (inherits the frame surface) */}
          <div className="flex items-center border-b border-border px-4 py-2.5">
            <span className="flex gap-2" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
            </span>
            <span className="mx-auto rounded-md bg-background px-4 py-1 font-mono text-[11px] tracking-wide text-foreground-muted">
              maven.app
            </span>
            {/* spacer keeps the address pill optically centered vs the dots */}
            <span className="w-[42px]" aria-hidden="true" />
          </div>
          {/* window body — a real reading, captured from the app at 2× with
              animations disabled. Aspect-locked (16/10, the capture's own
              ratio) so the frame reserves its box before the image decodes (no
              CLS). The capture carries no "Simulat*" text, so the LOCKED
              <h2>"The Simulation" stays the single /simulat/i text node the
              03-00 test resolves. */}
          <div className="relative aspect-[16/10] overflow-hidden bg-surface">
            <Image
              src="/images/landing/showcase-read.png"
              alt="A reading: the score, how far the video gets pushed stage by stage, and the Hook, Retention and Shareability levers beneath"
              fill
              sizes="(min-width: 1024px) 1024px, 92vw"
              className="object-cover object-top"
            />
          </div>
        </div>
      </FadeInUp>

      {/* 3 — the three named outputs as labelled chips beneath the frame. Stacks
          on mobile, 3-up on desktop (responsive by construction, Pitfall 6 — no
          fixed pixel widths). Cream-secondary labels + cream-muted details; no
          coral (A6). The stable tokens the 03-00 test asserts — audience, Hook,
          Retention + drop, Shareability — appear here AND in the filled-frame
          skeleton above, so the showcase test queries those tokens with
          getAllByText/within(dl) (WR-04), not strict single-match getByText. */}
      <dl className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {NAMED_OUTPUTS.map((o) => (
          <div
            key={o.label}
            className="flex flex-col gap-1.5 border-t border-border pt-4"
          >
            <dt className="text-base font-semibold text-foreground-secondary">
              {o.label}
            </dt>
            <dd className="text-sm text-foreground-muted">{o.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
