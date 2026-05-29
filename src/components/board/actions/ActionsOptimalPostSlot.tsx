'use client';
import { Clock } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';
import { OptimalPostCard } from './optimal-post/OptimalPostCard';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';
import { OPTIMAL_POST_COPY } from './optimal-post/optimal-post-constants';

interface Props {
  analysisId: string | null;
  /** True once the analysis row is available (data-presence gate, not stream phase). */
  ready: boolean;
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
}

export function ActionsOptimalPostSlot({ analysisId, ready, window: postWindow, override }: Props) {
  // OptimalPostCard needs an id (telemetry + override persistence); gate on both
  // data-readiness and a resolved analysisId rather than the lagging stream phase.
  if (!ready || !analysisId) {
    return (
      <PlaceholderCard
        label={OPTIMAL_POST_COPY.CARD_LABEL}
        phase="6"
        icon={Clock}
        data-testid="actions-optimal-post-placeholder"
      />
    );
  }

  // S-2 fix: add outer wrapper div with stable testid (analog to ActionsReshootHeroSlot).
  return (
    <div data-testid="actions-optimal-post-slot">
      <OptimalPostCard window={postWindow} override={override} analysisId={analysisId} />
    </div>
  );
}
