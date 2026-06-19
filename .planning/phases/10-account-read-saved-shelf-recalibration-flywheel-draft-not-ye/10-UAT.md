---
status: testing
phase: 10-account-read-saved-shelf-recalibration-flywheel
source: [10-VERIFICATION.md]
started: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Test

number: 1
name: Capture outcome — paste a posted URL into the Capture-outcome form
expected: |
  Public metrics pull (apidojo/tiktok-scraper-api single-post); optional private add;
  provenance tags ("from the post" / "you added"); blank field NOT counted as zero;
  success shows "Outcome captured." (no headline delta).
  NOTE: confirm the live apidojo single-post field names (startUrls input, bookmarks→saves)
  against a real APIFY_TOKEN — adapt the remap if the dataset version differs.
awaiting: user response

## Tests

### 1. Capture outcome
expected: Public metrics pull; optional private add; provenance tags ('from the post'/'you added'); blank field not counted as zero; success shows "Outcome captured." Verify live apidojo single-post field names (startUrls/bookmarks).
result: [pending]

### 2. Reconcile log
expected: Capturing an outcome with a pinned prediction present writes a `reconciliations` row with classification calibration/craft. (Depends on the predicted-pin runner-wiring follow-up — see Gaps.)
result: [pending]

### 3. Propose → confirm
expected: With ≥N consistent calibration divergences, the nudge appears ("Your buyers ran warmer…") with the honesty footnote; Confirm writes the override (active audience persona_weights change, General does NOT); Decline does not re-nag.
result: [pending]

### 4. Drift
expected: Triggering /api/cron/audience-drift (cron-authed, CRON_SECRET) writes a `source='drift_scrape'` row that surfaces the SAME nudge with source='drift' copy.
result: [pending]

### 5. Shelf save/use
expected: Save a hook/idea/Read from a thread → appears flat on /saved with its type chip; "Use in thread →" launches via CHAIN_HANDOFFS; Remove confirms and does not delete the original.
result: [pending]

### 6. Account Read (populated + thin)
expected: reading/-rendered card with patterns + accuracy track record on a real account; honest "Not enough history to read yet" warning on a thin/private handle — never fabricated.
result: [pending]

### 7. Track-record EMPTY path (SELF-03)
expected: On a fresh account with ZERO reconciliation rows, Account Read shows the honest empty track-record state ("Not enough posted outcomes yet…") — NOT a fabricated/zero "within X%" number. Verify BOTH empty and populated paths.
result: [pending]

### 8. Visual SSOT — flat-warm + cream-not-coral
expected: Chips/checks/provenance/track-record all flat-warm SSOT, cream-secondary, never coral.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

### FLYWHEEL-02 predicted-pin runner wiring (accepted follow-up — owner decision 2026-06-19)
status: deferred
detail: |
  pinPredictedSignature() is built, exported and unit-tested, and the capture route reads
  the pinned row via findPinnedPrediction(). BUT no tool runner (runFlashRunner et al.)
  calls pinPredictedSignature() at its post-SIM point, so no predicted vector is pinned
  during a normal SIM run. Owner accepted this as a tracked follow-up (not a phase-10
  blocker). Until wired, UAT scenario 2 (reconcile log) cannot fire end-to-end through the
  real flow — the loop is dormant. Wire the seam into each runner's post-SIM point + add a
  runner-level test, then re-confirm scenario 2.
artifacts:
  - src/lib/tools/runners/flash-runner.ts (call pinPredictedSignature after SIM verdicts resolve)
