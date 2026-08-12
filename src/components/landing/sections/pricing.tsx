import { PLANS, TRIAL, creditsLabel } from "@/lib/pricing";
import { Section } from "../section";
import { Reveal } from "../reveal";
import { PrimaryCta, TRIAL_MICROCOPY } from "../cta";

/**
 * Pricing — one decision, then the fine print.
 *
 * The page sells exactly one thing: the $1 trial. So there is ONE focal card —
 * with the page's only lit border, a sanctioned accent job — and the three
 * monthly plans appear only as the honest answer to "and then what?", rendered
 * deliberately quiet underneath. Three equal plan cards with three CTAs is the
 * layout for a considered purchase; this page's buyer is deciding whether to
 * spend a dollar.
 *
 * Prices and trial mechanics come from lib/pricing — the SSOT the checkout
 * enforces. Marketing latitude covers adjectives, never numbers a card gets
 * charged against.
 */

const TRIAL_BULLETS = [
  `${TRIAL.credits} credits — enough for 5 full video reads`,
  "Every skill unlocked: reads, hooks, ideas, scripts",
  "Personas calibrated to your niche",
  "Cancel in two taps — the total stays $1",
] as const;

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="mt-[3px] h-4 w-4 shrink-0 text-[color:var(--lp-fg)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Pricing() {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title={
        <>
          Three days. One dollar.
          <br />
          <span className="lp-em text-[color:var(--lp-fg-2)]">Everything.</span>
        </>
      }
      lead="The whole product, unlocked. No tiers to compare."
      align="center"
    >
      <Reveal>
        <div className="relative">
          {/* the same ambient lift the demo stage gets — the two objects the
              page most needs the eye to land on */}
          {/* Vertical outset only — a horizontal one bled past the viewport
              at breakpoint edges (see the hero wash note). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-10 -top-14"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 45%, rgba(236,231,222,0.045), transparent 72%)",
            }}
          />
          {/* Not <Card>: the trial card carries the page's ONE lit border —
              accent job #2 of 3 — in place of the standard hairline, and two
              nested frames read as a mistake. Inline style, not a class: this
              exact border exists nowhere else. */}
          <div
            className="lp-elevate relative mx-auto max-w-xl rounded-2xl bg-[color:var(--lp-card)] p-8 md:p-10"
            style={{ border: "1px solid rgba(255,99,99,0.4)" }}
          >
          <div className="text-center">
            <p className="lp-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--lp-fg-3)]">
              Everything unlocked
            </p>

            <div className="mt-5 flex items-baseline justify-center gap-3">
              <span
                className="text-[64px] font-medium leading-none tracking-[-0.03em] text-[color:var(--lp-fg)]"
                style={{ fontFamily: "var(--lp-font-display)" }}
              >
                {TRIAL.price}
              </span>
              <span className="text-[17px] text-[color:var(--lp-fg-2)]">
                for {TRIAL.days} days
              </span>
            </div>

            <ul className="mx-auto mt-8 flex max-w-sm flex-col gap-3.5 text-left">
              {TRIAL_BULLETS.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check />
                  <span className="lp-body text-[color:var(--lp-fg-2)]">{line}</span>
                </li>
              ))}
            </ul>

            <PrimaryCta full className="mt-9" />
            <p className="lp-mono mt-4 text-[11px] text-[color:var(--lp-fg-3)]">
              {TRIAL_MICROCOPY}
            </p>
          </div>
          </div>
        </div>
      </Reveal>

      {/* And then what? — the quiet, honest row. */}
      <Reveal delay={100}>
        <p className="lp-eyebrow mt-16 text-center">
          After day {TRIAL.days} — keep the plan you picked, or cancel
        </p>
        <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border border-[color:var(--lp-line)] px-5 py-4 text-left transition-colors duration-200 hover:border-[color:var(--lp-line-strong)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[color:var(--lp-fg)]">
                    {plan.name}
                  </span>
                  {plan.badge && <span className="lp-chip">{plan.badge}</span>}
                </span>
                <span className="lp-mono text-[13px] text-[color:var(--lp-fg-2)]">
                  {plan.price}
                  <span className="text-[color:var(--lp-fg-3)]">{plan.priceSuffix}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[color:var(--lp-fg-3)]">
                {creditsLabel(plan)}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
