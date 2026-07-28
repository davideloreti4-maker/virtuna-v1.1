'use client';

/**
 * RunHeaderBlockRenderer — renders NOTHING, on purpose.
 *
 * The `run-header` block is the turn's RUN STAMP (which skill produced it + the inputs its intro
 * cites). It is METADATA consumed by <ThreadTurn>, which reads it to rebuild the voice layer —
 * ThreadIntro above the cards, the collapsed stage receipt, the skill-keyed outro follow-ups — all
 * of which used to be derived client-side from `activeTool` and therefore vanished on reload.
 *
 * ⚠️ It stays IN the block array rather than being filtered out before <MessageBlocks>, because the
 * ambient room's card ids are POSITIONAL: `buildAmbientDescriptors` indexes the same flat block
 * array that MessageBlocks renders, so dropping a block from one side and not the other shifts every
 * later card's `data-card-id` (see the `outlier-grid` filter in composer.tsx, which is applied to the
 * ledger AND the render for exactly this reason). Rendering null keeps the indices honest and the
 * DOM clean, with no filtering to keep in sync.
 */

export function RunHeaderBlockRenderer(): null {
  return null;
}
