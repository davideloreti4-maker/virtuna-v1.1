'use client';

/**
 * IdeaCardRenderer — concept-forward idea card (D-08/D-09/D-10/D-11).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte, warm-cream, band color used once.
 *  - Eyebrow kicker "Made for your audience" (band-colored dot) + amber "your take" badge
 *    (amber = data status, not brand accent). Title reads first.
 *  - whyItFits folded into the why-line (angle + the muted fit clause).
 *  - ONE shared <ProofUnit> = the visible AudienceLens entry.
 *  - ONE cream primary = the forward chain step "Develop into hooks →" (§1.7); Save = icon.
 *  - The dead "If this could flop →" branch is GONE (predictedFailureMode is always null).
 *
 * THREAD-04 / D-10: the model emits validated IdeaCardBlock props only; THIS component owns
 * layout. "Develop into hooks →" POSTs /api/tools/ideas/develop and appends a Hooks
 * placeholder in the SAME open thread (the in-thread chain seam; generation is P4).
 */

import { useCallback, useState } from 'react';
import type { IdeaCardBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { BAND_COLOR } from './band-block';
import { ProofUnit } from './proof-unit';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CaretToggle } from './caret-toggle';
import { TargetReaction } from './target-reaction';
import { archetypeDisplayName } from '@/lib/audience/archetype-names';

export interface IdeaCardRendererProps {
  block: IdeaCardBlock;
}

export function IdeaCardRenderer({ block }: IdeaCardRendererProps) {
  const {
    title,
    angle,
    whyItFits,
    mechanism,
    seedHook,
    needsTake,
    topic,
    take,
    format,
    band,
    fraction,
    scored,
    scrollQuote,
    proof,
    grounded,
    target,
    population,
  } = block.props;

  const platform = usePlatform();
  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];

  // ── "Develop into hooks →" CTA state ──────────────────────────────────────
  const [developing, setDeveloping] = useState(false);
  const [developError, setDevelopError] = useState<string | null>(null);
  const [developed, setDeveloped] = useState(false);

  /** Call the PINNED /develop endpoint (D-15/THREAD-05/IDEAS-03) — anchor + Hooks placeholder. */
  const handleDevelop = useCallback(async () => {
    if (developing || developed) return;
    setDeveloping(true);
    setDevelopError(null);

    try {
      const anchor = `${title}\n\n${angle}`;
      const res = await fetch('/api/tools/ideas/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor, platform }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Develop request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Develop request failed');
      }
      setDeveloped(true);
    } catch (err) {
      setDevelopError(err instanceof Error ? err.message : 'Develop error');
    } finally {
      setDeveloping(false);
    }
  }, [developing, developed, title, angle, platform]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Idea: ${title}`}
    >
      {/* FACE — always visible */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Eyebrow — audience kicker (band-colored dot) + amber "your take" badge.
            On a targeted (calibrated) run the kicker NAMES the person this idea was written for.
            "Made for your audience" is what we can honestly say when we wrote it for nobody in
            particular — the moment we can name the reader, saying the vaguer thing is a downgrade. */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
            {target
              ? `For your ${target.label ?? archetypeDisplayName(target.archetype)}`
              : 'Made for your audience'}
          </span>
          {needsTake && (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.05em]"
              style={{ color: 'var(--color-warning)', borderColor: 'rgba(224,189,114,0.25)' }}
              title="This idea leans on a perspective only you can supply"
            >
              your take
            </span>
          )}
        </div>

        {/* Title — the hero */}
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{title}</h3>

        {/* Why-line — the angle premise + the muted "fits because" clause (whyItFits folded in). */}
        <p className="text-[13px] leading-relaxed text-foreground-secondary">
          {angle} <span className="text-foreground-muted">— {whyItFits}</span>
        </p>

        {/* Per-persona generation: the aim + the aimed-at reader's own verdict (the receipt).
            Absent on General/uncalibrated runs, and on a calibrated run whose writer named nobody
            we assigned — an honest silence, never a personalised label over a generic idea. */}
        {target && <TargetReaction target={target} />}

        {/* Proof receipt (§11f fan-out) — the real outlier this idea's structure was drawn from.
            Only present on grounded runs where a real source was attributed (honesty spine).
            When the run HAD sources and this idea cited none, say so rather than leaving a
            receipt-shaped hole beside a sibling that has one (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Proof unit — the single audience-reaction block + visible Lens entry. */}
        <ProofUnit
          band={band}
          fraction={fraction}
          scored={scored ?? true}
          quote={scrollQuote}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={`${title}\n\n${angle}`}
          population={population}
          platform={platform}
          rewrite={buildCardRewrite({
            skill: 'idea',
            fraction,
            scrollQuote,
            conceptText: `${title}\n\n${angle}`,
            platform,
          })}
          label="See how the room reacted to this idea"
        />

        {/* Expand toggle + provenance. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse idea details' : 'Expand idea details'}
        >
          <CaretToggle open={expanded} />
          {expanded ? 'Hide details' : 'Angle & format'}
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
        </button>
      </div>

      {/* EXPAND — mechanism, seed hook, Topic × Take × Format. */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Mechanism</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{mechanism}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Seed hook</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{seedHook}</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="divide-y divide-white/[0.04]">
              <div className="px-3 py-2">
                <span className="text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Topic</span>
                <p className="mt-0.5 text-[13.5px] leading-snug text-foreground-secondary">{topic}</p>
              </div>
              <div className="px-3 py-2">
                <span className="text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Take</span>
                <p className="mt-0.5 text-[13.5px] leading-snug text-foreground-secondary">{take}</p>
              </div>
              {format && (
                <div className="px-3 py-2">
                  <span className="text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Format</span>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-foreground-secondary">{format}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions — one cream primary (forward chain "Develop into hooks →") + Save icon. */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        {!developed ? (
          <>
            <button
              type="button"
              onClick={() => void handleDevelop()}
              disabled={developing}
              className="rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-wait disabled:opacity-60"
              aria-label="Develop this idea into hooks"
            >
              {developing ? 'Developing…' : 'Develop into hooks →'}
            </button>
            {developError && (
              <p className="text-[12px]" style={{ color: 'var(--color-error)' }} role="alert">
                {developError}
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-foreground-muted">Hooks queued — check the thread below.</p>
        )}

        <SaveAffordance className="ml-auto" item_type="idea" title={title} snapshot={block.props} />
      </div>
    </div>
  );
}
