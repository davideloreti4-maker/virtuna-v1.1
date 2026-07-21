import type { Metadata } from "next";
import { ProductRender } from "@/components/offer/product-render";
import { BlurFade } from "@/components/velora/blur-fade";

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
        {/* subtle matte coral glow — atmosphere, not paint */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full opacity-[0.12] blur-[130px]"
          style={{ background: "radial-gradient(circle,#FF6363,transparent 70%)" }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-20">
          {/* copy */}
          <div>
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
              <p className="mt-4 max-w-[34ch] text-[17px] leading-relaxed text-foreground-secondary">
                Maven simulates how 1,000 real viewers react to your video,
                second by second — so you see the exact moment they&apos;d
                scroll, and the fix, before you ever hit post.
              </p>
            </BlurFade>
            <BlurFade delay={0.26}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
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

          {/* the wow — the REAL product card, rendered live from the app */}
          <BlurFade delay={0.2} direction="left">
            <ProductRender />
          </BlurFade>
        </div>
      </section>
    </main>
  );
}
