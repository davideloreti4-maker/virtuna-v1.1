"use client";

/**
 * GrowView — the /grow "Grow your business" strategy dashboard (the business-coach
 * surface). Account+audience-grounded monetization guidance as CARDS, not a chat engine
 * (The Room owns the thread): monetization readiness · pre-tested offer ideas · a
 * pricing/funnel map. Every action is the one Seam-4 handoff (make/test in a thread).
 *
 * Honesty spine: readiness + each offer's "would buy" are DIRECTIONAL forecasts (grounded
 * in the creator's pillars / how their people tend to respond), labeled as such — NEVER
 * real sales. All data MOCK for v1.
 */

import { useMemo } from "react";
import { SURFACE_RADIAL_BG } from "@/components/surfaces/surface-canvas";
import { useToast } from "@/components/ui/toast";
import { getMockGrow, type Offer } from "@/lib/grow/mock-grow";
import { toneDot } from "@/components/surfaces/tone";
import { cn } from "@/lib/utils";

export function GrowView() {
  const { toast } = useToast();
  const data = useMemo(() => getMockGrow(), []);
  const readyCount = data.readiness.filter((r) => r.met).length;

  // Seam 4 — the one handoff (stubbed as the other surfaces stub it).
  const launch = (title: string, seed: string) =>
    toast({
      variant: "info",
      title,
      description: `“${seed}” — with your ${data.audienceName}. (Seam 4: create thread → /thread/:id.)`,
    });

  const makeOffer = (o: Offer) => launch("Make · launching the offer", `the launch for ${o.title}`);

  return (
    <div
      className="relative min-h-full text-foreground"
      style={{ background: SURFACE_RADIAL_BG }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        <header className="mb-5">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
            Grow your business
          </h1>
          <p className="mt-0.5 font-mono text-[10px] text-foreground-muted">
            turn your audience into income — pre-tested on your {data.audienceName}
          </p>
        </header>

        {/* Monetization readiness */}
        <section className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Monetization readiness
            </h2>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-foreground-muted">
              Directional
            </span>
          </div>
          <p className="mb-3 text-[12.5px] text-foreground-secondary">{data.readinessLine}</p>
          <ul className="flex flex-col gap-2.5">
            {data.readiness.map((r) => (
              <li key={r.id} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-[3px] grid size-[15px] shrink-0 place-items-center rounded-full border text-[9px]",
                    r.met ? "border-transparent text-[color:var(--color-background)]" : "border-border-hover text-foreground-muted",
                  )}
                  style={r.met ? { background: "#8ea68a" } : undefined}
                >
                  {r.met ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-foreground">{r.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-[1.5] text-foreground-muted">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
          {readyCount < data.readiness.length && (
            <button
              type="button"
              onClick={() => launch("Make · your first offer", "an offer my people would actually buy")}
              className="mt-4 w-full rounded-[10px] bg-[color:var(--color-action)] px-3 py-[11px] text-center text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90 sm:w-auto sm:px-5"
            >
              Build your first offer →
            </button>
          )}
        </section>

        {/* Offer ideas */}
        <section className="mt-7">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Offer ideas</h2>
            <span className="shrink-0 font-mono text-[9px] text-foreground-muted">
              a forecast from your people · not real sales
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.offers.map((o) => (
              <div key={o.id} className="flex flex-col rounded-xl border border-border bg-surface-elevated p-3.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-[5px] border border-border-hover px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    {o.price}
                  </span>
                  <span className="inline-flex rounded-[4px] border border-border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.04em] text-foreground-muted">
                    {o.pillarLabel}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-[12.5px] leading-[1.35] text-foreground">{o.title}</p>
                <div className="mt-2.5 flex items-center gap-[7px] text-[11px]">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: toneDot[o.tone] }} />
                  <b className="whitespace-nowrap font-semibold text-foreground">{o.wouldBuy}/10 would buy</b>
                  <span className="min-w-0 truncate text-foreground-muted">· “{o.lead}”</span>
                </div>
                <button
                  type="button"
                  onClick={() => makeOffer(o)}
                  className="mt-3 w-full rounded-[10px] border border-border px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
                >
                  Make the launch →
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing & funnel */}
        <section className="mt-7 rounded-xl border border-border bg-surface-elevated p-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Pricing &amp; funnel</h2>
          <div className="flex flex-wrap items-stretch gap-2">
            {data.funnel.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex min-w-[92px] flex-col rounded-lg border px-2.5 py-2",
                    step.filled
                      ? "border-border bg-[color:var(--color-surface-thread)]"
                      : "border-dashed border-border-hover",
                  )}
                >
                  <span className={cn("text-[12px] font-medium", step.filled ? "text-foreground" : "text-foreground-muted")}>
                    {step.label}
                  </span>
                  <span className="mt-0.5 font-mono text-[9px] text-foreground-muted">{step.sub}</span>
                </div>
                {i < data.funnel.length - 1 && (
                  <span aria-hidden className="text-foreground-muted">→</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-[1.5] text-foreground-secondary">{data.funnelGap}</p>
          <button
            type="button"
            onClick={() => launch("Make · the missing rung", "a $49–59 mid-tier offer between my guide and cohort")}
            className="mt-3 rounded-[10px] border border-border px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
          >
            Fill the gap →
          </button>
        </section>
      </div>
    </div>
  );
}
