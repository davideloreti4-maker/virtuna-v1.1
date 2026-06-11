# Project Research Summary

**Project:** Numen Surface (v5.0)
**Domain:** Mobile-first thread-per-video AI content-intelligence surface — rebrand + UX paradigm shift over an existing stage-emitting engine
**Researched:** 2026-06-11
**Confidence:** HIGH

## Executive Summary

Numen Surface is a presentation-layer milestone, not an engine milestone. The engine (v4.1, 3.19.0) is frozen and untouched; the work is re-composing its existing output into a mobile-native "Reading thread" paradigm — one thread per video, AI pronounces first (verdict band + one-line why in a "throne" slot), evidence blocks stage-reveal below, follow-ups and agentic tools in the thread tail. The stack correction is important upfront: the repo runs Next.js 16.1.5 / React 19.2.3 (not "Next 15"). Most transport infrastructure is already built — SSE stream route, EventSource hook, Qwen chat route, Apify scraping provider, analysis_chats table, history API. Net-new is concentrated in three areas: (1) the view-model layer that maps ~40 engine fields to ~10 value-bearing ReadingBlocks, (2) the mobile Reading UI components and thread shell, and (3) the PWA shell (Serwist + manifest.ts). This is overwhelmingly re-composition, not greenfield build.

The single most consequential product decision emerging from research: iOS share-sheet ingestion is structurally unbuildable as a PWA. WebKit bug #194593 has been open since 2019, unimplemented as of 2026. The vision's "native share-sheet = acquisition hero" cannot ship on iOS in a PWA — the installed app never appears in the share sheet, fails silently. Android/Chromium share_target works fine. The recommended scope correction: v5.0 leads with paste-URL + clipboard-detect + upload as primary ingestion (plus Android share_target); iOS native share-in defers to the Capacitor wrapper milestone. This is a top-level product decision the roadmapper must make explicit.

The two non-negotiable technical gates before building the Reading against real engine output: (a) SMOKE GATE — one real-video E2E on the live Vercel rig proving sane/honest output and real latency (watch DashScope-429); (b) verdict-banding calibration sub-gate — band buffer zones must be wider than the engine's known ~+-15pt score noise, and "Mixed signals" must be a first-class, common verdict. The named death condition: noisy number to crisp confident band to "oracle confidently lies to trust dies." These gates are hard preconditions; no Reading-against-real-output ships before they pass.

---

## Key Findings

### Recommended Stack

The genuine net-new stack additions are minimal. The repo already has: openai SDK (Qwen/DashScope), @tanstack/react-query, apify-client, @sentry/nextjs, zod@4, nanoid, next/og. The existing SSE transport (stream route + EventSource hook + Qwen chat route) is already the stage-reveal mechanism — work is reshaping emitted events into the Reading's block vocabulary, not new transport. Vercel Fluid Compute (default since 2025-04-23) gives Node runtime up to 300s on Hobby / 800s on Pro; existing routes already set maxDuration=300 and X-Accel-Buffering:no.

**Core technologies (net-new only):**
- `@serwist/next@9.5.11` + `serwist`: PWA service worker — maintained next-pwa successor with first-class App Router support; Workbox precaching for offline shell
- `Next.js native manifest.ts`: type-safe web app manifest including share_target member (effective on Android/desktop, not iOS)
- Roll-your-own tool registry (no new dep): ~50 lines over existing SSE + ScrapingProvider; preferred over Vercel AI SDK unless the model needs to autonomously select tools from free text
- `ai@6.0.201` (conditional): only if autonomous multi-step tool selection from free text is needed later — deferred; adds a second LLM-streaming paradigm alongside the existing Qwen path

**Do not add:** next-pwa (unmaintained), Vercel AI SDK for the stage-reveal (wrong model — structured block materialization, not token streaming), Edge runtime on engine routes (needs Node), a second LLM client for chat (fragments the locked maxRetries:0 / seed invariant).

