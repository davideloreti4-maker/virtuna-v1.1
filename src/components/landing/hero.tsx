import { CtaPair, TRIAL_MICROCOPY } from "./cta";
import { Reveal } from "./reveal";
import { RetentionCurve } from "./retention-curve";
import { PlayerSketch } from "./sketch";
import { Slot } from "./slot";

/**
 * The fold.
 *
 * Its thesis is the CURVE, not the screenshot. The most characteristic object in
 * this product's world is the second-by-second line that says exactly when an
 * audience leaves, so the hero states the claim in type and then immediately
 * shows the instrument that backs it — headline, ask, then a full-bleed curve
 * with the moment of departure pinned. The product window comes after, because a
 * screenshot is what the product LOOKS like and the curve is what it KNOWS.
 *
 * Left-aligned, against the centred-hero default. It gives the display face room
 * to be an editorial grotesque rather than a poster, and it sets up the one
 * composition on the page that only works this way: a headline block holding the
 * left half while the curve runs the full width underneath it.
 *
 * ⚠️ FOLD BUDGET. The CTA must sit above the fold on a 1512×860 laptop AND a
 * 390×844 phone — the two viewports this page's traffic actually arrives on. The
 * curve is meant to be half-visible at the fold; the CTA never is. Re-measure
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
          The accent budget is four jobs and none of them is ambience; a warm glow
          behind the fold would also be the exact "glass and glow" texture the
          product's system rules out. */}
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
        <div className="lp-measure pb-10 pt-28 md:pb-12 md:pt-32">
          <Reveal>
            <p className="lp-eyebrow">For TikTok, Reels &amp; Shorts creators</p>

            <h1 className="lp-display mt-6 max-w-[15ch]">
              Find the second they scroll away.{" "}
              <span className="lp-em text-[color:var(--lp-fg-2)]">
                Before you post.
              </span>
            </h1>

            <p className="lp-lead mt-7 max-w-[46ch]">
              A thousand simulated viewers watch your draft. You get the frame
              they drop at — and the cut that fixes it.
            </p>

            <CtaPair className="mt-9" />

            <p className="lp-mono mt-5 text-[11px] text-[color:var(--lp-fg-3)]">
              {TRIAL_MICROCOPY}
            </p>

            {/* One quiet line of proof. The empty-avatar coin stack died here:
                placeholder faces at 28px read as broken assets, not pending
                ones — and the claim carries itself. */}
            <div className="mt-10 flex items-center gap-2.5">
              <Stars />
              <span className="text-[13px] text-[color:var(--lp-fg-2)]">
                <span className="lp-mono text-[color:var(--lp-fg)]">4.9</span> from
                1,240 creators
              </span>
            </div>
          </Reveal>
        </div>

        {/* The instrument. Framed by a readout header so it is legible as a
            MEASUREMENT rather than decoration — the labels are the difference
            between a chart and a squiggle.
            ⚠️ The curve sits on the SAME measure as its header. It was full-bleed
            first, which clipped both axis labels against the viewport edges and
            left the header floating inset above a line that started off-screen —
            an instrument whose readout and its scale disagree reads as broken,
            not bold. */}
        <Reveal delay={80}>
          {/* pb: air between the curve's floor rule and the next section's
              full-bleed hairline — without it the two lines nearly touch. */}
          <div className="lp-measure-wide pb-14 md:pb-16">
            <div className="flex items-baseline justify-between border-t border-[color:var(--lp-line)] pb-5 pt-4">
              <span className="lp-eyebrow">Retention · your video</span>
              {/* Hidden on phones: both labels wrap at 390px and collide. */}
              <span className="lp-eyebrow hidden sm:block">
                Simulated · 1,000 viewers
              </span>
            </div>
            <RetentionCurve />
          </div>
        </Reveal>

        {/* The demo stage. A VERDICT frame here once stacked a second retention
            curve under the signature one — duplication. A demo VIDEO doesn't:
            the curve says what Maven knows, the stage shows the product moving
            (Sandcastles' video-first fold, Attio's floating-artifact framing).
            The floats are the same artifact grammar the feature cards use, so
            the hero previews the system rather than inventing one. */}
        <Reveal delay={140}>
          <div className="lp-measure-wide pb-6 pt-10 md:pt-12">
            <div className="relative">
              {/* ambient wash — a neutral lift behind the stage so the frame
                  reads as an object in light, not a rectangle on a wall */}
              {/* Vertical outset only. A horizontal outset bled past the
                  viewport at every breakpoint's edge case — and the radial is
                  transparent by 72% anyway, so ±40px buys nothing visible. */}
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
