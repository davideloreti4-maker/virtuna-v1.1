import { CtaPair } from "./cta";
import { Reveal } from "./reveal";
import { PlayerSketch } from "./sketch";
import { Slot } from "./slot";

/**
 * The fold.
 *
 * Centred claim over the product stage — say the thing, then show the product
 * saying it, with the stage cut by the fold so the page visibly continues.
 * This is the composition the reference set runs (Attio and Sandcastles both
 * centre; Linear bleeds the product through the fold), and it spends the
 * viewport on the two things that matter instead of leaving half of it empty
 * beside a left-aligned block.
 *
 * The full-bleed retention chart that used to sit between headline and stage
 * was CUT (owner call, 2026-08-10): a second instrument between the ask and
 * the product added scroll without adding argument. The curve still lives
 * where it earns its place — the receipts' sparklines and the final CTA's
 * backdrop reprise.
 *
 * ⚠️ FOLD BUDGET. The CTA must sit above the fold on a 1512×860 laptop AND a
 * 390×844 phone — the two viewports this page's traffic actually arrives on.
 * The stage is meant to be cut by the fold; the CTA never is. Re-measure
 * after any change to the headline length or the vertical rhythm above it.
 */

function Stars() {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-3 w-3 text-[color:var(--lp-fg-2)]">
          <path
            fill="currentColor"
            d="M12 2.6l2.6 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.5 6.5 19.6l1.3-6.2L3.1 9.1l6.3-.7z"
          />
        </svg>
      ))}
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Atmosphere. A NEUTRAL cream wash and a masked dot grid — no coral bloom.
          The accent budget has no ambience job; a warm glow behind the fold
          would also be the exact "glass and glow" texture the product's system
          rules out. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 68% at 50% -12%, rgba(236,231,222,0.05), transparent 62%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(236,231,222,0.045) 1px, transparent 0)",
            backgroundSize: "26px 26px",
            maskImage:
              "radial-gradient(110% 60% at 50% 0%, #000 20%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(110% 60% at 50% 0%, #000 20%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative">
        <div className="lp-measure pt-28 md:pt-32">
          <Reveal className="flex flex-col items-center text-center">
            {/* Audience chip — a bordered object, not a floating mono line;
                the same hairline-pill grammar the data chips use. */}
            <span className="inline-flex items-center gap-2.5 rounded-full border border-[color:var(--lp-line-strong)] py-1.5 pl-3 pr-3.5">
              <span
                aria-hidden
                className="h-1 w-1 rounded-full bg-[color:var(--lp-fg-3)]"
              />
              <span className="lp-eyebrow">
                For TikTok, Reels &amp; Shorts creators
              </span>
            </span>

            <h1 className="lp-display mt-7 max-w-[17ch]">
              Find the second they scroll away.{" "}
              <span className="lp-em text-[color:var(--lp-fg-2)]">
                Before you post.
              </span>
            </h1>

            <p className="lp-lead mt-6 max-w-[44ch]">
              A thousand simulated viewers watch your draft. You get the frame
              they drop at — and the cut that fixes it.
            </p>

            {/* The trial-mechanics microcopy that used to sit here was CUT
                (owner call, 2026-08-10): the terms already live on the button
                itself, the sticky bar, and the pricing card — a fourth
                repetition above the fold was clutter, not clarity. */}
            <CtaPair className="mt-10 w-full sm:w-auto sm:justify-center" />

            {/* One quiet line of proof. The empty-avatar coin stack died here:
                placeholder faces at 28px read as broken assets, not pending
                ones — and the claim carries itself. */}
            <div className="mt-8 flex items-center gap-2.5">
              <Stars />
              <span className="text-[13px] text-[color:var(--lp-fg-2)]">
                <span className="lp-mono text-[color:var(--lp-fg)]">4.9</span> from
                1,240 creators
              </span>
            </div>
          </Reveal>
        </div>

        {/* The demo stage — the hero's second act, cut by the fold. A VERDICT
            frame here once stacked a retention curve under the headline —
            duplication. A demo VIDEO doesn't: the stage shows the product
            moving (Sandcastles' video-first fold, Attio's floating-artifact
            framing). The floats are the same artifact grammar the feature
            cards use, so the hero previews the system rather than inventing
            one. */}
        <Reveal delay={120}>
          <div className="lp-measure-wide pb-6 pt-12 md:pt-16">
            <div className="relative">
              {/* ambient wash — a neutral lift behind the stage so the frame
                  reads as an object in light, not a rectangle on a wall.
                  Vertical outset only: a horizontal outset bled past the
                  viewport at every breakpoint's edge case. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -bottom-12 -top-16"
                style={{
                  background:
                    "radial-gradient(58% 55% at 50% 42%, rgba(236,231,222,0.05), transparent 72%)",
                }}
              />
              {/* Ratio via classes, not the inline prop: 21/9 is right at
                  desktop widths but collapses the stage to a letterbox on a
                  390px phone — there it stands up to a square. */}
              <Slot
                variant="window"
                label="Product demo"
                duration="0:45"
                ratio={null}
                play="lg"
                className="lp-elevate aspect-square sm:aspect-[16/10] lg:aspect-[21/9]"
              >
                <PlayerSketch />
              </Slot>

              {/* floating score tile — straddles the frame's top-right edge */}
              <div className="lp-elevate absolute -top-6 right-10 hidden rounded-xl border border-[color:var(--lp-line)] bg-[color:var(--lp-card-lift)] p-3.5 md:block">
                <div className="flex items-center gap-3">
                  <span className="lp-mono text-[22px] leading-none text-[color:var(--lp-fg)]">
                    87
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-[rgba(236,231,222,0.1)]">
                      <div className="h-full w-[87%] rounded-full bg-[rgba(236,231,222,0.55)]" />
                    </div>
                    <span className="lp-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lp-fg-3)]">
                      Hook · strong
                    </span>
                  </div>
                </div>
              </div>

              {/* floating cut row — bottom-RIGHT, clustered under the score tile
                  (the caption chip owns bottom-left; a float there collides) */}
              <div className="lp-elevate absolute -bottom-6 right-10 hidden rounded-xl border border-[color:var(--lp-line)] bg-[color:var(--lp-card-lift)] px-4 py-3 md:block">
                <div className="flex items-center gap-3">
                  <span className="lp-mono text-[11px] text-[color:var(--lp-fg-3)]">
                    0:04
                  </span>
                  <span className="text-[12px] text-[color:var(--lp-fg-2)]">
                    Front-load the reveal
                  </span>
                  <span className="lp-chip">move</span>
                </div>
              </div>
            </div>

            {/* Phones lose the floats (they'd overlap a 390px frame), so the
                same two artifacts land as a compact strip under the stage —
                the stage keeps its residue at every size. */}
            <div className="mt-4 grid grid-cols-2 gap-3 md:hidden">
              <div className="flex items-center gap-2.5 rounded-xl border border-[color:var(--lp-line)] bg-[color:var(--lp-card-lift)] px-3 py-2.5">
                <span className="lp-mono text-[17px] leading-none text-[color:var(--lp-fg)]">
                  87
                </span>
                <span className="lp-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--lp-fg-3)]">
                  Hook · strong
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--lp-line)] bg-[color:var(--lp-card-lift)] px-3 py-2.5">
                <span className="lp-mono text-[10px] text-[color:var(--lp-fg-3)]">0:04</span>
                <span className="truncate text-[11px] text-[color:var(--lp-fg-2)]">
                  Front-load the reveal
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
