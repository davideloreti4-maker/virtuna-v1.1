---
phase: 02-knowledge-core-generative-rebuild
plan: "03"
subsystem: knowledge-core
tags: [kc, corpus, content-authoring, base, ideas-slice, generative, draft, checkpoint]
dependency_graph:
  requires: ["02-01"]
  provides: [base-draft, ideas-slice-draft]
  affects: [02-03-post-curation, compiled-kc, phase-03-ideas-tool]
tech_stack:
  added: []
  patterns:
    - "D-04 value-forcing template: BASE = 4 sections, SLICE = 5 sections"
    - "Intra-batch diversity: mechanism-tag per item, no duplicate tags in a batch"
    - "Flops-as-negative-grounding: wins/flops as directional signals in Actionability Contract"
key_files:
  created: []
  modified:
    - .planning/corpus/base.md
    - .planning/corpus/ideas.md
decisions:
  - "BASE authored strictly domain-general (D-00a): 6 Universal Craft Principles, 5 Anti-Generic Guardrails, Value Bar with 3-test Self-Rejection Standard — no mode-specific language"
  - "Ideas Actionability Contract encodes intra-batch diversity as a structural rule (mechanism-tag per item, duplicate = visible failure) and flops-as-negative-grounding as a directional signal rule (not causal diagnosis, not fabricated mechanism)"
  - "Greenfield confirmed (D-08): zero references to scoring KC; no Strong/Mid/Weak/dock-for/rubric language in either file"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-17"
  tasks: 1
  files: 2
---

# Phase 02 Plan 03: BASE + Ideas Slice Authoring Summary

**One-liner:** Full-depth draft of domain-general BASE (6 mechanisms, 5 guardrails, 3-test value bar) and Ideas pilot slice (4 archetypes, 5 failure modes, 5 exemplar patterns, diversity + flops Actionability Contract) — STOPPED at owner curation checkpoint (Task 2, blocking).

## What Was Built

Task 1 (auto) completed: the BASE and Ideas corpus files filled from skeleton to full-depth authored draft.

### .planning/corpus/base.md (130 non-blank lines)

Four sections authored to full depth:

1. **Voice & Stance** — decisive/concrete peer-to-expert posture; no hedging; loyalty to creator outcome over diplomatic validation.
2. **Universal Craft Principles** — 6 named mechanisms with mechanism descriptions and domain-general application: Curiosity Gap/Open Loop · Curiosity Stacking · Pattern Interrupt · Prediction/Anticipation Drive · Looping Architecture · Transformation Promise/Stakes. Each carries: mechanism name → the neurological/behavioural driver → craft implication.
3. **Anti-Generic Guardrails** — 5 structural prohibitions (not aspirational descriptions): No mechanism-less statements · No vague superlatives · No niche-agnostic output · No robotic rhythm · No false depth. Each names the failure pattern, the mechanism that causes it, and the active test.
4. **Value Bar / Self-Rejection Standard** — 3-test gate (Test A: Named Mechanism · Test B: Concrete Instantiation · Test C: Fit to this creator). Includes the self-rejection trigger for niche-name-as-find-and-replace (the most common false-fit pattern).

D-00a reviewer test applied throughout: every principle makes equal sense for scoring, ideas, hooks, and chat. No mode-specific language entered the BASE.

### .planning/corpus/ideas.md (197 non-blank lines)

Five sections authored to full depth:

1. **Mode Job** — "what to make" stage; 3-question output test; TikTok-first with Reels/Shorts note on production signal weight.
2. **Craft Patterns / Archetypes** — 4 named archetypes with mechanism, pattern, what-makes-it-work, and execution failure for each: Niche-Specific Finding (Specificity Bridge) · Counter-Intuitive Outcome (Wait That's Backwards) · Personal Experiment With Stakes (I Ran the Test) · Audience-Desire Mirror (This Is About You).
3. **Failure Modes** — 5 idea-stage-specific failure patterns with downstream consequence: Topic-not-idea · Depth claimed but not supported · Empty contrarianism · Niche-idea conflation · Audience-free ideation.
4. **Gold-Standard Exemplar Patterns** — 5 abstracted structural patterns (not clip URLs): Named-Mistake Teardown · Belief Audit · Asymmetric Finding · Documented Experiment · Audience Pain Named. Each includes TikTok vs Reels note where format differs.
5. **Actionability Contract** — 3 required components per idea (Named Mechanism · Why It Fits This Creator · Ready-To-Use Form) + INTRA-BATCH DIVERSITY RULE (mechanism-tag per item, no duplicate tags, regenerate duplicates) + FLOPS-AS-NEGATIVE-GROUNDING RULE (wins/flops as directional signals, honest caveat on fabricated mechanisms).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5abfdab0 | feat(02-03): draft BASE + Ideas slice craft to full depth |

## STOPPED AT CHECKPOINT

**Task 2 is a blocking human checkpoint** (`type="checkpoint:human-verify" gate="blocking"`).

The plan is `autonomous: false` — the executor may not self-approve owner curation. Execution paused at Task 2. Tasks 3 (recompile) cannot proceed until the owner has red-lined both files.

## Deviations from Plan

None — Task 1 executed exactly as planned. Draft markers present on both files. No scoring KC opened (D-08 compliance). No copy-paste from research (D-09 compliance). Greenfield authoring from owner-steer + Priority-1 research notes as raw material.

## Known Stubs

Both files are marked `<!-- DRAFT — PENDING OWNER CURATION (D-10) -->` at the top. This is intentional — the draft marker is the checkpoint signal. Remove markers when satisfied.

Task 3 (recompile compiled.ts) is pending — cannot execute until owner removes draft markers and signals "curated."

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The STRIDE mitigations in the plan's threat register:
- **T-02-07** (external craft → authored .md): research used as steer only; no copy-paste. Owner curation gate pending.
- **T-02-08** (scoring-craft re-import D-08): zero scoring language in either file. `grep -ci "Strong/Mid/Weak|dock for|rubric"` = 0.
- **T-02-09** (BASE leaking task-specificity D-00a): D-00a reviewer test applied; no mode-specific language in BASE.

## Self-Check

## Self-Check: PASSED (partial — plan stopped at checkpoint)

Files verified on disk:
- .planning/corpus/base.md: FOUND (130 non-blank lines)
- .planning/corpus/ideas.md: FOUND (197 non-blank lines)

Commit verified:
- 5abfdab0: FOUND in git log

Pending (post-curation):
- Task 3 commit (recompile compiled.ts)
- Final SUMMARY update with Task 3 commit hash
