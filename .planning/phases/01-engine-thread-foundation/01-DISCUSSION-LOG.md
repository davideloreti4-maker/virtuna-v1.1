# Phase 1: Engine & Thread Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 1-Engine & Thread Foundation
**Areas discussed:** Text-mode Flash output shape, Composer routing + Phase-1 scope, Flash honesty framing spine, Thread/Reading data model + migration

---

## Text-mode Flash output shape (ENGINE-01)

### Q1 — How much of the 10-persona machinery surfaces?
| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate-forward, personas on demand | Band + 1-line verdict; personas behind expand | ✓ |
| All personas always visible | Every reaction inline | |
| Aggregate only, no personas | Score only, drop persona texture | |

**User's choice:** Aggregate-forward.
**Notes:** Owner added — want to set up so personas/audiences can be user-created/customized later; current persona system is "not that accurate or the end state we want." → keep personas data-driven/swappable.

### Q2 — Pull-score form?
| Option | Description | Selected |
|--------|-------------|----------|
| Banded + relative (Low/Med/High) | Band + audience-fraction; maps to score-gauge | ✓ |
| 0-100 numeric | Precise number | |
| Pure audience-fraction | % who stop, no band | |

**User's choice:** Banded + relative.

### Q3 — Per-persona reaction shape behind the expand?
| Option | Description | Selected |
|--------|-------------|----------|
| Verdict + one-line voice quote | Stop/scroll + first-person quote | ✓ |
| Verdict only | Binary/icon | |
| Quote only | Voice, no explicit verdict | |

**User's choice:** Verdict + one-line voice quote.

### Q4 — How is Hook vs Idea mode framing wired?
| Option | Description | Selected |
|--------|-------------|----------|
| Tool-runner parameter | Caller passes framing; one engine path | ✓ |
| Two separate engine functions | scoreHook()/scoreIdea() | |
| Single generic frame | One universal question | |

**User's choice:** Framing is a tool-runner parameter.

---

## Composer routing + Phase-1 scope (THREAD-02)

### Q1 — How does the composer decide where input goes?
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect, no toggle | Inspect input, route silently | |
| Explicit mode toggle | Creator picks before typing | ✓ (reframed) |
| Slash-command/prefix | /test, /idea | |

**User's choice:** Rejected auto-detect — "they should know which tool/skill they are about to use, as they also consume credit." → EXPLICIT selection.

### Q2 — How does the creator pick the tool?
| Option | Description | Selected |
|--------|-------------|----------|
| Tool chips/selector on composer | Chips show active tool + cost | ✓ |
| Tool launcher/command palette | Two-step picker | |
| Tool-per-route | Separate page per tool | |

**User's choice:** Tool chips/selector on the composer.

### Q3 — What ships on the chip row in Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| Test live + chip framework, rest "soon" | Only Test wired; others disabled | ✓ |
| Test + early open chat | Wire chat now | |
| Only build what's wired | No dead chips | |

**User's choice:** Test live + chip framework, rest "soon."

### Q4 — How to handle tool cost visibility now?
| Option | Description | Selected |
|--------|-------------|----------|
| Reserve affordance, defer metering | Cost slot at chip; no ledger yet | ✓ |
| Build basic credit metering in P1 | Real per-tool cost + balance | |
| No cost UI at all yet | Skip until tools charge | |

**User's choice:** Reserve the affordance, defer metering.

---

## Flash honesty framing spine (ENGINE-03)

### Q1 — How blunt should Flash-vs-Max be?
| Option | Description | Selected |
|--------|-------------|----------|
| Always-labeled, never blended | Persistent caveat per output | |
| Labeled once, then trusted | Tooltip on first use | |
| Subtle — same UI, footnote | Quiet distinction | |

**User's choice:** None of the above (reframed) — "in the composer we have a field showing the active model; when the user changes the skill/tool, the model changes too." → honesty carried by the composer's active-model field (model-selector pattern).

### Q2 — How is a past output (scrolled away) marked?
| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight model tag on block | 'SIM-1 Flash'/'SIM-1 Max' echo | ✓ |
| Composer field only | Nothing on the block | |
| Thread-level model context | Whole thread tagged | |

**User's choice:** Lightweight model tag on the output block.

### Q3 — What is a Flash output allowed to claim?
| Option | Description | Selected |
|--------|-------------|----------|
| Qualitative only — pull, never metrics | Band + fraction + verdict | ✓ |
| Pull + soft relative comparison | Niche percentile | |
| Pull + predicted reach band | Coarse reach tier | |

**User's choice:** Qualitative only.

---

## Thread/Reading data model + migration (THREAD-01/04/07)

### Q1 — How do existing Readings relate to the new thread model?
| Option | Description | Selected |
|--------|-------------|----------|
| Reading stays artifact, thread wraps it | analysis_results untouched; threads table | ✓ |
| Fold Reading into thread/messages | Collapse into new structure | |
| New threads only, old coexist | No backfill, two surfaces | |

**User's choice:** Reading stays the artifact, thread wraps it.

### Q2 — How are messages + typed blocks stored?
| Option | Description | Selected |
|--------|-------------|----------|
| messages table; blocks as typed JSON on row | One atomic row per message | ✓ |
| messages + separate blocks table | Block-per-row | |
| Reuse analysis_chats + blocks column | Extend existing table | |

**User's choice:** messages table; blocks as typed JSON on the row.

### Q3 — Guard against unknown/model-generated blocks?
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed registry + validate, unknown→skip | Closed registry SSOT | ✓ |
| Validate, fallback to markdown | Render raw on failure | |
| Trust output, no re-validation | Validate once at produce time | |

**User's choice:** Fixed registry + validate, unknown→skip/fallback.

### Q4 — When is an existing Reading's wrapping thread created?
| Option | Description | Selected |
|--------|-------------|----------|
| Lazy — create on first open | Idempotent on reading_id | ✓ |
| Eager backfill all | Migration creates all up front | |
| Decide later | Defer to planner | |

**User's choice:** Lazy — create on first open.

---

## Claude's Discretion

- Exact `threads`/`messages` column lists, indexes, RLS (follow `analysis_chats` pattern).
- Internal tool-runner type signatures for `{promptTemplate, knowledgeBundle, outputSchema, renderer}`.
- Placeholder copy/visual for disabled "coming soon" chips and "unsupported block."

## Deferred Ideas

- User-creatable/customizable personas (audiences) — v6.1+; keep personas data-driven in P1.
- Persona-system quality redo — current 10-archetype set is interim.
- Credit-metering system — Whop/tier-coupled ledger; P1 only reserves the chip cost affordance.
- Early open-chat — deliberately sequenced last (THREAD-03, Phase 5).
