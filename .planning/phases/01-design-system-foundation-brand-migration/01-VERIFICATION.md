---
phase: 01-design-system-foundation-brand-migration
verified: 2026-06-11T21:34:53Z
status: passed
score: 24/24 must-haves verified
overrides_applied: 0
re_verification:
  # No previous VERIFICATION.md existed — initial verification
gaps: []
---

# Phase 1: Design System Foundation + Brand Migration Verification Report

**Phase Goal:** A ground-up warm-neutral dark design kit exists — verdict-scale color discipline, warm-clay brand accent, sans-led + serif voice type — so every later Reading component is built on it, and the old Raycast/coral/glass-everywhere brand is bounded and retired.
**Verified:** 2026-06-11T21:34:53Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

ROADMAP success criteria (SC) + PLAN-frontmatter truths, deduplicated. All checked against the actual codebase, not SUMMARY claims.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| SC1 | Warm-neutral dark theme, no pure black, all L<0.15 darks as exact hex (oklch bug avoided), verified on deployed build | ✓ VERIFIED | `.numen-surface` block (globals.css:356-372) base `--numen-bg: #1a1714`; only "#000"-grep match is the literal comment "no pure black"; every token is exact hex, zero `oklch()` in the block; `pnpm build` compiles `/numen-kit` as static (○) |
| SC2 | Verdict scale (muted green/amber/clay-red) is the only load-bearing functional color; near-neutral elsewhere; clay accent only on logo/action/focus | ✓ VERIFIED | `--numen-verdict-good #7faf7a / -mixed #d6a85a / -bad #d4866f`; `--numen-accent #d98a5e` (matured from #FF7F50); verdict-swatch.tsx maps all three muted tokens; pill-chip/icon-button use accent only on focus-ring/agentic-tint |
| SC3 | Component vocabulary (full-pill chips, circular icon buttons, hairline warm borders, soft elevation) + glass primitive (backdrop-filter inline, not class) without Lightning CSS stripping blur | ✓ VERIFIED | 6 primitives in src/components/numen/ (45-88 lines, substantive); glass.tsx:47-48 inline `backdropFilter`/`WebkitBackdropFilter`, no `backdrop-blur` class; build clean; human checkpoint (01-04 T3) approved live blur(12px) on prod via Playwright |
| SC4 | Sans body + serif reserved for voice (greeting/hero + verdict line); calm motion (no bounce/snap) on key reveal; keyframe stills carry chroma, chrome recedes | ✓ VERIFIED | layout.tsx: Source_Serif_4 as `--font-serif` on `<html>`, `<body>` uses `font-sans` (serif NOT on body); stage-reveal.tsx calm cubic-bezier tween + high-damping spring (no overshoot); showcase Section 8 keyframe-chroma `data-testid="ds08-keyframe-chroma"` |
| SC5 | Documented migration boundary: grep audit of #07080a / #FF7F50 / GlassPanel / fake macOS chrome / chat dock, replace-vs-defer decision | ✓ VERIFIED | docs/numen-migration-boundary.md (108 lines) inventory+disposition table with measured per-target counts; widened chat-dock grep resolves Q8 caveat; nothing live deleted (D-04) |
| T1 | bg-numen-* utilities resolve to warm-neutral hex inside `.numen-surface`, unaffected outside (D-01 namespaced parallel layer) | ✓ VERIFIED | `@theme inline` bridges `--color-numen-* → var(--numen-*)`; tokens undefined at :root so `bg-numen-bg` only resolves inside scope class; tokens.test.ts (9 tests) pass |
| T2 | No pure black in numen block; base #1a1714 | ✓ VERIFIED | Confirmed (SC1) |
| T3 | Every dark numen token authored as exact hex, never oklch() (D-03) | ✓ VERIFIED | grep of numen block: zero `oklch(` occurrences |
| T4 | check-apca.ts asserts each verdict+accent+text pairing meets APCA Lc target on #1a1714 | ✓ VERIFIED | `npx tsx scripts/check-apca.ts` exits 0: body 94.1, muted 60.1, accent 48.5, verdict-good 51.4, verdict-mixed 58.2, verdict-bad 46.7 — all PASS; apca.test.ts (3) green |
| T5 | --font-serif wired via next/font (Source Serif 4), bridged into @theme inline alongside --font-inter (D-13) | ✓ VERIFIED | layout.tsx:15 `Source_Serif_4({variable:"--font-serif"})`; globals.css:400 `--font-serif: var(--font-serif)`; `serif.variable` on html className (line 52) |
| T6 | Glass applies backdrop-filter via inline style only, never utility class — survives Lightning CSS in prod build (D-05) | ✓ VERIFIED | glass.tsx:47-48 inline only; no backdrop-blur class anywhere in numen/; build compiles clean |
| T7 | Tool chip / icon button / surface / verdict swatch render under .numen-surface, no neon/gradient/beam/glow/shimmer (D-07), Lucide-only (D-09) | ✓ VERIFIED | gradient/glow/neon strings appear only in comments documenting their ABSENCE; zero `bg-gradient`/`from-…to-`/glow-shadow utility classes; no non-Lucide icon imports |
| T8 | Tool chip intent variants (instant vs agentic) visually distinct (different class strings) | ✓ VERIFIED | pill-chip.tsx:34-35 instant=`bg-numen-panel hover:bg-numen-panel-2` vs agentic=`bg-numen-panel-2 ring-1 ring-numen-accent/30`; compoundVariant tints icon accent |
| T9 | Verdict swatch surfaces three muted verdict tokens; text on swatch meets APCA Lc ≥ 60 | ✓ VERIFIED | verdict-swatch.tsx:25-27 good/mixed/bad → numen-verdict-* ; APCA gate passes |
| T10 | Every primitive built with tailwind-variants slots via cn() — none uses class-variance-authority (D-08) | ✓ VERIFIED | `tv(` in surface/verdict-swatch/pill-chip/icon-button; only cva mentions are comments "(D-08, not cva)"; zero `class-variance-authority` import |
| T11 | StageBlock reveals via opacity tween + high-damping spring (ratio ≥1, no overshoot), never the bounce; built on motion lib not framer-motion (D-10) | ✓ VERIFIED | stage-reveal.tsx imports `motion/react`; spring stiffness 220/damping 30 (over-damped); `--ease-spring` only in comment documenting non-use |
| T12 | When useReducedMotion() true, StageBlock static opacity, NO translate/slide (D-14) incl. WR-04 null-first-render fix | ✓ VERIFIED | stage-reveal.tsx `const reduce = useReducedMotion() !== false` (null + true both suppress translate); `y: reduce ? 0 : 12`; reduced path `{duration:0}`; stage-reveal.test.ts (3) green |
| T13 | New calm easing token exists; old --ease-spring 1.56 bounce token NOT reused by numen kit | ✓ VERIFIED | globals.css:372 `--numen-ease-calm: cubic-bezier(0.215,0.61,0.355,1)`; legacy `--ease-spring` (line 170) untouched, not referenced by numen |
| T14 | Stage-reveal is the ONE key motion moment — no presence theater elsewhere | ✓ VERIFIED | No AnimatePresence/motion.div in other numen primitives; StageBlock is the sole motion component |
| T15 | Deployed-buildable showcase renders every primitive inside .numen-surface against live warm-neutral tokens (D-06 custom route, D-01 (kit) group) | ✓ VERIFIED | src/app/(kit)/numen-kit/page.tsx (324 lines) wraps `numen-surface dark`; imports all 5 primitives + KitStageDemo island; build prerenders /numen-kit |
| T16 | Showcase specimens serif voice (Source Serif 4 vs Newsreader) on greeting/hero + verdict line at real sizes on #1a1714 | ✓ VERIFIED | page Section 6: Source Serif 4 `font-serif` vs Newsreader `--font-serif-alt` side-by-side specimen |
| T17 | Glass blur visible on DEPLOYED build (Lightning CSS did not strip it) | ✓ VERIFIED | Inline-style architecture bypasses Lightning CSS by design; human checkpoint 01-04 T3 APPROVED live blur(12px) on prod Playwright (per task note) |
| T18 | Sample keyframe sits beside near-neutral chrome (chrome recedes, image carries chroma, DS-08); structural test asserts adjacency; human perceptual gate | ✓ VERIFIED | page Section 8 cool keyframe + near-neutral chrome; showcase.a11y.test.tsx asserts `[data-testid="ds08-keyframe-chroma"]` structural guard (2 tests green) |
| T19 | Showcase passes axe with no violations | ✓ VERIFIED | showcase.a11y.test.tsx:45-49 `axe(container) → toHaveNoViolations()` green |
| T20 | Migration boundary: grep inventory with measured per-target file counts; replace/defer + owning phase; nothing live deleted; widened chat-dock grep | ✓ VERIFIED | doc has measured counts (#07080a 5 files, #FF7F50 17, GlassPanel 10, coral- 7, framer-motion 4, TrafficLights 5, chat-dock 4-FOUND); disposition+owning-phase columns; `git diff main..HEAD --diff-filter=D` returns nothing |

**Score:** 24/24 truths verified (5 ROADMAP SC + 20 PLAN truths, deduped to 24 distinct)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/globals.css` | .numen-surface scope-class token block + @theme inline bridge | ✓ VERIFIED | Block at 356-400; base #1a1714; `--color-numen-*` namespaced bridge; legacy `--color-accent`/`--color-border` byte-intact (lines 11/24) |
| `src/app/layout.tsx` | Source Serif 4 voice font as --font-serif | ✓ VERIFIED | `Source_Serif_4` import + `serif.variable` on html; body font-sans |
| `scripts/check-apca.ts` | Dev-only APCA contrast gate | ✓ VERIFIED | Exits 0, all 6 pairings PASS; parses palette from globals.css (WR-05 fix) |
| `tests/numen/tokens.test.ts` | Resolved-CSS-var assertions | ✓ VERIFIED | 9 tests pass |
| `src/components/numen/glass.tsx` | Glass, inline backdropFilter + Webkit | ✓ VERIFIED | Lines 47-48 |
| `src/components/numen/pill-chip.tsx` | Full-pill chip, instant/agentic via tv({slots}) | ✓ VERIFIED | tv() + intent variants |
| `src/components/numen/icon-button.tsx` | Circular 44px-min icon button | ✓ VERIFIED | 57 lines, tv() |
| `src/components/numen/surface.tsx` | Hairline-border soft-elevation container | ✓ VERIFIED | tv() surface slot |
| `src/components/numen/verdict-swatch.tsx` | Three muted verdict swatches | ✓ VERIFIED | good/mixed/bad tokens |
| `src/components/numen/stage-reveal.tsx` | AnimatePresence stage-reveal honoring reduced-motion | ✓ VERIFIED | motion/react + useReducedMotion + WR-04 fix |
| `src/app/(kit)/numen-kit/page.tsx` | Deployed kit showcase under .numen-surface | ✓ VERIFIED | 324 lines, 8 sections, all primitives |
| `tests/numen/showcase.a11y.test.tsx` | axe gate + DS-08 structural guard + next/font mock | ✓ VERIFIED | 2 tests green |
| `docs/numen-migration-boundary.md` | DS-06 inventory + replace/defer/owning-phase table | ✓ VERIFIED | 108 lines, full table + widened grep |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| globals.css @theme inline | .numen-surface custom props | `var(--numen-*)` resolved at usage | ✓ WIRED | `--color-numen-bg: var(--numen-bg)` etc. |
| layout.tsx | @theme inline --font-serif | `serif.variable` on html className | ✓ WIRED | Line 52 |
| glass.tsx | rendered DOM inline style | `style={{backdropFilter, WebkitBackdropFilter}}` | ✓ WIRED | Lines 47-48 |
| numen/*.tsx | .numen-surface tokens | tailwind utils (bg-numen-panel, border-numen-border, verdict-*) | ✓ WIRED | Confirmed across primitives |
| stage-reveal.tsx | motion/react | `import {AnimatePresence, motion, useReducedMotion}` | ✓ WIRED | Line 24 |
| numen-kit/page.tsx | src/components/numen/* + StageBlock | imports every primitive (StageBlock via KitStageDemo island) | ✓ WIRED | 5 direct imports + stage-demo.tsx:6 StageBlock |
| showcase root | .numen-surface tokens | `className="numen-surface dark"` | ✓ WIRED | Line 72 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| APCA contrast gate passes on locked palette | `npx tsx scripts/check-apca.ts` | exit 0, 6/6 PASS | ✓ PASS |
| Numen test suite green | `pnpm test --run tests/numen` | tokens 9, type 6, glass 3, primitives 4, stage-reveal 3, showcase 2, apca 3 — all pass | ✓ PASS |
| Full suite no regression | `pnpm test` | 1944 passed / 0 failed (26 skipped) | ✓ PASS |
| Production build compiles, /numen-kit static | `pnpm build` | ✓ Compiled successfully in 12.3s; /numen-kit prerendered (○) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DS-01 | 01-01 | Warm-neutral dark token system, no pure black, base ~#1a1714, hex-not-oklch | ✓ SATISFIED | globals.css numen block, build clean |
| DS-02 | 01-01, 01-02 | Verdict scale only load-bearing functional color | ✓ SATISFIED | verdict tokens + verdict-swatch |
| DS-03 | 01-01 | Brand accent = coral matured to clay #d98a5e, sparing | ✓ SATISFIED | --numen-accent; used only on focus/agentic |
| DS-04 | 01-01, 01-04 | Sans-led type, serif reserved for voice | ✓ SATISFIED | layout.tsx serif on html not body; showcase specimen |
| DS-05 | 01-02, 01-04 | Component vocabulary + glass inline backdrop-filter | ✓ SATISFIED | 6 primitives + glass inline; deployed blur approved |
| DS-06 | 01-05 | Migration boundary inventory, retire Raycast/coral/chrome/chat-dock | ✓ SATISFIED | migration-boundary.md; nothing deleted |
| DS-07 | 01-03, 01-04 | Calm motion, stage-reveal key moment | ✓ SATISFIED | StageBlock calm; ease-spring not reused |
| DS-08 | 01-04 | Keyframes carry chroma, chrome recedes | ✓ SATISFIED | showcase Section 8 + structural test |

All 8 DS requirement IDs traced from PLAN frontmatter → REQUIREMENTS.md descriptions → implementation evidence. No orphaned requirements: REQUIREMENTS.md maps exactly DS-01..08 to Phase 1, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX debt markers, no TODO/HACK/PLACEHOLDER, no stub returns, no orphaned numen files |

### Human Verification Required

None outstanding. The two human-gated items in this phase were resolved during execution:
- **01-04 Task 3 (deployed-build glass blur + serif voice pick)** — APPROVED by user on the prod Playwright build (serif = Source Serif 4, blur(12px) visible). Per task instruction, not re-blocked.
- **DS-08 keyframe-chroma perceptual sign-off** — perceptual gate signed off; structural guard test enforces adjacency in CI.

### Gaps Summary

No gaps. The phase goal is observably achieved in the codebase:

- The warm-neutral dark kit exists as a namespaced parallel token layer (`.numen-surface` → `--color-numen-*`), authored entirely in exact hex with `#1a1714` base — no pure black, no oklch.
- **The critical CR-01 regression stayed fixed:** legacy `--color-accent: var(--color-coral-500)` (globals.css:11) and `--color-border: rgba(255,255,255,0.06)` (line 24) are byte-intact; the numen bridge uses `--color-numen-*` and never redefines a legacy `@theme` key. The live coral app is not broken.
- Verdict scale + clay accent are APCA-validated (gate exits 0).
- Serif (Source Serif 4) is reserved for voice on `<html>`, not forced onto `<body>`.
- Glass uses inline backdrop-filter that structurally bypasses Lightning CSS; deployed blur was human-approved.
- The migration boundary is documented with measured counts and replace/defer dispositions; D-04 honored — `git diff main..HEAD --diff-filter=D` shows zero deletions, only additive changes to globals.css/layout.tsx + the install.
- StageBlock calm reveal honors reduced-motion with the WR-04 null-first-render fail-safe; the forbidden bouncy `--ease-spring` is not reused.
- DS-08 keyframe-chroma section present with structural guard.
- Full suite 1944 pass / 0 fail; production build compiles clean with /numen-kit prerendered static.

---

_Verified: 2026-06-11T21:34:53Z_
_Verifier: Claude (gsd-verifier)_
