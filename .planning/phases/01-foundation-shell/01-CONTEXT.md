# Phase 1: Foundation & Shell - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the new Numen marketing landing's **skeleton** at `/`: the route mount
(replacing the old plagiarized home), the **flat-warm design-system port**, the
reusable **placeholder-slot** component every section will reuse, the **motion +
global reduced-motion** foundation, and the **header + footer chrome** that wraps
the single long scroll. Marketing surface only — every product visual is a labelled,
swappable placeholder. Phase 1 ships a *scroll skeleton* (chrome + empty anchored
sections); Phases 2–4 fill the sections.

Requirements: FOUND-01, FOUND-02, FOUND-03, FOUND-04, NAV-01, NAV-02, NAV-03 (7).

**MAJOR REFRAME (locked this discussion):** The milestone docs assumed carrying the
cold Raycast brand from `main` (coral `#FF7F50`, bg `#07080a`, glass + glow). Davide
overrode this: **don't reuse old code, and adopt the newer flat-warm design system
from the `~/virtuna-numen-rework` worktree** (neutral charcoal, cream text, terracotta
coral, Newsreader serif for voice moments, flat-matte — no glass/glow). See `<decisions>`
D-01..D-08 and the override note in `<canonical_refs>`.
</domain>

<decisions>
## Implementation Decisions

### Visual system — adopt numen-rework FLAT-WARM (the reframe)
- **D-01 (adopt + port):** Adopt the numen-rework **flat-warm** design system wholesale.
  Port its `~/virtuna-numen-rework/src/app/globals.css` `@theme` block into landing-v2's
  `src/app/globals.css`. The semantic token *names* are identical, so this is a clean
  swap that **replaces** the cold Raycast tokens currently in landing-v2.
- **D-02 (surfaces):** Neutral charcoal, de-blued, NOT warm-brown — `#262624` (page bg),
  `#1a1a18`, `#1e1d1b` (composer/card), `#2f2e2b` (chip/lifted). Replaces `#07080a`.
- **D-03 (text):** Cream, never pure white — `#ece7de` primary / `#c2bdb4` secondary /
  `#8a857c` muted.
- **D-04 (accent):** Terracotta-clay coral `oklch(0.68 0.13 33)` ≈ `#d97757` (matured from
  `#FF7F50`, hue 40→33, deeper + desaturated). The **lone** brand accent — logo, primary
  CTA, focus. `accent-foreground #1a0f0a` (verify AA ≥7:1 on the terracotta at build).
- **D-05 (type):** **Inter** for ALL UI/chrome/data. **Newsreader serif (400 + italic) for
  VOICE MOMENTS ONLY** — on this landing the hero headline is the voice moment. Wire
  `--font-newsreader` in the root layout exactly as numen-rework (`next/font/google`,
  styles normal+italic, weight 400, add `${newsreader.variable}` to `<html>`).
- **D-06 (elevation — flat-matte):** Depth = tone-step + hairline 6% borders. **NO glass,
  NO backdrop-blur, NO inset white shine, NO glow/halo/ambient lighting.** Only
  `--shadow-float` (whisper-soft) on genuinely floating elements. Removed tokens (do not
  reintroduce): `--gradient-navbar`, `--gradient-glass`, `--gradient-feature`,
  `--shadow-glass`, `--shadow-glow-accent`, the inset-shine layer of `--shadow-button`.
- **D-07 (carried unchanged):** Borders 6% / hover 10%, card radius 12px, full radius scale,
  8px-base spacing, Inter weights/sizes — all survive in the flat-warm theme, carry as-is.
- **D-08 (north star):** Claude.ai dark-UI calm. Refined > flashy. The flat-warm system is
  already **UAT-locked** in numen-rework (THEME-06) — adopt its values directly; no new
  abstract UAT gate needed, just a visual sanity check on the assembled landing.

### Route mount & old-code disposition
- **D-09 (mount):** New landing replaces `/` at `src/app/(marketing)/page.tsx`. Phase 1 ships a
  **scroll skeleton** — fresh flat-matte `<Header/>` + `<main>` of stub sections carrying
  anchor `id`s (anchor targets for the nav + slots for Phases 2–4) + fresh `<Footer/>`.
