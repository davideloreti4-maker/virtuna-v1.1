# Handoff — Audience Sim v2: card fan-out DONE + browser-verified · 2026-07-17

**Worktree:** `~/virtuna-audience-sim-v2` · **Branch:** `feat/audience-sim-v2` (committed + pushed to origin)
**SSOT design:** `docs/DESIGN-2026-07-15-audience-simulation-v2.md` (§8.3 = Stage 2 shipped, §7 = feedback-loop deferral)
**Prior handoff:** `docs/HANDOFF-2026-07-16-audience-sim-v2-stage2.md` (Stage 2 core)
**Memory:** `audience-simulation-v2-design.md` + `MEMORY.md` index (both updated)

---

## 0 · TL;DR — where a fresh session starts

The **population projection** (the honest "~1,000 sampled individuals" reaction, per-segment split,
"a projection" framing) is now wired onto **all 4 flat card runners** and browser-verified through the
real component chain. Stage 2 is functionally complete.

- **Prior session:** hooks card (`226e5d9c`).
- **This session:** ideas + script + remix cards, one commit **`79108317`** (pushed). Then **live
  browser verification** of all three through the real webpack bundle.

**⚠️ The ONE load-bearing thing NOT yet confirmed → START HERE (see §3):** does the **production
calibration bake actually write the v2 axes** (`signature.audience.topic_vocab` + per-persona
`reaction`) onto a real audience? If it does not, `signatureHasPopulationAxes()` returns false for
every real user, the gate never opens, and the ENTIRE population feature (Stage 2 + this fan-out) is
**dark in production** — green tests + browser-verified consumer, zero real users ever see it. This is
the exact `[[green-test-is-the-accomplice]]` / "dead audience shipped as HIGH" failure mode. Verify it
before anything else.

---

## 1 · What shipped this session — commit `79108317`

Extended the population aggregate onto the ideas/script/remix cards, mirroring the hooks slice exactly.
16 files. Each card got the same 5-layer wiring:

| Layer | idea | script | remix |
|---|---|---|---|
| **Schema** (`blocks.ts`) | `population?` field on `IdeaCardBlockSchema` | on `ScriptCardBlockSchema` | on `RemixCardBlockSchema` |
| **Producer** (runner) | `ideas-runner.ts` | `script-runner.ts` | `remix-runner.ts` |
| **Transport route** | `ideas/route.ts` | `script/route.ts` | `remix/run/route.ts` |
| **Transport stream** | `use-ideas-stream.ts` | `use-script-stream.ts` | `use-remix-stream.ts` |
| **Consumer** | `idea-card-block.tsx` | `script-card-block.tsx` | `remix-card-block.tsx` |

- **Producer pattern (identical to hooks):** resolve the gate once (`populationSignature =
  audience?.signature`; `wantPopulation = signatureHasPopulationAxes(...)`; `populationVocab =
  ...topic_vocab`). Fire `characterizeContent(text, vocab)` per candidate **concurrently** with the
  SIM (no added latency), then `reactPopulation(signature, vector)` guarded in try/catch → attach
  optional `population` to the block. Any failure → `undefined` (card omits the field; SIM
  band/fraction stays load-bearing).
- **`blocks.ts` move:** `PopulationAggregateSchema` + `parsePopulationProp` were relocated **above**
  the card schemas (all four now reference it). tsc caught the original ordering bug; fixed.
- **Consumer is shared + unchanged:** each card just passes `population={population}` into the SAME
  `ProofUnit` → `LensTrigger` → `AudienceLens` → `PopulationRegion` → `PopulationSwarm` chain the hooks
  card already used.

### The "a script is not a hook" trap — handled
Characterize the SAME text each SIM reacts to, so the projection and the on-card fraction agree:
**ideas → `seedHook`**, **remix → adapted `hook`**, **script → `openingBeatSeed`** (script's audience
reaction is opener-only in `"hook"` mode, Pitfall 5 — a full multi-beat script is NEVER fed to the hook
characterizer).

---

## 2 · Verification done this session

- **tsc clean** on all 16 touched files (only pre-existing `@gltf-transform` brain-test errors remain,
  unrelated).
- **6 new runner tests** (2 per card): "attaches real per-segment population with v2 axes" +
  "omits + makes NO characterize call without axes". Each **failing-first proven** — I neutered every
  runner's attach line and confirmed the positive test fails (`expected undefined to be defined`) before
  restoring.
- **165+ regression green** across runners / blocks schema / cards / population math / swarm / react
  route / matte guard. Run the real binary: `node ./node_modules/vitest/vitest.mjs run <paths>`
  (`npm test` prints fake results — [[vitest-rtk-shim]]).
