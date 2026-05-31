# Feature Landscape — Viral Remix (v3.2)

**Domain:** "Decode a viral video + adapt the format to my niche" surface for TikTok creators
**Researched:** 2026-05-31
**Confidence:** HIGH on in-repo grounding (SPEC + creator-intelligence SSOT); MEDIUM on outside domain norms (how comparable decode/adapt tools behave). Where a claim is outside domain knowledge it is tagged `[domain]`; where it traces to repo artifacts it cites the SPEC requirement number or `creator-intelligence.md`.

> **Template note:** `templates/research-project/FEATURES.md` was not present on disk; this file uses the fallback section set specified by the spawn brief: Summary → Decode → Adapt → Develop & lineage → Table stakes / Differentiators / Anti-features → Dependencies.

---

## Summary

The product spine is **LOCKED: Decoder → Translator → Predict** (SPEC §"Product spine"). This milestone is the *front half* of the creator loop: paste a third-party viral TikTok in an explicit **Remix mode** → **Decode** (why it worked, repeatable structure vs luck) → **Adapt** (~3 niche-adapted concepts, format not content) → per-concept **Develop & predict** through the existing engine, with parent/child lineage.

Two findings shape every feature below:

1. **Virtuna already owns the hard part of Decode.** `creator-intelligence.md` is an attributable, 40-rule SSOT (Ava Yuergens, Jenny Hoyos, Alex Hormozi) covering exactly the dimensions a structural teardown needs — hook patterns, retention/pacing structure, the turn ("But/Therefore"), the emotional-beat/peak-end model, and an outlier-vs-vanity discriminator (the 5× Rule). Decode is **not** a from-scratch feature; it is a *re-targeting* of this corpus from "critique the user's own video" to "explain why someone else's video worked." The legal line (`format/structure only`) maps cleanly onto this corpus because the corpus is already structural ("hook pattern," "pacing," "mechanism"), never content-level ("the croissant").

2. **The trust differentiator is the repeatable-vs-luck split** (SPEC §2). A generic teardown lists what happened; a *trustworthy* decode tells the creator which parts they can reproduce and which parts they cannot (timing, an existing audience, an algorithmic outlier event). This is the same "honest number" ethos the Score frame already carries (PROJECT.md: "Score frame's honest-number ethos"). Without it, Decode is just an articulate horoscope. With it, Decode earns the right to drive Adapt.

The **anti-feature spine** is dictated by IP/legal constraint and by engine economics: never copy content (only format), never auto-detect mine-vs-theirs (explicit toggle, SPEC §1), never bulk-score concepts (engine is 90–312s E2E, SPEC §4 / Constraints), never persist or rebroadcast the source video (SPEC Boundaries: "Storing/redistributing the source video — out of scope").

---

## Decode

**What it is (SPEC §2):** For a remix-mode video, the board explains *why it worked* and explicitly separates repeatable structure from luck. Acceptance: renders non-empty structural fields AND a repeatable-vs-luck distinction; *never* frames the video as something the user should "fix."

### What makes a DECODE trustworthy vs a generic teardown

`[domain]` Generic teardowns fail in three predictable ways, and the fix for each is already available in `creator-intelligence.md`:

| Generic-teardown failure | Why creators distrust it | Trustworthy fix (grounded) |
|---|---|---|
| Vague adjectives ("great hook, fast pacing") | Not auditable; could be said of any video | **Name the pattern.** Cite the specific hook archetype (e.g. Ava's 7 named patterns; Hormozi's 5 awareness types) and the rule it satisfies — "Specificity Hook, concrete dollar amount in first 1.5s." (`creator-intelligence.md` §Hook Formulas) |
| No structure model | Reads as a list of moments, not a reproducible skeleton | **Map to a known skeleton.** Jenny's 5-part structure (Hook → Foreshadow → Transition → But/Therefore → Payoff-with-twist) gives Decode a fixed spine to fill. (`creator-intelligence.md` §Retention Mechanics) |
| Treats all virality as skill | Sets the creator up to copy something that won't transfer | **The repeatable-vs-luck split** (see below). This is the single most important trust lever. (SPEC §2) |

### Decode dimension set (concrete schema)

