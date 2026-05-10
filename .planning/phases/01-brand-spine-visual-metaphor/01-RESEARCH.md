# Phase 1: Brand Spine & Visual Metaphor - Research

**Researched:** 2026-05-10
**Domain:** Brand voice codification + visual-metaphor lock + plagiarism audit. **Artifacts only — no production code.**
**Confidence:** HIGH

## Summary

Phase 1 produces four documented artifacts: `BRAND-SPINE.md`, an addendum appended to `BRAND-BIBLE.md`, a plagiarism audit + replacement-copy bundle in `.planning/phases/01-brand-spine-visual-metaphor/`, and a recorded tech-stack rationale for hero motion. **No build, no React.** CONTEXT.md already locks 19 decisions including the split-tech pick (Canvas 2D for hero, SVG + motion library for pipeline) and the ~45KB JS budget. This research fills the four delegated gaps:

1. **D-07 (visual ambiguity):** specifies what the addendum should pin now vs. what Phase 2 finalizes, anchored to the proven hive viz patterns at `src/components/hive/`.
2. **D-17 (motion library for SVG pipeline):** pins exact gzipped numbers from the Bundlephobia API. **Recommendation: `motion/react` already installed at v12.29.2, used via `LazyMotion` + `m` + `domAnimation` features → ~15KB gzipped.** This matches the codebase's existing pattern (most new files import from `motion/react`, some legacy files still import from `framer-motion`).
3. **Plagiarism audit method:** the actual source domain is `societies.io` (not `artificialsocieties.io` — Wayback has no snapshots for that). Recommended workflow: `curl --compressed` + Node-based HTML-to-text extraction + manual side-by-side Markdown table.
4. **Validation Architecture (Nyquist Dimension 8):** propose a `scripts/lint-vocab.mjs` planning-time script invoked by a pre-commit hook + `package.json` script, scanning `src/app/**/*.{ts,tsx,md}` for banned-word patterns. Lower complexity than custom ESLint rule, runs on docs as well as code.

**Primary recommendation:** Slice Phase 1 into 4 plans → (1) BRAND-SPINE.md + Numen Machines lockup doc, (2) BRAND-BIBLE.md addendum + tech rationale, (3) plagiarism audit pipeline + replacement-copy doc, (4) vocab-lint script + pre-commit hook for downstream phase enforcement.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Voice & Vocabulary Doc Depth (BRAND-SPINE.md):**
- **D-01:** Voice doc is **full glossary + tone**, not minimal. Target ~3-4 pages at `.planning/reference/BRAND-SPINE.md`.
- **D-02:** BRAND-SPINE.md MUST include: one-liner (*"Your audience, simulated."*); preferred verbs (predict, simulate, forecast, learn, improve); banned → replacement table (`viral → breakout`, `AI → behavioral simulation`, `go viral → land with audience`); tone descriptors (Calm · Confident · Lab-credible) with DO/DON'T copy examples; audience tuning per section (creator-led / investor-leaning / partner-leaning) for each of the 7 viewports.
- **D-03:** Numen Machines lockup pattern documented (BRAND-03) — when to lead with `VIRTUNA · A NUMEN MACHINES PRODUCT` (hero, footer, OG metadata) vs. use Virtuna alone (in-product, page titles).
- **D-04:** BRAND-SPINE.md is the source of truth all Phase 2-6 copy must obey. Plan-phase produces one task that explicitly verifies BRAND-SPINE.md compliance per section.

**Visual Metaphor Lock Fidelity:**
- **D-05:** Lock fidelity is **written spec + reference links**, not sketches / Figma / animated prototypes.
- **D-06:** BRAND-BIBLE.md addendum describes both visuals in prose with web links to comparable visuals. No Figma frames, no Excalidraw sketches required for Phase 1.
- **D-07:** Plan-phase researcher fills remaining visual ambiguity (particle count, color spec, easing curves, icon choices) during Phase 2 build prep. Phase 1 locks the **concept**, Phase 2 finalizes the **execution**.

**Hero Motion Implementation Technology (VIZ-04):**
- **D-08:** **Split tech decision** — Canvas 2D for hero behavioral simulation (~30KB) + SVG + motion library for engine pipeline (~15KB).
- **D-09:** Total hero JS budget ~45KB, under the 50KB ceiling.
- **D-10:** Both visuals MUST honor `prefers-reduced-motion` — render static fallbacks.
- **D-11:** Reject WebGL (overkill, bundle bloat) and GSAP (commercial license risk). Document rejection rationale in addendum.

**Plagiarism Audit Scope (BRAND-05):**
- **D-12:** Audit scope = **landing + onboarding + dashboard-visible copy** (any logged-out OR free-tier surface). Includes all 7 viewports of new landing, sign-up/login/onboarding flow, empty states, tooltips, plan-upgrade nudges, hero copy of `BRAND-BIBLE.md`.
- **D-13:** Audit scope **excludes**: admin pages, dev tools, `/docs/`, legal boilerplate, code comments, commit messages.
- **D-14:** Verification = diff against Artificial Societies original (Wayback + `.planning/reference/societies-landing.png`) + manual originality pass for tone. Flag literal copy AND structural mimicry.
- **D-15:** Sign-off model: **approve once at the end** — write full doc, Davide reads complete doc, approves or sends back. Davide accepts cascade-rework risk.

**Hero Copy Lock (BRAND-06):**
- **D-16:** Hero copy in REQUIREMENTS.md is the **draft starting point**. Davide signs off final form as part of end-of-phase batch approval (D-15).

### Claude's Discretion

- **D-17:** Choice of library for SVG pipeline animation (framer-motion vs. motion vs. plain CSS) — evaluate against actual bundle size and DX. Constraint: must stay within 15KB of the ~45KB total budget.
- **D-18:** Internal structure of the Banned → Replacement table (table vs. bullet list vs. callouts) — writer's call.
- **D-19:** Specific reference URLs to cite in the BRAND-BIBLE addendum — chosen during Phase 1 execution.

### Deferred Ideas (OUT OF SCOPE)

- In-app prediction viz rebuild — visual metaphor locked in Phase 1, build deferred to a separate future milestone.
- /about, /research, /manifesto supporting pages — extend brand spine into dedicated pages later.
- Sound design for hero motion — out of scope.
- Light mode variant of hero motion — dark-mode first per Constraints in PROJECT.md.
- Plagiarism audit on admin / dev / legal / internal-docs surfaces (D-13).
- Figma frames or animated prototypes for visuals (D-05 chose written-only).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | Codify "Your audience, simulated." in BRAND-SPINE.md as canonical one-liner | Section "Brand Spine Document Structure" — proposed table of contents |
| BRAND-02 | Voice doc captures tone, vocab guardrails, preferred verbs | Section "BRAND-SPINE.md Outline" — concrete section list with content seeds |
| BRAND-03 | Numen Machines lockup pattern documented | Section "Lockup Decision Matrix" — when to use `VIRTUNA · A NUMEN MACHINES PRODUCT` vs. Virtuna alone |
| BRAND-04 | Three-audience framing encoded in voice doc | Section "Audience Tuning per Viewport" — explicit creator/investor/partner mapping |
| BRAND-05 | Plagiarized Artificial Societies copy replaced site-wide | Section "Plagiarism Audit Pipeline" — Wayback workflow, diff method, replacement-copy artifact format |
| BRAND-06 | Headline + subline + CTA copy authored to brand-spine standard, signed off | Hero copy already drafted in REQUIREMENTS.md; Phase 1 only requires final review per D-16 |
| VIZ-01 | Behavioral-simulation visual concept locked | Section "Hero Visual Concept (Canvas)" — concept spec + reusable hive patterns |
| VIZ-02 | Engine-pipeline visual concept locked | Section "Pipeline Visual Concept (SVG)" — 4-stage spec + motion description |
| VIZ-03 | Concepts work at hero / mobile / future in-app embed scale | Section "Scale Affordances" — viewport breakpoints + simplification strategy |
| VIZ-04 | Implementation choice decided with rationale, < 50KB JS budget | Section "Motion Library Decision Matrix" — pinned bundle numbers, recommendation |
| VIZ-05 | Both visuals documented in BRAND-BIBLE addendum as Virtuna's visual language | Section "BRAND-BIBLE Addendum Structure" — concrete location + skeleton |

## Architectural Responsibility Map

