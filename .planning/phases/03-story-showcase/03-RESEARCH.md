# Phase 3: Story & Showcase - Research

**Researched:** 2026-06-15
**Domain:** Marketing-site content sections (Next.js 16 RSC + Tailwind v4 flat-warm), placeholder-driven product storytelling
**Confidence:** HIGH

## Summary

Phase 3 fills the scroll body between the hero and the conversion sections with three storytelling surfaces: a three-step **how-it-works**, a **"the Simulation" output showcase**, and **3–4 feature deep-dive blocks**. This is the *calm* phase — the hero already spent the milestone's one signature "wow" (and then pivoted away from even that, to a static product-shot showcase). Phase 3's job is Linear/Raycast typographic restraint and rhythm, not motion spectacle. Every product visual is a labelled `<Placeholder>` slot from the Phase-1 system, swappable later via one `src` prop with zero layout shift (Success Criterion 4).

The Phase-1/2 foundation is unusually complete for this kind of work: the `<Placeholder>` component already aspect-locks and one-prop-swaps cleanly `[VERIFIED: src/components/marketing/placeholder.tsx]`; the page skeleton already has anchored `#how-it-works` and `#the-simulation` mount points `[VERIFIED: src/app/(marketing)/page.tsx]`; the section rhythm is fixed (`border-t border-border px-6 py-20`, inner `mx-auto max-w-5xl`); the motion primitives (`FadeInUp`, `StaggerReveal`) already self-gate reduced-motion by returning plain wrappers `[VERIFIED: src/components/motion/fade-in-up.tsx, stagger-reveal.tsx]`. The hero pivot SUMMARY tells us the craft bar plainly: show the *shape* of the real product, framed in flat-warm device chrome, as swappable slots — don't invent abstract visuals.

**Primary recommendation:** Build three new RSC section components in `src/components/marketing/` (a `story/` subdir), fill the two existing stub sections in place (preserving anchor id + `border-t` + `py-20` + `max-w-5xl`), and INSERT one new `<section id="features">` between `#the-simulation` and `#pricing` for STORY-03 — plus add a "Features" nav anchor to Header + Footer. Reuse `<Placeholder>` for every product visual; reuse `FadeInUp`/`StaggerReveal` for calm entrances; add ZERO new dependencies. Use the canonical numen-rework reading IA (gauge → audience cloud + watch% → Hook · Retention · Shareability rows) to shape STORY-02's placeholder frames so they read believably without wiring any product logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| How-it-works 3-step section | Frontend Server (RSC) | Client (motion wrapper only) | Pure presentational markup; the only client need is the optional `FadeInUp`/`StaggerReveal` entrance, which is itself a `"use client"` leaf |
| "The Simulation" output showcase | Frontend Server (RSC) | Client (motion wrapper only) | Static placeholder frames depicting the product shape; no data, no engine, no client state |
| Feature deep-dive blocks | Frontend Server (RSC) | Client (motion wrapper only) | Alternating benefit-copy + `<Placeholder>` rows; presentational |
| Placeholder image/video slots | Browser (asset load) | — | Aspect-locked by CSS; real assets swap in later via `src` (FOUND-03), browser loads them |
| Section entrance animation | Client | — | `motion/react` `whileInView`; self-gates reduced-motion |
| Nav anchor targets | Frontend Server (RSC) | Browser (scroll) | Anchor `id`s are server markup; in-page scroll is native browser behavior |

**Tier sanity note for the planner:** NOTHING in Phase 3 belongs in the API/data/database tiers. There is no engine call, no Supabase read, no product logic. Any task that reaches toward `src/lib/engine/*`, `src/components/board/*`, `src/components/reading/*` (importing them), or a data hook is a scope violation — those are *shape references only* (read for IA, never imported). This mirrors the Phase-2 UI-SPEC's explicit "Do NOT import from board/viral-results/hive-demo" rule.

## Standard Stack

No new libraries. Phase 3 is built entirely from the installed, already-used kit.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router, RSC) | 16.1.5 | Section components as server components; `/` stays statically prerendered | `[VERIFIED: package.json]` Already the stack; hero + skeleton are pure RSC and Phase 3 should stay that way except motion leaves |
| React | 19.2.3 | Component model | `[VERIFIED: package.json]` |
| Tailwind v4 (`@theme` tokens) | ^4 | All styling via semantic tokens (`bg-surface`, `border-border`, `text-foreground-*`, `text-accent`) | `[VERIFIED: src/app/globals.css]` Flat-warm token SSOT already ported in Phase 1 |
| `motion/react` | ^12.29.2 | Calm scroll-entrance for sections (`FadeInUp`, `StaggerReveal`) | `[VERIFIED: package.json + src/components/motion/*]` The chosen single motion lib (Phase-1 D-16); already wrapped behind reduced-motion |
| `lucide-react` | ^0.563.0 | Step numerals/icons, feature icons (e.g. `Link2`, `Users`, `Gauge`, `TrendingDown`, `Share2`) | `[VERIFIED: package.json]` Already used by `<Placeholder>` and the rest of the UI |
| `class-variance-authority` + `cn()` | ^0.7.1 | Variant styling consistent with `ui/` + `<Placeholder>` conventions | `[VERIFIED: package.json + src/lib/utils.ts]` |

