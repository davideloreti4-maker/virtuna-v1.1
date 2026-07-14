"use client";

/**
 * AudienceReads — what this audience has actually SAID (SPEC-2026-07-13 P2, the UI half).
 *
 * Two panels, both fed by `GET /api/audiences/[id]/rollup`:
 *   - "What they've said"   — each persona's LATEST real reaction (verdict + their own sentence)
 *   - "Where they split"    — the Reads where YOUR people wanted something different from the
 *                             generic crowd
 *
 * ── Three rules this component exists to honour ──────────────────────────────────────
 *
 * 1. COUNT PEOPLE, NOT BANDS. The spec's original divergence metric compared the two overall
 *    bands. It would have shipped a panel that LIES. A band aggregates 10 persona verdicts, so
 *    offsetting flips cancel. Measured live over 10 concepts against the scrape-calibrated
 *    "Zach King" audience (scripts/measure-divergence.ts, 2026-07-14):
 *
 *        bands moved on      1/10 Reads
 *        personas diverged   8/10 Reads   ← all 8 reproduced on an independent re-run
 *
 *    A band-only panel would have told the user "your audience agrees with the generic crowd"
 *    nine times out of ten, while their people were plainly disagreeing. This panel is built on
 *    `personaFlips`, and `diverged` (the band count) is never shown as the headline.
 *
 * 2. THE EMPTY STATE IS THE MAIN STATE. A real user has `reads: 0` — the 7 legacy blocks in the
 *    DB are excluded by design (they predate #281, when both sides ran the identical prompt, so
 *    their "agreement" is an artifact of a bug). "Nothing yet" must never render as a confident
 *    "0 disagreements" — an absence of evidence is not evidence of agreement.
 *
 * 3. SAY WHAT WAS EXCLUDED, OUT LOUD. `legacyUnattributed` and `scanCapped` are surfaced, not
 *    swallowed. A panel that quietly under-reports looks exactly like a panel with nothing to
 *    report.
 *
 * Honesty spine (F3): bands only — Strong | Mixed | Weak, and stop/scroll. No numeric score is
 * rendered, and none is derivable from what the endpoint returns.
 */

import { useEffect, useState } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import type { AudienceReadRollup } from "@/lib/audience/read-rollup";
import { archetypeDerivedName } from "./persona-edit-form";
import { isCustomAudience } from "./audience-display";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-white/[0.06] bg-surface";

/** Band → the tone it carries. Cream-only; the accent budget on this surface is spent elsewhere. */
const BAND_TONE: Record<string, string> = {
  Strong: "text-foreground",
  Mixed: "text-foreground-secondary",
  Weak: "text-foreground-muted",
};

function SectionHeading({
  title,
  note,
  description,
}: {
  title: string;
  note?: string;
  description: string;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {note && <span className="text-[11px] text-foreground-muted">{note}</span>}
      </div>
      <p className="mt-1 text-[12.5px] text-foreground-secondary">{description}</p>
    </div>
  );
}

/** A persona's verdict, in the user's language rather than the schema's. */
function VerdictPill({ verdict }: { verdict: "stop" | "scroll" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-0.5 text-[11px]",
        verdict === "stop"
          ? "border-white/[0.10] bg-white/[0.05] text-foreground"
          : "border-white/[0.06] text-foreground-muted",
      )}
    >
      {verdict === "stop" ? "Stopped" : "Scrolled"}
    </span>
  );
}

export interface AudienceReadsProps {
  audience: Audience;
  className?: string;
}

/**
 * The fetch result, TAGGED WITH THE ID IT BELONGS TO.
 *
 * Loading is derived (`result.forId !== audience.id`) rather than stored, so the effect never
 * calls setState synchronously in its own body — that triggers a cascading render, and eslint's
 * react-hooks/set-state-in-effect rejects it. Tagging also makes a late response for a PREVIOUS
 * audience impossible to render against the current one.
 */
interface RollupResult {
  forId: string;
  rollup: AudienceReadRollup | null;
  failed: boolean;
}