- **D-10 (fix `<html>` bug):** Strip `<html>`/`<body>` + the stale "Artificial Societies"
  metadata out of `(marketing)/layout.tsx` (today it duplicates the root layout's `<html>`).
  Root `layout.tsx` owns html/body/font/base metadata; the `/` page exports its own page
  metadata (correct Numen copy).
- **D-11 (DELETE NOW — clean slate):** Delete `src/components/landing/*` (the old plagiarized
  societies-clone sections) and the dead test routes `(marketing)/{viz-test, viral-score-test,
  board-preview, primitives-showcase}`. Rewrite `header.tsx` / `footer.tsx` **fresh in place**
  on flat-warm. Fix any sibling-route imports that break from the deletions (e.g. `/pricing`,
  `/showcase` if they import old `landing/*`).

### Placeholder-slot component (FOUND-03)
- **D-12 (API):** One component — `<Placeholder variant="image|video|avatar|logo" aspect="16/9"
  label="Hero demo" src?="/real.png" />`. CVA, matching `ui/` conventions. When `src` is passed
  it renders the real `<img>`/`<video>`; absent, the labelled stand-in. **`src` is the one-prop
  swap** the brief wants. No central asset-registry for v1.
- **D-13 (look — flat-warm):** Charcoal-chip/composer surface, hairline 6% border, 12px radius,
  centered low-opacity media-type icon (lucide/phosphor), cream-muted `label` caption, faint
  mono dimension hint. **No glass, no shine, no dashed-wireframe** (wireframe reads "cheap/unfinished").
  Optional very-subtle `skeleton-breathe` (keyframe already in globals), reduced-motion gated.
- **D-14 (no layout shift):** Lock dimensions with CSS `aspect-ratio` so each slot reserves space
  before any asset loads (sets up FOUND-06).
- **D-15 (location):** New `src/components/marketing/` dir for all landing-v2-specific components
  (placeholder now; sections later) — keeps the milestone surface out of the shared design system.

### Motion foundation (FOUND-04)
- **D-16 (one lib):** Standardize all new imports on **`motion/react`**. Migrate the existing
  `motion/*` wrappers off `framer-motion`; remove the redundant `framer-motion` dep once a grep
  confirms zero remaining imports (defer the removal if anything else still imports it).
- **D-17 (global reduced-motion):** Wrap the landing in **`<MotionConfig reducedMotion="user">`**
  (every `motion` element auto-respects OS setting) **+** a CSS `@media (prefers-reduced-motion:
  reduce)` block for non-Framer animations (marquee, shimmer, breathe). Port numen-rework's
  `usePrefersReducedMotion` hook for any non-Framer conditional logic.
- **D-18 (primitives):** Reuse + lightly extend the existing `motion/*` set (fade-in, fade-in-up,
  slide-up, stagger-reveal, hover-scale, page-transition). Heavy "wow" libs (Magic UI / Aceternity)
  are pulled per-component in later phases (signature moment = Phase 2).

### Header & footer chrome (NAV-01/02/03)
- **D-19 (header — fresh, flat-matte):** NOT the old glass pill. A flat sticky bar — solid
  charcoal/tone-step bg, hairline bottom border, no backdrop-blur, no shine. `NumenLogo` +
  3–4 in-page anchor links + a "Try it free" primary button + a subtle "Sign in" secondary link.
- **D-20 (CTA targets):** "Try it free" → **`/signup`** (confirmed: `(onboarding)/signup`; pricing
  + old CTA already link there). "Sign in" → **`/login`**. Keep the signup URL in one shared
  constant so it's trivially changeable.
- **D-21 (mobile collapse):** Simple flat collapse (lightweight dropdown or drawer) that closes on
  tap. No glass. Don't add a heavyweight Radix Sheet for a 3–4 item nav.
- **D-22 (footer — compact 2–3 column):** brand (logo + one-line tagline) | product anchors (mirror
  the nav) | legal/social placeholders (Privacy, Terms, X/TikTok). Flat-warm, refined. Rebuilt from
  scratch — strip all societies content.

### Product naming
- **D-23 ("Simulation"):** The product output noun is **"Simulation"** across ALL landing copy
  (aligns with numen-rework D-09; Davide vetoed "Reading"). Ripples to Phase 2 (hero) and Phase 3
  ("the reading" showcase → "The Simulation"). Phase 1 nav anchors should use it (suggested set:
  *How it works · The Simulation · Pricing · FAQ* — exact set is the planner's call).

### Doc reconciliation (approved this discussion)
- **D-24 [informational]:** Update the landing-v2 milestone docs to the flat-warm override **now** (not deferred):
  `REQUIREMENTS.md` FOUND-02, `ROADMAP.md` Phase 1 Success Criterion #1, and `LANDING-VISION.md`
  §6 brand carry-over. Committed alongside this CONTEXT.
  _Status: DONE during discuss-phase (commit `671c5329`) — verified 2026-06-14: FOUND-02, VISION §6, and ROADMAP SC#1 all carry the flat-warm wording. This is a doc-reconciliation already executed, NOT execution-phase build work, so it is **not** tracked by any PLAN.md._

### Claude's Discretion
- Final hex ramp / serif weights / coral hue — follow numen-rework's locked values (already
  UAT-signed); do not re-derive.
- Component/motion library choices within the flat-warm + calm-motion taste bar — executor
  (Radix / shadcn / Magic UI / Aceternity / motion).
- Exact anchor-link set, section `id`s, and the scroll-skeleton stub markup — planner.
- Exact `/` page metadata copy — planner (root layout already has correct Numen base metadata).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The new design system — ADOPT THIS (highest priority)
- `~/virtuna-numen-rework/src/app/globals.css` — flat-warm `@theme` token **SSOT** (charcoal/cream/
  terracotta scales, repointed semantics, removed glass/glow, flat-matte shadows). **Port this block
  into `src/app/globals.css`.**
- `~/virtuna-numen-rework/src/app/layout.tsx` — the **Newsreader font-wiring pattern** to replicate
  (`next/font/google`, normal+italic, weight 400, `--font-newsreader`, added to `<html>` className).
- `~/virtuna-numen-rework/.planning/phases/01-foundation-shell/01-CONTEXT.md` — the flat-warm
  **decision record** (D-01..D-08): base hue, cream text, serif-for-voice-only, terracotta coral,
  flat-matte elevation, glass-strip scope. The authoritative "why."
- ⚠ `~/virtuna-numen-rework/BRAND-BIBLE.md` is **STALE** (still documents the old Raycast glass system).
  Do NOT follow it for visual direction — `globals.css` + the `01-CONTEXT.md` above are the SSOT.

### Source of truth & requirements (landing-v2)
- `.planning/LANDING-VISION.md` — input brief (NOTE: §6 brand carry-over updated to flat-warm per D-24).
- `.planning/MILESTONE.md` — milestone identity + hard constraints (marketing-surface-only, placeholders, permitted libs).
- `.planning/REQUIREMENTS.md` — FOUND-01..04, NAV-01..03 (Phase 1 contract; FOUND-02 updated per D-24).
- `.planning/ROADMAP.md` — Phase 1 goal + success criteria (SC#1 brand wording updated per D-24).

### Project / brand (landing-v2)
- `BRAND-BIBLE.md` (repo root) — ⚠ also STALE (old Raycast glass). Reference for **component inventory
  only**, NOT the visual direction.
- `CLAUDE.md` (root + worktree) — Tailwind v4 gotchas (oklch L<0.15 → use hex for dark tokens; Lightning
  CSS strips `backdrop-filter` → inline style if any blur survives — moot here since flat-matte removes
  blur; kill dev server + clear `.next/` when CSS changes don't appear). 6%/10% borders + 12px radius still apply.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/brand/numen-logo.tsx` — `NumenLogo` / `NumenMark` (stele glyph + wordmark variants);
  color inherits via `currentColor`. Use as-is for NAV-01.
- `src/components/ui/*` — Radix-based primitives (button, card, accordion [→FAQ, Phase 4], avatar,
  marquee [→logo wall, Phase 4], dialog, etc.). They reference semantic tokens → **auto-adopt flat-warm
  after the theme port**. Watch for any primitive with hardcoded glass/gradient and flatten it.
- `src/components/motion/*` — fade-in, fade-in-up, slide-up, stagger-reveal, hover-scale, page-transition
  (FOUND-04 base set).
- `src/lib/utils.ts` — `cn()`.
- numen-rework hooks worth porting: `usePrefersReducedMotion`, `useIsMobile` (if not already present here).

### Established Patterns
- Tailwind v4 two-layer `@theme` tokens (primitive → semantic) in `globals.css`; reskin by repointing
  tokens, components reference semantic names. The flat-warm reskin is done entirely here.
- App Router with route groups `(marketing)` / `(app)` / `(onboarding)`; server components by default,
  `"use client"` only for interactive (motion, mobile nav).
- kebab-case components, barrel `index.ts` exports, CVA + clsx + tailwind-merge.
- Stack reality check: **Next.js 16.1.5**, React 19.2.3, Tailwind v4 (CLAUDE.md says Next 15 — outdated).
  `motion@12.29.2` AND `framer-motion@12.29.3` both installed (redundant — see D-16). Radix set, cmdk,
  next-themes, R3F + Spline all present.

### Integration Points
- `src/app/(marketing)/page.tsx` — the new `/` landing (replace contents).
- `src/app/(marketing)/layout.tsx` — strip `<html>`/`<body>` + stale metadata (D-10).
- `src/app/layout.tsx` — add the Newsreader font variable (D-05).
- `src/app/globals.css` — flat-warm theme port (the epicenter, D-01).
- `src/app/(onboarding)/signup` + `/login` — CTA targets (D-20).
- Sibling marketing routes (`/pricing`, `/showcase`, …) — fix any imports broken by deleting `landing/*` (D-11).
</code_context>

<specifics>
## Specific Ideas

- **Visual north star:** the Claude.ai dark UI — neutral charcoal surfaces, a cream serif voice line,
  clay/coral accent, flat hairline borders, generous calm whitespace. "Claude-quality calm" applied to a
  TikTok virality instrument.
- **Hero headline = the landing's serif voice moment** (Newsreader) — the one place serif appears in Phase 1's chrome is reserved; the headline itself lands in Phase 2.
- **Terracotta coral ≈ `#d97757`** (Claude's clay accent is the north star for the matured coral).
- **References to steal from** (VISION §4): Linear (typographic restraint, whitespace, dark-theme mastery),
  Raycast (minimal, clean borders, product-led hero), sandcastles.ai (one signature moment — the crowd→score,
  Phase 2), OpusClip (creator-tool structure & "paste a link → magic" positioning). Synthesis: OpusClip
  *structure* × Linear/Raycast *craft* × one sandcastles-grade *signature moment*.
</specifics>

<deferred>
## Deferred Ideas

- **Placeholder asset-registry / one-file swap manifest** — the `src` prop suffices for v1; a named-slot
  registry is over-engineering. Revisit only if the human asks for bulk swap.
- **Remove the redundant `framer-motion` dep** — do it once all `motion/*` wrappers are migrated to
  `motion/react`; may slip to the Phase 5 hardening pass if risky mid-build.
- **Full reskin of sibling marketing routes** (`/pricing`, `/showcase`, etc.) — out of the single-scroll
  v1 scope; Phase 1 only fixes breakage caused by deleting `landing/*`. Their flat-warm reskin is later/separate.
- **Standalone routes** (`/pricing`, `/about`, `/manifesto`) — v2 (EXPND-01).
- **Real-asset integration pass** (swap all placeholders for shipped screenshots/video/logos/quotes) — v2 (EXPND-02).
- **New abstract UAT gate for the theme** — unnecessary; flat-warm is already UAT-locked in numen-rework.
  Only a quick visual check on the assembled landing.

None of the above were dropped silently — each is captured for its proper phase/milestone.
</deferred>

---

*Phase: 1-Foundation & Shell*
*Context gathered: 2026-06-14*
