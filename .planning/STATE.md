---
gsd_state_version: 1.0
milestone: landing-v2
milestone_name: Refined Marketing Site
status: executing
stopped_at: Phase 2 — 02-03 closed out (resume); 02-02 canvas next (blocking human-verify)
last_updated: "2026-06-15T08:40:00.000Z"
last_activity: 2026-06-15
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-14) · Milestone: .planning/MILESTONE.md

**Core value:** A refined, premium marketing landing that makes a creator instantly *get* Numen — "know if it'll pop before you post" — and click "Try it free."
**Current focus:** Phase 02 — hero-signature-moment

## Current Position

Phase: 02 (hero-signature-moment) — EXECUTING
Plan: 4 of 4 (02-02 signature canvas — last incomplete plan)
Status: 02-03 complete (closed out on resume); ready to execute 02-02 (blocking human-verify checkpoint)
Last activity: 2026-06-15

Progress: [█████████░] 89%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 9 | 3 tasks | 6 files |
| Phase 01 P02 | 5min | 2 tasks | 3 files |
| Phase 01 P04 | 7min | 2 tasks | 2 files |
| Phase 01 P05 | 4min | 2 tasks | 2 files |
| Phase 01 P03 | 3min | 2 tasks | 4 files |
| Phase 02 P00 | 10min | 2 tasks | 4 files |
| Phase 02 P01 | 8min | 2 tasks | 4 files |
| Phase 02 P03 | ~30min | 2 tasks | 4 files (+1 stub) |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Hero signature moment ("crowd → score", HERO-03/04) isolated in its own phase (Phase 2) — highest-craft, highest-risk item gets the room it needs.
- Roadmap: Cross-cutting quality (FOUND-05 responsive, FOUND-06 perf/lazy, FOUND-07 a11y) mapped to a final hardening pass (Phase 5) over the assembled page; seeded as standing criteria from Foundation onward.
- Milestone: Marketing surface only — every product visual is a labelled, swappable placeholder slot (FOUND-03), never a shipped asset.
- [Phase ?]: 01-01: Adopted numen-rework flat-warm @theme wholesale (charcoal #262624 / cream #ece7de / terracotta coral); cold Raycast brand retired
- [Phase ?]: 01-01: page.tsx owns Header+main+Footer; (marketing)/layout.tsx is a bare pass-through (D-10 double-html bug fixed)
- [Phase ?]: 01-01: Nav/section anchors = hero/how-it-works/the-simulation/pricing/faq (D-23 Simulation noun); src/lib/routes.ts holds shared CTA URLs
- [Phase ?]: 01-02: <Placeholder> breathe is an opt-in boolean prop (default OFF), double-gated via animate-skeleton-breathe + motion-reduce:animate-none
- [Phase ?]: 01-02: marketing dir + barrel established (D-15); per-variant default aspect (image/video 16/9, avatar 1/1, logo 3/1); logo icon-only, video play-triangle overlay
- [Phase ?]: 01-04: Header rewritten flat-matte — bar = #1a1a18 opaque (no blur), logo → #hero; mobile = useState disclosure (NOT Radix Sheet, D-21) with shadow-float panel that closes on tap; CTA via Button asChild → SIGNUP_URL/LOGIN_URL
- [Phase ?]: 01-05: Footer rebuilt flat-warm as a STATIC server component (no use client) — tone-step #1a1a18 surface + hairline TOP border, no glass/gradient; product anchors mirror the header nav, legal/social are labelled href='#' placeholder stubs (D-22)
- [Phase 01-03]: 01-03: MotionConfigShell (<MotionConfig reducedMotion='user'>) wraps the FULL chrome (Header+main+Footer); page stays RSC and / stays statically prerendered
- [Phase 01-03]: 01-03: two-layer reduced-motion contract = MotionConfig (Framer) + CSS @media (prefers-reduced-motion: reduce) animation:none for skeleton-breathe/shimmer/marquee/marquee-vertical
- [Phase 01-03]: 01-03: D-16 satisfied by VERIFY (6/6 motion/* on motion/react, 0 framer-motion) + MotionConfig wiring, NOT migration; framer-motion dep retained (4 product files), removal deferred to Phase 5
- [Phase ?]: 02-00: Wave-0 hero tests RED-by-design — module-not-found is the success signal; HERO-01..04 turn GREEN in 02-01/02-03, not here
- [Phase ?]: 02-00: SVG ring geometry re-derived in-test (radius 114, offset=circumference·(1−score/100)) + token assertions (var(--color-accent), threshold from verdict-constants) catch a hardcoded ring/hex
- [Phase 02-01]: Hero is a PURE RSC — no client directive, no lazy ssr-disabled import in hero.tsx/page.tsx (the 02-00 landmine); client island + canvas deferred to 02-03/02-02. / stays statically prerendered (verified ○ in build route table).
- [Phase 02-01]: The hero STAGE shell owns the no-CLS aspect-lock (inline aspect-ratio 16/10) — the fixed box 02-03's ComposedStill + 02-02's client island mount into with zero layout shift.
- [Phase 02-01]: Stage holds a labelled Placeholder(variant=video,aspect=9/16) as visible scaffolding; the 02-03/02-02 swap-in seam is marked in hero.tsx. Coral is the lone accent, only on the primary CTA.
- [Phase 02-03]: dynamic(ssr:false) canvas import lives ONLY in signature-moment-client.tsx ('use client'); Hero/page stay pure RSC and / stays statically prerendered (○). THE Next-16 landmine fix (mirrors Board.tsx), verified by clean build.
- [Phase 02-03]: ComposedStill = pure-RSC universal floor (D-15) — phone + deterministic seeded-PRNG settled dot field (~46 SVG circles, never Math.random → no hydration mismatch) + clean re-derived coral arc ring (glow/tiers/white/framer-motion STRIPPED) + static coral score; role=img/aria-label + aspect-lock. Serves SSR/reduced-motion/mobile/at-rest.
- [Phase 02-03]: SignatureMomentClient gate = !reduced && !isMobile && tier!=='low' && !fpsDropped → return null on still paths (canvas rAF never mounts under reduced-motion, Pitfall 5); ComposedStill is its dynamic loading fallback. hero-constants.ts is the score(87)/geometry(240/12)/timing/palette SSOT shared with the 02-02 canvas.
- [Phase 02-03]: CLOSED OUT ON RESUME — code was committed in a prior session (feat 86b744ba + auto-wip 5574c4f4) but never got a SUMMARY/tracking; reconciled here. Needed a TEMPORARY signature-canvas.tsx stub (re-renders ComposedStill) so the ssr:false import + vitest collector resolve — 02-02 REPLACES it. WATCH: the auto-wip hook can pre-empt the executor's atomic-commit protocol mid-plan.

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-15T00:58:26.673Z
Stopped at: Phase 2 UI-SPEC approved
Resume file: None
