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
import { CaretToggle } from './caret-toggle';
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
  const { audienceName, audienceId, subjectKind, read, band, fraction, themes, reactions, model } =
    block.props;

  const modelLabel = model === 'sim1-max' ? 'SIM-1 Max' : 'SIM-1 Flash';
  const [drillOpen, setDrillOpen] = useState(false);

  const stopCount = reactions?.filter((r) => r.verdict === 'stop').length ?? 0;
  const total = reactions?.length ?? 0;

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
        {/* Provenance header (shared) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted">
            {audienceName}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-foreground-muted">{modelLabel}</span>
            <TrustBadge tier="Directional" />
          </div>
        </div>

        {/* ── PERSON variant — single read, NO fraction (Pitfall 2) ───────────── */}
        {subjectKind === 'person' && read && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-semibold text-foreground leading-snug">
              {audienceName} is likely to be {read.verdict}
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed">{read.reasoning}</p>
            <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
              &ldquo;{stripWrappingQuotes(read.quote)}&rdquo;
            </blockquote>
          </div>
        )}

        {/* ── PANEL variant — band + fraction + themes + drill ────────────────── */}
        {subjectKind === 'panel' && (
          <div className="flex flex-col gap-3">
            {/* Band word + fraction */}
            <div className="flex items-baseline gap-2">
              {band && (
                <span className="text-2xl font-semibold leading-none" style={{ color: BAND_COLOR[band] }}>
                  {band}
                </span>
              )}
              {fraction && <span className="text-sm text-foreground-muted">{fraction}</span>}
            </div>

            {/* Clustered themes — the panel's proof unit */}
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

            {/* Per-persona drill — collapsible */}
            {reactions && reactions.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setDrillOpen((v) => !v)}
                  className="flex items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
                  aria-expanded={drillOpen}
                >
                  <span className="text-xs text-foreground-muted">
                    Audience reactions — {stopCount}/{total} react
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                    <CaretToggle open={drillOpen} size={12} />
                    {drillOpen ? 'Hide' : 'Show'}
                  </span>
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

      {/* Footer — Save + forward-chain Predict CTA (panel-only, D-03/D-06) */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <SaveAffordance item_type="read" title={audienceName} snapshot={block.props} />
        </div>
        {canPredict &&
          (!predicted ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Describe an outcome to predict…"
                rows={2}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
                aria-label="Scenario to predict"
              />
              <button
                type="button"
                onClick={() => void handlePredict()}
                disabled={predicting || scenario.trim().length === 0}
                className="self-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
                style={{
                  color:
                    predicting || scenario.trim().length === 0
                      ? 'rgba(236,231,222,0.5)'
                      : 'var(--color-foreground-secondary)',
                  cursor: predicting ? 'wait' : 'pointer',
                }}
                aria-label="Predict an outcome →"
              >
                {predicting ? 'Predicting…' : 'Predict an outcome →'}
              </button>
              {predictError && (
                <p className="text-xs text-red-400" role="alert">
                  {predictError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Prediction queued — check the thread below.
            </p>
          ))}
      </div>
    </div>
  );
}
