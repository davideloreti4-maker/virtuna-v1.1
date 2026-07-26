"use client";

/**
 * S1 — the interactive walkthrough on `/go`.
 *
 * A WALKTHROUGH OF THE REAL PLATFORM, not a tour of a mockup (`ONBOARDING-FUNNEL-DESIGN.md` §4).
 * The visitor drives the real `AmbientDetail` — the same instrument they land on after paying —
 * and only the DATA is prefabricated. Two payoffs: a real surface is far more convincing than a
 * marketing replica, and after checkout they arrive on the screen they just used.
 *
 * Zero network after load. No video element either, so there is no autoplay policy to lose inside
 * a TikTok/Instagram webview (§2a) — the frames are stills and the curve is data.
 *
 * The wall is the load-bearing mechanic: what is locked is genuinely ABSENT from the rendered
 * template (`sealTemplate`), so `AmbientDetail` shows its own honest unavailable states. There is
 * no blur, no placeholder text, and nothing to "reveal" that was on screen all along.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { track } from "@/lib/analytics/funnel-events";
import { TRIAL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { beatAt, beatPosition, nextBeat, type BeatId } from "./beats";
import {
  CRAFT_SCORE,
  LOSS_MOMENT,
  REVEALED_INSIGHT,
  SEALED_INSIGHT,
  sealTemplate,
  WALKTHROUGH_IS_PLACEHOLDER,
  WALKTHROUGH_STIMULUS_KEY,
  WALKTHROUGH_TEMPLATE,
} from "./walkthrough-fixture";

/**
 * The honesty gate. While the fixture is placeholder data, the walkthrough must not render on a
 * commercial page in production — invented numbers are fabricated proof (§4). This is deliberately
 * a hard return, not a warning: a guard that only logs is a guard that ships.
 */
export function walkthroughEnabled(): boolean {
  return !(WALKTHROUGH_IS_PLACEHOLDER && process.env.NODE_ENV === "production");
}

// ── the guided rail dock ──────────────────────────────────────────────────────────────────────

function RailDock({
  kicker,
  headline,
  body,
  cta,
  step,
  total,
  onAdvance,
}: {
  kicker: string;
  headline: string;
  body: string;
  cta: string | null;
  step: number;
  total: number;
  onAdvance: () => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-[2px] flex-1 rounded-full transition-colors"
            style={{ background: i < step ? "#ece7de" : "rgba(255,255,255,0.10)" }}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        {kicker}
      </p>
      <h3 className="mt-2 font-serif text-[22px] leading-[1.2] tracking-tight text-balance">
        {headline}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground-secondary">{body}</p>

      {/* the ONE lit affordance — guided rails, never a free-roam surface */}
      {cta ? (
        <button
          type="button"
          onClick={onAdvance}
          className={cn(
            "mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg px-6",
            "bg-action text-[15px] font-semibold text-action-foreground",
            "transition-transform active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
          )}
        >
          {cta}
        </button>
      ) : null}
    </div>
  );
}

// ── the insight panels ────────────────────────────────────────────────────────────────────────

