import { BlurFade } from "@/components/velora/blur-fade";
import { PrimaryCta } from "@/components/offer/cta-config";
import { TRIAL } from "@/lib/pricing";
import { SIGNUP_URL } from "@/lib/routes";

/**
 * Final CTA band — the close. Full-bleed (breaks the page's inner measure), a
 * single Newsreader-serif close-line that bookends the hero in the same voice
 * (the page's second and last serif moment), and one dominant cream CTA.
 *
 * Matte: a low-alpha CREAM tone-step radial (NOT a coral glow) + dark-shadow
 * depth with a non-zero Y offset. RSC. Coral appears nowhere — the close is
 * about the audience, and the CTA is cream by dosage rule.
 */
export function FinalCta() {
  return (
    <div className="relative w-full overflow-hidden border-y border-border bg-surface-elevated py-20 shadow-[0_-40px_80px_-24px_rgba(0,0,0,0.48)] md:py-28">
      {/* cream tone-step warm-seat — 7% cream, matte, not a glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(68% 60% at 50% 36%, rgba(236,231,222,0.07), transparent 70%)",
        }}
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-5 text-center">
        <BlurFade delay={0.05}>
          <h2 className="max-w-[20ch] text-balance font-serif text-[clamp(2rem,5vw,3.2rem)] font-medium leading-[1.08] tracking-tight text-foreground">
            Your audience already knows.{" "}
            <span className="italic text-accent-text">Find out</span> before you post.
          </h2>
        </BlurFade>

        <BlurFade delay={0.14}>
          <div className="flex flex-col items-center gap-3">
            <PrimaryCta href={SIGNUP_URL} size="lg">
              Test your first video — {TRIAL.price}
            </PrimaryCta>
            <p className="text-sm text-foreground-muted">{TRIAL.microcopy}</p>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