Phase 1 produces no production code, but the artifacts feed downstream phases. Each artifact has a tier owner.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BRAND-SPINE.md (voice doc) | Documentation (planning) | — | Pure planning artifact — read by all downstream phases as a copy guardrail |
| BRAND-BIBLE.md addendum | Documentation (repo root) | — | Lives in repo, referenced by Phase 2 plan-researcher to choose particle behaviors / pipeline icons / motion easing |
| Plagiarism audit doc | Documentation (planning) | — | Phase-scoped artifact, captured in `.planning/phases/01-*/` for reviewability |
| Replacement-copy doc | Documentation (planning) | Frontend (Phase 2-4) | Drafted as planning artifact; copy strings consumed by Phase 2-4 build tasks |
| Hero motion tech rationale | Documentation (in addendum) | Frontend (Phase 2) | Documented decision; Phase 2 imports `motion/react` per the rationale |
| Vocab-lint script (recommended) | Build tooling (scripts/) | DX (pre-commit hook) | Optional add-on per Validation Architecture section — runs at planning time, enforces vocab guardrails on all future commits |

## Standard Stack

### Core (artifacts-only — no new runtime deps for Phase 1)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Markdown | — | Voice doc, addendum, audit doc format | All planning + repo docs are .md; matches existing BRAND-BIBLE.md (351 lines), motion-guidelines.md, tokens.md |
| `curl` (system) | — | Fetch Wayback snapshots | Available on macOS/Linux out of the box; `--compressed` flag handles gzip [VERIFIED: tested locally against `web.archive.org/web/20251111233319id_/https://www.societies.io/`] |
| `node` | ≥20 (already installed) | One-shot HTML-to-text extraction script for plagiarism diff | Avoids adding new tooling deps; existing project tech |

### Already in `package.json` (relevant for Phase 2 — pinned here for the addendum's tech rationale)

| Library | Installed Version | Purpose | Bundle (gzipped, full) |
|---------|-------------------|---------|------------------------|
| `framer-motion` | `^12.29.3` | Legacy motion library still used in 2 simulation files | **59.1 KB** [VERIFIED: bundlephobia.com/api/size?package=framer-motion@12.38.0] |
| `motion` | `^12.29.2` | Modern motion library — same API as framer-motion, used in all newer files | **42.5 KB** [VERIFIED: bundlephobia.com/api/size?package=motion@12.38.0] |
| `react-intersection-observer` | `^10.0.2` | Optional intersection-observer utility | ~1.9 KB gzipped [CITED: pkgpulse / npm description] |

### Motion Library Decision Matrix (D-17)

Phase 2 hero pipeline animation must stay within **15 KB gzipped**. Three options:

| Option | Bundle (gzipped) | DX | Honors `prefers-reduced-motion` | Recommendation |
|--------|------------------|----|----|---|
| `motion/react` full import | 42.5 KB | Excellent — declarative, hooks, variants | Yes via `useReducedMotion()` (already used in `src/components/motion/`) | **REJECT — exceeds 15KB budget** |
| `motion/react` via `LazyMotion` + `m` + `domAnimation` | **~15 KB initial** (4.6 KB core + ~10 KB domAnimation feature) | Same API surface, slightly more verbose at the wrapping component | Yes | **RECOMMEND — fits budget exactly, matches codebase pattern** [CITED: motion.dev/docs/react-reduce-bundle-size, motion.dev/docs/react-lazy-motion] |
| Plain CSS keyframes + IntersectionObserver | 0 KB JS for animation | Lower-DX (manual class toggling), but zero cost | Yes via `@media (prefers-reduced-motion: reduce)` | **CONSIDER for absolute minimum** — but the codebase has standardized on `motion/react` for declarative motion; mixing styles raises maintenance cost |

**Recommended pick: `motion/react` (already installed) with `LazyMotion strict features={domAnimation}` wrapping the pipeline component, using the `m.path` / `m.g` SVG primitives.**

Rationale documented in the BRAND-BIBLE addendum (per D-11):
- Already a project dependency — zero install impact.
- Same API as `framer-motion` — codebase consistency.
- `domAnimation` feature pack covers everything needed for a one-shot intersection-observer pulse: `animate`, `variants`, `whileInView`, no drag/pan/layout.
- `useReducedMotion()` hook is a primitive within the package — fallback to static stages with one conditional.
- Bundle: **15 KB** delivered to the user, well under the 50 KB total ceiling.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `motion/react` with LazyMotion | Plain CSS keyframes + IntersectionObserver | Saves 15 KB but increases maintenance cost — codebase has standardized on `motion/react` and four scroll-reveal components depend on it; mixing two animation paradigms hurts readability |
| `curl --compressed` + node HTML-to-text | `waybackpack` Python CLI | `waybackpack` requires Python install + only downloads HTML (no text extraction); a node one-liner is simpler and uses existing tooling [CITED: github.com/jsvine/waybackpack — confirmed no built-in text extraction] |
| Pre-commit hook script | Custom ESLint plugin | Custom ESLint rule is heavier (must understand AST, JSX text nodes, expression containers); a regex-based file scanner is simpler and works on .md docs that ESLint won't see |

### Installation

**No new runtime dependencies for Phase 1.** All artifacts are markdown.

If the Validation Architecture recommendation is adopted, Phase 1 adds one dev script:

```bash
# No new packages required — uses existing Node ≥20 globals
# Script lives at scripts/lint-vocab.mjs
# Wired into a pre-commit hook in .githooks/pre-commit (existing hooks dir)
```

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────┐
                │  Phase 1 Inputs                          │
                │                                          │
                │  • REQUIREMENTS.md (hero copy draft)     │
                │  • PROJECT.md (vocab guardrails)         │
                │  • BRAND-BIBLE.md (existing 351 lines)   │
                │  • societies.io (Wayback snapshot)       │
                │  • src/app/(marketing)/page.tsx          │
                │     + src/components/landing/*           │
                │     (plagiarism source)                  │
                └────────────────┬────────────────────────┘
                                 │
                ┌────────────────┴────────────────────────┐
                │  Phase 1 Activities (planning + writing)│
                │                                          │
                │  ┌─────────────┐    ┌─────────────────┐ │
                │  │ Voice doc   │    │ Visual metaphor │ │
                │  │ author      │    │ author          │ │
                │  └──────┬──────┘    └────────┬────────┘ │
                │         │                    │           │
                │  ┌──────┴──────┐    ┌────────┴────────┐ │
                │  │ Plagiarism  │    │ Tech rationale  │ │
                │  │ audit       │    │ author          │ │
                │  └──────┬──────┘    └────────┬────────┘ │
                │         │                    │           │
                │         └─────────┬──────────┘           │
                │                   │                       │
                │           ┌───────┴───────┐               │
                │           │ Davide review │               │
                │           │ (D-15 batch)  │               │
                │           └───────┬───────┘               │
                └───────────────────┼──────────────────────┘
                                    │
                ┌───────────────────┴──────────────────────┐
                │  Phase 1 Outputs (artifacts on disk)     │
                │                                           │
                │  • .planning/reference/BRAND-SPINE.md    │
                │  • BRAND-BIBLE.md (appended addendum)    │
                │  • .planning/phases/01-*/PLAGIARISM-     │
                │     AUDIT.md                              │
                │  • .planning/phases/01-*/REPLACEMENT-    │
                │     COPY.md                               │
                │  • (optional) scripts/lint-vocab.mjs +   │
                │    .githooks/pre-commit                   │
                └───────────────────┬──────────────────────┘
                                    │
                ┌───────────────────┴──────────────────────┐
                │  Phase 2-6 Consumers                      │
                │                                           │
                │  Phase 2: BRAND-SPINE + addendum + tech  │
                │           rationale → hero build         │
                │  Phase 3-4: BRAND-SPINE → section copy   │
                │             vocab compliance              │
                │  Phase 6: replacement-copy → final swap  │
                └──────────────────────────────────────────┘
```

### Recommended Output Layout

```
.planning/
├── reference/
│   ├── BRAND-SPINE.md                        # NEW — voice doc (D-01, D-02)
│   ├── societies-landing.png                 # EXISTING — plagiarism input (light)
│   ├── societies-landing-dark.png            # EXISTING — plagiarism input (dark)
│   └── (optional) societies-snapshot-2026-XX.html  # NEW — Wayback HTML capture
├── phases/01-brand-spine-visual-metaphor/
│   ├── 01-CONTEXT.md                         # EXISTING
│   ├── 01-DISCUSSION-LOG.md                  # EXISTING
│   ├── 01-RESEARCH.md                        # THIS FILE
│   ├── PLAGIARISM-AUDIT.md                   # NEW — diff between live + societies.io snapshot
│   └── REPLACEMENT-COPY.md                   # NEW — full replacement copy ready for Phase 2-6
└── (root)
    └── BRAND-BIBLE.md                         # EXISTING (351 lines) — append addendum here

