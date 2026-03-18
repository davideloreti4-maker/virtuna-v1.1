// Model tier definitions for Apollo and Oracle

export type ApolloTier = 'lite' | 'pro' | 'ultra';
export type ModelFamily = 'apollo' | 'oracle';

export interface ApolloTierConfig {
  id: ApolloTier;
  name: string;
  fullName: string;
  nodeCount: 300 | 1000 | 10000;
  description: string;
  databaseCopy: string;
  recommended?: boolean;
}

export const APOLLO_TIERS: ApolloTierConfig[] = [
  {
    id: 'lite',
    name: 'Lite',
    fullName: 'Apollo 1.5 Lite',
    nodeCount: 300,
    description: 'Fast, efficient analysis for quick predictions',
    databaseCopy: 'Scans 10M+ videos for quick pattern matching',
  },
  {
    id: 'pro',
    name: 'Pro',
    fullName: 'Apollo 1.5 Pro',
    nodeCount: 1000,
    description: 'Balanced depth and speed. Recommended for most content.',
    databaseCopy: 'Analyzes 10M+ videos for behavioral predictions',
    recommended: true,
  },
  {
    id: 'ultra',
    name: 'Ultra',
    fullName: 'Apollo 1.5 Ultra',
    nodeCount: 10000,
    description: 'Maximum simulation depth. Most accurate predictions.',
    databaseCopy: 'Deep-scans 10M+ videos across all engagement signals',
  },
];

export const NODE_COUNT_MAP: Record<ApolloTier, 300 | 1000 | 10000> = {
  lite: 300,
  pro: 1000,
  ultra: 10000,
};

export const ORACLE_CONFIG = {
  name: 'Oracle',
  description: 'Predict real-world outcomes beyond content performance.',
  accentColor: 'oklch(0.55 0.18 285)',
};
