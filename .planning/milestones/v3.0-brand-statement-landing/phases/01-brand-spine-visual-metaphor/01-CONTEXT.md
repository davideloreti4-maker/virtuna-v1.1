# Phase 1: Brand Spine & Visual Metaphor - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the brand voice, vocabulary guardrails, and both visual concepts (behavioral-simulation hero + 4-stage engine pipeline) as **documented artifacts** before any landing-page code is written. Decide the hero motion implementation technology with a documented performance rationale. Identify and replace plagiarized Artificial Societies copy across customer-facing surfaces with original, founder-approved copy.

**Phase produces artifacts only. No production code is written here.** Build starts in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Voice & Vocabulary Doc Depth (BRAND-SPINE.md)

- **D-01:** Voice doc is **full glossary + tone**, not minimal. Target ~3-4 pages at `.planning/reference/BRAND-SPINE.md`.
- **D-02:** BRAND-SPINE.md MUST include the following sections:
  - The one-liner: *"Your audience, simulated."*
  - **Preferred verbs:** predict, simulate, forecast, learn, improve
  - **Banned → Replacement table** (e.g., `viral → breakout / high-performing`, `AI → behavioral simulation`, `go viral → land with audience`)
  - **Tone descriptors** (Calm · Confident · Lab-credible) with concrete DO / DON'T copy examples
  - **Audience tuning per section** — explicit guidance on which of the three audiences (creators / investors / partners) each of the 7 viewports leans toward (Hero = all three creator-led, Science = investor/partner-leaning, Pricing = creator-leaning, etc.)
- **D-03:** Numen Machines lockup pattern documented (BRAND-03) — when to lead with `VIRTUNA · A NUMEN MACHINES PRODUCT` (hero, footer, OG metadata) vs. use Virtuna alone (in-product, page titles).
- **D-04:** BRAND-SPINE.md is the source of truth all Phase 2-6 copy must obey. Plan-phase should produce one task that explicitly verifies BRAND-SPINE.md compliance per section.

### Visual Metaphor Lock Fidelity

