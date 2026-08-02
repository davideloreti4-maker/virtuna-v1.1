'use client';

/**
 * SimDoor — the AUDIENCE BAND every Make card ends on (2026-08-02, owner directive).
 *
 * Replaces the on-face <ProofUnit> AND the old <TargetReaction> line on hook / idea / script /
 * remix. The unit wore a scoreboard — band word, "8/10 would stop", magnitude ribbon, a verbatim
 * quote — but since the new call system (2026-07-22) those numbers on a `projected` card are the
 * WRITER'S generation-time estimate: no persona SIM ran. A card must not wear a verdict for a game
 * never played, and the room entry was buried inside the stats box it was supposed to replace.
 *
 * WHAT THE LEFT SIDE SAYS, in order of how much we actually know:
 *  - MEASURED (legacy cards, no `provenance`) — a real room reacted, so the real number leads:
 *    band dot+word · "8/10 stopped" (+ honesty suffix), and the aimed-at persona's own verdict
 *    when the panel carried one.
 *  - UNTESTED + `target` — the run bound this unit to ONE persona from the creator's CALIBRATED
 *    audience, and that binding is real (a structural output-contract assignment, not a prompt
 *    hope — see runners/target-assignment.ts). So the band states the audience FACT it can prove:
 *    who this one is aimed at, and how much of their audience that is. No claim about a reaction.
 *  - UNTESTED, no target (General / uncalibrated run) — "Not tested yet", and nothing more.
 *
 * The right side is always the door, and the whole band is the click target.
 *
 * Wiring is byte-for-byte ProofUnit's: inside the composer the row opens the docked room
 * anchored on this card (`useOpenRoomForCard` + `useAmbientCardId`); off-composer it falls back
 * to the standalone <LensTrigger>. ProofUnit itself is untouched — Simulate and the brought card
 * still render it over their REAL measured reactions.
 */

import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import type { PopulationAggregate } from '@/lib/audience/population';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import type { LensRewrite } from '@/components/audience-lens/AudienceLens';
import { useOpenRoomForCard, useAmbientCardId } from '@/lib/hook-test-context';
import type { CardTarget } from '@/lib/tools/blocks';
import { archetypeDisplayName } from '@/lib/audience/archetype-names';
import { BAND_COLOR } from './band-block';

type Band = 'Strong' | 'Mixed' | 'Weak';

export interface SimDoorProps {
  /** True ⇒ the card's numbers are a generation-time estimate — show the untested door. */
  projected: boolean;
  /**
   * WHO this unit was written for — a persona from the creator's calibrated audience, with that
   * persona's real share of it. Absent on General/uncalibrated runs (honest silence: never a
   * personalised label over a generic unit).
   *
   * `verdict`/`quote` are looked up from a SIM panel and are null on the generation path, so the
   * reaction half only ever renders on a card whose room has actually run. A miss is shown as
   * plainly as a hit — a unit whose own target scrolled past is the most useful thing it can say.
   */
  target?: CardTarget;
  /**
   * A card whose "who it's for" is DESCRIPTIVE text rather than a bound persona (remix's
   * `whoItsFor`). No share, no archetype — so it states the aim and claims no measurement.
   * Ignored when `target` is present: a bound persona is the stronger fact.
   */
  aimText?: string;
  /** The measured band/fraction (legacy cards). Only rendered when `projected` is false. */
  band?: Band;
  fraction?: string;
  /** Honesty qualifier on the measured count, e.g. "opener only" / "adapted hook". */
  suffix?: string;
  /** Reactions → the Lens (empty ⇒ the row renders without an open affordance). */
  flatPersonas: FlatPersonaReaction[];
  /** The ledger lookup key — must match the card's ambient descriptor conceptText. */
  conceptText: string;
  population?: PopulationAggregate;
  rewrite?: LensRewrite;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /** Accessible label for the row. */
  label: string;
}

