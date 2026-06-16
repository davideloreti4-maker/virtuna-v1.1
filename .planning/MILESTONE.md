# MILESTONE — v6.0 Numen Studio

> Immutable worktree identity. Created 2026-06-16. Do not edit after creation
> (per `~/.claude/rules/gsd-worktree.md`).

## Identity

| Field | Value |
|-------|-------|
| Version | **v6.0** |
| Name | **Numen Studio** |
| Branch | `milestone/numen-tools` |
| Worktree | `~/virtuna-numen-tools/` |
| Base | `main` @ `4ede5205` (v5.0 Numen Rework + Landing v2 landed) |
| Launched | 2026-06-16, from trunk `~/virtuna-v1.1/` via `/gsd-new-milestone` |
| Discuss input | `.planning/NUMEN-TOOLS-VISION.md` (EXPLORATORY — walk through every section, not a locked brief) |

## Goal

Open Numen past "analyze a recorded video" into a creator **studio**: generation
tools where the differentiator is that **every output is tested on a synthetic
audience (SIM-1) before the creator acts on it**, plus general open chat with no
prior video. Generation is the surface; **SIM-1-on-everything is the moat.**

## v1 Scope (locked at launch — 2026-06-16)

**IN:** de-risk spikes (SIM-1 Flash text-fidelity, Knowledge-Core generative
rebuild, Remix-reuse scout) → foundation (thread-model generalization:
nullable `reading_id` + `type`; SIM-1 Flash text-mode engine path; open chat /
composer as universal door) → generation-grade **Knowledge-Core rebuild** (THE
value, the long pole) → the **Ideas → Hooks** moat chain (generate + inline
SIM-1 Flash scoring + self-judge) landing on **Test** (= the existing Reading).

**DEFERRED to v6.1:** **Scripts** and **Remix** tools (Remix is NOT greenfield —
revive `milestone/viral-remix` prior art when it lands).

**OUT (per vision §3):** in-thread monetization, brand-profile entity, RAG over
creator history, desktop dense-instrument.

## Hard Constraints

- **SIM-1 Max scoring path FROZEN at ENGINE_VERSION 3.19.0.** No changes to how a
  recorded video is scored. New engine work is **additive only**: SIM-1 Flash
  text-mode (personas reacting to text, no video) + generation calls.
- **Qwen-only** pipeline (no Gemini/DeepSeek).
- **Reuse the numen-rework Reading block renderers** — rich UI via a FIXED
  typed-renderer library, **NOT** model-generated UI (craft trap), **NOT** plain
  text (throws away the moat).
- **Flat-warm visual system** (THEME-06, locked in v5.0) is the design SSOT.
- **Spike-gated:** SIM-1 Flash text-fidelity must pass before the inline-scoring
  + self-judge architecture is committed.

## Spawned-agent rule (CWD caveat)

Agents inherit the **trunk** CWD (`~/virtuna-v1.1/`), not this worktree — give
them **absolute paths** under `~/virtuna-numen-tools/` for all reads/writes and
let the orchestrator handle git. (See memory: worktree-base-contamination.)
