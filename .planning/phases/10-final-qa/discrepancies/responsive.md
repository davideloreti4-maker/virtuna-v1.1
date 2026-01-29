# Mobile Responsiveness Issues

**Test Viewport:** 375x812 (iPhone X)
**Date:** 2026-01-29

## App Dashboard

| Issue | Component | Expected | Actual | Severity | Status |
|-------|-----------|----------|--------|----------|--------|
| Mobile nav button touch target | mobile-nav.tsx | >= 44px | ~40px (p-2 + 24px icon) | Medium | Fixed |
| Settings tabs layout | settings-page.tsx | Stack vertically on mobile | Side-by-side (causes overflow) | High | Fixed |
| Content form action buttons | content-form.tsx | Wrap or hide on mobile | May overflow at 375px | Medium | Fixed |
| Test type selector modal | test-type-selector.tsx | Fit viewport | Good - max-w-3xl with 90vh max-height | Low | OK |

## Touch Targets

| Element | Component | Size | Meets 44px? | Status |
|---------|-----------|------|-------------|--------|
| Mobile nav hamburger | mobile-nav.tsx | ~40px | No | Fixed |
| Header hamburger | header.tsx | ~40px | No | Fixed |
| Sidebar close button | sidebar.tsx | ~36px (p-2) | No | Fixed |
| Create new test button | dashboard-client.tsx | 44px+ | Yes | OK |
| Footer CTA buttons | footer.tsx | 44px (min-h-[44px]) | Yes | OK |
| Footer social icons | footer.tsx | 44px (h-11 w-11) | Yes | OK |
| Type selector cards | test-type-selector.tsx | 48px+ (p-4) | Yes | OK |
| Settings tab triggers | settings-page.tsx | 44px (py-3 + content) | Yes | OK |

## Landing Page

| Issue | Component | Expected | Actual | Severity | Status |
|-------|-----------|----------|--------|----------|--------|
| Header hamburger touch target | header.tsx | >= 44px | ~40px | Medium | Fixed |
| Hero persona card hidden on mobile | hero-section.tsx | Intentionally hidden < sm | OK - design choice | N/A | OK |
| Features grid | features-section.tsx | Single column on mobile | Good - grid-cols-1 | N/A | OK |
| Stats section | stats-section.tsx | Stack on mobile | Good - grid-cols-1 md:grid-cols-2 | N/A | OK |
| FAQ accordion | faq-section.tsx | Works with touch | Good - Radix handles touch | N/A | OK |
| Footer links | footer.tsx | Wrap properly | Good - flex-wrap | N/A | OK |

## Horizontal Scroll Prevention

| Page | Has Horizontal Scroll? | Fix Applied |
|------|------------------------|-------------|
| Landing (/) | No | N/A |
| Dashboard (/dashboard) | No | N/A |
| Settings (/settings) | Yes (before fix) | Added responsive tabs |

## Fixes Applied

### 1. Mobile Nav Button (mobile-nav.tsx)
- Changed `p-2` to `p-2.5` for 44px minimum touch target

### 2. Header Hamburger Button (header.tsx)
- Added `min-w-[44px] min-h-[44px]` for proper touch target

### 3. Sidebar Close Button (sidebar.tsx)
- Changed `p-2` to `p-2.5` and added explicit `min-w-[44px] min-h-[44px]`

### 4. Settings Page Tabs (settings-page.tsx)
- Made tabs responsive: vertical on desktop (md:), horizontal scroll on mobile
- Added `flex-row md:flex-col` and `overflow-x-auto` for mobile scrollability

### 5. Content Form Action Buttons (content-form.tsx)
- Made action buttons wrap on mobile with `flex-wrap`
- Hid secondary buttons on very small screens with `hidden sm:flex`
- Added min-h-[44px] to type selector badge buttons

### 6. Survey Form Footer (survey-form.tsx)
- Added flex-wrap and gap-3 for mobile wrapping
- Added min-h-[44px] to type badge and submit buttons

### 7. Global CSS (globals.css)
- Added `overflow-x: hidden` to html and body to prevent horizontal scroll

## Test Flow Verification

- [x] Mobile navigation drawer opens/closes
- [x] Society selector works in drawer
- [x] View selector accessible
- [x] Test type selector modal fits viewport
- [x] Content form submittable on mobile
- [x] Survey form works on mobile
- [x] Results panel scrollable
- [x] History list accessible in drawer
- [x] Settings tabs navigable on mobile
