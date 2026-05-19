# Phase 2: Foundation & Hero - External Component Policy

**Documented:** 2026-05-10
**Phase:** 02-foundation-hero
**Requirement:** BUILD-02
**Decision lineage:** CONTEXT.md D-18, D-19, D-20; RESEARCH.md §3

<scope>
## Scope

This document is the BUILD-02 artifact that codifies the REJECT criteria for external component imports — specifically Magic UI / Aceternity UI / Origin UI / Cult UI — during the Brand Statement Landing milestone (Phases 2-6).

**Phase 2 stance:** ZERO imports from any of the four surveyed libraries. The above-fold hero is built entirely from raw Tailwind v4, the existing 36-component design system, the existing `src/components/hive/` Canvas 2D patterns, and `src/hooks/usePrefersReducedMotion.ts`. No new third-party UI dependency is introduced for the hero.

**Future phases (3-6):** MAY revisit individual imports per the ACCEPT criteria below — but only if all 7 ACCEPT criteria pass. Default disposition for any external UI library import remains REJECT until proven otherwise.

**Why this exists:** The Anthropic / Linear / Raycast / Vercel reference set all build their own primitives. Importing maximalist motion components (Aceternity AnimatedBeam, Magic UI BorderBeam, Aceternity BackgroundGradientAnimation, Cult UI BgAnimateButton) directly conflicts with the locked Raycast restraint aesthetic established in BRAND-BIBLE.md §Visual Metaphor Lock. This policy gives planners and reviewers a sharp filter against drift.

</scope>

<surveyed_libraries>
## Surveyed External Libraries

The four libraries surveyed during Phase 2 research (RESEARCH.md §3):

| Library | Site | What they ship | Distinctive aesthetic | Fit for Raycast restraint? |
|---------|------|---------------|------------------------|----------------------------|
| **Magic UI** | magicui.design | 100+ "animated React components" — Animated Beam (light traveling along path), Border Beam (animated border light), Animated Gradient Text, Neon Gradient Card, Marquee, Globe, Particles | Slightly dramatic, SaaS-maximalist, motion-heavy | NO — neon glow + animated beams conflict with Raycast restraint |
| **Aceternity UI** | ui.aceternity.com | 200+ copy-paste components (free) — Background Gradient Animation (color-shifting bg), Background Beams (SVG paths), Spotlight (light effect), Card Spotlight, Modern Hero With Gradients | Maximalist motion, dramatic gradients, spotlight effects | NO — Background Beams + Spotlight are direct Raycast violations |
| **Origin UI** (rebranded → coss.com/origin) | coss.com/origin | Banner, Table, Form, Input components built on Radix/shadcn — pre-rebrand legacy snapshot | Minimal, structural, shadcn-aligned | YES — but Phase 2 hero doesn't need form/banner/table primitives |
| **Cult UI** | cult-ui.com | DynamicIsland (animated shell), FamilyButton (expansion button), TextureButton (raised button), BgAnimateButton (animated bg), shimmer effects | Niche motion-rich Apple-island-inspired | NO — DynamicIsland + animated bg conflicts with Raycast static cards |

</surveyed_libraries>

<criteria>
## Criteria

### REJECT Criteria

Any external component matching ANY of these criteria is rejected by default. Phase 2 hero rejects ALL imports from the four surveyed libraries; future phases reject any single component matching any row below.

