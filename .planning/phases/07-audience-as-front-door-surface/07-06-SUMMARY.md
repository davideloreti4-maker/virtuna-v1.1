---
phase: 07-audience-as-front-door-surface
plan: 06
subsystem: ui
tags: [react, nextjs, localStorage, composer, home, cold-start-demo, profile]

# Dependency graph
requires:
  - phase: 07-audience-as-front-door-surface
    provides: "07-05 Build chooser + composer host wiring; 07-04 activeMode threading + per-skill General submit; 07-02 Mode-sectioned picker + generalized reactor; 07-01 Mode-scoped skill menu"
  - phase: 05-profile-simulate-wow
    provides: "/api/tools/profile route + profile-read/reaction-distribution blocks + reloadProfileThread same-thread render"
provides:
  - "HomeStarter component — 3 LOCKED-verbatim starter chips (Test / Profile / Predict) + a show-once first-run profile-chat demo"
  - "localStorage show-once flag numen.home.demo.seen (set on first run OR Dismiss)"
  - "Cold-start wow: one-tap 'See it in action' POSTs a canned chat fixture to /api/tools/profile → Profile→Read card in-thread (VISION §15.5)"
  - "Composer empty-region mount of <HomeStarter> with chip handlers wired to real composer-internal flows; page.tsx P5 empty-lock dropped"