- **D-05:** Lock fidelity is **written spec + reference links**, not sketches / Figma / animated prototypes.
- **D-06:** BRAND-BIBLE.md addendum (per success criterion #3) describes both visuals in prose, with web links to comparable visuals (e.g., Linear's pipeline diagram, Stripe's particle hero, Vercel's section transitions). No Figma frames, no Excalidraw sketches required for Phase 1.
- **D-07:** Plan-phase researcher fills remaining visual ambiguity (particle count, color spec, easing curves, icon choices) during Phase 2 build prep. Phase 1 locks the **concept**, Phase 2 finalizes the **execution**.

### Hero Motion Implementation Technology (VIZ-04)

- **D-08:** **Split tech decision** — different tools for different visuals:
  - **Hero behavioral simulation** → **Canvas 2D** (~30KB). Matches existing canvas hive viz proven at 1300+ nodes / 60fps. Strongest evidence-based pick for many-particle motion.
  - **Engine pipeline diagram** → **SVG + framer-motion** (~15KB). Crisp, accessible (screen readers can read stage labels), one-shot pulse on intersection observer entry.
- **D-09:** **Total hero JS budget: ~45KB**, under the 50KB ceiling in VIZ-04.
- **D-10:** Canvas hero MUST honor `prefers-reduced-motion` — render a static keyframe (particles in aggregated state showing the confidence score) instead of the animation. Same for SVG pipeline pulse — fall back to static stages.
- **D-11:** Reject WebGL (overkill, bundle bloat) and GSAP (commercial license risk, larger bundle than framer-motion). Document the rejection rationale in the BRAND-BIBLE addendum so future-Davide doesn't re-litigate.

### Plagiarism Audit Scope (BRAND-05)

- **D-12:** Audit scope is **landing + onboarding + dashboard-visible copy** (any surface a logged-out OR free-tier user encounters). Includes:
  - All 7 viewports of the new landing
  - Sign-up / login / onboarding flow copy
  - Empty states, tooltips, plan-upgrade nudges
  - Hero copy of `BRAND-BIBLE.md` (anything quoted publicly)
- **D-13:** Audit scope **excludes**: admin pages, dev tools, internal docs (`/docs/`), legal boilerplate, code comments, commit messages.
- **D-14:** Verification method: **diff against Artificial Societies original** (use `.planning/reference/societies-landing.png` + Wayback Machine for full text capture) **plus** manual originality pass for tone. Flag both literal copy and structural mimicry (e.g., same paragraph shape, same headline pattern).
- **D-15:** Sign-off model: **approve once at the end** — write the full replacement-copy doc, Davide reads complete doc, approves or sends back. Davide accepts cascade-rework risk if early decisions get rejected.

### Hero Copy Lock (BRAND-06)

- **D-16:** Hero copy in REQUIREMENTS.md (HERO-02 / HERO-03 / HERO-04 / pre-headline / CTAs) is the **draft starting point**. Davide signs off (or redlines) the final form as part of the end-of-phase batch approval (D-15) before Phase 2 build starts.

### Claude's Discretion

- **D-17:** Choice of which library for SVG pipeline animation (framer-motion vs. motion vs. plain CSS) is delegated to plan-phase researcher to evaluate against actual bundle size and DX. Constraint: must stay within 15KB of the ~45KB total budget.
- **D-18:** Internal structure of the Banned → Replacement table (table vs. bullet list vs. callouts) is a writer's call.
- **D-19:** Specific reference URLs to cite in the BRAND-BIBLE addendum (which Linear page, which Stripe hero, etc.) chosen during Phase 1 execution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` — Phase 1 entry, success criteria 1-5, requirement IDs (BRAND-01..06, VIZ-01..05)
- `.planning/REQUIREMENTS.md` — full requirement text for all BRAND-* and VIZ-* items, locked hero copy (pre-headline, H1, sub-headline, subline, CTAs)
- `.planning/PROJECT.md` — milestone context, vocab guardrails, three-audience strategy, "Out of Scope" list

### Brand & Design System (existing)
- `BRAND-BIBLE.md` — existing 351-line Raycast design language reference. Phase 1 produces an **addendum** appending the visual-metaphor lock; do NOT replace.
- `docs/motion-guidelines.md` — existing motion conventions; new hero motion must align
- `docs/tokens.md` — design token reference (coral, dark-mode neutrals)
- `docs/design-specs.json` — machine-readable token spec

### Plagiarism Source (audit input)
- `.planning/reference/societies-landing.png` — Artificial Societies landing page (light)
- `.planning/reference/societies-landing-dark.png` — Artificial Societies landing page (dark)
- Wayback Machine — pull full text capture of artificialsocieties.io landing for diff input

### Reference Set (visual fidelity bar)
- Anthropic, Linear, Vercel, Raycast — public sites; comparable section quality bar for both visuals and copy

### Outputs This Phase Will Create
- `.planning/reference/BRAND-SPINE.md` — voice + vocab + glossary + tone (D-01, D-02)
- `BRAND-BIBLE.md` (appended addendum) — visual metaphor lock for both visuals + tech rationale (D-05..D-11)
- Plagiarism audit + replacement copy artifacts (location TBD by plan-phase, recommend `.planning/phases/01-brand-spine-visual-metaphor/`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Canvas 2D hive visualization** (existing in app at `~43,000 LOC TypeScript`): proven 1300+ nodes at 60fps. Direct evidence base for D-08 (Canvas hero motion choice). Plan-phase researcher should read this code before designing the hero particle system.
- **36 design system components, 100+ tokens**: landing builds on these in Phase 2-4. BRAND-SPINE.md tone examples can reference component naming as voice anchors.
- **Existing `BRAND-BIBLE.md`** (351 lines): the addendum target. Append, don't replace.
- **`src/app/page.tsx`** (current landing): the plagiarism source. Replaced wholesale in Phase 6 (BUILD-09); used as input to the plagiarism audit in Phase 1.

### Established Patterns
- **Raycast aesthetic** (dark-mode only, bg-transparent cards, 6% borders, 12px radius, inset shadows): both visuals MUST live within this language. Particle colors and pipeline stage styling pull from coral + Raycast neutrals.
- **`React.useId()` for SSR-safe IDs**: any new SVG defs in the pipeline diagram MUST use this pattern (per "Key Decisions" table in PROJECT.md).
- **Inter as sole font**: BRAND-SPINE.md tone doc references Inter, no other typefaces introduced.

### Integration Points
- BRAND-SPINE.md MUST be referenceable from Phase 2 plan tasks ("verify section copy against BRAND-SPINE.md §Voice").
- BRAND-BIBLE.md addendum becomes the source plan-phase researcher reads in Phase 2 to choose specific particle behaviors / pipeline icons / motion easing.

</code_context>

<specifics>
## Specific Ideas

- **Brand spine one-liner is locked as canonical**: *"Your audience, simulated."* — appears verbatim in BRAND-SPINE.md, deck cover, social bios, future surfaces. No variants, no tests.
- **Vocabulary anchors**:
  - Banned: "viral", "AI", "go viral", generic marketing-speak
  - Preferred: predict · simulate · forecast · learn · improve · audience · behavioral · trained · self-improving
  - Replacement examples to seed the table: `viral → breakout / high-performing`, `AI → behavioral simulation`, `go viral → land with audience`, `users → creators`
- **Reference pages for visual concept inspiration** (to cite in BRAND-BIBLE addendum):
  - Linear's pipeline-style diagrams (consider their Insights / Cycles section)
  - Vercel's structured section transitions
  - Anthropic's restrained motion (Claude.ai marketing pages)
  - Raycast's hero ambient gradient + screenshot composition
- **Three-audience tuning anchor** (per BRAND-04):
  - Creators (primary): Hero, Demo, Three Surfaces, Pricing, Footer CTA
  - Investors / partners: Science, Social Proof / Metrics
  - Hero serves all three but leads with creator language

</specifics>

<deferred>
## Deferred Ideas

- **In-app prediction viz rebuild** — visual metaphor locked in Phase 1, but actual in-app implementation deferred to its own future milestone (already in PROJECT.md backlog).
- **/about, /research, /manifesto supporting pages** — extend brand spine into dedicated pages later (already deferred in PROJECT.md "Future milestones").
- **Sound design for hero motion** — out of scope per PROJECT.md.
- **Light mode variant of hero motion** — dark-mode first per Constraints in PROJECT.md.
- **Plagiarism audit on admin / dev / legal / internal-docs surfaces** (D-13) — outside Phase 1 scope; not currently on roadmap, capture if anyone notices a copy issue in those surfaces later.
- **Figma frames or animated prototypes for visuals** (D-05 chose written-only) — could be added in a future polish pass if Phase 2 build reveals the written spec leaves too much ambiguity.

</deferred>

---

*Phase: 1-Brand Spine & Visual Metaphor*
*Context gathered: 2026-05-10*
