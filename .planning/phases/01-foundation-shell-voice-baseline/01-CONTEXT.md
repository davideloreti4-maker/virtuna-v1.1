# Phase 1: Foundation, Shell & Voice Baseline - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A deployable Next.js landing scaffold that consumes the existing `.numen-surface`
design system (placeholder tokens, build-tolerant), with a minimal product-focused
nav + footer, the calm confident-mentor **voice baseline** that shapes every later
section's copy, the kero-modeled section-rhythm scaffold (ordered, anchored section
slots), and base SEO meta — all **token-independent** so nothing blocks on Numen
Surface Phase 1 calibration.

**In scope (Phase 1):** route + layout that mounts under `.numen-surface`; nav +
footer shell; `.planning/VOICE.md` baseline + applied placeholder copy; semantic
section slots in kero order with in-voice headings + anchors + correct vertical
rhythm; SEO meta (title/description).

**Out of scope (later phases):** real Reading hero artifact + verdict + 3-step
explainer (Phase 2); honesty/comparison/gallery/proof/conversion sections (Phase 3);
final token swap + scroll-reveal motion choreography + LCP/OG/a11y polish (Phase 4).
Section slots are scaffolded **empty of real content** in Phase 1 — they are filled
by Phases 2-4.

Covers requirements: **DS-01, DS-02, NAV-01, CONTENT-01, MOT-02, PERF-02**.
</domain>

<decisions>
## Implementation Decisions

### Route & old-landing disposition
- **D-01:** The new Numen landing owns `/` by **rebuilding the existing
  `(marketing)` route group in place** — replace `src/app/(marketing)/layout.tsx`
  and `src/app/(marketing)/page.tsx`. Do NOT create a new route group or sandbox
  path; the Numen landing IS the root marketing page.
- **D-02:** The new `(marketing)/layout.tsx` mounts the landing under the design
  system: `<body className="numen-surface ...">` (see D-09). New Numen-branded
  metadata replaces the stale "Artificial Societies | Human Behavior, Simulated"
  metadata.
- **D-03:** New landing **shell** components live in a clean new directory
  `src/components/numen-landing/` (e.g. `nav.tsx`, `footer.tsx`, `section-shell.tsx`).
  This avoids colliding with the stale generic-SaaS `src/components/landing/*`.
- **D-04:** The stale assets — `src/components/landing/*` (HeroSection,
  BackersSection, FeaturesSection, StatsSection, CaseStudySection,
  PartnershipSection, FAQSection, etc.) and the stale `src/components/layout/header.tsx`
  + `src/components/layout/footer.tsx` (both societies.io-branded) — are
  **orphaned now** (stop importing them from the marketing route). Do NOT delete
  them this phase; flag for deletion in Phase 4 polish. Dev/showcase routes under
  `(marketing)` (`showcase`, `primitives-showcase`, `pricing`, `board-preview`,
  `coming-soon`, etc.) stay **untouched**.

### Nav + footer (NAV-01)
- **D-05:** Top nav = `NumenLogo` (left, from `src/components/brand/numen-logo.tsx`)
  + inline anchor links (How it works · Honesty · Gallery) + a primary CTA button
  (right). Anchors target the section-slot `id`s that Phases 2-3 fill.
- **D-06:** Mobile pattern: logo + primary CTA stay inline; the anchor links
  collapse into a hamburger menu. Build a clean Numen version (do not reuse the
  stale `layout/header.tsx`), but its slide-down/overlay/outside-click/body-scroll-lock
  behavior is a valid reference pattern.
- **D-07:** Footer = `NumenLogo` + one-line positioning copy (in voice), an anchor
  repeat + legal placeholders (Privacy / Terms — placeholder links OK this phase),
  social links (X, LinkedIn), a footer **CTA slot**, and copyright. Keep minimal.
  (Live CTA wiring / waitlist capture is CTA-01/CTA-02 → Phases 2-3; Phase 1 only
  provides the slot + placeholder CTA.)

