---
phase: 01-foundation-route-scaffolding
plan: 02
subsystem: design-system / magic-ui
tags: [magic-ui, shadcn-cli, next-themes, motion/react, coral-tuning, raycast-design-language, wave-0]
requires:
  - 01-01 (Wave 0 invariant tests landed at src/components/magic-ui/__tests__/)
provides:
  - src/components/magic-ui/ directory with 3 tuned primitives (MagicCard, BorderBeam, ShineBorder)
  - src/components/magic-ui/index.ts barrel for future-phase imports
  - components.json registries["@magicui"] infrastructure for future installs
  - @keyframes shine + --animate-shine in src/app/globals.css
  - next-themes@^0.4.6 dependency for Magic Card useTheme hydration
affects:
  - components.json (registries field added, persistent)
  - package.json + pnpm-lock.yaml (next-themes added)
  - src/app/globals.css (@theme inline block extended with --animate-shine + @keyframes shine)
tech-stack:
  added:
    - next-themes@^0.4.6
  patterns:
    - shadcn namespace registry (@magicui/<name>)
    - source-level prop default tuning at install time (D-05)
    - aliases.ui temporary flip pattern (RESEARCH §Pitfall 5)
    - motion/react useReducedMotion guard (Magic Card + Border Beam)
    - motion-safe:animate-shine Tailwind class (Shine Border)
key-files:
  created:
    - src/components/magic-ui/magic-card.tsx
    - src/components/magic-ui/border-beam.tsx
    - src/components/magic-ui/shine-border.tsx
    - src/components/magic-ui/index.ts
  modified:
    - components.json
    - package.json
    - pnpm-lock.yaml
    - src/app/globals.css
decisions:
  - next-themes installed at ^0.4.6 (App Router compatible, mounted-guard hydration pattern)
  - aliases.ui flipped to @/components/magic-ui for install, restored after barrel (D-04)
  - registries["@magicui"] persisted in components.json (future-phase install infrastructure)
  - shadcn CLI auto-injected @keyframes shine into globals.css @theme inline block — RESEARCH §Pitfall 6 manual fallback NOT needed
  - useReducedMotion from motion/react (single-package guard, avoids adding usePrefersReducedMotion import overhead)
metrics:
  duration: 4m35s
  tasks: 5
  files_created: 4
  files_modified: 4
  commits: 5
  completed_date: 2026-05-11
---

# Phase 1 Plan 02: Magic UI Primitive Install + Tune Summary

Install + tune the 3 hero-targeted Magic UI primitives (Magic Card, Border Beam, Shine Border) using the shadcn CLI namespace registry, with coral/Raycast defaults baked in at install time (D-05).

## What Shipped

- **next-themes@^0.4.6** added to dependencies — Magic Card hard-codes `useTheme` from this package; lockfile updated, no other deps affected.
- **components.json `registries["@magicui"]` field** added — persistent infrastructure for future Magic UI installs via `npx shadcn@latest add @magicui/<name>`.
- **`src/components/magic-ui/` directory** with 3 tuned primitive source files:
  - `magic-card.tsx` (218 lines) — coral spotlight defaults, Raycast surface fill, hydration-guard preserved, reduced-motion guard added
  - `border-beam.tsx` (118 lines) — coral-to-transparent sweep, 8s Raycast pace, reduced-motion `return null` guard
  - `shine-border.tsx` (70 lines) — 3-stop coral gradient palette, 18s duration, `motion-safe:animate-shine` already in source
- **`src/components/magic-ui/index.ts`** barrel — named re-exports for `MagicCard`, `BorderBeam`, `ShineBorder`. Mirrors existing `src/components/ui/index.ts` pattern.
- **`src/app/globals.css`** extended — shadcn CLI auto-injected `--animate-shine: shine var(--duration) infinite linear` token + `@keyframes shine` block into the `@theme inline` block (lines 317-329). RESEARCH §Pitfall 6 manual fallback NOT needed.

## Per-Primitive Tuning Diff

### Magic Card — `src/components/magic-ui/magic-card.tsx`

| Prop | Stock default | Tuned value | Line |
|------|--------------|-------------|------|
| `gradientFrom` | `"#9E7AFF"` (violet) | `"#FF7F50"` (coral) | 73 |
| `gradientTo` | `"#FE8BBB"` (pink) | `"rgba(255,127,80,0.15)"` (coral fade) | 74 |
| `gradientColor` | `"#262626"` | `"#18191a"` (--color-surface) | 71 |
| `gradientOpacity` | `0.8` | `0.6` (Raycast subtlety) | 72 |

