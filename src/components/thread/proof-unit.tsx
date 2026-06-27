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
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import type { LensRewrite } from '@/components/audience-lens/AudienceLens';
import { BAND_COLOR } from './band-block';

type Band = 'Strong' | 'Mixed' | 'Weak';

export interface ProofUnitProps {
  band: Band;
  /** Already-emitted stop fraction, e.g. "8/10" or "8/10 stop". */
  fraction: string;
  /** The lead verbatim reaction quote (omit/empty ⇒ quote row collapses). */
  quote?: string;
  /** Optional honesty qualifier shown after the count, e.g. "opener only" / "adapted hook". */
  suffix?: string;
  /** Flat Shape-B reactions → the Lens (empty ⇒ no open affordance, honest degrade). */
  flatPersonas: FlatPersonaReaction[];
  /** The concept the room reacted to — grounds the "Ask them why →" chat. */
  conceptText: string;
  /** The Rewrite-for-audience loop (omitted ⇒ no sticky CTA in the Lens). */
  rewrite?: LensRewrite;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /** Accessible label for the open affordance. */
  label?: string;
}

/** Byte-identical parse contract to card-reaction-at-rest / flat-card-reactions. */
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
  flatPersonas,
  conceptText,
  rewrite,
  platform = 'tiktok',
  label = 'See how the room reacted',
}: ProofUnitProps) {
  const parsed = parseFraction(fraction);
  const bandColor = BAND_COLOR[band];

  return (
    <LensTrigger
      flatPersonas={flatPersonas}
      conceptText={conceptText}
      rewrite={rewrite}
      platform={platform}
      label={label}
      className="flex flex-col gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-white/[0.10] hover:bg-white/[0.035]"
    >
      {/* Top — band dot+word · count · ribbon (the fraction stated ONCE). */}
      <div className="flex w-full items-center gap-2.5 text-[13px]">
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
              stopped
            </>
          ) : (
            fraction
          )}
          {suffix && <span className="text-foreground-muted"> · {suffix}</span>}
        </span>
        {parsed && (
          <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(parsed.stop / parsed.total) * 100}%`,
                backgroundColor: 'var(--color-foreground-secondary)',
              }}
            />
          </span>
        )}
      </div>

      {/* Quote + the now-visible Lens cue. */}
      {quote && (
        <div className="flex w-full items-center justify-between gap-2.5">
          <blockquote className="border-l-2 border-white/[0.10] pl-3 text-[13px] italic leading-snug text-foreground/80">
            &ldquo;{quote}&rdquo;
          </blockquote>
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground-secondary">
            <RoomAvatars />
            See the room →
          </span>
        </div>
      )}
    </LensTrigger>
  );
}
