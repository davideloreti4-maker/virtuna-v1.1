# Handoff — Ambient Audience v2 surfaces UI rework (2026-07-22)

Session focus: a **premium UI/UX + content-logic rework of the three Ambient Audience v2 dev
surfaces** — Overview ① · Start ④ · Simulate ⑤ (+ the cold Intake). All three are still
**fixture-driven design surfaces** rendered only at the dev route `/ambient-v2`. This session made
them design-grade and fixed the content model; **none of it is wired to live data or the engine
yet.** That wiring — plus the new Qwen call system — is the next session's job (kickoff prompt at
the bottom).

---

## ⚠️ Read first — environment gotchas that cost real time this session

- **This worktree's dev server is on `:3007`, NOT `:3011`.** `:3011` is the *skill-cards-prod*
  worktree (`~/virtuna-skill-cards-prod`) and will serve a STALE `/ambient-v2`. Always confirm the
  port's cwd: `for p in $(lsof -ti:3007 -sTCP:LISTEN); do lsof -a -p $p -d cwd -Fn | grep ^n; done`.
- **Screenshots hang on this app** (never-settling ambient animations). Verify via
  `mcp__playwright__browser_evaluate` reading the DOM / `getComputedStyle`, or raw Playwright with
  `animations:'disabled'`. Do NOT use `browser_take_screenshot`.
- Route is client-rendered; a stale HMR bundle can lie — bounce through `about:blank` then re-nav,
  and if still stale, check you're on the right port/cwd.

## Gates (all green at handoff)
- `npx tsc --noEmit` → 0
- `npx eslint <changed files>` → 0
- `node ./node_modules/vitest/vitest.mjs run reading/__tests__/reskin-matte.test.ts` → 38/38
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3007/ambient-v2` → 200

---

## What changed this session (9 files, all under `src/components/audience-lens/v2/` + globals)

### Overview ① — `AmbientOverview.tsx` + `overview-fixture.ts`
- **Live "Simulating now" card** premiumised: breathing live dot, a travelling cream **scan** over
  the fill (`ambient-fill-flow`, horizontal twin of `spine-flow`), a **connected stage stepper**
  (reading → brains → votes → verdict), and a **sealed-lock** affordance that reveals the verdict.
- **Ranked list** grouped into two sections:
  - **Sealed** (measured) — ranked high→low by `stopPct`; the **rank-1 bar is sage green**
    (`#8ea68a`, `--color-positive`). Coral + "loudest no" were **removed**.
  - **Not simulated yet** (queued) — same row anatomy as sealed, ranked by **`personaStops` (N/10
    would-stop at generation)**, muted bar (an estimate, not a verdict). Whole row is a
    **quick-simulate door**; the value slot reveals `Simulate →` on hover (`onQuickSimulate(id)`).
- Per-row **kind chip** (HOOK / IDEA / VIDEO / SCRIPT / REMIX) so a mixed board is legible.
- **Header** de-sketched: removed `3D` from the calibration chip (now just `calibrated` + a cream
  status dot), replaced the sparkline-ish constellation with a **calm audience-cluster glyph**, and
  a proper chevron switch button.

### Start ④ — `AmbientStart.tsx` + `start-fixture.ts`
- **Glyph above the greeting removed** (owner ask).
- **Skills shown are now the real platform set** from `SKILL_RUN_META`, grouped by verb:
  - **Make**: Hooks · Ideas · Script · Remix
  - **Analyze**: Test · Read · Account
  - **Discover**: Explore
  - (Caption / Thumbnail / Repurpose were fake — removed. The separate "Test" door was folded into
    the grid since Test is a skill.)
- Each skill is a **choosable tile** — icon well + label + the **lens it arms** (`Would they stop?`
  …). `onSkill(id)` fires with the real `SKILL_RUN_META` key. Data model changed:
  `StartData.skillGroups: SkillGroup[]` (was `makeLabel`/`makeSkills`/`simDoor`).
- Composer + conditions strip polished (chevron svgs, focus-within, send states).

