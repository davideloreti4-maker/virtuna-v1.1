---
status: partial
phase: 02-board-substrate-navigation
source: [02-VERIFICATION.md]
started: 2026-05-26T10:15:00Z
updated: 2026-05-26T10:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Board renders 6 group container frames
expected: All 6 frames visible at world-space coordinates, preview-greyed in idle state (Input, Engine, Audience, Verdict, Actions, Content Analysis)
result: [pending]

### 2. Desktop pan/zoom
expected: Canvas pans with click+drag; zooms with scroll wheel; URL updates ?focus=&zoom=X.XX after 200ms debounce
result: [pending]

### 3. Mobile portrait pan/zoom
expected: Two-finger drag + pinch zoom work; layout unchanged at mobile viewport
result: [pending]

### 4. Camera preset keyboard shortcuts
expected: Keys 0/1/2/3/R glide to Overview / Verdict / Audience / Content Analysis / Reset preset respectively
result: [pending]

### 5. /dashboard redirect
expected: Visiting /dashboard while authenticated triggers 307 redirect to /analyze
result: [pending]

### 6. Reduced-motion fallback (OS setting)
expected: With prefers-reduced-motion enabled: camera jumps instant (no glide); shimmer animations disabled on streaming frames
result: [pending]

### 7. Mobile sidebar
expected: At <768px width, sidebar hides; hamburger button appears; tap opens full-height sheet drawer
result: [pending]

### 8. Full-page axe-core audit
expected: Zero violations on /analyze; tab order: Sidebar → CommandBar → frames (roving) → camera presets
result: [pending]

### 9. Orientation tooltip flow
expected: First-time visit (clear localStorage): tooltip appears; ×-button or any command-bar interaction dismisses and persists dismissal
result: [pending]

### 10. FPS sampler downgrade (DevTools 4× CPU throttle)
expected: After ~5s sustained low FPS, 'Optimized for your device' toast appears; localStorage virtuna-perf-tier set to medium/low
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