affects: [phase-07-verification, home, composer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mounted-flag gate for client-only localStorage to avoid hydration mismatch on the demo block"
    - "Show-once flag consumed eagerly (set before the POST resolves) so a slow/aborted demo still never re-shows"
    - "Starter block hosted BY the composer (not a cross-sibling) so chip handlers reach composer-internal flows directly"

key-files:
  created:
    - "src/components/app/home/home-starter.tsx — HomeStarter (3 chips + show-once demo)"
  modified:
    - "src/components/app/home/composer.tsx — mount <HomeStarter> in the no-conversation region + chip handlers"
    - "src/app/(app)/home/page.tsx — dropped the D-18/D-25 empty-lock doc comment, noted the P7 unlock (D-04)"
    - "src/components/app/home/__tests__/home.test.tsx — 3 chips + one-tap demo + show-once cases (replaced NO-chips/NO-demo)"

key-decisions:
  - "Demo fixture is a static in-repo believable chat string (no user input); the /api/tools/profile route re-validates + caps it (T-07-06-01)"
  - "Chips ALWAYS render; only the demo is show-once — the locked chips are the permanent home wow seed, the demo is the one-time cold-start moment"
  - "Demo POSTs {kind:'text', text:fixture} matching the route's StimulusInput body; onDemoComplete reloads the open thread so the profile-read card surfaces"
  - "Matte, no accent on the whole starter block (dosage rule); the single liveness dot in the presence stays the only sanctioned accent"

patterns-established:
  - "Pattern: client-only localStorage state gated behind a useEffect mounted flag to keep SSR + first client render in agreement"
  - "Pattern: eager show-once consumption — flag set immediately on tap, before the async side-effect resolves"

requirements-completed: [UX-05]

# Metrics
duration: ~6min
completed: 2026-06-29
---

# Phase 7 Plan 6: Home Empty State — Starter Chips + First-Run Demo Summary

**HomeStarter unlocks the previously-locked home empty state with 3 verbatim starter chips (Test / Profile / Predict) plus a one-tap, show-once cold-start demo that runs a canned chat through Profile→Read — closing UX-05 and the full Audience-as-Front-Door surface, validated by a real authed `/home` browser pass.**

## Performance

- **Duration:** ~6 min (Tasks 1–3 in the prior session; this continuation closed out after the approved Task-4 browser pass)
- **Completed:** 2026-06-29
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 4

## Accomplishments
- `HomeStarter` renders the 3 LOCKED-verbatim chips ("Test an idea on your audience" / "Profile a chat" / "Predict an outcome") in the composer's no-conversation region, below the greeting + composer.
- One-tap "See it in action" demo POSTs a canned chat fixture to `/api/tools/profile` → the Profile→Read card surfaces in-thread (the §15.5 cold-start wow, zero chat-export friction); "Dismiss" is a muted text link.
- Show-once: `localStorage` key `numen.home.demo.seen` (set on first run OR Dismiss) hides the demo on the next mount while the chips persist.
- Chip handlers wired to the real composer-internal flows; `page.tsx` P5 empty-lock doc comment dropped and re-noted as the P7 unlock (D-04).
- Full P7 surface validated end-to-end in a real authed browser pass (Task 4, approved): empty-state wow, mode-sectioned picker + trust badges, Build chooser, mode-scoped skill menu, byte-identical Socials creator path, zero console errors/warnings.

## Task Commits

Each task was committed atomically (Tasks 1–3 in the prior session):

1. **Task 1: HomeStarter — 3 locked chips + show-once first-run demo** - `672e8c93` (feat)
2. **Task 2: Mount HomeStarter in composer empty region + unlock page.tsx** - `739b7902` (feat)
3. **Task 3: home.test — 3 chips + one-tap demo + show-once** - `4827c432` (test)
4. **Task 4: Real authed /home browser pass (full P7 surface)** - checkpoint:human-verify, **APPROVED** (all 5 verification steps passed)

**Orchestrator-applied fixes discovered during the Task-4 browser pass (already committed):**
- `a64d6ecf` (fix 07-02) — portal the audience switcher dropdown above the composer clip
- `99ae67c8` (fix types) — unblock the `next build` TS gate (recharts-3 tooltip generics + a missing `audience.mode` in calibration.ts)

## Files Created/Modified
- `src/components/app/home/home-starter.tsx` - HomeStarter: 3 chips + show-once demo + localStorage flag + canned-fixture POST
- `src/components/app/home/composer.tsx` - mounts `<HomeStarter>` in the `!hasConversationContent` region; chip handlers → Test (idea/test on active audience), Profile (evidence drop), Predict (gated General flow); `onDemoComplete` → `reloadProfileThread`
- `src/app/(app)/home/page.tsx` - dropped the "NO starter chips (D-18) / NO demo affordance (D-25)" lock; noted the P7 unlock (D-04)
- `src/components/app/home/__tests__/home.test.tsx` - asserts the 3 verbatim chips + first-run demo CTA/Dismiss + show-once (demo hidden when the flag is seeded, chips still shown); greeting/composer assertions preserved

## Decisions Made
- Demo fixture is a static in-repo string — the trust boundary stays the `/api/tools/profile` route (auth + caps re-validated), so the fixture needs no client-side sanitization (T-07-06-01, accept).
- Chips are NOT gated by the show-once flag — only the demo is. The chips are the permanent home wow seed; the demo is the one-time first-run moment.
- Demo body shape `{ kind: "text", text: fixture }` matches `handleProfileSubmit`'s StimulusInput contract; the flag is consumed eagerly (set before the POST resolves) so a slow or aborted run never re-shows the demo.
- A mounted-flag `useEffect` gates the demo block so SSR + the first client render agree (localStorage is client-only) — no hydration mismatch.

## Deviations from Plan

None in this plan's own tasks — Tasks 1–3 executed exactly as written.

Two orchestrator-applied fixes surfaced during the Task-4 browser pass (both already committed, out of this plan's task scope, documented here for traceability):

**1. [Browser-pass fix] Audience switcher dropdown clipped by the fused composer surface**
- **Found during:** Task 4 (real authed /home browser pass)
- **Issue:** When a /home thread had content, the in-composer audience switcher dropdown was clipped by the fused composer surface's `overflow-hidden`.
- **Fix:** Portaled the dropdown to `<body>`.
- **Files modified:** the AudiencePresence switcher (07-02 surface)
- **Committed in:** `a64d6ecf`

**2. [Pre-existing build-gate type errors] next build TS gate to green**
- **Found during:** Task 4 (build gate before the browser pass)
- **Issue:** Two PRE-EXISTING TS errors (predating phase 07) blocked the `next build` TypeScript gate: recharts-3 tooltip generics + a missing `audience.mode` in calibration.ts.
- **Fix:** Corrected both type errors.
- **Files modified:** earnings-chart / recharts tooltip site + calibration.ts
- **Committed in:** `99ae67c8`

---

**Total deviations:** 0 in-plan; 2 orchestrator-applied fixes during the browser pass (1 UI clip, 1 pre-existing build-gate type error).
**Impact on plan:** No scope creep. The two browser-pass fixes were necessary to unblock the build gate and correct a clipping regression; both are committed.

## Known Stubs
None — the demo fixture is intentionally a static in-repo string (the canned cold-start moment, by design per VISION §15.5 / T-07-06-01), not a stub blocking the plan's goal.

## Issues Encountered
None during the in-plan tasks. The Task-4 browser pass surfaced the two issues above (dropdown clip + pre-existing build-gate type errors), both fixed and committed by the orchestrator.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UX-05 closed; this was the LAST plan of Phase 7 (the Audience-as-Front-Door surface).
- All 5 UX requirements (UX-01..05) complete; the full P7 surface passed a real authed browser check (zero console errors/warnings, matte, single liveness-dot accent, byte-identical Socials creator path).
- Phase-level verification + completion are owned by the orchestrator (`/gsd-verify-work 7`) — this continuation does NOT mark the phase complete.

## Self-Check: PASSED
- All 4 files present (home-starter.tsx, composer.tsx, page.tsx, home.test.tsx)
- All 3 task commits present (672e8c93, 739b7902, 4827c432)
- Full home/composer/reskin-matte suite GREEN: 3 files / 26 tests passed

---
*Phase: 07-audience-as-front-door-surface*
*Completed: 2026-06-29*
