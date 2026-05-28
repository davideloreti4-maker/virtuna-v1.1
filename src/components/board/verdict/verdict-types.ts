import type { Camera, GroupFrameLayout } from '../board-types';

export interface VerdictNodeProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

export type Band = 'Strong' | 'Mid' | 'Low';
