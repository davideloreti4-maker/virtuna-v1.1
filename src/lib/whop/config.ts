/**
 * Whop integration configuration and tier management utilities
 */

export type VirtunaTier = 'free' | 'starter' | 'pro';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';

export const TIER_HIERARCHY = {
  free: 0,
  starter: 1,
  pro: 2,
} as const;

export const WHOP_PRODUCT_IDS = {
  starter: process.env.WHOP_PRODUCT_ID_STARTER!,
  pro: process.env.WHOP_PRODUCT_ID_PRO!,
};

export function mapWhopProductToTier(productId: string): VirtunaTier {
  if (productId === WHOP_PRODUCT_IDS.starter) return 'starter';
  if (productId === WHOP_PRODUCT_IDS.pro) return 'pro';
  return 'free';
}

export function hasAccessToTier(
  userTier: VirtunaTier,
  requiredTier: VirtunaTier
): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}
