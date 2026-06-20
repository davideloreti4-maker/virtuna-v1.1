# Phase 13: Ambient Numen — the living, always-present audience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 13-proactive-numen-ambient-initiated (narrowed → "Ambient Numen")
**Areas discussed:** Ambient form, Drop source, Delivery, Automations, Type-to-room, Differentiation, Keep P9 Lens

---

## Round 1 — original 4-area framing (Ambient + Initiated)

### Ambient form (AMBIENT-01)
| Option | Description | Selected |
|--------|-------------|----------|
| Promote the cue itself (Recommended) | Upgrade the LensTrigger cue to render live sentiment at rest; one component, zero new card elements | |
| Inline reaction line on card | Separate one-line snippet above the cue | |
| Persistent micro-cloud strip | Always-visible dot-strip on the card | |

**User's choice (free-text):** "i want something that is always present and reacting making the audience feel real and being able to interact and get value from it"
**Notes:** Reframed the phase from "a reaction per card" to a **persistent, living, interactive audience presence** — bigger than any single offered option. Drove Round 2.

### Drop source (PROACTIVE-01)
| Option | Description | Selected |
|--------|-------------|----------|
| Explore pull, cron pre-compute (Recommended) | Audience-fit outliers pre-computed overnight (audience-drift precedent) | |
| Audience ideas, on-open lazy | Generate 3 concepts lazily on first open | |
| Mix: outliers + ideas (cron) | Blend discovery + make | |

**User's choice:** "lets defer this for now"
**Notes:** Deferred → new "Initiated Numen" phase. (Recommended shape recorded in CONTEXT Deferred Ideas.)

### Delivery (PROACTIVE-01/02)
| Option | Description | Selected |
|--------|-------------|----------|
| In-thread drop + opt-in nudge (Recommended) | Drop block in-thread + lightweight opt-in return nudge (reuse user_settings) | |
| In-thread drop card only | No nudge | |
| Notification only → thread | Nudge primary, deep-links to thread | |

**User's choice:** "lets defer for now"
**Notes:** Deferred → "Initiated Numen."

### Automations (PROACTIVE-02)
| Option | Description | Selected |
|--------|-------------|----------|
| Default automation, one light surface (Recommended) | Morning drop = default automation; one surface tunes cadence + recurring pulls | |
| 'Schedule this' on Explore | Per-pull scheduling affordance | |
| Settings automations list | Dedicated manager | |

**User's choice:** "lets defer automations for now"
**Notes:** Deferred → "Initiated Numen."

---

## Round 2 — deep-dive on the narrowed Ambient layer

### Ambient surface — where the living audience lives
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent presence + per-card reactions (Recommended) | Always-docked presence (felt between cards) + every card reacts at rest; both feed the Lens | ✓ |
| Per-card only (promoted cue) | Reactions only where a card exists | |
| Persistent presence only | Docked presence; cards keep tap-to-open cue | |

**User's choice:** Persistent presence + per-card reactions
**Notes:** → CONTEXT D-01.

### Reaction trigger — when/what it reacts to
| Option | Description | Selected |
|--------|-------------|----------|
| On every generated card + presence reflects latest (Recommended) | Reuses data each skill emits; no new model calls | ✓ |
| + Live composer reaction as you type | Debounced Flash on composer text | |
| Only the active/last concept | Just the most-recent concept | |

**User's choice:** Option 1, **plus** "you can also type / interact with the audience"
**Notes:** Added the type-to-room affordance → drove the next question. → CONTEXT D-03 + D-04.

### Type-to-room — react vs converse
| Option | Description | Selected |
|--------|-------------|----------|
| Type a thought → the room reacts (Recommended) | Real SIM reaction returns; reuses Flash text-mode primitive; depth via per-persona Lens chat | ✓ |
| Ask the whole room → personas answer | Multi-persona conversational (reopens P9-deferred scope) | |
| Both | Largest build | |

**User's choice:** "Type a thought → the room reacts" (after asking "what makes the most sense for user value and UX?" — Claude reasoned: reaction = the moat/foresight, right tempo for an ambient layer, honest, smallest build; conversational depth preserved one tap deeper via P9 per-persona chat).
**Notes:** → CONTEXT D-04. "Ask the whole room" stays deferred.

### Differentiating many concepts in one thread (owner-raised)
| Option | Description | Selected |
|--------|-------------|----------|
| Live spotlight on the in-focus concept (Recommended) | Presence reflects ONE labeled concept; defaults to latest, re-focuses on tap/scroll/type; cards keep durable inline reactions; never aggregates | ✓ |
| Identity-only presence; reactions stay on cards | Presence = roster + input only | |
| Running stack of recent reactions | Side-by-side scoreboard (dashboard-y) | |

**User's choice:** Live spotlight on the in-focus concept
**Notes:** Owner surfaced the honesty crux — reactions can't be blended across content types. → CONTEXT D-02.

### Keep P9's per-card Lens?
| Option | Description | Selected |
|--------|-------------|----------|
| Keep it — per-artifact depth (Recommended) | Every card keeps tap → full Lens scoped to that concept; ambient is additive; one Lens many doors | ✓ |
| Replace it — presence subsumes per-card | Single focal surface, loses scoped depth | |

**User's choice:** Keep it
**Notes:** → CONTEXT D-05. Resolves "extend, don't duplicate" — every door opens the same Lens.

---

## Claude's Discretion
- Visual form + dock location of the persistent presence (UI-phase, flat-warm, mobile-first).
- Per-card "reaction at rest" rendering — prefer promoting the existing LensTrigger cue.
- "reacting to: X" subject label + re-focus interaction (scroll-spy vs tap).
- Motion (reuse PersonaGraph mulberry32 + reducedMotion).
- Type-to-room debounce / latency / input placement.
- Presence behavior vs the open-thread singleton (awareness only).

## Deferred Ideas
- **→ New "Initiated Numen" phase:** PROACTIVE-01 morning drops (Explore-pull cron pre-compute),
  PROACTIVE-02 scheduled Explore / Automations (default automation + one light surface), proactive
  delivery (in-thread drop + opt-in nudge). **⚠ ROADMAP reconciliation required.**
- "Ask the whole room" multi-persona conversational chat (P9-deferred).
- Live reaction in the MAIN composer as you type.
- Running-stack / dashboard view of recent reactions.
