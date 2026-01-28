// src/types/society.ts
export interface PersonalSociety {
  id: string;
  name: string;
  description: string;
  type: 'personal';
  platform: 'linkedin' | 'x';
  needsSetup: boolean;
}

export interface TargetSociety {
  id: string;
  name: string;
  description: string;
  type: 'target';
  societyType: 'custom' | 'example';
  icon: 'briefcase' | 'coins' | 'users';
  members: number;
  createdAt: string;
}

export type Society = PersonalSociety | TargetSociety;

// Type guard functions
export function isPersonalSociety(society: Society): society is PersonalSociety {
  return society.type === 'personal';
}

export function isTargetSociety(society: Society): society is TargetSociety {
  return society.type === 'target';
}
