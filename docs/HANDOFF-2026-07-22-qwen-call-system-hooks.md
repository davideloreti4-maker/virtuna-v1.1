# Handoff — New Qwen call system: STEP 1 (hooks) done (2026-07-22)

## The owner's spec (why this exists)

Today a skill run makes **2 model calls** (3 for video):
1. **Generation** — writes the content (hooks/ideas/script/remix).
2. **Persona SIM** — the audience reacts to what was generated (the "N/10 stopped" + per-persona cast).

New call system: **collapse to 1 call.** The single generation call ALSO self-emits the **simple
ranking** shown on the card (the "8/10 stopped" chip). The **full audience simulation is decoupled**
— it runs ONLY when the user fires it ("See the room →"), and returns the sealed verdict.

- Video: the **omni** call (audio) STAYS, the **check-generation** call STAYS, the **persona** call
  is removed — same idea (3 → 2).
- Confirmed with owner: the /10 rides the FIRST (generation) call, and ranking is best→worst off that
  /10 score. **Sequencing: hooks first (reference), then fan out to ideas/script/remix, then video.**

## STEP 1 — HOOKS — ✅ DONE (this session)

Collapsed `runHooksPipeline` from 2 calls → 1. Gates all green:
`tsc 0` · `eslint 0` · hooks-runner **19/19** · matte **38/38** · hook/proof/route cluster **69/69**
(incl. `ideas/develop → runHooksPipeline`) · `/ambient-v2` **200**.

### The recipe applied to hooks (the template for the fan-out)
1. **Gen contract** — added `personaStops` (int 0–10) + `stopQuote` (string) to the three hook output
   contracts (base/grounded/targeted) via `PROJECTION_FIELD`/`PROJECTION_RULE`. The model self-rates.
2. **Removed the SIM path** — deleted `runFlashTextModeBatch`, `buildReactionPanel`,
   `buildFlashWeighting`, `aggregateFlash`, `characterizeContent`/population, `deriveAudienceArchetype`,
   `selectLeadScrollQuote`, the FLYWHEEL `pinPredictedSignature`, and the `bandOrdinal`/`parseFractionNumerator`
   rank helpers. `input.intent`/`input.pin` are now accepted-but-unused (kept so the route call is unchanged).
