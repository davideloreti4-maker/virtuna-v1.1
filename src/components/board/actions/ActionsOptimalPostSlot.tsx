'use client';
import { Clock } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';

export function ActionsOptimalPostSlot() {
  return (
    <PlaceholderCard
      label="When to post"
      phase="6"
      icon={Clock}
      data-testid="actions-optimal-post-placeholder"
    />
  );
}