### Supporting (reuse, do not rebuild)
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `<Placeholder>` | `src/components/marketing/placeholder.tsx` | THE swappable product-visual slot (image/video/avatar/logo) | Every product visual in all three sections — STORY-01 step frames, STORY-02 output frames, STORY-03 deep-dive visuals |
| `<FadeInUp>` | `src/components/motion/fade-in-up.tsx` | Single-element scroll-reveal; self-gates reduced-motion | Section headers, individual blocks needing a calm entrance |
| `<StaggerReveal>` + `.Item` | `src/components/motion/stagger-reveal.tsx` | Orchestrated child stagger; self-gates reduced-motion | The 3 how-it-works step cards, the feature blocks list |
| `<Button variant="primary" size="lg" asChild>` | `src/components/ui/button.tsx` | Any in-section CTA (optional) | Only if a section wants a secondary "Try it free" — but CONVERT CTAs are Phase 4; keep Phase 3 CTA-light |
| `<Container>` | `src/components/layout/container.tsx` | Width constraint | Optional — the skeleton already uses `mx-auto max-w-5xl` inline; match that, don't introduce a competing measure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `FadeInUp`/`StaggerReveal` | Magic UI / Aceternity scroll components (permitted) | `[ASSUMED]` Heavier, registry-vetting overhead, and they tend to ship glow/gradient defaults that fight flat-warm. The in-repo primitives are calmer and already reduced-motion-gated. **Recommend: do NOT add** unless a specific block demonstrably needs more — and even then, vet against the no-glass/no-glow rule first. |
| Hand-built 3-step grid | shadcn `Card` (`src/components/ui/card.tsx`) | Card is available and token-driven; fine to use, but the steps read better as borderless numbered blocks (Linear restraint) than as boxed cards. Executor's call within flat-warm. |
| Custom accordion for any "learn more" | `@radix-ui/react-accordion` (installed, `ui/accordion.tsx`) | Reserved for the Phase-4 FAQ. Don't introduce accordions in Phase 3 — keep deep-dives flat and scannable. |

**Installation:** none — `npm install` of nothing. This phase adds zero dependencies. `[VERIFIED: package.json — all needed libs present]`

## Package Legitimacy Audit

> Not applicable. **Phase 3 installs no external packages.** Every component and library it uses is already present in `package.json` and already in use by Phases 1–2. slopcheck/registry verification is moot because there is nothing to install. If the planner or executor later proposes pulling a Magic UI / Aceternity / shadcn-registry block, THAT addition must run the Package Legitimacy Gate before install — but the research recommendation is to add nothing.

## Architecture Patterns

### System Architecture Diagram

```
                          src/app/(marketing)/page.tsx  (RSC, static-prerendered /)
                                        │
                    ┌───────────────────┼───────────────────────────────┐
                    │                   │                                │
          <section id="how-it-works">   <section id="the-simulation">    <section id="features">  ← NEW
            border-t · py-20              border-t · py-20                  border-t · py-20
            max-w-5xl                     max-w-5xl                         max-w-5xl
                    │                            │                              │
              <HowItWorks/>               <SimulationShowcase/>           <FeatureBlocks/>
              (RSC section)               (RSC section)                   (RSC section)
                    │                            │                              │
        ┌───────────┼───────────┐         depicts the canonical        list of 3–4 alternating
        │           │           │         reading IA as static          benefit + <Placeholder>
     Step 1      Step 2      Step 3        placeholder frames:           rows (left/right flip)
   paste link  audience    get your        ┌─ score gauge frame              │
   <Placeholder> simulates  reading        ├─ audience cloud + "{n}% watch"   each row:
   (input)     <Placeholder><Placeholder>  └─ Hook·Retention·Shareability     copy column + <Placeholder>
                                              (3 driver rows, where-they-drop)
                    │                            │                              │
                    └────────────── all visuals are <Placeholder> ─────────────┘
                                  (aspect-locked, src-swappable, no CLS)
                                              │
                              entrance: <FadeInUp>/<StaggerReveal>  (client leaves,
                                        reduced-motion self-gated)

  nav anchors (Header + Footer):  #how-it-works · #the-simulation · #features (ADD) · #pricing · #faq
```

Data flow: there is none. These are static presentational sections. The "data" they depict (a score, a curve, persona dots) is FAKE set-dressing inside placeholder frames, not a live read. The product visuals are reserved boxes the human fills with real screenshots later.

### Recommended Project Structure
```
src/components/marketing/
├── placeholder.tsx          # reuse (Phase 1)
├── motion-config.tsx        # reuse (Phase 1)
├── index.ts                 # extend — export the 3 new sections
├── hero/                    # Phase 2 (reference for craft/voice/structure)
│   └── hero.tsx
└── story/                   # NEW (Phase 3) — mirrors hero/ subdir convention (D-15)
    ├── how-it-works.tsx     # STORY-01 — 3-step section (RSC)
    ├── simulation-showcase.tsx  # STORY-02 — output showcase (RSC)
    ├── feature-blocks.tsx   # STORY-03 — 3–4 alternating deep-dives (RSC)
    ├── feature-block.tsx    # (optional) the single alternating row, consumed by feature-blocks
    └── __tests__/
        ├── how-it-works.test.tsx
        ├── simulation-showcase.test.tsx
        └── feature-blocks.test.tsx
```

Rationale: Phase 2 established `src/components/marketing/hero/` as a per-feature subdir with a colocated `__tests__/`. A `story/` subdir follows that established pattern (D-15: marketing components live under `src/components/marketing/`). Keep each section a self-contained RSC; lift the motion to small client wrappers (the existing `FadeInUp`/`StaggerReveal` are already `"use client"`).

