# Phase 2: Hero Centerpiece & Reading Explainer - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the existing above-fold `#hero` SectionShell slot (scaffolded empty in
Phase 1) with the real product as the centerpiece: a **real Reading staged on a
real creator video**, full-bleed and chrome-minimal (krea/luma content-as-hero),
with the **verdict shown as a calibrated band + one-line why** (never a naked
number), revealed via the calm in-app **StageBlock / `numen-ease-calm`** motion
language with a `prefers-reduced-motion` static fallback. Immediately below,
a **3-step explainer** (upload → engine reads → verdict + why) demonstrates the
real flow using the same real Reading content. The **primary CTA** is present in
the hero.

The roadmap's flagged **D-L2** open decision (live-interactive vs recorded-loop
hero) is **resolved this phase** via a light spike (see D-13).

**In scope (Phase 2):** real Reading hero artifact + verdict throne (HERO-01..04);
3-step explainer with real-content demonstration (READ-01, READ-02); primary hero
CTA present + routing (CTA-01); the D-L2 hero-implementation spike + the single
captured/staged hero asset.

**Out of scope (later phases):** honesty/comparison section, real-Readings
gallery, social proof, conversion section + **live waitlist capture**, footer CTA
repeat (Phase 3 — TRUST/GALLERY/PROOF/CONTENT-02/CTA-02, D-L4 assets); final token
swap, scroll-driven reveal choreography (MOT-01), LCP-optimized hero media, OG art,
full a11y pass, palette direction D-L1 (Phase 4 — DS-03/MOT-01/PERF-01/03/D-L3).

Covers requirements: **HERO-01, HERO-02, HERO-03, HERO-04, READ-01, READ-02, CTA-01**.
</domain>

<decisions>
## Implementation Decisions

### Hero artifact & D-L2 implementation
- **D-01 (resolves D-L2):** The hero centerpiece is a **recorded / pre-captured
  stage-reveal loop**, NOT a live interactive Reading and NOT a static single
  appear. One real captured Reading is replayed **full-bleed** via the existing
  `StageBlock` (`numen-ease-calm`) as a **calm auto-reveal loop**, chrome minimal
  (krea content-as-hero). Live-interactive was explicitly rejected: the engine is
  frozen and lives in a sibling worktree (`~/virtuna-numen-surface` / app), so it
  is **not callable from the landing deploy**, and live calls would hurt LCP /
  reliability / cost. Recorded loop is reliable, perf-controllable, engine-independent.
- **D-02 (hero asset source, HERO-02):** Primary path — **capture ONE real Reading
  from the live app**: run a single real creator video through the app's `/analyze`
  (in the sibling app worktree) and **export the real Reading** (keyframes + stage
  payload + verdict + why) as a **static asset bundle** the landing ships and
  replays. **Fallback (if capture is blocked this milestone):** stage a **REAL
  creator-video keyframe** (a real still — never stock, never a fake browser
  window) with a real-shaped verdict + why. Either path satisfies HERO-02; both
  forbid stock photos and fake window chrome.

