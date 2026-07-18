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

  return (
    <div className="flex flex-col gap-1 rounded-[8px] border border-white/[0.06] px-3 py-2">
      <p className="text-[12px] leading-snug text-foreground-secondary">
        <span className="text-foreground-muted">Written for </span>
        <span className="font-medium text-foreground">{displayName}</span>
        <span className="text-foreground-muted"> · {Math.round(share * 100)}% of your audience</span>
      </p>

      {/* The receipt. No verdict in the panel → state the aim, claim nothing about the reaction. */}
      {verdict && (
        <p className="text-[12.5px] leading-relaxed text-foreground-secondary">
          <span className={stopped ? 'font-medium text-foreground' : 'text-foreground-muted'}>
            {stopped ? 'They stopped' : 'They scrolled past'}
          </span>
          {quote && <span className="text-foreground-muted"> — “{quote}”</span>}
        </p>
      )}
    </div>
  );
}
