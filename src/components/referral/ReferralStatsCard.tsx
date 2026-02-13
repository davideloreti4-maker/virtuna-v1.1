"use client";

interface ReferralStatsCardProps {
  clicks: number;
  conversions: number;
  earningsCents: number;
}

export function ReferralStatsCard({
  clicks,
  conversions,
  earningsCents,
}: ReferralStatsCardProps) {
  const earningsDollars = (earningsCents / 100).toFixed(2);
  const conversionRate =
    clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-[12px] border border-white/[0.06] p-6 space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Performance
        </h2>
        <p className="text-sm text-muted">
          Track your referral clicks, conversions, and earnings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-4">
          <div className="text-2xl font-bold text-foreground">{clicks}</div>
          <div className="text-xs text-muted mt-1">Total Clicks</div>
        </div>

        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-4">
          <div className="text-2xl font-bold text-foreground">
            {conversions}
          </div>
          <div className="text-xs text-muted mt-1">Conversions</div>
        </div>

        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-4">
          <div className="text-2xl font-bold text-coral">
            ${earningsDollars}
          </div>
          <div className="text-xs text-muted mt-1">Total Earnings</div>
        </div>

        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-4">
          <div className="text-2xl font-bold text-foreground">
            {conversionRate}%
          </div>
          <div className="text-xs text-muted mt-1">Conversion Rate</div>
        </div>
      </div>
    </div>
  );
}
