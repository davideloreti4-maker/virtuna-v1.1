'use client';

/**
 * SimDoor — the simulation door every Make card ends on (2026-08-02, owner directive).
 *
 * Replaces the on-face <ProofUnit> on hook / idea / script / remix. The old unit wore a
 * scoreboard — band word, "8/10 would stop", magnitude ribbon, a verbatim quote — but since the
 * new call system (2026-07-22) those numbers on a `projected` card are the WRITER'S generation-time
 * estimate: no persona SIM ran. A card must not wear a verdict for a game never played, and the
 * room entry ("See the room →") was buried inside the stats box it was supposed to replace.
 *
 * Two states:
 *  - UNTESTED (`projected`) — a quiet full-width row: hollow dot · "Not tested yet" ·
 *    "Simulate with your audience →". No band, no fraction, no quote. The row IS the door.
 *  - MEASURED (legacy cards, no `provenance`) — the number is real, so it stays, compact:
 *    band dot+word · "8/10 stopped" (+ honesty suffix) · "See your audience →".
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
import { BAND_COLOR } from './band-block';

type Band = 'Strong' | 'Mixed' | 'Weak';

export interface SimDoorProps {
  /** True ⇒ the card's numbers are a generation-time estimate — show the untested door. */
  projected: boolean;
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

  const body = projected ? (
    <div className="flex w-full items-center justify-between gap-2.5">
      <span className="flex items-center gap-2 text-body text-foreground-muted">
        {/* Hollow dot — a CSS ring, deliberately NOT the ○ glyph (FIT_META owns those). */}
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full border border-white/[0.35]"
          aria-hidden="true"
        />
        Not tested yet
      </span>
      <span className="shrink-0 whitespace-nowrap text-label font-medium text-foreground-secondary">
        Simulate with your audience →
      </span>
    </div>
  ) : (
    <div className="flex w-full items-center justify-between gap-2.5">
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
        <span className="truncate text-foreground-secondary">
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
      </span>
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-label text-foreground-secondary">
        <RoomAvatars />
        See your audience →
      </span>
    </div>
  );

  // Same borderless row idiom as ProofUnit's framed=false: -mx-2/px-2 keeps the content column
  // aligned to the card's 16px edge; the inset hover is the click feedback; 44px tap height.
  const rowClass = '-mx-2 flex items-center rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]';

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