### Pattern 1: Fill an existing stub section IN PLACE (STORY-01, STORY-02)
**What:** Replace the bare `<h2 text-foreground-muted>` placeholder heading inside an existing `<section>`, but KEEP the section wrapper exactly as-is (the anchor `id`, `border-t border-border`, `px-6 py-20`, and the inner `mx-auto max-w-5xl`).
**When to use:** `#how-it-works` and `#the-simulation` — they already exist as anchored stubs.
**Example (the exact wrapper to preserve):**
```tsx
// Source: src/app/(marketing)/page.tsx (current skeleton — preserve this shape)
<section id="how-it-works" className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-5xl">
    {/* OLD: <h2 className="text-3xl font-semibold text-foreground-muted">How it works</h2> */}
    {/* NEW: <HowItWorks /> — the section component owns its own heading + body */}
    <HowItWorks />
  </div>
</section>
```
The page edit is minimal: swap the muted stub `<h2>` for the section component. The section component renders its OWN real heading (cream `text-foreground`, not muted) plus the body. Do NOT change the section element, its id, its border, or its padding — that preserves anchor-nav, the border rhythm, and no-CLS.

### Pattern 2: INSERT a new section (STORY-03) + wire its anchor
**What:** STORY-03's feature deep-dive blocks have **no existing mount point**. Insert a new `<section id="features">` between `#the-simulation` and `#pricing`, matching the skeleton's exact wrapper, AND add a "Features" link to the Header `NAV_LINKS` and the Footer anchor mirror.
**When to use:** STORY-03 only.
**Example:**
```tsx
// Source: pattern derived from src/app/(marketing)/page.tsx section rhythm
// INSERT between <section id="the-simulation"> and <section id="pricing">:
<section id="features" className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-5xl">
    <FeatureBlocks />
  </div>
</section>
```
```tsx
// Source: src/components/layout/header.tsx NAV_LINKS (add "Features")
const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "The Simulation", href: "#the-simulation" },
  { label: "Features", href: "#features" },   // ← ADD (mirror in footer.tsx)
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];
```
**Anchor decision (planner must resolve):** 5 nav links is borderline for the mobile collapse and desktop bar. Options: (a) add "Features" as a 5th link; (b) treat features as part of "The Simulation" story and NOT add a nav anchor (the section still gets an `id` for deep-links but no nav entry). **Recommendation: add the anchor** (a) — it's a real scroll target and OpusClip/Linear both expose features in nav; verify the mobile disclosure still reads cleanly at 320px (it's a simple `useState` list, so 5 items is fine). This is a Claude's-discretion call the planner should make explicitly, not leave implicit.

### Pattern 3: Three-step how-it-works (Linear/OpusClip restraint)
**What:** Three numbered steps, equal weight, horizontal on desktop / stacked on mobile. Each step = a numeral (or lucide icon) + a short serif-or-bold title + one Inter line + a small `<Placeholder>` frame depicting that step's surface.
**When to use:** STORY-01.
**Layout:** `grid grid-cols-1 md:grid-cols-3 gap-8` inside the `max-w-5xl`. Steps read left→right: **1. Paste a TikTok link** (input — `<Placeholder variant="image">` of a paste/composer field, or `variant="video"` phone) → **2. The audience simulates** (`<Placeholder>` of the persona cloud reacting) → **3. Get your reading** (`<Placeholder>` of the gauge/score). Numerals in coral OR cream — coral is the lone accent, so use it sparingly (e.g. only the step numeral, or not at all; lean: subtle cream numerals, coral reserved for one accent). Wrap the three in `<StaggerReveal>` for a calm cascade.
**Copy note:** the steps mirror the hero subcopy and the canonical loop (LANDING-VISION §2). Use the product noun **"Simulation"** (see Landmine 1) — but STORY-01's verb is naturally "the audience **simulates**." Step 3's noun: prefer **"reading"** as a generic English word is risky (see Landmine 1) — recommend "Get your **Simulation**" or "Get your **score**" / "Get your prediction" to stay consistent with the rest of the app.

