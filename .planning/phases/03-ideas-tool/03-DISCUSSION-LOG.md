# Phase 3: Ideas Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 3-Ideas Tool
**Areas discussed:** Viability score (what Flash judges + gate-vs-hint), Niche-instantiate the text SIM (lever #10), Idea card anatomy + legible grounding, Entry mode + volume + cold-start + chain

> Owner requested a reasoned recommendation per option set; recommended option marked in each AskUserQuestion. All recommendations accepted (one with a clarifying question that was resolved inline).

---

## Area 1 — Viability score: what Flash judges + gate-vs-hint

### Q1 — What does SIM-1 Flash react to for an idea card?
| Option | Description | Selected |
|--------|-------------|----------|
| The idea's seed hook (proxy) | KC slice emits one seed hook/concept; a hook is a real content piece SIM can read; resolves altitude flag; concept-ceiling framing | ✓ (resolved) |
| The concept directly, Idea framing | 'in your niche would this make you stop/share?' on concept text; backlog warns raw concept is upstream | |
| Both: hook scores, concept gates | Two Flash passes; most faithful, more cost | |

**User's choice:** "can be both scored in 1 pass?" → resolved inline: **yes — one Flash pass on the seed hook scores the hook (hint) AND its band gates the card; the concept is gated separately by the KC self-rejection Value Bar at generation time (no second SIM pass).**
**Notes:** This produced the "two bounded gates, one SIM pass" model (CONTEXT D-01/D-02).

### Q2 — Gate (ENGINE-02) × hint (IDEAS-02) relationship + bounded regen
| Option | Description | Selected |
|--------|-------------|----------|
| One shared pass; over-gen buffer, filter, no regen | Single reaction does double duty; over-generate N+2, drop sub-floor, no regen loop (lever #3 = future) | ✓ |
| Separate judge pass + hint pass | ~2x Flash cost | |
| Over-generate + one bounded regen pass | Pulls backlog #3 forward; more cost/latency | |

**User's choice:** One shared pass; over-gen buffer, filter, no regen.

### Q3 — Card lead (SIM-is-a-gate-not-ranker)
| Option | Description | Selected |
|--------|-------------|----------|
| A sharp scroll-quote | Per-persona 'why they scrolled' texture leads; band secondary; matches owner reframe | ✓ |
| Band + audience-fraction | Scoreboard-like; risks reading as a ranker | |
| You decide | Planner picks | |

**User's choice:** A sharp scroll-quote.

---

## Area 2 — Niche-instantiate the text SIM (lever #10)

### Q1 — Is lever #10 in Phase 3, and how far?
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — niche panel + threshold recalibration | Thread niche into runFlashTextMode + selectPersonaSlots + recalibrate; text path only, Max untouched | ✓ |
| Yes — niche panel only, defer recalibration | Cheaper; un-recalibrated thresholds may mis-fire | |
| Defer to a later phase | Ships known-flat gate; moat demo lands weak | |

**User's choice:** Yes — niche panel + threshold recalibration.

### Q2 — How to prove the recalibrated gate discriminates?
| Option | Description | Selected |
|--------|-------------|----------|
| Slop-vs-strong test as the calibration gate | Garbage vs known-great; validates the gate itself; acceptance check for the engine task | ✓ |
| Owner spot-check on real prompts | Subjective, no repeatable artifact | |
| You decide | Planner picks | |

**User's choice:** Slop-vs-strong test as the calibration gate.

---

## Area 3 — Idea card anatomy + legible grounding

### Q1 — Card face vs expand
| Option | Description | Selected |
|--------|-------------|----------|
| Title · angle · why-it-fits + lead scroll-quote | Concept-forward face; mechanism/hook/Topic×Take×Format behind expand; scannable list | ✓ |
| Full anatomy on the face | Heavy, less scannable | |
| Minimal: title + why + score | Risks 'trailer not film' failure | |

**User's choice:** Title · angle · why-it-fits + lead scroll-quote.

### Q2 — How GROUND-03 'why it fits you' is rendered
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated grounding line citing real profile signals | Visually distinct; from assembler profile fields; honest cold-start; the 'not a chatbot' differentiator | ✓ |
| Inline prose woven into the angle | Visually indistinct; weakens differentiation | |
| You decide | Planner picks | |

**User's choice:** Dedicated grounding line citing real profile signals.

### Q3 — Idea card in the typed-block registry
| Option | Description | Selected |
|--------|-------------|----------|
| New 'idea-card' block in the registry | Schema-validated; embeds band+quote; clean contract; Hooks replicates in P4 | ✓ |
| Compose from existing blocks | Weaker contract, harder to style | |
| You decide | Planner picks | |

**User's choice:** New 'idea-card' block in the registry.

### Q4 — Surface the 'needs your first-hand take' flag?
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — visible badge | Honest + actionable; tells creator where to add themselves | ✓ |
| No — generation-only | Simpler card; loses an authored honesty signal | |

**User's choice:** Yes — visible badge.

---

## Area 4 — Entry mode + volume + cold-start + chain

### Q1 — Auto vs seeded entry (IDEAS-01)
| Option | Description | Selected |
|--------|-------------|----------|
| Empty send = Auto; typed text = seeded | One composer, no new UI; rides P1 D-06/D-07 | ✓ |
| Always require a seed | Kills the funnel-top Auto path | |
| Separate Auto button + seed field | Adds UI; against universal composer | |

**User's choice:** Empty send = Auto; typed text = seeded.

### Q2 — How many cards (N)?
| Option | Description | Selected |
|--------|-------------|----------|
| 3 cards (over-generate ~5, gate to 3) | Diversity without overwhelm/cost; pairs with over-gen+filter gate | ✓ |
| 5 cards (over-generate ~7-8) | More choice, more cost + scroll | |
| You decide | Planner tunes | |

**User's choice:** 3 cards (over-generate ~5, gate to 3).

### Q3 — Cold-start / thin profile (PROFILE-01)
| Option | Description | Selected |
|--------|-------------|----------|
| Platform-baseline craft + honest 'general' flag | Assembler already degrades; honest grounding line; never fabricated | ✓ |
| Block Ideas until a profile exists | Higher friction; kills cold-start funnel | |
| You decide | Planner picks | |

**User's choice:** Platform-baseline craft + honest 'general' flag.

### Q4 — Where 'Develop this →' lands (IDEAS-03/THREAD-05)
| Option | Description | Selected |
|--------|-------------|----------|
| Same thread — append Hooks below the idea | Assembler anchor already carries the idea; preserves context + spine; reuses persistence | ✓ |
| New thread seeded with the idea as anchor | Cleaner separation; loses in-thread chain feel | |
| You decide | Planner picks | |

**User's choice:** Same thread — append Hooks below the idea.

---

## Claude's Discretion

- Over-generate buffer size + precise slop-floor / STRONG/MIXED threshold values (tuned via the slop-vs-strong test).
- `idea-card` block prop names, expand interaction, grounding-line/badge visual treatment (THEME-06 SSOT).
- Ideas API route shape + content-first streaming orchestration (the `stream?` seam).
- Internal signatures for niche thread-through into `runFlashTextMode` + `selectPersonaSlots` wiring.
- KC_GEN_VERSION stamping on persisted Ideas outputs.

## Deferred Ideas

- Generate→critique→regenerate quality loop (lever #3) — future KC Grounding & Quality-Loop phase.
- Real-exemplar RAG (#1), performance flywheel (#8), voice calibration (#7), flop-prediction (#6) — future rightness levers.
- 4-outcome SIM model (stop + save/share/comment) — optional, honesty-spine-careful; not v1.
- Hooks UI (P4), open chat + Test reframe (P5), Scripts/Remix (v6.1).
- Profile redesign + social-handle scrape prefill (v6.1).
- Per-card independent SIM concept-judgment — deliberately not done (concept gated by KC self-rejection instead).