### Expected Features

**Must have (table stakes) — the thread spine:**
- The Reading: stage-revealed structured blocks over existing engine output — the core paradigm
- Verdict band + one-line why in a reserved throne slot — resolves F36/F41/F45; the brand wedge
- Stage-reveal transport over existing SSE — turns 45-74s latency into legible progress
- Evidence blocks (keyframes + hero insight) — grounding under the verdict
- 3-4 contextual suggested follow-ups as taps + free-text composer — kills cold-start, scoped to competence
- Per-video thread + home list of past Readings — the app shell / spine
- Ingestion: paste-URL + upload wired to thread kickoff (Android share_target bonus)

**Should have (differentiators):**
- At least one agentic tool turn (competitor analysis via Apify) — proves the moat; includes "working..." beat + in-persona failure voicing + visual distinction from instant chips
- Two species of follow-up visually distinct: instant (re-interpret existing data, no fetch) vs agentic (go fetch via Apify/back-catalog/trends)
- First-run pre-baked demo Reading on a recognizable viral video — the pitch, pre-baked to guarantee wow and avoid live DashScope-429 risk
- PWA installability shell (Serwist + manifest) — Android share_target; iOS Add-to-Home-Screen coaching

**Defer to v1.x / v2+:**
- Additional agentic tools: back-catalog comparison, trends, best-post-time — after first tool UX validated
- In-thread monetization turn — oracle-initiated; reuses tool machinery once stable
- Cross-video insight — needs accumulated history; not this milestone
- Desktop instrument layer — mobile ships first; desktop is a later phase
- iOS native share-sheet ingestion — requires Capacitor wrapper; explicitly a future milestone
- Shareable exported Reading — growth loop; mechanics still open (vision §9)

**Explicit anti-features (cut):**
- Naked numeric score as verdict ("/100", "PREDICTED RANK Top X%") — false precision, metric not judgment
- Open-ended assistant / "ask me anything" — breaks trust when engine can't honor off-topic
- Red error toasts / modal dialogs for tool failures — breaks mentor persona
- Chatbot token-by-token text streaming as reveal — fights structured-block model
- Mysticism / oracle theater — solemn, reverent, amber glows; WHOOP/Linear litmus kills it
- Konva canvas as primary surface — desktop-only instrument, not the main paradigm
- Glass everywhere — rare only (composer + tool sheet); warm-neutral flat chrome elsewhere
- Engine jargon surfaced to user — plain mentor language throughout

### Architecture Approach

The architecture is re-composition over existing data flows. The hardest parts are already built and shipped in v4.1: the engine emits a typed StageEvent discriminated union; /api/analyze wraps it in real SSE; panel-mapping.ts is a stage-to-view-model reducer; analysis_chats is a per-analysis thread table; verdict-derive.ts + HeroBlock implement band+why. The architectural crux is one new pure module: `lib/reading/view-model.ts` (toReadingBlocks) that both the live complete path and persisted-row replay funnel through, so a live Reading and a re-opened resting document are byte-identical. This is ENG-06 D-12 / F43 — the ~40 to ~10 field prune driven by surface demand, not engine change.

