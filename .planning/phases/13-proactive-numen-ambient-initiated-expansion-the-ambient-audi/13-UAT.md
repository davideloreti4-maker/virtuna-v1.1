---
status: testing
phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi
source: [13-VERIFICATION.md]
started: 2026-06-21
updated: 2026-06-21
---

## Current Test

number: 1
name: Sticky presence felt on scroll (both branches)
expected: |
  Presence strip visible + sticky atop the thread column; idle roster (no reaction) on empty home; never hidden.
awaiting: user response

## Tests

### 1. Sticky presence felt on scroll (both branches)
expected: Open a thread with generated cards (390px mobile + desktop). The presence strip sits at the top of the thread column and stays sticky as the ledger scrolls. On empty/centered home (Branch B) it still shows the roster + idle copy with NO reaction (the presence never hides).
result: [pending]

### 2. Moving spotlight follows scroll with pixel precision
expected: Scroll the card ledger — the `reacting to: {concept}` subject + dot toning track the card actually under the focus line (not just crossing markers in card order), no flicker, zero network requests on scroll.
note: KNOWN LIMITATION (IN-03 / 13-04) — `data-ambient-card` markers are sr-only zero-height rows, NOT co-located with the real card DOM, so continuous scroll-spy is degraded to "crosses markers in card order." Judge whether the moving-spotlight-on-scroll promise (D-02) is acceptably met or whether tagging real card roots is required first.
result: [pending]

### 3. Tap-priority + simultaneous Lens-open
expected: Tap a card — the spotlight holds on that card (not yanked away by scroll) until you tap another card or deliberately scroll past ~64px; the SAME tap also opens the AudienceLens bottom sheet scoped to that card.
result: [pending]

### 4. Type-to-room end-to-end
expected: Expand the presence, type a thought, submit — "Reading the room…" shows, then the subject becomes your thought + the honesty caption "A quick SIM read on your {audience} — not a full Test." appears, and the AudienceLens opens scoped to the thought. Exactly ONE POST /api/tools/react fires on submit (none on keystroke).
note: WATCH (WR-01) — after submitting, then tapping/scrolling to a DIFFERENT card: does the spotlight re-point, or stay stuck on the typed thought? `typedFocus` is never cleared, so the spotlight may freeze on the typed thought (partial D-02 violation, runtime-only).
result: [pending]

### 5. One-Lens continuity
expected: The per-card tap, the presence cue (when focused), and a type-to-room result ALL open the SAME AudienceLens bottom sheet — no second/forked Lens, no restyle.
result: [pending]

### 6. Reduced-motion hard-stop + coral-as-signal-only
expected: With the OS reduce-motion setting on, the dot pulse + cross-fade hard-stop, content stays legible, and the screen reader still announces the roster + subject. Coral appears ONLY on the worst-cluster dot / inherited Rewrite CTA — never on the presence container/border/title/subject/input.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
