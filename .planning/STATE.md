---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Numen Rework
status: executing
stopped_at: Phase 3 UI-SPEC approved
last_updated: "2026-06-14T21:53:52.685Z"
last_activity: 2026-06-14 -- Phase 03 execution started
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 16
  completed_plans: 10
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone brief (LOCKED): .planning/NUMEN-REWORK-BRIEF.md · Worktree identity: .planning/MILESTONE.md

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — delivered as one clean thread per video (a "Reading").
**Current focus:** Phase 03 — rich-visuals-as-drill-downs

## Current Position

Phase: 03 (rich-visuals-as-drill-downs) — EXECUTING
Plan: 1 of 6
Status: Executing Phase 03
Last activity: 2026-06-14 -- Phase 03 execution started

Progress: [██████████] 100%

## Hard Constraints (this milestone)

- **Engine FROZEN at 3.19.0** — no `lib/engine/` changes. Presentation only. Every phase works in `src/components/**`, `src/app/**`, hooks, tokens.
- **Reuse** `src/components/board/**` visuals as drill-downs (transplant off Konva, reskin to flat-warm).
- **Do NOT reuse** `milestone/numen-surface`'s `numen/`+`reading/` kit (reference only).
- **Konva canvas retired**; `/analyze` left dormant (not deleted).
- **Score-forward, NO prose narration.**
- **Flat-warm visual system is HUMAN-UAT-GATED** — locked only after human review (the THEME-06 gate lands in Phase 1, against the built shell).
- **Component/motion libs permitted** at executor discretion (Radix, shadcn, MagicUI, Aceternity, motion/Framer Motion) within the flat-warm + matte (no glow/shine/halo) + calm-motion taste bar.

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: ~5 min/plan
- Total execution time: ~25 min (Phase 01)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Foundation & Shell | 5/5 | ~25 min | ~5 min |
| 01 | 5 | - | - |
| 02 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 5min · 10min · 5min · 4min · 1min
- Trend: Phase 01 code-complete

*Updated after each plan completion*
| Phase 01 P01 | 5 | 3 tasks | 2 files |
| Phase 1 P2 | 10min | 3 tasks | 6 files |
| Phase 1 P3 | 5min | 3 tasks | 6 files |
| Phase 1 P4 | 4min | 2 tasks | 3 files |
| Phase 01 P05 | 1min | 3 tasks | 2 files |
| Phase 02 P02-01 | 9min | 3 tasks | 6 files |
| Phase 02 P02-02 | 4min | 3 tasks | 5 files |
| Phase 02 P02-03 | 12min | 2 tasks | 4 files |
| Phase 02 P02-04 | 7min | 3 tasks | 6 files |
| Phase 02 P02-05 | 11min | 3 tasks | 6 files |

## Phases

| # | Phase | Requirements | Status |
|---|-------|--------------|--------|
| 1 | Foundation & Shell | SHELL-01..07, THEME-01..06 (13) | Complete (code; verification pending) |
| 2 | The Reading | READ-01..08, READ-10 (9) | Not started |
| 3 | Rich Visuals as Drill-Downs | READ-09 (1) | Not started |
| 4 | Stage-Reveal | REVEAL-01, REVEAL-02 (2) | Not started |
| 5 | Follow-up & Demo | CHAT-01, CHAT-02, DEMO-01 (3) | Not started |

Execution order: 1 → 2 → 3 → 4 → 5

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Recent decisions affecting current work:

