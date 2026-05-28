'use client';
import { FilmScript } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';

interface Props {
  className?: string;
  style?: React.CSSProperties;
}

export function ActionsReshootHeroSlot({ className, style }: Props) {
  // Phase 5: dashed placeholder. Phase 6 swaps inner content for real reshoot UI.
  // `className` lets the parent grid apply `col-span-2` in AV state without this component knowing the parent layout.
  return (
    <div className={className} style={style} data-testid="actions-reshoot-hero-slot">
      <PlaceholderCard
        label="Reshoot script"
        phase="6"
        icon={FilmScript}
        data-testid="actions-reshoot-placeholder"
      />
    </div>
  );
}
