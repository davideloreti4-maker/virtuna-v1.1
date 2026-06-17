---
phase: 02-knowledge-core-generative-rebuild
plan: "05"
subsystem: knowledge-core
tags: [kc, hooks-slice, chat-slice, corpus, d14, d15, owner-gate]
dependency_graph:
  requires: ["02-04"]
  provides: [hooks-slice, chat-slice, compiled-all-four-modes]
  affects: [04-hooks-tool, 05-open-chat]
tech_stack:
  added: []
  patterns:
    - "Full-depth SLICE authoring replicating the gate-proven Ideas shape (D-15)"
    - "Thin stance-slice riding BASE for chat (D-14)"
    - "Regen-kc.ts byte-stable compile — all four per-mode system prompts"
key_files:
  created: []
  modified:
    - .planning/corpus/hooks.md
    - .planning/corpus/chat.md
    - src/lib/kc/compiled.ts
decisions:
  - "QUESTION archetype designated near-failure-mode with explicit guard (lowest median, most overused)"
  - "BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE = the 5 live archetypes; each with mechanism, template, performance note, execution failure"
  - "Depth-match requirement called out as blocking check before RESEARCH archetype selection"
  - "Chat slice stays thin per D-14; all three failure modes (sycophantic opener, hedge-by-enumeration, over-generating) authored"
metrics:
  duration: "~15 min (Task 1 only — Task 2 awaits owner)"
  completed: "2026-06-17 (Task 1 only)"
  tasks: 1
  files: 2
---

# Phase 02 Plan 05: Hooks + Chat Slices — PARTIAL SUMMARY (Task 1 complete, Task 2 pending owner)

**One-liner:** Authored the full-depth Hooks slice replicating the gate-proven Ideas shape (5 archetypes + timing anchors + failure modes + abstracted exemplars + value-forcing Actionability Contract) and a thin chat stance-slice riding the BASE (D-14); Task 2 (owner red-line) is a blocking human checkpoint.

## Status

**PARTIAL** — Task 1 (draft Hooks + chat) COMPLETE. Task 2 (owner curation red-line) AWAITING OWNER.

## What Was Built

### Task 1 (executor) — COMPLETE

`.planning/corpus/hooks.md` — full-depth Hooks slice:

- **5 live archetypes** (BOLD / GAP / CONTRARIAN / RESEARCH / NARRATIVE), each with: named BASE mechanism, structural template, performance context, and execution failure.
- **QUESTION archetype** flagged explicitly as near-failure-mode with performance data (lowest median, most overused) and the only condition under which it is acceptable.
- **Timing anchors** throughout: algorithm's first decision ≈1.5s; strong hook in first 3s / ~10–14 words; TikTok-first with inline Reels/Shorts notes where caption phrasing materially changes the hook.
- **Failure Modes** (5 named): algorithm timing miss, depth-mismatch (RESEARCH on shallow content), Question-archetype default (the #1 generation-slop regression for this mode), empty contrarianism / ragebait signal, generic niche opener.
- **Gold-Standard Exemplar Patterns** (5 abstracted templates — no scraped clips, D-04).
- **Actionability Contract**: Component 1 (named archetype + mechanism), Component 2 (why it fits this creator + this idea), Component 3 (ready-to-use verbatim line); Intra-batch diversity rule (explicit slug tags, no duplicate slugs); Flops-as-negative-grounding rule.
- No scoring-shaped language (`grep -ci "Strong/Mid/Weak|dock for|rubric"` = 0; D-08 pass).
- 216 non-blank lines (minimum 40 required).

`.planning/corpus/chat.md` — thin chat stance-slice:

- **Mode Job**: direct thinking-partner, not help-desk, not generator; BASE voice and value bar apply in full.
- **Craft Patterns (3)**: lead with the answer; direct opinion over enumerated options; honest "I don't know."
- **Failure Modes (3)**: sycophantic opener, hedge-by-enumeration, over-generating.
- **Gold-Standard Exemplar Patterns (2)**: direct judgment delivery, honest pushback.
- **Actionability Contract (thin)**: (a) direct answer first, (b) grounded in creator context, (c) honest about uncertainty; N/A for batch diversity; flops-grounding applies when relevant.
- Explicitly marked thin/deferred-to-P5 throughout. 72 non-blank lines (minimum 12 required).

### Task 2 (owner curation) — PENDING

Awaiting owner to red-line both `.planning/corpus/hooks.md` and `.planning/corpus/chat.md` to the taste bar (D-10).

### Task 3 (executor) — NOT STARTED

Recompile all four per-mode system prompts via `scripts/regen-kc.ts` → `src/lib/kc/compiled.ts`. Will run after Task 2 returns "curated" signal.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 4c583438 | feat(02-05): draft Hooks slice (full depth) + thin chat stance-slice |

## Deviations from Plan

None — plan executed exactly as written. Task 1 is complete; Task 2 is a blocking human checkpoint per plan design.

## Known Stubs

- Task 2 owner curation: not yet complete (awaiting owner red-line). `compiled.ts` still carries the Plan-01 skeleton placeholders for hooks and chat until Task 3 runs post-curation.
- Task 3 recompile: not yet run. `KC_HOOKS_SYSTEM_PROMPT` and `KC_CHAT_SYSTEM_PROMPT` in `compiled.ts` currently carry the skeleton `[Author craft here — owner primary spine]` placeholders.

## Threat Surface Scan

No new endpoints, auth paths, or schema changes. Only corpus `.md` files modified.

- T-02-13 (external craft → hooks/chat slice): Research is steer only (D-09); no copy-paste from external sources. Archetypes re-derived from owner steer + research notes. Task 2 gate applies.
- T-02-14 (scoring-craft re-import, D-08): Zero occurrences of scoring-shaped language verified (`grep` count = 0). No import of apollo-core.
- T-02-15 (chat over-authored, D-14 breach): chat.md is explicitly thin, marked deferred-to-P5 throughout. 72 non-blank lines vs hooks' 216 — proportionally thin as required.

## Self-Check: PARTIAL (Task 1 only)

- `.planning/corpus/hooks.md` exists on disk: FOUND
- `.planning/corpus/chat.md` exists on disk: FOUND
- Commit `4c583438` in git log: FOUND
- Actionability Contract in hooks.md: PASS
- Bold Statement + Curiosity Gap named: PASS
- Timing anchors (1.5s / 3s): PASS
- Question as near-failure-mode: PASS
- Failure modes (ragebait, depth-mismatch): PASS
- Chat thin/deferred-to-P5 markers: PASS
- hooks.md non-blank lines ≥ 40: PASS (216)
- chat.md non-blank lines ≥ 12: PASS (72)
- Scoring-shaped language count = 0: PASS
- Draft-pending-curation markers in both files: PASS

Tasks 2–3 self-check deferred to continuation agent after owner returns "curated" signal.
