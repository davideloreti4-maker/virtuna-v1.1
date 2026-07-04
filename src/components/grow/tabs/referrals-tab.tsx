"use client";

/**
 * ReferralsTab — the GROW hub's "Referrals" tab body (shell-less). Matte redesign of the
 * old standalone /referrals surface: the referral link + performance tiles, restyled onto
 * the flat-warm system (the old cards used inset-shine shadows + font-bold — both off-system).
 * Pro-gated: non-Pro users see an honest upgrade prompt instead of the link.
 */

import Link from "next/link";
import { CopyButton } from "@/components/referral/CopyButton";

export function ReferralsTab({
  eligible,
  referralLink,
  clicks,
  conversions,
  earningsCents,
}: {
  eligible: boolean;
  referralLink: string;
  clicks: number;
  conversions: number;
  earningsCents: number;
}) {
  if (!eligible) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-elevated px-6 py-10 text-center">
        <span className="rounded-[4px] border border-border-hover px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.08em] text-foreground-secondary">
          Pro
        </span>
        <div>
          <p className="m-0 text-[13px] font-medium text-foreground">Referrals are a Pro feature</p>
          <p className="mx-auto mt-1 max-w-[340px] text-[11.5px] leading-[1.5] text-foreground-muted">
            Upgrade to Pro to unlock your referral link and earn $10 for every creator who joins.
          </p>
        </div>
        <Link
          href="/pricing"
          className="mt-1 rounded-[10px] bg-[color:var(--color-action)] px-4 py-2.5 text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
        >
          View pricing →
        </Link>
      </div>
    );
  }

  const earningsDollars = (earningsCents / 100).toFixed(2);
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";
  const stats = [
    { label: "Clicks", value: clicks.toLocaleString() },
    { label: "Conversions", value: conversions.toLocaleString() },
    { label: "Earnings", value: `$${earningsDollars}` },
    { label: "Conversion rate", value: `${conversionRate}%` },
  ];

  return (
    <div>
      {/* Referral link */}
      <section className="rounded-xl border border-border bg-surface-elevated p-4">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Your referral link</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-foreground-secondary">
          Share it. When a creator signs up and subscribes, you earn{" "}
          <b className="font-semibold text-foreground">$10</b>.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-border bg-[color:var(--color-surface-thread)] p-2 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">{referralLink}</code>
          <CopyButton text={referralLink} label="Copy" />
        </div>
        <p className="mt-2 font-mono text-[9.5px] text-foreground-muted">
          Tip: drop it in your TikTok bio, or share with creator friends.
        </p>
      </section>

      {/* Performance */}
      <section className="mt-7">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Performance</h2>
        <div className="grid grid-cols-2 gap-[9px] lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col rounded-xl border border-border bg-surface-elevated px-[13px] py-3">
              <span className="text-[11.5px] font-medium text-foreground-secondary">{s.label}</span>
              <span className="mt-[7px] text-[23px] font-semibold leading-none tracking-[-0.02em] text-foreground [font-variant-numeric:tabular-nums]">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
