import { TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/offer/motion/reveal";

/**
 * PlatformBar — a slim honest credibility strip directly under the hero. NOT a
 * fake logo wall: it states only true facts, and each one is a fact no OTHER
 * section already states.
 *
 * Three corrections live here:
 *  • It used to repeat "trained on 500 dissected viral videos" and the viewer
 *    count within 400px of the hero saying the same thing. Duplicated claims read
 *    as thin, not emphatic — the numbers now live once, in ProofMechanism.
 *  • It used to claim "your videos stay on TikTok — never uploaded". That is
 *    false: `/api/analyze` re-hosts a `tiktok_url` (resolveAndRehost) and stores
 *    a `video_upload` in Supabase storage in order to read frames. The honest
 *    claim — the one we can actually stand behind — is that your RESULTS are
 *    private to your account. Never restore the old wording.
 *  • The chips stated MECHANISM ("reads the video frame by frame", "a simulated
 *    room reacts, in character"). Under a hero that already sells the mechanism,
 *    a visitor's next question is what they walk away with — so they now state
 *    the outcome (2026-07-26).
 *
 * Two constraints when editing these, both learned the hard way:
 *  • Nothing that restates the hero. It sits ~400px below it.
 *  • NO viewer count. The hero was reconciled 2026-07-26 (the subhead sells the
 *    room, the panel chip says "10 named viewers", "up to 1,000" survives only
 *    in metadata) — a second number here would just re-open the two-scales
 *    question that `faq-scale` already answers.
 */

const CHIPS: readonly { label: string; muted?: boolean }[] = [
  { label: "A full read in about 90 seconds" },
  { label: "Read what each viewer actually thought" },
  { label: "Your results are private to your account" },
  { label: "Instagram Reels & YouTube Shorts — coming soon", muted: true },
];

export function PlatformBar() {
  return (
    <div className="border-y border-border bg-surface-sunken/40">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <Reveal gesture="rise" duration={0.5}>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 text-center">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground-secondary">
              <TiktokLogo size={16} weight="fill" className="text-foreground" aria-hidden />
              Built for TikTok
            </span>
            {CHIPS.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-4">
                <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
                <span
                  className={
                    chip.muted
                      ? "text-[12px] text-foreground-muted/70"
                      : "text-[12px] text-foreground-muted"
                  }
                >
                  {chip.label}
                </span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
