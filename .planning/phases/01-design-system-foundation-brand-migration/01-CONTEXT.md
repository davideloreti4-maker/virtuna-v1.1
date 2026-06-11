# Phase 1: Design System Foundation + Brand Migration - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a **ground-up, warm-neutral, dark-only design kit** — tokens, type system, motion system, the load-bearing component vocabulary, and a glass primitive — so every later Reading component is built on it; and establish a **bounded, documented retirement** of the old Raycast/coral/glass-everywhere brand.

Direction is already locked by `NUMEN-SURFACE-VISION.md` §6 (warm neutrals / no pure black / color-only-in-verdict / clay accent / keyframes-as-chroma / sans-led + serif-voice / glass-rare / calm motion). This phase resolves the **HOW** and the §9 calibration forks — it does NOT relitigate direction.

**In scope:** new token layer, type wiring, motion tokens, core component primitives + glass primitive, a kit showcase route, palette calibration, the DS-06 migration audit/boundary doc.
**Out of scope:** building Reading/thread components (Phase 4), deleting live old-app code (deferred per-surface), the view-model/data contract (Phase 2), desktop instrument (Phase 7).
</domain>

<decisions>
## Implementation Decisions

### Coexistence & Migration Strategy
- **D-01:** **Parallel namespaced token layer.** The new warm-neutral kit coexists with the live app (10 pages / 36 components / board / landing) WITHOUT touching the existing coral/Raycast tokens in `src/app/globals.css`. Old pages keep working untouched; the Numen surface opts in. Retirement happens per-surface as each later feature phase rebuilds it. (Rejected: global `globals.css` replacement — breaks every page in one phase; route-group-scoped CSS — adds plumbing + drift risk.)
- **D-02:** **Coexistence mechanism = scope class, not a global `@theme` swap.** New tokens are CSS variables overridden under a surface root scope class (e.g. `.numen-surface`), following the Tailwind v4 multi-theme pattern (`.dark` + `.theme-*` stacking). Repo already declares `@custom-variant dark`. Use **semantic token names** (`--color-bg`, `--color-panel`, `--color-text`, `--color-verdict-good|mixed|bad`, `--color-accent`), declared in `@layer theme`. Exact file location/structure is the planner's call.
- **D-03:** **L<0.15 dark tokens authored as exact hex, NOT oklch** (Tailwind v4 oklch bug this repo has hit — see CLAUDE.md). Hard rule for the whole dark palette.

### Retirement Boundary (DS-06)
- **D-04:** **Audit + decision doc only in Phase 1 — delete nothing live.** Phase 1 ships the grep inventory (`#07080a` / `#FF7F50` / coral / GlassPanel-everywhere / fake macOS chrome / chat dock) plus a written boundary doc (what v5.0 replaces vs defers, per-surface). All actual removal happens inside each feature phase as it rebuilds that surface. Keeps the app green, zero regression risk; satisfies DS-06's "documented boundary" literally. Known costume targets located: `src/components/primitives/TrafficLights.tsx`, `src/components/sidebar/Sidebar.tsx`.

