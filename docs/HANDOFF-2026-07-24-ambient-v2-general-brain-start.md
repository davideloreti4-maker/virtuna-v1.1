# Ambient v2 — Session Handoff (2026-07-24)

Branch `design/ambient-audience-v2` · worktree `~/virtuna-ambient-audience-v2` · dev **:3007**
(launch with `NEXT_PUBLIC_AMBIENT_V2=true` — the rail is flag-gated).

## ✅ MERGED TO MAIN — PR #377

The **whole** ambient-v2 branch merged to `main` (fast-forward; tip `e2f2d008`). This includes
this session's 4 changes **plus** all prior branch work (rail rework + Phase C video reader).
Nothing is left un-PR'd. Test user `e2e-test@virtuna.local` / `e2e-test-password-2026`.

## What shipped this session (4 atomic commits, all on main)

| Commit | Task | What |
|---|---|---|
| `a89964a9` | General population | Generic baseline signature → General shows the SAME Population page as calibrated |
| `dfac077d` | Start audience | Unblock audience selection on the v2 Start surface |
| `570d5b10` | Text Brain | The Brain page now fires on ALL text content (real reason-drivers) |
| `e2f2d008` | Detail surface | Brain/Audience detail matches the Overview (bg `#181817`, no rounding) |

### 1. General = the same Population page as calibrated (`a89964a9`)
- **Blocker was:** `GENERAL_AUDIENCE` has `personas: []` + no signature axes → react set `population: null` → a General sealed row was inert.
- **Fix:** new `src/lib/audience/general-baseline-signature.ts` — an honest **generic** `AudienceSignature`: 10 fixed archetypes with archetype-true `reaction` axes + a generic `topic_vocab` (relatable/humor/spectacle/…). Every human-readable field (creator_persona / summary / per-persona `evidence` / provenance) states it is **uncalibrated** — no fabrication.
- **Injection is surgical:** `src/app/api/tools/react/route.ts` — `const populationSignature = audience.signature ?? (audience.is_general ? GENERAL_BASELINE_SIGNATURE : null)`. It is NOT baked onto the exported `GENERAL_AUDIENCE` constant, so tier / reveal / other skill routes / calibration are untouched. The moat holds (General still reads "not calibrated"; calibration = YOUR people vs a generic baseline).
- `openStimulus` (`AmbientOverviewRail.tsx`) already gates the drill on `snap?.population` — no gate change needed, only comments updated.
- **Verified live:** a General react returned a real 1,000-individual population, 10 differentiated segments (Quiet Watchers 26% vs Tough Crowd 95% on a strong hook).

### 2. Start-page audience unblocked (`dfac077d`)
- **Bug:** on empty `/home` under the flag, `AmbientStartHome → AmbientStart` renders the "Testing against" audience chip as a hard-locked non-interactive span, and the real `AudiencePresence` switcher isn't mounted pre-thread → no way to pick your room.
- **Fix:** new interactive `AudiencePick` inside `AmbientStart.tsx` (grouped Socials/General via `groupAudiences`, neutral `resolveTier` badge, checkmark), threaded `composer.tsx → AmbientStartHome → AmbientStart`, wired to the existing `handleSelectAudience` (persists last-audience, reconciles skill mode, regrounds a stale read). In-thread reuse keeps the locked span (a new audience means a new thread).
- **Verified live:** opened the picker, switched to "Fitness Creators", chip + `effectiveAudience` updated.

### 3. The Brain page fires on ALL text content (`570d5b10`)
- **Owner call 2026-07-24:** text content should ALSO open the Brain page (was Population-only; `brain` was `undefined` → honest-unavailable). Chosen source: **real reason-drivers now** (no engine change, no fabrication).
- New `reason-breakdown` `BrainDriver` kind (`domain-template.ts`) + `ReasonBreakdown` figure (`BrainTab.tsx`): the REAL dominant-reason tally as weighted bars — `interest`/`strong-hook` = pull (cream); `weak-hook`/`novelty-mismatch`/`hype-vs-skeptic`/`too-slow` = friction (coral). No invented attention curve.
- New `buildReasonBrainFrameData` (`ambient-v2-population.ts`): cortex **modeled proxy** (concept-seeded, real stop-ratio, nominal 6s loop) + the reason breakdown; `signals: []` (no craft dims on text); an honest `calibrationNote` ("the reasons are real, the cortex is a proxy — not measured attention").
- `buildDomainTemplate` now sets `brain` (was `undefined`); the rail drops the `brainNote` override → the drill opens **brain-first**, the Population tab is still reachable. `SignalRows` guards empty (no empty "breakdown" section).
- **Verified** via the rail component test (renders the real `AmbientOverviewRail → AmbientDetail → BrainFrame → ReasonBreakdown` path). Full manual rail-drill browser click was skipped (heavy card-generation setup) — the component test covers that exact path.

### 4. Brain/Audience detail matches the Overview surface (`e2f2d008`)
- The `AmbientDetail` root read as a floating card (bg `#1f1f1e`, `rounded-[16px]`, full border, fixed 800px) inside the connected rail. Now mirrors `AmbientOverview`'s root exactly: bg **`#181817`**, **no rounding**, a single left hairline divider, `height: 100%`. Both tabs share the root, so Brain and Audience are fixed together. Removed the now-unused `AMBIENT_PANEL_HEIGHT` import.
- **Verified live:** computed `background: rgb(24,24,23)` = `#181817`, `border-radius: 0`, `border-left: 1px`.

## Gates (all green at session end)
`tsc 0 · eslint 0 · matte 38 · rail 7 · adapters 11 · population 10 · baseline 5`.
Run tests with `node ./node_modules/vitest/vitest.mjs run <paths>` (NOT `npm test` — see repo notes).

## Architecture notes for the next session
- **The rail is the real surface.** `AmbientOverviewRail` (in `composer.tsx`, `audienceRailV2`) hosts Overview⇄Detail; `/ambient-v2` is a dev-fixture review page (not the live flow).
- **Depth rides in `threads.sim_seals` jsonb** (no `sim_snapshots` table). Seal persistence needs the migration `20260723090753_thread_sim_seals.sql` applied to activate reload-survival; it safe-degrades until then (in-session drill works regardless — the rail captures `data.population` into its session seal).
- **DomainTemplate is the platform contract** (`domain-template.ts`): Brain answers *why* (cortex + driver + signals), Population answers *who/how many*. A new domain = one `DomainTemplate` + a new driver `kind` + a figure case in `BrainDriverSlot` / `PopulationMainSlot`. Add-a-domain never forks the page.
- **Honesty spine is strict here** — every brain/population figure is REAL data or a labeled modeled proxy; never invent a figure. The `reskin-matte` guard + the adapters' honesty tests enforce it.

## Open / not started
- Seal-persistence migration `20260723090753_thread_sim_seals.sql` may still need applying to prod for reload-survival (in-session works today).
- Full manual rail-drill browser click for the text Brain (covered by component test).
- Next session: **other fixes** (owner-directed — TBD).