This is the field set the Decode frame should populate. Each field maps to an existing corpus section so the engine can ground it (Qwen-only per Constraints). Dimensions chosen to match the SPEC's named examples ("hook pattern, pacing/structure, the turn, emotional beat") and the creator-intelligence vocabulary.

| Dimension | What it captures | Grounded in | Format-not-content guard |
|---|---|---|---|
| `hook_pattern` | Which named hook archetype the first ~3s uses + how it satisfies the 3-second window (see/read/hear stack) | Ava 7 patterns; Hormozi 5 awareness types; 3-hook stack | Names the *mechanic* ("comparison hook"), not the subject ("the croissant") |
| `structure` / `pacing` | The 5-part skeleton actually used + pacing curve (peak-in-the-middle?) + cut cadence | Jenny 5-part structure; peak-end pacing; cuts every 3–4s (Hormozi) | Describes *shape* (where the peak sits), not the literal scenes |
| `the_turn` | The single narrative pivot that stops the scroll — the "But/Therefore" beat or "That's when"/"Instead" turn | Jenny "But/Therefore" storytelling | The *device* (a contradiction that creates "but what?"), not the specific plot |
| `emotional_beat` | The dominant emotion and where intensity peaks (ending intensity decides how viewers feel) | Jenny peak-end ("decide based on intensity at the end"); Hormozi reward | The emotional *arc type*, not the personal story |
| `mechanism` | The structural device pulling viewers to the end (3-steps / countdown / visible progress) | Jenny "mechanism" concept | The retention device, reusable across any topic |
| `virality_triggers` | Which of Novelty / Uncertainty / Knowledge-gap / Complexity are present | Jenny 4 criteria | Abstract trigger taxonomy — inherently format-level |
| `audio_text_strategy` | Burned-in text / audio-off legibility (50% watch muted) | Hormozi audio-off rule; Jenny "readable on mute" | Production *strategy*, not the words said |
| `repeatable_vs_luck` | **The split** — see method below | 5× Rule; benchmark retrieval (engine) | N/A — this is the trust field |

`[domain]` Optional but high-value: a **one-line "why it worked" thesis** at the top of the frame, so the creator gets the gestalt before the field-by-field breakdown. (Mirrors how the Score frame leads with an honest number before the factor bars — PROJECT.md.)

### Repeatable-vs-luck separation method (the credibility mechanism)

The SPEC demands the split (§2) but does not prescribe how. Recommended method, grounded in the corpus + the engine's existing capabilities:

1. **Outlier classification first (the 5× Rule).** `creator-intelligence.md` Rule #1: an outlier = ≥5× the account's follower count in views. If the video's reach is *not* an outlier relative to the creator's own following, much of its performance is attributable to **existing audience**, not the format → flag that portion as **not repeatable** for a creator without that audience. If it *is* a true outlier (5×+), the format did heavy lifting → more is repeatable. This single discriminator is the backbone of the split and is already a named rule.

2. **Bucket each Decode dimension into one of three lanes:**
   - **Repeatable (format/skill):** hook pattern, structure, the turn, mechanism, audio/text strategy — things a creator can deliberately rebuild in their niche. These are the only inputs Adapt is allowed to draw from.
   - **Conditional (depends on the creator's situation):** existing audience size, niche saturation/blue-ocean timing, posting cadence/account history. Reproducible only if the creator's situation matches.
   - **Luck / non-repeatable:** algorithmic outlier event, riding a transient trend/sound at its peak, a one-time newsworthy moment. Explicitly labeled "you cannot count on reproducing this."

3. **Benchmark grounding (engine).** The engine already has **benchmark retrieval** (PROJECT.md: Engine Foundation v3.0 "benchmark retrieval"; pgvector centralized in v3.1). Compare the video's structural fingerprint against the benchmark corpus: structure that recurs across many high-performers = repeatable signal; performance with a *weak* structural fingerprint but huge reach = luck/timing signal. This converts the split from an LLM opinion into a retrieval-backed claim.

4. **Honesty framing in copy.** Per the spine, Decode "earns trust" by being honest. Copy should say what *cannot* be reproduced as plainly as what can — e.g. "This rode a sound that peaked 3 weeks ago; that lift is not repeatable. The hook structure is." Confidence: the framing rule is HIGH (SPEC §2 + spine); the exact retrieval scoring is an engine-design detail for the roadmap, MEDIUM.

> **Critical guard (SPEC §2 acceptance):** Decode must **never** frame the third-party video as something to "fix." It is a reference being explained, not the user's content being graded. This is the inverse of the Verdict/Actions frames (which *do* tell the user what to fix). The frame's tone is "here's why this worked," not "here's what's wrong."

---

## Adapt

**What it is (SPEC §3):** The board outputs **exactly 3** distinct concepts adapting the decoded *format/structure* (not content) to the user's niche, each with enough specificity to act on (angle, hook, who it's for). Acceptance: 3 concepts for a populated niche; each references the source's structure and the user's niche; **none reproduces the source's specific content/subject.**