**Hydration guard preserved (RESEARCH §Pitfall 1):**
- `useState(false)` for `mounted` — present at line 86
- `useEffect(() => setMounted(true), [])` — present at line 88
- `suppressHydrationWarning` on inner motion.div — present at lines 193 + 209

**Reduced-motion guard added (UI-SPEC §Magic Card spec):** `useReducedMotion()` from `motion/react` (line 92); `handlePointerMove` short-circuits when set, so spotlight stays off-card and card renders static.

### Border Beam — `src/components/magic-ui/border-beam.tsx`

| Prop | Stock default | Tuned value | Line |
|------|--------------|-------------|------|
| `colorFrom` | `"#ffaa40"` (amber) | `"rgba(255,127,80,0.9)"` (coral hi-opacity) | 69 |
| `colorTo` | `"#9c40ff"` (violet) | `"rgba(255,127,80,0)"` (coral fade transparent) | 70 |
| `duration` | `6` (s) | `8` (s, Raycast pace) | 68 |
| `size` | `50` | `40` (less eye-catching beam head) | 66 |
| `borderWidth` | `1` | `1` (unchanged, Raycast 1px standard) | 75 |

**Reduced-motion guard added (UI-SPEC §Border Beam spec):** `useReducedMotion()` from `motion/react` (line 76); when set, `return null` — underlying 1px card border still renders from parent.

### Shine Border — `src/components/magic-ui/shine-border.tsx`

| Prop | Stock default | Tuned value | Line |
|------|--------------|-------------|------|
| `shineColor` | `"#000000"` (string) | `["rgba(255,127,80,0.8)", "rgba(255,127,80,0.15)", "rgba(255,127,80,0.8)"]` (3-stop coral gradient arc array) | 38-42 |
| `duration` | `14` (s) | `18` (s, Raycast restrained motion) | 37 |
| `borderWidth` | `1` | `1` (unchanged, Raycast 1px) | 36 |

**Reduced-motion behavior:** `motion-safe:animate-shine` Tailwind class already present in source (line 63 of original, line 71 of tuned). When user prefers reduced motion, animation suppressed; static 1px border remains visible.

## @keyframes shine Injection — CLI Auto, Not Manual

**Outcome:** AUTO-INJECTED by shadcn CLI in Task 2 (single `npx shadcn@latest add @magicui/magic-card @magicui/border-beam @magicui/shine-border` invocation).

**Where it landed:** Inside the `@theme inline` block at the bottom of `src/app/globals.css` (lines 317-329), alongside the marquee tokens. Block content matches the registry spec verbatim:

```css
--animate-shine: shine var(--duration) infinite linear
;
  @keyframes shine {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  to { background-position: 0% 0%; }
  }
```

RESEARCH §Pitfall 6 manual fallback was NOT needed. The shadcn CLI version resolved by `latest` correctly handled `cssVars.theme` + `css` block injection for Tailwind v4 + shadcn `new-york / cssVariables: true` config.

## Reduced-Motion Guards — Auditing the Three Primitives

| Primitive | Registry source provided guard? | Action taken |
|-----------|---------------------------------|---------------|
| Magic Card | No explicit guard in source | Added `useReducedMotion()` from `motion/react`; `handlePointerMove` short-circuits when set |
| Border Beam | No guard in source | Added `useReducedMotion()` from `motion/react`; `return null` at top of render |
| Shine Border | `motion-safe:animate-shine` Tailwind class already present | No change needed — Tailwind variant correctly suppresses the animation when `prefers-reduced-motion: reduce` is active |

Chose `useReducedMotion()` from `motion/react` over `usePrefersReducedMotion` from `@/hooks/usePrefersReducedMotion` for Magic Card + Border Beam: `motion/react` is already imported in both files, so a single-package guard avoids an extra cross-package import. UI-SPEC §Border Beam spec explicitly approves `useReducedMotion()` from `motion/react`. UI-SPEC §Magic Card spec mentioned `usePrefersReducedMotion` but accepted the same gate — no semantic difference at runtime, both consume the same `(prefers-reduced-motion: reduce)` media query.

## components.json Diffs

| State | Step | aliases.ui | registries |
|-------|------|------------|------------|
| Before plan | — | `@/components/ui` | (absent) |
| After Task 1 | Flip + add registries | `@/components/magic-ui` | `{"@magicui": "https://magicui.design/r/{name}.json"}` |
| After Task 5 | Restore aliases.ui | `@/components/ui` | `{"@magicui": "https://magicui.design/r/{name}.json"}` (persistent) |

