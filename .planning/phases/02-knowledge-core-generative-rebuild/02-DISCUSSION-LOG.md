# Phase 2: Knowledge-Core Generative Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 2-Knowledge-Core Generative Rebuild
**Areas discussed:** KC structure/schema · Authoring source & "from scratch" line · Generative eval · v1 slice coverage (+ the general-craft-intelligence north star, surfaced mid-discussion by the owner)

---

## North Star — KC = General Craft Intelligence (owner-raised, "extremely important")

Owner pushed back on framing the KC as a "generative shape" opposite a "scoring shape." Resolved: "shape" is a property of the task-lens (slice), not the knowledge. The base is domain-general craft truth; slices point it at purposes on demand (Ideas/Hooks/chat now; scoring/script/decode/remix later, same base, no re-author). Greenfield still holds because the *current* KC's craft is scoring-biased ("not future-relevant"). → **D-00 / D-00a**.

---

## Area 1 — KC structure / schema

### Q1 — Authored content SSOT
| Option | Description | Selected |
|--------|-------------|----------|
| Markdown SSOT → compiled constants | Prose in `.planning/corpus/`, scripted regen to byte-stable constants | ✓ |
| Structured data files (JSON/YAML) | Machine-first slices | |
| Author directly in TS constants | Skip the .md layer | |

**User's choice:** Markdown SSOT → compiled constants. → **D-01**

### Q2 — Composition model
| Option | Description | Selected |
|--------|-------------|----------|
| Layered: base + slice + live | Additive, thin base, author-time curation | ✓ |
| Slice replaces base | Standalone per-mode brains | |
| Flat single KC, filtered per request | Retrieval/section-tags | |

**User's choice:** Layered (asked for a deeper unbiased explanation first; confirmed after). → **D-02**
**Notes:** Owner wanted the layered concept explained fully and unbiased ("how we really optimize for best quality and value"). Key point landed: author-time curation > runtime retrieval for v1; composable-modules + RAG = v2.

### Q3 — Cache mapping
| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier cached prefix (base+slice cached, live dynamic) | Per-mode byte-stable system prefix | ✓ |
| Single shared cached base | Slice+live both dynamic | |
| Assemble everything at runtime | No cache discipline | |

**User's choice:** Two-tier cached prefix. → **D-03**

### Q4 — Authoring template
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed template (base 3 / slice 4) | Consistent skeleton | ✓ |
| Free-form prose | No enforced sections | |
| Mirror scoring-KC structure | §1 persona … §6 lenses | |

**User's choice:** Fixed template — and raised the core product bar: "most tools' output isn't useful, valuable, actionable, real." → enriched to value-forcing. → **D-04**

### Q4b — Value-forcing enrichment
| Option | Description | Selected |
|--------|-------------|----------|
| Enriched value-forcing template | Base += Value Bar/Self-Rejection; Slice += Gold-Standard Patterns + Actionability Contract | ✓ |
| Keep lean; enforce at runtime | Value in prompt/judge code | |
| Go further — per-slice scored rubric | Re-imports scoring shape | |

**User's choice:** Enriched value-forcing. Asked for further gap analysis. → **D-04** (+ intra-batch diversity, flops-as-negative-grounding adopted).

### Q5 / Q5b / Q5c — GROUND-02 live-tier assembler
| Option | Description | Selected |
|--------|-------------|----------|
| Per-mode field-map + cap + graceful degrade | Tight slice, no dilution | ✓ |
| Pass whole profile | Model selects | |
| RAG/retrieval | Deferred per vision §7 | |

