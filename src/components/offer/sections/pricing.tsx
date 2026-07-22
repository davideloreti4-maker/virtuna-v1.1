"use client";

import { useState } from "react";
import Link from "next/link";

import { Section, SectionHeading } from "./section-shell";
import { BlurFade } from "@/components/velora/blur-fade";
import { BorderBeam } from "@/components/velora/border-beam";
import { PrimaryCta } from "@/components/offer/cta-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, TRIAL, type Plan } from "@/lib/pricing";
import { SIGNUP_URL } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Pricing — the decision. Three levers of conversion psychology, all honest:
 *  1. Decision-shrinker — every plan opens at $1, so the real ask is "worth a
 *     dollar?", not "$99/mo?".
 *  2. Price anchoring — a real annual toggle: 10 months billed = 2 months free,
 *     shown as the lower per-month-equivalent against the true monthly (a real
 *     discount, not a fabricated strikethrough).
 *  3. Choreography — Pro is the one lit destination: the tone-step, the "Best
 *     value" flag, the single cream primary CTA, and the lone coral BorderBeam.
 *
 * CTAs route to SIGNUP_URL. No fake founding-price anchor, no fake urgency.
 */

interface PriceView {
  big: string;
  suffix: string;
  strike: string | null;
  note: string | null;
}

function priceView(plan: Plan, annual: boolean): PriceView {
  if (!annual) {
    return { big: plan.price, suffix: plan.priceSuffix, strike: null, note: null };
  }
  const yearly = plan.monthlyPriceUsd * 10; // 12 months billed as 10 → 2 free
  const perMonth = Math.round(yearly / 12);
  return {
    big: `$${perMonth}`,
    suffix: "/mo",
    strike: plan.price,
    note: `billed $${yearly.toLocaleString("en-US")}/yr`,
  };
}

function BillingToggle({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (annual: boolean) => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center rounded-full border border-border bg-surface-sunken p-1"
      >
        {[
          { key: false, label: "Monthly" },
          { key: true, label: "Annual" },
        ].map((opt) => {
          const active = annual === opt.key;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-action text-action-foreground"
                  : "text-foreground-muted hover:text-foreground-secondary",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.1em] transition-opacity",
          annual ? "text-foreground-secondary opacity-100" : "text-foreground-muted opacity-70",
        )}
      >
        2 months free
      </span>
    </div>
  );
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const highlighted = Boolean(plan.highlighted);
  const price = priceView(plan, annual);

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl p-7 md:p-8",
        highlighted
          ? "border border-border-hover/40 bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7)]"
          : "border border-border bg-transparent",
      )}
    >
      {/* Pro is the single lit destination — the lone coral in this viewport.
          BorderBeam self-hides under reduced motion. */}
      {highlighted && (
        <BorderBeam size={130} duration={9} colorFrom="#FF6363" colorTo="#ff8080" />
      )}

      <div className="flex min-h-[24px] items-center gap-2">
        {plan.badge && (
          <Badge variant="secondary" size="sm" className="uppercase tracking-[0.08em]">
            {plan.badge}
          </Badge>
        )}
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        {plan.name}
      </h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-foreground-muted">
        {plan.tagline}
      </p>

      {/* Price */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {price.big}
        </span>
        <span className="text-base text-foreground-secondary">{price.suffix}</span>
        {price.strike && (
          <span className="text-sm text-foreground-muted line-through">
            {price.strike}
          </span>
        )}
      </div>
      <p className="mt-1 min-h-[18px] text-xs text-foreground-muted">
        {price.note ?? " "}
      </p>

      {/* Bullets — first is always the meter */}
      <ul className="mt-6 flex flex-col gap-3" role="list">
        {plan.bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2 text-sm leading-relaxed text-foreground-secondary"
          >
            <span aria-hidden className="mt-0.5 shrink-0 text-foreground-muted">
              ✓
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      {/* CTA — only Pro carries the filled primary (routed through the page's
          one CTA switch); others stay quiet so ONE CTA dominates the section. */}
      <div className="mt-auto flex flex-col gap-3 pt-8">
        {highlighted ? (
          <PrimaryCta href={SIGNUP_URL} size="lg" full>
            Start for {TRIAL.price}
          </PrimaryCta>
        ) : (
          <Button asChild variant="secondary" size="lg">
            <Link href={SIGNUP_URL}>Start for {TRIAL.price}</Link>
          </Button>
        )}
        <p className="text-center text-xs text-foreground-muted">{TRIAL.microcopy}</p>
      </div>
    </article>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <Section id="pricing" divider>
      <SectionHeading
        eyebrow="Pricing"
        title="Start for a dollar"
        sub="Every plan opens with a $1 trial — 50 credits, enough to test the predictions against 5 of your own videos. Cancel before it renews and you've spent a dollar."
      />

      <BillingToggle annual={annual} onChange={setAnnual} />

      <div className="mx-auto mt-12 grid max-w-5xl items-stretch gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <BlurFade key={plan.id} delay={0.05 + i * 0.08} direction="up" className="flex">
            <div className="flex w-full">
              <PlanCard plan={plan} annual={annual} />
            </div>
          </BlurFade>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-[52ch] text-center text-[13px] text-foreground-muted">
        Prices are the launch prices. The $1 is a decision-shrinker, not a discount —
        you&apos;re judging the real product on real videos before you commit.
      </p>
    </Section>
  );
}
