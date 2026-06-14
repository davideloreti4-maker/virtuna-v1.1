# Requirements: Landing v2 — Refined Marketing Site

**Defined:** 2026-06-14
**Core Value:** A refined, premium marketing landing that makes a creator instantly *get* Numen — "know if it'll pop before you post" — and click "Try it free." Clears the taste bar five prior attempts missed.

> Marketing surface only. Every product visual is a labelled, swappable **placeholder** the human fills later. No engine/app/Supabase product logic beyond the CTA link. Inputs: `.planning/LANDING-VISION.md` + `.planning/MILESTONE.md`.

## v1 Requirements

Requirements for the initial landing release. Each maps to a roadmap phase.

### Foundation & Cross-Cutting (FOUND)

- [ ] **FOUND-01**: Visitor lands on the new marketing page at `/`, replacing the current home
- [ ] **FOUND-02**: Page renders dark-only using the **flat-warm** Numen design system ported from the `~/virtuna-numen-rework` worktree (neutral charcoal #262624 surfaces, cream #ece7de text, terracotta-clay coral #d97757, Inter for UI + Newsreader serif for voice moments, flat-matte — no glass/glow; 6%/10% borders + 12px radius carried as-is). _Supersedes the old `main` Raycast brand (#FF7F50/#07080a/glass) — see `phases/01-foundation-shell/01-CONTEXT.md`._
- [ ] **FOUND-03**: A reusable placeholder-slot component renders labelled, aspect-ratio-correct stand-ins (image / video / avatar / logo variants) swappable via one prop or one file
- [ ] **FOUND-04**: Motion is wired via motion (Framer Motion) plus permitted libs (shadcn/Radix/Magic UI/Aceternity) behind a global reduced-motion fallback
- [ ] **FOUND-05**: Every section is responsive mobile-first, from 320px through desktop
- [ ] **FOUND-06**: Heavy motion/media lazy-loads and the page holds a premium performance bar (no layout shift from slots; Lighthouse mobile performance ≥90)
- [ ] **FOUND-07**: The page is keyboard-navigable with semantic landmarks, visible focus states, and WCAG AA contrast

### Navigation & Chrome (NAV)

- [ ] **NAV-01**: A header shows the Stele logo + "Numen" wordmark and a "Try it free" CTA
- [ ] **NAV-02**: A footer provides brand, in-page section links, and legal/social placeholders
- [ ] **NAV-03**: On small screens the header collapses to a mobile-appropriate nav (menu and/or CTA)

### Hero & Signature Moment (HERO)

- [ ] **HERO-01**: The hero presents a hybrid-voice headline + subcopy communicating "know if it'll pop before you post"
- [ ] **HERO-02**: The hero's primary "Try it free" CTA routes to the existing app signup
- [ ] **HERO-03**: The hero centerpiece is the signature "crowd → score" moment — a synthetic audience reacts to a video and resolves into a virality score
- [ ] **HERO-04**: The signature moment has a reduced-motion / lazy fallback (static composed frame) so it never blocks first paint or breaks accessibility

### Social Proof (PROOF)

- [ ] **PROOF-01**: A social-proof strip shows creator avatars and a logo wall (placeholder slots)
- [ ] **PROOF-02**: A testimonials section shows creator quote cards (placeholder avatars + quotes)

### Story & Showcase (STORY)

- [ ] **STORY-01**: A "how it works" section walks three steps — paste TikTok link → audience simulates → get your reading (placeholder frames)
- [ ] **STORY-02**: A "the reading" showcase presents the output — audience simulation, watch-through %, and Hook · Retention (where viewers drop) · Shareability — via placeholder product frames
- [ ] **STORY-03**: Three to four feature deep-dive blocks each pair a benefit with a placeholder visual

### Conversion (CONVERT)

- [ ] **CONVERT-01**: A pricing teaser presents tiers (Starter/Pro) with "Try it free" CTAs (placeholder-ok pricing)
- [ ] **CONVERT-02**: A final full-width CTA band ("Try it free") sits before the footer
- [ ] **CONVERT-03**: An FAQ section answers common creator questions in an accessible accordion

## v2 Requirements

Deferred to a future release. Tracked, not in this roadmap.

### Expansion (EXPND)

- **EXPND-01**: Multi-route expansion — standalone `/pricing`, `/about`, `/manifesto`
- **EXPND-02**: Real-asset integration pass — swap all placeholders for shipped screenshots/videos/logos/testimonials
- **EXPND-03**: Hero-variant A/B testing
- **EXPND-04**: Localization / i18n

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live "paste a link → reading" engine demo | Needs the live engine (out of scope); CTA routes to the app instead. A faked demo risks feeling dishonest. |
| Waitlist / email capture backend | CTA is "Try it free" → existing app signup; no waitlist needed. |
| Light mode | Dark-only — brand is dark, all refs are dark, light mode already out-of-scope project-wide. |
| Separate routes (/pricing, /about) in v1 | Single long-scroll for v1; multi-route deferred to v2. |
| Real product assets (screenshots/video/logos/quotes) | Placeholders only; human swaps in later via the slot system. |
| Engine / app / Supabase product logic | Marketing surface only — beyond the CTA link, nothing. |
| Reviving any of the 5 abandoned landing branches' code | Reference only, per `MILESTONE.md`. |
| Blog / changelog / docs surfaces | Not part of the v1 marketing landing. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 5 | Pending |
| FOUND-06 | Phase 5 | Pending |
| FOUND-07 | Phase 5 | Pending |
| NAV-01 | Phase 1 | Pending |
| NAV-02 | Phase 1 | Pending |
| NAV-03 | Phase 1 | Pending |
| HERO-01 | Phase 2 | Pending |
| HERO-02 | Phase 2 | Pending |
| HERO-03 | Phase 2 | Pending |
| HERO-04 | Phase 2 | Pending |
| PROOF-01 | Phase 4 | Pending |
| PROOF-02 | Phase 4 | Pending |
| STORY-01 | Phase 3 | Pending |
| STORY-02 | Phase 3 | Pending |
| STORY-03 | Phase 3 | Pending |
| CONVERT-01 | Phase 4 | Pending |
| CONVERT-02 | Phase 4 | Pending |
| CONVERT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22 ✓
- Unmapped: 0 ✓

Per-phase rollup:
- Phase 1 (Foundation & Shell): FOUND-01, FOUND-02, FOUND-03, FOUND-04, NAV-01, NAV-02, NAV-03 (7)
- Phase 2 (Hero & Signature Moment): HERO-01, HERO-02, HERO-03, HERO-04 (4)
- Phase 3 (Story & Showcase): STORY-01, STORY-02, STORY-03 (3)
- Phase 4 (Proof & Conversion): PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03 (5)
- Phase 5 (Quality Hardening): FOUND-05, FOUND-06, FOUND-07 (3)

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 — traceability populated by roadmap creation (5 phases, 22/22 mapped)*
