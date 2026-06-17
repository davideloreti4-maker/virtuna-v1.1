---
phase: 02-knowledge-core-generative-rebuild
plan: "04"
subsystem: knowledge-core
tags: [kc, blind-gate, ideas-slice, eval, d12, d13, throwaway]
dependency_graph:
  requires: ["02-02", "02-03"]
  provides: [d12-gate-script]
  affects: [02-05-hooks-chat-slices, gate-verdict]
tech_stack:
  added: []
  patterns:
    - "Throwaway gate script pattern: build-corpus.ts dotenv+tsconfig-paths bootstrap"
    - "3-arm blind generation: new-KC / current-KC / raw-LLM — shuffled unlabeled (D-13 Goodhart guard)"
    - "Fisher-Yates shuffle for per-prompt arm order randomization"
    - "Separate key file written post-generation for post-rank decode"
key_files:
  created:
    - scripts/kc-gate.ts
  modified: []
decisions:
  - "Gate is throwaway: no persistence, no aggregate scoring, no test suite (D-12 / Pitfall 5)"
  - "Arm C (raw-LLM) uses null system prompt — bare Qwen call with profile-only user message"
  - "Arm B (current-KC) uses APOLLO_SYSTEM_PROMPT with an ideas-task framing user message (gate comparison baseline per plan — does not violate D-08 which governs authored slices, not the gate)"
  - "Flash sanity delta is optional (--no-flash flag) and labeled explicitly as sanity-only"
  - "GATE_MODEL env seam allows substituting the gate model without touching source"
metrics:
  duration: "~20 min (Task 1 only — Task 2 awaits owner)"
  completed: "2026-06-17 (Task 1 only)"
  tasks: 1
  files: 1
---

# Phase 02 Plan 04: D-12 Blind Gate — Partial SUMMARY (Task 1 complete, Task 2 pending owner)

**One-liner:** Wrote the throwaway D-12 blind-gate script that generates 3×N shuffled, unlabeled Ideas outputs (new-KC + current-KC + raw-LLM) for owner blind-ranking; Task 2 (owner blind-rank verdict) is a blocking human checkpoint.

## Status

**PARTIAL** — Task 1 (build gate script) COMPLETE. Task 2 (owner blind-rank verdict) AWAITING OWNER.

## What Was Built

### Task 1 (executor) — COMPLETE

`scripts/kc-gate.ts` — throwaway blind-gate generator:

- **Three arms per prompt (D-13):**
  - Arm A (new-KC): `KC_IDEAS_SYSTEM_PROMPT` (system) + `assembleBundle({ask, platform:"tiktok", mode:"idea"}, null)` (user). Null profile = cold-start baseline (no creator profile in the gate context — honest).
  - Arm B (current-KC): `APOLLO_SYSTEM_PROMPT` (system) + ideas-task framing (user). The plan's gate baseline arm — reading this file does NOT violate D-08 (which governs authored slices, not the gate comparison arm).
  - Arm C (raw-LLM): No KC system prompt. Profile-only user message. Bare Qwen call.
- **Shuffle (Goodhart guard, D-13):** Fisher-Yates shuffle per prompt — arm order is randomized, outputs are unlabeled. The owner cannot infer arm identity from output position.
- **Decode key:** `kc-gate-KEY.txt` written separately. Owner reads blind output first, ranks, THEN decodes.
- **Optional Flash sanity delta:** `runFlashTextMode(content, "idea")` appended as `[Flash sanity (sanity only — not the gate): N/M personas → green]`. Skipped with `--no-flash`.
- **CLI:** `npx tsx scripts/kc-gate.ts` (uses 7 inline default prompts). Custom prompts via `--prompts "ask1|ask2|..."`. Skip Flash via `--no-flash`.
- **Qwen-only:** `QWEN_REASONING_MODEL` (env-overridable via `GATE_MODEL`). `temperature:0 + QWEN_SEED`. 2-minute timeout per call. No Gemini, no DeepSeek.
- **No harness machinery:** no persistence, no aggregate scores, no test suite (D-12 / Pitfall 5). Script is throwaway.

### Task 2 (owner blind-rank) — PENDING

Awaiting owner to run `npx tsx scripts/kc-gate.ts`, blind-rank outputs, decode, and record the verdict.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9ced6af8 | feat(02-04): write D-12 throwaway blind-gate generator |

## Deviations from Plan

None — plan executed exactly as written. Task 1 is complete; Task 2 is a blocking human checkpoint per plan design.

## Known Stubs

- Task 2 gate verdict: not yet recorded (awaiting owner blind-rank). Plan 05 (Hooks + chat replication) is blocked until the gate verdict is returned.

## Threat Surface Scan

No new endpoints, auth paths, or schema changes. `scripts/kc-gate.ts` is a dev-only throwaway script (no product path).

- T-02-10 (Flash metric tuning): Flash band labeled "sanity only — not the gate" in both code and output. Owner blind rank is the independent gate.
- T-02-11 (scope creep to harness): Script has no persistence, aggregate scoring, or test machinery. Acceptance criteria verified at 0 counts.
- T-02-12 (gate prompt injection): `assembleBundle` reuses the `<<<USER_CONTENT>>>` fence from assembler.ts for the new-KC arm. Raw-LLM and current-KC arms also fence the user's ask.

## Self-Check: PARTIAL (Task 1 only)

- `scripts/kc-gate.ts` exists on disk: FOUND
- Commit `9ced6af8` in git log: FOUND
- `KC_IDEAS_SYSTEM_PROMPT` in kc-gate.ts: PASS
- `assembleBundle` reference: PASS
- `shuffle/randomize` logic: PASS (Fisher-Yates + `Math.random()`)
- Harness machinery (training_corpus/persistResults/aggregateScore): 0 occurrences — PASS
- Non-Qwen clients (gemini/deepseek): 0 occurrences — PASS
- `npx tsc --noEmit` errors in kc-gate.ts: 0 — PASS

Task 2 self-check deferred to continuation agent after owner returns verdict.
