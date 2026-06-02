# Phase 4: Adapt Frame + Niche - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 04-adapt-frame-niche
**Areas discussed:** Decode→Adapt contract, Generation trigger/flow, Concept card anatomy, Empty-niche inline prompt

> User standing preference: lead with a recommendation on every question.

---

## Decode→Adapt contract

### What Adapt receives from Decode

| Option | Description | Selected |
|--------|-------------|----------|
| Structural fields + repeatable lane | 4 structural fields + repeatable[] items; excludes luck lane + raw caption | ✓ |
| Repeatable lane only | Only the repeatable[] bullet items; may starve the prompt of structural grounding | |
| Full decode object incl. luck | Pass everything; risks adapting luck-attributed elements (violates criterion 3) | |

**User's choice:** Structural fields + repeatable lane (recommended).

### Contract mechanism (cross-worktree mergeability)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared type file + fixture | New `decode-types.ts` + `decode.fixture.ts`; Phase 3 imports the type | ✓ |
| Phase-4-owned consumer interface | Phase 4 defines a decoupled subset; mapper at Phase 5; risks mismatch | |
| Inline fixture, no shared type | Hardcoded fixture + local type; no enforced contract | |

**User's choice:** Shared type file + fixture (recommended).
**Notes:** Phase 3 (parallel worktree) MUST import the type, not redefine it.

---

## Generation trigger/flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto after Decode (niche present) | Auto-generate once Decode completes; empty niche gates; one cheap Qwen call | ✓ |
| On-demand button | User clicks 'Generate concepts'; defers cost but adds friction + empty frame | |
| Auto + regenerate control | Auto-generate + reroll affordance; most flexible, more UI/cost | |

**User's choice:** Auto after Decode, niche present (recommended).
**Notes:** Derived — persisted to `variants.remix.adapt`, rehydrated on reload (no regen); frames fail independently; regenerate deferred.

---

## Concept card anatomy

### Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Three stacked cards | All 3 fully visible; fits tall column; Raycast card language | ✓ |
| Accordion / expandable | Collapsed hooks, expand for detail; hides the payoff | |
| Tabbed single card | One concept visible at a time; hurts comparison | |

**User's choice:** Three stacked cards (recommended).

### Field hierarchy + format_borrowed surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Hook headline + borrowed chip | Hook bold headline; format_borrowed chip; angle + who-it's-for muted rows | ✓ |
| Angle headline | Lead with angle; hook secondary | |
| Equal labeled rows | All four fields equal; flatter, no payoff signal | |

**User's choice:** Hook headline + borrowed chip (recommended).

---

## Empty-niche inline prompt

### Prompt UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline NichePicker (reuse) | Embed existing compact NichePicker in-frame; maps to niche_primary/sub | ✓ |
| One-line free-text input | Faster but doesn't map to taxonomy; inconsistent data | |
| CTA to profile settings | Links out; breaks remix flow with context switch | |

**User's choice:** Inline NichePicker reuse (recommended).

### Persistence of inline-picked niche

| Option | Description | Selected |
|--------|-------------|----------|
| Persist to creator-profile | PATCH niche_primary/sub then generate; profile stays SSOT, no re-prompt | ✓ |
| Session-only / one-off | Use once, don't save; re-prompts every time, diverges from profile | |

**User's choice:** Persist to creator-profile (recommended).

---

## Claude's Discretion

- Compact styling/density of the inline NichePicker inside a board frame.
- Qwen adapt prompt design enforcing "exactly 3 distinct concepts" + "format not content" + repair/retry on malformed output.
- `format_borrowed` chip copy/derivation + muted-row typography.
- Realistic content of `decode.fixture.ts` (hand-author now, swap for real capture when Phase 3 lands).
- TS typing of the adapt source/concept types and adapt wiring into the remix path.

## Deferred Ideas

- Concept regenerate/reroll — deferred.
- Develop & predict + `parent_id` lineage + "remixed from" chip — Phase 5.
- Decode frame content — Phase 3 (consumed via fixture meanwhile).
- Free-text / richer niche capture beyond the taxonomy — out of scope.
