# Phase 2: Hero Centerpiece & Reading Explainer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 2-hero-centerpiece-reading-explainer
**Areas discussed:** Hero artifact & D-L2 spike, Hero asset source, Verdict throne composition, 3-step explainer interaction, Hero CTA action

User instruction: "choose all your thought-through recommendation" — discussed all
four areas; Claude led with a recommended option on each; user confirmed all
recommendations.

---

## Hero artifact & D-L2 implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Recorded stage-reveal loop | Capture ONE real Reading, replay full-bleed via StageBlock as a calm auto-reveal loop; light spike validates capture→replay + LCP. Reliable, engine-independent, ship-first. | ✓ |
| Live interactive Reading | Run the real engine live in the hero. Rejected — engine frozen/cross-worktree (not callable from landing deploy) + LCP/cost/reliability hit. | |
| Static captured sequence | Single auto stage-reveal, no loop. Simplest but least alive as the centerpiece. | |

**User's choice:** Recorded stage-reveal loop (recommended).
**Notes:** Resolves the roadmap's flagged D-L2. Live rejected primarily because the engine is frozen and in a sibling worktree, so the landing deploy cannot call it.

---

## Hero asset source (HERO-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Capture from live app, fallback to staged real keyframe | Primary: export a real Reading (keyframes+stages+verdict) from the app's /analyze as a static bundle; fallback if blocked = staged REAL creator keyframe + real-shaped verdict. Both satisfy HERO-02. | ✓ |
| User provides a captured Reading | User hands over a real exported Reading. Most authentic, but blocks the phase until the asset exists. | |
| Faithful real-shaped reconstruction | Hand-build from a real keyframe + engine-plausible verdict, no live capture. Fastest, thinnest reading of "real Reading." | |

**User's choice:** Capture from live app, fallback to staged real keyframe (recommended).
**Notes:** Main execution risk; the D-13 light spike gates which path (primary capture vs fallback) is used.

---

## Verdict throne (HERO-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Confident "likely land" + reasoned why | Good/green band with a specific, non-flattery why (strength + fixable note). Aspirational AND honest AND specific. | ✓ |
| Honest "mixed signals" + sharp why | Amber band — boldest anti-hype proof, but less aspirational as a first impression. | |
| Rotate real verdicts across niches | Cycle good+mixed across niches — proves range/specificity, more asset production. | |

**User's choice:** Confident "likely land" + reasoned why (recommended).
**Notes:** Honesty moat carried by the reasoning, not by a discouraging verdict. Verdict anchored ON the content (overlaid), built on VerdictSwatch. Rotating-verdicts deferred → Phase 3 gallery.

---

## 3-step explainer interaction (READ-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Static 3 steps reusing real artifacts | kero 3-card adaptation; each step shows the hero's real Reading artifact for that stage. Satisfies READ-02 ship-first; steps optionally clickable to hero. | ✓ |
| Interactive content-as-navigation | Clicking a step scrubs/drives the hero Reading (krea seeing=doing). Richer, more build, couples explainer to hero artifact. | |

**User's choice:** Static 3 steps reusing real artifacts (recommended).
**Notes:** "Content is both demo and navigation" honored lightly (anchored, optionally clickable); full interactive scrubbing deferred.

---

## Hero CTA action (CTA-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Present + routes to conversion anchor | Working button scrolls to #cta section; live waitlist capture deferred to Phase 3 (owns CTA-02 + conversion UI). | ✓ |
| Live waitlist capture now | Build real inline email capture (Supabase) in Phase 2. Real conversion sooner, more backend, overlaps Phase 3. | |
| Deep-link into app /analyze | "Try it" deep-links into the product; depends on app reachability from the landing deploy — may not resolve. | |

**User's choice:** Present + routes to conversion anchor (recommended).
**Notes:** Keeps Phase 2 focused on the hero/Reading; live wiring lands with Phase 3's conversion section.

---

## Claude's Discretion

- Component file split under `src/components/numen-landing/` (hero/reading-loop/verdict-throne/how-it-works).
- Loop cadence, dwell-on-verdict timing, pause-on-verdict behavior (must stay calm).
- Captured-Reading asset-bundle format (image sequence vs poster+keyframes vs short muted video) — for LCP/weight.
- Whether explainer steps are clickable-to-hero vs purely static this phase.
- Precise copy wording (VOICE.md), exact verdict band label + one-line why, creator niche shown.

## Deferred Ideas

- Live interactive Reading hero — revisit only if the engine becomes landing-callable.
- Honest "mixed" verdict + rotating multi-niche verdicts — latter fits Phase 3 gallery (GALLERY-01/02).
- Interactive content-as-navigation scrubbing — deferred READ-02 enhancement.
- Live waitlist/email capture + footer CTA repeat → Phase 3 (CTA-02 + conversion + D-L4 assets).
- Final token swap (D-L3), scroll choreography (MOT-01), LCP/OG/a11y polish, palette (D-L1) → Phase 4.
- Deleting orphaned stale landing/layout components → Phase 4 cleanup.
