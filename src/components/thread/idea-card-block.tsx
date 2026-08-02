'use client';

/**
 * IdeaCardRenderer — concept-forward idea card (D-08/D-09/D-10/D-11).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte, warm-cream, band color used once.
 *  - Eyebrow kicker "Made for your audience" (band-colored dot) + amber "your take" badge
 *    (amber = data status, not brand accent). Title reads first.
 *  - whyItFits folded into the why-line (angle + the muted fit clause).
 *  - ONE shared <SimDoor> = the visible AudienceLens entry (2026-08-02: replaces the on-face
 *    ProofUnit — a projected card carries no verdict apparatus, only the door to measure it).
 *  - ONE cream primary = the forward chain step "Develop into hooks →" (§1.7); Save = icon.
 *  - The dead "If this could flop →" branch is GONE (predictedFailureMode is always null).
 *
 * THREAD-04 / D-10: the model emits validated IdeaCardBlock props only; THIS component owns
 * layout. "Develop into hooks →" POSTs /api/tools/ideas/develop and appends a Hooks
 * placeholder in the SAME open thread (the in-thread chain seam; generation is P4).
 */

import { useCallback, useState } from 'react';
import { reportCredit402 } from '@/lib/billing/credit-wall';
import type { IdeaCardBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { SimDoor } from './sim-door';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';
import { TargetReaction } from './target-reaction';

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
    scrollQuote,
    proof,
    grounded,
    target,
    population,
    provenance,
  } = block.props;

  // New Qwen call system (2026-07-22): a "projected" card's band/fraction/quote are the WRITER'S
  // generation-time estimate — no persona SIM ran. It must NOT claim a measured room reaction: the
  // proof unit reads in the conditional ("would stop") and the provenance tag says "projected", not
  // "SIM-1 Flash". "See the room →" is the measure-it door. Absent provenance ⇒ a legacy/persisted
  // MEASURED card → unchanged wording (back-compat).
  const projected = provenance === 'projected';

  const platform = usePlatform();
  const [expanded, setExpanded] = useState(false);

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
        if (reportCredit402(res.status, err)) {
          // The wall dialog is up (CreditWallListener); surface the human sentence, not the slug.
          throw new Error(err.message);
        }
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
      className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Idea: ${title}`}
    >
      {/* FACE — the idea reads as a CONCEPT BRIEF, not a line: title + angle, the mechanism it
          works by, and a Topic·Take·Format RECIPE formula — each promoted onto the face so the
          card carries its own value and stops looking like the hook/remix cards (owner 2026-07-22:
          "they all should have their value, atm they kinda look the same"). No Copy affordance —
          an idea is a brief you develop, not a line you lift (that's the Hook card). */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Title (hero) + the functional "your take" signal (a perspective only you can supply). */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-heading font-medium leading-[1.3] tracking-[-0.005em] text-foreground">{title}</h3>
          {needsTake && (
            <span
              className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-caption uppercase tracking-[0.05em]"
              style={{ color: 'var(--color-warning)', borderColor: 'rgba(224,189,114,0.25)' }}
              title="This idea leans on a perspective only you can supply"
            >
              your take
            </span>
          )}
        </div>

        {/* Angle — the concept's premise + the muted "fits because" clause (whyItFits folded in). */}
        <p className="text-body leading-relaxed text-foreground-secondary">
          {angle} <span className="text-foreground-muted">— {whyItFits}</span>
        </p>

        {/* Why it lands — the mechanism, promoted from expand to a labeled payload on the face. */}
        <div>
          <p className={`mb-1 ${SECTION_LABEL}`}>Why it lands</p>
          <p className="text-reading leading-relaxed text-foreground-secondary">{mechanism}</p>
        </div>

        {/* Recipe — Topic · Take · Format as a visible formula (this idea card's SIGNATURE; was
            buried in the expand). The outer "Make it from" label is gone (label-chrome diet,
            2026-08-02): the cell titles already name the formula. The Format cell is omitted
            when absent — honest, never an empty cell. */}
        <div className="flex overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
          {[
            { label: 'Topic', value: topic },
            { label: 'Take', value: take },
            ...(format ? [{ label: 'Format', value: format }] : []),
          ].map((cell, i) => (
            <div
              key={cell.label}
              className={`min-w-0 flex-1 px-3 py-2 ${i > 0 ? 'border-l border-white/[0.06]' : ''}`}
            >
              <p className={SECTION_LABEL}>{cell.label}</p>
              <p className="mt-0.5 line-clamp-2 text-body leading-snug text-foreground-secondary">{cell.value}</p>
            </div>
          ))}
        </div>

        {/* Per-persona generation: the aim + the aimed-at reader's own verdict (the receipt).
            Absent on General/uncalibrated runs, and on a calibrated run whose writer named nobody
            we assigned — an honest silence, never a personalised label over a generic idea. */}
        {target && <TargetReaction target={target} />}

        {/* Proof receipt (§11f fan-out) — the real outlier this idea's structure was drawn from.
            Only present on grounded runs where a real source was attributed (honesty spine).
            When the run HAD sources and this idea cited none, say so rather than leaving a
            receipt-shaped hole beside a sibling that has one (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Expand — the seed hook (the line this idea would open with). The provenance tag is
            gone with the on-face verdict: the door below states the honest status. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse idea details' : 'Expand idea details'}
        >
          <CaretToggle open={expanded} />
          {expanded ? 'Hide seed hook' : 'Seed hook'}
        </button>

        {/* The simulation door — replaces the verdict apparatus (2026-08-02). */}
        <SimDoor
          projected={projected}
          band={band}
          fraction={fraction}
          /* The room LOOKS this card up by conceptText (openRoomForCard → the ledger's
             `.find(x => x.conceptText === …)`), and the ledger keys an idea on its title alone
             (ambient-descriptors.ts `hookLine ?? title ?? …`). It must be the bare title, not
             `title\n\nangle`, or the door never matches and the tap is a silent no-op —
             the one fact / two sources trap. The rewrite anchor below deliberately keeps the
             angle: it's a generation input, not a lookup key. */
          conceptText={title}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          population={population}
          platform={platform}
          rewrite={buildCardRewrite({
            skill: 'idea',
            fraction,
            scrollQuote,
            conceptText: `${title}\n\n${angle}`,
            platform,
          })}
          label={projected ? 'Simulate this idea with your audience' : 'See how your audience reacted to this idea'}
        />
      </div>

      {/* EXPAND — the seed hook (mechanism + recipe now live on the face). */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Seed hook</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{seedHook}</p>
          </div>
        </div>
      )}

      {/* Actions — one cream primary (forward chain "Develop into hooks →") + Save icon (§0.5.7). */}
      <CardActionBar>
        {!developed ? (
          <>
            <CardPrimaryAction
              onClick={() => void handleDevelop()}
              disabled={developing}
              aria-label="Develop this idea into hooks"
            >
              {developing ? 'Writing hooks…' : 'Write hooks for this →'}
            </CardPrimaryAction>
            {developError && (
              <p className="text-label" style={{ color: 'var(--color-error)' }} role="alert">
                {developError}
              </p>
            )}
          </>
        ) : (
          <p className="text-body text-foreground-muted">Hooks queued — check the thread below.</p>
        )}

        <SaveAffordance className="ml-auto" item_type="idea" title={title} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}
