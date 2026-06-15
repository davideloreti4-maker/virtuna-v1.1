---
phase: 02-hero-signature-moment
plan: 01
subsystem: marketing-hero
tags: [hero, rsc, serif-voice, cta, stage-shell, flat-warm, tdd-green, no-cls]

# Dependency graph
requires:
  - phase: 02-hero-signature-moment
    provides: "Wave-0 RED gate hero.test.tsx (HERO-01/02 acceptance as executable assertions)"
  - phase: 01-foundation-shell
    provides: "flat-warm @theme tokens, <Placeholder> slot, <Button> (asChild), SIGNUP_URL route, RSC page skeleton under <MotionConfigShell>"
provides:
  - "RSC <Hero>: serif voice H1 (verbatim D-09) + Inter mechanism subcopy (D-11) + CTA cluster (D-12) + the contained flat-warm STAGE shell (D-07)"
  - "The dimension-locked stage container (inline aspect-ratio 16/10) — the no-CLS arena 02-03's ComposedStill + 02-02's client island mount into"
  - "marketing barrel re-exports Hero; page.tsx '#hero' section now renders <Hero /> (stub removed); / stays statically prerendered (○)"
affects: [02-03-composed-still, 02-02-signature-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure RSC composition (no client directive) — the lazy client island/boundary deferred to 02-02/02-03 (Next.js 16 ssr-disabled-import landmine kept out of Hero)"
    - "Stage no-CLS lock via inline style={{ aspectRatio }} (mirrors <Placeholder> dimension-lock) — fixed box the moment mounts into later with zero layout shift"
    - "Semantic-token-only styling (font-serif, text-display/hero/4xl, text-foreground/-secondary/-muted, border-border, bg-surface, rounded-[--radius-lg]); coral is the lone accent, only on the primary CTA; zero hardcoded hex"
    - "Primary CTA = <Button variant='primary' asChild><Link href={SIGNUP_URL}> (imported constant, not literal); scroll-cue = bare <a href='#how-it-works'> with a ≥44px tappable area, visibly subordinate"

key-files:
  created:
    - "src/components/marketing/hero/hero.tsx"
    - "src/components/marketing/hero/index.ts"
  modified:
    - "src/components/marketing/index.ts"
    - "src/app/(marketing)/page.tsx"

key-decisions:
  - "Hero kept a PURE RSC — no client directive, no lazy ssr-disabled import in this file (the 02-00 landmine). The client boundary + canvas land in 02-03/02-02. page.tsx therefore stays RSC and / stays statically prerendered (verified ○ in the build route table)."
  - "Stage dimension-locked at aspect-ratio 16/10 (wide landscape that comfortably holds a 9/16 phone + a later ~240px ring) so the signature moment mounts with zero CLS (Pitfall 3). The aspect-lock is OWNED here — 02-03/02-02 mount into this exact box."
  - "Subcopy uses the planner-suggested D-11 line tightened: 'Paste a TikTok and a synthetic audience simulates the reaction — watch-through %, Hook, Retention, Shareability, and a virality score, before you post.' Product noun 'simulates' (D-23 carried); cream-secondary; no coral."
  - "Entrance motion (FadeInUp/StaggerReveal) deliberately OMITTED — UI-SPEC marks it optional ('the moment is the wow, not the copy entrance') and keeping it out preserves a static first paint and a clean RSC subtree."
  - "tailwind-merge dropped 'font-serif' when paired with the custom 'font-regular' weight utility in cn() (they collided as font-* utilities). Resolved by removing 'font-regular' (Newsreader 400 is already the H1 default) so the /font-serif/ assertion (D-10) passes."

requirements-completed: [HERO-01, HERO-02]

# Metrics
duration: ~8min
completed: 2026-06-15
---

# Phase 2 Plan 01: Hero — RSC Composition Summary

**Built the RSC `<Hero>` — the landing's serif voice H1 (verbatim "Know if it'll pop before you post", D-09/D-10), an Inter mechanism subcopy naming the Simulation + the real outputs (D-11), the CTA cluster (coral "Try it free" → `SIGNUP_URL` + a subordinate "See how it works ↓" → `#how-it-works`, D-12), and the contained flat-warm, dimension-locked stage shell (D-07) — mounted it into `page.tsx`'s `#hero` section, and kept the page a pure RSC so `/` stays statically prerendered. Turns the Wave-0 `hero.test.tsx` GREEN (5/5).**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files created:** 2 · **Files modified:** 2

## Accomplishments

- **HERO-01 (hybrid-voice headline + subcopy):** a real `<h1>` carrying the verbatim locked copy in `font-serif` (Newsreader, D-10) with the responsive `text-4xl → text-hero → text-display` clamp + an `18ch` measure (≤3 lines at 320px); an Inter cream-secondary `<p>` naming the Simulation + watch-through %, Hook, Retention, Shareability, and a virality score (D-11). The serif/Inter contrast IS the hybrid voice.
- **HERO-02 (CTA routing):** primary `<Button variant="primary" size="lg" asChild>` wrapping `<Link href={SIGNUP_URL}>Try it free</Link>` (coral, inherits `shadow-button` + ≥44px target); a subordinate `<a href="#how-it-works">See how it works ↓</a>` scroll-cue (cream-muted, ≥44px tappable, focus-ring) that does not compete with the primary (D-12).
- **The stage shell (D-07):** a tone-step `bg-surface` `<div>` with a 6% `border-border` hairline + 12px `rounded-[--radius-lg]` radius, **dimension-locked** via `style={{ aspectRatio: "16 / 10" }}` so the later moment mounts with zero CLS (Pitfall 3). Holds a single labelled `<Placeholder variant="video" aspect="9/16" label="Your TikTok">` as visible scaffolding; the **02-03/02-02 seam** (where `<ComposedStill>` + `<SignatureMomentClient>` swap in) is marked in a comment.
- **Wiring:** `hero/index.ts` barrel re-exports `Hero`; `marketing/index.ts` extended with `export { Hero } from "./hero"`; `page.tsx` imports `Hero` and renders `<Hero />` inside `<section id="hero">` (the "coming in Phase 2" stub removed), the section reduced to anchor-id + vertical rhythm while Hero owns its own centering/measure.
- **Landmine held:** `hero.tsx` and `page.tsx` are both pure RSCs — no client directive, no `dynamic`/ssr-disabled import in either. `npm run build` exits 0 and the route table shows `○ /` (Static).
- **Gate GREEN:** `hero.test.tsx` 5/5 pass. The other three hero suites (`composed-still`, `signature-moment-client`, `hero-constants`) remain RED **by design** — 02-03/02-02 turn them GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the RSC Hero (H1 + subcopy + CTA cluster + stage shell)** — `e15f596b` (feat)
2. **Task 2: Mount Hero in page.tsx + extend the marketing barrel** — `6fa7cf44` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified

- **`src/components/marketing/hero/hero.tsx`** (created) — RSC `Hero`: serif H1 + Inter subcopy + CTA cluster + the dimension-locked flat-warm stage holding a labelled phone Placeholder. No client directive.
- **`src/components/marketing/hero/index.ts`** (created) — barrel: `export { Hero } from "./hero";`.
- **`src/components/marketing/index.ts`** (modified) — extended to re-export `Hero` from `./hero`.
- **`src/app/(marketing)/page.tsx`** (modified) — imports `Hero`; `#hero` section now renders `<Hero />` (stub removed); page stays an RSC.

## Decisions Made

- **Hero stays a pure RSC (the 02-00 landmine).** No client directive, no lazy ssr-disabled import in `hero.tsx`/`page.tsx`. The client boundary + canvas are 02-03/02-02's job. Verified: `npm run build` exit 0 + `○ /` in the route table (statically prerendered).
- **Stage aspect-lock owned here at 16/10.** A wide landscape ratio that comfortably holds a 9/16 phone plus the later ~240px arc ring, locked inline so there is zero CLS when `ComposedStill`/the canvas mount into the same box (Pitfall 3, D-07).
- **Subcopy = the D-11 suggested line, tightened.** Uses the product noun via "simulates" (D-23 carried), cream-secondary, no coral.
- **Entrance motion omitted (optional per UI-SPEC).** Keeps a static first paint and a clean RSC subtree; the signature moment is the wow, not the copy entrance.
- **`font-regular` removed from the H1 class.** tailwind-merge collided the custom `font-regular` weight utility with `font-serif` and dropped the latter; Newsreader's default weight is already 400, so removing `font-regular` restores `font-serif` and satisfies the D-10 `/font-serif/` assertion.

## Deviations from Plan

None — plan executed exactly as written. (One in-flight implementation fix: a `cn()`/tailwind-merge class collision dropped `font-serif`; removing the redundant `font-regular` utility resolved it without changing intent. Not a deviation from the plan's design — the H1 is still Newsreader-serif 400.)

## Issues Encountered

- **tailwind-merge dropped `font-serif`.** Pairing `font-serif` (font-family) with the project's custom `font-regular` weight utility inside `cn()` made tailwind-merge treat them as conflicting `font-*` utilities and keep only the last one. Fix: drop `font-regular` (the H1 is 400 by default). hero.test.tsx then passed 5/5.
- **Build route table truncated by the tool's tail wrapper.** Routed `npm run build` to a log file and grepped the exit code + the `○ /` row to confirm static prerender independently.

## User Setup Required

None — no external service configuration, no new dependencies, no runtime/network/secrets. Pure additive marketing markup.

## Next Phase Readiness

- **02-03 (ComposedStill + boundary + constants):** build into the stage shell this plan owns. Export `HERO_SCORE` (87) from `hero-constants.ts`; build `ComposedStill({score})` (SVG ring track + `var(--color-accent)` progress at the derived offset, score text, `role="img"`+`aria-label`, aspect-lock) and `SignatureMomentClient({score})` (the **client** lazy boundary that does NOT mount the canvas under reduced-motion/mobile). Swap them into `hero.tsx`'s marked seam (replace the labelled `<Placeholder>`).
- **02-02 (signature canvas):** the bespoke canvas-2D coalesce; its ring end-state must converge on `ComposedStill`'s SVG ring inside this same dimension-locked box.
- **Landmine reminder:** the lazy ssr-disabled import MUST live in `signature-moment-client.tsx` (client module), never in the RSC `Hero` — Next.js 16 forbids it in a Server Component (RESEARCH Pitfall 1). This plan kept `Hero` clean; do not regress it when wiring the island.
- No blockers.

## Self-Check: PASSED

- Both created files exist: `src/components/marketing/hero/hero.tsx`, `src/components/marketing/hero/index.ts`.
- Both modified files contain the wiring: `marketing/index.ts` re-exports `./hero`; `page.tsx` renders `<Hero />` (stub gone).
- Both task commits present: `e15f596b` (Task 1), `6fa7cf44` (Task 2).
- `hero.test.tsx` GREEN (5/5); `npm run build` exit 0 with `○ /` (statically prerendered); zero hardcoded hex in `hero.tsx`; no client directive in `hero.tsx`/`page.tsx`.

---
*Phase: 02-hero-signature-moment*
*Completed: 2026-06-15*
