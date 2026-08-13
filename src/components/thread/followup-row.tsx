'use client';

/**
 * FollowupRow — the row of "what next" chips shown after any completed skill turn.
 *
 * A DIFFERENT visual TYPE from the card's forward CTA on purpose (owner, 2026-07-22: "add followup
 * actions everywhere in a different type than the buttons"). The card's primary action is a SOLID
 * tonal button (the single forward step — "Write the script →"); these are GHOST PILLS (rounded-full,
 * transparent, secondary text) offering the ALTERNATIVES — more / a sharper shape / jump ahead / fix
 * a weakness / ask about it. The two never read as the same control, so the one true next step still
 * wins the glance while the options stay one tap away.
 *
 * Each chip sends a NEW chat MESSAGE into the thread (onFollowup) — the agent routes it. The copy is
 * curated per skill in chat-followups.ts. Shared by ChatThreadView (chat-agent turns) and ThreadOutro
 * (the standalone skill views), so every skill shows the same treatment.
 *
 * onFollowup is optional: in the /dev/cards gallery the views render with no handler, so the pills
 * show for visual review but do nothing on tap. In production the composer wires the real send.
 */

import type { ChatFollowup } from '@/lib/tools/chat-followups';
import { useFollowupHandler } from '@/lib/followup-context';

export function FollowupRow({
  followups,
  onFollowup,
  cardLines,
  className,
}: {
  followups: ChatFollowup[];
  /**
   * Explicit send handler (ChatThreadView passes its own). Falls back to FollowupContext when omitted.
   * The second argument is the chip's declared generator — see ChatFollowup.skill.
   */
  onFollowup?: (prompt: string, skill?: string, opts?: { cards?: string[] }) => void;
  /**
   * Stage B (B2): the card lines of the turn this row sits under (cardLinesOf), sent along by
   * chips that declare `carryCards` so "rewrite these" can see "these". Optional — a row with
   * no lines (or a chip without the marker) sends exactly what it always sent.
   */
  cardLines?: string[];
  className?: string;
}) {
  const ctxHandler = useFollowupHandler();
  const handler = onFollowup ?? ctxHandler;
  if (!followups.length) return null;
  return (
    // `pointer-coarse:gap-y-4` is LOAD-BEARING, not spacing taste. The chips below carry
    // `.tap-44`, whose halo is 44px tall around a 29px pill — 7.5px of overhang each side. At
    // `gap-2` (8px) two WRAPPED rows would overlap their halos by ~7px, and the later chip in DOM
    // order wins the tap: aiming at the chip above would fire the one below it. 16px clears it
    // (29 + 16 = 45 > 44). Horizontal gap needs nothing — every chip is wider than 44px, so the
    // halo never grows sideways. Touch only; a mouse keeps the tight row.
    <div className={`flex flex-wrap gap-2 pointer-coarse:gap-y-4 ${className ?? ''}`} data-testid="followup-row">
      {followups.map((f) => (
        <button
          key={f.label}
          type="button"
          onClick={() => {
            // A chip with no pack to carry calls the handler with exactly the arity it always did:
            // Stage B is invisible to every chip that is not a rewrite, and to every rewrite chip
            // sitting under a turn that produced no cards.
            const pack = f.carryCards && cardLines?.length ? cardLines : null;
            if (pack) handler?.(f.prompt, f.skill, { cards: pack });
            else handler?.(f.prompt, f.skill);
          }}
          // `tap-44`: measured 29px tall on a phone (F-19). The pill's drawn height is the row's
          // rhythm, so the halo grows and the pill does not. See the wrap-gap note above.
          className="tap-44 inline-flex items-center rounded-full border border-white/[0.08] bg-transparent px-3 py-1.5 text-label font-medium leading-snug text-foreground-secondary transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15"
          aria-label={`Follow up: ${f.label}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