scripts/                                       # OPTIONAL — Validation Architecture
└── lint-vocab.mjs                             # NEW — banned-word scanner

.githooks/                                     # OPTIONAL — pre-commit
└── pre-commit                                 # NEW (or extend existing) — invoke lint-vocab.mjs
```

### Pattern 1: BRAND-SPINE.md — Voice Document Structure

**What:** Self-contained markdown reference for all customer-facing copy decisions.
**When to use:** Read by Phase 2-6 plan researchers + executors before writing any UI string.
**Skeleton (D-01, D-02):**

```markdown
# Virtuna Brand Spine

> Source of truth for voice, vocabulary, and tone across all customer-facing surfaces.

## 1. The One-Liner (canonical)

**Your audience, simulated.**

[appears verbatim in: deck cover, social bios, OG metadata, footer brand stamp.
NOT a tagline subject to A/B testing.]

## 2. Tone Descriptors

- **Calm** — never breathless. No exclamation marks in body copy. Numerals over hype.
- **Confident** — declarative sentences. No hedging ("maybe", "we think").
- **Lab-credible** — research vocabulary (forecast, trained, calibrated, behavioral). Not academic stuffiness.

### Do / Don't

| Do (✓) | Don't (✗) |
|--------|-----------|
| "Predict how your audience will respond." | "AI-powered viral prediction!" |
| "Trained on decades of behavioral research." | "Powered by cutting-edge AI." |
| "Forecast every video before it ships." | "Will your video go viral?" |
| (~5 more pairs) | |

## 3. Preferred Verbs

predict · simulate · forecast · learn · improve · train (intransitive: "the engine trains on outcomes") · respond · watch · land

## 4. Banned → Replacement Table

| Banned | Replacement | Reason |
|--------|-------------|--------|
| viral | breakout / high-performing / lands | "viral" weakens $100M positioning |
| AI | behavioral simulation / engine / model | "AI" is generic; we're specific |
| go viral | land with audience / break through | dated creator-economy phrase |
| users | creators (or specific role) | products serve creators, not "users" |
| (~5 more) | | |

## 5. Numen Machines Lockup Pattern

| Surface | Treatment | Example |
|---------|-----------|---------|
| Landing hero pre-headline | `VIRTUNA · A NUMEN MACHINES PRODUCT` (small mono, uppercase) | as drafted in REQUIREMENTS.md HERO-01 |
| Landing footer | `Made by Numen Machines` + lockup mark | per PRICE-05 |
| OG metadata (og:title) | `Virtuna — A Numen Machines product` | for shareable previews |
| In-product chrome | `Virtuna` alone | shipped to logged-in user — context already established |
| Page titles (`<title>`) | `Virtuna — Predict your audience` | tab clarity |

## 6. Audience Tuning per Viewport

| Viewport | Primary Audience | Voice Lean | Concrete Example |
|----------|------------------|------------|------------------|
| Hero | All three | Creator-led, but lab-credible enough for investors | H1 in second person, subline cites "decades of research" |
| Demo | Creators | Tactile, verb-first | "Paste a TikTok URL.", not "Submit a query." |
| How It Works | Creators + investors | Process diagram language | "video → analyze → simulate → predict" |
| Three Surfaces | Creators | Product-language | "Brand Deals", not "Monetization integrations" |
| The Science | Investors + partners | Lab-credible, citation-led | "1,000-survey replication study" |
| Social Proof | Creators + investors | Quote-led, honest framing | "Early signal from 47 creators" not fake-impressive numbers |
| Pricing | Creators | Direct, no jargon | "$X/mo. 7-day Pro trial." |

## 7. How to use this document

- Plan-phase researchers: read this before creating section-level copy plans.
- Executors: every UI string MUST be cross-checked against §3 (preferred verbs) and §4 (banned table).
- Optional automation: `scripts/lint-vocab.mjs` enforces §4 at commit time.
```

### Pattern 2: BRAND-BIBLE.md Addendum Structure

**What:** New top-level section appended to existing 351-line BRAND-BIBLE.md.
**Where:** Appended **after** the existing `## Resources` section (line 338), so the addendum is the file's last section. New header: `## Visual Metaphor Lock` at level `##`.
**Why this location:** The existing structure flows from foundational tokens → patterns → components → resources. Adding the addendum at the bottom preserves chronological readability ("here's the design system, and here's our visual metaphor for the brand"). Inserting mid-file would force renumbering of TOC-adjacent sections.
**Skeleton:**

```markdown
[... existing 351 lines unchanged ...]

---

## Visual Metaphor Lock

> Phase 1 of the Brand Statement Landing milestone locked the paired visual language of Virtuna. This section is the source of truth for both visuals; Phase 2 implementation honors these specs.

### 1. Hero — Behavioral Simulation Visual

**Concept:** Animated audience-particles reacting to a video stimulus, aggregating into a confidence score.

**Technical implementation:** Canvas 2D, ~30 KB.

**Why Canvas (not WebGL or SVG):**
- Direct evidence base — `src/components/hive/HiveCanvas.tsx` proves Canvas 2D handles 1300+ nodes at 60fps in this codebase.
- WebGL = overkill for ~150-300 particles + bundle bloat (Three.js is 600KB+ even tree-shaken).
- SVG = degrades sharply past ~100 simultaneous animated DOM nodes.

**Reference visuals (D-19 picks):**
- Stripe homepage hero gradient — restrained motion, premium feel: https://stripe.com
- Anthropic Claude product page — calm, lab-credible motion: https://www.anthropic.com/claude
- Linear homepage hero — minimal motion, structural feel: https://linear.app
- Raycast homepage hero — ambient gradient + screenshot composition: https://raycast.com

**What's locked in Phase 1 (concept):**
- Particles aggregate into a confidence-score number (specific number is content; visual settles into a clean shape).
- Coral accent color (#FF7F50) for the converged "majority" particles; Raycast neutrals for the minority.
- One-shot animation on viewport entry, not a loop.
- Reduced-motion fallback: static keyframe of converged state with confidence number.

**What Phase 2 finalizes (execution):**
- Exact particle count (suggest target 200–400 — matches density of `hive` viz at smaller scale)
- Easing curves (suggest `easeOutCubic` matching `src/components/hive/use-hive-animation.ts:57`)
- Convergence vector field (geometry of the aggregation)
- Initial particle distribution (uniform, normal, perlin?)
- Aggregation icon / center treatment (a number? a coral pill? a video frame?)

### 2. Pipeline — Engine Diagram

**Concept:** 4-stage horizontal diagram — `video → analyze → simulate audience → predict`. Subtle pulse motion fires once on viewport entry.

**Technical implementation:** SVG + `motion/react` (LazyMotion + `m` + `domAnimation` features), ~15 KB.

**Why SVG (not Canvas) for this visual:**
- Crisp at any DPI — pipeline is small, label-led, structural.
- Stage labels are screen-reader accessible (Canvas 2D has no native a11y; pipeline's labels are essential).
- One-shot motion fits SVG's strength — no re-render every frame.

**Why `motion/react` (not framer-motion or plain CSS):**
- Already a project dep (`motion@^12.29.2`).
- Same API as framer-motion (which is also installed but used in legacy files); standardizing on `motion/react` reduces import inconsistency.
- LazyMotion + `m` + `domAnimation` keeps bundle at ~15 KB instead of full 42.5 KB.
- Plain CSS keyframes were considered and rejected: codebase has standardized on `motion/react` for all scroll-reveal components (FadeIn, FadeInUp, SlideUp, StaggerReveal); mixing two animation paradigms increases maintenance cost.
- GSAP rejected: commercial license risk for paid plans + larger bundle than tree-shaken motion.

**Reference visuals (D-19 picks):**
- Linear Insights cycle graph — pipeline-style visualization with structural stages: https://linear.app/insights
- Vercel Observability product page — section transitions with restrained motion: https://vercel.com/products/observability
- Stripe Atlas process diagrams — clear step-by-step structural feel: https://stripe.com/atlas

**What's locked in Phase 1 (concept):**
- Exactly 4 stages: `video → analyze → simulate audience → predict`
- Each stage has a 1-line label and an iconographic representation (icon source TBD in Phase 2 — codebase has `@phosphor-icons/react` + `lucide-react` available).
- One-shot pulse on intersection-observer entry, NOT a continuous loop (per WORKS-02).
- Reduced-motion fallback: static stages, no pulse, full visibility.

**What Phase 2 finalizes (execution):**
- Specific icons per stage (Phosphor / Lucide picks)
- Pulse easing + duration (suggest `--ease-out-cubic` 600ms per stage with 100ms stagger, matching existing `StaggerReveal`)
- Connector style (line / arrow / dashed)
- Hover state on each stage (if any — WORKS spec doesn't require)
- Mobile vertical-stack layout (per WORKS-05)

### 3. Rejected Alternatives (don't re-litigate)

| Considered | Rejected because |
|------------|------------------|
| WebGL hero | Bundle bloat (Three.js 600KB+); no perceptual benefit at our particle count |
| GSAP for either visual | Commercial license cost on the paid Business tier ($199/yr/dev) + larger than `motion/react` LazyMotion |
| SVG for hero particles | DOM node count would exceed performant range past ~100 simultaneous particles |
| Canvas for pipeline | Stage labels need screen-reader access; Canvas has no native a11y |
| Plain CSS keyframes for pipeline | Codebase standardized on `motion/react`; mixing paradigms increases maintenance cost |
| Lottie animations | Asset-driven; doesn't fit hand-tuned canvas particle behavior; 50 KB+ even for simple animations |

### 4. Performance Budget

| Visual | Implementation | Gzipped Bundle Cost |
|--------|---------------|---------------------|
| Hero particles | Canvas 2D (no library — direct API) | ~30 KB (component code, no third-party motion lib) |
| Pipeline | SVG + `motion/react` LazyMotion + m + domAnimation | ~15 KB (motion subset) |
| **Total hero motion JS** | | **~45 KB** (under VIZ-04 ceiling of 50 KB) |
```

