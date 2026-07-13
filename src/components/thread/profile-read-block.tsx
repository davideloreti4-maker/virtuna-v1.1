'use client';

/**
 * ProfileReadBlockRenderer — the forensic behavioral READ hero card (PROF-02).
 *
 * Renders the validated ProfileReadBlock props ONLY (D-14 — no model-generated UI; this
 * component owns layout). Section order mirrors 05-UI-SPEC Surface 1:
 *   1. identity header (subjectName · subjectKind chip · SIM-1 model tag + Directional badge)
 *   2. behavioral tells, each with its verbatim `evidence` quote bound beneath (TRUST-02)
 *   3. how they'll react, under a neutral goalScope line (NEUTRAL panel — F-03, never coral)
 *   4. deeper forensic read — rendered ONLY when `forensic` is present (max/video tier, D-03);
 *      omitted entirely on flash (no teaser, F-01)
 *   5. honesty caveat — always visible (F-04)
 *   6. footer: SaveAffordance + the "Simulate a message to {name} →" forward-chain CTA
 *
 * Visual polish (final flat-warm token pass, spacing, disclosures) is a separate
 * `/gsd-ui-phase` task — this renderer ships functional-but-plain. It introduces NO coral
 * literal (reskin-matte guard stays green): band tones come from the sanctioned BAND_COLOR map.
 *
 * The forward-chain CTA reads `handoffsFor("profile")` (the chain-handoff SSOT) and POSTs
 * `buildSimulateRequest(block.props, draftedMessage)` to the handoff endpoint — the body's
 * `audienceId` is `block.props.savedAudienceId` (anchorFrom "card"). That mapping is the
 * load-bearing chain seam; it lives in the pure `buildSimulateRequest` helper below and is
 * unit-tested directly (Warning-1) rather than assumed by the manual UAT.
 */

import { useCallback, useState } from 'react';
import type { ProfileReadBlock } from '@/lib/tools/blocks';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CaretToggle } from './caret-toggle';
import { stripWrappingQuotes } from '@/lib/utils';

// Sanctioned deception-likelihood tones (band WORD only, never a number) — reuse the
// success/warning/error data tokens, NEVER the terracotta accent (F-01 / DESIGN-SYSTEM dosage).
const DECEPTION_COLOR: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'var(--color-success)',
  Medium: 'var(--color-warning)',
  High: 'var(--color-error)',
};

export interface ProfileReadBlockRendererProps {
  block: ProfileReadBlock;
}

/**
 * buildSimulateRequest — the load-bearing chain seam (Warning-1).
 *
 * Maps the profile-read card's `savedAudienceId` to the `/api/tools/simulate` request body
 * `audienceId` (anchorFrom "card"), pairing it with the user's drafted message. Pure +
 * exported so the seam is unit-testable without a React render.
 */
export function buildSimulateRequest(
  props: Pick<ProfileReadBlock['props'], 'savedAudienceId'>,
  message: string,
): { audienceId: string; message: string } {
  return { audienceId: props.savedAudienceId, message };
}

