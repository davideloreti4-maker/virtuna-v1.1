# Phase 2: Plan - Dark Theme Conversion Completion

## Date: 2026-01-27

## Summary
The dark theme conversion is 99% complete. Only one minor fix needed.

## Changes Required

### 1. Fix Login Page Email Link Color
**File**: `src/app/(auth)/login/page.tsx`
**Line**: 67
**Current**: `text-gray-400`
**Change to**: `text-app-text-muted` (consistent with auth theme)

## Order of Changes
1. Update login page link color

## Risks
- **Low risk**: This is a minor color consistency fix
- The auth pages already use the app (dark) theme

## Verification Criteria
1. No remaining `text-gray-*` patterns in any component files
2. Build succeeds without errors
3. All text is readable on dark backgrounds
4. Orange accent (#F97316) visible for CTAs and "Simulated." text

## Files Already Updated (for reference)
- [x] globals.css - Landing theme variables
- [x] header.tsx - Dark header
- [x] page.tsx - Landing page
- [x] footer.tsx - Dark footer
- [x] card.tsx - Dark cards
- [x] skeleton.tsx - Dark skeleton
- [x] button.tsx - Dark variants
- [x] input.tsx - Dark input
- [x] showcase/page.tsx - Showcase dark theme
- [ ] login/page.tsx - Minor fix needed