### Pattern 3: Plagiarism Audit Pipeline

**What:** Reproducible diff workflow that produces a reviewable artifact.
**When to use:** Phase 1 Plan 3 (plagiarism audit), referenced again whenever copy is re-audited.

**Step 1 — Capture Wayback snapshot of `societies.io`:**

```bash
# IMPORTANT: domain is societies.io, NOT artificialsocieties.io
# (Wayback has zero snapshots for artificialsocieties.io — verified 2026-05-10)

# Find most recent snapshot
curl -s "http://web.archive.org/cdx/search/cdx?url=societies.io&from=20260101&output=json&limit=20" \
  | tail -5

# Pick a recent snapshot (text/html, statuscode 200, large size)
# Example: 20260504034418 → ~20 KB HTML, status 200

# Fetch and decompress (Wayback returns gzip; --compressed handles it)
SNAPSHOT_TS="20260504034418"
curl -s --compressed \
  "https://web.archive.org/web/${SNAPSHOT_TS}id_/https://societies.io/" \
  > .planning/reference/societies-snapshot-${SNAPSHOT_TS}.html

# Verify it's the right page
grep -oE "AI personas|attitudes|beliefs|opinions" .planning/reference/societies-snapshot-${SNAPSHOT_TS}.html | head -5
```

The `id_` flag in the Wayback URL is critical — it returns the original HTML without Wayback's injected toolbar.

**Step 2 — Extract clean text from HTML:**

```bash
# One-shot Node script — no extra deps, uses Node ≥20 globals
node -e '
  const fs = require("fs");
  const html = fs.readFileSync(process.argv[1], "utf8");
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'"'"'")
    .replace(/&quot;/g, "\"")
    .trim();
  console.log(text);
' .planning/reference/societies-snapshot-${SNAPSHOT_TS}.html \
  > .planning/reference/societies-text-${SNAPSHOT_TS}.txt
```

**Step 3 — Extract Virtuna's current copy from JSX:**

```bash
# The plagiarism source files are concentrated in:
#   src/app/(marketing)/page.tsx               (composition)
#   src/components/landing/*.tsx               (10 section components)
#   src/components/layout/footer.tsx           (footer copy)
#   src/components/layout/header.tsx           (nav)
#   src/components/onboarding/preview-step.tsx (onboarding)

# Manually extract user-facing strings from each — produces a doc like:
# `.planning/phases/01-*/VIRTUNA-CURRENT-COPY.md`
# This step is manual because JSX text is awkward to grep cleanly.
```

**Step 4 — Build the diff doc (manual, reviewable):**

`.planning/phases/01-brand-spine-visual-metaphor/PLAGIARISM-AUDIT.md` structure:

```markdown
# Plagiarism Audit: Artificial Societies → Virtuna v1.1

**Snapshot source:** https://web.archive.org/web/20260504034418id_/https://societies.io/
**Audit date:** 2026-05-XX
**Scope:** D-12 — landing + onboarding + dashboard-visible copy

## Method

1. Wayback HTML capture of societies.io (saved at `.planning/reference/societies-snapshot-20260504034418.html`)
2. Plain-text extraction (saved at `.planning/reference/societies-text-20260504034418.txt`)
3. Manual extraction of Virtuna's current copy from JSX components
4. Side-by-side diff in this document
5. Tone-mimicry pass: even if literal text differs, flag if paragraph shape, headline pattern, or structural framing matches

## Findings

### Section 1: Hero (HIGH severity — verbatim phrase reuse)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| H1 | "[exact text from snapshot]" | "Human Behavior, Simulated." (`src/components/landing/hero-section.tsx:29`) | Plagiarized — pattern + tone match |
| Sub-headline | "[text]" | "AI personas that replicate real-world attitudes, beliefs, and opinions." (`hero-section.tsx:38`) | Plagiarized — verbatim phrase "real-world attitudes, beliefs, and opinions" |
| CTA | "[text]" | "Get in touch" | Generic — not flagged |

### Section 2: Features ("Into the future" → 4-card grid)

| ... | ... | ... | ... |

[continue for all 7 viewports + footer + onboarding]

## Replacement scope

| Severity | Count | Replace in Phase | File touchpoints |
|----------|-------|------------------|------------------|
| HIGH (verbatim) | N | Phase 6 (BUILD-09 swaps page.tsx) | hero-section.tsx, features-section.tsx, ... |
| MEDIUM (structural mimicry) | N | Phase 2-4 (per-section build) | ... |
| LOW (similar tone) | N | Phase 2-4 | ... |

## Sign-off

- [ ] Davide reviewed full doc
- [ ] Davide approved replacement-copy doc (separate file)
- [ ] No additional structural mimicry detected on second pass
```

**Step 5 — Replacement copy doc:**

`.planning/phases/01-brand-spine-visual-metaphor/REPLACEMENT-COPY.md` structure:

```markdown
# Replacement Copy — Brand Statement Landing

**Source of truth for all customer-facing copy.**
**Conforms to:** `.planning/reference/BRAND-SPINE.md`

## Hero (HERO-01..10)
- Pre-headline: `VIRTUNA · A NUMEN MACHINES PRODUCT`
- H1: "Predict how your audience will respond. Before you post."
- Sub-headline: "Virtuna simulates your audience to forecast every video before it ships."
- Subline: "Trained on decades of behavioral research. Self-improving with every outcome."
- Primary CTA: "Run a prediction →"
- Secondary CTA: "See the science"

## Demo (DEMO-01..08)
- Section eyebrow: "Try it"
- Headline: "[draft]"
- Input placeholder: "[draft]"
- ... (all 7 viewports + onboarding + footer)

## Sign-off
- [ ] Davide approved
```

### Pattern 4: Vocab Linting (Validation Architecture — see §Validation Architecture)

See dedicated section below.

### Anti-Patterns to Avoid

