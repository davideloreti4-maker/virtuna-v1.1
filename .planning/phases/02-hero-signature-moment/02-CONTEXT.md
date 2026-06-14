# Phase 2: Hero & Signature Moment - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **hero** of the single-scroll landing: a hybrid-voice serif headline +
"Try it free" CTA, anchored by the signature **"crowd → score"** moment — a synthetic
audience reacts to a video and resolves into a virality score — plus a static composed
fallback so it never blocks first paint or breaks accessibility. Replaces the Phase-1
`<section id="hero">` stub in `src/app/(marketing)/page.tsx`. Marketing surface only;
the reacted-to video is a labelled placeholder, not a live engine call.

Requirements: HERO-01, HERO-02, HERO-03, HERO-04 (4).

**Coverage map:** HERO-01 → headline+subcopy (D-09..D-11); HERO-02 → CTA→`SIGNUP_URL`
(carried from Phase 1, essentially wired — D-12); HERO-03 → signature mechanic +
composition + motion (D-01..D-08, D-13..D-14); HERO-04 → static fallback + lazy-load
(D-15..D-16).

**This is the keystone, highest-craft, highest-risk phase of the milestone** — it got
its own phase deliberately (ROADMAP). Bar = one sandcastles-grade signature moment at
Linear/Raycast craft, inside the flat-warm Claude-calm system. Refined > flashy.
</domain>

<decisions>
## Implementation Decisions

All decisions below were taken by the human (Davide) during discussion — every one is
an accepted recommendation, not an inference.

### Signature mechanic — "crowd → score" (HERO-03)
- **D-01 (crowd unit = particle/dot field):** The synthetic audience is a **flocking field
  of hundreds of soft particles** (each dot = one viewer) in charcoal/cream. NOT avatar
  faces, NOT a persona node-cloud. Abstract over literal — scales to a believable crowd,
  stays flat-warm/refined, renders smoothly on the installed canvas/R3F stack.
- **D-02 (coral = reaction accent only):** Terracotta coral `#d97757` appears **only** as
  the reaction accent on the particles (pulse/shift as they "react"); base field is neutral
  charcoal/cream. Preserves the lone-accent flat-warm rule.
- **D-03 (resolve = coalesce into the score):** The climax is **one continuous motion** —
  the crowd flows inward and **coalesces into / hands off to** the score. Not a separate
  gauge filling beside a static crowd, not a sentiment-sort. The crowd and the number are
  the same gesture (the "wow").
- **D-04 (score form = arc ring + number):** The resolved score settles as an **arc/ring
  gauge with the number in its center** — mirrors the real product's arc-gauge instrument
  (numen-rework), gives the coalescing particles a natural home to land in, reads as "an
  instrument."
- **D-05 (source video = placeholder phone frame):** A labelled **`<Placeholder variant="video">`
  TikTok phone frame** sits in-scene; the crowd reacts to it. Makes the story legible
  (your video → crowd → score), reuses the Phase-1 slot the human swaps later, matches
  OpusClip's "paste a link → magic."

### Hero composition (HERO-01/03)
- **D-06 (centered stack):** Headline → subcopy → "Try it free" CTA → **large centered
  signature stage** below. NOT split (would choke the particle field to half-width + make
  copy compete with motion), NOT a full-bleed particle backdrop (legibility + fights the
  calm). The serif headline gets the top-center spotlight; the moment gets full width to
  flow + coalesce; cleanest mobile (everything stacks, headline first).
- **D-07 (contained stage / bordered scene):** The moment lives in a **flat-warm stage** —
  hairline 6% border, 12px radius, tone-step surface — giving the particles a defined arena
  to coalesce within. NOT edge-to-edge bleed, NOT freeform-floating.
- **D-08 (moment shares the fold):** Headline + subcopy + CTA + the signature stage all
  compose **within the first viewport** on desktop (stacks tall on mobile, headline first).
  The wow is immediate — payoff is not deferred below the fold.

### Headline & voice (HERO-01)
- **D-09 (headline copy = the locked positioning):** H1 = **"Know if it'll pop before you
  post"** — benefit-first, creator-punchy, already the page `<title>`/meta (consistency).
  Steers around the PROJECT.md-barred words "viral"/"AI" in the H1.
- **D-10 (type split = full serif H1 + Inter subcopy):** The **entire headline in Newsreader
  serif** (the voice moment reserved by Phase 1 D-05), **subcopy in Inter**. That serif/sans
  contrast *is* the hybrid voice. (Not partial-phrase serif, not all-serif.)
- **D-11 (subcopy = tight mechanism line):** One concise Inter line naming the how + the real
  outputs — audience simulates → **watch-through %, Hook, Retention, Shareability, and a
  virality score**. Clarifies the product and sets up the Phase-3 showcase. Exact wording is
  planner/executor's within this intent. Use the product noun **"Simulation"** (carried D-23).
- **D-12 (CTA area = primary + soft scroll cue):** Dominant **"Try it free"** button →
  `SIGNUP_URL` (HERO-02), plus a subtle secondary **"See how it works ↓"** link/ghost that
  scrolls to the Phase-3 `#how-it-works` section. Aids the single-scroll without competing
  with the primary CTA. (Not reassurance microcopy — pricing is a Phase-4 placeholder.)

