# MILESTONE — Numen Surface

> Immutable worktree identity. Created 2026-06-11. Do not edit after creation.

**Name:** Numen Surface
**Version:** v5.0
**Branch:** `milestone/numen-surface`
**Worktree:** `~/virtuna-numen-surface/`
**Forks from:** `main` at `1b3157d3` (post v4.1 Phase-1 engine merge; ENGINE_VERSION 3.19.0)
**Phase numbering:** milestone-scoped, restarts at Phase 1.

## What this milestone is

A **net-new paradigm rebuild** — the mobile-first rebrand + UX rework. NOT a
refinement of shipped surfaces (that distinction is why this is its own milestone,
not mvp-ready Phases 2–5, which it supersedes).

Replaces the canvas board with **one thread per video**, where the AI's first turn
IS the **Reading** (engine output re-presented compact, stage-revealed; verdict =
calibrated band + one-line why, not a naked number), followed by suggested
follow-ups + agentic tools (Apify competitors, etc.). Warm-neutral **dark-only**
design system (coral→clay, Whoop color discipline, keyframes as chroma),
ground-up component kit.

**Primary input:** `.planning/NUMEN-SURFACE-VISION.md` — the full vision (brand,
surface architecture, design language, engine-finding mapping §7a, carried-forward
items §7b). Use it as the requirements source.

## North star

A creator uploads a video and receives a calm, trustworthy **Reading** — a verdict
they believe + the fixes that matter — on mobile, in a single thread they can
interrogate. Premium, restrained, distinctly not-another-AI-spaceship. The engine
is sound (v4.1); this milestone is the surface that finally does it justice.

## Carried forward from mvp-ready (see vision §7b)

- **SMOKE GATE** (hard precondition before building the Reading against real engine
  output): one real-video E2E returns sane/honest output (confirms F46/F47/F22/F23
  live; DashScope-429 risk) + ENG-03 latency number. **Not yet run.**
- **UAT sign-off** (F42 permalink) — can slip into the milestone.
- **ENG-06 D-12** (3-call prompt I/O + dead-field prune F27/F28/F43) = this
  milestone's **data-contract design step**, not a standalone session.
