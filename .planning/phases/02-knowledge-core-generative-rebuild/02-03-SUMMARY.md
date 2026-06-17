---
phase: 02-knowledge-core-generative-rebuild
plan: "03"
subsystem: knowledge-core
tags: [kc, corpus, content-authoring, base, ideas-slice, generative, research-grounded, curated]
dependency_graph:
  requires: ["02-01"]
  provides: [base-curated, ideas-slice-curated, compiled-kc-ideas]
  affects: [02-04-blind-gate, 02-05-hooks-chat-slices, phase-03-ideas-tool]
tech_stack:
  added: []
  patterns:
    - "BASE = general content intelligence; KC_*_SYSTEM_PROMPT = KC_BASE + slice (one source → all modes)"
    - "Mechanism honesty: substantiated (prediction-error) vs craft-model, never fabricated depth"
    - "4-axis coverage: Distribution Mechanisms (watch-time/comment/share/save) + funnel/portfolio lens"
    - "Idea Output Schema (Topic/Idea Seed/Angle/Format/Mechanism/Fit/Substance) = archetype-agnostic deconstruction shape"
    - "Intra-batch diversity: tag by ARCHETYPE (dominant mechanism) + funnel-stage + risk-tier"
key_files:
  created:
    - .planning/research/kallaway-craft-extraction.md
    - .planning/research/sandcastles-structural-insights.md
  modified:
    - .planning/corpus/base.md
    - .planning/corpus/ideas.md
    - src/lib/kc/compiled.ts
decisions:
  - "Mid-checkpoint research-grounding: owner approved pulling Kallaway (13 transcripts) + Sandcastles.ai (screenshots+Notion KB) BEFORE curating, to ground the pilot once rather than retrofit later"
  - "BASE reframed honest — prediction-error/anticipation (substantiated) replaces neuro-veneer (forward-model); new 'How to Read These Mechanisms' section licenses substantiated-vs-model split, resolving the Prohibition-5 self-violation"
  - "Added Distribution Mechanisms (comment/share/save) + Content-Sits-on-a-Funnel to BASE — now covers all 4 engine behavioral axes, not just completion"
  - "Ideas deduped — folded standalone Exemplar Patterns into the 4 archetypes (~30% redundancy removed); added Topic x Take x Format anatomy + archetype-agnostic Idea Output Schema"
  - "Sandcastles split: craft-relevant (Idea Analysis schema, hook category+formula, format ontology, 70/20/10 funnel) vs product-only (feature IA, MCP-in-Claude GTM, watchlist data moat) — only craft entered corpus"
  - "Hook category+formula taxonomy + format 2-level ontology PARKED for 02-05 hooks/chat slices (corpus is hook-heavy → most valuable there)"
metrics:
  duration: "~2 hours (incl. research + owner curation cycle)"
  completed: "2026-06-17"
  tasks: 3
  files: 5
---

# Phase 02 Plan 03: BASE + Ideas Slice — Authored, Research-Grounded, Owner-Curated

**One-liner:** Authored the domain-general BASE + Ideas pilot slice to full depth, then research-grounded them against the Kallaway craft corpus + Sandcastles.ai teardown, owner-curated to the taste bar (D-10 passed), and recompiled byte-stable. BASE is the general content-intelligence brain shared by all modes (ideas/hooks/chat/scoring).

## What Was Built

### Task 1 (executor) — full-depth draft
Skeleton → full-depth authored draft of `base.md` + `ideas.md`. Stopped at the owner-curation checkpoint (Task 2, blocking).

### Task 2 (owner curation, research-grounded) — the value step
During the checkpoint, an audit found 3 weaknesses in the generic draft. With owner approval, mined external craft sources and re-authored to fix them:

- **`.planning/corpus/base.md`** (general content intelligence): Voice & Stance · **How to Read These Mechanisms** (honesty: substantiated vs craft-model) · 6 Universal Craft Principles (Comprehension First · Open Loop · Prediction & Prediction Error · Pattern Interrupt · Stakes · Re-Hook) · **Distribution Mechanisms** (watch-time / comments / shares / saves) · **Content Sits on a Funnel** (portfolio + 70/20/10) · 5 Anti-Generic Guardrails · 3-test Value Bar.
- **`.planning/corpus/ideas.md`** (pilot slice): Mode Job · **Topic × Take × Format** anatomy (incl. AI-grounds-evidence / take-stays-creator-supplied) · 4 archetypes (each grounded in a BASE mechanism) · 5 idea-stage Failure Modes · **Idea Output Schema** (archetype-agnostic) · Actionability Contract · Intra-batch diversity (archetype + funnel-stage + risk-tier) · Flops-as-negative-grounding.

### Task 3 — recompile
`compiled.ts` regenerated; `KC_IDEAS_SYSTEM_PROMPT = KC_BASE + curated Ideas slice`; byte-identical on re-run.

## The 3 Audit Issues Fixed (quality bar for 02-05)
1. **Neuro-veneer → honest grounding.** "forward-model" / "dopamine-anticipation cycling" → prediction-error/anticipation (substantiated) + explicit substantiated-vs-model framing. Resolved Prohibition-5 self-violation.
2. **Retention bias → 4-axis coverage.** Added comment (5 sourced tactics) / share (identity) / save (utility) drivers + funnel lens, mapping to the engine's completion/share/comment/save predictions.
3. **Triple-redundancy + tidy symmetry → deduped + honest counts.** Folded Exemplars into archetypes; deduped failure modes; banned forced symmetry; uneven real counts.

## Commits
| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5abfdab0 | draft BASE + Ideas slice to full depth |
| research | 62c96e5b | add Kallaway + Sandcastles craft research briefs |
| Task 2 | e532ccec | owner-curate BASE + Ideas to taste bar, research-grounded |
| Task 3 | 25499efd | recompile byte-stable KC carrying curated prose |

## Deviations from Plan
**Scope deepened (owner-approved):** plan anticipated a simple owner red-line; instead ran a bounded external-research grounding pass (Kallaway + Sandcastles) mid-checkpoint. This is the milestone's compounding-value step ("KC generative redo = THE value"), so the deepening was deliberate, not scope-creep. Two new research briefs created under `.planning/research/`.

## Accepted Residuals (non-blocking)
- Mild overlap: archetype execution-failures vs standalone Idea-Stage Failure Modes (distinct enough — per-archetype vs cross-cutting).
- Idea Output Schema restates Actionability Components (intentional: schema = shape, contract = gate).
- Corpus still moderately structured (reduced, not eliminated).

## Known Stubs / Deferred
- `hooks.md` + `chat.md` remain skeletons — authored in **02-05**. Hook category+formula taxonomy + format 2-level ontology parked in the research briefs for that plan.
- Injection-fencing + cold-start degradation live in the assembler (02-02), not the corpus — correct separation.

## Threat Surface Scan
No new endpoints/auth/schema. T-02-07 (external craft → .md): research used as grounding, not copy-paste; owner-curated. T-02-08 (scoring-craft re-import D-08): zero scoring language. T-02-09 (BASE task-specificity D-00a): D-00a clean — old Research/Deep-Dive leak removed.

## Self-Check: PASSED

Files on disk: base.md (244 lines) · ideas.md (240 lines) · compiled.ts (regenerated) · 2 research briefs — all FOUND.
Commits 5abfdab0 / 62c96e5b / e532ccec / 25499efd — FOUND in git log.
Byte-stability: compiled.ts identical on double-run — VERIFIED.
KC_IDEAS_SYSTEM_PROMPT carries curated prose (Comprehension First, Distribution Mechanisms, Topic×Take×Format, Idea Output Schema) — VERIFIED.
