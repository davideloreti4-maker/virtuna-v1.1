'use client';

/**
 * ReactionDistributionBlockRenderer — the Simulate result card (SIMU-02).
 *
 * Branches the WHOLE layout on `subjectKind` (F-02 / D-02 — the honesty line):
 *   - person → a SINGLE read (verdict + reasoning + one quote). NO fraction, NO crowd, NO
 *     glyph grid — a single human has no honest distribution (Pitfall 2).
 *   - panel  → band WORD + fraction (from aggregateFlash, never re-rolled) + clustered themes
 *     + a collapsible per-persona reactions drill.
 *
 * Renders validated props ONLY (D-14). Bands/words only — ZERO 0-100 number (the `.strict()`
 * schema enforces it; the UI must not invent a meter or gauge). Introduces NO accent-tone
 * literal (reskin-matte guard stays green): band tones come from the sanctioned BAND_COLOR map.
 *
 * Visual polish (final flat-warm token pass, spacing) is a separate `/gsd-ui-phase` task —
 * this renderer ships functional-but-plain.
 */

import { useCallback, useState } from 'react';
import type { ReactionDistributionBlock } from '@/lib/tools/blocks';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction } from './card-primitives';
import { CaretToggle } from './caret-toggle';
import { ProofUnit } from './proof-unit';
import { stripWrappingQuotes } from '@/lib/utils';
// Sanctioned band tones (data colors, NOT the terracotta accent). band-block.tsx exports this map
// FOR reuse and every other card imports it; this file used to re-declare a byte-identical local
// copy under a comment that said "reuse the band-block map". Two maps, one meaning — they only ever
// drift apart silently.
import { BAND_COLOR } from './band-block';

export interface ReactionDistributionBlockRendererProps {
  block: ReactionDistributionBlock;
}