### Phase-1 Build Scope
- **D-05:** **Foundation + core primitives + showcase.** Tokens + type + motion foundation PLUS the load-bearing primitives every later Reading component depends on: full-pill tool chip, circular icon button, hairline-border / soft-elevation surface, the glass primitive (inline `backdropFilter` — Lightning CSS strips the CSS-class form, see CLAUDE.md), verdict-color swatches. (Rejected: tokens-only — leaves criterion 3 unproven until Phase 4; full component kit — over-builds before Phase 4 reveals real needs.)
- **D-06:** **Kit showcase = a custom Next.js route, NOT Storybook.** Kit is small/bespoke; Storybook's per-component story maintenance cost isn't justified at this count, and a route deploys with the app → directly satisfies the "verified on deployed build" success criterion. Location is planner's call.
- **D-07:** **Libraries are a permitted toolkit, picks delegated to research/planning.** Use Radix (already installed) as the unstyled accessible behavior layer; motion libs and curated copy-in from Magic UI / Aceternity allowed ONLY re-skinned to the warm-neutral language. **Hard rule: no neon / gradient / beam / glow / shimmer effect ships as-is** — those are the "AI-spaceship" aesthetic the vision (§3/§6) positions against. Research flag: Radix's update cadence has slowed post-WorkOS acquisition; **Base UI** (MUI-maintained, same shadcn API) is the forward option if a Radix primitive is stale — evaluate per-primitive, no wholesale migration.
- **D-08:** **Variant API = tailwind-variants** (slots + compound variants fit multi-part primitives like the pill chip / glass surface; v1 supports Tailwind v4). Repo currently has only `clsx` + `tailwind-merge` (`cn`). Not yet installed.
- **D-09:** **Icons = Lucide only** (already installed, restrained, tree-shakes, shadcn-default consistency). **Phosphor** is a sanctioned escalation ONLY if a specific verdict/active-state weight need surfaces (multi-weight thin→fill→duotone) — do not install dual icon sets upfront.
- **D-10:** **Motion lib = `motion`** (formerly Framer Motion); opacity uses tween easing, springs only on physical props → fits the "no bounce/snap" mandate, and `AnimatePresence`/stage-reveal is the right tool. **Cleanup flag:** repo has BOTH `motion` and `framer-motion` installed (duplicate) — standardize on `motion`, drop `framer-motion`.

### Palette Calibration (§9 fork)
- **D-11:** **Claude proposes a calibrated set for approval.** Derive against the warm-neutral base (~`#1a1714`): clay accent evolved from `#FF7F50` (desaturated/warmed toward terracotta) + the verdict scale (muted green / amber / clay-red). Render actual swatches/hexes during planning for user sign-off; user retains final say. All darks as exact hex.
- **D-12:** **Calibrate with APCA-aware contrast checks**, not WCAG 2 ratios alone — WCAG 2 misleads on dark backgrounds; APCA is the modern perceptual metric for dark mode. Anxious-creator audience makes legibility load-bearing.

### Voice Typography (§9 fork)
- **D-13:** **Functional sans stays Inter** (already wired, data-legible, zero migration). **Voice serif** for greeting/hero + verdict line; **lead candidate = Source Serif 4** (Adobe; screen-optimized; trustworthy weight → "warm confident mentor with weight"), **Newsreader** as the alt to specimen during planning. Fraunces only at low optical-size if used (risks reading decorative against §6). Wire via `next/font/google`, variable, self-hosted, `--font-serif` CSS var.

### Motion System (DS-07)
- **D-14:** **Motion tokens as semantic tiers** (duration: instant/fast/base/slow; easing families). The **stage-reveal is the one key motion moment**; no "presence" theater. **`prefers-reduced-motion` MUST be honored** — stage-reveal degrades to a static appear (no slide/translate), per Motion's `useReducedMotion`. Accessibility requirement, not optional.

### Claude's Discretion
- Exact token file structure / naming within the parallel layer (D-01/D-02 set the strategy, not the file layout).
- Showcase route path/location (D-06).
- Per-primitive Radix-vs-Base-UI calls (D-07).
- Final serif pick after specimen pass (D-13 sets the front-runner).
- Motion-timing token numeric values + fluid type/spacing scale.
- Whether to use the View Transitions API (Next 16) for any cross-fade — likely defer to Phase 4 (the Reading settle).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative vision (design direction — locked, do not relitigate)
- `.planning/NUMEN-SURFACE-VISION.md` §3 — core principle (tool, beauty-through-restraint, Whoop anchor, anti-spaceship wedge)
- `.planning/NUMEN-SURFACE-VISION.md` §5 — brand/perception target (calm container / alive content; warm confident mentor tone)
- `.planning/NUMEN-SURFACE-VISION.md` §6 — component/design-language direction (THE design spec for this phase: warm neutrals, color-only-in-verdict, clay accent, keyframes-as-chroma, sans+serif split, glass-rare, calm motion, retirement list)
- `.planning/NUMEN-SURFACE-VISION.md` §9 — still-open forks (clay/verdict calibration, serif pick) resolved by D-11/D-13