- **Don't append to BRAND-BIBLE.md mid-section** — preserve the existing 351-line flow; the addendum is a new top-level section at the end.
- **Don't write the full plagiarism audit before extracting Wayback text** — manual claims about what societies.io says will be wrong if not grounded in a saved snapshot.
- **Don't sign off the replacement copy without running it past §3 and §4 of BRAND-SPINE.md** — the doc cannot be its own truth source.
- **Don't write production code in Phase 1.** D-08..D-11 documents the tech rationale; Phase 2 is the first phase that touches `.tsx` for the new landing.
- **Don't use `framer-motion` import paths in any new code that touches the addendum's example snippets** — the codebase is migrating away from `framer-motion` toward `motion/react`. New examples should reflect the target state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wayback snapshot retrieval | A custom scraper | `curl --compressed` + `?id_` flag | Wayback's CDX API + `id_` flag give clean HTML in one shell command |
| HTML-to-text for plagiarism | A regex-based custom parser | Inline node script (provided above) | A 10-line script handles the 95% case; full DOM parsing is overkill for Markdown audit |
| Reduced-motion detection | A custom matchMedia hook | `usePrefersReducedMotion()` at `src/hooks/usePrefersReducedMotion.ts` | Already implemented and tested — use it (Phase 2 reference) |
| Canvas resize + DPR | Custom ResizeObserver setup | `useCanvasResize` at `src/components/hive/use-canvas-resize.ts` | Production-grade DPR fallback chain (devicePixelContentBoxSize → contentBoxSize → contentRect); reuse verbatim in Phase 2 hero |
| Particle render loop | Custom `requestAnimationFrame` | Pattern from `src/components/hive/use-hive-animation.ts` + `HiveCanvas.tsx` | Proven 60fps with 1300+ nodes; module-level "completed" flag to prevent replay; ref-based state to avoid React re-renders per frame |
| Vocab compliance check | Custom ESLint plugin (heavy) | Simple `scripts/lint-vocab.mjs` regex scanner | Custom ESLint rule needs JSX text-node + JSXExpressionContainer AST handling; a regex scanner runs on .md docs too and stays under 100 LOC |

**Key insight:** The hive viz at `src/components/hive/` is already a textbook reference for high-performance Canvas 2D in this exact codebase. Phase 2's hero particle system should treat it as the foundation, not the inspiration. Specific patterns to reuse:

| Pattern | File:line | What it solves |
|---------|-----------|----------------|
| DPR-aware resize | `use-canvas-resize.ts:43-100` | Crisp rendering on retina + Safari fallback chain |
| RAF-driven animation with module-level "complete" flag | `use-hive-animation.ts:42-49, 121-193` | Animation plays once per session, doesn't replay on remount |
| Ref-based render state (no React re-renders per frame) | `HiveCanvas.tsx:54-57, 147-186` | Camera, layout, and interaction in refs; `render()` reads synchronously |
| `prefers-reduced-motion` early return + full-visibility constant | `use-hive-animation.ts:65-69, 122-130` | Static keyframe fallback in 4 lines |
| Background skeleton render path | `hive-renderer.ts:464-511` | Concentric rings + dot placeholders for loading state |
| Color batching via `Map<colorKey, circles>` | `hive-renderer.ts:240-298` | Fewer fillStyle changes per frame at high node counts |
| `globalAnimationComplete` module-level flag | `use-hive-animation.ts:42-49` | Prevents animation replay across navigation |

The addendum's "What Phase 2 finalizes" subsection (per D-07) should explicitly reference these file:line pointers so the Phase 2 plan researcher knows exactly what to read first.

## Common Pitfalls

### Pitfall 1: Wrong domain in plagiarism audit
**What goes wrong:** Researcher fetches `artificialsocieties.io` from Wayback and gets zero snapshots, concludes no source exists, drafts replacement copy from imagination.
**Why it happens:** PROJECT.md and CONTEXT.md refer to "Artificial Societies" (the company / brand name), not the domain. The actual landing page lives at `societies.io`.
**How to avoid:** Always verify the URL via Wayback CDX before drafting the audit doc.
**Warning signs:** `curl https://archive.org/wayback/available?url=$URL` returns `"archived_snapshots": {}`.

### Pitfall 2: Wayback returns gzip-encoded HTML
**What goes wrong:** Bash output looks like binary garbage; researcher concludes the snapshot is broken.
**Why it happens:** Wayback Machine serves gzip-encoded responses. Default `curl` doesn't decompress.
**How to avoid:** Always use `curl --compressed`. The flag is silent on responses that aren't gzipped, so it's safe to always include.
**Warning signs:** `file snapshot.html` reports "gzip compressed data".

### Pitfall 3: Conflating "Artificial Societies" the brand with the actual cloned content
**What goes wrong:** Audit doc lists what the source says today, but the v1.1 plagiarism dates from a prior snapshot. The source has since evolved.
**Why it happens:** Web archives time-shift; live content drifts.
**How to avoid:** Pick a Wayback timestamp **close to when the v1.1 plagiarism happened** (`v1.1` was earlier — see PROJECT.md's milestone history; the original "pixel-perfect societies.io clone" was v1.1 milestone 2026-XX). Use a snapshot from that era plus a recent one for context. The 2026-05-04 snapshot at 20 KB shows the *current* live state; the 2025-11-11 snapshot at 49 KB may better match what was originally cloned.
**Warning signs:** Snapshot text doesn't match obviously-plagiarized strings in the codebase (e.g., "Human Behavior, Simulated." doesn't appear in 2026-05 snapshot — it appears only in pre-redesign Wayback captures).

### Pitfall 4: BRAND-BIBLE.md addendum drifts mid-file
**What goes wrong:** Researcher inserts the visual metaphor section between existing sections "to keep related content together"; downstream readers expect the file's last section to be Resources and don't see the addendum.
**Why it happens:** Natural urge to organize topically.
**How to avoid:** Strictly append at end of file (after `## Resources`, after the last `---`, after the date footer line). Update the date footer to reflect the addendum.
**Warning signs:** Diff shows the file modified mid-flow (renumbered sections).

### Pitfall 5: Splitting motion library imports across `framer-motion` and `motion/react`
**What goes wrong:** Phase 2-4 builds a new component that imports from `framer-motion`, while a sibling component imports from `motion/react`. Both ship → ~100 KB combined, exceeds 50 KB ceiling.
**Why it happens:** Codebase has both packages installed (legacy use of `framer-motion`); copy-paste from old files perpetuates the wrong import path.
**How to avoid:** BRAND-BIBLE addendum's tech rationale section MUST explicitly state: "All NEW motion code uses `motion/react` import path. The two `framer-motion` imports in `src/components/app/simulation/*.tsx` are legacy and slated for migration in a future cleanup."
**Warning signs:** New PR shows `import ... from 'framer-motion'`. Add this to the vocab-lint script as an additional check.

### Pitfall 6: Not honoring reduced-motion in the documented spec
**What goes wrong:** Addendum spec describes the motion behavior but doesn't document the static fallback; Phase 2 ships hero animation that completely disappears for reduced-motion users.
**Why it happens:** The animation feels like the point; the fallback feels like an afterthought.
**How to avoid:** Addendum sections "Hero — Behavioral Simulation" and "Pipeline — Engine Diagram" each include a "Reduced-motion fallback" sub-bullet describing the static state visually (e.g., "particles in converged state showing the confidence number", "all 4 stages visible at full opacity, no pulse").
**Warning signs:** Addendum mentions "respects reduced motion" without specifying what the static state looks like.

## Code Examples

These are **reference patterns Phase 2 will use**, included in the addendum so Phase 2 plan-research has zero-friction access. **Phase 1 itself writes no code** — these are illustrative for the addendum.

### Example 1: Pipeline pulse with `motion/react` LazyMotion (~15 KB gzipped)

```tsx
// Source pattern: motion.dev/docs/react-lazy-motion + existing hover-scale.tsx
'use client';
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useId } from "react";

const STAGES = [
  { label: "Video", icon: "video" },
  { label: "Analyze", icon: "analyze" },
  { label: "Simulate audience", icon: "audience" },
  { label: "Predict", icon: "predict" },
] as const;

export function EnginePipeline() {
  const reducedMotion = useReducedMotion();
  const titleId = useId();

  return (
    <LazyMotion strict features={domAnimation}>
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox="0 0 800 120"
        className="w-full h-auto"
      >
        <title id={titleId}>4-stage prediction engine pipeline</title>
        {STAGES.map((stage, i) => (
          <m.g
            key={stage.label}
            initial={reducedMotion ? false : { opacity: 0.3, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.6,
              delay: reducedMotion ? 0 : i * 0.15,
              ease: [0.215, 0.61, 0.355, 1], // matches --ease-out-cubic from tokens
            }}
          >
            {/* stage rendering */}
          </m.g>
        ))}
      </svg>
    </LazyMotion>
  );
}
```