The `registries` field stays after Task 5 — future Magic UI installs in Phase 2-6 can now use the namespace form `npx shadcn@latest add @magicui/<name>`.

## pnpm-lock.yaml Diff Scope

`next-themes@0.4.6` added to lockfile under `dependencies` block. No transitive dep changes outside next-themes itself — it ships as a leaf-only addition (no nested deps). Resolved version: `0.4.6`, packed for `react@19.2.3` + `react-dom@19.2.3` (peer deps satisfied by existing project versions).

## Test Status (Wave-0 Invariants)

| Test file | Before plan | After plan | Notes |
|-----------|-------------|------------|-------|
| `magic-card.test.ts` | RED (5/5 fail) | GREEN (5/5 pass) | Asserts file exists, 'use client' directive, coral defaults, no stock violet/pink, mounted-state guard preserved |
| `border-beam.test.ts` | RED (5/5 fail) | GREEN (5/5 pass) | Asserts file exists, 'use client', coral rgba, no stock amber/violet, motion/react import |
| `shine-border.test.ts` | RED (5/5 fail) | GREEN (5/5 pass) | Asserts file exists, 'use client', coral palette array, no stock black, @keyframes shine in globals.css |
| `marketing-shell.test.ts` | RED (6/6 fail) | RED (6/6 fail) | EXPECTED — Plan 03's responsibility; marketing route + layout + landing deletion belong to next plan |

Total: **15/15 Plan 02 invariants GREEN** + **6/6 Plan 03 invariants still RED (by design)**.

## Build Status

`pnpm run build` exits **0**. 55/55 static pages render. Compiled successfully in 6.1s. No TypeScript errors, no missing-import errors, no missing-keyframe warnings. Turbopack issued a minor "lockfile root inference" warning unrelated to this plan (pre-existing).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `4ba19c7` | `chore(01-02): install next-themes and configure Magic UI registry` |
| 2 | `5a06cfa` | `feat(01-02): install Magic UI primitives and tune Magic Card to coral defaults` |
| 3 | `23856b3` | `feat(01-02): tune Border Beam to coral sweep + 8s duration + reduced-motion guard` |
| 4 | `7cab9fe` | `feat(01-02): tune Shine Border to coral palette + 18s duration` |
| 5 | `ffce3a3` | `chore(01-02): add magic-ui barrel export and restore components.json aliases.ui` |

## Deviations from Plan

None — plan executed exactly as written. All 5 tasks landed atomically. No Rule 1/2/3 auto-fixes needed. No checkpoint hits.

## Success Criteria — All Met

- [x] **SC-2** — At least one Magic UI primitive (all 3 in fact) is installed, tuned to Raycast tokens, exported through `src/components/magic-ui/index.ts`. Future phases (2 hero, 3 bento, 6 pricing) can `import { MagicCard, BorderBeam, ShineBorder } from "@/components/magic-ui"`.
- [x] **SC-2.tuning** — Stock violet/amber/black defaults are gone from source files. Coral defaults are the new defaults at the source level (not at consumption sites). Grep confirms zero matches for `#9E7AFF`, `#FE8BBB`, `#ffaa40`, `#9c40ff`, `shineColor: "#000000"` across all 3 primitives.
- [x] All 3 Magic UI Wave-0 invariant tests are GREEN (15/15).
- [x] Build is clean (exit 0).
- [x] `components.json` left in a state safe for future shadcn-native adds (`aliases.ui` restored to `@/components/ui`, registries persisted).

## Known Stubs

None. Each primitive is the tuned production-ready version with its own header comment block documenting source, install date, and tuning reference (per UI-SPEC §Component Directory Contract).

## Threat Flags

None — plan added no new threat surface beyond the disposed `T-02-01` to `T-02-05` register in the plan's `<threat_model>`. Vendor source content checks (no `fetch()`, no `process.env`, no `eval()`) confirmed by grep before commit; the registry safety table in UI-SPEC §Registry Safety (recorded `view passed — no flags` for all 3 primitives on 2026-05-11) gates Gate 9 of the vetting checklist for Plan 03+.

## Self-Check: PASSED

- **Files exist:** `src/components/magic-ui/{magic-card,border-beam,shine-border,index}.tsx` + `src/app/globals.css` (modified) + `package.json` + `components.json` — all FOUND on disk.
- **Commits exist:** `4ba19c7`, `5a06cfa`, `23856b3`, `7cab9fe`, `ffce3a3` — all FOUND in `git log`.
- **Tests pass:** 15/15 Magic UI Wave-0 invariants GREEN; marketing-shell remains RED (Plan 03's scope, expected).
- **Build clean:** `pnpm run build` exit code 0.
