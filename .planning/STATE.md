---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Numen Studio
status: planning
stopped_at: Defining requirements
last_updated: "2026-06-16T00:00:00.000Z"
last_activity: 2026-06-16 -- Milestone v6.0 Numen Studio started (worktree milestone/numen-tools)
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Discuss input (EXPLORATORY): .planning/NUMEN-TOOLS-VISION.md · Worktree identity: .planning/MILESTONE.md

**Core value:** AI-powered content intelligence for TikTok creators — now extended from "analyze a recorded video" to a creator studio where every generated idea/hook/script is tested on a synthetic audience (SIM-1) before the creator acts.
**Current focus:** Defining v6.0 requirements + roadmap.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-16 — Milestone v6.0 Numen Studio started

## Hard Constraints (this milestone)

- **Engine OPEN for v6.0; validated behavior PROTECTED by a regression gate (not frozen).** Text-mode, generation, KC, and fold refactors permitted. Keep the engine suite green, preserve same-video score-identity/determinism on the SIM-1 Max (video) path, and bump `ENGINE_VERSION` on any deliberate change to video-scoring output. No silent regressions.
- **Qwen-only** pipeline (no Gemini/DeepSeek).
- **Rich tool output via the fixed numen-rework typed-renderer library** — NOT model-generated UI (craft trap), NOT plain text (loses the moat).
- **Flat-warm visual system (THEME-06, v5.0)** is the design SSOT.
- **Spike-gated:** SIM-1 Flash text-fidelity must pass before the inline-scoring + self-judge architecture is committed.
- **Scripts + Remix deferred to v6.1** (Remix revives `milestone/viral-remix` prior art — scout before any rebuild).

## Phases

| # | Phase | Requirements | Status |
|---|-------|--------------|--------|
| — | (roadmap not yet created) | — | — |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Launch decisions (2026-06-16):

- v6.0: Open Numen into a creator studio — generation tools + SIM-1-on-everything as the moat.
- v6.0: v1 scope = Foundation + Ideas→Hooks moat chain + open chat; Scripts + Remix deferred to v6.1.
- v6.0: Engine OPEN; SIM-1 Max video-scoring protected by a regression gate (suite green + same-video score-identity; `ENGINE_VERSION` bump on deliberate scoring change) — the v5.0 "frozen" rule was a presentation-milestone scope device, retired for this engine-touching milestone.
- v6.0: Knowledge-Core ground-up generative rebuild is the foundation (THE value, the long pole).
- v6.0: Launched in a dedicated worktree (`milestone/numen-tools`) off main; trunk stays on main.

### Pending Todos

[From .planning/todos/pending/]

None yet.

### Blockers/Concerns

- **Spike gate (pre-build):** SIM-1 Flash text-fidelity — does a text-only fold predict pull well enough? Gates the inline-scoring + self-judge architecture. Cheap fold smoke first; test 2-3 framings (don't conclude RED from one naive prompt). The winning framing becomes the spec for every inline score.
- **Long pole:** generation-grade Knowledge-Core rebuild is a content/curation workstream first — de-risk with a small authored slice + eval early.
- **Pre-existing main hygiene debt:** v5.0 Numen Rework + Landing v2 shipped to main but were never archived to `.planning/milestones/`; main's `.planning/` is mixed. Recommend a `/gsd-complete-milestone` pass on `main` (does not block this milestone).

## Deferred Items

Deferred to v6.1+: Scripts tool, Remix tool (revive `milestone/viral-remix`), in-thread monetization, brand-profile entity, RAG over creator history, desktop dense-instrument.

## Session Continuity

Last session: 2026-06-16
Stopped at: Milestone v6.0 launched; PROJECT.md + STATE.md + MILESTONE.md written; defining requirements next.
Resume file: .planning/NUMEN-TOOLS-VISION.md
