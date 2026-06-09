---
status: partial
phase: 02-omni-verbatim
source: [02-VERIFICATION.md, 02-03-SUMMARY.md]
started: "2026-06-04T15:40:46Z"
updated: "2026-06-04T15:40:46Z"
---

## Current Test

[awaiting human testing — D-02 silent-video real-run]

## Tests

### 1. D-02 honesty contract — silent/music-only video persists NULL verbatim on a real run
expected: Run one genuinely silent / music-only / slideshow video (NO speech) through the
real analyze flow (local dev server on `milestone/engine-opt`, logged in). Then query the
live DB:
`select verbatim->'hook', verbatim->'segments' from analysis_results where id = '<run id>';`
Assert: `verbatim->'hook'->'spoken_words'` IS NULL (NOT `"[inaudible]"`, NOT a sound
description like `"[music plays]"`) AND every `verbatim->'segments'` element has
`spoken_text: null` / `on_screen_text: null`. A null here is a PASS (D-02.2), not a regression.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(none — R1 hook + segment axes proven on real persisted rows; this is the one deferred
honesty-contract real-run. D-02 null behavior is already unit-tested + partially demonstrated
live via the fallback-bucket null verbatim on run giyyxJfww2iC.)