3. **Derive from the /10** — `band = bandFromStops(personaStops)` (NEW export in `flash-aggregate.ts`,
   shares the SIM's 6/3 calibration SSOT), `fraction = "N/10 stop"`, `scrollQuote = stopQuote`.
4. **Rank** — single descending sort on `personaStops`, tie-break generation order.
5. **Card** — `provenance: "projected"` (NEW optional schema field; absent ⇒ legacy "measured").
   `personas` + `population` OMITTED (measured artefacts → fired sim). `audienceArchetype` now comes
   from the per-persona target (was SIM-derived). `bindTarget` gets `personas: []` → the target names
   WHO it was written for but `verdict`/`quote` are `null` (reaction deferred to the fired room).
6. **Honesty relabel** (renderer) — a projected card reads **"would stop"** (not "stopped") + tag
   **"· projected"** (not "· SIM-1 Flash"). `proof-unit.tsx` got a `projected?` prop (verb flip);
   `hook-card-block.tsx` reads `provenance`. Guard test added (fails against the old code).
7. **Route** — dropped the dishonest "Scoring on your audience…" status; the "Simulating your
   audience" SSE stage is gone (runner no longer emits it).

### Files (8)
- `src/lib/tools/runners/hooks-runner.ts` — the collapse
- `src/lib/engine/flash/flash-aggregate.ts` — `bandFromStops` export
- `src/lib/tools/blocks.ts` — `provenance` field on `HookCardBlockSchema`
- `src/components/thread/hook-card-block.tsx` + `src/components/thread/proof-unit.tsx` — projected relabel
- `src/app/api/tools/hooks/route.ts` — status copy
- `src/lib/tools/runners/__tests__/hooks-runner.test.ts` — rewritten to the 1-call contract
- `src/components/thread/__tests__/make-card-value-fields.test.tsx` — projected-card honesty guard

## Open flags for the owner
1. **Copy**: projected card says "would stop · projected" (honest) vs the Image #2 "stopped". Confirm/adjust.
2. **Not live-tested**: the model self-estimates the /10 — wiring/derivation is verified deterministically,
   but the ESTIMATE QUALITY needs a real Qwen run (no API run this session). Watch the first live hooks run.
3. **Merge posture**: hooks is now on the 1-call system; ideas/script/remix/video are still on the OLD
   2–3 call path. Merging hooks-only makes the live app show hook cards "projected" while others stay
   "measured" — a temporary per-skill inconsistency. Recommend landing the whole migration together.

## REMAINING WORK

### Step 2 — fan out to ideas / script / remix (SAME pattern, NOT blind copy-paste)
Each differs — mirror the SHAPE (gen self-emits /10 + quote, remove SIM, provenance:"projected",
drop personas/population, defer reaction), but respect each runner's specifics:
- **ideas-runner** (5 SIM calls) — GATES (drops Weak), does NOT rank. Keep the gate off the /10.
- **script-runner** (5) — ONE card, OPENER-ONLY band (Pitfall 5: band describes the opener beat, not
  full-watch). The /10 estimates the OPENER's stop.
- **remix-runner** (3) — its own shape; trace it before editing.
- Each has its own card schema (`ScriptCardBlockSchema` etc.) — add `provenance` there too, and each
  renderer's provenance relabel + a guard test.

### Step 3 — video (`/api/analyze` `pipeline.ts`, 983 lines)
Remove the **persona SIM stage** only; keep **omni** (audio) + **check-generation**. `test/card` route
is already a cheap read-only adapter that excludes reception — no change there.

### Task-2 wiring (separate from the call-system)
Wire "See the room →" / the per-card modal → a REAL fired simulation (`/api/tools/simulate` →
`runSimulate`) that REPLACES the projection with the sealed verdict (queued→sealed). Move the FLYWHEEL
pin there. Today the door still opens the docked room with SYNTHESIZED reactions (unchanged).

### Two design calls still open (from the prior surfaces handoff)
- Lens-set-per-stimulus-kind (a hook shouldn't offer Follow/Buy).
- Start: Discover→Explore single-tile layout.

## ENV / gotchas
- Dev server for THIS worktree = **:3007** (NOT :3011 = skill-cards-prod, serves a STALE surface).
- Screenshots HANG (never-settling animations) — verify via DOM/getComputedStyle or Playwright
  `animations:'disabled'`, never `browser_take_screenshot`.
- `rg` behaves as an unreliable wrapper here — use `grep -rn` with SINGLE-quoted patterns (double
  quotes get mangled by zsh).
- Test runner: `node ./node_modules/vitest/vitest.mjs run <file>` (NOT `npm test`).
- Design SSOT = `globals.css` (accent `#FF6363`, positive/sage `#8ea68a`).

## COPY-PASTE — next session kickoff

```
Continue the new Qwen call system on branch design/ambient-audience-v2. Read
docs/HANDOFF-2026-07-22-qwen-call-system-hooks.md FIRST — full state + the per-file recipe.

DONE: step 1 (hooks) collapsed 2 calls → 1 — the single generation call self-emits personaStops (/10)
+ stopQuote, ranks off the /10, card is provenance:"projected" (honest "would stop", not a measured
claim), persona SIM + population deferred to the user-fired sim. All gates green.

YOUR JOB:
1. Step 2 — fan the SAME pattern out to ideas/script/remix runners (see the recipe; each differs:
   ideas gates-no-rank, script is opener-only single-card, remix has its own shape). Add provenance to
   each card schema + renderer relabel + a guard test per skill.
2. Step 3 — video: remove ONLY the persona SIM stage from /api/analyze pipeline.ts (keep omni +
   check-generation). test/card route already excludes reception.
3. (Separate) Task-2 wiring: "See the room →" fires a REAL runSimulate that REPLACES the projection
   with the sealed verdict; move the FLYWHEEL pin there.

ENV: dev :3007 (NOT :3011). Screenshots hang — verify via DOM. grep -rn with SINGLE quotes (rg is
flaky here). Tests: node ./node_modules/vitest/vitest.mjs run <file>. Gates before commit: tsc 0 ·
eslint 0 · matte reading/__tests__/reskin-matte.test.ts 38/38 · /ambient-v2 200. Commit only when I ask.
Owner flags to resolve: projected copy wording; watch the first live hooks run for /10 estimate quality.
```
