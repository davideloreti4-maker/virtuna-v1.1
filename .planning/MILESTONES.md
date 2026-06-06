# Milestones — Virtuna

## v4.0 Apollo (Shipped: 2026-06-06)

**Phases completed:** 5 phases, 22 plans, 26 tasks · ENGINE_VERSION 3.8.0 · merged to main via PR #13

**Delivered:** Turned the ~25-call score-and-fabrication engine into **Apollo** — a 3-call, knowledge-grounded expert (Omni verbatim sensor → fold ∥ Apollo reasoner). Insight is the hero; the score demoted to an honest band. E2E latency ~312s → ~62–74s.

**Key accomplishments:**

- **P1 Strip to Senses** — deleted the fabricated `predicted-engagement` (views=f(score)+jitter) + dead machinery (ml.ts, audio-fingerprint, trends, platform_fit, stage11); blend cut to live signals only (R9 honest-by-deletion).
- **P2 Omni Verbatim** — sharpened the sensor to verbatim hook/segments (R1 proven on real runs); Omni plus→flash flip (36s→17s first paint).
- **P3 Apollo Reasoner (the moat)** — knowledge-core-grounded §4 reasoner (distilled Chase Hughes corpus, cached system prompt — not fine-tuning); rewrites + 6 band-anchored scored dimensions; one brain across score AND remix modes (R12).
- **P4 Audience-Sim Fold (the bet)** — DELETED the 10-pass persona loop; a single bounded fold call is the sole audience-sim path (FOLD_THINKING_BUDGET tuned).
- **P5 Wire + Surface** — D-01 deterministic rubric-sum score (kills ±5 swing); R11 grounded engagement range (follower_count × quality read); insight-hero board frame (dual-read, copyable rewrites, demoted band); dead fake-engagement UI stripped.
- **Close-out** — R11 positive path surfaced on the board + persisted (was computed but stranded on an orphaned surface); IN-02 hero leads with ceiling_capper (UI + aggregator fix); omni-flash drift hardened (emotion_arc.label + weakest_modality); `/gsd-secure-phase 5` SECURED 12/12.

**Verification:** 5/5 human UAT PASS (live E2E 62.4s; R11 render→persist→reload); 1429 tests green.

**Known deferred at close** (see STATE.md Deferred Items): 6 orphaned quick-task refs (dirs gone), 2 uat_gaps + 2 verification_gaps (stale / superseded by P5 close-out).

---

## Result Surface (Shipped: 2026-05-28)

**Phases completed:** 6 phases — Foundation SSE + Engine Signal Extensions; Board Substrate Navigation; Engine Rework Pass 2 (timeline-weighted aggregator + heatmap + filmstrip + Phase 3 SSE); Live Audience Node; Other Group Nodes (Verdict/Actions/Content Analysis populated); Reshoot Script + Optimal Post Time.

**Branch / worktree:** `milestone/result-surface` at `~/virtuna-result-surface/`. Merged to main via PR #3 at `94b4663`.

**Key accomplishments:**

- Board-substrate result surface replacing legacy /dashboard (atomic /dashboard sunset with 307 redirect to /analyze)
- Pass 2 timeline-weighted aggregator + persona weights + `assembleHeatmapPayload`
- Phase 3 dual-trigger anti-virality gating via `isAntiViralityGatedFull` (confidence + timeline_pattern reason discriminator + dropoff segment indices)
- Live Audience heatmap node with mobile Radix Sheet drawer
- Reshoot script API + niche-aware optimal post window from `niche_post_windows` materialized aggregate (daily pg_cron)
- Verdict / Actions / Content Analysis group nodes populated end-to-end
- ContentForm video frame extraction → board thumbnail pipeline
- Apollo tier picker (popover) replacing legacy span label

**Test posture at merge:** 1619/1620 unit tests green (one flaky `Sidebar.recent.test.tsx` — passes in isolation). `tsc --noEmit` clean.

**Archive:** `.planning/milestones/result-surface/`

**Known carryover handed to MVP-cut milestone:**

- Schema drift: `counterfactuals`, `hook_decomposition`, `confidence_label`, `anti_virality_gated` columns not yet persisted; `/api/script` route had to drop nonexistent columns inline and derive label
- Orphaned video storage observed on analysis `-I4GtlGVCQKO` — retention cron timing or upload→insert race
- Hook decomposition + emotion arc only half-wired (aggregator.ts:686-693 path with null fallback)
- Similar videos card + retrieval/embedder paths still depend on M2 corpus (ripped from runtime; ingestion intact)
- Audience headline chips 0-1 → 0-100 scaling fix landed today; `is_calibrated` field dropped from `PredictionResult` (Platt removal in engine-hardening); `videos/sign` returns 404 (not 500) for missing storage objects + logs