- v5.0: Stand down the Numen Surface ground-up rebuild; retheme + restructure the EXISTING board/app components instead (ground-up proved too costly for the payoff; rich board visuals reused as drill-downs, not rebuilt).
- v5.0: Visual system is human-UAT-gated; component/motion libs (Radix/shadcn/MagicUI/Aceternity/motion+Framer Motion) permitted at executor discretion within the flat-warm + calm-motion taste bar.
- v5.0: Engine frozen 3.19.0 — this is a presentation-layer milestone.
- [Phase ?]: P1-01: Flat-warm @theme migration — charcoal surfaces as exact HEX (oklch L<0.15 miscompiles), Raycast glass/glow stripped (Layer A), --shadow-float the lone shadow; all values [UAT], lock at THEME-06.
- [Phase ?]: P1-01: Newsreader wired as --font-newsreader -> @theme --font-serif (mirrors Inter pattern, no self-reference); serif available, not yet consumed (greeting = 01-03).
- [Phase ?]: P1-02: Flat-warm sidebar — Layer-B inline glass stripped, dead affordances (Pinned/Projects/Boards/Running) cut, 'Recent' relabelled 'Simulations'; SidebarAccountSelector extracted to hold Sidebar.tsx under 500 lines.
- [Phase ?]: P1-02: Revived desktop sidebar collapse (Cmd/Ctrl-\ icon rail, persisted sidebar-store) + mobile drawer; app-shell main marginLeft offset wired to real sidebar width (0 mobile / rail / 220 expanded). New Simulation CTA -> /home; history rows KEEP /analyze/[id] (no /s/[id] rename).
- [Phase ?]: P1-03: Built /home (authed server page in (app), inherits getUser gate + AppShell) + serif greeting (font-serif, useProfile name italic, isLoading name-less so no [Name] flash, NumenMark stele coral) + centered composer; NO chips (D-18), NO demo (D-25), NO Simulation list under composer.
- [Phase ?]: P1-03: Slim composer reuses validated sub-parts (VideoUpload bare + TikTok-only regex mirroring server /api/analyze L465 + lifted Board navigate-on-id loop) — NOT ContentForm (Pitfall 5: no intent/tier/3-tab/IG). Rejects non-TikTok incl. Instagram with exact D-21 copy + disabled submit.
- [Phase ?]: P1-03: Two-layout = one component, data-layout centered (no route id) / pinned (id present) via useParams; permalink kept as /analyze/[id] (no /s/[id] rename, RESEARCH A2); composer navigates there on stream.analysisId. Authed-landing repoint to /home is plan 01-04.
- [Phase ?]: P1-04: Default authed landing repointed to /home (D-23) at BOTH decision points — middleware authed-off-auth-page redirect (/analyze->/home) + auth/callback default (?? /dashboard -> ?? /home); /dashboard sunset 308 also retargeted /home. Same-origin (open-redirect guard V5).
- [Phase ?]: P1-04: /home auth-gated twice — (app) layout getUser gate (01-03) + PROTECTED_PREFIXES entry (defense-in-depth, Spoofing); unauthenticated /home -> /login w/ deep link. /analyze + /analyze/[id] kept dormant-but-reachable (still protected, IDOR-defended permalink untouched).
- [Phase ?]: P1-04: Fixed latent bug — the authed-auth-page redirect was DEAD CODE shadowed by the public-path early-returns (/login & /signup are public). Added AUTH_PAGES carve-out + moved the redirect before the public-skip so signed-in /login/signup visitors actually reach /home; anon visitors still see the page.
- [Phase 01]: P1-05: THEME-06 / D-07 SIGNED via a live human review on the running shell — the flat-warm system is LOCKED for rollout. Locked values: charcoal app #262624 / sidebar #1a1a18 / composer #1e1d1b / chip #2f2e2b; lone-accent coral oklch(0.68 0.13 33) ≈ #d97757 (text-on-coral #1a0f0a); serif = Newsreader; score zones green oklch(0.68 0.17 145) / amber oklch(0.75 0.15 85) / red oklch(0.60 0.20 25); greeting "Ready to simulate your audience, [Name]?". Phase 01 code-complete (13/13 reqs). Follow-ups: UAT screenshots 0/4 (env-gated, harness committed at 8f8e8acb), sidebar score-chip token-unify deferred to Phase 2.
- [Phase 02]: P2-01: ScoreGauge fill uses bandTone() SSOT — amber owns the WHOLE 40-69 band (correction #2, never red there); score is a Phase-4-drivable prop; matte (no glow/halo/filter).
- [Phase 02]: P2-01: DrillSheet is generic children-based (no panel registry) — the Phase-3/5 mount point; side switches bottom-mobile/right-desktop via useIsMobile; flat-warm (shadow-none, no inset, no blur). Forwarded side as data-side on shared ui/sheet.tsx (Rule 3 blocking, additive — no other consumers).
- [Phase 02]: P2-01: src/components/reading/__tests__/ scaffold + shared makeReadingResult fixture (extends board fixtures.antiVirality + Apollo/heatmap/counterfactuals); scenario helpers cover D-13 degraded states. 14 reading tests green; full suite 1981 green (was 1967). 12 pre-existing tsc errors in untouched files logged to deferred-items.md.
- [Phase ?]: P2-02: PersonaCloud dots-only (watch% hero-owned, 02-05); golden-angle verbatim from PersonaGraph; cream rgba(236,231,222) fill not white, coral worst-cluster only; returns null on empty personas.
- [Phase ?]: P2-02: ThumbnailStrip gates on resolveKeyframeUrl(filmstrips,segments,'first') → null when no keyframe (no broken box); plain <img> not next/image, decorative alt='', signed URL never logged (T-02-03). AntiViralityHeader = bare re-export of board verdict component (D-04). 11 new tests; full suite 1992 green (was 1981).
- [Phase ?]: P2-03: DriverRows is a NEW component (not a FactorBars reuse) — borrows only the 3-col grid + 5px bar markup, rebuilt for 0-100 ApolloDimensions; fixed funnel Hook->Retention->Shareability (no sort), neutral cream bars, ONLY the single weakest in its bandTone zone color + warn glyph; Retention value = drop time via formatTime(weighted_top_dropoff_t) SECONDS (audience-derive, not the ms TopFixesList variant — the 0:08-vs-0:00 trap), bar still fills by retention score; >=44px button -> onRowTap; degrades to 'Not available' on null dimensions (never a fabricated 0).
- [Phase ?]: P2-03: Sidebar score chips unified onto the THEME-06 score-zone tokens (--color-success/warning/error) via the bandTone SSOT (>=70/40-69/<40) — one score-color language shared with the hero gauge; token swap only, em-dash branch stays muted (carried-forward P1 follow-up CLOSED).
- [Phase 02]: P2-04: RewriteItem/FixFirstList/DeeperRead built — the actionable bottom of the Reading; copyable hook rewrites (D-15) are the literal payload (Copy = sanctioned coral surface, Copy->Copied->Copy 1.5s, graceful clipboard failure).
- [Phase 02]: P2-04: Light two-tier (D-10) — FixFirstList overflow = one-way useState 'N more fixes' reveal; DeeperRead = vendored Radix Accordion inline expand; NEITHER a Sheet (heavy half stays DrillSheet).
- [Phase 02]: P2-04: D-13/D-14 as correctness — zero fixes is a WIN ('Nothing urgent to fix'), null Apollo -> DeeperRead returns null + FixFirstList omits the rewrite section (no fabricated 0 / placeholder chip).
- [Phase 02]: P2-04: reading cluster is board-store-free (no useBoardStore under src/components/reading/, grep=0 + bare-mount); BAND_COLOR repointed emerald/amber/red -> THEME-06 zone tokens success/warning/error. Full suite 2019 green (was 2000).
- [Phase 02]: P2-05: Reading container (reading.tsx) is the single usePermalinkAnalysis subscriber — children are pure prop-driven leaves (severs the InsightHeroFrame per-leaf re-subscribe); data source abstracted so Phase 4 swaps in useAnalysisStream at the container only.
- [Phase 02]: P2-05: D-13 honesty gate runs FIRST — no-id→inert(composer shell owns screen), id+!data→error, analysis_unavailable→CouldNotAnalyze (fabricated 0 NEVER reaches ScoreGauge); partial annotates; apollo-null degrades rows/deeper while hero/gate resolve from overall_score. Watch% hero-OWNED, rendered exactly once OUTSIDE PersonaCloud so it survives the empty-personas path (READ-04).
- [Phase 02]: P2-05: Landmine-0 DONE — /analyze layout inverted to mount <Reading/> (Board retired from the mount, board sources+route files preserved dormant); one DrillSheet driven by closed-union panelId(hook|retention|shareability|personas) with native D-12 content = the Phase-3 rich-chart/PersonaGraph seam. READ-10 standing no-cut-data guard added. Full suite 2035 green (was 2019); build clean. Phase 02 code-complete → /gsd-verify-work.

### Pending Todos

[From .planning/todos/pending/]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- **THEME-06 UAT gate (Phase 1): RESOLVED 2026-06-14** — the flat-warm system was reviewed live on the running shell by the human and SIGNED OFF (LOCKED for rollout). Locked values recorded in Decisions (P1-05) + 01-05-SUMMARY.md. Phases 2-5 reskin onto these as the fixed source of truth.
- **Calibration items (brief §7): LOCKED at THEME-06** — charcoal ramp (app #262624 / sidebar #1a1a18 / composer #1e1d1b / chip #2f2e2b), score zones (green oklch(0.68 0.17 145) / amber 0.75 0.15 85 / red 0.60 0.20 25), coral oklch(0.68 0.13 33)≈#d97757, serif=Newsreader. Still OPEN (Phase 2+): how the thread settles (reveal → resting doc, Phase 4); mobile sidebar drawer vs bottom-sheet.
- **Minor follow-ups (non-blocking):** (1) UAT screenshots 0/4 — env-gated at capture time; harness committed at 8f8e8acb, run once E2E creds + a completed Simulation id exist. (2) Sidebar score chips use Tailwind emerald-400/amber-400, not the --color-success/warning/error score-zone tokens — unify in Phase 2 when the hero score lands.

## Deferred Items

Deferred to later milestones per brief §3 (NOT v1): agentic tools (Apify competitor analysis — "the moat"), in-thread monetization, desktop dense-instrument (Konva successor), Reading share/export growth loop. See REQUIREMENTS.md v2 section.

## Session Continuity

Last session: 2026-06-14T20:32:07.888Z
Stopped at: Phase 3 UI-SPEC approved
Resume file: .planning/phases/03-rich-visuals-as-drill-downs/03-UI-SPEC.md