**Major components:**
1. `lib/reading/view-model.ts` (NEW — the crux): pure toReadingBlocks(PredictionResult): ReadingBlock[] — selects ~10 value-bearing blocks from ~40 fields; both live and replay paths funnel through here; must be unit-tested against real persisted fixtures before any UI consumes it
2. `lib/reading/block-types.ts` + `stage-to-block.ts` (NEW): ReadingBlock discriminated union (~10 kinds); extends panel-mapping.ts STAGE_TO_PANEL to Numen block ids; verdict keyed to aggregator stage (forms last)
3. `lib/tools/registry.ts` + `competitors.ts` (NEW): typed tool registry; wraps existing ScrapingProvider / apify-provider.ts; POST /api/analyze/[id]/tool/[name] route
4. `components/reading/` (NEW): ReadingThread (spine), ThroneSlot (verdict reserved slot), ~10 block components, Composer, ToolChip — the mobile-native block vocabulary
5. `analysis_chats` schema extension (NEW migration): add kind TEXT + payload JSONB + 'tool' role — minimal; keeps one ordered turn log; replay stays trivial
6. PWA shell (NEW): app/manifest.ts (share_target, display:standalone, warm-clay theme-color), app/sw.ts via Serwist, appleWebApp metadata — 100% net-new (no manifest/SW/icons exist today)
7. Existing SSE + stream routes (REUSE): /api/analyze, /api/analyze/[id]/stream, /api/analyze/[id]/chat — untouched; reshaping events only
8. `components/board/` (DEMOTE, not delete): gated to desktop instrument breakpoint; Konva-keep-vs-retire decision deferred to after mobile ships (vision §9)

**Persistence reuse:** thread = one analysis_results row + ordered analysis_chats turns; home list = existing GET /api/analysis/history. Only schema gap is the analysis_chats kind+payload column. Engine (lib/engine/) is untouched — ENGINE_VERSION 3.19.0 does not change.

### Critical Pitfalls

1. **iOS share-target unbuildable as PWA** — WebKit #194593 open since 2019; scope v5.0 to paste/upload primary + Android share_target; defer iOS to Capacitor milestone; no roadmap promise of iOS share-sheet in v5.0
2. **Oracle confidently lies (noisy score to overconfident band)** — engine scores ~+-15pt noise; calibration gate required: buffer zones wider than noise, "Mixed signals" first-class and common, why-line grounded in specific signal not score; do not build throne UI before calibration sub-gate passes
3. **SMOKE GATE skipped** — no Reading-against-real-output before one real-video E2E on live Vercel proves honest output + real latency + DashScope-429 surfaced; hard precondition, not optional
4. **Tailwind v4 warm-dark tokens compile wrong** — L<0.15 oklch in @theme produces off dark tones (repo-known bug); author all dark warm-neutral tokens as exact hex; carry rule explicitly into design-system phase
5. **Lightning CSS strips backdrop-filter** — glass composer/tool-sheet silently flattens; apply via React inline style={{ backdropFilter: 'blur(Npx)' }} only, never CSS class
6. **Tool failure as red toast** — breaks mentor persona; every tool turn needs in-persona failure + partial-result copy as first-class deliverable; persist tool results to avoid re-running on reload
7. **Engine scope creep** — ENG-06 D-12 is a field-consumption + prune step, not a contract-changing step; no lib/engine/ edits; ENGINE_VERSION unchanged; verdict honesty fixed in presentation banding not engine recalibration
8. **Half-migrated brand** — cold #07080a / raw #FF7F50 / 5px-blur glass bleeding into new warm-neutral screens; audit/grep codebase first; define explicit migration boundary
9. **Desktop before mobile** — mobile Reading ships before any desktop-instrument phase; Konva-keep-vs-retire decision deferred until after mobile ships

---

## Implications for Roadmap

Based on research, suggested 6-phase structure (mobile before desktop; gates before Reading build):

### Phase 1: Design System Foundation + Brand Migration Boundary

**Rationale:** New warm-neutral kit must exist before any Reading component is built; known Tailwind v4 / Lightning CSS traps must be encoded as rules before fresh authors hit them; explicit migration boundary prevents half-migrated brand. Runs in parallel with or just before Phase 2. No gate dependency.

**Delivers:** New @theme token set (warm neutrals as hex for L<0.15), verdict scale colors (muted green/amber/clay-red), warm-clay brand accent, typography pairing (sans + reserved serif), glass primitive component (backdrop-filter via inline style), migration boundary decision (which screens v5.0 vs later), audit/grep of hardcoded #07080a / #FF7F50 / Raycast glass.

