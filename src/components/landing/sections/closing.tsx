import Link from "next/link";
import { Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";
import { Wordmark } from "../brand";
import { CtaPair, TRIAL_MICROCOPY } from "../cta";

/**
 * The close: founder note → final CTA band → footer.
 *
 * The founder note is the last trust device, deliberately adjacent to the
 * final ask — a signed sentence from a person lands harder the closer it sits
 * to the money. The final band then makes the ask once more, in the largest
 * type on the page after the hero, with nothing else competing.
 */

export function FounderNote() {
  return (
    <Section density="compact">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-start gap-8 sm:flex-row sm:gap-10">
        <Slot variant="portrait" label="Founder" className="w-32 shrink-0 sm:w-36" />
        <div>
          <p className="lp-eyebrow">A note from the founder</p>
          <p className="lp-body mt-5 text-[15px]">
            Every creator I know has a cut they still believe in that the feed
            buried. Every tool describes what happened — Maven says what&rsquo;s
            about to. (Placeholder copy.)
          </p>
          <p className="lp-mono mt-6 text-[12px] text-[color:var(--lp-fg-3)]">
            — Founder, Maven
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

export function FinalCta() {
  return (
    /* Bespoke, not <Section>: the close is the signature's bookend and needs
       its own full-bleed backdrop. The receipts' first cuts DROP; this curve
       HOLDS — the page's whole argument, drawn once more behind the last ask.
       Whisper-quiet (≤12% cream) so the headline owns the moment. */
    <section className="lp-rule lp-band-alt relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <svg
          className="absolute inset-x-0 bottom-0 h-[70%] w-full"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          {/* the cut that used to happen — barely there */}
          <path
            d="M 0 40 C 210 46, 290 60, 350 92 C 410 124, 520 152, 700 166 C 900 178, 1080 182, 1200 184"
            fill="none"
            stroke="#ece7de"
            strokeOpacity="0.055"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
          {/* the posted cut — holding */}
          <path
            d="M 0 36 C 260 40, 560 48, 820 58 C 1000 65, 1120 70, 1200 74"
            fill="none"
            stroke="#ece7de"
            strokeOpacity="0.12"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div
        className="lp-measure relative"
        style={{ paddingBlock: "var(--lp-section-y)" }}
      >
        <Reveal className="flex flex-col items-center py-6 text-center md:py-10">
          <h2 className="lp-display max-w-[14ch]">
            Know{" "}
            <span className="lp-em text-[color:var(--lp-fg-2)]">before</span> you
            post.
          </h2>
          <p className="lp-lead mx-auto mt-6 max-w-[40ch]">
            Your next video is already on your phone. Find out what happens to
            it — for a dollar.
          </p>
          <CtaPair className="mt-10 justify-center" />
          <p className="lp-mono mt-5 text-[11px] text-[color:var(--lp-fg-3)]">
            {TRIAL_MICROCOPY}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * ⚠️ /terms and /privacy DO NOT EXIST as routes yet — the links are here
 * because a page that charges a card must offer them, and the pages are a
 * follow-up. `prefetch: false` on those two: next/link prefetches on
 * viewport-enter, and prefetching a missing route logs a 404 for every
 * visitor who scrolls to the footer.
 */
const FOOTER_LINKS = [
  { href: "/login", label: "Sign in", prefetch: true },
  { href: "/terms", label: "Terms", prefetch: false },
  { href: "/privacy", label: "Privacy", prefetch: false },
  { href: "mailto:support@virtuna.ai", label: "Contact", prefetch: false },
] as const;

export function Footer() {
  return (
    <footer className="lp-rule">
      {/* Extra bottom padding on phones clears the sticky CTA bar. */}
      <div className="lp-measure-wide flex flex-col items-start justify-between gap-6 pb-28 pt-10 sm:flex-row sm:items-center md:pb-10">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <p className="lp-mono text-[11px] text-[color:var(--lp-fg-3)]">
            © 2026 Maven. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-6" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              prefetch={link.prefetch}
              className="text-[13px] text-[color:var(--lp-fg-2)] transition-colors hover:text-[color:var(--lp-fg)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