---

## v3.1 Engine Hardening (Shipped: 2026-05-25)

**Phases completed:** 4 phases, 10 plans, 4 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- One-liner:
- Requirement:
- Commit:
- SSRF guard added to `processSoundEmbedding` blocking non-HTTPS + RFC1918/loopback/link-local/IPv6-ULA URLs via 7 hostname regexes; all 5 VERIF-04 sub-items grep-verified; tsc + vitest green at phase close.
- Blocker:

---

## Linear Landing Clone (Abandoned: 2026-05-24)

**Status:** 0/8 phases complete. Phase 01 (Foundation + Cross-Cutting Gates) partially executed — 5 plans landed (LenisProvider, MotionWrapper, WebVitalsReporter, Inter opsz axis, CI scope guard). Zero user-visible sections shipped.

**Branch / worktree:** `milestone/landing-linear-clone` at `~/virtuna-landing-linear-clone/` (retained on disk for reference).

**Reason for abandonment:** Time-to-shipped too long for the ASAP need. The milestone front-loaded cross-cutting gates and original-content discipline before any section work — admirable craft floor but wrong shape for the immediate "ship a landing now" goal. The `landing/` components in `src/components/landing/` are still the inherited (plagiarized AS) v3.0 stubs at abandonment time; nothing new merged. Successor milestone (`Landing`) starts fresh with no carryover.

**Successor:** `Landing` milestone (`milestone/landing` branch + worktree at `~/virtuna-landing/`).

---

## Landing Page Redesign (Abandoned: 2026-05-24)

**Status:** 2/8 phases complete + Phase 03 stopped at human-verify checkpoint. Shipped (on branch only, never merged to main): `<Hero />`, `<TrustBand />`, `<Bento />` server components and the Phase 03 closing gate (130/130 component tests green, build succeeds).

**Branch / worktree:** `milestone/landing-page-redesign` at `~/virtuna-landing-page-redesign/` (retained on disk for reference).

**Reason for abandonment:** Direction reset to a fresh-start milestone with no carryover. Magic UI + shadcn integration pattern, the discovered-during-build brand spine policy, and the 3 shipped sections are not being salvaged — successor milestone starts completely from scratch per user direction.

**Successor:** `Landing` milestone (`milestone/landing` branch + worktree at `~/virtuna-landing/`).

---

## Brand Statement Landing (Abandoned: 2026-05-11)

**Status:** 2/6 phases complete then abandoned. Direction reset to a Magic UI + shadcn-based redesign before viewports 2-7 were built.

**Delivered before abandonment:**

- Phase 01 — Brand Spine & Visual Metaphor: BRAND-BIBLE visual metaphor lock, BRAND-SPINE.md (voice/vocab guardrails, preferred verbs), locked hero copy (HERO-01..05 in archived REQUIREMENTS.md), implementation tech decision (Canvas 2D for hero motion)
- Phase 02 — Foundation & Hero: BehavioralHero RSC composition, BehavioralCanvas client island (drift+attract particle animation, 250/120 desktop/mobile, reduced-motion fallback), behavioral-hero-constants, external component vetting policy, latent Radix Slot bug fix in `src/components/ui/button.tsx`

**Reverted on main:** All src/ changes from Phase 02 except `src/components/ui/button.tsx` Slot fix (kept as a real bug fix, useful regardless of direction). Phase 01 was docs-only — its artifacts live in the archive directory only; `BRAND-BIBLE.md` at repo root retains Phase 01's visual metaphor lock content.

**Reason for abandonment:** After Phase 02 shipped, the live page still felt 90% like the prior plagiarized Artificial Societies template (only viewport 1 had been replaced; viewports 2-7 + chrome + footer remained). User opted for a full reset with a different design direction (Magic UI + shadcn) rather than continuing through Phases 3-6.

**Successor:** `Landing Page Redesign` milestone (`milestone/landing-page-redesign` branch + worktree at `~/virtuna-landing-page-redesign/`).

**Archived artifacts:** `.planning/milestones/v3.0-brand-statement-landing/`

**Git range (on main):** `27385d5 docs: map existing codebase` → `<abandonment commit>` (see this commit's parent for the last v3.0 work, including all Phase 01+02 commits which remain in main's history)

