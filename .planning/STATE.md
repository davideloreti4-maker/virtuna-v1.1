---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Numen Rework
status: planning
stopped_at: Phase 02 UI-SPEC approved (6/6 dimensions PASS)
last_updated: "2026-06-14T15:49:59.397Z"
last_activity: 2026-06-14
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone brief (LOCKED): .planning/NUMEN-REWORK-BRIEF.md · Worktree identity: .planning/MILESTONE.md

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — delivered as one clean thread per video (a "Reading").
**Current focus:** Phase 2 — the reading

## Current Position

Phase: 2
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-14

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

- Total plans completed: 10
- Average duration: ~5 min/plan
- Total execution time: ~25 min (Phase 01)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Foundation & Shell | 5/5 | ~25 min | ~5 min |
| 01 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 5min · 10min · 5min · 4min · 1min
- Trend: Phase 01 code-complete

*Updated after each plan completion*
| Phase 01 P01 | 5 | 3 tasks | 2 files |
| Phase 1 P2 | 10min | 3 tasks | 6 files |
| Phase 1 P3 | 5min | 3 tasks | 6 files |
| Phase 1 P4 | 4min | 2 tasks | 3 files |
| Phase 01 P05 | 1min | 3 tasks | 2 files |

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

Last session: 2026-06-14T15:49:59.387Z
Stopped at: Phase 02 UI-SPEC approved (6/6 dimensions PASS)
Resume file: .planning/phases/02-the-reading/02-UI-SPEC.md
