'use client';
import { Clock } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';
import { OptimalPostCard } from './optimal-post/OptimalPostCard';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';
import { OPTIMAL_POST_COPY } from './optimal-post/optimal-post-constants';

interface Props {
  analysisId: string | null;
  phase: string;
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
}

export function ActionsOptimalPostSlot({ analysisId, phase, window: postWindow, override }: Props) {
  // Pre-complete phase: keep Phase 5 placeholder for streaming-test continuity.
  if (phase !== 'complete' || !analysisId) {
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
