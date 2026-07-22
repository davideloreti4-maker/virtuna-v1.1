import { TiktokLogo } from "@phosphor-icons/react/dist/ssr";
import { BlurFade } from "@/components/velora/blur-fade";

/**
 * PlatformBar — a slim honest credibility strip directly under the hero. NOT a
 * fake logo wall: it states only true facts (built for TikTok, corpus size,
 * privacy posture, honest roadmap). Establishes trust in one glance before the
 * argument begins, without borrowing credibility we haven't earned.
 *
 * Matte + muted by design — this recedes; it is a floor of facts, not a claim.
 */

const CHIPS: readonly { label: string; muted?: boolean }[] = [
  { label: "Trained on 500 dissected viral videos" },
  { label: "1,000-viewer simulation per video" },
  { label: "Your videos stay on TikTok — never uploaded" },
  { label: "Instagram Reels & YouTube Shorts — coming soon", muted: true },
];

export function PlatformBar() {
  return (
    <div className="border-y border-border bg-surface-sunken/40">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <BlurFade delay={0.05}>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-center">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground-secondary">
              <TiktokLogo size={16} weight="fill" className="text-foreground" aria-hidden />
              Built for TikTok
            </span>
            {CHIPS.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-5">
                <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
                <span
                  className={
                    chip.muted
                      ? "text-[12.5px] text-foreground-muted/70"
                      : "text-[12.5px] text-foreground-muted"
                  }
                >
                  {chip.label}
                </span>
              </span>
            ))}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