**Addresses:** Pitfalls 4 (oklch dark tokens), 5 (backdrop-filter), 9 (half-migrated brand)

**Research flag:** Standard patterns — no deeper research needed. Rules already known from repo KEY DECISIONS + CLAUDE.md.

---

### Phase 2: View-Model Layer + Data Contract (ENG-06 D-12)

**Rationale:** The view-model is the architectural crux and the prerequisite for everything else. Build it as a pure module (no React, no fetch) against persisted PredictionResult fixtures so it can be unit-tested before any UI consumes it. Folds in ENG-06 D-12 (consumed-vs-dead field prune driven by surface demand). Must complete before Phase 3 (SMOKE GATE requires knowing what fields to smoke-test).

**Delivers:** `lib/reading/view-model.ts` (toReadingBlocks), `lib/reading/block-types.ts` (ReadingBlock discriminated union ~10 kinds), `lib/reading/stage-to-block.ts` (extends STAGE_TO_PANEL to Numen block ids, verdict keyed to aggregator), `lib/reading/verdict.ts` (lifts band+why from verdict-derive.ts, number demoted). Unit tests against real persisted fixtures.

**Addresses:** F36 (three scorecards to one), F41 (verdict=band not score), F43 (output bloat), F45 (false precision)

**Avoids:** Pitfall 7 (engine scope creep) — read-only consumption; Pitfall 3 (overconfident band) — band buffer zones defined here

**Research flag:** Standard patterns. Architecture fully mapped; precedents in panel-mapping.ts + verdict-derive.ts exist in repo.

---

### Phase 3: SMOKE GATE + Verdict-Banding Calibration

**Rationale:** Hard precondition before any Reading-against-real-output. The SMOKE GATE (one real-video E2E on live Vercel) validates: honest/sane output holds, real ENG-03 latency measured, DashScope-429 surfaced. The calibration sub-gate validates: band buffer zones wider than score noise, "Mixed signals" fires on boundary scores, why-line is grounded in specific signal. These two gates together clear the way for Phase 4.

**Delivers:** Confirmed real-video E2E output (F46/F47/F22/F23 hold live); measured latency number for stage-reveal design; DashScope-429 behavior documented; calibrated band thresholds with documented buffer zones; same-video-N-times variance check; verdict-banding go/no-go decision.

**Addresses:** Vision §7b SMOKE GATE; Pitfall 3 (oracle confidently lies); Pitfall 2 (pipeline outlives function — real latency measured here)

**Research flag:** Execution not research. DashScope-429 behavior on live rig is unknown until tested. Gate is pass/fail with defined criteria; any fail must be resolved before Phase 4 proceeds.

---

### Phase 4: Mobile Reading Thread + PWA Shell

**Rationale:** The core paradigm. Mobile ships before desktop (vision, pitfall 10). Uses view-model from Phase 2, validated by Phase 3. Replaces Konva canvas as primary surface. PWA shell ships here — Android share_target, iOS Add-to-Home-Screen coaching, installability.

**Delivers:** `components/reading/` — ReadingThread, ThroneSlot (verdict forms last), ~10 block components (hook, retention, fix, heatmap, etc.), stage-reveal over existing SSE (useReadingStream reshaped to block vocabulary), per-video thread route (/reading/[id]), replay path (resting document byte-identical to live path via toReadingBlocks), warm-neutral mobile-first UI. PWA: app/manifest.ts (share_target, display:standalone, warm-clay theme-color), app/sw.ts (Serwist), appleWebApp metadata. iOS clipboard-detect paste-URL ingestion flow. Android share_target landing handler.

**Addresses:** Core vision paradigm; F37 (insight as hero); F38 (jargon removed); Pitfall 1 (iOS share-in scoped to paste/upload + Android only); Pitfall 8 (mysticism drift — WHOOP/Linear litmus enforced)

**Uses:** @serwist/next, manifest.ts (built-in), view-model from Phase 2, existing SSE routes

