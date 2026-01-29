// src/lib/mock-data.ts
import type { ImpactLabel, Variant, ConversationTheme } from '@/types/test';

/**
 * Get impact label based on score
 */
export function getImpactLabel(score: number): ImpactLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * AI variant templates for different improvement strategies
 */
const AI_VARIANT_TEMPLATES = [
  {
    label: 'More engaging hook',
    prefix: 'Discover how ',
    suffix: ' can transform your approach.',
  },
  {
    label: 'Direct approach',
    prefix: "Here's the truth: ",
    suffix: ' - and it works.',
  },
  {
    label: 'Emotional appeal',
    prefix: 'Imagine if ',
    suffix: ' was finally within reach.',
  },
  {
    label: 'Data-driven',
    prefix: 'Studies show that ',
    suffix: ' increases results by 40%.',
  },
  {
    label: 'Social proof',
    prefix: 'Join thousands who have discovered ',
    suffix: ' for themselves.',
  },
];

/**
 * Generate mock variants from original content
 * Returns original + 2 AI-generated variants
 */
export function generateMockVariants(originalContent: string): Variant[] {
  // Original score tends to be lower
  const originalScore = Math.floor(Math.random() * 20) + 50; // 50-70

  // Pick 2 random templates for AI variants
  const shuffled = [...AI_VARIANT_TEMPLATES].sort(() => Math.random() - 0.5);
  const selectedTemplates = shuffled.slice(0, 2);

  // Extract key phrase from original content (first 30 chars or first sentence)
  const keyPhrase = originalContent.length > 30
    ? originalContent.substring(0, 30).trim()
    : originalContent.split('.')[0] || originalContent;

  const variants: Variant[] = [
    {
      id: `var_${generateId()}`,
      type: 'original',
      content: originalContent,
      impactScore: originalScore,
    },
  ];

  // Add AI variants with better scores
  selectedTemplates.forEach((template, index) => {
    const scoreBoost = Math.floor(Math.random() * 15) + (index === 0 ? 10 : 15);
    variants.push({
      id: `var_${generateId()}`,
      type: 'ai-generated',
      content: `${template.prefix}${keyPhrase.toLowerCase()}${template.suffix}`,
      impactScore: Math.min(originalScore + scoreBoost, 98), // Cap at 98
      label: template.label,
    });
  });

  // Sort by impact score (highest first)
  return variants.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Insight templates with randomized fills
 */
const INSIGHT_TEMPLATES = [
  [
    'Your content resonates strongly with the target audience, particularly among professionals aged {age}.',
    'The message achieves a {pct}% engagement rate with decision-makers in your target demographic.',
    'Key themes align well with current market sentiment and audience priorities.',
  ],
  [
    'The opening hook captures attention effectively, with {pct}% of simulated users reading past the first line.',
    'Emotional triggers in the content drive {multiplier}x more engagement than industry baseline.',
    'The narrative flow maintains reader interest through the core message.',
  ],
  [
    'Consider adding more specific data points to strengthen credibility with skeptical readers.',
    'A/B testing suggests that leading with social proof could improve impact by {pct}%.',
    'The call-to-action placement could be optimized for higher conversion rates.',
  ],
  [
    'Visual content suggestions: Consider adding supporting imagery to increase engagement by up to {pct}%.',
    'Mobile readability scores indicate room for improvement in sentence structure.',
    'Timing analysis suggests optimal posting windows for your target audience.',
  ],
];

/**
 * Generate 3-4 realistic insight paragraphs
 */
export function generateMockInsights(): string[] {
  const numInsights = Math.random() > 0.5 ? 4 : 3;
  const selectedGroups = [...INSIGHT_TEMPLATES]
    .sort(() => Math.random() - 0.5)
    .slice(0, numInsights);

  return selectedGroups.map((group) => {
    // Pick a random insight from the group (guaranteed non-empty)
    const template = group[Math.floor(Math.random() * group.length)]!;

    // Fill in placeholders
    return template
      .replace('{age}', `${25 + Math.floor(Math.random() * 20)}-${45 + Math.floor(Math.random() * 15)}`)
      .replace('{pct}', String(Math.floor(Math.random() * 30) + 60))
      .replace('{multiplier}', String((Math.random() * 2 + 1.5).toFixed(1)));
  });
}

/**
 * Theme configurations
 */
const THEME_CONFIGS = [
  {
    title: 'Professional Appeal',
    description: 'Content appeals to career-focused individuals seeking growth opportunities.',
    quotes: [
      '"This speaks to my professional goals"',
      '"I can see how this would help my career"',
      '"The business value is clear"',
      '"This aligns with our company direction"',
    ],
  },
  {
    title: 'Value Clarity',
    description: 'The value proposition is clear and compelling to the target audience.',
    quotes: [
      '"I understand exactly what they\'re offering"',
      '"The benefits are clearly outlined"',
      '"This addresses my specific needs"',
      '"No confusion about what I\'d get"',
    ],
  },
  {
    title: 'Emotional Connection',
    description: 'Emotional elements resonate with audience aspirations and pain points.',
    quotes: [
      '"This really gets how I feel"',
      '"They understand my struggles"',
      '"I felt seen reading this"',
      '"This touched on something personal"',
    ],
  },
  {
    title: 'Trust Signals',
    description: 'Credibility markers and social proof build confidence in the message.',
    quotes: [
      '"The credentials are impressive"',
      '"Others have had success with this"',
      '"I trust the source"',
      '"The data backs up the claims"',
    ],
  },
  {
    title: 'Urgency & Action',
    description: 'Content creates appropriate urgency without being pushy.',
    quotes: [
      '"I feel motivated to act now"',
      '"The timing feels right"',
      '"I don\'t want to miss this"',
      '"Clear next steps make it easy"',
    ],
  },
];

/**
 * Generate 2-3 conversation themes with quotes
 */
export function generateMockThemes(): ConversationTheme[] {
  const numThemes = Math.random() > 0.4 ? 3 : 2;

  // Shuffle and select themes
  const shuffled = [...THEME_CONFIGS].sort(() => Math.random() - 0.5);
  const selectedThemes = shuffled.slice(0, numThemes);

  // Generate percentages that roughly sum to 100
  let remainingPct = 100;
  const themes = selectedThemes.map((config, index) => {
    const isLast = index === selectedThemes.length - 1;
    const pct = isLast
      ? remainingPct
      : Math.floor(Math.random() * 30) + 25; // 25-55%
    remainingPct -= pct;

    // Pick 2-3 random quotes
    const numQuotes = Math.random() > 0.5 ? 3 : 2;
    const quotes = [...config.quotes]
      .sort(() => Math.random() - 0.5)
      .slice(0, numQuotes);

    return {
      id: `theme_${generateId()}`,
      title: config.title,
      percentage: pct,
      description: config.description,
      quotes,
    };
  });

  // Sort by percentage (highest first)
  return themes.sort((a, b) => b.percentage - a.percentage);
}