| # | Criterion | Concrete examples (real components) |
|---|-----------|-----|
| R1 | **Maximalist motion component** — animated beams, neon glow, spotlight effects, particle swarms-as-libraries | Magic UI `<AnimatedBeam>`, Magic UI `<BorderBeam>`, Aceternity `<BackgroundGradientAnimation>`, Aceternity `<BackgroundBeams>`, Aceternity `<Spotlight>`, Aceternity `<Spotlight New>`, Cult UI `<BgAnimateButton>` |
| R2 | **Ships its own design tokens** (font / colors / shadows that override or fight Tailwind v4 + Inter + our coral) | Any component with hardcoded font-family, fixed color values not derived from CSS variables, or its own shadow scale |
| R3 | **Peer-dep conflicts** — requires a version of `motion`, `framer-motion`, `next`, `react`, `tailwindcss` that conflicts with our installed versions (`motion@12.29.2`, `framer-motion@12.29.3`, `next@16.1.5`, `react@19.2.3`, `tailwindcss@4`) | Components requiring `framer-motion@10` (when we have v12), or React 18 (when we have 19.2.3) |
| R4 | **Bundle delta > 10 KB gzipped per single component** — hero JS budget is ~45 KB total (Canvas 30 KB + pipeline 15 KB) | Three.js-based components (600 KB+), Lottie-rendered components (50 KB+ even simple), full motion library ports |
| R5 | **A11y gaps** — no reduced-motion support, no screen-reader alternatives for visual-only content, no keyboard nav for interactive components | Components with hardcoded animations and no `useReducedMotion()` check; components that render only `<div>` decorations without `role` / `aria-label` |
| R6 | **Forces ad-hoc styling overrides** — component composition is so opinionated that brand-aligning requires CSS overrides exceeding 50 LOC | Components with deeply nested fixed colors, locked layout structures, or override-resistant default styles |

### ACCEPT Criteria

For FUTURE phases (3-6) only — Phase 2 explicitly rejects all imports regardless of these criteria. A component MAY be considered for import if ALL of these are true:

| # | Criterion |
|---|-----------|
| A1 | **Single component, copy-paste** — code lives in our `src/components/landing/` after import, no transitive npm dep |
| A2 | **Restyled to coral + Raycast tokens** — all hardcoded colors swapped for `var(--color-accent)` / `var(--color-foreground)` / `var(--color-border)` etc. |
| A3 | **Vocab-lint passes** — any text strings introduced by the component pass `pnpm lint:vocab` clean |
| A4 | **Bundle delta verified** — measured against `pnpm build` before/after; documented in the importing plan |
| A5 | **A11y verified** — manually tested with screen reader (VoiceOver / NVDA) and keyboard nav; reduced-motion verified |
| A6 | **Reference-fidelity check** — component's visual feel matches Anthropic / Linear / Raycast / Vercel restraint, not Magic UI / Aceternity maximalism |
| A7 | **No peer-dep conflict** — verified against current `package.json` dependency tree |

</criteria>

<phase2_policy>
## Phase 2 Explicit Policy

ZERO imports from Magic UI / Aceternity / Origin UI / Cult UI for the hero. The hero is built from:

1. Raw Tailwind v4 utility classes
2. Existing `src/components/ui/button.tsx` (CVA Button)
3. Existing `src/components/hive/use-canvas-resize.ts` (hook reuse)
4. Existing `src/hooks/usePrefersReducedMotion.ts` (hook reuse)
5. Inline Canvas 2D API (no library)
6. CSS `radial-gradient` (no library)
7. `motion/react` for any future scroll-reveal motion (NOT needed in Phase 2 hero — animation is canvas-driven)

This list is closed. Any import outside it during Phase 2 hero work is a policy violation and must be reverted before plan acceptance.

</phase2_policy>

<future_phases>
## Future Phase Considerations (Deferred Decisions)

- **Phase 3 (Demo + How It Works + Bento):** Engine pipeline diagram (WORKS-01..06) uses SVG + `motion/react` — already locked in BRAND-BIBLE.md §Visual Metaphor Lock addendum. Bento cells (SURF-01..06) reuse the existing `src/components/ui/extension-card.tsx` Raycast card pattern. **No external library needs identified.**
- **Phase 4 (Science + Social Proof + Pricing):** Marquee for testimonials (PROOF-02) reuses the existing `src/components/ui/marquee.tsx`. **No external library needs identified.**

**Reassessment trigger:** A planner identifies a single component that genuinely matches all 7 ACCEPT criteria above. The default disposition through Phase 4 remains: build from existing primitives + raw Tailwind v4. No external library needs identified through Phase 4.

</future_phases>

## Sign-off

- [ ] Davide reviewed policy
- [ ] Phase 2 hero ships zero external imports — verified by grep against src/