### Voice baseline (CONTENT-01)
- **D-08:** Codify the voice as **two artifacts**:
  1. A durable **`.planning/VOICE.md`** guide — the canonical voice reference that
     Phases 2-4 read before writing any copy. Captures: calm, plain-language,
     confident-mentor register; second-person ("your content"); **zero engine
     jargon**; **zero "X% accuracy" / "predict virality" hype** (anti-snake-oil
     moat); verdict always framed as **calibrated band + one-line why, never a
     naked number**; specificity over abstract claims (luma). Include do/don't
     word lists + 2-3 example hero/section copy lines.
  2. **Applied placeholder copy** in the Phase 1 scaffold — hero headline + subhead,
     section headings, nav labels, footer positioning line — all written in this
     voice so the baseline is demonstrated, not just described.
- **D-08a:** Example register to seed VOICE.md (placeholder, refinable): hero H1
  ≈ "Know if your content will land — before you post."; subhead ≈ "Numen reads
  your video like your sharpest audience would and gives you an honest verdict you
  can act on." No numbers, no jargon, confident but not hype.

### Scaffold fidelity & placeholder tokens (DS-01, DS-02, MOT-02)
- **D-09:** Build consumes the **existing `src/app/globals.css` `.numen-surface`
  token scope as the placeholder tokens** (DS-02). The landing mounts the body
  under `.numen-surface` and uses the already-bridged Tailwind tokens (`bg-bg`,
  `text-text`, `text-text-muted`, `bg-panel`, `border-border`, accent/verdict
  tokens, `--numen-ease-calm`). **No forked or reinvented tokens** (DS-01). No
  separate placeholder token set is created. Phase 4 swaps these for the final
  calibrated tokens on Numen Surface Phase 1 sign-off (D-L3).
- **D-10:** Scaffold fidelity = **semantic `<section>` slots in kero order**, each
  with an `id` (nav anchor target), an in-voice placeholder heading, and correct
  kero vertical rhythm/spacing — **but no real media/artifacts**. Slot order
  (from LANDING-STRUCTURE §4): Hero → How the Reading works → Honesty moat → Real
  Readings gallery → Social proof → Final CTA → Footer. Slots are skeleton
  containers (heading + spacing), not empty divs and not fully built content.
- **D-11:** SEO meta (PERF-02): Phase 1 ships title + description (+ basic
  metadata) via Next metadata on the marketing layout/page. Full OG/social-share
  card art is Phase 4 (PERF-02 also re-touched there) — Phase 1 establishes the
  baseline meta, not the share-image pipeline.

### Claude's Discretion
- Exact component file split within `src/components/numen-landing/` (single
  `nav.tsx`/`footer.tsx` vs further decomposition).
- Which existing `numen/` primitives to reuse in the shell (`StageBlock`,
  `pill-chip`, `icon-button`, `surface`, `glass`) — planner/executor choose based
  on fit; note Phase 1 motion is minimal (MOT-01 scroll-reveal choreography is
  Phase 4, MOT-02 here is only the section **rhythm/pacing** scaffold).
- Precise placeholder copy wording (must obey VOICE.md register).
- Anchor `id` naming convention.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Landing spec & structure (this milestone)
- `.planning/LANDING-STRUCTURE.md` — base spec: locked reference set (kero spine
  + voice / krea + luma content-as-hero / anti-snake-oil rivals), design discipline
  guardrails (§2), positioning spine (§3), section wireframe (§4 — the slot order),
  open decisions (§5).
- `.planning/REQUIREMENTS.md` — full v1 requirement set + traceability; Phase 1
  owns DS-01, DS-02, NAV-01, CONTENT-01, MOT-02, PERF-02.
- `.planning/ROADMAP.md` §"Phase 1" — goal + success criteria.

### Design system (in-fork — the placeholder tokens to consume)
- `src/app/globals.css` — the `.numen-surface` token scope (lines ~337-390):
  warm-neutral placeholder tokens, verdict band colors, `--numen-ease-calm`,
  and the Tailwind bridge (`--color-bg` etc.). **DS source of truth this phase.**
- `src/components/numen/` — consumable primitives: `stage-reveal.tsx` (StageBlock,
  props `{show, children}`), `verdict-swatch.tsx`, `pill-chip.tsx`, `icon-button.tsx`,
  `glass.tsx`, `surface.tsx`.
