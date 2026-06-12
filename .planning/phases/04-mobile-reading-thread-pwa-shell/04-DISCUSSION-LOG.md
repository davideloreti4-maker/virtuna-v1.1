# Phase 4: Mobile Reading Thread + PWA Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 4-Mobile Reading Thread + PWA Shell
**Areas discussed:** Thread framing & metaphor, Throne reveal behavior, Block order & pacing, PWA install + offline scope
**Mode:** Davide selected all 4 areas and asked for a thought-through recommendation on each; Claude recommended one decision per area, Davide locked all 4 as-is.

---

## Thread framing & metaphor (READ-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure document | Single-column, no thread chrome | |
| Full chat-thread | Bubbles + avatar, Reading as assistant messages | |
| Document-as-first-turn in a minimal thread shell (hybrid) | One rich structured turn inside a thread container w/ persistent "analyze new" + inert Phase-5 reply input | ✓ |

**User's choice:** Document-as-first-turn hybrid (D-01)
**Notes:** Thread bones are load-bearing for Phases 5–6 (chat spine for "ask the expert"); bubble chrome would reproduce the rejected "neon AI chatbot" feel.

---

## Throne reveal behavior (READ-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reserved calm "forming" placeholder → crystallize last | Neutral held slot, no band/number, locks via one DS-07 motion at `complete` | ✓ |
| Provisional updating band | Band shifts as evidence accrues, locks last | |
| Blank-then-drop-in | Empty space until the climax | |

**User's choice:** Reserved forming placeholder (D-02)
**Notes:** Engine score only resolves at `complete` — a provisional band would fabricate-then-revise confidence (the confident-lie the gate kills). `/100` demoted to in-body only; "Mixed signals" a first-class throne state.

---

## Block order & pacing (READ-02 / READ-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Raw stage-completion order | Blocks appear as their engine stage finishes | |
| Curated narrative order + streaming-driven reveal timing | Fixed sequence (Apollo pinned under throne), each block reveals when its stage lands | ✓ |

**User's choice:** Curated order + streaming reveal (D-03)
**Notes:** Raw order buries late-stage Apollo (violates READ-05) and is nondeterministic (breaks live/resting parity feel). Proposed order: Throne → Apollo → Hook → Retention → Audience → Drivers → Persona-read → Fixes → Content-summary → Audio. As-soon-as-ready pacing, no one-at-a-time gating.

---

## PWA install + offline scope (SHELL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Passive post-first-Reading hint + menu affordance | Dismissible "Share → Add to Home Screen" after first Reading; quiet menu install; never a modal | ✓ |
| Menu/settings affordance only | | |
| Contextual prompt on second visit | | |
| Offline: app shell + cache-on-view of opened Readings | New analysis online-only; opened Readings cache as resting docs | ✓ |

**User's choice:** Passive post-first-Reading hint + cache-on-view offline (D-04/D-05)
**Notes:** Post-value = highest-conversion, lowest-intrusion moment; iOS requires coached manual install anyway. Cache-on-view reinforces resting-document permanence. Offline-first full-history sync deferred to Phase 5+.

---

## Claude's Discretion

- Exact "forming" throne affordance visual (within the calm/no-fake-band intent).
- Verdict-block treatment of the demoted `/100` + distinct "Mixed signals" visual (UI-phase).
- Per-block layout, thread-shell chrome, inert reply-input styling.
- Serwist config specifics (precache/runtime strategies, `maxDuration` interplay).
- Whether the curated order collapses low-value blocks on small viewports.

## Deferred Ideas

- "Ask the expert" conversation round-trip (P4 = inert input shell only) → Phase 5/6.
- Home list + per-video routing + ingestion (SHELL-01/02/03, IN-*) → Phase 5.
- Offline-first full-history sync → Phase 5+.
- Desktop instrument (Konva keep-vs-retire) → Phase 7.
- Reviewed-not-folded: `phase-03-deployed-smoke-gate.md` — carried as a build-not-ship constraint, not Phase-4 scope.