**User's choice:** Field-map approach; expanded the live-source set after owner asked "what else can we use?" → live sources = ask · platform · profile(by role) · overrides · chain/thread anchor. Owner noted the profile is being redesigned (fewer cards + social-scrape) → by-semantic-role constraint. Platform locked as first-class param. → **D-05, D-07**.
**Notes:** Platform-craft authoring = TikTok-first + inline deltas. Platform UX = persistent composer chip (owner referenced Artificial Societies' per-test modal; resolved to chip to avoid friction + thread lock-in).

### Q6 — Versioning
| Option | Description | Selected |
|--------|-------------|----------|
| Own version tag, decoupled from ENGINE_VERSION | Reproducible + clean boundary | ✓ |
| Extend existing corpus-version | Entangles with scoring | |
| No explicit version | No provenance | |

**User's choice:** Own `KC_GEN_VERSION`, decoupled. → **D-06**

---

## Area 2 — Authoring source & the "from scratch" line

### Q1 — "Not retrofitted" interpretation
| Option | Description | Selected |
|--------|-------------|----------|
| Re-author craft in generative stance | §2 as one input, re-framed | |
| Strictly greenfield | Never open the scoring KC | ✓ |
| Port §2 re-pointed | The forbidden retrofit | |

**User's choice:** Strictly greenfield. → **D-08**

### Q2 — Knowledge sources (multi-select)
| Option | Description | Selected |
|--------|-------------|----------|
| Owner domain expertise | Primary spine | ✓ |
| External craft research | Agent-gathered, owner-curated | ✓ |
| Chase Hughes behavioral layer | Parked persuasion knowledge | |
| First-principles (Claude-drafted) | Connective tissue | ✓ (with care) |

**User's choice:** Owner + External research + First-principles — owner flagged "be careful" on first-principles (never primary). Chase Hughes excluded. → **D-09**

### Q3 — Workstream loop
| Option | Description | Selected |
|--------|-------------|----------|
| Draft → owner-curate → eval loop | Owner = taste arbiter | ✓ |
| Owner authors raw, Claude structures | Bottlenecked on owner time | |
| Claude drafts, owner approves at end | Weak mid-loop curation | |

**User's choice:** Draft → owner-curate → eval loop. → **D-10**

### Q4 — Authoring strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Narrow & deep first, then replicate | Early checkpoint on the long pole | ✓ |
| Broad & even, eval at end | No early de-risk | |

**User's choice:** Narrow & deep first. → **D-11**

---

## Area 3 — Generative eval (deprioritized by owner)

Owner reframed the baseline framing (rejected "scoring shape vs generative shape" → general craft intelligence) and deprioritized eval ("I don't see eval as top priority right now — let's nail the foundation").

### Q1 (reframed) — What the new KC is checked against
| Option | Description | Selected |
|--------|-------------|----------|
| Both raw-LLM and the current KC | Beats plain ChatGPT AND the old brain | ✓ |
| Only vs raw-LLM | | |
| Only vs current KC | | |

**User's choice:** Both. → **D-13**

### Q2 — Judge (Goodhart guard)
| Option | Description | Selected |
|--------|-------------|----------|
| Flash delta gate + owner blind spot-check | Independent guard vs gaming the metric | ✓ |
| SIM-1 Flash self-judge only | Goodhart risk | |
| Owner blind only | Not reproducible | |

**User's choice:** Flash delta + owner blind spot-check. → **D-12**

### Q3 (→Q2) — Eval rigor
| Option | Description | Selected |
|--------|-------------|----------|
| Thin owner-blind gate, no harness | Foundation stays the priority | ✓ |
| No gate at all | Loses the de-risk checkpoint | |
| Lightweight fixed harness | Owner deprioritized | |

**User's choice:** Thin owner-blind gate, no harness ("option 1 or none"). → **D-12** (note: relaxes ROADMAP criterion-3).

---

## Area 4 — v1 slice coverage

### Q1 — Coverage
| Option | Description | Selected |
|--------|-------------|----------|
| Base + Ideas + Hooks deep; chat = thin stance | One foundation workstream | ✓ |
| Base + all three fully | Chat rework risk | |
| Base + pilot only; others to their phases | Scatters authoring | |

**User's choice:** Base + Ideas + Hooks deep; chat = thin stance. → **D-14**

### Q2 — Pilot slice
| Option | Description | Selected |
|--------|-------------|----------|
| Ideas — unblocks the critical path | Next consumer (P3) | ✓ |
| Hooks — hardest craft, sharpest signal | Ships later (P4) | |

**User's choice:** Ideas. → **D-15**

---

## Claude's Discretion

- Exact BASE/SLICE section wording (shape locked, prose is the curation workstream's call).
- Per-mode field-map field lists + length caps.
- Compile/regen script implementation; version constant name; assembler type signatures.

## Deferred Ideas

- Composable craft-modules + RAG over creator history (v2 grounding).
- Chase Hughes behavioral layer (excluded v1, stays parked).
- Profile redesign (compact cards + social-scrape prefill) — v6.1.
- Multi-platform fan-out / cross-platform repurposing.
- Live trends / trending-sounds grounding.
- Full chat slice polish (P5).
- Future task slices: scoring, script, decode, remix (anticipated by D-00, not authored v1).
- Heavy statistical generative eval harness.