export function ReactionDistributionBlockRenderer({
  block,
}: ReactionDistributionBlockRendererProps) {
  const {
    audienceName,
    audienceId,
    subjectKind,
    read,
    band,
    fraction,
    themes,
    reactions,
    model,
    stimulus,
  } = block.props;

  const modelLabel = model === 'sim1-max' ? 'SIM-1 Max' : 'SIM-1 Flash';
  const [drillOpen, setDrillOpen] = useState(false);

  // The room's own reactions ARE FlatPersonaReaction[] — {archetype, verdict, quote}, the exact
  // shape the Lens consumes. Simulate is the ONE card that carries real per-persona reactions
  // (the four text cards synthesize positional placeholders via cardScrollQuoteReactions because
  // they have none), so it can open the Lens on the actual people who reacted.
  const flatPersonas = reactions ?? [];

  // The Lens door only opens on a real concept. No carried stimulus (an image/video simulate, or
  // a block persisted before `stimulus` existed) ⇒ no door, rather than a door onto nothing.
  const canOpenRoom = !!stimulus && flatPersonas.length > 0;

  // ── Predict chain CTA (PRED-01 / D-06) — read from the chain-handoff SSOT. ──────
  // Rendered ONLY for a PANEL simulate that carries its audienceId (D-03 — predicting
  // from a person simulate is nonsensical; back-compat blocks without audienceId omit it).
  // Mirrors profile-read-block.tsx's fetch+state pattern: POST { audienceId, scenario }
  // to /api/tools/predict; on success the prediction-gauge lands in the SAME open thread.
  const predictHandoff = handoffsFor('simulate').find((h) => h.to === 'predict');
  const canPredict =
    subjectKind === 'panel' && !!audienceId && !!predictHandoff?.endpoint;

  const [scenario, setScenario] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [predicted, setPredicted] = useState(false);

  const handlePredict = useCallback(async () => {
    if (predicting || predicted || !audienceId || !predictHandoff?.endpoint) return;
    setPredicting(true);
    setPredictError(null);
    try {
      const res = await fetch(predictHandoff.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // anchorFrom "card" — the panel audienceId + the user's scenario.
        body: JSON.stringify({ audienceId, scenario }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Predict request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Predict request failed');
      }
      setPredicted(true);
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : 'Predict error');
    } finally {
      setPredicting(false);
    }
  }, [predicting, predicted, audienceId, predictHandoff?.endpoint, scenario]);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      aria-label={`Reaction from ${audienceName}`}
    >
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {/* Eyebrow — the audience kicker (band-colored dot) + ONE meta item right: the trust tier.
            The model tag used to live here too; §0.5.1 is explicit that provenance does NOT go in
            the eyebrow, so it is demoted onto the disclosure line below (§0.5.6). */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted">
            {band && (
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: BAND_COLOR[band] }}
                aria-hidden="true"
              />
            )}
            {audienceName}
          </span>
          <TrustBadge tier="Directional" />
        </div>

        {/* ── PERSON variant — single read, NO fraction (Pitfall 2) ───────────── */}
        {subjectKind === 'person' && read && (
          <div className="flex flex-col gap-2">
            {/* The hero — a sentence, at the contract's 17px (it shipped at 15px). */}
            <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {audienceName} is likely to be {read.verdict}
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed">{read.reasoning}</p>
            <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
              &ldquo;{stripWrappingQuotes(read.quote)}&rdquo;
            </blockquote>
            {/* Provenance, demoted out of the eyebrow. A person read has no drill to hang it on
                (one human has no distribution to disclose), so it lands here as the footnote it
                is — never a headline (§0.5.6). */}
            <p className="text-[12.5px] text-foreground-muted/70">{modelLabel}</p>
          </div>
        )}

        {/* ── PANEL variant — proof unit + themes + drill ─────────────────────── */}
        {subjectKind === 'panel' && (
          <div className="flex flex-col gap-3">
            {/* THE proof unit — band + fraction (stated ONCE) + the real room behind it.
                This card used to print the fraction TWICE from TWO SOURCES: `fraction` here
                (from aggregateFlash, which the schema says must never be re-rolled) and, on the
                drill toggle below, a client-side recount of `reactions` — `{stopCount}/{total}`.
                They can disagree: a salvaged/dropped persona, or any re-roll, and the card shows
                8/10 up top and 7/10 below. On the one surface whose entire job is to be believed.
                The recount is gone; the engine's fraction is the single stated number. (§1.3)

                It also gives Simulate the Lens door it never had — on the card whose entire
                subject IS the room. And unlike the text cards, the personas here are REAL. */}
            {band && fraction ? (
              canOpenRoom ? (
                <ProofUnit
                  band={band}
                  fraction={fraction}
                  // The engine's own word ("N/10 react"), not the shared primitive's default
                  // "stopped". A Simulate panel can run in `mode: 'general'`, which the runner is
                  // explicit must NOT be asked the FYP stop-or-scroll question (MODE-01) — so
                  // "stopped" would be a claim this run never made.
                  verb="react"
                  flatPersonas={flatPersonas}
                  conceptText={stimulus!}
                  label="See how the room reacted"
                />
              ) : (
                // Honest degrade — no carried stimulus (image/video simulate, or a block persisted
                // before `stimulus` existed) ⇒ the band row without a Lens door onto nothing.
                <div className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 font-semibold"
                    style={{ color: BAND_COLOR[band] }}
                  >
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ backgroundColor: BAND_COLOR[band] }}
                      aria-hidden="true"
                    />
                    {band}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {fraction}
                  </span>
                </div>
              )
            ) : null}

            {/* Clustered themes — what the room actually converged on. */}
            {themes && themes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {themes.map((theme, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                    <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
                      &ldquo;{stripWrappingQuotes(theme.quote)}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            )}

            {/* Per-persona drill — the ONE disclosure, with provenance demoted onto its line
                (§0.5.6: provenance is a footnote, never a headline — it used to sit in the
                eyebrow). The toggle states NO count: the fraction is stated once, above. */}
            {reactions && reactions.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setDrillOpen((v) => !v)}
                  className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
                  aria-expanded={drillOpen}
                >
                  <CaretToggle open={drillOpen} size={12} />
                  {drillOpen ? 'Hide details' : 'Why & details'}
                  <span className="text-foreground-muted/70">· {modelLabel}</span>
                </button>
                {drillOpen && (
                  <ul className="flex flex-col gap-2">
                    {reactions.map((r, i) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground capitalize">
                            {r.archetype}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              color:
                                r.verdict === 'stop'
                                  ? 'var(--color-success)'
                                  : 'var(--color-foreground-muted)',
                              backgroundColor: 'var(--color-surface-elevated)',
                            }}
                          >
                            {r.verdict}
                          </span>
                        </div>
                        <blockquote className="text-sm italic text-foreground/70 leading-relaxed">
                          &ldquo;{stripWrappingQuotes(r.quote)}&rdquo;
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer. The scenario field is an INPUT, not an action — it sits above the bar, and the
          bar itself is ONE row: the forward chain step as the cream primary, Save as an ml-auto
          icon (§0.5.7). It used to be two stacked rows — Save alone in the first, then a textarea
          and a text-LINK "Predict an outcome →" — so the card's forward step read as less
          important than Save, and there was no cream primary at all. */}
      {canPredict && !predicted && (
        <div className="border-t border-white/[0.06] px-4 pt-3">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Describe an outcome to predict…"
            rows={2}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
            aria-label="Scenario to predict"
          />
          {predictError && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-error)' }} role="alert">
              {predictError}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        {canPredict &&
          (!predicted ? (
            <CardPrimaryAction
              onClick={() => void handlePredict()}
              disabled={predicting || scenario.trim().length === 0}
              aria-label="Predict an outcome →"
              title={
                scenario.trim().length === 0
                  ? 'Describe an outcome first'
                  : 'Predict this outcome with the same audience'
              }
            >
              {predicting ? 'Predicting…' : 'Predict an outcome →'}
            </CardPrimaryAction>
          ) : (
            <p className="text-sm text-foreground-muted">
              Prediction queued — check the thread below.
            </p>
          ))}
        <SaveAffordance
          className="ml-auto"
          item_type="read"
          title={audienceName}
          snapshot={block.props}
        />
      </div>
    </div>
  );
}
