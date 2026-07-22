import type { Metadata } from "next";
import { HeroShowcase } from "@/components/offer/hero-showcase";
import { BlurFade } from "@/components/velora/blur-fade";
import { Transformation } from "@/components/offer/sections/transformation";
import { HowItWorks } from "@/components/offer/sections/how-it-works";
import { ProofMechanism } from "@/components/offer/sections/proof-mechanism";
import { Pricing } from "@/components/offer/sections/pricing";
import { Faq } from "@/components/offer/sections/faq";
import { FinalCta } from "@/components/offer/sections/final-cta";
import { OfferFooter } from "@/components/offer/sections/footer";
import { StickyCta } from "@/components/offer/sections/sticky-cta";

/** Fine film grain (inline, no asset) — the matte texture that keeps the dark wash from reading flat. */
const GRAIN =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='140' height='140' filter='url(#n)' opacity='0.55'/></svg>",
  );

export const metadata: Metadata = {
  title: "Maven — Know if your video will pop before you post",
  description:
    "Maven simulates how 1,000 viewers react to your video, second by second — see the exact moment they'd scroll, and the fix, before you post. Test your first video for $1.",
};

/**
 * /go — the cold-traffic offer page (paid social → this).
 * Slice 1: sticky brand bar + the interactive hero (copy + the ReadStage wow).
 * Transformation / pricing / FAQ sections land next.
 */
export default function OfferPage() {
  return (
    <main>
      {/* slim brand bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-extrabold text-accent-foreground">
              M
            </span>
            Maven
            <span className="text-[11px] font-medium text-foreground-muted">
              by Numen
            </span>
          </span>
          <a
            href="#pricing"
            className="rounded-lg bg-action px-3.5 py-1.5 text-sm font-semibold text-action-foreground transition-transform hover:scale-[1.02]"
          >
            Start for $1
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        {/* atmosphere — layered matte depth (wash + dot-grid + soft blooms + grain), never glass */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* warm top wash */}
          <div
            className="absolute inset-x-0 top-0 h-[70%]"
            style={{ background: "linear-gradient(180deg,rgba(255,143,112,0.05),transparent 62%)" }}
          />
          {/* dot grid, fading toward the edges */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px,rgba(236,231,222,0.05) 1px,transparent 0)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(120% 80% at 50% 0%,#000 28%,transparent 76%)",
              WebkitMaskImage: "radial-gradient(120% 80% at 50% 0%,#000 28%,transparent 76%)",
            }}
          />
          {/* coral bloom, top-right (the one warm accent) */}
          <div
            className="absolute -top-40 right-[-12%] h-[560px] w-[560px] rounded-full opacity-[0.13] blur-[140px]"
            style={{ background: "radial-gradient(circle,#FF6363,transparent 70%)" }}
          />
          {/* neutral-warm bloom, bottom-left — balances the composition */}
          <div
            className="absolute bottom-[-28%] left-[-14%] h-[520px] w-[520px] rounded-full opacity-[0.07] blur-[150px]"
            style={{ background: "radial-gradient(circle,#ffb27a,transparent 70%)" }}
          />
          {/* film grain */}
          <div
            className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
            style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "140px 140px" }}
          />
          {/* settle into the page below */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-12 md:py-16">
          {/* copy — the promise, above the two-surface showcase */}
          <div className="mx-auto max-w-2xl text-center">
            <BlurFade delay={0.05}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Stop posting blind
              </span>
            </BlurFade>
            <BlurFade delay={0.12}>
              <h1 className="mt-3 font-serif text-[clamp(2.3rem,5.2vw,3.6rem)] font-medium leading-[1.05] tracking-tight text-balance">
                Know if your video will pop —{" "}
                <span className="italic text-accent-text">before</span> you post
                it.
              </h1>
            </BlurFade>
            <BlurFade delay={0.19}>
              <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-relaxed text-foreground-secondary">
                Maven reads your video frame by frame, then simulates how 1,000
                real viewers react — so you see the exact moment they&apos;d
                scroll, and the fix, before you ever hit post.
              </p>
            </BlurFade>
            <BlurFade delay={0.26}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#pricing"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-action px-6 text-[15px] font-semibold text-action-foreground transition-transform hover:scale-[1.02] active:scale-[0.99]"
                >
                  Test your first video — $1
                </a>
                <span className="text-[13px] text-foreground-muted">
                  $1 for 3 days · cancel anytime
                </span>
              </div>
            </BlurFade>
            <BlurFade delay={0.33}>
              <p className="mt-6 text-[13px] text-foreground-muted">
                🔒 Trained on 500 dissected viral videos
              </p>
            </BlurFade>
          </div>

          {/* the wow — the REAL product, live: craft card BESIDE the room */}
          <BlurFade delay={0.2} className="mt-12 md:mt-16">
            <HeroShowcase />
          </BlurFade>
        </div>
      </section>

      {/* the rest of the page — the persuasion arc */}
      <Transformation />
      <HowItWorks />
      <ProofMechanism />
      <Pricing />
      <Faq />
      <FinalCta />
      <OfferFooter />

      {/* always-available mobile close */}
      <StickyCta />
    </main>
  );
}
