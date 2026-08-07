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
import { reportSession401, SessionExpiredRefusal } from '@/lib/auth/session-expired';
import type { IdeaCardBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { SimDoor } from './sim-door';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, CardHero, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';

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
        // 401 first. The catch renders `err.message`, and the refusal's default message is a
        // readable sentence — without this the creator reads the route's `Unauthorized` slug.
        if (reportSession401(res.status)) throw new SessionExpiredRefusal();
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
        {/* Title — the hero, on the shared <CardHero> row (the header contract, 2026-08-02). The
            right slot is deliberately EMPTY: an idea is a brief you develop, not a line you lift,
            so there is nothing here to copy — the affordance would be chrome pretending to be a
            deliverable. `h3` because this hero is a genuine title, unlike the quoted lines the
            other cards hero. The old amber "YOUR TAKE" pill competed with it in uppercase chrome;
            that signal moved onto the Take cell below, where the take it qualifies actually lives. */}
        <CardHero as="h3">{title}</CardHero>

        {/* Angle — the concept's premise + the muted "fits because" clause (whyItFits folded in).
            Joined by the system's `·`, never an em dash (locked wording, handoff §7.6). */}
        <p className="text-body leading-relaxed text-foreground-secondary">
          {angle} <span className="text-foreground-muted">· {whyItFits}</span>
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
              <p className={`flex items-center gap-1.5 ${SECTION_LABEL}`}>
                {cell.label}
                {/* The your-take signal, relocated from the old head pill: a quiet amber dot on
                    the one cell that leans on a perspective only the creator can supply. */}
                {cell.label === 'Take' && needsTake && (
                  <span
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--color-warning)' }}
                    title="This idea leans on a perspective only you can supply"
                    aria-label="Needs your take"
                  />
                )}
              </p>
              <p className="mt-0.5 line-clamp-2 text-body leading-snug text-foreground-secondary">{cell.value}</p>
            </div>
          ))}
        </div>

        {/* Proof receipt (§11f fan-out) — the real outlier this idea's structure was drawn from.
            Only present on grounded runs where a real source was attributed (honesty spine).
            When the run HAD sources and this idea cited none, say so rather than leaving a
            receipt-shaped hole beside a sibling that has one (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Expand — the line this idea would open with, named for the value it holds ("Seed
            hook" was the engine's word for it; "Opening line" is the creator's). */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse the opening line' : 'Expand the opening line'}
        >
          <CaretToggle open={expanded} />
          Opening line
        </button>
      </div>

      {/* EXPAND — the opening line (mechanism + recipe now live on the face). */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Opening line</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{seedHook}</p>
          </div>
        </div>
      )}

      {/* AUDIENCE BAND — who this idea was written for (a real slice of the calibrated audience)
          and the door that turns the aim into a measured reaction. Its own hairline zone. */}
      <SimDoor
        projected={projected}
        target={target}
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