### Motion & still fallback (HERO-03/04)
- **D-13 (trigger = autoplay once → rest, replayable):** Plays **once** when the hero mounts,
  settles on the resolved score, and stays — with a **subtle replay on hover/click**. No
  continuous loop competing with the copy/CTA. Calm, "earned" motion.
- **D-14 (at rest = subtle ambient drift):** After resolving, the settled field keeps a
  **very slow, low-amplitude drift/shimmer**; the score stays fixed. Reads as a live
  instrument while staying calm. MUST be cheap (GPU-friendly) and **reduced-motion-gated →
  frozen**.
- **D-15 (fallback = resolved end-state):** The HERO-04 static frame is the **resolved
  end-state** — phone + settled particle field + arc ring + final score. Reduced-motion and
  pre-hydration visitors get the full payoff immediately, zero motion. **Rest state == fallback
  == resolved frame** (one composed still serves all three).
- **D-16 (load = still first → lazy-hydrate the animation):** SSR / first paint renders the
  composed still (no layout shift, no blocking); the client then **lazily mounts** the animated
  canvas/R3F (`dynamic(..., { ssr: false })`) and plays once. Directly satisfies HERO-04 +
  the Phase-5 perf bar (FOUND-06). The page stays an RSC; the moment is a client island.

### Claude's Discretion
Deferred to the researcher (feasibility/perf) and planner/executor (within the flat-warm,
calm-motion taste bar) — these are technical / art-direction, not visionary calls:
- **Build approach** — custom **canvas-2D** vs **R3F/three** (both installed) vs pulling a
  particle lib (tsparticles / Magic UI / cobe — none installed). *Lean:* custom canvas-2D for
  lightest bundle + full art-direction control + easiest flat-warm tuning; R3F only if a 3D
  depth coalesce is wanted. **Avoid heavy generic particle libs that fight the calm.**
  Researcher validates perf budget, particle count ceiling, bundle cost, and the SSR-still /
  client-hydrate split before the planner commits.
- **Particle count / density, palette steps, easing + timing of the coalesce** — executor,
  within "calm + refined; coral only as the reaction accent."
- **Mobile sim behavior** — run a **reduced-density** field vs default to the **resolved still**
  on small screens to hold the perf bar (FOUND-06). Researcher/planner decide on perf grounds;
  *lean:* lighter-or-still on mobile.
- **Phone-frame content** — static poster vs looping muted placeholder video (`<Placeholder
  variant="video">` either way); planner.
- **Exact score value** — a strong "will pop" number (e.g. high-80s), coral; planner/executor.
- **Exact subcopy + scroll-cue wording, any ring tick/label microcopy** — planner/executor
  within D-11/D-12 intent.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-1 foundation this builds on (highest priority — already in this worktree)
- `.planning/phases/01-foundation-shell/01-CONTEXT.md` — the flat-warm decision record
  (D-01..D-23): charcoal/cream/terracotta tokens, **serif-for-voice-only** (D-05, the hero
  headline is the reserved voice moment), `<Placeholder>` API (D-12/13), motion foundation +
  global reduced-motion (D-16/17), product noun **"Simulation"** (D-23), CTA → `SIGNUP_URL`
  (D-20). This is the authoritative "why" for everything Phase 2 inherits.
- `src/app/(marketing)/page.tsx` — the RSC scroll skeleton; replace the `<section id="hero">`
  stub. `#how-it-works` is the scroll-cue target (D-12).
- `src/components/marketing/placeholder.tsx` — `<Placeholder>` slot; `variant="video"` = the
  phone frame (D-05).
- `src/components/marketing/motion-config.tsx` — `MotionConfigShell` (`<MotionConfig
  reducedMotion="user">`) already wraps the page; reduced-motion is global.
- `src/lib/routes.ts` — `SIGNUP_URL` (the "Try it free" target — HERO-02).

