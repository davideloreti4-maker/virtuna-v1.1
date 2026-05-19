# Phase 1: Foundation + Cross-Cutting Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-foundation-cross-cutting-gates
**Areas discussed:** Route group scope, Token specifics, Craft rubric + section brief shape, Visual fidelity baseline

---

## Discussion Frame

User's overarching directive (verbatim): *"i dont have much technical knowleadge match linear 1:"*

Interpretation:
- Limited technical knowledge for foundation-layer choices → delegating to Claude
- Craft execution bar = Linear 1:1
- Boundary preserved by milestone rules: palette stays coral, copy stays Virtuna-original, illustrations stay Virtuna-original

Claude resolved all 4 selected gray areas with defaults grounded in this directive.

---

## Route group scope

| Option | Description | Selected |
|--------|-------------|----------|
| A: Stay in `(marketing)/layout.tsx` | Lenis + LazyMotion + landing.css affect sibling pages (/pricing, /showcase, /coming-soon). Simplest. | ✓ |
| B: New `(landing)` route group | Carve out scope just for landing. Cleaner isolation but new route group churn. | |
| C: Conditional / per-page guards | Mount providers conditionally inside (marketing) layout. More complex. | |

**Decision:** A — Stay in `(marketing)/layout.tsx`. Sibling pages get Lenis smooth-scroll inherited (benign / mild UX win). Token namespace `--landing-*` prevents collisions. Researcher to verify no Radix dialog conflict on `/pricing`.

**Notes:** Avoids new route group churn for a single landing page. Trade-off documented in CONTEXT.md (D-01, D-02, D-03).

---

## Token specifics

| Option | Description | Selected |
|--------|-------------|----------|
| A: Extract Linear's tokens directly | Live DevTools inspection of linear.app; lift display scale, easings, tracking, line-height. Fastest path to matching craft bar. | ✓ |
| B: Virtuna-original tokens benchmarked to Linear bar | Design fresh values matching Linear's *quality* but not its *values*. Original-er but slower and risks missing the bar. | |
| C: Researcher spike with 2-3 references | Compare Linear / Stripe / Vercel; synthesize Virtuna-native scale. Most thorough, highest cost. | |

**Decision:** A — Extract Linear's craft tokens directly. Display scale `clamp()` values, motion easings, tracking, line-height, spacing rhythm all lifted via DevTools inspection. Coral `#FF7F50` overrides every color. Gradient tokens defined fresh from coral + Raycast neutrals (Linear's purple-gradient is the palette boundary — not adopted).

**Notes:** Milestone explicitly carves out "general typographic scale and rhythm" and "spacing and grid discipline" as allowed references. Tokens are craft execution layer, not content or palette. Researcher confirms exact `clamp()` values at plan-phase time.

---

## Craft rubric + section brief shape

| Option (rubric) | Description | Selected |
|--------|-------------|----------|
| A: Pass/Fail per dimension | 5 dimensions × binary. Fast. Loses gradient. | |
| B: Numeric 1-5 per dimension with threshold | Quantitative. Auditable. Pass = every dim ≥ 4 AND avg ≥ 4.4. | ✓ |
| C: Free-form prose review with failure modes | Qualitative. Demands judgment. Harder to automate. | |

| Option (section brief) | Description | Selected |
|--------|-------------|----------|
| A: Lightweight 1-page (purpose, audience, copy bullets, success) | Quick to fill, fits conversational drafting. | ✓ |
| B: Heavy (full copy draft + layout sketch + motion intent) | Maximal derivative-feel prevention. Slow to fill. | |
| C: Lightweight first, expand on rejection | Adaptive. | |

**Decisions:**
- Rubric B: Numeric 1-5 across 5 dimensions (typography, spacing, motion, mobile, contrast). Pass threshold: every dim ≥ 4 AND avg ≥ 4.4. Applied by `gsd-ui-auditor` at phase verification.
- Section brief A: Lightweight 1-page with 6 fields. Filled in conversation at top of each `/gsd-plan-phase` for phases 2-7. No markup without committed brief.

**Notes:** Rubric stays at `.planning/CRAFT-RUBRIC.md`. Template stays at `.planning/SECTION-BRIEF-TEMPLATE.md`. Phase 1 ships template + one annotated worked example.

---

## Visual fidelity baseline

| Option | Description | Selected |
|--------|-------------|----------|
| A: Per-section self-baseline only | First-ship Playwright snapshots become regression target. Pure regression detection. | (combined w/ B) |
| B: Side-by-side craft judgment against Linear | Auditor agent reviews Virtuna against Linear screenshots qualitatively. Never pixel-diff. | (combined w/ A) |
| C: Internal mockup screenshots as comparison target | Pre-built mockups serve as the baseline. Higher upfront cost. | |
| D: Pixel-diff against linear.app | Rejected — derivative violation + impossible. | |

**Decision:** Combined A + B — two-track verification:
- **Regression track:** Playwright `data-section` snapshots at 375/768/1280, self-baselined on first ship.
- **Craft judgment track:** `gsd-ui-auditor` does side-by-side qualitative review against Linear screenshots during rubric scoring. Never pixel-diff.

**Notes:** `data-section="<name>"` attribute documented as a convention. Existing `verification/scripts/visual-comparison.spec.ts` is extended additively (societies.io coverage preserved, new landing suite added).

---

## Claude's Discretion

User explicitly delegated implementation details. Claude locked defaults for:

- Old landing deletion: single commit, no `_legacy/`, no archive tag (git history is backup)
- Motion package: landing uses `motion@12.29.2` + LazyMotion + `m.*`; dashboard stays on `framer-motion@12.29.3`. Coexistence accepted; future consolidation out of scope.
- `next/font` Inter `axes: ['opsz']` added in place (no provider swap)
- `next.config.ts` minimal: add `images.formats`, keep Sentry + transpilePackages untouched
- `@next/bundle-analyzer` as devDep with `analyze` script + README snippet
- Web Vitals: console-only in dev for Phase 1; Vercel Analytics deferred to Phase 8 / post-milestone
- `MotionWrapper` pattern: one worked example component + JSDoc; subsequent phases follow pattern
- Visual-fidelity-harness update is additive (no removal of societies.io regression coverage)
- Baseline empty page: `<main data-section="placeholder" />` with nav-height spacer + minimal H1 so Lighthouse runs cleanly
- Gradient `--landing-gradient-feature-border`: researcher proposes 2-3 candidates from coral + Raycast neutrals; user selects in Phase 3

## Deferred Ideas

- Light mode variant — out of scope (milestone level)
- Live demo widget in hero — deferred to its own milestone
- Vercel Analytics production wiring — Phase 8 or post-milestone
- Motion package consolidation (`framer-motion` → `motion` repo-wide) — future phase
- Command-K palette on landing — deferred (PROOF-08 / REQUIREMENTS.md)
- `_legacy/` folder for old landing components — rejected; git history is the backup
