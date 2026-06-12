# Roadmap: Numen Landing (v5.1)

## Overview

A net-new public marketing landing for the Numen brand, built in its own worktree (`milestone/numen-landing`) parallel to the Numen Surface app. The landing **consumes** the Numen Surface Phase 1 `.numen-surface` design system (token layer + primitives + StageBlock) — it never forks or invents tokens (DS-01). The journey is forced by a deliberate timing decouple (DS-02 / D-L3): everything token-independent — section architecture, copy, layout, hero artifact, the page's content sections — is built **now against placeholder tokens**, so the landing is never blocked waiting on Numen Surface Phase 1; a final phase performs the token swap + motion choreography + perf/SEO/a11y polish once Phase 1 calibration signs off.

Structure follows the kero spine → Numen content → krea/luma staging wireframe in `LANDING-STRUCTURE.md`. Phase 1 lays the shell + voice baseline (the anti-snake-oil, confident-mentor register that shapes copy page-wide). Phase 2 builds the content-as-hero centerpiece (a real Reading on a real creator video — resolving the open D-L2 live-vs-recorded decision via a light spike) plus the 3-step Reading explainer. Phase 3 builds the conviction sections — the honesty moat, the comparison move, the real-Readings gallery, and social proof — and closes the conversion loop. Phase 4 swaps in the final tokens, layers the calm scroll-reveal motion, and clears the launch bar (LCP, OG, a11y).

The honesty/anti-snake-oil posture (TRUST) is not a single section — it is the positioning moat, baked into the voice baseline (Phase 1) and explicit in copy (Phase 3). Zero "X% accuracy" claims appear anywhere on the page.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked INSERTED)

Milestone-scoped numbering (fresh worktree): phases start at 1.

- [x] **Phase 1: Foundation, Shell & Voice Baseline** - Next.js landing scaffold consuming `.numen-surface` placeholder tokens; minimal nav + footer; calm confident-mentor voice baseline; SEO meta + kero-paced section rhythm scaffold (completed 2026-06-12)
- [ ] **Phase 2: Hero Centerpiece & Reading Explainer** - Content-as-hero — a real Reading staged on a real creator video (resolve live-vs-recorded D-L2); calibrated-band verdict; 3-step upload→reads→verdict explainer with real content; primary CTA
- [ ] **Phase 3: Honesty Moat, Gallery, Proof & Conversion** - Anti-snake-oil trust section + Numen-vs-rivals comparison; gallery-quality real Readings across ≥3 niches; social proof; positioning copy; conversion CTA wired to waitlist/app entry
- [ ] **Phase 4: Token Lock, Motion & Launch Polish** - Swap in final `.numen-surface` tokens on Phase 1 calibration sign-off; calm scroll-driven reveals; LCP/perf, OG cards, accessibility, brand-DNA coherence

## Phase Details

### Phase 1: Foundation, Shell & Voice Baseline

**Goal**: A deployable Next.js landing scaffold exists that consumes the `.numen-surface` design system (placeholder tokens, build-tolerant), with a minimal product-focused nav + footer, the calm confident-mentor voice baseline that will shape every section's copy, and the kero-modeled section rhythm scaffold + base SEO meta — all token-independent so nothing blocks on Numen Surface Phase 1.
**Depends on**: Nothing (first phase)
**Requirements**: DS-01, DS-02, NAV-01, CONTENT-01, MOT-02, PERF-02
**Success Criteria** (what must be TRUE):
  1. The landing renders under the `.numen-surface` token scope with NO forked or reinvented tokens — it imports the Numen Surface primitives, and visibly tolerates placeholder tokens without breaking layout
  2. A visitor sees a minimal, product-focused top nav and a footer on every viewport (mobile-first)
  3. Page copy reads in the calm, plain-language, confident-mentor voice with zero engine jargon — the established voice baseline later sections inherit
  4. The page exposes SEO meta (title/description) and a kero-modeled section-rhythm scaffold (ordered section slots) that later phases fill
**Plans**: 3 plans
  - [x] 01-01-PLAN.md — De-hype root metadata + author canonical `.planning/VOICE.md` baseline (scope mount moved to 01-03 marketing wrapper per Option B / D-02)
  - [x] 01-02-PLAN.md — Build the three `numen-landing/` shell components: SectionShell slot, sticky opaque Nav (mobile hamburger), static Footer
  - [x] 01-03-PLAN.md — Wire it: marketing layout → no-html passthrough mounting `.numen-surface` wrapper `<div>` (Nav/main/Footer) + page → ordered SectionShell slots + de-hype OG image copy

### Phase 2: Hero Centerpiece & Reading Explainer

