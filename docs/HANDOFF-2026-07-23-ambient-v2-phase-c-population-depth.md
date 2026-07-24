# Ambient Audience v2 — Phase C (Population depth) ✅ MERGED (2026-07-23)

**Merged to main: PR #375, merge `d96b49b6`** (code commit `364fbb98`). Branch
`design/ambient-audience-v2` kept for continued work · worktree `~/virtuna-ambient-audience-v2` · dev
**:3007** (NOT :3011 = stale skill-cards-prod). Prior:
`docs/HANDOFF-2026-07-23-ambient-v2-phase-d-SHIPPED.md` (Phase D) · full provenance audit
`docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md`.

## What this session shipped — the honest Population-depth slice of Phase C

The Overview→Detail **drill now opens the REAL Population depth** for a sealed calibrated sim, and it
**survives reload**. Brain depth is deliberately deferred (it's a VIDEO producer — see below). All
behind `NEXT_PUBLIC_AMBIENT_V2` (legacy default byte-unchanged).

### The three decisions that shaped it
1. **NO `sim_snapshots` table.** The existing `threads.sim_seals` is `jsonb` (schema-less); the depth
   payload (`PopulationAggregate` + 10 personas ≈ a few KB) rides inline, content-addressed by concept
   text exactly like the verdict. A dedicated table was infra the consumers don't need yet. *(This
   deviates from the earlier handoff's "Option B table" suggestion — cheaper, reversible, same result.
   No migration this session.)*
2. **Population depth is REAL from a TEXT sim.** `POST /api/tools/react` already returns a rich
   `population: PopulationAggregate` (`{ total, stop, scroll, stopPct, segments[], reasons[] }`) — the
   Stage-2 O(N) projection over ~1,000 individuals. It maps onto `PopulationFrameData` (tri-state,
   terrain, voices, room) with the three fabrication-risk fields (`audienceFit`/`amplification`/
   `swing`) OPTIONAL → honestly omitted. **Zero new producers.**