function InsightPanel({
  tone,
  moment,
  where,
  why,
  fix,
}: {
  tone: "revealed" | "unlocked";
  moment: string;
  where: string;
  why: string;
  fix: string;
}) {
  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "#262624",
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-accent-text">{moment}</span>
        <span className="text-[13px] text-foreground-secondary">{where}</span>
        {tone === "unlocked" ? (
          <span className="ml-auto text-[11px] uppercase tracking-[0.12em] text-foreground-muted">
            unlocked
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        Why
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed">{why}</p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        The fix
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed">{fix}</p>
    </div>
  );
}

/**
 * The wall. It states precisely what is missing and why, and shows the craft score it IS allowed
 * to show, so the panel reads as withheld rather than broken. No blur: there is nothing underneath
 * this element to blur — the data is not in the rendered template at all.
 */
function LockedPanel({ onCheckout }: { onCheckout: () => void }) {
  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{ borderColor: "rgba(255,255,255,0.10)", background: "#262624" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px] text-accent-text">{LOSS_MOMENT}</span>
        <span className="text-[13px] text-foreground-secondary">the steepest drop</span>
        <span className="ml-auto font-mono text-[13px] text-foreground-muted">
          craft {CRAFT_SCORE}
        </span>
      </div>

      <dl className="mt-3 space-y-2">
        {[
          ["Why they leave", "the diagnosis for this second"],
          ["The fix", "the specific move that recovers it"],
          ["Your audience's score", "what YOUR viewers would do, not the general population"],
        ].map(([term, desc]) => (
          <div key={term} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-[3px] text-[13px] text-foreground-muted">
              &#9679;
            </span>
            <div>
              <dt className="text-[14px] font-semibold">{term}</dt>
              <dd className="text-[13px] leading-relaxed text-foreground-muted">{desc}</dd>
            </div>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onCheckout}
        className={cn(
          "mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg px-6",
          "bg-action text-[15px] font-semibold text-action-foreground",
          "transition-transform active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
        )}
      >
        Unlock this — $1
      </button>

      {/* Both surprises stay visible. Burying either is how you earn chargebacks (§6.2). */}
      <p className="mt-2.5 text-center text-[12px] leading-relaxed text-foreground-muted">
        {TRIAL.microcopy}
      </p>
    </div>
  );
}

// ── the shell ─────────────────────────────────────────────────────────────────────────────────

export interface WalkthroughProps {
  /**
   * Opens checkout. Left injectable because the tripwire does not exist yet — Whop is unconfigured
   * and `/api/whop/checkout` answers 503 by design (`docs/WHOP-SETUP.md`). When it lands, the
   * webview branch (hosted page vs embed) is decided HERE, not inside the walkthrough.
   */
  onCheckout?: () => void;
  /** Start beat — tests and the dev harness drive the rail directly. */
  initialBeat?: BeatId;
}

export function Walkthrough({ onCheckout, initialBeat }: WalkthroughProps) {
  const [beatId, setBeatId] = useState<BeatId>(initialBeat ?? "frames");
  const beat = beatAt(beatId);
  const { step, total } = beatPosition(beatId);

  // The rendered template is DERIVED from the beat. Sealing is not a view flag on a component that
  // already has the data — the data is genuinely absent until the beat opens.
  const template = useMemo(() => sealTemplate(WALKTHROUGH_TEMPLATE, beat.seal), [beat.seal]);

  useEffect(() => {
    track(beat.event, { beat: beat.id, stimulus: WALKTHROUGH_STIMULUS_KEY });
  }, [beat.event, beat.id]);

  const advance = useCallback(() => {
    setBeatId((current) => nextBeat(current) ?? current);
  }, []);

  const handleCheckout = useCallback(() => {
    track("checkout_open", { beat: beatId, stimulus: WALKTHROUGH_STIMULUS_KEY });
    onCheckout?.();
  }, [beatId, onCheckout]);

  if (!walkthroughEnabled()) return null;

  return (
    <section
      aria-label="Interactive walkthrough"
      className="mx-auto w-full max-w-[420px] px-1 md:max-w-[460px]"
    >
      {/* The REAL instrument, hydrated from the frozen example.
          No `onBack` on purpose — there is no overview to go back to here, and a dead control is a
          way to drive off the road. `populationNote` matters just as much: the default copy for an
          absent audience is "no run yet", which at the wall would read as BROKEN rather than
          withheld, and an empty product undersells far worse than a locked one. */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
        <AmbientDetail
          template={template}
          populationNote={
            beat.seal === "sealed"
              ? "Your audience's score is what the dollar unlocks."
              : undefined
          }
        />
      </div>

      {beatId === "revealed" ? <InsightPanel tone="revealed" {...REVEALED_INSIGHT} /> : null}
      {beatId === "wall" ? <LockedPanel onCheckout={handleCheckout} /> : null}
      {beatId === "open" ? <InsightPanel tone="unlocked" {...SEALED_INSIGHT} /> : null}

      <RailDock
        kicker={beat.kicker}
        headline={beat.headline}
        body={beat.body}
        cta={beat.cta}
        step={step}
        total={total}
        onAdvance={advance}
      />
    </section>
  );
}
