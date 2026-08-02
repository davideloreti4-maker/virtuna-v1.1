'use client';

/**
 * TargetReaction — "we aimed this at your skeptics, and here is what your skeptics said."
 *
 * This line is the entire visible payoff of per-persona generation. The audience was MEASURED not
 * to steer the WRITING as prompt context (handoff §4c: two independent methods, both at chance), so
 * the moat was selection-only and completely invisible on the card. Now the aim is STATED, and the
 * aimed-at reader's OWN verdict is the receipt that it landed.
 *
 * SHARED by every card that can be written for someone (hooks #299 → ideas, script). It is one
 * component and not three because the claim it makes is one claim: *this was written for this
 * person, and here is that person's reaction.* Three copies would drift, and the honesty rules below
 * are exactly the kind of thing that drifts.
 *
 * HONESTY: `verdict`/`quote` are looked up from the SIM panel, never invented. When the target
 * archetype did not appear in this run's panel, both are null and the line states the aim WITHOUT
 * claiming a reaction. A miss is shown as plainly as a hit — a card whose own target scrolled past
 * is the single most useful thing it can tell a creator, and hiding it would make the feature
 * decorative.
 *
 * F7: `label` is a CREATOR-SET name, snapshotted on the block, and it never went near the model.
 * When absent the name is derived HERE, at render, from `archetype` — so improving our archetype
 * vocabulary improves every card ever generated, instead of leaving old ones reading
 * "NICHE DEEP BUYER" forever. (The engine slug itself never changes.)
 */

import type { CardTarget } from '@/lib/tools/blocks';
import { archetypeDisplayName } from '@/lib/audience/archetype-names';

export function TargetReaction({ target }: { target: CardTarget }) {
  const { archetype, label, share, verdict, quote } = target;
  const stopped = verdict === 'stop';
  const displayName = label ?? archetypeDisplayName(archetype);

  // De-boxed 2026-08-02: was its own bordered box stacked among four other boxes on the card
  // face, all carrying the same visual weight. The aim is one quiet line; the (still honest,
  // still shown-when-present) reaction receipt rides the same line. "Made for", never
  // "Written for" (owner wording table).
  return (
    <p className="text-label leading-snug text-foreground-muted">
      Made for <span className="font-medium text-foreground-secondary">{displayName}</span>
      {' · '}
      {Math.round(share * 100)}% of your audience
      {verdict && (
        <>
          {' — '}
          <span className={stopped ? 'text-foreground-secondary' : undefined}>
            {stopped ? 'they stopped' : 'they scrolled past'}
          </span>
          {quote && <span> · “{quote}”</span>}
        </>
      )}
    </p>
  );
}