### Pattern 4: Output showcase as a framed product depiction (STORY-02)
**What:** ONE prominent flat-warm device-framed `<Placeholder>` (mirroring the hero's desktop-window chrome) showing the *shape* of a reading, optionally annotated with small labelled sub-frames or callouts for the three named outputs (audience simulation, watch-through %, Hook · Retention · Shareability). The frame depicts the canonical reading IA (see "Believable placeholder content" below) but is STILL a placeholder — no live data, no imported product component.
**When to use:** STORY-02.
**Layout option A (recommended, lowest-risk):** a single large `<Placeholder variant="image" aspect="16/10" label="Your Simulation">` in a desktop-window frame (reuse the hero's browser-chrome treatment as a small shared helper or inline), with a short caption row beneath naming the three outputs as text chips. The placeholder is the swappable screenshot of the real reading.
**Layout option B (more craft, more work):** the same big frame PLUS 2–3 smaller labelled `<Placeholder>` callout cards beside/below it ("Watch-through %", "Where viewers drop", "Shareability") — each its own aspect-locked slot. Still all placeholders. **Recommendation: A for v1**, with the three outputs named in copy; B is a nice-to-have the planner can scope as a stretch task. Either way: depict the *shape*, label it, keep it swappable.

### Pattern 5: Alternating feature deep-dive blocks (STORY-03)
**What:** 3–4 blocks, each a two-column row: a benefit headline + 1–2 sentence body on one side, a `<Placeholder>` product visual on the other, with the image/text sides FLIPPING each row (left, right, left, right). Stacks to single-column on mobile (image always below or above copy consistently).
**When to use:** STORY-03.
**Layout:** per block `grid grid-cols-1 md:grid-cols-2 gap-10 items-center`, with `md:[direction]` order swap on alternating rows (e.g. `md:order-2` on the visual for even rows). This is the OpusClip/Linear feature-deep-dive pattern `[VERIFIED: WebFetch opus.pro, linear.app — both alternate benefit-copy with product frames]`.
**Suggested 3–4 benefits (planner/executor refine the copy):** derived from the real product loop — (1) "Know before you post" (the prediction itself), (2) "See exactly where viewers drop" (retention/where-they-drop), (3) "Understand your audience" (the audience simulation / persona cloud), (4) "Fix the weakest lever" (Hook · Retention · Shareability breakdown). Each pairs with a `<Placeholder>` of that surface. Avoid the PROJECT.md-barred words "viral"/"AI" in headlines (carried from hero D-09).

### Anti-Patterns to Avoid
- **Importing real product components** (`board/*`, `reading/*`, `viral-results/*`): they drag store coupling, glow/glass, green-yellow-red tiers, and the retired aesthetic. They are *shape references read during research*, never imports. (Mirror the Phase-2 UI-SPEC's explicit ban.)
- **Wiring any data/engine/Supabase**: out of scope (REQUIREMENTS Out-of-Scope table — "Engine / app / Supabase product logic"). The showcase is a placeholder, not a live read.
- **Adding glow/glass/gradient/backdrop-blur**: flat-warm is LOCKED (D-06). Depth = tone-step + hairline 6% borders + `--shadow-float` only. No `--shadow-glow-*`, no `linear-gradient` glass, no `#FF7F50`.
- **Hardcoding hex**: reference semantic tokens (`text-accent`, `bg-surface`, `border-border`, `text-foreground-muted`). The lone accent is coral and it's precious — don't sprinkle it.
- **Heavy motion**: this is the calm phase. No parallax, no scroll-jacking, no autoplay video, no continuous loops. `FadeInUp`/`StaggerReveal` on entrance is the ceiling.
- **Changing the existing section wrappers' id / border / padding**: breaks anchor-nav and the border rhythm. Fill in place; only ADD the one new `#features` section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swappable, aspect-locked product visual | A bespoke image box with manual aspect math | `<Placeholder>` | `[VERIFIED]` Already solves no-CLS (inline `aspect-ratio`), the one-prop `src` swap, the flat-warm chip look, the per-variant icon, and reduced-motion-gated breathe. Rebuilding it would diverge from FOUND-03 and break Success Criterion 4. |
| Scroll-entrance reveal | Hand-rolled `IntersectionObserver` + reduced-motion check | `<FadeInUp>` / `<StaggerReveal>` | `[VERIFIED]` Already `whileInView` + `once` + `useReducedMotion()` self-gate (returns a plain wrapper under reduce). Re-implementing risks an ungated animation that violates FOUND-04. |
| Reduced-motion gating | Custom `prefers-reduced-motion` media listener per section | The motion primitives' built-in gate + global `<MotionConfig reducedMotion="user">` | `[VERIFIED: motion-config.tsx wraps the page]` The two-layer contract already covers Framer + CSS. New sections inherit it for free. |
| In-page anchor scrolling | Custom smooth-scroll JS | Native `<a href="#features">` + the existing anchor `id` pattern | `[VERIFIED: header.tsx/footer.tsx use plain anchor links]` Native, accessible, no JS, matches the existing nav. |
| Width constraint / section rhythm | New max-width + padding values | The skeleton's `mx-auto max-w-5xl` + `border-t border-border px-6 py-20` | `[VERIFIED: page.tsx]` Consistency = no drift. Introducing a new measure would break the visual rhythm Phases 1–2 set. |
| Score-gauge / retention-curve visual (for the showcase) | A real animated gauge or chart | A `<Placeholder>` (static frame) | The showcase advertises the product; it must NOT *be* the product. A real gauge implies a live read (dishonest + out of scope). Placeholder + label is the honest, swappable choice. |

**Key insight:** Phase 3 is almost entirely *composition of an existing kit*. The risk here is NOT "can we build it" — it's "do we stay disciplined": flat-warm tokens only, placeholders not real components, calm motion, and the exact existing section rhythm. Custom-building anything in the table above would be a regression against Phase-1/2 contracts.

## Runtime State Inventory

> Not a rename/refactor/migration phase. This section is included only to discharge the checklist explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 3 reads/writes no datastore (verified: no engine/Supabase imports in scope) | none |
| Live service config | None — no external services touched | none |
| OS-registered state | None | none |
| Secrets/env vars | None — sections are static; CTA URLs already centralized in `src/lib/routes.ts` (Phase 1) | none |
| Build artifacts | New components + tests only; no package/artifact renames. The barrel `src/components/marketing/index.ts` gains exports (code edit, not an artifact migration) | extend barrel |

**Nothing found in any category — verified by:** Phase 3 is additive presentational markup. No data, no services, no OS state, no secrets, no artifact renames. The only "state" is the page's section list and the nav anchor list, both edited in source.

## Common Pitfalls

### Pitfall 1: Product-noun drift ("the reading" vs "The Simulation")
**What goes wrong:** ROADMAP/REQUIREMENTS say `"the reading"` showcase (STORY-02), but the live skeleton section is `id="the-simulation"` titled **"The Simulation"** `[VERIFIED: page.tsx, header.tsx, footer.tsx]`, locked by Phase-1 **D-23** (Davide vetoed "Reading"; numen-rework D-09 aligned). If the planner ships copy saying "the reading," the landing contradicts its own nav and the rest of the app.
**Why it happens:** The requirement text predates D-23; the requirement IDs were written before the Simulation rename was locked.
**How to avoid:** **CANONICAL NOUN = "Simulation"** (capitalized as a product noun) for all user-facing Phase-3 copy, section headings, and nav. The STORY-02 section heading is **"The Simulation"** (already the stub). Use "simulates"/"simulation" as the mechanism verb. Internally, REQUIREMENTS may still say "the reading" — that's fine; it's the same thing — but NO user-facing string says "reading." (Generic phrases like "your prediction"/"your score" are also safe.)
**Warning signs:** any rendered string containing "reading" as the product noun; a section `<h2>` that doesn't match the `#the-simulation` anchor's "The Simulation" title.

### Pitfall 2: STORY-03 has no mount point (skeleton edit, not a fill)
**What goes wrong:** The skeleton has hero / how-it-works / the-simulation / pricing / faq — but **no section for feature deep-dives** `[VERIFIED: page.tsx — only those 5 sections]`. A planner who treats all of Phase 3 as "fill stubs" will have nowhere to put STORY-03.
**Why it happens:** The Phase-1 skeleton was built to the Phase-1/2/4 sections; the deep-dives weren't given a stub.
**How to avoid:** STORY-03 requires a **skeleton edit** — INSERT `<section id="features">` between `#the-simulation` and `#pricing` (Pattern 2), AND update Header `NAV_LINKS` + Footer anchors with a "Features" link. Treat this as its own task with its own verification (the new anchor scrolls; nav still collapses cleanly on mobile). Do NOT fold it silently into another section.
**Warning signs:** a plan with only two `page.tsx`-touching tasks; a FeatureBlocks component built but never mounted; a "Features" nav link with no target.

### Pitfall 3: Layout drift from the established section pattern
**What goes wrong:** A new section that uses different padding (`py-24`), a different measure (`max-w-7xl`), or omits `border-t border-border` will break the visual rhythm Phases 1–2 set and may introduce CLS.
**Why it happens:** Not reading the exact existing wrapper before writing new markup.
**How to avoid:** Every Phase-3 section wrapper is **exactly** `<section id="..." className="border-t border-border px-6 py-20">` with inner `<div className="mx-auto max-w-5xl">` `[VERIFIED: page.tsx — all 5 sections follow this]`. The hero is the one exception (`py-16 md:py-20`, no border-t, because it's first) — do NOT copy the hero's wrapper for body sections; copy the how-it-works/pricing wrapper.
**Warning signs:** any `max-w-*` other than `max-w-5xl`; any `py-*` other than `py-20` on a body section; a missing `border-t`.

### Pitfall 4: Unbelievable placeholder content (wrong product shape)
**What goes wrong:** The Simulation showcase depicts a generic dashboard or invents outputs Numen doesn't have, so the labelled frames read as filler rather than "this is the real product, screenshot pending."
**Why it happens:** Not knowing the real reading's IA.
**How to avoid:** Shape the STORY-02 placeholder frame(s) to the **canonical numen-rework reading IA** `[VERIFIED: ~/virtuna-numen-rework/src/components/reading/reading.tsx]`:
  1. **thumbnail** of the analyzed video,
  2. a **score gauge** (270° stroked arc + number + band word "Strong/Mid/Weak"; ≥70 = green/strong) `[VERIFIED: reading/score-gauge.tsx]`,
  3. an **audience persona cloud** (dot-cloud, one dot per persona, worst cluster coral) **+ a "{n}% watch-through" caption rendered beside it** `[VERIFIED: reading/persona-cloud.tsx + reading.tsx watch%-hero-owned note]`,
  4. **three driver rows — Hook · Retention · Shareability** (fixed order, neutral bars, Retention shows the **drop timestamp / where-they-drop**) `[VERIFIED: reading/driver-rows.tsx]`,
  5. (then Fix First / Deeper read — optional to depict).
The named outputs STORY-02 must surface (per the requirement) — **audience simulation, watch-through %, Hook · Retention (where viewers drop) · Shareability** — map exactly to items 3 and 4. Depict that shape inside `<Placeholder>` frames + labels; do NOT import or wire any of it. **Honesty floor:** if a score number is shown in the placeholder set-dressing, keep it ≥70 so a "will pop" framing is truthful (BAND_THRESHOLDS.STRONG = 70 `[VERIFIED: verdict-constants.ts]`) — mirrors the Phase-2 score-honesty constraint.
**Warning signs:** invented metrics (e.g. "engagement rate," "follower forecast") not in the real loop; a showcase that doesn't name watch-through % / Hook / Retention / Shareability.

### Pitfall 5: Sections shipped as client components unnecessarily
**What goes wrong:** Marking a whole section `"use client"` (e.g. to use a motion wrapper) de-opts `/` from static prerender and bloats the client bundle.
**Why it happens:** Putting the motion at the section root instead of as a leaf.
**How to avoid:** Keep each section a **pure RSC**; place the `"use client"` motion only as a leaf wrapper (`<FadeInUp>`/`<StaggerReveal>` are already client). The section file itself has no `"use client"` directive. `[VERIFIED: hero.tsx is a pure RSC and `/` stays `○` static — 02-02-SUMMARY]` Match that.
**Warning signs:** `"use client"` at the top of `how-it-works.tsx` / `simulation-showcase.tsx` / `feature-blocks.tsx`; the build route table showing `/` as `ƒ` (dynamic) instead of `○` (static).

### Pitfall 6: Mobile-sane vs Phase-5 hardening confusion
**What goes wrong:** A planner either over-invests (running a full 320px→desktop a11y/perf audit now — that's Phase 5) or under-invests (building desktop-only sections that break on mobile).
**Why it happens:** The scope fence between "build mobile-sane" (Phase 3) and "formal hardening pass" (Phase 5) is subtle.
**How to avoid:** Phase 3 sections must **stack and read at mobile widths** (use `grid-cols-1 md:grid-cols-N`, no fixed pixel widths that overflow 320px) — but the formal Lighthouse-≥90 / WCAG-AA-contrast / focus-state audit is Phase 5 (FOUND-05/06/07). Build responsively by construction; don't run the audit. (The hero already deferred its responsive restack to Phase 5 — `[VERIFIED: 02-02-SUMMARY]` — so some desktop-tuning is acceptable, but the new body sections are simpler grids and should just be responsive from the start.)
**Warning signs:** a Phase-3 task titled "accessibility audit" or "Lighthouse pass" (that's Phase 5); a section with `w-[800px]` or absolute positioning that can't stack.

## Code Examples

### Section component shape (RSC + reused motion leaf)
```tsx
// Source: pattern derived from src/components/marketing/hero/hero.tsx (pure RSC)
//         + src/components/motion/stagger-reveal.tsx (client, reduced-motion-gated)
// src/components/marketing/story/how-it-works.tsx  — NO "use client" here.
import { StaggerReveal } from "@/components/motion/stagger-reveal";
import { Placeholder } from "@/components/marketing/placeholder";

const STEPS = [
  { n: 1, title: "Paste a TikTok link", body: "Drop any TikTok URL — no upload, no waiting.", slot: { variant: "image", aspect: "16/10", label: "Paste a link" } },
  { n: 2, title: "The audience simulates", body: "A synthetic audience reacts to your video, frame by frame.", slot: { variant: "image", aspect: "16/10", label: "Audience simulating" } },
  { n: 3, title: "Get your Simulation", body: "A score, watch-through %, and where viewers drop — before you post.", slot: { variant: "image", aspect: "16/10", label: "Your Simulation" } },
] as const;

export function HowItWorks() {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
        How it works
      </h2>
      <StaggerReveal className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((s) => (
          <StaggerReveal.Item key={s.n} className="flex flex-col gap-4">
            <span className="font-mono text-sm text-foreground-muted">0{s.n}</span>
            <Placeholder {...s.slot} />
            <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="text-base text-foreground-secondary">{s.body}</p>
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>
    </div>
  );
}
```
Notes: pure RSC file; `StaggerReveal` (the only client leaf) self-gates reduced-motion; all colors are semantic tokens; coral is NOT used here (kept precious). Serif on the `<h2>` is the calm "voice" echo — but NOTE Phase-1 D-05 reserves serif for *voice moments*; section headings using serif is a planner/executor judgment call (the skeleton stubs used `font-semibold` sans for `<h2>`s). **Recommendation: match the skeleton — sans `font-semibold` headings** unless a section heading is genuinely a voice line; reserve serif for the hero. (Flag for the discuss/UI-spec step.)

### Alternating feature block (the flip)
```tsx
// Source: pattern derived from OpusClip/Linear feature deep-dives [VERIFIED: WebFetch]
// src/components/marketing/story/feature-block.tsx
import { cn } from "@/lib/utils";
import { Placeholder } from "@/components/marketing/placeholder";

interface FeatureBlockProps {
  title: string;
  body: string;
  flip?: boolean; // reverse columns on desktop for the alternating rhythm
}

export function FeatureBlock({ title, body, flip }: FeatureBlockProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
      <div className={cn(flip && "md:order-2")}>
        <h3 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h3>
        <p className="mt-4 text-base text-foreground-secondary md:text-lg">{body}</p>
      </div>
      <Placeholder variant="image" aspect="16/10" label={title} className={cn(flip && "md:order-1")} />
    </div>
  );
}
```

### The one-prop swap (why the slots are future-proof)
```tsx
// Source: src/components/marketing/placeholder.tsx [VERIFIED]
// Today (no asset): labelled, aspect-locked stand-in, no CLS.
<Placeholder variant="image" aspect="16/10" label="Your Simulation" />
// Later (human drops a screenshot): identical reserved box, real <img>, zero layout shift.
<Placeholder variant="image" aspect="16/10" label="Your Simulation" src="/simulation.png" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hero signature = animated "crowd → score" canvas | Hero = static product-shot showcase (device chrome + swappable slots) | Phase 2, 2026-06-15 | `[VERIFIED: 02-02-SUMMARY]` Sets the Phase-3 craft bar: **show the product's shape, framed, as swappable slots** — NOT abstract effects. Phase 3 should echo this device-framed, placeholder-driven approach for the Simulation showcase. |
| Product noun "Reading" | Product noun **"Simulation"** | Phase 1 D-23, 2026-06-14 | `[VERIFIED: 01-CONTEXT]` All user-facing copy uses "Simulation." |
| Old Raycast brand (#FF7F50, #07080a, glass/glow) | Flat-warm (charcoal #262624, cream #ece7de, terracotta coral #d97757, Inter + Newsreader, flat-matte) | Phase 1 D-01..D-08 | `[VERIFIED: globals.css]` No glass/glow anywhere in Phase 3. |

**Deprecated/outdated for this phase:**
- `BRAND-BIBLE.md` (repo root + numen-rework) — STALE (documents old Raycast glass). SSOT is `globals.css` + `01-CONTEXT.md`.
- The old `src/components/landing/*` societies-clone sections — deleted in Phase 1; do not reference.
- CLAUDE.md's "Next.js 15" — actual stack is Next.js 16.1.5 `[VERIFIED: package.json]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A "Features" nav anchor SHOULD be added (vs. giving the section an id but no nav entry) | Pattern 2 | Low — both are valid; the planner/discuss step should confirm. 5 nav links may feel slightly long; if Davide prefers 4, drop the nav link but keep the `#features` id. |
| A2 | Layout option A (one big framed showcase + named outputs in copy) is the right v1 scope for STORY-02 vs option B (big frame + callout sub-cards) | Pattern 4 | Low — A is the safe minimum that satisfies the requirement; B is a craft stretch. Discuss/UI-spec should pick. |
| A3 | Section `<h2>` headings should be sans `font-semibold` (matching the skeleton stubs), NOT serif | Code example note | Low-Medium — serif is reserved for voice moments (D-05). Using serif on section headings is a taste call; recommend sans to keep serif precious, but the UI-spec step should rule. |
| A4 | Recommended 3–4 feature benefits (predict / where-they-drop / audience / weakest-lever) are the right cut | Pattern 5 | Low — these map to the real loop; exact copy + which 3–4 is planner/executor + human's call. |
| A5 | Magic UI / Aceternity should NOT be pulled in for Phase 3 | Alternatives / Don't Hand-Roll | Low — they're permitted but tend to fight flat-warm; if the human wants more motion craft on a specific block, that's a deliberate add with registry vetting. |
| A6 | Coral should be used sparingly-to-not-at-all in these sections (kept precious for CTAs/accents) | Patterns 3/5 | Low — flat-warm "lone accent" rule; a single coral accent per section is acceptable, but blanket coral would cheapen it. UI-spec should set the exact allowlist (as Phase 2 did). |

**Note:** All assumptions are low-risk taste/scope calls suited to the discuss-phase / UI-spec step, NOT factual unknowns. The factual claims (token values, component APIs, section rhythm, canonical reading IA, product noun) are all `[VERIFIED]` against the codebase.

## Open Questions

1. **Serif vs sans for section headings**
   - What we know: D-05 reserves Newsreader serif for "voice moments"; the hero H1 is the reserved slot; the skeleton stubs used sans `font-semibold` `<h2>`s.
   - What's unclear: whether STORY section headings count as "voice moments" worthy of serif, or should stay sans to keep serif precious.
   - Recommendation: default to sans `font-semibold` (consistency with skeleton + keeps serif special); let the UI-spec/discuss step override if Davide wants serif section heads.

2. **Features nav anchor — add or not (4 vs 5 links)**
   - What we know: Header/Footer currently carry 4 anchors; STORY-03 needs a section.
   - What's unclear: whether to surface it in nav.
   - Recommendation: add "Features" (5 links); verify mobile collapse reads cleanly. Cheap to revert.

3. **STORY-02 showcase depth — single frame (A) vs frame + callout cards (B)**
   - What we know: the requirement names three outputs to surface.
   - What's unclear: whether they're surfaced as copy chips beside one big frame, or as their own labelled sub-placeholders.
   - Recommendation: A for v1 (one big `<Placeholder>` + named outputs in copy), B as a planner-scoped stretch.

## Environment Availability

> Phase 3 has no external runtime dependencies (no engine, services, DBs, or new tools). It is pure code/markup using the already-installed stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js / React / Tailwind v4 | All sections | ✓ | 16.1.5 / 19.2.3 / ^4 | — |
| `motion/react` | Entrance animation | ✓ | ^12.29.2 | CSS-only (but the primitives already self-gate) |
| `lucide-react` | Icons/numerals | ✓ | ^0.563.0 | — |
| Vitest + Testing Library + happy-dom | Section tests | ✓ | ^4.0.18 / ^16.3.2 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — everything is installed.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` `[VERIFIED]` — this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (default env `node`; component files opt into `happy-dom` via `/** @vitest-environment happy-dom */` pragma) |
| Quick run command | `npx vitest run src/components/marketing/story/` |
| Full suite command | `npm test` (`vitest run` — full suite ~1949 green as of Phase 2 `[VERIFIED: 02-02-SUMMARY]`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORY-01 | How-it-works renders exactly 3 steps, in order, each with a `<Placeholder>` slot | unit | `npx vitest run src/components/marketing/story/__tests__/how-it-works.test.tsx` | ❌ Wave 0 |
| STORY-01 | Step copy uses "Simulation"/"simulates", never "reading" as the product noun | unit (string assertion) | same file | ❌ Wave 0 |
| STORY-02 | Simulation showcase names all required outputs (audience simulation, watch-through %, Hook, Retention, Shareability) and uses `<Placeholder>` for the product visual | unit | `npx vitest run src/components/marketing/story/__tests__/simulation-showcase.test.tsx` | ❌ Wave 0 |
| STORY-02 | Section heading reads "The Simulation" (matches `#the-simulation` anchor) | unit | same file | ❌ Wave 0 |
| STORY-03 | FeatureBlocks renders 3–4 blocks, each pairing a benefit headline with a `<Placeholder>` | unit | `npx vitest run src/components/marketing/story/__tests__/feature-blocks.test.tsx` | ❌ Wave 0 |
| STORY-03 | Blocks alternate column order (flip prop applied to alternating rows) | unit | same file | ❌ Wave 0 |
| Success Crit 4 | Every product visual is a `<Placeholder>` with an `aspect` (no-CLS) and a `label` | unit | per-section tests assert `data-variant` present + inline `aspect-ratio` set | ❌ Wave 0 |
| Cross | New `#features` section is mounted in `page.tsx` and "Features" anchor exists in Header + Footer | unit | `npx vitest run` on a page/header/footer test (extend existing if present) OR a new `page.test.tsx` | ❌ Wave 0 (verify if a page/header test already exists) |
| Cross | `/` stays statically prerendered (no `"use client"` leaked to section roots) | build assertion | `npm run build` → route table shows `○ /` | n/a (build gate) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/marketing/story/` (the new section tests — fast, scoped)
- **Per wave merge:** `npm test` (full suite green) + `npm run build` (exit 0, `○ /` static)
- **Phase gate:** full suite green + clean build before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/marketing/story/__tests__/how-it-works.test.tsx` — covers STORY-01 (3 steps, order, placeholder slots, noun discipline)
- [ ] `src/components/marketing/story/__tests__/simulation-showcase.test.tsx` — covers STORY-02 (named outputs, "The Simulation" heading, placeholder visual)
- [ ] `src/components/marketing/story/__tests__/feature-blocks.test.tsx` — covers STORY-03 (3–4 blocks, alternating flip, benefit+placeholder pairing)
- [ ] Anchor/mount coverage — assert `#features` section + "Features" nav link. Check whether a `page.test.tsx` / `header.test.tsx` already exists to extend; if not, a small new test. *(Verify during Wave 0 — there may already be a header test gating `NAV_LINKS`.)*
- [ ] Framework install: none — Vitest + Testing Library + happy-dom already present and used by `placeholder.test.tsx` and `hero.test.tsx`.

*All section tests use the `/** @vitest-environment happy-dom */` pragma (mirror `placeholder.test.tsx` line 1).*

## Security Domain

> `security_enforcement` is not explicitly `false` in config (the config has no `security_enforcement` key; treat as enabled per the absent=enabled rule). Phase 3 is a static marketing surface with no inputs, no data, no auth, no network — so the applicable surface is minimal but discharged below.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in scope; CTA links to `/signup` (existing app handles auth) |
| V3 Session Management | no | No sessions; static page |
| V4 Access Control | no | Public marketing page; no protected resources |
| V5 Input Validation | no | **No user input at all** — sections are static; `<Placeholder src>` is a build-time developer path, never end-user input `[VERIFIED: placeholder.tsx doc comment "never end-user input"]` |
| V6 Cryptography | no | No crypto, no secrets, no PII |
| V12/V14 (files/config) | minimal | New static components only; no file uploads, no dynamic config |

### Known Threat Patterns for {Next.js RSC marketing page}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via injected content | Tampering | N/A — no user input rendered; all copy is static literals. Never `dangerouslySetInnerHTML`. |
| Open redirect via anchors | Tampering | N/A — in-page `#anchor` links only; the one external CTA target (`SIGNUP_URL`) is a centralized internal constant `[VERIFIED: src/lib/routes.ts]` (and Phase 1 already fixed an OAuth open-redirect elsewhere — not in this surface). |
| Supply-chain (new dep) | Tampering | **Phase 3 adds NO dependencies** — supply-chain surface is zero. If a registry component is later proposed, run the Package Legitimacy Gate first. |
| Secret leakage | Info disclosure | N/A — no secrets touched; sections are static. |

**Net:** Phase 3's security surface is effectively nil (static, input-free, dependency-free). The single standing rule: never render user input, never add `dangerouslySetInnerHTML`, keep external links to centralized constants. No security tasks required beyond not regressing these.

## Sources

### Primary (HIGH confidence)
- `src/components/marketing/placeholder.tsx` + `__tests__/placeholder.test.tsx` — the `<Placeholder>` API (variants, `src` swap, `aspect` lock, `label`, `breathe` gate), no-CLS mechanism
- `src/components/marketing/hero/hero.tsx` + `02-02-SUMMARY.md` — the craft bar: device-framed product-shot showcase, swappable slots, pure RSC, the canvas pivot
- `src/app/(marketing)/page.tsx` — the scroll skeleton, exact section rhythm (`border-t border-border px-6 py-20`, `mx-auto max-w-5xl`), existing anchors, MotionConfigShell wiring
- `src/components/layout/header.tsx` + `footer.tsx` — `NAV_LINKS` (the 4 current anchors, "The Simulation" noun)
- `src/components/motion/fade-in-up.tsx` + `stagger-reveal.tsx` — reduced-motion self-gating motion primitives
- `src/app/globals.css` — flat-warm `@theme` token SSOT (charcoal/cream/coral, no glass/glow, shadow/radius scales)
- `.planning/phases/01-foundation-shell/01-CONTEXT.md` — D-23 ("Simulation"), D-12..D-15 (Placeholder), D-16/17 (motion), D-06 (flat-matte)
- `.planning/phases/02-hero-signature-moment/02-UI-SPEC.md` + `02-CONTEXT.md` — craft/voice/token discipline, "do NOT import board/reading/viral-results"
- `~/virtuna-numen-rework/src/components/reading/{reading,score-gauge,driver-rows,persona-cloud}.tsx` — the canonical reading IA (shape reference for believable STORY-02 placeholders)
- `~/virtuna-numen-rework/src/components/board/verdict/verdict-constants.ts` — BAND_THRESHOLDS.STRONG = 70 (score-honesty floor)
- `package.json` + `vitest.config.ts` — installed stack, test framework, Next 16.1.5 reality
- `.planning/{REQUIREMENTS,ROADMAP,STATE,LANDING-VISION}.md` — phase requirements, success criteria, scope fences, references

### Secondary (MEDIUM confidence)
- WebFetch `opus.pro` — OpusClip feature-deep-dive structure (alternating image-text blocks, output/social-proof showcase) — verified against LANDING-VISION §4's stated reference intent
- WebFetch `linear.app` — Linear feature-section rhythm (alternating text/product-frame, typographic restraint, generous whitespace, contained product chrome)

### Tertiary (LOW confidence)
- None. All claims trace to the codebase or the two reference-site fetches above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified present in `package.json`; nothing new added
- Architecture / patterns: HIGH — section rhythm, Placeholder API, motion gating, and the canonical reading IA all verified in-repo; layout patterns cross-checked against the two named reference sites
- Pitfalls: HIGH — all five landmines confirmed against live code (noun drift, missing mount point, section rhythm, reading-shape, RSC discipline)
- Taste/scope calls (serif headings, nav-link count, showcase depth, coral allowlist): MEDIUM — correctly deferred to the discuss/UI-spec step as Assumptions A1–A6

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable — no fast-moving external deps; the only drift risk is further Phase-2-style pivots or a numen-rework reading-IA change, both internal and visible in-repo)
