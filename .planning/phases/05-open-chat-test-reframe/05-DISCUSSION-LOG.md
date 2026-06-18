# Phase 5: Studio Conversation Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 5-Studio Conversation Layer (re-scoped from "Open Chat & Test Reframe")
**Areas discussed:** Scope structure, Thread & context model, Progress affordance, Cards embedded in chat, Refine flow, Intent routing, Test reframe, Chat grounding, Cold-start & voice, Chain shape

---

## Scope structure (milestone re-scope)

Owner expanded the phase mid-discussion: add Script + Remix skills, smooth skill→skill flow (idea→hooks→script→test), chat-about-output refine with context kept, cards embedded in chat, and Perplexity-style progress.

| Option | Description | Selected |
|--------|-------------|----------|
| Split: P5 conversation layer + P6/P7 skills | P5 = conversation layer; Script (P6) + Remix (P7) as own phases | ✓ (then P6/P7 combined) |
| One mega Phase 5 | Everything in a single phase | |
| Faithful: P5 as-roadmapped, vision to P6+ | Keep P5 chat+test only, push all vision later | |

**User's choice:** Split — then follow-up instruction "combine p6 and p7 together" → **P6: Script & Remix Tools** (one phase).
**Notes:** Scripts + Remix were locked-deferred to v6.1 (STATE/PROJECT/ROADMAP); this consciously un-defers them. Prior art exists for both (`analyze/[id]/script`, `remix/adapt`, `milestone/viral-remix`).

---

## Thread & context model

| Option | Description | Selected |
|--------|-------------|----------|
| Single open thread, full running context | One thread; every run/turn reads full prior thread | ✓ |
| Single thread, windowed/summarized context | Bounded window + running summary | |
| Separate chat thread + skill threads, linked | Cleaner separation, cross-thread bridging | |

**User's choice:** Single open thread, full running context.
**Notes:** Captured a soft-cap guardrail (D-01a) as planner discretion for very long threads; default remains full context.

---

## Progress affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Real pipeline stages, streamed over SSE | Checkmarks map to real stages (incl. "simulating your audience") | ✓ |
| Generic timed shimmer (cosmetic) | Timer-driven labels | |
| Minimal single-line status | One rotating status line, no checklist | |

**User's choice:** Real pipeline stages → checkmarks over SSE.
**Notes:** Honesty spine — no fake timers. Requires skill routes to emit named stage events.

---

## Cards embedded in chat

| Option | Description | Selected |
|--------|-------------|----------|
| Model-authored, context-aware follow-up | Short markdown turn referencing this run | ✓ |
| Static templated nudge per skill | Fixed per-skill line | |
| No follow-up text — affordance on the card | "Refine →" on card only | |

**User's choice:** Model-authored, context-aware follow-up (persists as a chat turn).

---

## Refine flow

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run scoped → new tested card inline | Scoped re-run + fresh SIM score | ✓ |
| Conversational rewrite, no new card / no re-SIM | Plain text, untested | |
| Conversational answer + "Regenerate as card →" opt-in | Card only after tap | |

**User's choice:** Scoped re-run → new SIM-tested card inline + one-line chat note.
**Notes:** Keeps the "SIM-1 on everything" moat on refined output.

---

## Intent routing

| Option | Description | Selected |
|--------|-------------|----------|
| Chip primary + NL refine-detect + tap-to-launch CTAs | Chip = signal; refine by card-reference; CTAs tapped to launch | ✓ |
| Full NL router — model classifies & auto-launches | Auto-fire skills | |
| Strict chip-only — no NL intent | Manual card selection | |

**User's choice:** Chip primary + NL refine-detect + tap-to-launch CTAs.
**Notes:** No silent auto-fire — a skill only runs on chip send or CTA tap (cost honesty).

---

## Test reframe

| Option | Description | Selected |
|--------|-------------|----------|
| Reframe hero+entry, brief shown above upload | Rename hero + entry language + SIM-1 Max tag + landing brief | ✓ |
| Full rename everywhere "Reading" appears | App-wide string sweep | |
| Minimal: badge only, no entry-language change | Badge + landing brief only | |

**User's choice:** Reframe hero + entry; carried hook shown as brief above upload.
**Notes:** Presentation/wiring only — no `ENGINE_VERSION` bump, video path unchanged. Rename depth beyond hero/entry is planner discretion (D-06a).

---

## Chat grounding

| Option | Description | Selected |
|--------|-------------|----------|
| Tight per-turn assembly via assembleBundle(mode:chat) | Niche + craft frame + thread context + stance-slice | ✓ |
| Full profile + full KC every turn | Dilution + bloat | |
| Stance-slice only (minimal grounding) | Drifts generic | |

**User's choice:** Tight per-turn assembly (anti-dilution, GROUND-02).

---

## Cold-start & voice

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful degrade to platform baselines + co-pilot voice + gentle nudge | Niche/platform baselines + nudge; Numen co-pilot voice | ✓ |
| Block until profile exists | Hard gate | |
| Generic chat when no profile | Plain assistant, off-brand | |

**User's choice:** Graceful degrade + co-pilot voice + soft nudge.

---

## Chain shape

| Option | Description | Selected |
|--------|-------------|----------|
| Script mid-chain; Remix as alt funnel-top entry | [Remix or Idea] → Hooks → Script → Test; one generic handoff | ✓ |
| Strictly linear idea→hooks→script→test; Remix standalone | Remix doesn't chain | |
| Defer chain position to P6; P5 builds max-generic plumbing | Unvalidated over-build | |

**User's choice:** Script mid-chain; Remix alt entry. P5 builds one generic anchor-carry handoff; P6 plugs in.

---

## Claude's Discretion

- Soft context cap / windowing for long threads (default full context).
- Progress affordance render form (transient block vs ephemeral SSE UI) + exact per-skill stage labels.
- Scoped-refine payload shape + how the re-scored card replaces/stacks vs the original.
- Refine-intent NL detection heuristics + suggested-CTA copy.
- How far the user-facing "Reading"→"Test" sweep extends (bounded by protected path).
- Generic chain-handoff contract surface (built to fit Script/Remix).
- THEME-06 flat-warm visual SSOT for all new affordances.

## Deferred Ideas

- Script & Remix skills → Phase 6 (un-deferred from v6.1).
- Full-NL auto-launch router — rejected for P5.
- Full app-wide "Reading"→"Test" string sweep — optional beyond hero/entry/brief.
- Autonomous generate→critique→regenerate loop — refine is user-initiated only.
- In-thread monetization, brand-profile, RAG-over-history, desktop dense-instrument — v6.1+.