---

## UI Dashboard (Shipped: 2026-03-18)

**Delivered:** 5-phase dashboard refresh — Apollo Lite/Pro/Ultra model selector with Oracle placeholder, top-bar account chip with Instagram support, 2.5D hive visualization (depth layers, parallax, bezier connections), TikTok-style result card with predicted engagement metrics, and full state sync via simulation-store.

**Phases:** 1-5 (Model Selector & Oracle Placeholder, Top Bar Account + Instagram, Hive 2.5D Visualization, TikTok Result Card, Integration & Polish)

**Note:** Phase 3 visual UAT was started 2026-03-11 but not completed before the worktree was retired. Code is shipped on main; visual verification implicit via downstream usage.

**Git range:** `2a2379a chore: initialize UI Dashboard milestone` → `6d7598d merge: ui-dashboard milestone into main`

**Stub entry:** Detailed planning artifacts not preserved on main; backfilled 2026-05-10 from git history.

---

## Prediction Engine Integration (Shipped: 2026-02-27)

**Delivered:** Wired the prediction engine into the dashboard frontend with infinite canvas Board view, dotted-grid background, and ContentForm/dashboard view-switcher redesign.

**Git range:** `7ffc1a4 feat(ui): redesign ContentForm input and dashboard view switcher` → `843d57d merge: prediction-engine-integration milestone into main` / `8ee0aef Merge milestone/prediction-engine-integration into main`

**Stub entry:** Detailed planning artifacts not preserved on main; backfilled 2026-05-10 from git history.

---

## Prediction Engine v2 (Shipped: 2026-02-17)

**Delivered:** 15-phase ML rehabilitation — Platt calibration wired conditionally into aggregator with `is_calibrated` metadata, persona removal, video indicators on history items, benchmark documentation.

**Git range:** `eb040a4 feat(15-01): wire video indicator to analysis history items` → `dd03fc7 Merge milestone/prediction-engine-v2: complete Prediction Engine v2` / `7cc2230 chore: complete Prediction Engine v2 milestone`

**Stub entry:** Detailed snapshot not preserved in `.planning/milestones/`; backfilled 2026-05-10 from git history.

---

## v2.1 — Dashboard Rebuild (Shipped: 2026-02-08)

**Delivered:** Full dashboard rebuild with Raycast design system migration and Canvas-based hive visualization with interactive exploration (hover, click, zoom/pan, pinch-to-zoom).

**Phases completed:** 45-49 (20 plans total)

**Key accomplishments:**

- Rebuilt AppShell with floating glassmorphic sidebar (260px, Zustand persist, mobile-responsive) establishing the structural foundation
- Migrated all forms (ContentForm, SurveyForm) and modals (CreateSociety, DeleteTest, LeaveFeedback, SocietySelector, TestTypeSelector) to design system components with Zod v4 validation
- Redesigned results panel with GlassCard sections, GlassProgress bars, Accordion, and GlassPill-based top bar filtering
- Built Canvas 2D hive visualization rendering 1300+ deterministic nodes (d3-hierarchy) at 60fps with retina support and reduced-motion fallback
- Added interactive hive exploration: hover highlighting with connected-node emphasis, click-to-select with coral glow overlay, zoom/pan, pinch-to-zoom, and O(log n) hit detection via d3-quadtree
- Zero legacy hardcoded colors remain in any migrated file; all 51 requirements shipped with human verification at every phase

**Stats:**

- 321 files changed (+46,046 / -4,282 lines)
- 51 requirements, all shipped
- 5 phases, 20 plans
- 4 days (2026-02-05 -> 2026-02-08)

**Git range:** `feat(45-01)` -> `feat(49-03)`

**What's next:** v3.1 Landing Page or new milestone

---

## v2.3.5 — Design Token Alignment (Shipped: 2026-02-08)

**Delivered:** Achieved 1:1 design alignment with Raycast.com by correcting all design tokens, components, and reference docs — Inter font, hex gray tokens, zero-config GlassPanel, and full regression audit with zero regressions.

**Phases completed:** 53-55 (8 plans total)

**Key accomplishments:**

