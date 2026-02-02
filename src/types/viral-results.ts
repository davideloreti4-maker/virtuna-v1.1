/**
 * Viral Prediction Results Types
 *
 * Type definitions for the viral prediction analysis system.
 * Used by ViralScoreRing and other results card components.
 */

// Tier labels with score thresholds - 6 tiers for nuanced feedback
export type ViralTier =
  | "Viral Ready" // 85-100: Top tier, ready to blow up
  | "High Potential" // 70-84: Strong viral indicators
  | "Promising" // 55-69: Good foundation, needs refinement
  | "Moderate" // 40-54: Average content
  | "Low Potential" // 25-39: Needs significant work
  | "Unlikely"; // 0-24: Missing key viral elements

// Tier configuration with colors and thresholds
export interface TierConfig {
  min: number;
  max: number;
  color: string; // Tailwind text color class
  ringColor: string; // Hex color for SVG gradient
}

export const VIRAL_TIERS: Record<ViralTier, TierConfig> = {
  "Viral Ready": {
    min: 85,
    max: 100,
    color: "text-emerald-400",
    ringColor: "#34d399",
  },
  "High Potential": {
    min: 70,
    max: 84,
    color: "text-green-400",
    ringColor: "#4ade80",
  },
  Promising: {
    min: 55,
    max: 69,
    color: "text-lime-400",
    ringColor: "#a3e635",
  },
  Moderate: {
    min: 40,
    max: 54,
    color: "text-yellow-400",
    ringColor: "#facc15",
  },
  "Low Potential": {
    min: 25,
    max: 39,
    color: "text-orange-400",
    ringColor: "#fb923c",
  },
  Unlikely: {
    min: 0,
    max: 24,
    color: "text-red-400",
    ringColor: "#f87171",
  },
};

// Individual factor in the breakdown (for detailed analysis)
export interface ViralFactor {
  id: string;
  name: string; // e.g., "Hook Strength", "Emotional Triggers"
  score: number; // 1-10 scale
  maxScore: number; // Usually 10
  description: string; // Short explanation
  details?: string; // Expanded content for accordion
  tips?: string[]; // Actionable improvement suggestions
}

// Confidence level for transparency
export type ConfidenceLevel = "High" | "Medium" | "Low";

// Main viral result interface
export interface ViralResult {
  id: string;
  overallScore: number; // 0-100
  tier: ViralTier;
  confidence: ConfidenceLevel;
  confidenceReason?: string; // "Based on X data points"
  factors: ViralFactor[];
  generatedAt: Date;
}

/**
 * Get the tier label from a numeric score
 * @param score - Score between 0-100
 * @returns The corresponding ViralTier label
 */
export function getTierFromScore(score: number): ViralTier {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  const entries = Object.entries(VIRAL_TIERS) as [ViralTier, TierConfig][];
  for (const [tier, config] of entries) {
    if (clampedScore >= config.min && clampedScore <= config.max) {
      return tier;
    }
  }
  return "Unlikely"; // Fallback for edge cases
}

/**
 * Get tier configuration from a score
 * @param score - Score between 0-100
 * @returns The tier config with colors and thresholds
 */
export function getTierConfig(score: number): TierConfig {
  const tier = getTierFromScore(score);
  return VIRAL_TIERS[tier];
}