### What makes an ADAPT concept actionable vs vague filler

`[domain]` The failure mode is "concept" that is really just a topic ("make a video about your niche using a strong hook"). An actionable concept is one a creator could hand to a co-creator and they'd know what to shoot. Three things make it actionable, all of which the SPEC already names (angle / hook / who-it's-for) and the corpus can ground:

- **A concrete written hook line**, not "use a good hook." Use the corpus's hook templates as the generator — e.g. Hormozi's Lead-Magnet formula `[Number]+[Adjective]+[Audience]+[Outcome]+[Timeframe]` or one of Ava's 7 named patterns, instantiated with the user's niche. (`creator-intelligence.md` §Hook Formulas; §Prompt Design "use as hook-rewrite template")
- **An explicit angle** = how the *source's structure* is re-pointed at the user's niche. The angle must reference the decoded structure (which mechanism/turn it reuses) and the niche — that linkage is the SPEC §3 acceptance test.
- **Who-it's-for** = the audience-avatar slice within the niche the concept targets (mirrors Jenny's avatar discipline and Ava's broad→narrow→niche funnel). Prevents the concept from being generically "for my niche."

### Adapt concept schema (concrete)

Recommended per-concept object. Field names are a proposal for REQUIREMENTS/roadmap; the **bolded** fields are the SPEC §3 minimum ("angle, hook, who it's for").

| Field | Purpose | Source / grounding | Format-not-content guard |
|---|---|---|---|
| `title` | Short human label for the concept card | generated | — |
| **`hook`** | The actual opening line(s), niche-instantiated | corpus hook templates | Reuses the *pattern*, new subject from the user's niche |
| **`angle`** | How the decoded structure is re-pointed at the niche; names which decoded element it reuses (`reuses: the_turn` etc.) | links to Decode `repeatable` lane only | Must cite a *structural* element, never the source's subject |
| **`who_its_for`** | The niche sub-audience this concept targets | Jenny avatar; Ava niche funnel | — |
| `format_borrowed` | Plain-language statement of exactly which format element is borrowed ("the 3-step mechanism + peak-in-the-middle pacing") | Decode `mechanism`/`structure` | This field *is* the legal evidence: it proves format-not-content |
| `why_it_should_work` | One line tying the borrowed structure to a virality trigger for this niche | Jenny 4 triggers; benchmark | — |
| `develop_cta` | The "Develop & predict →" affordance (see next section) | SPEC §4 | — |
| `predicted_status` | `undeveloped` until the user develops it (no score shown pre-develop) | SPEC §4 (no bulk scoring) | — |

> **Provenance rule (legal spine):** every concept must be derivable from the **Repeatable lane only** of the Decode split. A concept that leans on the source's *content* (subject, script lines, specific gag) or on the source's *luck* (the same trending sound at peak) violates the format-not-content boundary (SPEC Constraints/§3 acceptance). The `format_borrowed` field makes this auditable on the surface itself.

### Why exactly 3

The SPEC fixes N=3 as a reasoned default (SPEC §"Reasoned-default assumptions": "N concepts = 3", overridable). Supporting rationale to record so the roadmap doesn't re-litigate:

- `[domain]` **3 = enough variety to feel like genuine adaptation, few enough to act on.** One concept reads as "the tool's single guess" (low trust); 5+ becomes a backlog the creator won't triage. 3 is the canonical "menu" size for choose-one decisions.
- **Cost/latency alignment (SPEC §4):** because each develop is a real 90–312s engine run, the surface must *invite a single choice*, not a batch. 3 cards that each say "Develop this one" frames the decision as pick-one; a long list invites "score them all," which the engine economics forbid.
- **Corpus alignment:** mirrors the creator habit of generating a small set of structured variants and choosing (Jenny's idea-selection funnel narrows to a shortlist; Hormozi's 70/20/10 is "a few angles, then pick winners"). 3 niche variants is the human-sized shortlist.