**Research flag:** Standard patterns for SSE reshaping + Serwist. Validate PWA installability via Lighthouse against deployed Vercel function, not next dev (Serwist SW only generates in production build).

---

### Phase 5: App Shell + Ingestion + Follow-ups + Agentic Tool

**Rationale:** With the Reading thread working, wire the full app spine and the thread tail. Home list, upload/paste ingestion, instant follow-ups (existing /chat route reshaping), first agentic tool turn (competitor analysis via Apify — the moat). analysis_chats schema extension lands here. First-run pre-baked demo Reading lands here once the Reading render is polished enough to be the pitch.

**Delivers:** Home page: vertical list of past Readings (compact verdict cards — keyframe thumb + band + why + date), "analyze new" persistent action. Ingestion entry: upload + paste-URL form wired to /api/analyze POST, navigate to /reading/[id]. Instant follow-ups: 3-4 contextual suggested tap chips + free-text Composer (scoped to competence). Agentic tool turn: /api/analyze/[id]/tool/competitors route, lib/tools/registry.ts + competitors.ts wrapping ScrapingProvider, "working..." beat, in-persona failure voicing (failure copy as deliverable), visual distinction from instant chips, result persisted to analysis_chats. analysis_chats migration: kind TEXT + payload JSONB + 'tool' role. Pre-baked demo Reading (cached/pre-computed).

**Addresses:** F39 (monetization hook — oracle-initiated tool turn path opened); Pitfall 6 (tool failure persona); home list persistence backlog item lands

**Research flag:** In-persona failure copy is a design/copy deliverable, not just code. Plan should include copy spec for all failure/partial/timeout states before building.

---

### Phase 6: Desktop Instrument Layer (deferred)

**Rationale:** Ships only after mobile Reading is live and validated. Dense board (or linear successor) survives here for the ~10% poweruser path. Konva-keep-vs-retire decision (vision §9) is made here based on what mobile shipped. Deliberately last — mobile-first is non-negotiable.

**Delivers:** Desktop breakpoint expansion: same thread widened + instrument layer (board or linear successor behind desktop breakpoint). Decision on Konva vs retire. Additional agentic tools if validated (back-catalog, trends, best-post-time). In-thread monetization turn (oracle-initiated, reuses tool machinery).

**Research flag:** Needs `/gsd-plan-phase --research-phase` — Konva-keep-vs-retire is open (vision §9); dense-linear alternative is undefined if Konva retires.

---

### Phase Ordering Rationale

- Design system before Reading components: warm-neutral tokens must exist; Tailwind v4 / Lightning CSS traps must be rules-encoded before any block is built
- View-model before SMOKE GATE: need to know which fields to smoke-test; the prune is the test subject
- SMOKE GATE before any Reading-against-real-output: non-negotiable; verdict premise rests on honest engine contract
- Mobile Reading before home/ingestion/tools: the paradigm must work before wiring the shell around it
- Agentic tools in same phase as shell: tool turn UX is part of the thread spine; splitting creates a half-baked thread
- Desktop last: vision mandate; pitfall 10 prevention; Konva decision cannot be made until mobile proves the thread paradigm

### Research Flags

**Needs deeper research / plan-phase research:**
- Phase 6 (Desktop Instrument): Konva-keep-vs-retire is open; dense-linear alternative is undefined; recommend research phase before planning

