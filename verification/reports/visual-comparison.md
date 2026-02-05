# Visual Comparison Report

**Date:** 2026-02-05
**Virtuna URL:** http://localhost:3000
**Raycast Baseline:** Phase 39 extraction screenshots (2026-02-03)
**Viewport:** 1440x900 (desktop)

## Summary

- **8** pages captured
- **4** individual sections captured
- **3** comparisons against Raycast baseline generated
- Raycast baseline: AVAILABLE

## Capture Overview

| Page | Screenshot | Size | Diff Available |
|------|-----------|------|----------------|
| Homepage | Captured | 135KB | Yes |
| /showcase (Tokens) | Captured | 884KB | No |
| /showcase/inputs | Captured | 502KB | No |
| /showcase/navigation | Captured | 422KB | No |
| /showcase/feedback | Captured | 437KB | No |
| /showcase/data-display | Captured | 738KB | No |
| /showcase/layout-components | Captured | 446KB | No |
| /showcase/utilities | Captured | 943KB | No |

## Page-by-Page Comparison

### Homepage

**Screenshot:** screenshots/virtuna/homepage.png
**Raycast baseline:** .planning/phases/39-token-foundation/screenshots/02-homepage-hero.png
**Diff:** screenshots/diffs/diff-homepage.png
**Pixel difference:** 19.1% (247'503 of 1'296'000 pixels)

**Observations:**
- Full homepage rendered with all sections (Hero, Backers, Features, Stats, CaseStudy, Partnership, FAQ) + Footer
- Structural comparison: both sites use dark backgrounds, centered hero text, and full-width sections
- Coral accent color (#FF7F50) used for CTAs and highlights -- INTENTIONAL difference from Raycast red (#FF6363)
- Font stack uses Funnel Display (headings) and Satoshi (body) -- INTENTIONAL difference

**Sections:**

#### Hero Section

- **Screenshot:** screenshots/virtuna/homepage-hero.png
- **Size:** 70KB
- **Diff:** screenshots/diffs/diff-homepage-hero.png
- **Pixel difference:** 20.18% (242'985 of 1'203'840 pixels)

#### Features Section

- **Screenshot:** screenshots/virtuna/homepage-features.png
- **Size:** 20KB
- **Diff:** screenshots/diffs/diff-homepage-features.png
- **Pixel difference:** 1.08% (12'201 of 1'126'080 pixels)

#### Stats Section

- **Screenshot:** screenshots/virtuna/homepage-stats.png
- **Size:** 25KB

#### Footer

- **Screenshot:** screenshots/virtuna/homepage-footer.png
- **Size:** 39KB


### /showcase (Tokens)

**Screenshot:** screenshots/virtuna/showcase-tokens.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Token swatches display live CSS variable values with color previews
- Covers all token categories: colors, typography, spacing, shadows, radius, animation, gradients

### /showcase/inputs

**Screenshot:** screenshots/virtuna/showcase-inputs.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Input components rendered with visual states (default, focused, disabled, error)
- Select and SearchableSelect shown with dropdown variations

### /showcase/navigation

**Screenshot:** screenshots/virtuna/showcase-navigation.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Tabs and CategoryTabs demonstrate Radix-based active state styling
- Kbd and ShortcutBadge show Raycast-accurate keyboard shortcut rendering

### /showcase/feedback

**Screenshot:** screenshots/virtuna/showcase-feedback.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Badge variants, Toast positions, Dialog sizes, and Spinner states displayed
- Interactive demos use client island pattern for server component compatibility

### /showcase/data-display

**Screenshot:** screenshots/virtuna/showcase-data-display.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Avatar, AvatarGroup, Skeleton, Card, GlassCard, ExtensionCard, TestimonialCard showcased
- GlassCard demos use colored gradient backgrounds to demonstrate blur effect

### /showcase/layout-components

**Screenshot:** screenshots/virtuna/showcase-layout-components.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- GlassPanel shown with all 7 blur levels (none through 2xl) and tint variants
- Divider component with horizontal and vertical orientations

### /showcase/utilities

**Screenshot:** screenshots/virtuna/showcase-utilities.png

**Observations:**
- Showcase page uses sidebar navigation layout (hidden on mobile, visible on desktop)
- Dark theme matches Raycast design language: near-black background, subtle borders, muted secondary text
- Motion components (FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale) shown with static previews
- Effects (NoiseTexture, ChromaticAberration) and decorative components (GradientGlow, GradientMesh, TrafficLights)

## Intentional Differences

The following differences from Raycast are by design:

1. **Brand color:** Coral (#FF7F50) replaces Raycast red (#FF6363)
2. **Typography:** Funnel Display / Satoshi fonts replace Raycast's font stack
3. **Content:** Virtuna branding, copy, and imagery differ entirely
4. **Layout structure:** Some sections reorganized for Virtuna's product narrative

## Notes

- All screenshots captured at 1440x900 viewport with dark color scheme
- CSS animations and transitions disabled via injected styles
- Playwright `reducedMotion: 'reduce'` enabled for Framer Motion suppression
- Diff threshold: 0.3 (allows some anti-aliasing and subpixel tolerance)
- Diff images highlight pixel differences in red/yellow overlay

---
*Generated by visual-comparison.spec.ts on 2026-02-05*