Confidence: HIGH that 3 is the right default (SPEC-locked + economics); the brief flags it as overridable, so the roadmap may expose it as config, but the surface should ship at 3.

---

## Develop & lineage

**Develop & predict — per concept (SPEC §4).** Each concept exposes a "Develop & predict →" action that runs *that single concept* through the existing `/api/analyze` pipeline, producing a real `/analyze/[id]` board with a score. Concepts are **not** auto-scored on generation. Acceptance: clicking Develop on one concept creates exactly one new analysis and navigates to it; the others stay unscored.

`[domain]` This "generate-then-pull-one-through" pattern is the correct shape for any expensive-inference adapt surface: cheap generation (text concepts) is fanned out; expensive scoring (full engine) is pulled on explicit demand. It also keeps the IP story clean — the *scored* artifact is the creator's own new concept, not the source video.

**Remix lineage (SPEC §5).** A developed concept stores a `parent_id` (the source remix analysis) and renders a "remixed from" chip linking back; child analyses appear in the sidebar Recent list. Acceptance: non-null `parent_id`; working "remixed from" link; appears in Recent.

`[domain]` Lineage is the quiet differentiator most decode tools skip. It turns one-off teardowns into a *traceable creation trail* ("this winning video of mine descends from that viral reference"), which is the seed of the deferred Pattern-Playbook milestone (SPEC Boundaries). Minimum viable lineage = one `parent_id` column + one chip + Recent inclusion; resist building a tree UI now (out of scope).

---

## Table stakes

Features the surface *must* have or it isn't a credible decode/adapt tool. Each tagged with complexity and the existing-feature dependency.

| # | Feature | Why table stakes | Complexity | Depends on (existing) | SPEC |
|---|---|---|---|---|---|
| TS-1 | Explicit Remix toggle at input ("Score" / "Remix") | Deterministic intent; no auto-detect guesswork | Low | `tiktok-url-input.tsx` (already validates URL + fetches preview) | §1 |
| TS-2 | Named structural Decode (the 8-dimension set above) | A teardown without named patterns is the generic-teardown failure | Med | creator-intelligence corpus; engine frame/transcript ingest | §2 |
| TS-3 | Repeatable-vs-luck split | The trust lever; without it Decode is a horoscope | Med–High | 5× Rule; engine benchmark retrieval (pgvector) | §2 |
| TS-4 | Exactly 3 niche-adapted concepts with hook/angle/who-it's-for | The "magic" half of the spine; the actionable minimum | Med | niche from creator-profile; corpus hook templates | §3, §7 |
| TS-5 | Per-concept Develop & predict (no bulk) | The only economically viable path to a score (90–312s engine) | Med | existing `/api/analyze` SSE pipeline + `/analyze/[id]` | §4 |
| TS-6 | Parent/child lineage + "remixed from" chip + Recent | Makes developed concepts first-class, traceable analyses | Low–Med | analyses table; Sidebar Recent; permalink routing | §5 |
| TS-7 | One-board-two-config frame swap (Verdict+Actions → Decode+Adapt) | Reuse mandate; no separate surface | Med | Konva board grid; `BoardMobile.tsx` card-stack | §6 |
| TS-8 | Niche source w/ inline fallback prompt | Adapt is meaningless without a niche | Low | `creator-profile` settings tab | §7 |
| TS-9 | Third-party ingestion sufficiency (frames/transcript, not just metadata) | **Gating spike** — Decode is impossible if pipeline only has metadata | Unknown (SPIKE) | `/api/analyze` ingestion path | §8 |

> TS-9 is the milestone's **first phase** (SPEC §8, Ambiguity Report flags it as the single below-min dimension). It is a precondition, not a deliverable: nothing downstream is plannable until it's answered.

## Differentiators

Features that set this surface apart from a commodity "AI explains this video" tool. Not strictly required for v3.2, but each raises trust or magic.

