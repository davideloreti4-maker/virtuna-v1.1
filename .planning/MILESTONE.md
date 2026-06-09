# MILESTONE — MVP Ready

> Immutable worktree identity. Created 2026-06-09. Do not edit after creation.

**Name:** MVP Ready
**Version:** v4.1
**Branch:** `milestone/mvp-ready`
**Worktree:** `~/virtuna-mvp-ready/`
**Forks from:** `main` at `1d9e3294` (post-PR-#18, Numen rebrand text sweep)
**Phase numbering:** milestone-scoped, restarts at Phase 1.

## What this milestone is

A **brownfield refinement pass** that walks each major pillar of the platform —
one at a time — and fixes, optimizes, and refines it toward an MVP-ready state.
Not a feature build: every pillar already ships. The work is *audit → fix → verify*
per pillar.

### Pillars

1. **Engine pipeline** — the Apollo 3-call flow (Omni verbatim sensor → fold ∥
   Apollo reasoner). Qwen inputs/outputs, prompt quality, latency, correctness.
2. **Board / Test mode** — the analyze board UI/UX (frames, rendering, wiring).
3. **Board / Remix mode** — the remix board UI/UX.
4. **Chat feature** — the "ask the expert" chat dock UI/UX + grounding.
5. **General UI/UX** — cross-cutting polish (Numen brand, Raycast language,
   mobile, accessibility, dead UI).

## North star

Walk every pillar step by step until the product holds together end-to-end and
is **ready to put in front of real users**. Honest, fast, coherent.

## How this milestone runs (flexibility by design)

- **Loose pillar phases.** Each phase is a pillar, run as audit → fix-list →
  verify. Concrete to-dos are discovered at `/gsd-discuss-phase` time, not
  frozen upfront.
- **Add as you go.** New pillars or surfaced issues → `/gsd-phase add`.
- **Peel off quick wins.** A single isolated fix → `/gsd-quick`, no roadmap
  disturbance.

## Out of scope (deferred)

- **New features** — anything net-new (idea generator, A/B variants, iOS
  wrapper, landing rebuild, etc.) stays in the backlog. This milestone refines
  what exists.
- **Research** — no domain research; this is refinement of shipped surfaces.