- Replaced Funnel Display/Satoshi with Inter font throughout — single font matching Raycast 1:1
- Corrected all design tokens (gray scale to hex, 137deg card gradient, glass gradient, button shadows) for pixel-perfect Raycast accuracy
- Fixed all card variants with 12px radius, 6% borders, correct hover states and inset shadows
- Refactored GlassPanel to zero-config Raycast glass (5px blur, 12px radius), deleted GradientGlow/GradientMesh (493 lines removed)
- Rewrote BRAND-BIBLE.md from scratch as Raycast Design Language reference with 100% accurate token values
- Full regression audit of 10 pages, 36+ components — zero regressions, WCAG AA maintained (5.42:1 muted text)

**Stats:**

- 76 code files changed (+4,477 / -2,296 lines)
- 37 requirements, all shipped
- 3 phases, 8 plans, 19 tasks
- 3 days (2026-02-06 -> 2026-02-08)

**Git range:** `docs(53)` -> `docs(55)`

**What's next:** Continue v2.1 Dashboard Rebuild or start v3.1 Landing Page

---

## v2.2 — Trending Page UI (Shipped: 2026-02-06)

**Delivered:** TikTok Creative Center-style trending feed with video cards, detail modal with TikTok embed, and bookmark persistence — all built with the v2.0 design system.

**Phases completed:** 50-52 (10 plans total)

**Key accomplishments:**

- Built responsive video feed with 42 mock videos across 3 categories (Breaking Out, Trending Now, Rising Again) using design system components
- Created VideoCard with GlassCard + HoverScale + GlassPill + velocity indicators for trending signals
- Implemented infinite scroll with skeleton loading states and empty state handling
- Built video detail modal with TikTok embed iframe, full metadata display, and action buttons (Analyze, Bookmark, Remix)
- Implemented Zustand bookmark store with localStorage persistence and "Saved" filter tab
- Added modal keyboard navigation (arrow keys for prev/next video)

**Stats:**

- 44 files created/modified
- ~6,100 lines of TypeScript added (4,299 LOC in trending-related files)
- 3 phases, 10 plans
- 2 days (2026-02-05 -> 2026-02-06)

**Git range:** `feat(50-01)` -> `feat(52-03)`

---

## v2.0 — Design System Foundation (Shipped: 2026-02-05)

