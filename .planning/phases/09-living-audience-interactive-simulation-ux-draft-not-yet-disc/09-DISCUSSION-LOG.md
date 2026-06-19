# Phase 9: Living Audience — interactive simulation UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 9-living-audience-interactive-simulation-ux
**Areas discussed:** P9 cut line, Population·1,000 honesty, Chat-with-persona, AudienceLens spine + Rewrite loop, Reaction replay, Scale toggle placement

> User requested grounded recommendations on every option; recommendations were presented with rationale before each choice.

---

## P9 cut line

| Option | Description | Selected |
|--------|-------------|----------|
| Panel·10 core + lean Population | Waves 1–3 full Panel·10 living experience; final wave Population·1,000 lean honest v1; per-dot drill deferred | ✓ |
| Panel·10 only; defer Population entirely | v1 intimate-10 only; Population to v6.1 | |
| Everything incl. per-dot Population drill | Full sketch 005 + per-dot Population drill in v1 | |

**User's choice:** Panel·10 core + lean Population (recommended).
**Notes:** Respects the locked sketch-005 choice (Population is the "missing touch" that won 005) while holding back the heaviest/riskiest per-dot drill. P8 already shipped The Read + verbatim + who-it's-NOT-for as static cards.

---

## Population·1,000 honesty model

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic instantiation from the 10 | Seeded bounded variance off the 10 real reactions; aggregate = weighted rollup; cascade = visual; zero per-dot model calls | ✓ |
| Hybrid — a few extra variance-persona calls | Mostly deterministic + small number of extra model calls | |
| Per-dot independent sampling | Each dot sampled independently; breaks determinism gate | |

**User's choice:** Deterministic instantiation from the 10 (recommended).
**Notes:** Protects engine determinism gate, Qwen-only cost, and the honesty spine. Population and Panel render the same signal at different resolutions.

---

## Chat-with-persona session model

| Option | Description | Selected |
|--------|-------------|----------|
| In-context drawer, sub-thread persisted | Drawer over the cloud scoped to the Read; grounded on persona-registry + reaction-to-this-concept; lightweight sub-thread; one persona at a time | ✓ |
| New top-level thread per persona | Sibling thread in the thread list | |
| Fully ephemeral | No persistence; closes on dismiss | |

**User's choice:** In-context drawer, sub-thread persisted (recommended).
**Notes:** Keeps thread list clean (`chat` not in `SkillId` union); reuses `chat-runner.ts`.

---

## AudienceLens spine + Rewrite loop

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable component, mount on Test/Read v1 | Reusable; v1 mount = Test/Read via PersonaCloud onOpen; generalize later | |
| Retrofit inline across all 6 skills now | Mount on every skill's inline card this phase | ✓ |
| Bespoke to Test, not reusable | Build for Test, refactor to shared spine later | |

**User's choice:** Retrofit inline across all 6 skills now (OVERRODE the recommended "mount on Test/Read only").
**Notes:** Deliberate full-vision scope per sketch 005 ("one shared component every skill mounts"). Resolved in follow-up to "mount everywhere, degrade by feature" so it stays one component; planner should wave the rich-signal mount (Test/Read) first. Rewrite-for-audience re-runs the originating skill with the lever as steering → new card + Read in-thread via `CHAIN_HANDOFFS`, showing the delta.

---

## Retrofit shape (follow-up on the override)

| Option | Description | Selected |
|--------|-------------|----------|
| Mount everywhere, degrade by feature | One reusable Lens on all 6; replay only where timeline exists; staggered reveal elsewhere | ✓ |
| Full Lens only where signal is rich | Full on Test/Read + remix; lighter entry on ideas/hooks/script | |
| Identical Lens everywhere, no degradation | Force identical experience incl. synthesized pseudo-timeline | |

**User's choice:** Mount everywhere, degrade by feature (recommended).

---

## Reaction replay (text concepts)

| Option | Description | Selected |
|--------|-------------|----------|
| Staggered reveal where no timeline | Segment-by-segment on Test/Read; staggered cascade for text concepts | ✓ |
| Synthesize a pseudo-timeline for text | Generate fake beat markers so replay looks identical | |
| Replay only on Test/Read; instant elsewhere | Text concepts skip animation entirely | |

**User's choice:** Staggered reveal where no timeline (recommended).
**Notes:** No synthesized pseudo-timeline — honesty spine.

---

## Scale toggle placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-Read, remembers last choice | Toggle on each opened Read; defaults to last-used | ✓ |
| Audience-level setting | Set once per audience; every Read inherits | |
| Always start Panel·10, manual toggle | Every Read opens intimate; explicit toggle each time | |

**User's choice:** Per-Read, remembers last choice (recommended).
**Notes:** Resolves sketch 005's open "per-Read vs audience-level" question.

---

## Claude's Discretion

- Cluster-by-segment grouping/labels via existing `buildSegmentGroups` (Temp×Disposition lens).
- Desktop docked-pane layout (sketch open item) — mobile-first this phase.
- Swarm animation accessibility (`reducedMotion` gating + sr-only mirror).
- Population dot count (~1,000 nominal) + 70/30 archetype/variance split tuning.
- Rewrite CTA visibility on non-regenerable surfaces (chat turns).

## Deferred Ideas

- Population per-dot tap-to-drill (region → archetype) — fast-follow.
- "Ask the whole room" multi-persona chat — one persona at a time in v1.
- Synthesized pseudo-timeline for text concepts — rejected (honesty spine).
- Desktop docked-pane layout refinement.
- Account Read / saved shelf / recalibration flywheel — Phase 10.
