'use client';
import { ShareNetwork } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';

export function ActionsShareSlot() {
  return (
    <PlaceholderCard
      label="Share & export"
      phase="7"
      icon={ShareNetwork}
      data-testid="actions-share-placeholder"
    />
  );
}
