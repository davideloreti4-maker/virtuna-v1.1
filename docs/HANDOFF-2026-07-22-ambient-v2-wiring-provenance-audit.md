# Ambient Audience v2 — surface wiring: provenance audit + build spec (2026-07-22)

Branch `design/ambient-audience-v2` · worktree `~/virtuna-ambient-audience-v2` · dev **:3007**.
Owner decision (2026-07-22): **wire ALL v2 surfaces to real producers — cut nothing.** Build real
producers for the fabricated sections too, honestly tagged **modeled** where a field is a proxy
(the honesty spine forbids modeled-as-measured, NOT modeled-and-labeled).

Prereqs read: `HANDOFF-2026-07-22-qwen-call-system-step2.md` (the projection system — steps 1-2,
merged PR #368). The **projection** (skill-card self-estimate `personaStops /10 + stopQuote`) and the
**simulation** (the separate `runSimulate` that lights up Overview/Brain/Population) are TWO DIFFERENT
CALLS and must stay that way. This doc is about wiring the second one to the v2 surfaces.

## Current state (verified 2026-07-22)

- The 5 v2 surfaces live ONLY at the `/ambient-v2` dev route, 100% fixture-driven, mounted nowhere in
  the real app: `AmbientStart` · `AmbientSimulate` (+`SimulateIntake`) · `AmbientOverview` ·
  `AmbientDetail`→`BrainTab`/`BrainDepth` · `AudienceTab`/`AudienceDepth`/`AudienceTerrain`.
- Data shapes: `OverviewData` (AmbientOverview) · `SimulateData` (AmbientSimulate) · `StartData`
  (AmbientStart) · `DomainTemplate` = `BrainFrameData` + `PopulationFrameData` (domain-template.ts,
  authored as `CREATOR_TEMPLATE` in detail-fixture.ts).
- `BrainFrameData` / `PopulationFrameData` / `DomainTemplate` have ZERO live producer today.
- Real producers that DO exist:
  - **Projection** — `personaStops /10 + stopQuote` per generation (steps 1-2, live).
  - **Text sim** — `runSimulate` PANEL → `runFlashTextMode` → 10 `ReactionPersona` = `{archetype,
    verdict: stop|scroll, quote}` (thin — no curves, no scores).
  - **Video sim** — `runFold` (wave3) → per-persona **attention timeline [0,1] + swipe_predicted per
    segment** (`fold-prompts.ts`); omni/Apollo craft dims (`GeminiVideoSignals`:
    visual_production_quality, hook_visual_impact, pacing_score, transition_quality…); filmstrip
    heatmap segments; the Test card's craft ring + driver bars.
  - **Audience** — signature = 10 segment slots, each with a weight + a `why` (`population.ts`);
    `expandPopulation` 10→N individuals.
  - **Tier / calibration** — `resolveTier`, the audience calibration badge.

## Provenance audit — every field

Legend: 🟢 REAL (producer exists) · 🟡 DERIVABLE (from personas/audience) · ⚙️ STATIC (config) ·
🟠 needs a NEW derivation (baseline/history) · 🔴 needs a NEW modeled producer (no source today).

### ④ Start — `StartData`  → wires ~100% now, zero fabrication (FIRST WIN)
| Field | Prov | Producer |
|---|---|---|
| `name` | 🟢 | user profile |
| `conditions.audience` | 🟢 | active audience |
| `conditions.scene` (+options) | 🟢 / ⚙️ | platform choice / static |
| `conditions.fidelity` (+options) | 🟢 / ⚙️ | resolveTier / static |
| `skillGroups[]` | 🟢 | SKILL_RUN_META (exists) |
| `composerPlaceholder` | ⚙️ | static |

### ⑤ Simulate — `SimulateData`  → wires fully (all real or static)
| Field | Prov | Producer |
|---|---|---|
| `stimulus{text,kind}` | 🟢 | drafted content + kind |
| `room`/`provenance`/`scene`/`fidelity` | 🟢 | audience name / calibration badge / thread chip / tier |
| `lenses[]` (stop·finish·share·follow·buy) | ⚙️ | static behavioral funnel |
| `defaultLens` | 🟡 | entry preset |
| `segments[]` | 🟢 | audience signature (population.ts) |
| `develop{band,value,lensLabel}` | 🟢 | the projection personaStops (steps 1-2) |
| `intake[]` | ⚙️ | static doors |

### ① Overview — `OverviewData`  → wires fully (projection + fired-sim measured %)
| Field | Prov | Producer |
|---|---|---|
| `audienceName`/`provenance`/`tier` | 🟢 | audience |
| `watching{stimulus, verdictPct}` | 🟢 | fired sim, sealed terminal snapshot (verdict withheld until n-of-n) |
| `ranked[].personaStops` | 🟢 | projection /10 (steps 1-2) |
| `ranked[].stopPct` | 🟢 | measured would-stop % from the fired sim; 0 until run |
| `ranked[].state` (queued) | 🟡 | has a sim run for this stimulus? |
| `ranked[].kind` | 🟢 | stimulus kind |
| `cast[]`+`castOverflow` | 🟡 | persona avatars from the run |

### ② Brain depth — `BrainFrameData`  ⚠️ the fabrication zone, split by kind
| Field | VIDEO | TEXT | Producer |
|---|---|---|---|
| `cortexSeedKey` / `stopRatio` / notes | 🟡/⚙️ | 🟡/⚙️ | hash stimulus / verdict aggregate / static honesty |
| `clipSeconds` | 🟢 | — | video clip length |
| `driver: attention-scrubber` | 🟢 | 🔴 | fold per-segment attention timeline — video only |
| `signals` (lean 3-row) | 🟢 | 🔴 | omni/Apollo craft dims — video only |
| `signalGrid` (9 signals) | 🟡 | 🔴 | omni craft dims → 9-signal map; video |
| `whyThisSecond` | 🟡 | 🔴 | fold decisive moment; video |
| `networkBars` (z-scores) | 🔴 | 🔴 | NEW modeled producer (LLM decomposition, tagged modeled) |
| `kpiHeatmap` (per-sec × system) | 🔴 | 🔴 | NEW modeled producer (video: from fold segment attention; text: N/A) |
| `buyIntent` | 🔴 | 🔴 | NEW — the BUY lens curve |
| `networks` (plain-σ) | 🔴 | 🔴 | NEW modeled (same call as networkBars) |
| `driver: resistance-curve` | 🔴 | 🔴 | pricing domain — out of scope until a pricing bundle |
| `askWhy` | ⚙️ | ⚙️ | honest stub (enabled:false) already |

### ② Population depth — `PopulationFrameData`  → core real, 2 gaps
| Field | Prov | Producer |
|---|---|---|
| `main: tri-state` | 🟡 | aggregate persona verdicts (text=2-state; "skim" needs a 3rd band from finish-lens) |
| `terrain{clusters, lossClusterIndex}` | 🟡 | audience segments → clusters + rates |
| `voices{reasons, total}` | 🟢 | each segment's `why` + persona quotes |
| `room{simulated, calibratedOn, confidence}` | 🟢 | sample N / calibration / tier confidence |
| `heroRead` | 🟡 | one-line synthesis |
| `swing` (fence-sitters) | 🟡 | near-miss count (fold attention near line) |
| `audienceFit` (index vs typical) | 🟠 | NEW: per-creator last-N baseline aggregate |
| `amplification` (reshare cascade) | 🔴 | NEW — the SHARE lens + segment carriers |
| `main: demand-curve` | 🔴 | pricing domain — out of scope |

## The build plan (phased)

The spine: **one sim run emits a rich terminal snapshot; every surface reads a slice of it.** This is
the "engine emits TERMINAL snapshots" the round-4 fixtures reference. Snapshot differs by stimulus
kind (video fold vs text flash). Sealed-verdict law: the snapshot is terminal (n-of-n), never a
partial-vote stream.

### Phase A — the SimSnapshot contract (foundation, everything depends on it)
Define `SimSnapshot` (persisted run result) as the superset the surfaces read: verdict (band/pct/
sealed) · per-persona · segments · **per-lens results** (stop/finish/share/follow/buy) · brain
decomposition (kind-gated) · population. Persist + version it.

### Phase B — mapping layer (pure functions, honesty tags)
`SimSnapshot → OverviewData` · `→ SimulateData` · `→ DomainTemplate` (brain+population). Every modeled
field carries its `modeled`/`calibrationNote` tag. Kind-gate the brain sections.

### Phase C — the producers (the "build it real" work)
- Video brain lean read: wire the EXISTING fold attention + omni craft dims (attention-scrubber,
  signals, whyThisSecond). Mostly plumbing.
- Behavioral-lens runs: extend the sim to run the armed lens(es) → buy-intent (BUY), amplification
  (SHARE + carriers), finish/follow. These make the funnel REAL, not invented.
- Modeled neuro decomposition (networkBars / kpiHeatmap / networks): a NEW modeled sub-producer —
  derive from craft signals + attention, OR a dedicated LLM decomposition call. Tag **modeled**.
- `audienceFit`: a per-creator last-N baseline aggregate (new).

### Phase D — mount + entry flow
Render the 5 surfaces in the real app. Wire Start → Simulate → Overview → Brain/Population. The
projected skill-card "Simulate →" door FIRES the sim (projection → sealed verdict). Relocate the
FLYWHEEL pin (`pinPredictedSignature`, currently orphaned) onto the fired sim's completion.

### Phase E — honesty guards + tests
Every modeled field labeled; a guard that fails if a `modeled` field renders without its tag; kind-
gating tested (text never shows an attention curve it can't have); no seeded-noise in a shipped path.

## Open decisions for the owner
1. **Modeled neuro depth (networkBars/kpiHeatmap/networks)** — derive-from-craft (cheap, defensible)
   vs a dedicated LLM decomposition call (richer, slower/costlier)? Recommend derive-from-craft first.
2. **Build order** — recommend A → B → (D for Start/Simulate/Overview, which are real NOW) → C for the
   depth producers → D for Brain/Population → E. Ship the real surfaces early; the modeled depth lands
   behind them.

## SESSION PROGRESS (2026-07-22) — Phase B + the parallel-run mount (Overview ⇄ Simulate, REAL data)

Owner decisions locked: build ALL producers (modeled where a proxy, honestly tagged); modeled neuro
depth = **derive-from-craft first**; mount = **parallel-run then cut over** (legacy `AudiencePresence`
untouched). Started with the three real-now surfaces.

DONE + GREEN (not committed — awaiting owner):
- **Descriptor `kind`** threaded through `AmbientCardDescriptor` + `toAmbientDescriptor` (block type →
  `hook`|`idea`|`script`|`remix`), so Overview rows are kind-legible. Test updated (17/17).
- **`src/lib/surfaces/ambient-v2-adapters.ts`** — the pure Phase-B layer: `buildOverviewData` /
  `buildSimulateData` / `buildStartData` + `parsePersonaStops` / `rankKindOf` + the static config
  (`BEHAVIORAL_LENSES` / `INTAKE_DOORS` / `START_SKILL_GROUPS`). Honesty spine: projected rows read
  `queued`, measured % withheld (0) until a real sim seals them; a sealed row outranks every queued
  row. 9/9 unit tests.
- **`src/lib/flags/ambient-v2.ts`** — `AMBIENT_V2_ENABLED` (env-gated `NEXT_PUBLIC_AMBIENT_V2`, off by
  default).
- **`src/components/audience-lens/v2/AmbientOverviewRail.tsx`** — the mount wrapper: live `Audience` →
  `audienceToMeta` (signature personas = segments) + the live projection ledger → Overview ⇄ Simulate
  on REAL data. 2/2 render test.
- **`composer.tsx`** — gated the ≥xl thread-rail portal: `AMBIENT_V2_ENABLED && audienceRailV2 ?
  audienceRailV2 : audienceRail`. Flag off ⇒ legacy rail byte-identical (dock + header always legacy).

Gates: tsc 0 · eslint 0 (composer warnings pre-existing) · matte 38/38 · `/ambient-v2` 200 · `/home`
307 (compiles) · touched-area sweep 180 pass / 9 skip.

**Start (④) mounted as the empty-home hero** (added same session):
- `src/lib/surfaces/ambient-v2-audience-meta.ts` — shared `audienceToMeta` (signature personas →
  segments), now used by both wrappers (rail refactored to import it).
- `src/components/audience-lens/v2/AmbientStartHome.tsx` — real name (`useProfile`) + audience →
  `buildStartData` → `AmbientStart`. `onSkill` → `handleUserSelectTool` (arms the tool); `onSubmit` →
  `seedAndRun` (`setUrl` + `setPendingAutoRun` → the existing one-shot auto-run fires `handleSubmit`).
  So Start drives REAL generation. 2/2 render test.
- `composer.tsx` — empty-home render gated: `AMBIENT_V2_ENABLED && !hasConversationContent &&
  selectedAudience ? <AmbientStartHome/> : (legacy dock + starter + demo)`.
- `home-page-layout.tsx` — `HomeGreeting` suppressed under the flag (AmbientStart carries its own).
- Gates re-verified: tsc 0 · eslint 0 · 182 pass / 9 skip (18 files) · `/home` 307.
- Scope note: the flag-on empty home is the simpler Start surface — the legacy field's slash menu /
  evidence-drop / model-picker affordances aren't re-homed yet (Analyze/Discover skills that need an
  upload or a different flow arm but may not fully run from Start's field). Fine for preview; the full
  affordance re-home is part of the cutover.

TWO seams deferred inside the wrapper (marked in-code):
- **Phase D — fire the real sim**: `AmbientSimulate onSimulate` currently returns to Overview; must
  fire `runSimulate`, stream `queued → sealed`, feed the `measured`/`watching` inputs of
  `buildOverviewData`, and relocate the orphaned FLYWHEEL pin (`pinPredictedSignature`) onto it.
- **Phase C — Brain/Population depth**: `onOpenStimulus` routes to Simulate (develop) for now; the
  depth producers (craft signals · attention · derive-from-craft neuro · lens runs · audienceFit
  baseline) aren't built, so no fixture depth ships.

TO REVIEW LIVE: run the dev server with `NEXT_PUBLIC_AMBIENT_V2=true` (dev :3007), open a thread with
generated cards, watch the ≥xl right rail — it's the v2 Overview ranked by the real projection; tap a
rank → the real Simulate arm card. (Screenshots hang — verify by eye / DOM.)

NEXT: (1) owner reviews the real Overview⇄Simulate rail; (2) Phase C depth producers (derive-from-
craft); (3) Phase D sim-fire + flywheel pin + projection→sealed; (4) mount Start (empty state) +
Brain drill; (5) cut over — rip `AudiencePresence`, wire the full flow, retire the flag.

## ▶▶ RESUME HERE (fresh context, 2026-07-22 session 2)

**What this session shipped (mounted the v2 surfaces on real data + reshaped Start to the owner's spec):**

1. **Adapter layer** `src/lib/surfaces/ambient-v2-adapters.ts` (+ `ambient-v2-audience-meta.ts`) — pure
   real-state → view-models. Honesty spine: projected rows `queued`, measured % withheld until a real
   sim seals them. Tests: `src/lib/surfaces/__tests__/ambient-v2-adapters.test.ts` (9).
2. **Flag** `src/lib/flags/ambient-v2.ts` → `AMBIENT_V2_ENABLED` (env `NEXT_PUBLIC_AMBIENT_V2`, off by
   default). Legacy `AudiencePresence` + legacy home are byte-identical when off.
3. **Overview rail** `AmbientOverviewRail.tsx` — mounted in the composer's ≥xl thread rail portal;
   real projection ledger → Overview⇄Simulate. `descriptor.kind` threaded through
   `toAmbientDescriptor`.
4. **Start home** `AmbientStartHome.tsx` — mounted as the empty-home hero. `useProfile` name + active
   audience. `HomeGreeting` suppressed under the flag (Start carries its own).
5. **Start REDESIGN (owner-driven, live)**: `AmbientStart` is now **greeting + conditions + the
   categorized MAKE/ANALYZE/DISCOVER grid as the DEFAULT surface** (no free-text box, no modal —
   the earlier "Make ▾ → full-screen picker" iteration was replaced per owner). **Option B wired:**
   picking a skill ARMS the tool + sets `startEngaged` in `composer.tsx` → the grid swaps to the
   legacy thread composer (chosen skill armed) → type topic → real run.
6. **Key fix**: `selectedAudience` is `null` on the General default (`selectedAudienceId===null`); the
   mount uses `effectiveAudience = selectedAudience ?? GENERAL_AUDIENCE` — without this the gate fell
   back to the legacy home.

**How to preview**: `NEXT_PUBLIC_AMBIENT_V2=true` on dev :3007 → `/home` (wide window ≥xl for the
Overview rail). `/ambient-v2` still serves the fixture surfaces for reference.

**▶ NEXT (owner's open items from live review):**
- Conditions strip placement between greeting + grid (keep / move?).
- Post-pick (option B) state shows the field with NO greeting + no "back to grid" affordance — owner
  to decide if greeting stays / add a back arrow.
- Then the deferred producer work stands: **Phase C** (Brain/Population depth, derive-from-craft) and
  **Phase D** (fire the real `runSimulate` from Simulate's `onSimulate` → sealed verdict replaces the
  projection + relocate the orphaned flywheel pin `pinPredictedSignature`).
- Eventual **cutover**: rip `AudiencePresence`, wire the full flow, retire the flag.

**Gates at commit**: tsc 0 · eslint 0 · touched-area sweep 182 pass / 9 skip (incl. matte 38/38) ·
`/ambient-v2` 200 · `/home` compiles. Files: 6 modified + 8 new (see the commit).

## ▶▶ RESUME HERE (fresh context, 2026-07-23 session 3) — Start polish DONE · Phase D-minimal SHIPPED

**Owner decisions this session (via AskUserQuestion):**
1. **Conditions strip** — KEEP between greeting + grid (no change; the locked loud-at-birth form).
2. **Post-pick (option B)** — picking a skill just drops into the **normal fresh-chat start** with the
   skill armed. No bespoke bare-field state, no back-to-grid chrome.
3. **Build order** — do **Phase D-minimal now** (not Phase C first). Recommendation accepted.

**What shipped (NOT committed — owner commits):**

1. **Start post-pick simplified** (`composer.tsx`): the `startEngaged` branch that rendered a bare
   `composerDock` was collapsed into the SAME fresh-home cluster (`composerDock` + `homeStarter` +
   `homeFirstRunDemo`) the legacy path renders — so a skill-pick lands in the normal fresh chat with
   the tool armed. Plus `setStartEngaged(false)` added to the thread-switch wipe (~line 793) so a
   NEW/empty thread returns to the Start grid instead of the post-pick home. Item 1 done.

2. **Phase D-minimal — the "Simulate →" door fires a REAL sealed sim** (`AmbientOverviewRail.tsx`,
   client-only, ZERO server change):
   - **Key architecture finding:** `/api/tools/simulate` + `runSimulate` are **Directional-only**
     (`resolveTier(audience) !== "Directional"` → 400 / throw). `SOCIALS_CALIBRATION.baselineRef` is
     set, so the default `GENERAL_AUDIENCE` (mode `socials`) resolves **Validated**, as does every
     calibrated audience → BOTH are refused by that verb. The simulate verb is exclusively for
     `mode:"general"`/person DM-reaction SIMs. **It cannot simulate a content card against the socials
     audience the v2 rail uses.**
   - **The right producer = `POST /api/tools/react`** (the shipped type-to-room route): resolves the
     active audience SERVER-SIDE off the open thread (works for ANY audience), runs the same
     `runFlashTextMode` + `aggregateFlash` engine every card uses, returns real
     `{ fraction, scrollQuote, personas, population }`.
   - Wiring: `fireSim(id)` → `POST /api/tools/react` with `{ text: conceptText, framing }` (hook/idea
     framing from kind) → parse the honest `"N/10 stop"` fraction → `measured[id] = round(n/d·100)` →
     `buildOverviewData` seals that row above every queued one. While in flight the Overview shows the
     SEALED watcher (verdict withheld — the sealed-verdict law). A failed/unparseable run does NOT
     seal (row stays honestly queued). Quick-sim (row tap) fires immediately; a rank tap still opens
     the develop arming card whose Run also fires. Tests: `AmbientOverviewRail.test.tsx` (2 → **4**:
     fire→seal + honest-fail-no-seal).
3. **Flywheel pin RELOCATED (2026-07-23 follow-up — the pin piece of Phase D-full):** the once-
   orphaned `pinPredictedSignature` now fires on a real fired sim, via an **opt-in `pin` flag on
   `/api/tools/react`** (`ReactBodySchema.pin`, default OFF → type-to-room byte-unchanged, pins
   nothing). When `pin:true` (the v2 rail's DELIBERATE Overview sim sets it) the route calls
   `pinPredictedSignature(supabase, personas, { audienceId })` after aggregating — non-fatal (never
   blocks the reaction). `audienceId` = the persisted audience id, or **null** for a virtual constant
   (General / preset / template → `user_id:"__virtual__"`, no DB row) per the pin contract's "null for
   General". `analysis_id` is null (a concept-sim has no posted-video outcome yet). Chose the opt-in
   flag over a new route: no schema commitment, no thread pollution, react's default byte-unchanged.
   Tests: react route +3 (persisted→id · General→null · omitted→no-pin); flywheel + all runner tests
   still **111 pass**.

4. **Seal PERSISTENCE — reload-survival (2026-07-23, owner chose Option A = jsonb on `threads`):** a
   sealed measured % now survives reload. **NOT a new table** (Option B rejected as over-built before
   its consumers exist) and NOT thread-message persistence (that injects a `reaction-distribution`
   CARD into the chat — pollution).
   - **Migration** `supabase/migrations/20260723090753_thread_sim_seals.sql` — adds `sim_seals jsonb
     NOT NULL DEFAULT '{}'` to `public.threads` (RLS inherited). Types hand-added to
     `database.types.ts` threads Row/Insert/Update (mirrors a regen — no live-DB round-trip).
   - **Store shape:** `{ [trimmed concept text] : { pct, band, at } }` — CONTENT-addressed, because
     the descriptor's positional id (`hook-0`) is NOT stable across reload. Lib
     `src/lib/threads/sim-seals.ts` (`readSimSeals` validate-or-drop · `writeSimSeal` merge, NON-FATAL
     · `sealKey`). No runtime supabase import (client passes it) so it's boundary-clean.
   - **Write:** `/api/tools/react` opt-in `persist:true` (orthogonal to `pin`; v2 rail sends both) →
     `writeSimSeal(supabase, openThread, text, { pct, band, at })` after aggregate; unparseable
     fraction writes nothing. **Read:** `GET /api/threads/open` returns `simSeals` → `composer.tsx`
     rehydrates into `persistedSimSeals` (reset on thread switch) → passes to `AmbientOverviewRail`
     `persistedSeals` → merged into `measured` (in-session fire wins; else persisted by concept text).
   - **Safe pre-migration:** until the column exists, `readSimSeals` → `{}` and `writeSimSeal` gets a
     "column does not exist" error → swallowed non-fatal → the reaction still 200s; persistence just
     no-ops (in-session seal still works). **⚠️ the migration must be APPLIED for persistence to
     activate** — not auto-applied here (prod schema change = owner's call; apply via your migration
     flow / supabase).
   - Tests: sim-seals lib (8: parse/drop/merge/non-fatal) · react route +2 (persist writes merged ·
     omit writes nothing) · rail +1 (persisted re-seal on mount, no fire).

**Gates:** tsc 0 · eslint 0 (all touched files CLEAN; 3 pre-existing composer warnings) · matte 38/38 ·
affected sweep **95 pass / 11 files** (sim-seals 8 · open-thread 18 · react route 14 · rail 5 ·
adapters+StartHome+month-plan · predicted-pin 3) · `/ambient-v2` 200 · `/home` 307 ·
`/api/threads/open` 401 · `/api/tools/react` 401 (all compile). Files: 9 code/test + migration + this
doc (all NOT committed — owner commits).

**▶ NEXT:**
- **Apply the migration** (`20260723090753_thread_sim_seals.sql`) so persistence activates.
- **Phase C** — Brain/Population depth producers (still needs a rich SimSnapshot; the jsonb seal store
  is verdict-only. Grow to a `sim_snapshots` table — Option B — when the deep screens need the
  personas/population/brain payload; surfaces still unmounted).
- **Cutover** — rip `AudiencePresence`, wire the full flow, retire the flag.

## ENV / gotchas
- Dev :3007 (NOT :3011 = stale skill-cards-prod). Screenshots hang → verify via DOM.
- `grep -rn` single-quoted. Tests: `node ./node_modules/vitest/vitest.mjs run <file>`.
- Gates: tsc 0 · eslint 0 · matte `reading/__tests__/reskin-matte.test.ts` 38/38 · `/ambient-v2` 200.
- Reload-only hazard: a new card/stream prop must ride BOTH the route content event AND the stream
  `toBlocks`. Commit only when the owner asks.