- `src/components/brand/numen-logo.tsx` — `NumenLogo` brand mark for nav + footer.

### Authoritative brand (in-app, cross-worktree — read for coherence, not forking)
- `~/virtuna-numen-surface/.planning/phases/01-design-system-foundation-brand-migration/01-UI-SPEC.md`
  — in-app design contract (the system being calibrated; landing must stay coherent).
- `~/virtuna-numen-surface/.planning/NUMEN-SURFACE-VISION.md` — authoritative brand vision.
- `BRAND-BIBLE.md` (repo root) — brand/design reference.

### Voice (to be authored this phase)
- `.planning/VOICE.md` — **created in Phase 1** (D-08); the canonical voice baseline
  Phases 2-4 inherit.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/brand/numen-logo.tsx` (`NumenLogo`): nav + footer brand mark.
- `src/components/numen/*`: StageBlock + numen primitives already built under the
  `.numen-surface` system — the landing consumes these (DS-01).
- `src/app/globals.css` `.numen-surface` scope: tokens + Tailwind bridge already
  wired — opt in by mounting `<body className="numen-surface">`.
- Existing `(marketing)` route group already owns `/` (rebuild in place, D-01).
- Stale `src/components/layout/header.tsx` mobile-menu behavior = a reference
  pattern for the new Numen nav (not a direct reuse — it's societies.io-branded).

### Established Patterns
- Next.js App Router with route groups; `(marketing)` group has its own
  `layout.tsx` + `globals.css` import + Inter font wiring.
- Design system is opt-in per-surface via the `.numen-surface` class (globals.css
  comment: "a surface opts in by mounting under `.numen-surface`").
- Tailwind v4 CSS-first; tokens bridged as `--color-*` → `bg-bg`/`text-text`/etc.

### Integration Points
- `src/app/(marketing)/layout.tsx` + `page.tsx` — the files to rebuild.
- New shell dir `src/components/numen-landing/` — net-new.
- `.planning/VOICE.md` — net-new canonical doc.

### Known constraints (from CLAUDE.md)
- Tailwind v4 oklch inaccuracy for very dark colors (L < 0.15) → dark tokens use
  exact hex (already handled in `.numen-surface`).
- Lightning CSS strips `backdrop-filter` → apply via React inline `style` not CSS class.
</code_context>

<specifics>
## Specific Ideas

- Anti-snake-oil is a **positioning moat baked into the voice**, not a section —
  zero "X% accuracy" anywhere on the page, starting with Phase 1 placeholder copy.
- "Copy the skeleton, not the skin" (kero): take the section bones + intelligence
  voice register; the visitor never sees kero's grey-green glass-over-photo skin.
- Section slots must be real `<section id="...">` anchors so the nav links work
  the moment Phases 2-3 fill them.
- Stale marketing landing is the **societies.io / "Artificial Societies"** product
  — entirely wrong brand; treat as dead, do not carry any of its copy forward.
</specifics>

<deferred>
## Deferred Ideas

- Real Reading hero artifact, verdict band, 3-step explainer, hero CTA → **Phase 2**
  (HERO-01..04, READ-01/02, CTA-01; D-L2 hero spike).
- Honesty/comparison section, real-Readings gallery, social proof, conversion CTA
  + waitlist capture → **Phase 3** (TRUST/GALLERY/PROOF/CONTENT-02/CTA-02; D-L4 assets).
- Final token swap, scroll-driven reveal choreography (MOT-01), LCP-optimized hero
  media, OG/social-share card art, full a11y pass → **Phase 4** (DS-03/MOT-01/PERF-01/03;
  D-L1 palette, D-L3 token-lock gate).
- Deleting the orphaned stale `components/landing/*` + `layout/header|footer.tsx` →
  Phase 4 cleanup.
- Use-case/persona section, blog, i18n → **v2** (USECASE/BLOG/I18N, out of this roadmap).

</deferred>

---

*Phase: 01-foundation-shell-voice-baseline*
*Context gathered: 2026-06-11*