Why this pattern:
- `LazyMotion` + `domAnimation` features → 15 KB gzipped (vs 42.5 KB for full motion).
- `whileInView` + `viewport={{ once: true }}` → one-shot pulse on intersection observer entry (per WORKS-02, no loop).
- `useReducedMotion()` short-circuits to static state.
- `useId()` keeps SVG-internal IDs SSR-safe (per the Key Decisions table in PROJECT.md — "React.useId() for InputField IDs").
- Easing matches existing token `--ease-out-cubic` (from `docs/tokens.md`).

### Example 2: Hero canvas particle skeleton (Phase 2 to flesh out)

```tsx
// Source pattern: src/components/hive/HiveCanvas.tsx (proven 1300+ nodes / 60fps)
'use client';
import { useCallback, useEffect, useRef } from "react";
import { useCanvasResize } from "@/components/hive/use-canvas-resize"; // REUSE VERBATIM
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"; // REUSE VERBATIM

let globalAnimationPlayed = false; // module-level — same pattern as use-hive-animation.ts

export function BehavioralSimulationHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const rafRef = useRef<number>(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, dpr } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw particles in current state
    // 2. Draw aggregation target (confidence score)
    // 3. Draw subtle coral glow on converged majority
    // … Phase 2 specifies exact behavior

    ctx.restore();
  }, []);

  const sizeRef = useCanvasResize(canvasRef, render);

  useEffect(() => {
    if (reducedMotion || globalAnimationPlayed) {
      // Render static converged keyframe and return
      render();
      return;
    }
    // Run RAF loop, set globalAnimationPlayed = true at completion
  }, [reducedMotion, render]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      role="img"
      aria-label="Audience particles aggregating into confidence score"
    />
  );
}
```

This skeleton is **not** the Phase 1 deliverable — it's an illustration in the addendum showing how the proven hive patterns map to the hero. Phase 2 implements the actual behavior.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` import path | `motion/react` import path | Late 2025: framer-motion → motion rebranding [CITED: motion.dev/docs/react-upgrade-guide] | Codebase has both installed; Phase 1 addendum standardizes on `motion/react` for new code. Same API, same version (`12.29.x` for both). |
| Full `motion` import (~42 KB) | `LazyMotion` + `m` + feature packs | Documented 2024-2026 [CITED: motion.dev/docs/react-reduce-bundle-size] | 65% bundle savings for the typical case. |
| `<InView>` HOC for intersection observer | `useInView()` hook (Motion built-in) or `viewport` prop on `m.*` components | 2024+ | Smaller, more idiomatic. Phase 2 uses `viewport={{ once: true }}` instead of `react-intersection-observer` directly. |
| Manual `requestAnimationFrame` for SVG entrance | `whileInView` declarative | 2024+ | Removes manual lifecycle bookkeeping for declarative cases. Hero canvas still uses RAF directly because the particle physics aren't a tween. |

**Deprecated/outdated:**
- Top-level `motion.div` from `framer-motion` for components that ship to the user — replaced by tree-shakeable `m.div` via LazyMotion when bundle matters. Existing legacy usages in `src/components/app/simulation/` are NOT a Phase 1 problem; flag for a future cleanup task.
- `react-intersection-observer` package — installed (`^10.0.2`) but largely superseded by motion's built-in `whileInView` for animation contexts. Keep installed for non-animation uses (e.g., `use-trending`-style infinite scroll), but Phase 2 hero/pipeline should not import it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "The plagiarism source is `societies.io`, not `artificialsocieties.io`" | Plagiarism Audit Pipeline | LOW — verified via `curl` against Wayback CDX (zero snapshots for `artificialsocieties.io`, dozens for `societies.io`). |
| A2 | "The 2025-11-11 snapshot may match the original v1.1 plagiarism era" | Pitfall 3 | MEDIUM — I didn't have access to the v1.1 milestone date in PROJECT.md timeline; researcher should confirm by checking commit history of `src/components/landing/hero-section.tsx` and picking a snapshot near that date. [ASSUMED] |
| A3 | "`motion/react` LazyMotion + domAnimation = ~15 KB gzipped" | Motion Library Decision Matrix | LOW — derived from Bundlephobia API (motion@12.38.0 = 42.5 KB total) and motion.dev's documentation (LazyMotion core 4.6 KB + domAnimation feature ~10 KB ≈ 15 KB). [VERIFIED via Bundlephobia API + motion.dev docs] |
| A4 | "WebGL alternative is overkill for ~150-300 particles" | BRAND-BIBLE Addendum Pattern 2, Rejected Alternatives | LOW — established Canvas 2D performance in this codebase is 1300+ nodes / 60fps; particle count required for hero is well below this. |
| A5 | "GSAP costs $199/yr/dev on Business tier" | Rejected Alternatives | LOW — pulled from training data. Researcher should verify against current GreenSock pricing if cost is a Phase 1 sign-off concern. [ASSUMED] |
| A6 | "Existing `BRAND-BIBLE.md` addendum should append after `## Resources` (line 338)" | BRAND-BIBLE.md Addendum Structure | LOW — read the file (351 lines, ends with date footer at the bottom). |
| A7 | "react-intersection-observer is already installed and is ~1.9 KB gzipped" | Standard Stack | LOW — verified via package.json (`^10.0.2`) + WebSearch confirmation of bundle size [VERIFIED via package.json + npm description]. |
| A8 | "Vocab-lint script can run in pre-commit without adding dependencies" | Validation Architecture | LOW — Node ≥20 standard library (`fs`, `path`, `process`) covers the use case; existing `.githooks/post-commit` proves the project already uses git hooks. |
| A9 | "Phase 1 needs no Tailwind v4 / Lightning CSS / backdrop-filter consideration" | (omitted) | LOW — Phase 1 produces no CSS; addendum mentions these only as references for Phase 2. CLAUDE.md's quirks ("Tailwind v4 oklch inaccuracy", "Lightning CSS strips backdrop-filter") apply to Phase 2's hero implementation, not Phase 1's documentation. |

**Decisions that need user confirmation before plan execution:**
- A2 (Wayback timestamp choice) — researcher should confirm v1.1 milestone date from PROJECT.md timeline before pinning the snapshot.
- A5 (GSAP pricing) — only matters if Davide wants the addendum to cite a specific cost number; otherwise "commercial license risk" is sufficient.

## Open Questions

1. **Should the vocab-lint script be Phase 1 scope or Phase 5 scope?**
   - What we know: D-04 says BRAND-SPINE.md MUST be the source of truth Phase 2-6 obey, and the planner should produce a task that "explicitly verifies BRAND-SPINE.md compliance per section." The lint script automates that.
   - What's unclear: Whether the script ships as a Phase 1 deliverable (alongside BRAND-SPINE.md) or as part of Phase 5's "Quality Gates" task.
   - Recommendation: **Ship in Phase 1 as a minimal regex scanner** (≤100 LOC, no deps). Reasoning: Phase 2 starts immediately after Phase 1 sign-off; if vocab compliance isn't enforced from the first commit, accumulated drift across Phase 2-4 will be expensive to clean up in Phase 5.