- **LIVE BROWSER (real webpack bundle):** a throwaway route rendered the real
  idea/script/remix renderers, each with a population whose numbers (412/588) **cannot** come from its
  `7/10` fraction. Opening each card's proof box → AudienceLens → **Population · 1,000** rendered, for
  all three: **412 stopped / 588 scrolled · "1,000 sampled from your audience · a projection" ·
  Dopamine Scrollers 28% / Frame-by-frame editors 61%** — divergent numbers = the real projection flowed
  the whole chain. **0 console errors** on a clean load. (Scaffolding torn down; tree clean.)

**What the browser did NOT prove:** the fully-authenticated PRODUCER path (real DB audience → composer →
route/stream). It verified the CONSUMER chain with a hand-fed aggregate. See §3.

---

## 3 · What's next — recommended order

### 🔴 (1) CONFIRM THE PRODUCER GATE EVER OPENS IN PROD (do this first — the real risk)
The population feature only fires when the active audience's `signature` carries BOTH:
`signature.audience.topic_vocab` (non-empty) **AND** ≥1 `personas[].reaction` (scored axes). Verify the
**production calibration bake writes these fields**, not just the test synth in
`scripts/verify-population.ts`.
- **Read** the calibration/bake code that produces `AudienceSignature` (search for where
  `topic_vocab` and per-persona `reaction` get written — likely the audience calibration route / the
  signature generator). Confirm a real bake populates them.
- **Query a real baked audience row** via the Supabase MCP (`signature` JSONB column on the audiences
  table) and check `signature.audience.topic_vocab` + `signature.audience.personas[].reaction` are
  present + populated. If they're empty/absent on real rows → the feature is DARK; the fix is in the
  bake, not the cards.
- If the bake does NOT emit v2 axes yet, that is the true next build task (and explains why nothing
  fires in prod).

### 🟡 (2) FULLY-AUTHENTICATED e2e (owner-gated)
Once (1) confirms real audiences carry the axes: owner logs in with a real calibrated audience → open a
thread → generate ideas/script/remix → open a card's Sheet → confirm the real projection renders. Needs
owner login + DB state; best as an owner UAT or a seeded-DB automated run.

### 🟢 (3) PR + merge the branch (owner)
`feat/audience-sim-v2` carries Stage 2 + the full card fan-out, all committed/pushed, unmerged. Owner to
open the PR against `main` and merge.