### Verdict throne (HERO-03)
- **D-03:** The hero shows a **confident "this will likely land" (good/green) band
  with a specific, non-flattery one-line why** — naming a real strength and one
  fixable note (register e.g. "Strong hook in the first 2s — tighten the middle
  and it lands"). Aspirational AND honest AND specific (luma discipline). It must
  obey VOICE Rule 3 (band + why, never a naked number) and Rules 1–2 (no jargon,
  no hype/% precision). Honest-"mixed" and rotating-verdicts were considered and
  deferred (see Deferred / Discretion).
- **D-04:** **Composition** — the verdict is **anchored ON the content** (overlaid
  on the full-bleed Reading keyframe, krea chrome-minimal), so the content
  dominates and the verdict reads as the focal "throne," not a sidebar card. Build
  on the existing `VerdictSwatch` band colors (good/mixed/bad are peers, muted not
  saturated; on-swatch text must meet APCA Lc ≥ 60).

### 3-step explainer (READ-01, READ-02)
- **D-05:** **Static 3 steps reusing the hero's real artifacts** — a kero
  3-feature-card adaptation for the real flow (**upload → engine reads → verdict +
  why**). Each step is demonstrated with the **same real Reading content**: real
  keyframe for "upload," real stage-read for "reads," real verdict band + why for
  "verdict." Satisfies READ-02 ("each step shows real content") ship-first.
- **D-06:** "Content is both demo and navigation" (READ-02) is honored **lightly**:
  steps are anchored and **may be clickable to the hero** (optional enhancement).
  Full **interactive scrubbing** (clicking a step drives/scrubs the hero Reading)
  is **deferred** — richer/more on-reference but more build and tightly couples the
  explainer to the hero artifact.

### Hero CTA (CTA-01)
- **D-07:** The hero CTA is **present and functional, routing to the `#cta`
  conversion section** (scroll anchor — the slot already exists from Phase 1).
  **Live waitlist email capture is deferred to Phase 3**, which owns CTA-02 + the
  actual conversion UI + D-L4 credibility assets. Deep-linking into the app's
  `/analyze` was rejected (the app may not be reachable from the separate landing
  deploy). Keeps Phase 2 focused on the hero/Reading.

### Carried forward (locked in Phase 1 — do not re-decide)
- **Tokens/primitives:** consume the `.numen-surface` token layer + `numen/`
  primitives; **never fork or reinvent tokens** (DS-01 / D-09). Tokens are
  placeholders; final swap is Phase 4 (D-L3).
- **Motion:** `StageBlock` / `numen-ease-calm` is THE motion language; reduced
  motion degrades to a **static opacity appear, no translate** (D-14 / HERO-04).
  Do not add bouncy/presence theater.
- **Single h1:** the hero is the page's only top-level heading; it fills the
  existing `#hero` slot via `SectionShell` with **no `heading=` prop** (D-10).
- **Voice:** every word obeys `.planning/VOICE.md` — zero engine jargon (Rule 1),
  zero hype / fake precision / "% accuracy" (Rule 2), verdict = band + why never a
  number (Rule 3).

### Claude's Discretion
- Exact component file split under `src/components/numen-landing/` (e.g.
  `hero.tsx`, `reading-loop.tsx`, `verdict-throne.tsx`, `how-it-works.tsx`).
- Loop cadence/timing, dwell-on-verdict duration, and whether the loop pauses on
  the verdict before restarting (must stay calm — no presence theater).
- The asset-bundle format for the captured Reading (image sequence vs poster +
  keyframe set vs short muted video) — planner/spike choose for LCP/weight.
- Whether the 3 explainer steps are clickable-to-hero (D-06 light option) vs
  purely static this phase.
- Precise copy wording (must obey VOICE.md) including the exact verdict band label
  + one-line why; the specific creator niche shown.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Landing spec, voice & structure (this milestone)
- `.planning/LANDING-STRUCTURE.md` — base spec: locked reference set (kero spine +
  voice / krea + luma content-as-hero / anti-snake-oil rivals), design discipline
  (§2), positioning spine (§3), section wireframe (§4 — hero + how-it-works slots),
  open decisions (§5 — **D-L2** resolved here, D-L1/D-L3/D-L4 deferred).
- `.planning/VOICE.md` — **canonical voice SSOT**; every heading/subhead/button/
  microcopy/alt/verdict line MUST pass its self-check (Rules 1–3, do/don't words).
- `.planning/REQUIREMENTS.md` — Phase 2 owns HERO-01..04, READ-01, READ-02, CTA-01.
- `.planning/ROADMAP.md` §"Phase 2" — goal + 4 success criteria.

### Phase 1 outputs (the shell this phase fills)
- `.planning/phases/01-foundation-shell-voice-baseline/01-CONTEXT.md` — D-01..D-11
  (route, shell, slots, token consumption, single-h1 rule).
- `.planning/phases/01-foundation-shell-voice-baseline/01-UI-SPEC.md` — the Phase 1
  UI design contract (rhythm, slots, motion constraints) the hero must stay coherent with.
- `src/app/(marketing)/page.tsx` — the seven ordered section slots; the `#hero`
  slot to fill (currently h1 + subhead + placeholder `#cta` button) and the
  `#how-it-works` slot for the explainer.
- `src/components/numen-landing/section-shell.tsx` — `heading?` optional; hero
  passes no `heading=` (renders only its h1 child).

### Design system primitives (consume — never fork; DS-01)
- `src/components/numen/stage-reveal.tsx` — `StageBlock` ({show, children}); the
  ONE load-bearing motion; reduced-motion = static appear. The hero loop builds on this.
- `src/components/numen/verdict-swatch.tsx` — `VerdictSwatch` (good/mixed/bad peer
  bands, muted, APCA Lc ≥ 60 for on-swatch text) — the verdict band base.
- `src/components/numen/{pill-chip,icon-button,glass,surface}.tsx` — supporting primitives.
- `src/app/globals.css` `.numen-surface` scope — placeholder tokens + verdict band
  colors + `--numen-ease-calm` + Tailwind bridge (`bg-bg`/`text-text`/etc.).
- `src/components/brand/numen-logo.tsx` — brand mark (nav/footer already wired).

### Engine/app data shape (for the captured Reading export — reference only, frozen)
- `src/test/fixtures/stage-events.ts`, `src/test/fixtures/completed-prediction.ts`
  — existing fixtures showing the Reading **stage + verdict data shape** to mirror
  when capturing/exporting the real hero Reading.

### Authoritative brand (cross-worktree — coherence, not forking)
- `~/virtuna-numen-surface/.planning/phases/01-design-system-foundation-brand-migration/01-UI-SPEC.md`
  — in-app design contract (the system being calibrated).
- `~/virtuna-numen-surface/.planning/NUMEN-SURFACE-VISION.md` — authoritative brand vision.
- `BRAND-BIBLE.md` (repo root) — brand/design reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StageBlock` (`numen/stage-reveal.tsx`): the calm reveal the hero loop replays
  per stage; reduced-motion fallback already built + tested (HERO-04 for free).
- `VerdictSwatch` (`numen/verdict-swatch.tsx`): verdict band colors + APCA gate —
  the base for the verdict throne (HERO-03).
- `SectionShell` (`numen-landing/section-shell.tsx`): hero slot (`heading` optional)
  + `#how-it-works` slot already mounted in `page.tsx`.
- `.numen-surface` token scope + Tailwind bridge — opt-in already active on the
  marketing body.

### Established Patterns
- Single-h1 page: hero renders its own `<h1>` child; non-hero slots emit internal
  `<h2>` via `heading=`. The explainer goes under `#how-it-works` (its h2 stays).
- Tailwind v4 CSS-first; verdict classes are LITERAL strings (never `bg-${verdict}`
  interpolation — Tailwind can't see dynamic strings).
- `tailwind-variants` (`tv`) for component variants (see VerdictSwatch).

### Integration Points
- Fill `#hero` and `#how-it-works` in `src/app/(marketing)/page.tsx`.
- New hero/explainer components under `src/components/numen-landing/` (net-new).
- Captured Reading asset bundle → `public/` (path/format = planner/spike choice).
- Hero CTA → existing `#cta` anchor (live capture is Phase 3).

### Known constraints (CLAUDE.md)
- Lightning CSS strips `backdrop-filter` → apply via React inline `style`, not CSS class.
- Tailwind v4 oklch inaccuracy for very dark colors (L < 0.15) → dark tokens use exact hex.
- Dev-server CSS caching: kill dev server + clear `.next/` when CSS changes don't appear.

</code_context>

<specifics>
## Specific Ideas

- **D-L2 is resolved as recorded loop**, not live — the engine being frozen +
  cross-worktree makes live infeasible from the landing deploy regardless of the
  perf tradeoff. The "light spike" (D-13 below) exists to validate the **capture →
  export → replay** pipeline + LCP/weight and to produce the one hero asset; if
  capture is blocked, the staged-real-keyframe fallback (D-02) still satisfies HERO-02.
- **Verdict register is confident-but-honest**: a "this will likely land" good band
  whose one-line why names a real strength + a fixable note. The honesty moat is
  carried by the *reasoning*, not by showing a discouraging verdict in the hero.
  ("Only Numen could have written this line" — VOICE self-check #5.)
- **"Seeing = doing" (krea)** is satisfied ship-first by the explainer steps
  reusing the hero's real artifacts; full interactive scrubbing is a deferred enhancement.
- Anti-snake-oil is a **voice posture baked into every line**, not a section — zero
  "% accuracy" anywhere in the hero or explainer.

## Spike note (D-13)
- **D-13:** Run a **light spike** to (1) confirm a real Reading can be captured/
  exported from the app as a static, landing-shippable asset bundle, and (2) measure
  the recorded-loop's LCP/weight as a full-bleed hero. Spike outcome gates D-02's
  primary-vs-fallback asset path. Keep it light — ship-first per LANDING-STRUCTURE §6.

</specifics>

<deferred>
## Deferred Ideas

- **Live interactive Reading** in the hero — rejected this phase (engine frozen /
  cross-worktree / LCP); revisit only if the engine becomes landing-callable.
- **Honest "mixed signals" verdict** and **rotating multi-niche verdicts** in the
  hero — considered for HERO-03; deferred. Rotating verdicts (range/specificity
  proof) is a natural fit for the **Phase 3 Real Readings gallery** (GALLERY-01/02).
- **Interactive content-as-navigation** (clicking explainer steps scrubs the hero
  Reading) — deferred enhancement of READ-02.
- **Live waitlist / email capture + footer CTA repeat** → **Phase 3** (CTA-01 live
  wiring + CTA-02), with the conversion section + D-L4 credibility assets.
- **Final token swap (D-L3), scroll-reveal choreography (MOT-01), LCP/OG/a11y
  polish, palette direction (D-L1)** → **Phase 4**.
- **Deleting orphaned stale `components/landing/*` + `layout/header|footer.tsx`** →
  Phase 4 cleanup (per Phase 1 D-04).

None of the above were dropped — each is mapped to its owning phase.

</deferred>

---

*Phase: 02-hero-centerpiece-reading-explainer*
*Context gathered: 2026-06-12*