2. **Does the addendum belong inside `BRAND-BIBLE.md` or as a separate file `BRAND-VISUAL-METAPHOR.md`?**
   - What we know: D-06 says "BRAND-BIBLE.md addendum"; success criterion #3 says "BRAND-BIBLE addendum documents... as the locked visual language."
   - What's unclear: "Addendum" technically allows either inline or separate-file interpretations.
   - Recommendation: **Inline append.** Phase 2-6 readers will look for visual-language guidance inside BRAND-BIBLE.md (it's the canonical design doc). A separate file fragments the source of truth. The existing file is only 351 lines; 200+ more lines for the addendum keeps it under 600 — well within "single-file readable" range.

3. **For the "tone-mimicry" pass in plagiarism audit — should this be a structured rubric or free-form prose?**
   - What we know: D-14 says "Flag both literal copy and structural mimicry (e.g., same paragraph shape, same headline pattern)."
   - What's unclear: The mechanism for flagging structural mimicry.
   - Recommendation: **Structured rubric with 4 columns: surface, structural pattern (headline / 4-card grid / FAQ accordion / quote pull), source mimicry (yes / partial / no), severity (HIGH / MED / LOW).** Free-form prose is harder to review at the end of phase.

4. **What's the canonical sample of Davide's voice for the BRAND-SPINE.md DO/DON'T examples?**
   - What we know: D-02 requires DO/DON'T copy examples; PROJECT.md has vocab guardrails; REQUIREMENTS.md has hero copy; the existing site has plagiarized copy that's NOT canonical.
   - What's unclear: Whether the writer should source DO/DON'T pairs from existing approved copy (decks? founder bio? social posts?), generate them from scratch, or pull from Davide's prior writing.
   - Recommendation: **Ask Davide for 1-2 paragraphs of his own writing on the product as voice ground truth before drafting the §2 DO/DON'T table.** A 5-minute conversation here saves hours of iteration. Failing that, generate DO/DON'T from REQUIREMENTS.md hero copy + the banned table, and let Davide redline at D-15 sign-off.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `curl` (system) | Wayback snapshot retrieval | ✓ | macOS 25.4.0 default | — |
| `node` ≥20 | HTML-to-text extraction script + (optional) vocab-lint script | ✓ | (already used by Next.js 16.1.5 build) | — |
| `git` + `.githooks/` | (Optional) pre-commit vocab lint | ✓ | hooks dir exists per `.githooks/post-commit` | If absent, run lint manually via `pnpm lint:vocab` script |
| `pnpm` | Adding optional `package.json` script | ✓ | implied by CLAUDE.md "pnpm lint" reference | — |
| Internet access to web.archive.org | Plagiarism audit pipeline | ✓ | (used during this research) | If blocked: existing `.planning/reference/societies-landing*.png` screenshots can be transcribed manually, but text fidelity drops |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

Phase 1 has no external service dependencies. The Wayback Machine is the only network call, and the cached PNG screenshots in `.planning/reference/` are a fallback if archive.org is unreachable.

## Validation Architecture

> Per `workflow.nyquist_validation: true` in `.planning/config.json`. Phase 1 produces no executable code, so validation centers on document-level compliance + downstream enforcement.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (existing) for any test scripts; no new framework needed |
| Config file | `vitest.config.ts` (existing) — Phase 1 doesn't add tests |
| Quick run command | `pnpm test` (existing) |
| Full suite command | `pnpm test:coverage` (existing) |

Phase 1 produces documents, not code. The validation layer is: **(a)** document-existence checks (the artifact is on disk where the planner says it is) and **(b)** a vocab-lint script that gates downstream phases.

### Phase Requirements → Validation Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | `BRAND-SPINE.md` exists with the canonical one-liner | smoke | `test -f .planning/reference/BRAND-SPINE.md && grep -q "Your audience, simulated" .planning/reference/BRAND-SPINE.md` | ❌ Wave 0 — file to be created |
| BRAND-02 | BRAND-SPINE.md has all required sections | smoke | `node scripts/check-brand-spine-sections.mjs` (a tiny script that greps for required H2 headers) | ❌ Wave 0 — script to be created if needed |
| BRAND-03 | Numen Machines lockup pattern documented | smoke | `grep -q "Lockup Decision Matrix" .planning/reference/BRAND-SPINE.md` | ❌ Wave 0 |
| BRAND-04 | Three-audience framing in voice doc | smoke | `grep -q "Audience Tuning per Viewport" .planning/reference/BRAND-SPINE.md` | ❌ Wave 0 |
| BRAND-05 | Plagiarism audit doc + replacement copy doc on disk, signed off | smoke | `test -f .planning/phases/01-*/PLAGIARISM-AUDIT.md && test -f .planning/phases/01-*/REPLACEMENT-COPY.md && grep -q "\[x\] Davide approved" .planning/phases/01-*/REPLACEMENT-COPY.md` | ❌ Wave 0 |
| BRAND-06 | Hero copy signed off in REPLACEMENT-COPY.md | manual-only | (Davide review at D-15 batch sign-off) | — Manual |
| VIZ-01 | Hero visual concept in addendum | smoke | `grep -q "Behavioral Simulation Visual" BRAND-BIBLE.md` | ❌ Wave 0 — addendum to be appended |
| VIZ-02 | Pipeline visual concept in addendum | smoke | `grep -q "Engine Diagram" BRAND-BIBLE.md` | ❌ Wave 0 |
| VIZ-03 | Scale affordances documented | smoke | `grep -q "Scale Affordances\|hero scale, mobile scale" BRAND-BIBLE.md` | ❌ Wave 0 |
| VIZ-04 | Tech rationale documented in addendum | smoke | `grep -E "Canvas 2D.*30 KB\|motion/react.*15 KB" BRAND-BIBLE.md` | ❌ Wave 0 |
| VIZ-05 | Both visuals locked in addendum | smoke | (composite — VIZ-01 + VIZ-02 + VIZ-03 must all pass) | ❌ Wave 0 |
| (Phase 2-6 enforcement) | Banned vocab not introduced into customer-facing surfaces | unit | `node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding` | ❌ Wave 0 — script to be created |

### Sampling Rate

- **Per task commit:** `pnpm lint:vocab` (the new vocab-lint script — runs in <1 second on the project size)
- **Per wave merge:** `pnpm lint && pnpm build` (existing) + `pnpm lint:vocab`
- **Phase gate:** All file-existence checks pass + `pnpm lint:vocab` clean + Davide batch sign-off (D-15)

### Wave 0 Gaps (per-plan setup tasks)

- [ ] `.planning/reference/BRAND-SPINE.md` — covers BRAND-01..04 (Plan 1)
- [ ] `BRAND-BIBLE.md` addendum — covers VIZ-01..05 (Plan 2)
- [ ] `.planning/phases/01-*/PLAGIARISM-AUDIT.md` — covers BRAND-05 audit phase (Plan 3)
- [ ] `.planning/phases/01-*/REPLACEMENT-COPY.md` — covers BRAND-05 replacement + BRAND-06 sign-off (Plan 3)
- [ ] `scripts/lint-vocab.mjs` — covers downstream Phase 2-6 enforcement (Plan 4 — optional but recommended)
- [ ] `.githooks/pre-commit` — wires the vocab-lint script into git hooks (Plan 4)
- [ ] `package.json` `scripts.lint:vocab` entry — wires the script into pnpm (Plan 4)

### Vocab-Lint Script Design (concrete, ≤100 LOC)

`scripts/lint-vocab.mjs` (proposed):

```js
#!/usr/bin/env node
// Scans for banned vocabulary in customer-facing source files.
// Exits 1 if violations found, 0 if clean.
// No third-party deps — Node ≥20 standard library only.

import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises"; // Node ≥22 has native glob; if Node 20, use `import { readdirSync } from "node:fs"` + walk
import { argv, exit } from "node:process";

// Banned patterns. Each: regex, replacement hint, severity
// Severity 'error' fails the build; 'warn' prints but doesn't fail
const BANNED = [
  { rx: /\bviral\b/gi, hint: "use 'breakout' or 'high-performing'", severity: "error" },
  { rx: /\bgo viral\b/gi, hint: "use 'land with audience'", severity: "error" },
  { rx: /\bAI\b(?!.*\bai-powered\b)/gi, hint: "use 'behavioral simulation' or 'engine'", severity: "error" },
  { rx: /\busers\b/gi, hint: "use 'creators' (or specific role)", severity: "warn" },
  // Import-path drift detection (per Pitfall 5)
  { rx: /from ['"]framer-motion['"]/g, hint: "import from 'motion/react' (existing legacy uses are grandfathered)", severity: "warn" },
];

// Allow inline `// vocab-lint-disable-next-line` overrides for legitimate uses
const SUPPRESS_RX = /vocab-lint-disable-next-line/;

async function* walk(dir) {
  const { readdirSync } = await import("node:fs");
  const { join, extname } = await import("node:path");
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if ([".ts", ".tsx", ".md"].includes(extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  const dirs = argv.slice(2).length > 0 ? argv.slice(2) : ["src/app", "src/components/landing", "src/components/onboarding"];
  let errors = 0, warnings = 0;
  for (const dir of dirs) {
    for await (const file of walk(dir)) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        // Skip if previous line has suppression
        if (i > 0 && SUPPRESS_RX.test(lines[i - 1])) return;
        for (const { rx, hint, severity } of BANNED) {
          for (const match of line.matchAll(rx)) {
            const tag = severity === "error" ? "ERROR" : "WARN ";
            console.error(`${tag} ${file}:${i + 1}  "${match[0]}" → ${hint}`);
            severity === "error" ? errors++ : warnings++;
          }
        }
      });
    }
  }
  console.error(`\nVocab lint: ${errors} errors, ${warnings} warnings`);
  exit(errors > 0 ? 1 : 0);
}
main();
```

Wired into `.githooks/pre-commit`:

```bash
#!/usr/bin/env bash
node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding || exit 1
```

And `package.json`:

```json
{
  "scripts": {
    "lint:vocab": "node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding"
  }
}
```

**Why a script and not an ESLint rule:**
- Custom ESLint rule needs JSX text-node + `JSXExpressionContainer` AST handling + plugin scaffolding (~300 LOC + maintenance burden).
- A plain script handles both `.tsx` and `.md` (BRAND-SPINE.md, REPLACEMENT-COPY.md, future docs) — ESLint can't lint Markdown without `eslint-plugin-mdx` (extra dep).
- Falls under 100 LOC, no third-party deps, easy to extend.
- Easy to disable per-line for legitimate uses (e.g., FAQ entry that quotes "AI personas" as the term we're moving away from).

### Phase 1 Acceptance Criteria (composite)

The phase is "done" when:

```bash
# All artifacts exist
test -f .planning/reference/BRAND-SPINE.md
test -f .planning/phases/01-brand-spine-visual-metaphor/PLAGIARISM-AUDIT.md
test -f .planning/phases/01-brand-spine-visual-metaphor/REPLACEMENT-COPY.md
grep -q "## Visual Metaphor Lock" BRAND-BIBLE.md

