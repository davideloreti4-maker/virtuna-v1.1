import type { Camera, GroupFrameLayout } from '../board-types';
import type { ComponentType } from 'react';

export interface ActionsNodeProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

export interface PlaceholderCardProps {
  label: string;
  phase: '6' | '7';
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  'data-testid'?: string;
}