| # | Differentiator | Value | Complexity | Notes |
|---|---|---|---|---|
| DF-1 | Attributable, named-framework grounding (cite the creator/rule per Decode claim) | Auditable, non-hallucinated authority — the inverse of generic AI teardowns | Low (corpus exists) | `creator-intelligence.md` §Prompt Design: "cite the creator." This is nearly free given the SSOT and is the strongest credibility multiplier. |
| DF-2 | Benchmark-backed repeatable-vs-luck (not LLM opinion) | Turns the trust lever into a retrieval-grounded claim | Med | Uses engine benchmark retrieval; elevates TS-3 from "plausible" to "evidenced." |
| DF-3 | `format_borrowed` line on every concept | On-surface legal proof + makes adaptation legible to the creator | Low | Doubles as IP defense and as UX clarity. |
| DF-4 | One-line "why it worked" thesis above the Decode fields | Gestalt before detail; matches Score-frame honest-number lead | Low | Pure copy/UX; high perceived polish. |
| DF-5 | Lineage as the seed of a creation trail | Sets up the deferred Pattern Playbook; "your wins descend from these references" | Low (just `parent_id`) | Don't over-build; one column now. |
| DF-6 | Audience frame retained in remix mode (persona retention of the *viral* video) | Lets the creator see *who* the viral video held, feeding Decode | Low (reuse) | SPEC reasoned-default: "Audience frame retained… persona retention of the viral video serves Decode." Reuse, not new build. |

## Anti-features

Features to explicitly **NOT** build. Several are hard constraints (legal/economic), not preferences.

| # | Anti-feature | Why avoid | Do instead | Source |
|---|---|---|---|---|
| AF-1 | **Copying source content** (script lines, subject, gags, the specific video) | Legal/IP; the entire spine forbids it | Adapt *format/structure only*; `format_borrowed` field proves it | SPEC spine + Constraints |
| AF-2 | **"Redo this video" framing** | Same IP line + wrong product voice | Always "adapt this format," never "remake this video" | SPEC spine |
| AF-3 | **Auto-detect mine-vs-theirs** | Guessing intent → wrong board config; explicitly rejected | Explicit Remix toggle | SPEC §1, Interview Log |
| AF-4 | **Bulk auto-scoring all 3 concepts** | Engine is 90–312s E2E; prohibitive cost/latency | Per-concept Develop on demand | SPEC §4, Constraints |
| AF-5 | **Storing / rebroadcasting the source video** | IP exposure; derive structure only (transformative = safer) | Persist structural analysis only, never the media | SPEC Boundaries |
| AF-6 | **Treating the source as the user's content to "fix"** | Inverts Decode's purpose; breaks trust | Explain why it worked; no "fix" verbs | SPEC §2 acceptance |
| AF-7 | **A separate Studio/Discover app surface** | Reuse mandate; fragments the product | One board, two configs (frame swap) | SPEC §6, Boundaries |
| AF-8 | **Radar / daily trend feed** in this milestone | Scope; this milestone is pull-only (user pastes) | Sidebar nav hook only, no build | SPEC Boundaries |
| AF-9 | **Pattern Playbook** (cross-video niche formulas) | Future milestone; needs accumulated lineage first | Defer; lineage column seeds it | SPEC Boundaries |
| AF-10 | **Non-TikTok platforms** (Reels/Shorts) in this milestone | Scope; TikTok-only | TikTok only | SPEC Boundaries |
| AF-11 | **Generic, un-attributed Decode claims** ("great hook") | Indistinguishable from commodity tools; low trust | Name the pattern + cite the rule (DF-1) | creator-intelligence §Prompt Design |
| AF-12 | **Vague concepts** ("make something in your niche") | Filler; fails SPEC §3 actionability | Enforce hook + angle + who-it's-for + format_borrowed | SPEC §3 |
| AF-13 | **New non-Qwen model calls** for decode/adapt generation | Violates Qwen-only pipeline constraint | All generation stays Qwen-only | SPEC Constraints |
| AF-14 | **>3 or <3 concepts on the surface** | Erodes the pick-one economics + SPEC acceptance ("exactly 3") | Ship 3; keep N as config but render 3 | SPEC §3 |

---

## Feature dependencies