**Standard patterns (skip research-phase):**
- Phase 1 (Design System): Tailwind v4 patterns well-documented; repo-specific rules already known
- Phase 2 (View-model): Architecture fully mapped; precedents in repo
- Phase 3 (SMOKE GATE): Execution not research; pass/fail criteria defined
- Phase 4 (Reading + PWA): Serwist + SSE patterns documented; main risk is execution fidelity
- Phase 5 (Shell + Tools): Existing Apify provider + history API well-understood; in-persona copy spec is the main deliverable gap

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against live package.json; SSE routes read directly; Serwist verified via Context7; iOS share-target gap verified via WebKit Bugzilla #194593; Vercel limits verified via docs |
| Features | HIGH | Converged across vision + NN/g + Whoop + OpenAI Apps SDK UX + Perplexity behavior; anti-features explicitly cut in vision with rationale |
| Architecture | HIGH | Every integration point verified against live repo files; existing SSE/thread/history/ScrapingProvider all confirmed present |
| Pitfalls | HIGH | iOS share-target: WebKit bug tracker; Vercel limits: Vercel docs; Tailwind oklch: GitHub issue #14499 + repo KEY DECISIONS; Lightning CSS: repo KNOWN ISSUES; verdict calibration: LLM-as-judge arXiv papers |

**Overall confidence:** HIGH

### Gaps to Address

- Verdict band calibration thresholds: exact buffer zone values unknown until same-video-N-times variance analysis runs in Phase 3. Do not hardcode thresholds before this data exists.
- DashScope-429 behavior on live Vercel rig: cold-Vercel + real-429-backoff timing unknown until SMOKE GATE. Budget for worst-case in stage-reveal design.
- Desktop instrument form: Konva-keep-vs-linear-successor undecided (vision §9). Not a Phase 1-5 blocker; decision deferred to Phase 6 planning.
- Shareability mechanics: exported image card vs link — vision §9 open. Not in v5.0 scope.
- Exact type specimen for serif voice moments: direction set (sans-led, serif for greeting/verdict), specimen not locked. Resolve in Phase 1 design system.
- Pre-baked demo Reading: which viral video, how to pre-compute/cache — operational detail; resolve in Phase 5 planning.

---

## Sources

### Primary (HIGH confidence)

- Repo `src/` live files — stream/route.ts, use-analysis-stream.ts, panel-mapping.ts, verdict-derive.ts, apify-provider.ts, analysis/history/route.ts, events.ts, types.ts, analysis_chats migration — verified architecture
- WebKit Bugzilla #194593 — iOS share-target not implemented (open since 2019)
- Vercel docs — Fluid Compute, Functions Limits, maxDuration configuration, Edge 25s rule
- Tailwind CSS GitHub issue #14499 — oklch opacity-syntax bug in v4
- Repo PROJECT.md / CLAUDE.md Key Decisions / Known Issues — hex-not-oklch dark tokens; Lightning CSS backdrop-filter workaround
- Context7 /websites/serwist_pages_dev — withSerwistInit, app/sw.ts, SerwistProvider, Next App Router setup
- Context7 /vercel/ai — tool calling, streamText, isStepCount, createUIMessageStreamResponse
- npm registry — ai@6.0.201, @serwist/next+serwist@9.5.11, actual package versions
- `.planning/NUMEN-SURFACE-VISION.md` — authoritative product source

### Secondary (MEDIUM confidence)

- NN/g — Scope in Generative AI Features (narrow scope / flexibility-usability tradeoff)
- Whoop support docs — band-verdict model (green/yellow/red + plain-language guidance)
- OpenAI Apps SDK UX principles + ChatGPT agent announcement — tool-turn UX patterns
- LogRocket / Nextbuild — skeleton loading + latency tolerance research
- Google PAIR / AIUX Design Guide / Clearly Design — graceful failure / in-persona error design
- Appcues / Supademo — show value before commitment onboarding patterns
- arXiv 2508.06225 + 2502.11028 — LLM-as-judge overconfidence (verdict calibration rationale)
- magicbell PWA-iOS-2026 guide — PWA iOS limitations (cross-confirms WebKit bug)

### Tertiary (LOW confidence / informational)

- Perplexity UX analyses (design blogs) — answer-first pattern; behavior observed, not from official Perplexity docs
- Capawesome / calvinckho capacitor-share-extension — future Capacitor path; not in scope for v5.0

---
*Research completed: 2026-06-11*
*Ready for roadmap: yes*