### Phase scope + requirements
- `.planning/ROADMAP.md` → Phase 1 (goal + 5 success criteria)
- `.planning/REQUIREMENTS.md` → DS-01 … DS-08 (8 requirements, all Phase 1)

### Current state to migrate FROM
- `src/app/globals.css` — current two-tier oklch primitive→semantic tokens, coral scale, Raycast gray, cold `#07080a` base, `@custom-variant dark`. The system the new layer parallels and the audit inventories.
- `BRAND-BIBLE.md` — the OLD Raycast Design Language reference (601 lines). Reference for the DS-06 retirement audit; **superseded by NUMEN-SURFACE-VISION §6 for the new kit** — do NOT build the new kit from BRAND-BIBLE.
- `src/components/primitives/TrafficLights.tsx`, `src/components/sidebar/Sidebar.tsx` — fake macOS window chrome (retirement audit targets).

### Known technical landmines (MUST respect)
- `CLAUDE.md` (project root) → "Known Technical Issues": Tailwind v4 oklch inaccuracy for L<0.15 (→ hex, D-03); Lightning CSS strips `backdrop-filter` from classes (→ inline `style`, D-05); dev-server CSS caching.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Installed deps usable now:** `@radix-ui/*` (accordion, alert-dialog, avatar, dialog, dropdown-menu, slot, switch, tabs + `radix-ui` meta), `motion` + `framer-motion`, `cmdk`, `clsx`, `tailwind-merge`, `lucide-react`. → behavior layer + `cn()` + icons available without new installs.
- **`next/font`** already wired for Inter (`src/app/layout.tsx`, `--font-inter`) — extend the same pattern for `--font-serif`.

### Established Patterns
- **Two-tier token architecture** (primitive → semantic) in `globals.css` `@theme` — the new layer mirrors the *structure* (semantic naming) but with warm-neutral values under a scope class, not a global swap.
- **Dark variant** = `@custom-variant dark (&:is(.dark *))` already present — the scope-class approach (D-02) stacks on this.
- **`cn()` (clsx + tailwind-merge)** is the current class-merge convention — tailwind-variants (D-08) layers on top, doesn't replace it.

### Integration Points
- New token scope class wraps the future Numen surface root; old app outside it is unaffected (D-01).
- Glass primitive must apply `backdropFilter` via React inline `style` (Lightning CSS constraint) — pattern to encode in the primitive itself.
- Showcase route mounts inside the new scope class so primitives render under real tokens (D-06).

</code_context>

<specifics>
## Specific Ideas

- **Anchor reference: WHOOP** — "Whoop for content"; verdict-first; color only in the data. Behavioral north star (validation only, not a visual source).
- **Anthropic app** — confirms warm-neutral + no-pure-black + serif-greeting-over-sans-UI (validates D-13 split).
- **Restraint set:** Linear, Things, Stripe, Apple-native, Perplexity/Arc. Deliberately AWAY from Raycast/Artificial-Societies tool language and all neon/purple sci-fi.
- **kero is NOT a source** (vision §6 note) — do not adopt its cool tone, glass-over-photo staging, stock imagery, or window chrome.
- **Keyframes are the only chroma** — warm-neutral chrome must recede so the (often cool) user video stills + the verdict carry all color/energy (DS-08, load-bearing principle).

</specifics>

<deferred>
## Deferred Ideas

- **Active deletion of live old-app code** (chat dock, TrafficLights, GlassPanel, hardcoded coral) — deferred to each surface's own rebuild phase; Phase 1 only documents the boundary (D-04).
- **View Transitions API** for cross-fade/document settle — likely Phase 4 (the Reading settle), not this phase.
- **Phosphor icon adoption** — only if a verdict/active-state weight need emerges (D-09).
- **Base UI migration** — per-primitive, only when a Radix primitive proves stale (D-07).
- **Desktop instrument density / Konva keep-vs-retire** — Phase 7.
- **Shareable image-card vs link mechanics** (§9 fork) — later phase, not the design foundation.

None of the above is scope creep into Phase 1 — all are correctly downstream.

</deferred>

---

*Phase: 1-Design System Foundation + Brand Migration*
*Context gathered: 2026-06-11*
