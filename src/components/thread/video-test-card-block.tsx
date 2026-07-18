'use client';

/**
 * VideoTestCardRenderer — the /test in-thread result card (TEST-01).
 *
 * The 1:1 in-thread representation of a real-video Test. The full frame-by-frame /api/analyze
 * Max pipeline runs underneath (untouched); its result is mapped onto this card so the Test
 * lands in the thread like every other skill — no navigate-out.
 *
 * Built on THE CARD CONTRACT spine (docs/subsystems/ui-skill-cards.md §0.5 / card-primitives.tsx)
 * so it is pixel-consistent with the hook / idea / script / remix cards: the same <CardEyebrow>,
 * the same shared <ProofUnit> audience-reaction block (band · fraction · lead quote · "See the
 * room →" Lens door), the same expand idiom, and the same <CardActionBar> (one cream primary +
 * Save). The ProofUnit docstring already lists `test` as one of its consumers — this is that card.
 *
 * Renders validated props ONLY (D-14). Bands/WORDS only — ZERO 0-100 number (the `.strict()`
 * schema enforces it). `verdict` is HeroBlock.verdict_line (a WORD: "High potential" /
 * "Solid contender" / "Needs work" / "Don't post yet" — which already carries the post/don't-post
 * call, so there is no separate score chip). Provenance is `model: "sim1-max"` — the Max VIDEO
 * tier. The number + filmstrips / per-frame / verbatim wall / Apollo depth a card can't hold live
 * one door away: the cream "See the full breakdown →" to /analyze/[analysisId].
 */

import { useState } from 'react';
import Link from 'next/link';
import type { VideoTestCardBlock } from '@/lib/tools/blocks';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CaretToggle } from './caret-toggle';
import { ProofUnit } from './proof-unit';
import { CardEyebrow, CardActionBar, SECTION_LABEL } from './card-primitives';
import { BAND_COLOR } from './band-block';

export interface VideoTestCardRendererProps {
  block: VideoTestCardBlock;
}

export function VideoTestCardRenderer({ block }: VideoTestCardRendererProps) {
  const {
    verdict,
    audienceName,
    band,
    fraction,
    theOneFix,
    ceiling,
    reactions,
    postWindow,
    conceptText,
    analysisId,
    tier,
  } = block.props;

  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];
  // The room's lead reaction — a persona who stopped, else the first reaction.
  const leadQuote = reactions.find((r) => r.verdict === 'stop')?.quote ?? reactions[0]?.quote;
  const hasExpand = !!ceiling || !!postWindow;

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Video test: ${verdict} for ${audienceName}`}
    >
      {/* FACE — always visible */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Eyebrow — audience kicker (band-colored dot) + trust tier (§0.5.1). */}
        <CardEyebrow kicker={audienceName} dotColor={bandColor} meta={<TrustBadge tier={tier} />} />

        {/* Hero — the Test verdict WORD (never a number; already carries the post/don't-post call). */}
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {verdict}
        </p>

        {/* Why-teaser — the highest-leverage fix, surfaced on the face (mirrors the hook card's
            mechanism teaser). Full reasoning is one line away, clamped. */}
        {theOneFix && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground-secondary">
            <span className="text-foreground-muted">The fix — </span>
            {theOneFix}
          </p>
        )}

        {/* Proof unit — the ONE shared audience-reaction block + the Lens door (§1.3–§1.4).
            Same component the hook/idea/script/remix cards use, so the reaction reads identically.
            The reactions ARE FlatPersonaReaction[]; the video's verbatim hook grounds "Ask them why". */}
        <ProofUnit
          band={band}
          fraction={fraction}
          quote={leadQuote}
          flatPersonas={reactions}
          conceptText={conceptText ?? ''}
          label="See how the room reacted to this video"
        />

        {/* Expand toggle — provenance demoted onto this line (§0.5.6). */}
        {hasExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse test details' : 'Expand test details'}
          >
            <CaretToggle open={expanded} />
            {expanded ? 'Hide details' : 'Why & details'}
            <span className="text-foreground-muted/70">· SIM-1 Max</span>
          </button>
        )}
      </div>

      {/* EXPAND — what caps it + the best posting window. */}
      {expanded && hasExpand && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {ceiling && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>What caps it</p>
              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{ceiling}</p>
            </div>
          )}
          {postWindow && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>Best window</p>
              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{postWindow}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions — one cream primary (the full breakdown door) + Save (§0.5.7). The door is the
          Test's natural next step for the depth a card can't hold; the card itself stays the
          thread representation, so this is a drill, not a forced navigate. */}
      <CardActionBar>
        <Link
          href={`/analyze/${analysisId}`}
          className="rounded-md bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        >
          See the full breakdown →
        </Link>
        <SaveAffordance
          className="ml-auto"
          item_type="read"
          title={`${verdict} · ${audienceName}`}
          snapshot={block.props}
        />
      </CardActionBar>
    </div>
  );
}
