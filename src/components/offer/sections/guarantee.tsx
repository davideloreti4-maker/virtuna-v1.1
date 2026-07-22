import { ShieldCheck, LockKey, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Section } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";

/**
 * Guarantee — the risk-reversal band, right after pricing to defuse the last
 * doubts before the FAQ + final ask. HONEST reassurances only (no fabricated
 * guarantee badges): the claims here match the page's shipped honesty contract
 * — the $1 trial mechanics, the privacy posture from the FAQ, and what the
 * dollar actually buys. Deliberately headingless (a plain reassurance band) so
 * it breaks the repeating section-heading rhythm.
 */

interface Reassurance {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}

const REASSURANCES: readonly Reassurance[] = [
  {
    icon: ShieldCheck,
    title: "$1 to try, cancel anytime",
    body: "Start for a dollar and keep going only if it earns it. Cancel in two taps from settings before day 4 — no email, no hoops.",
  },
  {
    icon: LockKey,
    title: "Your videos stay private",
    body: "Maven reads the link — your video never leaves TikTok, and we never upload or store it. Your results are private to your account. Never shared, never sold.",
  },
  {
    icon: Sparkle,
    title: "The real product, on your videos",
    body: "The $1 unlocks the full plan against your own content — 50 credits, 5 full Readings. You're judging exactly what you'd be paying for.",
  },
];

export function Guarantee() {
  return (
    <Section tone="surface" divider compact>
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        {REASSURANCES.map((r, i) => {
          const Icon = r.icon;
          return (
            <BlurFade key={r.title} delay={0.05 + i * 0.08} direction="up">
              <div className="flex flex-col">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-sunken text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.28)]">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                  {r.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-foreground-secondary">
                  {r.body}
                </p>
              </div>
            </BlurFade>
          );
        })}
      </div>
    </Section>
  );
}
