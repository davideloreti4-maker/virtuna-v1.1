---
status: partial
phase: 01-foundation-shell
source: [01-VERIFICATION.md]
started: "2026-06-14T19:02:59Z"
updated: "2026-06-14T19:02:59Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Flat-warm look at `/`
expected: Calm dark charcoal (#262624) surface, cream (#ece7de) text, one terracotta-clay coral (#d97757) CTA; header is a flat opaque bar with a hairline bottom border (NOT a glass pill); footer is flat with a hairline top border. No frosted/blurred/glowing surfaces anywhere (flat-matte).
result: [pending]

### 2. Mobile header collapse (<768px)
expected: Desktop nav links + Sign in/Try it free hide under ~768px; a Menu icon-button appears; tapping it reveals a flat charcoal panel with the anchors + Sign in + a full-width Try it free; tapping any link closes the panel and navigates to the anchor.
result: [pending]

### 3. Reduced-motion fallback
expected: With `prefers-reduced-motion: reduce` emulated, all non-Framer CSS animations (skeleton-breathe / shimmer / marquee) halt (animation: none); Framer motion elements drop transform/layout animation while keeping opacity. Nothing janky; nothing load-bearing fails to appear.
result: [pending]

### 4. In-page anchor navigation
expected: Each header nav link (How it works · The Simulation · Pricing · FAQ) and each footer Product link scrolls/jumps to the matching anchored section (#how-it-works, #the-simulation, #pricing, #faq); the logo links back to #hero.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
