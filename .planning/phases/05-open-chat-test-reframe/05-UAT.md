---
status: complete
phase: 05-open-chat-test-reframe
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
  - 05-04-SUMMARY.md
  - 05-05-SUMMARY.md
started: 2026-06-18T13:30:00Z
updated: 2026-06-18T13:46:00Z
method: playwright-driven (live app, account @e2e_creator, localhost:3000)
---

## Current Test

[testing complete]

## Tests

### 1. Open-chat live render + reload rehydration
expected: Select Chat chip → empty state "Ask anything about your content." → send a message → grounded markdown answer streams token-by-token → reload → both user + assistant turns rehydrate.
result: pass
evidence: |
  Chat chip flipped live ([active][pressed]); active model switched to SIM-1 Flash; composer showed "Ask anything about your content.". Sent "What kind of hooks work best for my audience?" → "Thinking…" placeholder → grounded multi-paragraph markdown answer streamed in (referenced the user's own "Anabolic Window" idea, 18-24 demographic, comedy storytelling, "stakes mismatch"/"in media res" — NOT a generic chatbot). After full reload + switching to Chat, BOTH the user turn and the full assistant markdown answer rehydrated.

### 2. Perplexity-style progress checklist (Ideas/Hooks)
expected: Stage rows reveal top-down (Generating → Self-judge → Simulating your audience → Ranking) flipping to coral-free ✓; cards stream content-first; model follow-up turn after cards.
result: pass
evidence: |
  ProgressChecklist rendered live ("Skill run progress" region, "Generating: active" stage row, coral-free) during both the Hooks generation and the refine run. 5 fresh hook cards streamed content-first, each ranked (#1-#5) with audience archetype + scroll quote + SIM-1 Flash band. Stage rows are transient (clear on completion). Model-authored follow-up turn was not isolated in this run (persists to the open thread; code-verified VERIFICATION truth #14) — noted, non-blocking.

### 3. Chat-to-refine core loop
expected: "make hook 1 punchier" → NEW hook card inline with its OWN fresh band (≠ prior), + model note; original not overwritten (append-only).
result: pass
evidence: |
  Typed "make hook 1 punchier" in chat → refine intent detected, view auto-switched to Hooks, scoped re-run executed (full generate→judge→simulate→rank, ~90s). A "NEW HOOKS" section appeared with a refined card #1: "Why are you panicking about a 30-minute protein window when your muscles actually stop growing hours later?" — a genuinely punchier rewrite of the original hook 1, with its OWN fresh band (Strong · 6/10 stop · SIM-1 Flash) DISTINCT from the original (8/10). Original cards preserved (append-only). Confirms D-04 moat contract + the CR-02 fix (correct card targeting).

### 4. One-time cold-start nudge
expected: On a thin/empty-profile account, a single muted nudge line renders once, not every turn.
result: skipped
reason: "Test account @e2e_creator has a rich grounded profile (deep KC/idea history), so the coldStart path does not trigger. Requires a fresh thin-profile account to exercise live. Gating logic + copy code-verified (VERIFICATION truth #8; isColdStart mirrors assembler isProfileThin)."

### 5. Test reframe hero
expected: Reading hero label "Test" + coral "powered by SIM-1 Max" tag; score gauge + stats unchanged.
result: pass
evidence: |
  Opened a Reading (score 62). Hero reads "Test" with the "powered by SIM-1 Max" tag. Score gauge ("Score 62 of 100, Mid"), watch-through 65%, biggest drop 0:17, finish rate 20%, funnel stages, and score drivers (Hook 85 / Retention 50 / Shareability 85) all render identically — presentation-only reframe confirmed (D-06).

### 6. Suggested chain CTA + failure retry
expected: tappable "Turn this into hooks →" CTA appears + fires only on tap; failed run shows "Couldn't finish that run." + tap-to-retry.
result: pass
evidence: |
  Suggested chain CTA ("Develop this →") rendered after the pure-chat answer. Tap-to-launch confirmed: tapping "Develop this →" on an idea triggered the Hooks run (no silent auto-fire — fires only on explicit tap). Failure/retry surface not force-triggered live (would require breaking the backend) — code-verified (05-04 skill-run error/retry surface + VERIFICATION truth #9 chat error copy).

## Summary

total: 6
passed: 5
issues: 0
pending: 0
skipped: 1

## Gaps

[none — 0 issues found]

## Notes

- Driven live via Playwright against the running dev server (localhost:3000), authenticated as @e2e_creator.
- Code review blockers found during execute-phase (CR-01 prompt-injection fence, CR-02 idea-refine card targeting) were fixed before this UAT; Test 3 live-confirms the refine targets the correct card and produces a fresh independent SIM band.
- Two human items remain lightly-covered (non-blocking): the model follow-up turn (test 2) and the skill-run failure/retry surface (test 6) are code-verified but not isolated/force-tested live; the cold-start nudge (test 4) needs a thin-profile account.
