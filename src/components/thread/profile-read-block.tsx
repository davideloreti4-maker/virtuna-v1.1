'use client';

/**
 * ProfileReadBlockRenderer — the forensic behavioral READ hero card (PROF-02).
 *
 * Renders the validated ProfileReadBlock props ONLY (D-14 — no model-generated UI; this
 * component owns layout).
 *
 * Speaks the hook-card language (2026-07-13). It shipped "functional-but-plain" with the
 * visual pass deferred to a `/gsd-ui-phase` that never ran, and the plainness had a specific
 * shape: FIVE uppercase section labels stacked at identical weight, so nothing led and the
 * card read as a spec sheet. The order now carries hierarchy:
 *   1. eyebrow (what kind of read) + Directional tier — model tag demoted to the disclosure
 *   2. identity: name + the one-line communication style, then trait chips
 *   3. HOW THEY'LL REACT — promoted to the top, in the neutral panel (F-03, never accent).
 *      This is the sentence the read exists to produce; it used to sit third at equal weight
 *   4. behavioral tells, each bound to its verbatim (TRUST-02) — the evidence spine, on the
 *      face, because a read you cannot check is only an assertion
 *   5. ONE disclosure — drivers + the forensic read (max/video tier, D-03; still a deliberate
 *      open per F-01, absent entirely on flash)
 *   6. the honesty caveat — ALWAYS visible (F-04), never behind the disclosure
 *   7. one action bar: cream primary (profile→simulate) + icon Save, like every other card
 *
 * NO coral literal (reskin-matte guard stays green); deception tones come from the sanctioned
 * success/warning/error data tokens.
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
import { CardPrimaryAction } from './card-primitives';
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
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`A read on ${subjectName}`}
    >
      {/* FACE — who they are, and the one thing you came for. */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Eyebrow — what kind of read this is. The tier badge is the only thing that earns
            the right rail; the model tag moves down to the disclosure line (hook-card rule:
            provenance is a footnote, not a headline). */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            <span className="h-[6px] w-[6px] rounded-full bg-foreground-muted/60" aria-hidden="true" />
            {isPanel ? 'A read on this group' : 'A read on this person'}
          </span>
          <TrustBadge tier="Directional" />
        </div>

        {/* Identity — the name leads, the communication style reads directly beneath it as the
            one-line characterisation. Together they answer "who am I dealing with". */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {subjectName}
          </p>
          {identity.commStyle && (
            <p className="text-[13px] leading-relaxed text-foreground-secondary">
              {identity.commStyle}
            </p>
          )}
        </div>

        {identity.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {identity.traits.map((trait, i) => (
              <span
                key={i}
                className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] text-foreground-secondary"
              >
                {trait}
              </span>
            ))}
          </div>
        )}

        {/* THE PAYOFF — promoted to sit directly under the identity. This is the actionable
            sentence the whole read exists to produce ("how will this land on them"), and it
            used to sit third, below two label-stacked sections, at the same visual weight as
            everything else. Neutral panel (F-03 — never accent). */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
          <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            How they&rsquo;ll react
          </p>
          {goalScope && (
            <p className="mb-1.5 text-[12px] leading-snug text-foreground-muted">
              On your goal: {goalScope}
            </p>
          )}
          <p className="text-[14px] font-semibold leading-relaxed text-foreground">{howTheyReact}</p>
        </div>

        {/* Behavioral tells, each bound to its verbatim (TRUST-02) — the evidence spine. Stays
            on the face: a read you cannot check is just an assertion. */}
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            What gives them away
          </p>
          <ul className="flex flex-col gap-2.5">
            {tells.map((t, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{t.tell}</p>
                <blockquote className="border-l-2 border-white/[0.12] pl-3 text-[13.5px] italic leading-relaxed text-foreground/70">
                  &ldquo;{stripWrappingQuotes(t.evidence)}&rdquo;
                </blockquote>
              </li>
            ))}
          </ul>
        </div>

        {/* ONE disclosure — drivers + the forensic read behind a single deliberate open, with
            the model tag demoted onto the line. Replaces two separate caps-labelled sections
            and their hairlines: the card had five equal-weight labels and therefore no
            hierarchy at all. The forensic claims still require an explicit open (F-01). */}
        <button
          type="button"
          onClick={() => setForensicOpen((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={forensicOpen}
          aria-label={forensicOpen ? 'Collapse read details' : 'Expand read details'}
        >
          <CaretToggle open={forensicOpen} />
          {forensicOpen ? 'Hide details' : 'Why & details'}
          <span className="text-foreground-muted/70">· {modelLabel}</span>
        </button>
      </div>

      {/* EXPAND — what drives them + the forensic read (max/video tier only, D-03). */}
      {forensicOpen && (identity.drivers.length > 0 || forensic) && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {identity.drivers.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
                What drives them
              </p>
              <ul className="flex flex-col gap-1">
                {identity.drivers.map((driver, i) => (
                  <li key={i} className="text-[13.5px] leading-relaxed text-foreground-secondary">
                    {driver}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {forensic && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
                Deeper read (from the video)
              </p>
              <p className="mb-1.5 text-[13.5px] leading-relaxed text-foreground-secondary">
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
                  <li key={i} className="text-[13.5px] leading-relaxed text-foreground-secondary">
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

      {/* Honesty caveat — ALWAYS visible (F-04). It never goes behind the disclosure: a read
          on limited signal has to say so on the face, where it cannot be missed. */}
      <div className="border-t border-white/[0.06] px-4 py-2.5">
        <p className="text-[12px] leading-relaxed text-foreground-muted">{caveat}</p>
      </div>

      {/* ACTIONS — one cream primary (the forward chain: profile→simulate) + icon Save, the
          same action bar every other card ends on. Save used to sit alone in its own row above
          a raw textarea, which read as an afterthought rather than an affordance. */}
      <div className="flex flex-col gap-2.5 border-t border-white/[0.06] px-4 py-3">
        {!simulated ? (
          <>
            <textarea
              value={draftedMessage}
              onChange={(e) => setDraftedMessage(e.target.value)}
              placeholder={`Draft a message to ${subjectName}…`}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13.5px] leading-relaxed text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
              aria-label="Drafted message to simulate"
            />
            <div className="flex items-center gap-3.5">
              <CardPrimaryAction
                onClick={() => void handleSimulate()}
                disabled={simulating || draftedMessage.trim().length === 0}
                aria-label={ctaLabel}
                title={ctaLabel}
              >
                {simulating ? 'Simulating…' : 'Test this message →'}
              </CardPrimaryAction>
              <SaveAffordance
                className="ml-auto"
                item_type="read"
                title={subjectName}
                snapshot={block.props}
              />
            </div>
            {simulateError && (
              <p className="text-[12px] text-[var(--color-error)]" role="alert">
                {simulateError}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3.5">
            <p className="text-[13px] text-foreground-muted">
              Reaction queued — check the thread below.
            </p>
            <SaveAffordance
              className="ml-auto"
              item_type="read"
              title={subjectName}
              snapshot={block.props}
            />
          </div>
        )}
      </div>
    </div>
  );
}
