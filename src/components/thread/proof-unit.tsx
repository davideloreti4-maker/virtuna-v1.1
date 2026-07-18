'use client';

/**
 * ProofUnit — the ONE shared "audience proof" block every generated skill card shows
 * (hook / idea / script / remix / test). lane/polish skill-card refinement; design SoT =
 * docs/subsystems/ui-skill-cards.md §1.3–§1.4.
 *
 * Anatomy (single bordered, hoverable unit):
 *   band dot+word · "{stop}/{total} stopped" · a thin magnitude ribbon   (fraction ONCE)
 *   "…lead verbatim quote…"                          avatars + "See the room →"
 *
 * It IS the visible AudienceLens entry: the whole box is the click target that opens the
 * reusable <AudienceLens> via <LensTrigger>. (Before this, the quote was wrapped in a
 * LensTrigger with zero visual affordance — the flagship interaction was invisible.)
 *
 * Design law:
 *  - State the fraction ONCE (here) — the old sibling band chip is removed by the cards.
 *  - Band color used ONCE: the dot + the word. The ribbon is neutral cream — a magnitude
 *    bar, NEVER band-colored, NEVER coral.
 *  - Flat matte: border + a faint tone only, no inset shine.
 *  - Honest degrade: an unparseable fraction hides the count + ribbon; empty reactions
 *    collapse the Lens affordance (LensTrigger renders the children unwrapped).
 */

import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import type { PopulationAggregate } from '@/lib/audience/population';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import type { LensRewrite } from '@/components/audience-lens/AudienceLens';
import { useOpenRoomForCard, useAmbientCardId } from '@/lib/hook-test-context';
import { Skeleton } from '@/components/ui/skeleton';
import { BAND_COLOR } from './band-block';
import { stripWrappingQuotes } from '@/lib/utils';

type Band = 'Strong' | 'Mixed' | 'Weak';

export interface ProofUnitProps {
  band: Band;
  /** Already-emitted stop fraction, e.g. "8/10" or "8/10 stop". */
  fraction: string;
  /** The lead verbatim reaction quote (omit/empty ⇒ quote row collapses). */
  quote?: string;
  /** Optional honesty qualifier shown after the count, e.g. "opener only" / "adapted hook". */
  suffix?: string;
  /**
   * The verb the count is stated in. Defaults to "stopped" — the FYP scroll-stop question every
   * hook/idea/script/remix card asks.
   *
   * Simulate passes "react": its panel can run in `mode: 'general'`, which the runner is explicit
   * must NOT be asked the TikTok stop-or-scroll question (MODE-01) — it judges a draft on its
   * merits — and its engine emits the fraction as "N/10 react". Hardcoding "stopped" here would
   * have silently RE-WORDED the engine's claim into a stronger, FYP-flavoured one the run never
   * made. The number is not the only thing that has to be true.
   */
  verb?: string;
  /** Flat Shape-B reactions → the Lens (empty ⇒ no open affordance, honest degrade). */
  flatPersonas: FlatPersonaReaction[];
  /** The concept the room reacted to — grounds the "Ask them why →" chat. */
  conceptText: string;
  /**
   * Audience Sim v2 (Stage 2): the REAL N-individual projection for this card → the standalone
   * Lens's Population·1,000 view (off-composer path). Optional/additive — absent ⇒ the honest-lean
   * rollup. NOTE: the on-composer path opens the DOCKED room via `openRoomForCard` (renderer B),
   * which does not carry per-card population yet — a separate follow-up.
   */
  population?: PopulationAggregate;
  /** The Rewrite-for-audience loop (omitted ⇒ no sticky CTA in the Lens). */
  rewrite?: LensRewrite;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /** Accessible label for the open affordance. */
  label?: string;
  /**
   * A4 (premium-thread): false while the card is streamed-in but its `score` event
   * hasn't landed — renders a matte-shimmer "Scoring…" strip in place of the band +
   * fraction + ribbon, which then resolve in when it flips true. Defaults to true so
   * persisted/test cards (no `scored` field) render fully-scored, unchanged.
   */
  scored?: boolean;
  /**
   * Variant-A "quiet" de-box (Script first, 2026-07-18): when false the unit drops its border +
   * fill and reads as a borderless reaction row, so it stops being a box-within-the-card. It stays
   * the click target — a gentle inset hover replaces the border feedback — and keeps the 44px tap
   * height. Defaults true (the bordered proof box every other Make card still shows), so the roll-out
   * to hooks/idea/remix is one prop flip each.
   */
  framed?: boolean;
}

/** Byte-identical parse contract to flat-card-reactions. */
function parseFraction(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) return null;
  return { stop, total };
}