export function AudienceReads({ audience, className }: AudienceReadsProps) {
  const [result, setResult] = useState<RollupResult | null>(null);

  useEffect(() => {
    let live = true;

    fetch(`/api/audiences/${audience.id}/rollup`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ rollup: AudienceReadRollup }>;
      })
      .then((data) => {
        if (live) setResult({ forId: audience.id, rollup: data.rollup, failed: false });
      })
      .catch(() => {
        // Fail LOUD, not empty. Rendering the empty state on a failed fetch would claim
        // "no Reads yet" about an audience that may have plenty — the exact lie this
        // subsystem keeps shipping.
        if (live) setResult({ forId: audience.id, rollup: null, failed: true });
      });

    return () => {
      live = false;
    };
  }, [audience.id]);

  const settled = result?.forId === audience.id ? result : null;
  const loading = settled === null;
  const failed = settled?.failed ?? false;
  const rollup = settled?.rollup ?? null;

  /** archetype → the name this user sees in "The cast" above. Keeps one vocabulary on the page. */
  const nameOf = (archetype: string): string => {
    const p = audience.personas.find((x) => x.archetype === archetype);
    return p?.label ?? archetypeDerivedName(archetype);
  };

  if (loading) {
    return (
      <section className={className}>
        <SectionHeading
          title="What they've said"
          description="Each persona's most recent reaction, in their own words."
        />
        <div className={cn(CARD, "px-5 py-8")}>
          <p className="text-[12.5px] text-foreground-muted">Loading their reactions…</p>
        </div>
      </section>
    );
  }

  if (failed || !rollup) {
    return (
      <section className={className}>
        <SectionHeading
          title="What they've said"
          description="Each persona's most recent reaction, in their own words."
        />
        <div className={cn(CARD, "px-5 py-8")}>
          <p className="text-[12.5px] text-foreground-secondary">
            Couldn&apos;t load their reactions. This says nothing about whether they have any —
            reload to try again.
          </p>
        </div>
      </section>
    );
  }

  const custom = isCustomAudience(audience);
  const hasReads = rollup.reads > 0;

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* ── What they've said ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="What they've said"
          note={hasReads ? `${rollup.reads} Read${rollup.reads === 1 ? "" : "s"}` : undefined}
          description="Each persona's most recent reaction from your Reads — their sentence, not a summary."
        />

        {!hasReads ? (
          // THE MAIN STATE (rule 2). Never phrase an absence as a finding.
          <div className={cn(CARD, "px-5 py-8 text-center")}>
            <p className="text-[13px] text-foreground-secondary">
              Nothing yet. Run a Read and each of these people reacts to it — you&apos;ll see who
              stopped, who scrolled, and why, in their own words.
            </p>
            {rollup.legacyUnattributed > 0 && (
              <p className="mx-auto mt-3 max-w-md text-[11.5px] leading-relaxed text-foreground-muted">
                {rollup.legacyUnattributed} earlier Read
                {rollup.legacyUnattributed === 1 ? "" : "s"} exist but predate per-audience
                attribution, so {rollup.legacyUnattributed === 1 ? "it isn't" : "they aren't"}{" "}
                counted here rather than guessed at.
              </p>
            )}
          </div>
        ) : (
          <div className={cn(CARD, "px-5 py-1")}>
            {rollup.personas.map((p) => (
              <div
                key={p.archetype}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-white/[0.06] py-3.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-foreground">{nameOf(p.archetype)}</p>
                  <p className="mt-1 border-l-2 border-white/[0.10] pl-2.5 text-[12.5px] leading-relaxed text-foreground-secondary">
                    &ldquo;{p.quote}&rdquo;
                  </p>
                </div>
                <VerdictPill verdict={p.verdict} />
              </div>
            ))}
          </div>
        )}

        {rollup.scanCapped && (
          <p className="mt-2.5 text-[11.5px] text-foreground-muted">
            Showing the most recent {rollup.scanned} messages — older Reads exist beyond this
            window.
          </p>
        )}
      </section>

      {/* ── Where they split from the crowd ───────────────────────────────── */}
      <section>
        <SectionHeading
          title="Where they split from the crowd"
          note={
            rollup.compared > 0
              ? `${rollup.personaDiverged} of ${rollup.compared}`
              : undefined
          }
          description="Reads where at least one of your people wanted something different from the generic crowd."
        />

        {custom ? (
          <div className={cn(CARD, "px-5 py-8 text-center")}>
            <p className="text-[13px] text-foreground-secondary">
              A custom audience is judged on its own — there&apos;s no generic crowd to compare it
              against.
            </p>
          </div>
        ) : rollup.compared === 0 ? (
          <div className={cn(CARD, "px-5 py-8 text-center")}>
            <p className="text-[13px] text-foreground-secondary">
              Nothing compared yet. Every social Read scores your concept against these people{" "}
              <em>and</em> the generic crowd — the gap between them lands here.
            </p>
          </div>
        ) : (
          <>
            <div className={cn(CARD, "px-5 py-1")}>
              {rollup.cases.map((c, i) => (
                <div key={`${c.at}-${i}`} className="border-b border-white/[0.06] py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
                      {c.concept ?? (
                        <span className="text-foreground-muted">
                          (concept not recorded — this Read predates it)
                        </span>
                      )}
                    </p>
                    {/*
                      The tag has to carry the insight, not leave the reader to spot it. The
                      interesting case is the MIDDLE one: the two bands matched, and underneath
                      them people still swapped sides. Live example (2026-07-14): "I froze a
                      waterfall mid-air" landed Strong for BOTH audiences while Tough Crowd and
                      Niche Deep Buyer traded places. Labelling that "same verdict" and stopping
                      there is how the band panel lies — so name it.
                    */}
                    <span className="shrink-0 text-[11px] text-foreground-muted">
                      {c.mine.band !== c.other.band
                        ? "verdict moved"
                        : c.personaFlips.length > 0
                          ? "same verdict, different people"
                          : "agreed"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span className="text-foreground-secondary">
                      {c.mine.name}{" "}
                      <span className={cn("font-medium", BAND_TONE[c.mine.band])}>
                        {c.mine.band}
                      </span>
                    </span>
                    <span className="text-white/20">vs</span>
                    <span className="text-foreground-secondary">
                      {c.other.name}{" "}
                      <span className={cn("font-medium", BAND_TONE[c.other.band])}>
                        {c.other.band}
                      </span>
                    </span>
                  </div>

                  {c.personaFlips.length > 0 ? (
                    <ul className="mt-2.5 flex flex-col gap-1">
                      {c.personaFlips.map((f) => (
                        <li
                          key={f.archetype}
                          className="text-[12px] leading-relaxed text-foreground-secondary"
                        >
                          <span className="text-foreground">{nameOf(f.archetype)}</span>{" "}
                          {f.mine === "stop" ? "stopped" : "scrolled past"} for you, but{" "}
                          {f.other === "stop" ? "stopped" : "scrolled past"} for {c.other.name}.
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2.5 text-[12px] text-foreground-muted">
                      Everyone reacted the same way for both.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/*
              The honesty line, and the whole reason this panel counts people instead of bands.
              Measured: bands moved on 1/10 Reads while personas diverged on 8/10. Leading with
              the band count would have told the user their audience agrees with the crowd, on
              Reads where their people plainly did not.
            */}
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-foreground-muted">
              <span className="text-foreground-secondary">Counted by people, not verdicts.</span>{" "}
              The overall verdict matched on {rollup.compared - rollup.diverged} of{" "}
              {rollup.compared} — but a matching verdict hides people swapping places underneath
              it, so we count the people who changed their minds.
            </p>

            {rollup.legacyUnattributed > 0 && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground-muted">
                {rollup.legacyUnattributed} earlier Read
                {rollup.legacyUnattributed === 1 ? "" : "s"} can&apos;t be attributed to an
                audience and{" "}
                {rollup.legacyUnattributed === 1 ? "is excluded" : "are excluded"} from these
                counts.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
