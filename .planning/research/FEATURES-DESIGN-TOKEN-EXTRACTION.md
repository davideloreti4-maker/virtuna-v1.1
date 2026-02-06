# Feature Landscape: Design Token Alignment

**Domain:** Design system token correction (Raycast 1:1)
**Researched:** 2026-02-06

## Table Stakes

Tokens that MUST be correct for Raycast visual accuracy.

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| Inter font family | Raycast uses Inter exclusively. Wrong font = wrong everything | Low | Next.js has first-class Inter support via `next/font/google` |
| Grey scale (exact hex) | 12 grey values form the entire surface/text hierarchy | Low | Direct hex replacement in `@theme` block |
| Card gradient (137deg) | Cards are the most visible component | Low | Single token change + component audit |
| Body background (#07080a) | Already correct | None | No change needed |
| Border opacity (6%) | Already correct | None | No change needed |
| Glass gradient pattern | Already correct | None | No change needed |
| Card inset shadow (0.1) | Already correct | None | No change needed |
| Button shadow (light/4-layer) | Already present as `--shadow-button` | None | Verify exact match |
| Radius scale (4-24px) | Already present, values match | None | No change needed |
| Spacing scale (4-96px) | Already present, values match | None | No change needed |
| Letter-spacing (0.2px body) | Already correct | None | No change needed |

## Differentiators

Additional tokens that complete the system beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Button dark variant shadow | 3-layer ring shadow for secondary buttons | Low | New token definition |
| Button danger variant shadow | Red-tinted shadow for danger buttons | Low | New token definition |
| Modal overlay (0.6 black) | Consistent modal backdrop | Low | New token |
| Dark button gradient | `linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.1))` | Low | New token |
| Radial button gradient | For large featured buttons | Low | New token |
| AI chat window shadow | Heavy 3-layer shadow for complex modals | Low | New token |
| Heading text gradients | Purple-tinted and white-fade heading gradients | Medium | CSS gradient + `-webkit-background-clip: text` |
| Feature radial gradient | Colored radial background for feature sections | Low | Already partially present |
| Conic gradient (rainbow CTA) | Multi-color rotating gradient for CTAs | Medium | New, complex gradient definition |
| Loading shimmer gradient | Animated loading state gradient | Low | Already partially present |

## Anti-Features

Things to explicitly NOT replicate from Raycast.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| iOS 26 Liquid Glass references | Raycast is NOT iOS glass. It's clean/dark/minimal | Remove all "iOS 26" language from BRAND-BIBLE.md |
| Colored glass tints | Raycast glass is neutral only (no purple/blue/pink tints) | Remove `tint` prop color options from GlassPanel |
| GradientGlow component | Raycast does NOT use ambient colored glows behind elements | Remove or repurpose for accent-only use |
| GradientMesh component | Raycast does NOT use multi-color mesh backgrounds | Remove or limit to hero sections only |
| Multiple display fonts | Raycast uses ONE font (Inter). No heading vs body split | Remove Funnel Display entirely |
| Funnel Display font | Not used by Raycast | Replace with Inter weight 600-700 for headings |
| Satoshi font | Not used by Raycast | Replace with Inter weight 400-500 for body |
| Heavy blur (>20px) on cards | Raycast cards use solid gradients, not glass blur | Reserve glass blur for navbar/sidebar only |
| Inner glow on glass | Raycast uses a thin inset shadow, not a colored inner glow | Use `inset 0 1px 1px 0 rgba(255,255,255,0.15)` |
| Colored border glows | Raycast borders are always neutral white at opacity | Remove any colored border options |

## Feature Dependencies

```
Font Swap
  --> Grey Scale Correction (both affect text rendering)
  --> Body Line-Height Fix (font metrics affect line-height perception)

Card Gradient Fix
  --> Glow Effect Verification (gradient angle affects glow appearance)

Shadow System
  --> Button Component Update (shadows consumed by button variants)
  --> Modal Component Update (overlay + shadow tokens)

All Token Changes
  --> BRAND-BIBLE.md Update (documentation must match tokens)
  --> Component Visual Audit (verify all components still look correct)
```

## MVP Recommendation

For this token alignment milestone, prioritize:

1. **Font swap to Inter** -- Single highest visual impact change
2. **Grey scale hex correction** -- Fixes surface/text contrast
3. **Card gradient fix** -- Fixes most visible component
4. **Body line-height fix** -- Improves text readability
5. **BRAND-BIBLE.md rewrite** -- Documentation accuracy

Defer to post-alignment:
- Conic gradient CTAs: Complex, decorative only
- Loading shimmer: Only visible during loading states
- Heading text gradients: Nice-to-have, not structural
- Additional easing functions: Current easings work fine

## Sources

- Raycast CSS extraction (see STACK-DESIGN-TOKEN-EXTRACTION.md)
- Current Virtuna globals.css and BRAND-BIBLE.md analysis
