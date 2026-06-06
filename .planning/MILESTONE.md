# MILESTONE — Apollo

> Immutable worktree identity. Created 2026-06-03. Do not edit after creation.

**Name:** Apollo
**Branch:** `milestone/engine-opt`
**Worktree:** `~/virtuna-engine-opt/`
**Forks from:** `main` post-PR-#5 (`9b75e78c`)
**Phase range:** 1–5 (milestone-scoped numbering)

## What this milestone is

Turn the prediction engine from a **~25-call score-and-fabrication machine** into **Apollo** — a 3-call, knowledge-grounded expert. The engine stops being a score machine and becomes the **senses** feeding an expert brain.

```
Omni (observer/transcriber)  →  Audience-Sim (Brain 2: crowd)  →  Apollo Reasoner (Brain 1: expert)
```

## North star

- **Expert insight is the hero**, not the score. Score demotes to a directional read.
- **~88% call cut** (~25 → 3 LLM calls, video mode) → comfortably under the 300s Vercel cap.
- **Honest** — no fabricated engagement counts, no fake-precise percentile.
- **The moat is Brain 1's knowledge** (distilled Chase Hughes), grounded at inference via a cached system prompt — not fine-tuning, not the dormant outcome RAG.

## Source of truth

The full station-by-station teardown + cut-list lives in **`.planning/ENGINE-MAP.md`**. Strategy rationale: memory `apollo-direction`. This milestone executes that map.

## Out of scope (deferred)

- **Chat surface** (Apollo + engine-as-tool) — next milestone.
- **Outcome/learning loop as a product feature** — used here only as an offline A/B validation tool (Phase 4), never a user-facing accuracy claim.
- **UI/UX milestone** — follows Apollo.