3. **Brain depth is a VIDEO producer, deferred.** Brain's required figures (`driver:
   attention-scrubber` + `signals`) come from `runFold` + `GeminiVideoSignals` craft dims. The rail
   fires TEXT (`runFlashTextMode`). Filling Brain from a text sim = fabricate (violates the spine) or
   fire a fold sim (net-new). Owner call: **Population-only Detail** — the Brain tab shows an honest
   "brain reads a video's frames" state and the view opens on the audience tab. Never a faked figure.

### The honest reality (by design)
Depth lights up **only for a CALIBRATED audience.** `population` is null for General/preset/legacy
(the signature lacks `topic_vocab` + scored `reaction` axes — `signatureHasPopulationAxes` gate,
route.ts:160). So on General the row seals verdict-only and the drill falls through to develop. On
brand: the population read is the calibrated-audience payoff.

## Files (10; 2 new)
- **`src/lib/surfaces/ambient-v2-population.ts`** (NEW) — pure `buildPopulationFrameData`
  (`PopulationAggregate` → `PopulationFrameData`) + `buildDomainTemplate`. Binary tri-state (skim band
  honestly 0), deterministic golden-angle terrain layout of the REAL districts (`n`/`lit` are real
  totals/stop-rates; cx/cy cosmetic), coded reasons = real `agg.reasons` label+count illustrated by a
  real persona quote (exactly `CodedReason`'s "the reason speaks for N; the persona is its exemplar
  voice" contract), real trust strip (confidence modeled+labeled). `+test` (7).
- **`src/lib/threads/sim-seals.ts`** — `SimSeal` gains optional `population`/`personas`/`scrollQuote`;
  `readSimSeals` passes well-formed depth through, drops a malformed blob but keeps the verdict
  (`isPopulationLike` guard). `+test` (10).
- **`src/app/api/tools/react/route.ts`** — `persist:true` seal write RELOCATED after the population
  compute; now writes the depth payload too. (Existing route tests 14/14 unchanged.)
- **`src/components/audience-lens/v2/domain-template.ts`** — `DomainTemplate.brain` now OPTIONAL.
- **`src/components/audience-lens/v2/AmbientDetail.tsx`** — `brainNote` prop + `brainAvailable`
  (`!!brain && !brainNote`); brain tab dimmed/locked + honest-unavailable panel; opens on audience tab
  when brain absent; cross-tab jump guarded. (Only renderer besides the mount is `/ambient-v2`; the
  fixtures still supply `brain` → unchanged there.)
- **`src/components/audience-lens/v2/AmbientOverviewRail.tsx`** — `persistedSeals` widened to
  `SimSealMap`; `sessionSeals: Record<id, RailSnapshot>` captures the full fired-sim result;
  `snapshotFor(id)` (session-wins → persisted by concept text); `openStimulus` opens `AmbientDetail`
  when a snapshot has a population, else develop; `detailId` view state; drill resets on descriptor
  change. `+test` (6: added the depth-drill lock).
- **`src/components/app/home/composer.tsx`** — `persistedSimSeals` widened to `SimSealMap`; passes the
  server-validated map straight through (no re-narrowing to pct).

## Reload path (end-to-end, calibrated audience)
fire sim → `react` `persist:true` writes `population` into `sim_seals` jsonb → `/api/threads/open`
`readSimSeals` returns it → `composer` `persistedSimSeals` → `AmbientOverviewRail` `persistedSeals` →
`snapshotFor` → `buildDomainTemplate` → `AmbientDetail` renders the depth **without a re-run**.

## Gates (all green, live-verified on :3007)
tsc **0** · eslint **0** (3 pre-existing composer warnings) · matte
`reading/__tests__/reskin-matte.test.ts` **38/38** · population adapter **7** · sim-seals **10** · rail
**6** · react route **14** · open-thread **18** · `/ambient-v2` **200** · `/home` **307** ·
`/api/tools/react` **401** · `/api/threads/open` **401** (all compile, no errors in the dev log).

## ▶ NEXT (priority order)
1. **Brain depth (video producer)** — fire a `runFold` sim from the rail for a `draft`/video stimulus →
   map fold per-segment attention + `GeminiVideoSignals` craft dims → `BrainFrameData`
   (attention-scrubber, signals, whyThisSecond — "mostly plumbing" per the audit). Persist the video
   snapshot in the same jsonb seal (extend `SimSeal` with a `video` payload, or a `kind` tag). Then
   `AmbientDetail` shows a real Brain tab for video sims.
2. **The net-new modeled producers** (only when their surfaces demand them): behavioral-lens runs
   (buy/share/follow) → `amplification`/`buyIntent`; modeled neuro decomposition (derive-from-craft) →
   `networkBars`/`kpiHeatmap`; `audienceFit` per-creator last-N baseline. Tag **modeled**.
3. **Cutover** — rip `AudiencePresence`, wire the full Start→Simulate→Overview→Detail flow as the whole
   rail, retire `NEXT_PUBLIC_AMBIENT_V2`.

## ENV / gotchas
- Dev :3007. Launch (Python `os.setsid`-detach; `rm -rf .next` after branch switch; a STALE server may
  already hold 3007 — `kill` it first): `NODE_OPTIONS='--max-old-space-size=2048'
  NEXT_PUBLIC_AMBIENT_V2=true node ./node_modules/next/dist/bin/next dev -p 3007`.
- Screenshots HANG → DOM-verify / trust units. Tests: `node ./node_modules/vitest/vitest.mjs run <f>`.
- Preview: `NEXT_PUBLIC_AMBIENT_V2=true`, ≥xl window, a **calibrated** audience active; fire a sealed
  sim from a ranked row, then tap the sealed row → the Population depth drill.
- Supabase MCP project id for `virtuna-v1.1` = `qyxvxleheckijapurisj`.
