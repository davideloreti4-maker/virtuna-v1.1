# Handoff — v8 refinement session complete; PR #458 MERGED · lane/platform-concept

> **Written 2026-08-09, end of the refinement session.** The owner's correction brief
> (`docs/HANDOFF-2026-08-09-v8-ui-refinement-kickoff.md`) is fully executed: all three
> structural defects fixed, the composer/shelf craft pass done and judged in the browser,
> and **PR #458 (phases 2, 3, 5 + the refinement) merged into `main`** with the owner's
> go-ahead ("continue merge and handoff"). This doc is the state + what's next.

## 1. What is now on main

- **Phases 1, 2, 3, 5** of concept v8 (composer · shelf · report · day-0 lanes), all behind
  `NEXT_PUBLIC_CONCEPT_V8` (+ requires `NEXT_PUBLIC_AMBIENT_V2`). Flag-off byte-identical —
  re-verified this session; every refinement edit is flag-gated or lives in v8-only files.
- **The 2026-08-09 owner rulings, implemented** (`fa30fb09`):
  - **NO RAIL.** Pin/pinHost deleted everywhere; the report is an EVENT — sheet <xl,
    closeable overlay ≥xl. Nothing sim-related is permanently resident.
  - **Sub-bar is CONTEXT ONLY** (audience · lens → the sheet). Its `Simulate ›` half is
    deleted; **the card's meter is the sim's one door**. The live dot pulses in flight.
  - **One audience page.** `PersonaAudienceFrame` + `audienceSlot` deleted; the personas-only
    grade lives inside the existing `PopulationFrame` via `DomainTemplate.personaRead`.
  - **Nothing above the field** is now pinned by a flag-on test in `composer-v8.test.tsx`
    (the `useHeader` guard existed; the missing piece was the regression test).
- **The craft pass** (same commit): composer box re-derived (chrome `#1a1a19` fill — darker
  than the page — 10% border, r24, one shadow, mock field rhythm, short rest placeholder);
  model selector = quiet text variant (boxed flag-off unchanged); skills panel anchors ABOVE
  the box with a real preview pane + pinned router line; drop + lane cards are compact rows
  (92px full-bleed thumb column, serif hook leads, dot meter, quiet Remix pill,
  `#252524` card tone); arrival intro banner gated off (spec §0b: greeting · drops ·
  composer, nothing else); `ambient-room-in` entrances on the v8 overlays.

## 2. Verification that backed the merge

Screenshots in native-size contexts at 393×852 and 1440×900 (signed-in via the minted-cookie
recipe), each surface JUDGED, not just measured: arrival + shelf (5 real cards), thread
composer, skills panel, `/` autocomplete, audience sheet (provenance rows + lens), drop
report (7/10 verdict, faces, real voices, no pin). Zero page errors throughout.
Gates at merge time: `tsc --noEmit` clean · `npm run build` clean · vitest **5647 passed /
1 pre-existing `routing-cut` failure** (caused only by this worktree's uncommitted `/start`
files — not part of the PR).

## 3. ⚠️ Operational facts the next session must know

- **A `post-commit` hook AUTO-PUSHES every commit** (`.githooks/post-commit`, observed live
  this session). On this repo, commit = push: run the gates BEFORE `git commit`, not before
  a separate push step.
- **Vercel git is DISCONNECTED (since 2026-08-08): merging does NOT deploy.** Nothing from
  this merge is live anywhere. Deploying is a separate, manual decision — and flipping
  `NEXT_PUBLIC_CONCEPT_V8` in prod needs the env var set + a REDEPLOY (env vars are
  write-only `sensitive`; probe the running app, don't trust the dashboard).
- **Stale `.next` chunks can MIX flag states.** The owner's screenshot showed the pre-v8
  header flag-on; the code cannot render that (guard predates the report), and it never
  reproduced against a clean build. `NEXT_PUBLIC_*` inlines per-chunk at compile time — so
  clear `.next/` before judging any flag behavior, or you may file (or miss) phantom defects.
- The two uncommitted `/start` files stay uncommitted (owner call, SSOT §7.2). The e2e
  account cannot reach `/welcome` (onboarding pre-completed) — use the `zz-preview` recipe.
  The launchd reaper kills idle dev servers after ~10 min.

## 4. Open items, in priority order

1. **Lane synthesizer eval** (SSOT owner call, brief §6): `synthesizeLanes` has no eval —
   read real output on varied answers before the lanes leave the flag.
2. **Drop economics** (owner call #3): blocks un-gating the drops spend and ANY billing
   wiring. The v8 routes stay 404 flag-off until settled.
3. **Owner copy review** before launch: skills-panel taxonomy naming vs the real registry
   (SSOT §7.6), `PROMISE_BY_TOOL`, chips, "Tonight's remixes", the v8 rest placeholder.
4. **`drop-seed.ts` silently drops a concept with no `stopQuote`** (Phase-3 finding, still
   unfixed): `scrollQuote: stopQuote ?? ""` fails `RemixCardBlockSchema.min(1)` → the block
   vanishes. Fix belongs in the Phase-2 seed path.
5. **Multiplier basis** (owner call #1) — still blocks printing any corpus number.
6. The legacy flag-off `/` slash menu is still clipped invisible by the composer's
   overflow-hidden (v8 portals its own; legacy left as-is deliberately — owner knows).
7. The accuracy ledger has no data ([[outcome-loop-has-never-closed]]) — any ledger UI
   renders empty forever until reconciliation capture exists somewhere reachable.

## 5. Kickoff prompt for the next session

```
Platform concept v8 — post-merge session, worktree ~/virtuna-platform-concept
(branch lane/platform-concept — git fetch first; PR #458 is MERGED, main carries
phases 1/2/3/5 + the 2026-08-09 refinement, all flag-gated).

Read: docs/HANDOFF-2026-08-09-v8-refinement-merged.md (state + open items), then
docs/HANDOFF-2026-08-08-concept-v8-implementation.md (SSOT) for anything conceptual.

Rules that survive every session: fire-on-demand; accent dosage LOCKED (live dot +
brand mark only, primary actions neutral cream, matte); type from the roles; no
fractional px; Flash sim is platform-blind; no corpus multiplier numbers; donor
niche/handle never rendered; flag-off byte-identical; never commit the two /start
files. A post-commit hook AUTO-PUSHES — gates (tsc · build · vitest, baseline =
1 routing-cut failure) run BEFORE commit. Vercel git is disconnected — merging
does not deploy.

Pick up from §4 of the handoff (lane eval first unless the owner says otherwise).
Phases 4 and 6 stay skipped. Audit the live product before building any mock section.
```
