import { ShieldCheck, LockKey, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Section } from "./section-shell";
import { Stagger, StaggerItem } from "@/components/offer/motion/reveal";

/**
 * Guarantee — the risk-reversal band, right after pricing to defuse the last
 * doubts before the FAQ + final ask. HONEST reassurances only (no fabricated
 * guarantee badges): the $1 trial mechanics, the real privacy posture, and what
 * the dollar actually buys. Deliberately headingless (a plain reassurance band)
 * so it breaks the repeating section-heading rhythm.
 *
 * ⚠️ The privacy card used to read "your video never leaves TikTok, and we never
 * upload or store it." That is false — reading frames REQUIRES the file, so
 * `/api/analyze` re-hosts a `tiktok_url` (resolveAndRehost) and stores an upload
 * in Supabase storage. It now says what's actually true: the video is processed
 * to run the read, and the results are private to the account. Keep it that way;
 * a privacy claim we can't stand behind is the one defect on this page that could
 * cost more than a conversion.
 */

interface Reassurance {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}

const REASSURANCES: readonly Reassurance[] = [
  {
    icon: ShieldCheck,
    title: "Free to try, $1 to unlock",
    body: "Your first Test is free, no account. The $1 unlocks the simulation verdict and 3 days of the full plan — cancel in two taps from settings before day 4, no email, no hoops.",
  },
  {
    icon: LockKey,
    title: "Your work stays yours",
    body: "Your video is processed to run your read, and nothing else — never published, never shown to another user, never sold or used to sell. Your results are private to your account.",
  },
  {
    icon: Sparkle,
    title: "The real product, on your videos",
    body: "The $1 unlocks the full plan against your own content — 50 credits, 5 full Readings. You're judging exactly what you'd be paying for.",
  },
];

export function Guarantee() {
  return (
    <Section divider compact>
      <Stagger className="grid gap-10 md:grid-cols-3 md:gap-8" step={0.08}>
        {REASSURANCES.map((r) => {
          const Icon = r.icon;
          return (
            <StaggerItem key={r.title} gesture="rise">
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
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