/** Three overlapping avatar placeholders — the "a real room reacted" cue (§1.4). */
function RoomAvatars() {
  return (
    <span className="flex" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[15px] w-[15px] rounded-full border border-surface-thread bg-white/[0.10]"
          style={{ marginLeft: i === 0 ? 0 : -5 }}
        />
      ))}
    </span>
  );
}

export function ProofUnit({
  band,
  fraction,
  quote,
  suffix,
  verb = 'stopped',
  flatPersonas,
  conceptText,
  population,
  rewrite,
  platform = 'tiktok',
  label = 'See how the room reacted',
  scored = true,
  framed = true,
}: ProofUnitProps) {
  const parsed = parseFraction(fraction);
  const bandColor = BAND_COLOR[band];

  // Inside the home composer, "See the room →" opens the docked CURRENT-audience Room anchored
  // on this card (via OpenRoomContext) — the live audience + this card's real per-persona
  // reactions — instead of the standalone per-card Lens (placeholder viewers). Off-composer
  // (calendar / saved / library) the context is null ⇒ fall back to the standalone Lens.
  const openRoomForCard = useOpenRoomForCard();
  // This card's LEDGER id (provided by MessageBlocks) — passed to the open so two cards with an
  // identical concept resolve to the RIGHT room, not both to the first (family of #306). Null
  // off-composer ⇒ the handler falls back to concept-text matching.
  const ambientCardId = useAmbientCardId();

  // Same matte proof-box chrome for both entries so the card looks identical either way.
  // framed=false ⇒ borderless (Variant A): no persistent box, an inset hover for feedback, but
  // the -mx-2/px-2 pair keeps the content column aligned to the card's 16px edge.
  const proofBoxClass = framed
    ? 'flex flex-col gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-white/[0.10] hover:bg-white/[0.035]'
    : '-mx-2 flex flex-col gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]';

  const proofBody = (
    <>
      {/* Top — A4: pending shimmer until the score lands, then band · count · ribbon
          (the fraction stated ONCE) resolve in. The quote + Lens cue below ship with the
          card, so the unit is never empty while scoring. */}
      {!scored ? (
        <div className="flex w-full items-center gap-2.5 text-[13px]" aria-busy="true">
          <Skeleton className="h-[7px] w-[7px] shrink-0 rounded-full" />
          <span className="shrink-0 text-foreground-muted">Scoring with your 10 reactors…</span>
          <Skeleton className="h-[3px] flex-1 rounded-full" />
        </div>
      ) : (
        <div className="proof-resolve flex w-full items-center gap-2.5 text-[13px]">
          <span
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold"
            style={{ color: bandColor }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: bandColor }} />
            {band}
          </span>
          <span className="shrink-0 text-foreground-secondary">
            {parsed ? (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  {parsed.stop}/{parsed.total}
                </span>{' '}
                {verb}
              </>
            ) : (
              fraction
            )}
            {suffix && <span className="text-foreground-muted"> · {suffix}</span>}
          </span>
          {parsed && (
            <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="ribbon-wipe absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${(parsed.stop / parsed.total) * 100}%`,
                  backgroundColor: 'var(--color-foreground-secondary)',
                }}
              />
            </span>
          )}
        </div>
      )}

      {/* Quote + the now-visible Lens cue. */}
      {quote ? (
        <div className="flex w-full items-center justify-between gap-2.5">
          <blockquote className="border-l-2 border-white/[0.10] pl-3 text-[13px] italic leading-snug text-foreground/80">
            &ldquo;{stripWrappingQuotes(quote)}&rdquo;
          </blockquote>
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground-secondary">
            <RoomAvatars />
            See the room →
          </span>
        </div>
      ) : (
        // No lead verbatim (Simulate passes none — its themes carry the quotes) but the room is
        // still openable: show the cue on its own so the flagship interaction is never invisible.
        // Gated on real reactions, so a reaction-less unit shows nothing (parity with the quote row).
        flatPersonas.length > 0 && (
          <div className="flex w-full items-center justify-end">
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground-secondary">
              <RoomAvatars />
              See the room →
            </span>
          </div>
        )
      )}
    </>
  );

  // Home-composer path: open the docked current-audience Room on this card. Gated on real
  // reactions (parity with LensTrigger's empty-degrade) so a reaction-less card shows no cue.
  if (openRoomForCard && flatPersonas.length > 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => openRoomForCard(conceptText, ambientCardId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openRoomForCard(conceptText, ambientCardId);
          }
        }}
        style={{ minHeight: 44, cursor: 'pointer' }}
        className={proofBoxClass}
      >
        {proofBody}
      </div>
    );
  }

  // Off-composer fallback: the standalone reusable Lens (calendar / saved / library).
  return (
    <LensTrigger
      flatPersonas={flatPersonas}
      conceptText={conceptText}
      population={population}
      rewrite={rewrite}
      platform={platform}
      label={label}
      className={proofBoxClass}
    >
      {proofBody}
    </LensTrigger>
  );
}
