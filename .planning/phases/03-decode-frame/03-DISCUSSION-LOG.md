# Phase 3: Decode Frame - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 03-decode-frame
**Areas discussed:** Frame anatomy, Repeatable-vs-luck UX, Voice & framing, Trigger & in-flight UX, P3 scope
**Mode note:** User requested a recommendation accompany every question; each question led with Claude's rec + rationale.

---

## Frame Anatomy — layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked labeled beats | 4 short labeled blocks (Hook pattern / Structure & pacing / The turn / Emotional beat); luck split below. Raycast-clean, fits narrow column. | ✓ |
| Lead insight + beats | One bold headline + supporting beats. Forces single-cause story. | |
| Segment-anchored teardown | Time-spine with beats pinned to timestamps. Duplicates Content Craft filmstrip. | |

**User's choice:** Stacked labeled beats (Rec)
**Notes:** Narrow right-column hero (Verdict's old bounds); a timeline would compete with the existing Content Craft filmstrip.

## Frame Anatomy — beat absence

| Option | Description | Selected |
|--------|-------------|----------|
| Name the absence | All 4 slots always render; weak beat reads honestly ("No distinct turn — …"). Prompt must allow "absent" verdicts. | ✓ |
| Hide absent beats | Render only present beats (2–4); variable height, can look thin. | |
| Always fill all 4 | Force a line per beat; risks fabricating a "turn." | |

**User's choice:** Name the absence (Rec)
**Notes:** Stable layout + on-brand with the honest-number ethos; guards the luck-split's anti-hallucination intent.

## Repeatable-vs-Luck UX — presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Two stacked lanes | "What you can repeat" lane then "What was luck / timing" lane. Reads top-to-bottom; repeatable lane is a clean list Phase 4 Adapt pulls from. | ✓ |
| Side-by-side columns | Classic 2-col table. Cramped in tall narrow hero, harder on mobile. | |
| Tagged single list | One list with ·repeatable/·luck tags. Split less scannable; weakens SC#3. | |

**User's choice:** Two stacked lanes (Rec)
**Notes:** Repeatable lane is exactly what Phase 4 Adapt consumes — must be a clean extractable list.

## Repeatable-vs-Luck UX — luck taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed taxonomy | Decode picks from timing/trend, existing-audience/reach, algorithmic-outlier, topic-zeitgeist; only applicable ones render, always ≥1. | ✓ |
| Free-form luck factors | Whatever Qwen infers; risks vague/unfalsifiable claims. | |
| Taxonomy + free-form slot | Fixed backbone + optional "other"; extra complexity for a rare case. | |

**User's choice:** Fixed taxonomy (Rec)
**Notes:** Keeps it honest, prevents "it just hit" filler, matches spec wording.

## Voice & Framing — register

| Option | Description | Selected |
|--------|-------------|----------|
| Analytical & declarative | States what the video does, plainly; no hype, no advice verbs. Mirrors Score's register. | ✓ |
| Creator-native & punchy | More voice/energy; drifts toward hype, harder to keep non-prescriptive. | |
| Teaching/explanatory | Mini-lesson; verbose for narrow hero, tips toward prescriptive. | |

**User's choice:** Analytical & declarative (Rec)
**Notes:** "Never fix this" is easiest to hold when copy describes structure rather than dispenses advice.

## Voice & Framing — person

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral about the source | Third-person ("the video/hook/structure"); "you" reserved for Adapt. Decode = analysis, Adapt = personalization. | ✓ |
| Light second-person | Occasional "you"; blurs the Decode/Adapt line, nudges prescriptive. | |

**User's choice:** Neutral about the source (Rec)
**Notes:** Establishes the clean conceptual seam between Phase 3 (Decode) and Phase 4 (Adapt).

## Trigger & In-Flight UX — trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-run on submit | Remix submit kicks off the lightweight Omni→Qwen decode; frame fills as it returns. | ✓ |
| Click-to-decode | Idle frame + "Decode this" button; fires on click. Adds a step to the primary flow. | |

**User's choice:** Auto-run on submit (Rec)
**Notes:** Decode is the headline payoff of remix mode — the reason the user chose Remix.

## Trigger & In-Flight UX — in-flight state

| Option | Description | Selected |
|--------|-------------|----------|
| Honest streaming state | Reuse board's pending treatment ("Decoding structure…", subtle motion, no fake content). | ✓ |
| Beat-by-beat reveal | Beats pop in as model returns; needs streamed/partial output — Qwen returns one blob. | |
| Static quiet placeholder | Keep muted descriptor until done; 60–90s dead frame reads as broken. | |

**User's choice:** Honest streaming state (Rec)
**Notes:** Phase 2's no-skeleton rule governed the idle placeholder; active generation genuinely is loading.

## P3 Scope — Decode isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Decode in isolation | Phase 3 builds ONLY the Decode frame body + lightweight path + variants.remix.decode persistence. | ✓ |
| Decode + tidy shared frames | Also ensure Audience/Content Craft render sensibly in remix mode. Expands scope. | |

**User's choice:** Decode in isolation (Rec)
**Notes:** Remix source is decode-only (no overall_score, no 332s pipeline). Shared-frame behavior is already-wired or a separate concern.

---

## Claude's Discretion

- Qwen decode prompt schema + mapping of Omni fields → the 4 beats (ground in Phase 1 spike §6/§7 real output).
- Reuse Phase 1's Omni output vs make a fresh Omni call (latency/cost optimization — research).
- Exact copy strings, beat/lane label wording, TS shape of `variants.remix.decode`.
- Mobile card-stack treatment, decode result caching, Raycast styling specifics.

## Deferred Ideas

- Adapt frame content + niche — Phase 4 (consumes Decode repeatable lane).
- Develop & predict + lineage — Phase 5.
- Shared-frame behavior in remix mode — out of P3 scope.
- Qwen ASR transcript — gated/deferred per Phase 1 spike §6.
- Beat-by-beat streamed reveal — deferred (Qwen returns one blob).
