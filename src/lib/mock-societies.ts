// src/lib/mock-societies.ts
import type { PersonalSociety, TargetSociety, Society } from '@/types/society';

export const INITIAL_PERSONAL_SOCIETIES: PersonalSociety[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Your personal LinkedIn network built around your connections.',
    type: 'personal',
    platform: 'linkedin',
    needsSetup: true,
  },
  {
    id: 'x',
    name: 'X (formerly Twitter)',
    description: 'Your X network built around your followers.',
    type: 'personal',
    platform: 'x',
    needsSetup: true,
  },
];

export const INITIAL_TARGET_SOCIETIES: TargetSociety[] = [
  {
    id: 'zurich-founders',
    name: 'Zurich Founders',
    description: 'Entrepreneurs and startup founders in Zurich.',
    type: 'target',
    societyType: 'custom',
    icon: 'briefcase',
    members: 156,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'startup-investors',
    name: 'Startup Investors',
    description: 'Individuals investing in early-stage companies.',
    type: 'target',
    societyType: 'example',
    icon: 'coins',
    members: 342,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_SOCIETIES: Society[] = [
  ...INITIAL_PERSONAL_SOCIETIES,
  ...INITIAL_TARGET_SOCIETIES,
];
