---
status: testing
phase: 11-existing-ui-integration-privacy-policy
source:
  - 11-02-SUMMARY.md
  - 11-03-SUMMARY.md
  - 11-04-SUMMARY.md
  - 11-05-SUMMARY.md
started: 2026-05-20T22:40:00Z
updated: 2026-05-20T22:40:00Z
---

## Current Test

number: 1
name: Signal Availability Chips
expected: |
  Run an analysis on the dashboard. Below the viral score ring, you should see a row of small chips:
  - Audio ✓ (green/success badge)
  - Personas ✓ (green/success badge)
  - Retrieval ✕ (grey, line-through)
  - ML ✕ (grey, line-through — ML is disabled per Phase 10)
awaiting: user response

## Tests

### 1. Signal Availability Chips
expected: Chips visible below score ring: Audio ✓, Personas ✓, Retrieval ✕, ML ✕
result: pending

### 2. Data Disclosure
expected: "About your data ▾" link visible below upload dropzone. Clicking expands text about 30-day auto-delete.
result: pending

### 3. Retention Toggle
expected: Settings → Creator Profile tab shows "Keep my uploaded videos for re-analysis" toggle switch. Default off.
result: pending

### 4. Goal Re-prompt Banner
expected: On 10th analysis (analysis_count % 10 === 0), inline banner appears: "Quick check — is your goal still [goal]?" with dismiss button.
result: pending

### 5. Engine Version in Results
expected: Analysis JSON response includes engine_version = "3.0.0-dev". No dev guards/deprecation notices visible.
result: pending