**Delivered:** Complete Raycast-quality design system extracted from raycast.com with coral (#FF7F50) branding, 36 components, 100+ tokens, 7-page showcase, and comprehensive documentation.

**Phases completed:** 39-44 (35 plans total)

**Key accomplishments:**

- Extracted 100+ design tokens from raycast.com via Playwright automation, building a two-tier (primitive -> semantic) token architecture in Tailwind v4
- Built 36 production components across 4 families (UI, Motion, Effects, Primitives) with full TypeScript types, JSDoc, and keyboard accessibility
- Implemented Raycast-specific patterns: glassmorphism (7 blur levels), chromatic aberration, noise textures, stagger reveals, and signature coral gradients
- Created 7-page interactive showcase (/showcase) with sugar-high syntax highlighting and live component demos
- Verified 90-95% visual fidelity against raycast.com with WCAG AA contrast compliance (5.4:1+ muted text, 7.2:1 AAA button text)
- Produced 8 documentation files: token reference, component API, usage guidelines, accessibility audit, motion guidelines, brand bible, design specs JSON, and contributing guide

**Stats:**

- 100 files created/modified
- 26,311 lines of TypeScript/CSS
- 6 phases, 35 plans
- 3 days (2026-02-03 -> 2026-02-05)

**Git range:** `chore(39)` -> `docs(44)`

---

## v1.2 — Visual Accuracy Refinement (Shipped: 2026-01-31)

**Delivered:** Systematic extraction and comparison of societies.io screens via Playwright automation.

**Phases completed:** 11-12

**Key outcomes:**

- 207 screenshots captured from app.societies.io
- 45 discrepancies documented (8 critical, 18 major, 19 minor)
- Complete extraction catalog and comparison reports

---

## v1.1 — Pixel-Perfect Clone (Shipped: 2026-01-29)

**Delivered:** Full-stack UI clone of societies.io with mock data and Supabase Auth.

**Phases completed:** 1-10

**Key outcomes:**

- Full app UI clone (landing + 10+ app screens)
- Zustand state management with localStorage persistence
- Responsive design (desktop + mobile)
- Zero console errors, 60fps animations

---

## MVP Launch (Shipped: 2026-02-16)

**Delivered:** Transformed Virtuna from a design-system showcase into a conversion-ready SaaS product with real auth, landing page, onboarding, payments, referrals, and tier gating.

**Phases completed:** 8 phases, 18 plans

**Key accomplishments:**

- Real Supabase auth with middleware enforcement, Google OAuth PKCE, login/signup server actions, and deep link preservation
- Landing page with Raycast design alignment (6% borders, CTA routing), lazy-loading hive demo via IntersectionObserver
- Progressive onboarding flow: TikTok @handle connect, goal personalization, 4-tooltip contextual system with Supabase-backed state
- Whop payments integration: embedded checkout modal, 7-day Pro trial tracking, webhook handler, useSubscription hook with polling
- TierGate component gating Pro features (referrals page server-side, simulation results client-side) with inline upgrade flow
- Referral system: cookie persistence through OAuth redirects, RLS INSERT policy, referral dashboard with link/clicks/earnings
- Polish: OG metadata via file convention, mobile responsiveness audit, 23 dead files removed, 3 orphaned API routes deleted

**Stats:**

- 87 commits, 751 files changed (+17,078 / -121,787 lines)
- 23,170 LOC TypeScript
- 39 requirements, all shipped
- 4 days (2026-02-13 -> 2026-02-16)

**Git range:** `abc4ac5..78ac3c6`

**Blockers carried forward:**

- Whop plan IDs need creation in Whop dashboard before going live
- Referral bonus amount is a business decision (not yet decided)
- Whop sandbox never tested end-to-end

---

## Competitors Tool (Shipped: 2026-02-17)

**Delivered:** Full competitor intelligence tracker for TikTok creators — add/track/compare competitors with real scraped data, growth analytics, engagement metrics, content analysis, benchmarking, and AI-powered strategy insights.

**Phases completed:** 8 phases, 17 plans

**Key accomplishments:**

- Database schema with 4 tables (profiles, snapshots, videos, junction), BIGINT metrics, RLS policies, and Apify TikTok scraping with Zod validation
- Competitor dashboard with card grid, table/leaderboard toggle, sparklines, growth velocity deltas, and empty/loading states
- Detail pages with follower growth charts, engagement breakdowns, top videos, hashtag frequency, posting heatmap, and duration analysis
- Side-by-side comparison with self-benchmarking, sortable multi-metric leaderboard, and daily cron re-scraping
- AI intelligence via DeepSeek/Gemini — strategy analysis, viral detection, hashtag gap analysis, and personalized recommendations
- Polish: stale data indicators, error states with retry, mobile responsive layout, and gap closure for all E2E flows

**Stats:**

- 238 commits, 126 files changed (+22,830 / -913 lines)
- 41 requirements, all shipped
- 8 phases, 17 plans
- 2 days (2026-02-16 -> 2026-02-17)

**Git range:** `milestone/competitors-tool` branch

**Blockers carried forward:**

- Backend-foundation merge timing (apify-client installed manually)
- Apify actor schemas need runtime verification (Clockworks actors may change)
- Vercel Pro plan confirmation for sub-daily cron

---

## Backend Reliability (Shipped: 2026-02-18)

**Delivered:** Fixed, wired, and hardened the prediction engine — scheduled 7 orphaned crons, rehabilitated the ML classifier, wired Platt calibration, added Sentry + structured logging, built 203+ tests at >80% coverage, and closed all edge-case failure modes.

**Phases completed:** 7 phases, 26 plans

**Key accomplishments:**

- Scheduled all 7 crons in vercel.json and repaired the end-to-end scrape→webhook→aggregate data pipeline
- Rehabilitated ML classifier with class weighting, real feature bridge, stratified training, and wired as 15% signal into 5-signal aggregator
- Wired Platt calibration conditionally into aggregator with `is_calibrated` metadata on every prediction
- Installed @sentry/nextjs + built zero-dependency structured JSON logger with requestId/stage/duration_ms/cost_cents
- Built 203+ tests with Vitest achieving >80% coverage across all engine modules (aggregator, normalize, ml, calibration, fuzzy, rules, deepseek, pipeline)
- Hardened all failure modes: Zod-validated calibration parsing, dual-LLM graceful degradation, circuit breaker probe mutex, creator profile trigger

**Stats:**

- 94 commits, 133 files changed (+20,269 / -679 lines)
- 35 requirements, all shipped
- 7 phases, 26 plans
- 2 days (2026-02-17 -> 2026-02-18)

**Git range:** `milestone/backend-reliability` branch

**Blockers carried forward:**

- Calibration has no outcome data yet — wired conditionally, degrades gracefully
- Circuit breaker is per-serverless-instance (module-level state), not distributed
- 68 console.* calls remain in non-engine files (API routes, client components) — tech debt for future

---