**Goal**: The above-fold hero leads with the product itself — a real Reading staged on a real creator video, full-bleed with minimal chrome (krea/luma content-as-hero), verdict shown as a calibrated band + one-line why (never a naked number) — with the live-interactive-vs-recorded-loop implementation (D-L2) resolved via a light spike; immediately below, a 3-step explainer (upload → engine reads → verdict + why) demonstrates the flow with real content; the primary CTA is present in the hero.
**Depends on**: Phase 1
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04, READ-01, READ-02, CTA-01
**Success Criteria** (what must be TRUE):
  1. A visitor on mobile sees, above the fold, an intelligence/verdict headline + subhead + primary CTA, with a real Reading on a real creator video as the full-bleed centerpiece — NOT a stock photo or fake browser window
  2. The hero verdict reads as a calibrated band + one-line why — no naked number and no "X% accuracy" anywhere in the hero
  3. The hero animates with the calm stage-reveal language (StageBlock / `numen-ease-calm`) and degrades to a static appear under `prefers-reduced-motion`
  4. A visitor can read a three-step explainer (upload → engine reads → verdict + why) where each step is demonstrated with real content, not an abstract diagram
**Plans**: 4 plans
  - [x] 02-01-PLAN.md — Wave 0: Nyquist test scaffolds (5 RED component tests) + APCA label-on-band gate extension
  - [ ] 02-02-PLAN.md — Verdict throne (HERO-03) on VerdictSwatch + real-keyframe human checkpoint (HERO-02 asset)
  - [ ] 02-03-PLAN.md — Recorded stage-reveal ReadingLoop (HERO-02/04) + Hero column with locked CTA (HERO-01/CTA-01)
  - [ ] 02-04-PLAN.md — 3-step real-content explainer (READ-01/02) + page slot wiring
**UI hint**: yes

### Phase 3: Honesty Moat, Gallery, Proof & Conversion

**Goal**: The page earns belief and converts: an anti-snake-oil trust section contrasts Numen's calibrated honest verdict against the "virality score" snake-oil tier using a kero-style comparison move (zero fake-precision claims); a luma-style gallery presents gallery-quality real Readings across ≥3 distinct creator niches; a social-proof block anchors credibility early where real assets exist; positioning copy reads "honest verdict creators can believe, explicitly not hype"; and the conversion CTA (repeated near the footer) routes to app entry / waitlist capture and records the signup.
**Depends on**: Phase 2
**Requirements**: TRUST-01, TRUST-02, GALLERY-01, GALLERY-02, PROOF-01, PROOF-02, CONTENT-02, CTA-02
**Success Criteria** (what must be TRUE):
  1. A visitor sees a trust section that contrasts Numen's calibrated honest verdict against fake-precision "virality score" rivals via a comparison framing — and finds zero "X% accuracy" claims anywhere on the page
  2. A visitor browses a gallery of real Readings spanning ≥3 distinct creator niches, each rendered as a gallery-quality content centerpiece (luma staging), not a feature diagram
  3. A visitor encounters a social-proof block (testimonials and/or live waitlist count) with credibility anchored early on the page
  4. The page's positioning copy reads "an honest verdict creators can believe," explicitly not hype, in the inherited confident-mentor voice
  5. A visitor can act on a conversion CTA (repeated near the footer) that routes to app entry or waitlist capture and records the signup
**Plans**: TBD
**UI hint**: yes

### Phase 4: Token Lock, Motion & Launch Polish

**Goal**: Once Numen Surface Phase 1 calibration signs off (D-L3), the landing swaps placeholder tokens for the final `.numen-surface` tokens + primitives while preserving brand-DNA coherence with the app (logo, verdict color language; landing tone may diverge per D-L1); calm scroll-driven section reveals reuse the in-app motion language (no bounce, no presence theater); and the launch bar is cleared — mobile-first responsive with LCP-optimized hero media, OG/social-share cards, APCA contrast + reduced-motion + semantic structure.
**Depends on**: Phase 3 (and externally gated on Numen Surface Phase 1 calibration sign-off, D-L3)
**Requirements**: DS-03, MOT-01, PERF-01, PERF-03, PERF-02
**Success Criteria** (what must be TRUE):
  1. The page renders on the final `.numen-surface` tokens (placeholders gone) and is visibly brand-coherent with the app (logo, verdict color language), with no broken layout from the swap
  2. Sections reveal with calm scroll-driven motion reusing the in-app language — no bounce/snappy, no presence theater — and honor `prefers-reduced-motion`
  3. The hero media is optimized for fast mobile load (good LCP) and the page is mobile-first responsive end-to-end
  4. The page ships SEO meta + OG/social-share cards, and passes accessibility — inherited APCA contrast, reduced-motion fallback, semantic structure
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Shell & Voice Baseline | 3/3 | Complete   | 2026-06-12 |
| 2. Hero Centerpiece & Reading Explainer | 1/4 | In Progress|  |
| 3. Honesty Moat, Gallery, Proof & Conversion | 0/0 | Not started | - |
| 4. Token Lock, Motion & Launch Polish | 0/0 | Not started | - |

---
*Roadmap created: 2026-06-11 — milestone v5.1 Landing. Source: `.planning/LANDING-STRUCTURE.md` + `REQUIREMENTS.md`. Consumes Numen Surface Phase 1 design system (DS-01); token swap gated on Phase 1 calibration (D-L3).*
*Phase 1 planned: 2026-06-11 — 3 plans (foundation/voice, shell components, wiring) in 2 waves.*
