---
status: testing
phase: 11-explore-audience-curated-discovery
source: [11-VERIFICATION.md, 11-08-PLAN.md]
started: "2026-06-20"
updated: "2026-06-20"
---

## Current Test

number: 1
name: /explore idle screen — pill + slash entry + 3 audience quick-action cards
expected: |
  Selecting /explore (both the skill pill AND the `/` slash menu) opens the idle
  screen showing the heading + 3 quick-action cards (niche / competitors / serendipity).
  Cards run a preset only on tap — they never auto-fire.
awaiting: user response

## Tests

### 1. /explore idle screen — pill + slash entry + quick-action cards
expected: Pill + `/` slash menu both open Explore; idle screen shows heading + 3 quick-action cards; cards fire only on tap (no auto-pull).
result: [pending]

### 2. Card-2 honest degrade with NO tracked accounts
expected: With zero tracked accounts, card 2 "What competitors shipped" shows the quiet "Track an account first" disabled sub-state — no pull fires, no fabricated competitor feed.
result: [pending]

### 3. Live outlier pull → fit-scored grid (no fake %)
expected: Tap "Top performers in my niche today" (or open params popover, set niche + serendipity, "Run Explore") → loading line "Pulling outliers and scoring them for your audience… this can take a few minutes" with NO fake % → a real fit-scored grid renders from a live apidojo scrape.
result: [pending]

### 4. Fit bar — shows on calibrated audience (never coral), omitted on General
expected: With a CALIBRATED audience active, tiles show the 3-segment fit bar + "FIT · {Strong|Fair|Weak}" + "predicted" (never coral). With General active, the fit bar is OMITTED entirely (no empty bar) — only the measured multiplier shows.
result: [pending]

### 5. Remix → Read produces in-thread Read + REAL persona reaction
expected: Tap "Remix → Read" on a profile-mode tile → the existing remix chain runs → a remix-card persists and surfaces in-thread IN PLACE (no jump to /analyze) → the remix-card's "See how the room reacted" LensTrigger shows a REAL persona reaction (first persona voice in the flow — never fabricated on the grid).
result: [pending]

### 6. "+ Track account" persists an idempotent tracked_accounts row
expected: Tap "+ Track account" on a profile-mode tile → toggles to "Tracking ✓" → a row exists in the live tracked_accounts table → re-running Explore + tapping Track again does NOT duplicate (idempotent) → card 2 now offers the competitors pull (hasTrackedAccounts true).
result: [pending]

### 7. Reload rehydrates persisted grid + remix-card
expected: Reload the page → the persisted outlier-grid block + the remix-card rehydrate from the saved thread (THREAD-07).
result: [pending]

## Honesty-spine hard-fail rules

Any of these is a hard FAIL → file a gap:
- a fabricated persona reaction on a grid tile (reaction is lazy via the remix-card LensTrigger ONLY)
- an empty / zero fit bar (must be OMITTED when fit is null, never shown empty)
- a fake % in the loading line
- coral (#FF7F50) on the fit bar (coral is the Remix CTA only — one-accent law)

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