### Design-system SSOT (carried from Phase 1 — different worktree, read-only reference)
- `~/virtuna-numen-rework/src/app/globals.css` — flat-warm `@theme` token SSOT (already ported
  into this worktree's `globals.css` in Phase 1; reference for exact hex/coral values).
- ⚠ `~/virtuna-numen-rework/BRAND-BIBLE.md` and repo-root `BRAND-BIBLE.md` are **STALE** (old
  Raycast glass). Do NOT use for visual direction — `globals.css` + `01-CONTEXT.md` are the SSOT.

### Milestone source of truth (landing-v2)
- `.planning/ROADMAP.md` — Phase 2 goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — HERO-01..04 (the Phase-2 contract).
- `.planning/LANDING-VISION.md` — §2 (what Numen is + positioning line), §4 (references:
  sandcastles.ai signature moment, Linear/Raycast craft, OpusClip structure), §5 (placeholder
  strategy), §8 (guardrails: calm motion, perf, a11y).
- `.planning/MILESTONE.md` — marketing-surface-only, placeholders, permitted libs.

### Score-instrument truth reference (read-only — semantics, not code to import)
- `src/components/board/verdict/*` + `src/components/board/InsightHeroFrame.tsx` — the real
  product's score/verdict viz (arc-gauge semantics behind D-04). Reference for what a "virality
  score" honestly is; do NOT import the product aesthetic into the marketing hero.

### Tailwind v4 gotchas (repo-root `CLAUDE.md`)
- oklch L<0.15 → use hex for very dark tokens; Lightning CSS strips `backdrop-filter` (moot —
  flat-matte has no blur); kill dev server + clear `.next/` when CSS changes don't appear.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<Placeholder>`** (`src/components/marketing/placeholder.tsx`) — `variant="video"` aspect-
  locked phone/video frame for the reacted-to TikTok (D-05); one-prop `src` swap later.
- **`src/components/motion/*`** — `fade-in`, `fade-in-up`, `slide-up`, `stagger-reveal`,
  `hover-scale`, `page-transition` (on `motion/react`). Use for the headline/subcopy/CTA entrance;
  the particle moment is a bespoke client island beyond these.
- **`MotionConfigShell`** — global `reducedMotion="user"`; every `motion` element auto-respects
  OS setting. For the **non-Framer** canvas/R3F loop, gate manually — **port `usePrefersReducedMotion`**
  from numen-rework (per 01-CONTEXT) to freeze the sim → the D-15 still.
- **`SIGNUP_URL`** (`src/lib/routes.ts`) — HERO-02 target. **`cn()`** (`src/lib/utils.ts`).
- **Installed heavy libs:** R3F (`@react-three/fiber@9`, `@react-three/drei@10`), `three@0.182`,
  `@splinetool/react-spline`, `d3-hierarchy`, `d3-quadtree`, `motion@12`. **NOT installed:**
  Magic UI, Aceternity, tsparticles, cobe, number-flow — add per-component only if D-01/build
  approach chooses one (researcher's call).

### Established Patterns
- Tailwind v4 flat-warm `@theme` tokens (ported Phase 1) — reference semantic token names, never
  hardcode hex. Coral = the lone accent.
- App Router route groups; **server components by default**, `"use client"` only for interactive.
  Keep `page.tsx` an RSC; mount the animated moment as a **dynamically-imported client island**
  (`ssr:false`) so the still SSRs and the heavy viz hydrates after (D-16).
- kebab-case components, barrel `index.ts`, CVA + clsx + tailwind-merge. New Phase-2 components
  live in **`src/components/marketing/`** (per Phase-1 D-15) — e.g. a `hero/` subdir.

### Integration Points
- `src/app/(marketing)/page.tsx` `<section id="hero">` — currently a `min-h-[60vh]` centered stub
  ("Hero — coming in Phase 2"); **replace its contents** with the composed hero.
- The scroll cue (D-12) targets the existing `#how-it-works` anchor.
- Reduced-motion already wired globally (`MotionConfigShell`) — the sim only needs the manual
  hook for its non-Framer rAF loop.

### Reference-only precedent (do NOT reuse — old aesthetic)
- `src/components/hive-demo/` — the old societies canvas crowd (~1300 nodes @60fps). Aesthetic is
  the retired glass/old-brand look, but it **proves a canvas particle crowd is perf-feasible** here.
</code_context>

<specifics>
## Specific Ideas

- **The signature moment, narrated:** a placeholder TikTok phone frame sits in a contained
  flat-warm stage; hundreds of soft charcoal/cream particles (each = a viewer) react to it
  (coral pulse), then flow inward and **coalesce into an arc ring with the virality score** in
  its center. Plays once on mount, rests with a subtle drift, replays on hover/click. The
  resolved frame is also the reduced-motion / pre-hydration still.
- **North star:** the **Claude.ai dark UI** calm — neutral charcoal, a cream serif voice line,
  clay/coral accent, flat hairline borders, generous whitespace. "Claude-quality calm" applied
  to a TikTok virality instrument.
- **References to steal from** (VISION §4): **sandcastles.ai** — the one immersive signature
  moment (this *is* it); **Linear / Raycast** — typographic restraint, whitespace, dark-theme
  craft; **OpusClip** — "paste a link → magic" creator-tool framing.
- **The serif headline is the landing's reserved voice moment** — Phase 1 deliberately held the
  one serif slot in the chrome for this headline. It lands here.
</specifics>

<deferred>
## Deferred Ideas

- **Live "paste a real link → engine demo"** — explicitly OUT OF SCOPE (REQUIREMENTS Out-of-Scope
  table): needs the live engine; the moment is a **canned cinematic**, not a real analyze call. A
  faked live demo risks feeling dishonest.
- **Real hero asset swap** (actual product screenshot/video in the phone frame) — v2 EXPND-02; the
  phone stays a `<Placeholder>`.
- **Hero-variant A/B testing** — v2 EXPND-03.
- **Audio / sound on the moment** — project-wide "sound design = future polish"; not this phase.
- **Removing the redundant `framer-motion` dep** — carried Phase-1 deferral; Phase 5.

None were dropped silently — each is captured for its proper phase/milestone.
</deferred>

---

*Phase: 2-Hero & Signature Moment*
*Context gathered: 2026-06-14*