/** Byte-identical parse contract to ProofUnit / flat-card-reactions. */
function parseFraction(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) return null;
  return { stop, total };
}

/** Three overlapping avatar placeholders — the "a real room reacted" cue (measured only). */
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

export function SimDoor({
  projected,
  target,
  aimText,
  band,
  fraction,
  suffix,
  flatPersonas,
  conceptText,
  population,
  rewrite,
  platform = 'tiktok',
  label,
}: SimDoorProps) {
  const openRoomForCard = useOpenRoomForCard();
  const ambientCardId = useAmbientCardId();

  const parsed = !projected && fraction ? parseFraction(fraction) : null;
  const bandColor = !projected && band ? BAND_COLOR[band] : undefined;

  // F7: `label` is the CREATOR'S own name for this persona, snapshotted on the block and never
  // seen by the model. Absent ⇒ derive from `archetype` at RENDER, so improving our archetype
  // vocabulary improves every card ever generated instead of freezing old ones.
  const personaName = target ? (target.label ?? archetypeDisplayName(target.archetype)) : null;
  const sharePct = target ? Math.round(target.share * 100) : null;

  /**
   * The audience fact this card can prove: who it was written for, and how big that slice is.
   *
   * It WRAPS rather than truncates. The card is 342px wide on mobile inside a viewport that may
   * be any width, so a media query cannot see the constraint that matters — and truncating
   * dropped the share ("Time Poor Creato…"), deleting the one number this band exists to show.
   */
  const aim = personaName ? (
    <span className="min-w-0 text-body leading-snug text-foreground-muted">
      <span className="font-medium text-foreground-secondary">{personaName}</span>
      {sharePct != null && (
        <>
          {' · '}
          <span className="tabular-nums text-foreground-secondary">{sharePct}%</span> of your
          audience
        </>
      )}
    </span>
  ) : aimText ? (
    <span className="min-w-0 line-clamp-2 text-body leading-snug text-foreground-muted">
      For <span className="text-foreground-secondary">{aimText}</span>
    </span>
  ) : null;

  // `flex-wrap` + `ml-auto` on the door: the two sides sit on one row when they fit, and the door
  // drops to its own right-aligned line when they don't — no width query, no truncation.
  const body = projected ? (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5">
      {aim ?? (
        <span className="flex items-center gap-2 text-body text-foreground-muted">
          {/* Hollow dot — a CSS ring, deliberately NOT the ○ glyph (FIT_META owns those). */}
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full border border-white/[0.35]"
            aria-hidden="true"
          />
          Not tested yet
        </span>
      )}
      <span className="ml-auto shrink-0 whitespace-nowrap text-label font-medium text-foreground-secondary">
        Simulate with your audience →
      </span>
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="flex min-w-0 items-center gap-2.5 text-body">
        {band && (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold"
            style={{ color: bandColor }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: bandColor }} />
            {band}
          </span>
        )}
        <span className="min-w-0 leading-snug text-foreground-secondary">
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
          {/* The aimed-at reader's OWN verdict, when a panel actually returned one. Never
              invented: null on the generation path, so this stays silent there. */}
          {target?.verdict && (
            <span className="text-foreground-muted">
              {' · '}
              {personaName} {target.verdict === 'stop' ? 'stopped' : 'scrolled past'}
            </span>
          )}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap text-label text-foreground-secondary">
        <RoomAvatars />
        See your audience →
      </span>
    </div>
  );

  // The band is its own hairline-separated zone of the card (the card's audience seam), so the
  // foot reads as two rows with distinct jobs — audience, then actions — instead of three loose
  // half-empty lines. Full-bleed to the card edges; the inset hover is the click feedback.
  const rowClass =
    'flex items-center border-t border-white/[0.06] px-4 py-2.5 transition-colors hover:bg-white/[0.03]';

  // Home-composer path: open the docked current-audience room anchored on this card.
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
        className={rowClass}
      >
        {body}
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
      className={rowClass}
    >
      {body}
    </LensTrigger>
  );
}