export function ProfileReadBlockRenderer({ block }: ProfileReadBlockRendererProps) {
  const {
    subjectName,
    subjectKind,
    identity,
    tells,
    howTheyReact,
    goalScope,
    forensic,
    caveat,
    savedAudienceId,
    model,
  } = block.props;

  const modelLabel = model === 'sim1-max' ? 'SIM-1 Max' : 'SIM-1 Flash';
  const isPanel = subjectKind === 'panel';

  // Forward-chain CTA — read from the chain-handoff SSOT (PROF-04). The profile→simulate
  // entry carries endpoint "/api/tools/simulate", anchorFrom "card".
  const simulateHandoff = handoffsFor('profile').find((h) => h.to === 'simulate');
  const ctaLabel = subjectName
    ? `Simulate a message to ${subjectName} →`
    : 'Simulate a message to them →';

  const [draftedMessage, setDraftedMessage] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  // Forensic disclosure — collapsed by default (F-01); the heaviest claims require a
  // deliberate open. Absent entirely on flash (the section is never rendered there).
  const [forensicOpen, setForensicOpen] = useState(false);

  const handleSimulate = useCallback(async () => {
    if (simulating || simulated || !simulateHandoff?.endpoint) return;
    setSimulating(true);
    setSimulateError(null);
    try {
      const res = await fetch(simulateHandoff.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // anchorFrom "card" — savedAudienceId → audienceId via the tested seam helper.
        body: JSON.stringify(buildSimulateRequest({ savedAudienceId }, draftedMessage)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Simulate request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Simulate request failed');
      }
      setSimulated(true);
    } catch (err) {
      setSimulateError(err instanceof Error ? err.message : 'Simulate error');
    } finally {
      setSimulating(false);
    }
  }, [simulating, simulated, simulateHandoff?.endpoint, savedAudienceId, draftedMessage]);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      aria-label={`A read on ${subjectName}`}
    >
      {/* 1. Identity header */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold text-foreground leading-snug">
              {subjectName}
            </h3>
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              {isPanel ? 'A read on this group' : 'A read on this person'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                color: 'var(--color-foreground-secondary)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              {subjectKind}
            </span>
            <span className="text-xs text-foreground-muted">{modelLabel}</span>
            <TrustBadge tier="Directional" />
          </div>
        </div>

        {/* Traits + comms style + drivers */}
        <div className="flex flex-wrap gap-1.5">
          {identity.traits.map((trait, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full text-foreground-secondary bg-white/[0.04]"
            >
              {trait}
            </span>
          ))}
        </div>
        {identity.commStyle && (
          <p className="text-sm text-foreground-secondary leading-relaxed">{identity.commStyle}</p>
        )}
        {identity.drivers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              What drives them
            </p>
            <ul className="flex flex-col gap-1">
              {identity.drivers.map((driver, i) => (
                <li key={i} className="text-sm text-foreground-secondary leading-relaxed">
                  {driver}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. Behavioral tells — each evidence-quoted (TRUST-02) */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          What gives them away
        </p>
        <ul className="flex flex-col gap-3">
          {tells.map((t, i) => (
            <li key={i} className="flex flex-col gap-1">
              <p className="text-sm text-foreground-secondary leading-relaxed">{t.tell}</p>
              <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
                &ldquo;{stripWrappingQuotes(t.evidence)}&rdquo;
              </blockquote>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. How they'll react (goal-scoped) — NEUTRAL panel (F-03, never coral) */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
          How they&rsquo;ll react
        </p>
        {goalScope && (
          <p className="text-xs text-foreground-muted">On your goal: {goalScope}</p>
        )}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2">
          <p className="text-sm font-semibold text-foreground leading-relaxed">{howTheyReact}</p>
        </div>
      </div>

      {/* 4. Deeper forensic read — max/video tier ONLY (D-03); omitted on flash */}
      {forensic && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setForensicOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
            aria-expanded={forensicOpen}
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              Deeper read (from the video)
            </span>
            <CaretToggle open={forensicOpen} className="text-foreground-muted" />
          </button>
          {forensicOpen && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground-secondary">
                Deception likelihood:{' '}
                <span
                  className="font-semibold"
                  style={{ color: DECEPTION_COLOR[forensic.deceptionLikelihood] }}
                >
                  {forensic.deceptionLikelihood}
                </span>
              </p>
              <ul className="flex flex-col gap-2">
                {forensic.cues.map((cue, i) => (
                  <li key={i} className="text-sm text-foreground-secondary leading-relaxed">
                    <span className="tabular-nums text-foreground-muted">{cue.timestamp}</span>
                    {' · '}
                    {cue.observation} → {cue.inference}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 5. Honesty caveat — always visible (F-04) */}
      <div className="px-4 py-3">
        <p className="text-xs text-foreground-muted leading-relaxed">{caveat}</p>
      </div>

      {/* 6. Footer — Save + forward-chain Simulate CTA */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <SaveAffordance item_type="read" title={subjectName} snapshot={block.props} />
        </div>
        {!simulated ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draftedMessage}
              onChange={(e) => setDraftedMessage(e.target.value)}
              placeholder={`Draft a message to ${subjectName}…`}
              rows={2}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
              aria-label="Drafted message to simulate"
            />
            <button
              type="button"
              onClick={() => void handleSimulate()}
              disabled={simulating || draftedMessage.trim().length === 0}
              className="self-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
              style={{
                color:
                  simulating || draftedMessage.trim().length === 0
                    ? 'rgba(236,231,222,0.5)'
                    : 'var(--color-foreground-secondary)',
                cursor: simulating ? 'wait' : 'pointer',
              }}
              aria-label={ctaLabel}
            >
              {simulating ? 'Simulating…' : ctaLabel}
            </button>
            {simulateError && (
              <p className="text-xs text-red-400" role="alert">
                {simulateError}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Reaction queued — check the thread below.
          </p>
        )}
      </div>
    </div>
  );
}
