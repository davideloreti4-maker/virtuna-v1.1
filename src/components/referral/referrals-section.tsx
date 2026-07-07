"use client";

/**
 * ReferralsSection — the referral dashboard, shell-less. Lives as a tab in /settings
 * (demoted from the retired /grow hub: it's Maven's own growth mechanic, not creator-facing
 * content value, so it belongs with account/billing). Matte tone-zones + .elev-rest depth
 * on the link row + performance tiles.
 *
 * Pro-gated: instead of a hollow empty prompt, non-Pro users see the real referral
 * dashboard rendered as a DIMMED, locked preview behind a compact upgrade card — the
 * empty state teaches the value (a premium upsell), clearly labeled locked. No blur
 * (the matte bar bans it) — the lock reads via opacity + the overlaid card.
 */

import Link from "next/link";
import { CopyButton } from "@/components/referral/CopyButton";

const PERF_LABELS = ["Clicks", "Conversions", "Earnings", "Conversion rate"] as const;

/** A single performance tile — shared by the live Pro dashboard + the locked preview. */
function PerfTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="elev-rest flex flex-col rounded-xl border border-border bg-surface-elevated px-[13px] py-3">
      <span className="text-[11.5px] font-medium text-foreground-secondary">{label}</span>
      <span className="mt-[7px] text-[23px] font-semibold leading-none tracking-[-0.02em] text-foreground [font-variant-numeric:tabular-nums]">
        {value}
      </span>
    </div>
  );
}

export function ReferralsSection({
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
    // Non-Pro: the real dashboard, dimmed + locked, behind a compact upgrade card.
    return (
      <div className="relative">
        <div aria-hidden className="pointer-events-none select-none opacity-[0.35]">
          <section className="rounded-2xl bg-surface-sunken px-4 py-4">
            <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Your referral link</h2>
            <div className="elev-rest mt-3 flex items-center gap-2 rounded-[10px] border border-border bg-[color:var(--color-surface-thread)] p-2 pl-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">numen.co/?ref=•••••••</code>
              <span className="rounded-[8px] border border-border px-2.5 py-1.5 font-mono text-[11px] text-foreground-muted">Copy</span>
            </div>
          </section>
          <section className="mt-4 rounded-2xl bg-surface-sunken px-4 py-4">
            <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Performance</h2>
            <div className="grid grid-cols-2 gap-[9px] lg:grid-cols-4">
              {PERF_LABELS.map((label) => (
                <PerfTile key={label} label={label} value="•••" />
              ))}
            </div>
          </section>
        </div>

        {/* Compact upgrade card, centered over the locked preview. */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="elev-rest flex max-w-[360px] flex-col items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-6 py-7 text-center">
            <span className="rounded-[4px] border border-border-hover px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.08em] text-foreground-secondary">
              Pro
            </span>
            <div>
              <p className="m-0 text-[13.5px] font-semibold text-foreground">Unlock your referral link</p>
              <p className="mx-auto mt-1 max-w-[300px] text-[11.5px] leading-[1.5] text-foreground-muted">
                Earn <b className="font-semibold text-foreground-secondary">$10</b> for every creator who joins — track clicks, conversions, and earnings here.
              </p>
            </div>
            <Link
              href="/pricing"
              className="mt-1 rounded-[10px] bg-[color:var(--color-action)] px-4 py-2.5 text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const earningsDollars = (earningsCents / 100).toFixed(2);
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";
  const stats: { label: string; value: string }[] = [
    { label: "Clicks", value: clicks.toLocaleString() },
    { label: "Conversions", value: conversions.toLocaleString() },
    { label: "Earnings", value: `$${earningsDollars}` },
    { label: "Conversion rate", value: `${conversionRate}%` },
  ];

  return (
    <div>
      {/* Referral link */}
      <section className="rounded-2xl bg-surface-sunken px-4 py-4">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Your referral link</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-foreground-secondary">
          Share it. When a creator signs up and subscribes, you earn{" "}
          <b className="font-semibold text-foreground">$10</b>.
        </p>
        <div className="elev-rest mt-3 flex items-center gap-2 rounded-[10px] border border-border bg-[color:var(--color-surface-thread)] p-2 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">{referralLink}</code>
          <CopyButton text={referralLink} label="Copy" />
        </div>
        <p className="mt-2 font-mono text-[9.5px] text-foreground-muted">
          Tip: drop it in your TikTok bio, or share with creator friends.
        </p>
      </section>

      {/* Performance */}
      <section className="mt-4 rounded-2xl bg-surface-sunken px-4 py-4">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Performance</h2>
        <div className="grid grid-cols-2 gap-[9px] lg:grid-cols-4">
          {stats.map((s) => (
            <PerfTile key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </section>
    </div>
  );
}