### Simulate ⑤ — `AmbientSimulate.tsx` + `simulate-fixture.ts`
- **The Lens** rebuilt as a **segmented behavioural-funnel control** (Stop → Finish → Share →
  Follow → Buy). Active fills cream. Below it the choice is spelled out live: `Would they …?` + a
  new **funnel-stage descriptor** (`SimLens.stage`, e.g. "Attention — the thumb-stop in the first 2
  seconds"). Custom question still compiles visibly to the nearest lens.
- **The Slice** — emphasized headcount + `% of the room` + a slim **share bar** (`seg.share`).
- Tie-back pill, full-strength stimulus, per-section purpose helpers, emphasized footer receipt,
  larger Simulate button.

### Cold Intake — `SimulateIntake.tsx`
- Doors regrouped by family (**Screen / Compare / Query**) with premium icon-well tiles; Screen
  active, Compare/Query show `soon`.

### `globals.css`
- Added scoped, reduced-motion-guarded keyframes: `ambient-fill-flow`, `ambient-live-pulse`,
  `ambient-row-in` (all matte cream, no glow).

### `src/app/ambient-v2/page.tsx`
- Dev harness updated for the new props (`onQuickSimulate`, `onSkill(id)`, dropped `onTestDoor`).

---

## The gap — these are FIXTURES; nothing is wired

Every surface reads a hand-authored fixture and calls no-op handlers. The view-models were shaped
to mirror the live contracts, but the adapters do not exist. Next session must wire each:

| Surface | Fixture | Needs to come from |
|---|---|---|
| Overview watching card | `OVERVIEW_R4.watching` | a live run in flight. **Engine emits terminal binary snapshots, NOT partial-vote streams** — the staged progress is HONEST UI only (verdict SEALED until n-of-n). Keep that contract. |
| Overview ranked (sealed) | `OVERVIEW_R4.ranked` | real completed runs for the thread (`stopPct`, `kind`, `id`). |
| Overview queued | `state:"queued"` rows | generated-but-not-yet-simulated stimuli + their **generation-time `personaStops` /10**. |
| Overview cast | `OVERVIEW_R4.cast` | the calibrated audience personas. |
| `onQuickSimulate` / `onOpenStimulus` | no-ops | arm ⑤ for that stimulus / open the Brain/Detail. |
| Start skills | `START_R4.skillGroups` | `SKILL_RUN_META` (already the source of truth for ids/labels). `onSkill(id)` → real dispatch. |
| Start conditions | `START_R4.conditions` | thread context (audience binding · scene · fidelity). |
| Simulate lenses/segments | `SIMULATE_R4` | engine scoring lenses + the calibrated audience segments; `SimulateConfig` → the real run. Fidelity: Flash n=1,000 / Max n=10,000. |
| Intake (video/draft) | `SIMULATE_R4.intake` | the screen path → `/api/analyze` pipeline; A/B + ask/survey stay deferred until their read-templates exist. |

**Open design calls left for the owner** (surfaced this session, not yet decided):
- Lens set per stimulus kind (currently the fixed 5-lens funnel for all kinds — should a hook only
  offer Stop/Finish/Share?).
- Start: single-skill group (Discover→Explore) leaves an empty grid column — full-width or keep the
  2-col rhythm? And Ideas-first vs Hooks-first in Make.

---

## The new Qwen call system (owner to specify; wire next session)

Flagged by the owner as part of the next implementation pass. **Details were not provided this
session** — get the spec first. Context for whoever picks it up:
- Engine is **Qwen-only** (`[[qwen-only-pipeline]]`), model policy SSOT `docs/MODEL-POLICY.md`
  (ENGINE 3.20.0), DashScope parallel calls (`[[engine-latency-optimization]]`), determinism gate
  temp:0+seed (`[[engine-determinism-gate]]`).
- The Simulate/skill runs the surfaces above must call into will route through this Qwen call
  system — so **land the call-system change before (or with) wiring the surfaces**, then point the
  arm/skill handlers at it.
- Confirm with the owner: what's *new* about it (batching? a new SIM-1 Flash/Max split? a unified
  client? cost/latency guardrails?) before writing code.

---

## COPY-PASTE — next session kickoff

```
Continue the Ambient Audience v2 work. Branch design/ambient-audience-v2 (merged to main this
session). Read docs/HANDOFF-2026-07-22-ambient-v2-surfaces-ui-rework.md FIRST — it has the full
state.

Context: the three v2 surfaces (Overview ① / Start ④ / Simulate ⑤ + cold Intake) got a premium UI
+ content-logic rework and are DESIGN-COMPLETE as fixtures at /ambient-v2. Nothing is wired to live
data or the engine. Your job this session:

1. THE NEW QWEN CALL SYSTEM — I'll give you the spec. Implement it first (it's what the sim/skill
   runs route through). Engine is Qwen-only; SSOT docs/MODEL-POLICY.md; DashScope parallel;
   determinism temp:0+seed. Ask me for the exact spec before coding.

2. WIRE THE SURFACES to live producers (see the handoff's gap table): Start skills → SKILL_RUN_META
   dispatch; Simulate arm (SimulateConfig) → a real run through the Qwen call system; Overview
   watching/ranked/queued/cast → live run results + calibrated audience (KEEP the sealed-verdict
   contract — engine emits terminal snapshots, not partial streams). Wire onQuickSimulate → arm ⑤,
   onOpenStimulus → Brain/Detail.

3. Answer the two open design calls in the handoff (lens-set-per-kind; Discover single-tile layout).

ENV: dev server for THIS worktree is on :3007 (NOT :3011 — that's skill-cards-prod). Screenshots
hang — verify via DOM/getComputedStyle or Playwright animations:'disabled'. Gates before commit:
tsc 0 · eslint 0 · matte reading/__tests__/reskin-matte.test.ts 38/38 · /ambient-v2 200. Design SSOT
= globals.css (accent #FF6363, sage/positive #8ea68a). Commit only when I ask.
```