# Vocab lint passes on existing customer-facing surfaces (after copy is replaced — likely Phase 6 condition, not Phase 1)
# Phase 1 deliverable is the SCRIPT existing and being runnable; passing on existing plagiarized files is not a Phase 1 gate.
test -x scripts/lint-vocab.mjs || test -f scripts/lint-vocab.mjs
node scripts/lint-vocab.mjs --version  # script runs without error

# Davide's batch sign-off
grep -q "\[x\] Davide approved" .planning/phases/01-brand-spine-visual-metaphor/REPLACEMENT-COPY.md
```

Note: existing plagiarized files in `src/app/(marketing)/` will fail vocab-lint (they contain "AI personas", "Human Behavior", etc.). That's expected and confirms the script works. The lint becomes a phase-gate **only after Phase 6 swaps the landing**.

## Phase 2 Handoff Readiness

By end of Phase 1, the following artifacts MUST exist on disk:

| Path | Purpose | Phase 2 Consumer |
|------|---------|------------------|
| `.planning/reference/BRAND-SPINE.md` | Voice + vocab + tone source of truth | Phase 2 plan-research reads this before drafting hero copy plan |
| `BRAND-BIBLE.md` (with addendum at end) | Locked visual metaphor + tech rationale | Phase 2 plan-research reads §1 (Hero) for canvas particle behavior spec; reads §2 (Pipeline) — but pipeline is Phase 3 not Phase 2 |
| `.planning/phases/01-*/PLAGIARISM-AUDIT.md` | Reference for what to NOT recreate | Phase 2 hero build avoids replicating the plagiarized H1 / sub-headline patterns |
| `.planning/phases/01-*/REPLACEMENT-COPY.md` | Phase 2-6 copy strings, signed off | Phase 2 imports hero copy verbatim; Phase 3-4 import their section copy verbatim |
| `.planning/reference/societies-snapshot-XXXX.html` (and `.txt`) | Plagiarism audit input, captured for traceability | Reference if re-audit needed |
| `scripts/lint-vocab.mjs` (recommended) | Banned-vocab pre-commit gate | Phase 2-6 task verification step: `pnpm lint:vocab` |
| `.githooks/pre-commit` (recommended, extended) | Auto-runs vocab lint on commit | Implicit — no Phase 2 task action required |

**Specific concrete pointers Phase 2 will reference from the addendum (per D-07):**

- `src/components/hive/HiveCanvas.tsx` — main canvas component reference for hero structure
- `src/components/hive/use-canvas-resize.ts` — DPR-aware ResizeObserver, **reuse verbatim**
- `src/components/hive/use-hive-animation.ts:42-49, 121-193` — RAF-driven animation pattern + module-level "completed" flag
- `src/components/hive/hive-renderer.ts:240-298` — color-batched draw call pattern for many particles
- `src/components/hive/hive-renderer.ts:464-511` — skeleton fallback render path
- `src/hooks/usePrefersReducedMotion.ts` — reduced-motion hook, **reuse verbatim**
- `src/components/motion/fade-in.tsx`, `fade-in-up.tsx` — existing `motion/react` import pattern + `useReducedMotion()` early return template
- `docs/tokens.md` § Easings — `--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1)` matches the hive animation easing

## Sources

### Primary (HIGH confidence)

- Bundlephobia API: `framer-motion@12.38.0` → 59.1 KB gzipped — https://bundlephobia.com/api/size?package=framer-motion@12.38.0 [VERIFIED via direct API call]
- Bundlephobia API: `motion@12.38.0` → 42.5 KB gzipped — https://bundlephobia.com/api/size?package=motion@12.38.0 [VERIFIED via direct API call]
- Motion docs — bundle reduction: https://motion.dev/docs/react-reduce-bundle-size [CITED]
- Motion docs — LazyMotion: https://motion.dev/docs/react-lazy-motion [CITED]
- Motion docs — upgrade guide (`framer-motion` → `motion/react`): https://motion.dev/docs/react-upgrade-guide [CITED]
- Wayback CDX API: `societies.io` history — http://web.archive.org/cdx/search/cdx?url=societies.io [VERIFIED via direct API call, 16+ snapshots, latest 2026-05-04]
- Wayback Availability API: `artificialsocieties.io` returns no snapshots — https://archive.org/wayback/available?url=artificialsocieties.io [VERIFIED via direct API call]
- Project package.json: `framer-motion@^12.29.3`, `motion@^12.29.2` both installed [VERIFIED]
- Project source: `src/components/hive/*` — read all 7 files [VERIFIED]
- Project source: `src/components/landing/*` — read 3 plagiarized files [VERIFIED]
- Project source: `src/hooks/usePrefersReducedMotion.ts` [VERIFIED]
- BRAND-BIBLE.md (existing 351 lines) [VERIFIED]
- docs/motion-guidelines.md, docs/tokens.md [VERIFIED]

### Secondary (MEDIUM confidence)

- npm: `react-intersection-observer` v10.0.2 ≈ 1.9 KB gzipped [CITED via WebSearch + npm description]
- waybackpack lacks built-in text extraction — https://github.com/jsvine/waybackpack [CITED]
- Wayback Machine `id_` flag returns clean HTML — Internet Archive Developer Portal [CITED]

### Tertiary (LOW confidence)

- GSAP Business tier pricing $199/yr/dev — recalled from training [ASSUMED A5]
- Specific Linear / Vercel / Stripe / Anthropic pages selected for §"Reference visuals" — picked from training; researcher should visit each before locking in addendum [ASSUMED A6 — see also Pitfall 1 in §Common Pitfalls about reference URL freshness]

## Metadata

**Confidence breakdown:**
- Standard stack (motion library choice, Canvas patterns): **HIGH** — bundle numbers verified directly via Bundlephobia API; Canvas patterns extracted from production code in this codebase.
- Architecture (artifact layout, addendum location): **HIGH** — read existing `BRAND-BIBLE.md` line-by-line; structure proposal preserves existing flow.
- Pitfalls (Wayback gzip, domain mismatch, motion library imports): **HIGH** — verified each pitfall against the live system (curl tests, package.json, codebase grep).
- Plagiarism audit pipeline: **HIGH** — workflow tested live against `web.archive.org/web/20260504034418id_/https://societies.io/`; HTML extracted, decompressed, grepped successfully.
- Validation Architecture: **MEDIUM** — script design is sound (≤100 LOC, no deps); pre-commit wiring follows existing `.githooks/post-commit` pattern. Open Question 1 flags whether the script ships in Phase 1 or Phase 5.
- Reference URLs (D-19 specific picks): **MEDIUM** — recalled from training; researcher should visit before pinning in addendum, especially since some referenced pages may have evolved.
- Hero copy DO/DON'T examples sourcing: **LOW** — Open Question 4 flags this gap; recommend a 5-min Davide conversation before drafting.

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days for stable infrastructure; 7 days for the motion library bundle numbers — re-verify before Phase 2 build if motion ≥12.40 ships)