### ⚪ Deferred (do NOT start without owner OK)
- **Feedback loop (P6)** — deferred by owner (design §7). The realistic form is offline+global
  (correlate predicted-stop vs the video's over/under-performance), not per-user online.
- **Scorer absolute-level calibration** — the conservative absolute stop-level is a KNOWN, accepted,
  honestly-framed limit; LOCKED, not to be hand-tuned (over-fits). The offline loop owns it.

---

## 4 · Gotchas to carry forward (this worktree)

- **Dev server:** `next dev --turbopack` FAILS here (Turbopack rejects the out-of-root `node_modules`
  symlink → `~/virtuna-explore-b/node_modules`). Use
  `NODE_OPTIONS='--max-old-space-size=2048' ./node_modules/.bin/next dev --webpack -p <port>` AND
  temporarily neutralize `DevLocator` (comment its import + `<DevLocator />` in `src/app/layout.tsx` —
  it statically imports `react-scan`, which breaks under webpack; **revert after**). `rm -rf .next
  node_modules/.cache` first if turbopack cache is stale.
- **Preview/throwaway route for card browser-checks:** put it OUTSIDE `(app)` (that layout hard-redirects
  to `/login`) and NOT in a `_`-prefixed folder (Next private → 404). It MUST wrap cards in a
  `QueryClientProvider` — `SaveAffordance` → `useSaveItem` → `useQueryClient` throws otherwise. Cards
  need no other provider (`usePlatform` defaults to tiktok; `useOpenRoomForCard` returns null → the
  off-composer LensTrigger path that USES population). To reach the projection: click the proof box →
  click the **"Population · 1,000"** scale toggle → read `[data-testid="population-swarm"]`
  (`population-stop-count` / `population-scroll-count` / `population-breakdown`). Screenshots hang
  (ambient animation) — DOM-read via `browser_evaluate`.
- **Tests:** real binary only — `node ./node_modules/vitest/vitest.mjs run <paths>`.
- **Auto-push:** `core.hooksPath = .githooks` — every `git commit` auto-pushes the branch to origin.
- **`.playwright-mcp/` is gitignored** (throwaway Playwright output; safe to delete).
- **Locale note (not a bug):** the "a projection" label reads "1.000" (system-locale thousands
  separator via `toLocaleString()`) — same call the shipped `PopulationView` uses; consistent.

---

## 4b · Session 2 (2026-07-17) — fully-authed live e2e + two fixes it surfaced

Ran the fully-authenticated e2e (owner gave `e2e-test@virtuna.local` creds). Seeded the test user's
"Zach King" audience with a real v2 bake, logged in via the real `/login`, generated ideas. **The
producer path works end-to-end**: real DB audience (v2 axes) → `/api/tools/ideas` → runner →
`characterizeContent` + `reactPopulation` → `block.props.population` (total 1000, differentiated
35/58/59/43% across cards, 10 segments) → SSE `content` event → **persisted** to
`messages.body->blocks[].props.population`. Verified at the SSE layer AND in the DB. The
Population·1,000 view renders in the authed room. `/api/tools/react` returns a real projection live.

The e2e surfaced two real gaps — **both now fixed + live-verified**:

### AUD-SYNC-01 (🔴 was a blocker) — a fresh thread scored against General despite the pill
`createOpenThreadLazy` inserts a new open thread with `active_audience_id = NULL`. The composer pill
displays the user's LAST-USED audience (seeded from `user_settings.last_audience_id`), but the runner
resolved the audience from `thread.active_audience_id` via `resolveThreadAudience`, which hard-defaulted
NULL → **General**. So a user with a calibrated v2 audience who generated in a fresh thread got
General-scored content + ZERO population while the UI showed their calibrated audience. (This gated ALL
per-audience scoring on new threads, not just population — pre-existing infra, not a sim-v2 regression.)
**Fix:** `resolveThreadAudience(supabase, thread, userId?)` now falls back to `resolveUserAudience`
(last-used) when the pin is NULL — keeping the runner in sync with the pill. All 7 route call sites pass
`user.id`. An explicit General pick writes both the pin and last_audience_id to null, so General still
resolves to General. `src/lib/audience/resolve-thread-audience.ts` + 7 routes + 3 new tests.
**Live-verified:** thread pin NULL → ideas now attach real population (all 4 cards, 1000-total).

### AUD-SYNC-02 (🟡 honesty) — the room drill showed the "MODELED FROM YOUR 10" fallback
Drilling into a generated card from the room's ranked list showed the honest-lean fallback (e.g. 90% =
densified 9/10 SIM), which can DISAGREE with the card's own real projection (35%). Cause:
`cardDescriptor` (composer.tsx) built the ambient focus WITHOUT the card's `population`, so
`focus.population` was undefined and `AmbientRoom` fell back. The descriptor type + `toFocus` already
threaded `population` — the field just wasn't populated. **Fix:** one line — `cardDescriptor` now sets
`population: p.population`. **Live-verified:** the room's Population·1,000 for a card now reads
"1,000 SAMPLED FROM YOUR AUDIENCE · A PROJECTION" with the card's real 352/648 (35%) + per-segment split,
no longer "MODELED FROM YOUR 10".

### Still owner-operational — existing audiences are DARK until re-baked (not a code fix)
Every existing prod audience was baked with pre-v2 code (no `topic_vocab`/`reaction`) → `signatureHas
PopulationAxes` is false → population dark for them. Merging the branch is necessary but NOT sufficient.
A true offline backfill isn't possible (the original scrape/evidence isn't stored — the bake needs a
re-scrape). Rollout = **(a)** fix the prod drift cron (owner: add `SUPABASE_SERVICE_ROLE_KEY` to Vercel —
see the `vercel-crons-dead` note — which unblocks `audience-drift` to re-bake personal accounts on its
schedule) **or (b)** have each creator recalibrate their audience once. New calibrations light up
automatically. Flag this in the PR so the owner sequences it.

## 5 · Pointers

- **Reference impl (the pattern all 4 cards follow):** `src/lib/tools/runners/hooks-runner.ts`
  (population block, ~lines 630–740 + the BUILD attach).
- **Pure math (no LLM, O(N), deterministic):** `src/lib/audience/population.ts`
  (`reactPopulation`/`expandSignature`/`pStop`/`signatureHasPopulationAxes`).
- **The one LLM call:** `src/lib/audience/characterize-content.ts` (server-only).
- **Consumer chain:** `proof-unit.tsx` → `LensTrigger.tsx` → `AudienceLens.tsx` →
  `AudienceLensContent.tsx` (`PopulationRegion`) → `PopulationSwarm.tsx`.
- **This session's commit:** `git show 79108317`. Prior hooks slice: `git show 226e5d9c`.
