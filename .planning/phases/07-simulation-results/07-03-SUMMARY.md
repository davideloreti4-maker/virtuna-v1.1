---
phase: 07-simulation-results
plan: 03
subsystem: types-and-data
tags: [typescript, mock-data, types, zustand]
completed: 2026-01-29
duration: ~4 minutes

dependencies:
  requires:
    - 06-04: Test store foundation
  provides:
    - Extended TestResult with variants/insights/themes
    - Mock data generators for realistic results
  affects:
    - 07-04: Results panel will consume mock data

tech-stack:
  added: []
  patterns:
    - Randomized mock data templates
    - Non-null assertion for guaranteed arrays

key-files:
  created:
    - src/lib/mock-data.ts
  modified:
    - src/types/test.ts
    - src/stores/test-store.ts

decisions:
  - id: impact-label-thresholds
    choice: "85/70/55/40 for Excellent/Good/Average/Below Average"
  - id: variant-count
    choice: "Original + 2 AI variants per result"
  - id: insight-count
    choice: "3-4 randomized insights per result"
  - id: theme-count
    choice: "2-3 themes with 2-3 quotes each"

metrics:
  tasks: 2
  commits: 2
  files_changed: 3
---

# Phase 07 Plan 03: Extended TestResult and Mock Data Summary

Extended TestResult interface with variants/insights/themes, created mock data generators

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5ce4ee6 | feat | Extend TestResult with variants, insights, themes |
| 9343c12 | feat | Create mock data generators module |

## What Was Built

### Task 1: Extended Types (src/types/test.ts)

Added new type definitions:

```typescript
export type ImpactLabel = 'Poor' | 'Below Average' | 'Average' | 'Good' | 'Excellent';

export interface Variant {
  id: string;
  type: 'original' | 'ai-generated';
  content: string;
  impactScore: number;
  label?: string;
}

export interface ConversationTheme {
  id: string;
  title: string;
  percentage: number;
  description: string;
  quotes: string[];
}
```

Extended TestResult interface:
- `impactLabel: ImpactLabel` - Human-readable score category
- `variants: Variant[]` - Original + AI-generated content variants
- `insights: string[]` - AI-generated analysis insights
- `conversationThemes: ConversationTheme[]` - Themes from simulated conversations

### Task 2: Mock Data Generators (src/lib/mock-data.ts)

Created four exported functions:

1. **getImpactLabel(score)** - Converts numeric score to label
   - >= 85: Excellent
   - >= 70: Good
   - >= 55: Average
   - >= 40: Below Average
   - else: Poor

2. **generateMockVariants(content)** - Returns 3 variants
   - Original content at 50-70 score
   - 2 AI variants with labels like "More engaging hook", "Direct approach"
   - AI variants score 5-25 points higher

3. **generateMockInsights()** - Returns 3-4 insights
   - Uses templates with randomized placeholders
   - Templates cover engagement, audience fit, recommendations

4. **generateMockThemes()** - Returns 2-3 themes
   - Themes: Professional Appeal, Value Clarity, Emotional Connection, Trust Signals, Urgency & Action
   - Each with percentage, description, and 2-3 quotes
   - Percentages sum to ~100%

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test-store for new TestResult fields**
- **Found during:** Task 1 build verification
- **Issue:** TestResult interface extension broke existing test-store.ts
- **Fix:** Added inline mock generators to test-store to satisfy new required fields
- **Files modified:** src/stores/test-store.ts
- **Commit:** 5ce4ee6

## Verification

- [x] Build succeeds: `npm run build`
- [x] Types export correctly from @/types/test
- [x] Mock data functions exported from @/lib/mock-data

## Success Criteria Met

- [x] TestResult interface extended with variants, insights, conversationThemes
- [x] ImpactLabel type defined with 5 levels
- [x] generateMockVariants returns original + 2 AI variants
- [x] generateMockInsights returns 3-4 realistic insights
- [x] generateMockThemes returns 2-3 themes with quotes

## Next Steps

- Plan 07-04: Build results panel UI that consumes these types
- Integrate mock-data.ts imports into test-store (replace inline generators)