```
TS-9 ingestion spike (SPEC §8)  ──gates──►  TS-2 Decode  ──►  TS-3 repeatable-vs-luck split
                                                  │
                              (Repeatable lane only) ▼
                                            TS-4 Adapt (3 concepts)  ──►  TS-5 Develop&predict  ──►  TS-6 lineage
                                                  ▲
                          TS-8 niche (creator-profile + inline fallback)
TS-1 toggle ──routes──► TS-7 board frame swap ──hosts──► Decode + Adapt frames
```

Key chains:
- **TS-9 → TS-2 → TS-3 → TS-4:** ingestion must yield frames/transcript before Decode can produce named structural fields; the repeatable lane of TS-3 is the *only* legal input to TS-4. This is the milestone's critical path.
- **TS-8 → TS-4:** no niche, no Adapt; inline fallback prompt unblocks empty profiles.
- **TS-5 → TS-6:** lineage only materializes when a concept is developed (the child analysis carries `parent_id`).

## Dependencies on existing features (reuse mandate, SPEC §6 + Constraints)

| Existing feature | How Remix reuses it | New surface needed |
|---|---|---|
| `tiktok-url-input.tsx` (validates URL, fetches thumbnail/creator/caption) | Same input; add the Remix toggle; same preview | Toggle UI only |
| `POST /api/analyze` SSE pipeline + Konva board (6 frames) | Same pipeline for Develop; same board, frames swapped | Decode + Adapt frame components |
| `/analyze/[id]` permalink + Sidebar Recent | Child analyses get permalinks + appear in Recent | "remixed from" chip + `parent_id` |
| `BoardMobile.tsx` card-stack | Swapped frames absorbed as cards | Decode/Adapt as mobile cards |
| Audience frame + persona simulation | Retained in remix mode (persona retention of the *viral* video feeds Decode) | None (reuse) — DF-6 |
| Content Craft frame | Retained (shared frame, SPEC §6) | None |
| `creator-profile` settings tab | Source of niche for Adapt | Inline fallback prompt |
| Engine benchmark retrieval (pgvector, v3.0/v3.1) | Grounds repeatable-vs-luck (DF-2) | Wiring/scoring logic |
| creator-intelligence.md SSOT (40 rules, 3 creators) | The decode vocabulary + hook templates for Adapt | Re-target prompts from "critique self" to "explain other" |
| analyses table / history | Add `parent_id` column for lineage | One migration |

**Net new surface area (per SPEC Constraints):** Decode frame, Adapt frame, Remix toggle, lineage column/chip. Everything else is reuse.

---

## MVP recommendation (for the roadmapper)

Ship in spine order, gated by the spike:

1. **TS-9 ingestion spike first** (SPEC §8) — non-negotiable precondition; if metadata-only, document the gap before planning Decode.
2. **TS-1 toggle + TS-7 frame swap** — the routing skeleton; lets Decode/Adapt frames render even as stubs.
3. **TS-2 + TS-3 Decode** (with DF-1 attribution baked in from day one — it's nearly free and is the credibility differentiator).
4. **TS-8 niche + TS-4 Adapt** (3 concepts, drawing only from the Repeatable lane; enforce hook/angle/who-it's-for/format_borrowed).
5. **TS-5 Develop + TS-6 lineage.**

Defer: DF-2 benchmark-backed split can ship as "LLM-reasoned" first, upgraded to retrieval-backed later (don't block Decode on engine wiring). Radar, Pattern Playbook, non-TikTok — out of scope by SPEC.

## Sources

- `/Users/davideloreti/virtuna-viral-remix/.planning/milestones/viral-remix-SPEC.md` — 8 locked requirements, product spine, boundaries, constraints, ambiguity report (HIGH — authoritative milestone seed)
- `/Users/davideloreti/virtuna-viral-remix/.planning/research/creator-intelligence.md` — 40-rule attributable decode/adapt vocabulary (Ava Yuergens, Jenny Hoyos, Alex Hormozi); the operative synthesis spine (HIGH — in-repo SSOT)
- `/Users/davideloreti/virtuna-viral-remix/.planning/PROJECT.md` — existing features (board, engine, benchmark retrieval, Score-frame honest-number ethos), latency figures, milestone placement (HIGH)
- Outside domain knowledge of decode/adapt creator tooling — tagged `[domain]` inline (MEDIUM — general patterns, not verified against a specific competitor product this session)
