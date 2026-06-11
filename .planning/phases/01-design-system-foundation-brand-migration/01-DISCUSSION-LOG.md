# Phase 1: Design System Foundation + Brand Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 1-Design System Foundation + Brand Migration
**Areas discussed:** Coexistence & migration, Retirement boundary, Phase-1 build scope, Library strategy, Palette calibration, Voice typography
**Standing instruction:** Always lead with the recommended option (recommended option listed first, marked "(Recommended)").

---

## Coexistence & Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel namespaced layer | New warm-neutral tokens under a distinct namespace; old coral/Raycast tokens untouched; per-surface retirement | ✓ |
| Replace globals.css wholesale | Rip out coral/Raycast tokens globally; instantly breaks all 10 pages / 36 components | |
| Scoped route-group CSS | New tokens loaded only under new route group; isolation at routing layer, adds plumbing + drift risk | |

**User's choice:** Parallel namespaced layer (Recommended)
**Notes:** Coexistence mechanism researched → scope class (`.numen-surface`) overriding CSS variables, Tailwind v4 multi-theme pattern; not a global `@theme` swap.

---

## Retirement Boundary (DS-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + decision doc only | Grep inventory + written boundary doc; delete nothing live; removal per feature phase | ✓ |
| Audit + delete dead costume now | Also remove fake macOS chrome + chat dock in P1; risks shared layout/sidebar | |
| Audit + full coral/glass purge | Aggressively strip coral + GlassPanel now; largest blast radius | |

**User's choice:** Audit + decision doc only (Recommended)

---

## Phase-1 Build Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Foundation + core primitives + showcase | Tokens/type/motion + pill chip, icon button, surface, glass primitive, verdict swatches, in a kit showcase route | ✓ |
| Tokens + type + motion only | Pure foundation, no components; criterion 3 unproven until Phase 4 | |
| Full component kit | Broad ground-up component set now; over-builds before Phase 4 needs are known | |

**User's choice:** Option 1 + "utilize all libraries if needed (Magic UI, Aceternity, Radix etc)"
**Notes:** Showcase resolved to a custom Next.js route (not Storybook) via research — kit small, route satisfies "verified on deployed build."

---

## Library Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Radix mechanics + curated motion, Numen-styled | Radix for a11y behavior; copy-in motion ideas re-skinned; no neon ships | ✓ (governing rule) |
| Anything goes, fastest path | Adopt Magic UI/Aceternity effects as-is; fights restraint mandate | |
| Radix-only, no decorative kits | Behavior from Radix, all visuals from scratch | |

**User's choice:** "im not a expert just wanted it noted, if there are libraries out there that you want to utilize (motion etc) you can consider"
**Notes:** Recorded as recommended boundary = libraries permitted as toolkit; restraint rule holds (no neon/gradient ships as-is); specific picks delegated. Research surfaced: Radix cadence slowed post-WorkOS → Base UI is forward option (per-primitive). Variant API → tailwind-variants. Icons → Lucide-only (Davide deferred: "you decide"). Motion → `motion` (drop framer-motion dupe).

---

## Palette Calibration (§9 fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Claude proposes a calibrated set for approval | Derive clay + verdict scale vs warm-neutral base; user reviews swatches | ✓ |
| Lock exact hexes now | User supplies exact values in discussion | |
| Defer to dedicated UI spec pass | Run /gsd-ui-phase first | |

**User's choice:** I propose a calibrated set for approval (Recommended)
**Notes:** Research → calibrate with APCA-aware contrast (WCAG 2 misleads on dark), all darks as exact hex.

---

## Voice Typography (§9 fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Warm literary serif + keep Inter | Inter stays for sans; warm serif for greeting/hero + verdict line | ✓ |
| Swap sans too | Replace Inter with characterful sans + voice serif; full migration | |
| I propose 2-3 pairings to compare | Render specimens during planning | |

**User's choice:** Warm literary serif + keep Inter (Recommended)
**Notes:** Research → Source Serif 4 as lead (screen-optimized, trustworthy weight), Newsreader as alt to specimen, Fraunces high-risk. All Google Fonts → next/font ready.

---

## Claude's Discretion

- Icons: Davide said "you decide" → Lucide-only base, Phosphor as sanctioned escalation.
- Library picks (Radix vs Base UI per-primitive, exact motion choices) delegated to research/planning.
- Token file layout, showcase route path, motion-timing values, fluid type scale, final serif pick after specimen.

## Deferred Ideas

- Active deletion of live old-app code (chat dock, TrafficLights, GlassPanel, coral) → each surface's rebuild phase.
- View Transitions API → likely Phase 4 (Reading settle).
- Phosphor adoption → only on a verdict/active-state weight need.
- Base UI migration → per-primitive when Radix proves stale.
- Desktop instrument / Konva keep-vs-retire → Phase 7.
- Shareable image-card vs link mechanics → later phase.
