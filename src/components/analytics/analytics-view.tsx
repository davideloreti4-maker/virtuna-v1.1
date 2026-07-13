"use client";

/**
 * AnalyticsView — the "Your account" analytics band, shell-less. Account metrics over
 * 7 / 30 / 90 days + a "what to do next" recommendations block + content mix. Mounted at
 * the foot of the /audience surface (folded in from the retired /grow "Numbers" tab); the
 * host surface owns the radial shell + header, this renders the band content only.
 *
 * Honesty spine: the metrics are REAL, derived from the connected account's
 * account_snapshots time-series (`buildRangeMetrics`) — deltas are honestly "—" until
 * the daily history is deep enough, never a fabricated trend; no snapshots → an honest
 * connect state. Recommendations are TAGGED by grounding ("From your numbers" vs
 * "Directional"); each carries a Seam-4 action.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import { buildRangeMetrics } from "@/lib/account-metrics/account-metrics";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { buildRecommendations } from "@/lib/analytics/recommendations";
import { SurfaceIcon } from "@/components/surfaces/icons";
import { ContentPillars } from "@/components/surfaces/sections/content-pillars";
import { ConnectAccountDialog } from "@/components/connected-accounts/connect-account-dialog";
import type { AccountOption } from "@/components/audience/audience-manager";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const PLATFORM_LABEL: Record<AccountOption["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function Sparkline({ points, up }: { points: string; up: boolean }) {
  const arr = points.split(" ").map((p) => p.split(",").map(Number));
  const first = arr[0] ?? [0, 18];
  const last = arr[arr.length - 1] ?? [72, 18];
  const color = up ? "var(--color-positive)" : "var(--color-foreground-muted)";
  const area = `M${first[0]},18 L${arr.map((p) => `${p[0]},${p[1]}`).join(" L")} L${last[0]},18 Z`;
  return (
    <svg viewBox="0 0 72 18" preserveAspectRatio="none" className="mt-2.5 h-[22px] w-full">
      <path d={area} fill={color} opacity={0.09} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AnalyticsView({
  snapshots,
  pillars,
  accounts = [],
  selectedAccountId,
}: {
  snapshots: AccountSnapshot[];
  pillars: Pillar[];
  accounts?: AccountOption[];
  selectedAccountId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [range, setRange] = useState<number>(7);
  const [connectOpen, setConnectOpen] = useState(false);

  const selectAccount = (id: string) =>
    router.push(`/audience?tab=account&account=${id}`);

  // The selected account's platform drives honest per-platform tiles (Subscribers/Videos for
  // YouTube, no fake Likes for IG/YT). Falls back to tiktok when the roster isn't threaded.
  const selectedPlatform =
    accounts.find((a) => a.id === selectedAccountId)?.platform ?? accounts[0]?.platform ?? "tiktok";
  const metrics = useMemo(
    () => buildRangeMetrics(snapshots, range, selectedPlatform),
    [snapshots, range, selectedPlatform],
  );
  const recommendations = useMemo(() => buildRecommendations(pillars, metrics), [pillars, metrics]);
  const rangeLabel = RANGES.find((r) => r.days === range)!.label;
  const points = metrics?.[0]?.points ?? 0;

  const onRec = (rec: (typeof recommendations)[number]) => {
    if (rec.action === "plan") {
      router.push("/calendar");
      return;
    }
    toast({
      variant: "info",
      title: "Make · launching a thread",
      description: `${rec.seed ? `“${rec.seed}”` : rec.title} — with your people. (Seam 4: create thread → /thread/:id.)`,
    });
  };

  // Tapping a pillar in the content-mix zone → the one Seam-4 handoff (Make for that theme),
  // mirroring the recommendations' make action.
  const onPillar = (p: Pillar) =>
    toast({
      variant: "info",
      title: "Make · launching a thread",
      description: `an idea for your “${p.name}” pillar — with your people. (Seam 4: create thread → /thread/:id.)`,
    });

  return (
    <div>
      {/* Account switcher — one chip per connected account (the switch that makes the
          multi-account collision fix visible) + a "Connect" affordance. Only shown once
          there's at least one connected account; below the roster the switch is the point. */}
      {accounts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface-elevated p-0.5" role="tablist" aria-label="Connected account">
            {accounts.map((a) => {
              const active = a.id === selectedAccountId;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => !active && selectAccount(a.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                      : "text-foreground-secondary hover:text-foreground",
                  )}
                >
                  @{a.handle}
                  <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.06em] opacity-70">
                    {PLATFORM_LABEL[a.platform]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
          >
            <Plus weight="bold" className="h-3.5 w-3.5" />
            Connect
          </button>
        </div>
      )}

      {/* Zone · the numbers — real account metrics over the selected range */}
      <section className="rounded-2xl bg-surface-sunken px-4 py-4">
        <div className="mb-3.5 flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface-elevated p-0.5" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                role="tab"
                aria-selected={range === r.days}
                onClick={() => setRange(r.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                  range === r.days
                    ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                    : "text-foreground-secondary hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {metrics ? (
          <>
            <div className="grid grid-cols-2 gap-[9px] lg:grid-cols-4">
              {metrics.map((m) => {
                // No weekly delta yet (not enough daily history) → a clean point-in-time
                // number instead of a flat empty sparkline + a bare "—" (mirrors StatRow).
                const hasTrend = m.value !== "—" && m.delta !== "—";
                return (
                  <div key={m.key} className="elev-rest flex flex-col rounded-xl border border-border bg-surface-elevated px-[13px] py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-medium text-foreground-secondary">{m.label}</span>
                      {hasTrend && (
                        <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-foreground-muted">{rangeLabel}</span>
                      )}
                    </div>
                    <div className="mt-[7px] text-[23px] font-semibold leading-none tracking-[-0.02em] text-foreground [font-variant-numeric:tabular-nums]">
                      {m.value}
                    </div>
                    {hasTrend && (
                      <>
                        <Sparkline points={m.spark} up={m.up} />
                        <div className="mt-[7px] flex items-center gap-1 font-mono text-[9px]" style={{ color: m.up ? "var(--color-positive)" : "var(--color-foreground-muted)" }}>
                          {m.up && <SurfaceIcon name="up" size={9} strokeWidth={2} />}
                          {m.deltaPct ?? m.delta}
                          {m.deltaPct && m.delta !== "—" && <span className="text-foreground-muted">· {m.delta}</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 px-1 font-mono text-[9.5px] leading-[1.5] text-foreground-muted">
              {points >= 2
                ? `Real from your connected account, ${points} day${points === 1 ? "" : "s"} of history this range. Deeper trends sharpen as the daily capture builds.`
                : "Real totals from your connected account — not enough daily history yet for a trend, so deltas read “—” until it builds."}
            </p>
          </>
        ) : (
          <SurfaceEmptyState
            compact
            icon={
              <span className="text-foreground-muted" aria-hidden>
                <SurfaceIcon name="up" size={20} strokeWidth={1.6} />
              </span>
            }
            title="No account numbers yet"
            action={
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="rounded-[10px] bg-[color:var(--color-action)] px-4 py-2.5 text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
              >
                Connect your account →
              </button>
            }
          >
            Connect your account and your followers, likes, posts, and views land here — real, tracked daily. We never show made-up analytics.
          </SurfaceEmptyState>
        )}
      </section>

      {recommendations.length > 0 && (
        <section className="mt-4 rounded-2xl bg-surface-sunken px-4 py-4">
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">What to do next</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="elev-rest flex flex-col rounded-xl border border-border bg-surface-elevated p-3.5">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h3 className="m-0 text-[13px] font-semibold leading-[1.3] text-foreground">{rec.title}</h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-[4px] border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.05em]",
                      rec.tag === "From your numbers"
                        ? "border-border-hover text-foreground-secondary"
                        : "border-border text-foreground-muted",
                    )}
                  >
                    {rec.tag === "From your numbers" ? "your numbers" : "Directional"}
                  </span>
                </div>
                <p className="flex-1 text-[11.5px] leading-[1.5] text-foreground-secondary">{rec.rationale}</p>
                <button
                  type="button"
                  onClick={() => onRec(rec)}
                  className="mt-3 w-full rounded-[10px] border border-border px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
                >
                  {rec.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content mix — the creator's recurring themes (share is Directional, labeled as such).
          Ties the Numbers tab to the recurring pillar system + gives the page a real footer. */}
      <div className="mt-4">
        <ContentPillars pillars={pillars} onPillar={onPillar} />
      </div>

      <ConnectAccountDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}
