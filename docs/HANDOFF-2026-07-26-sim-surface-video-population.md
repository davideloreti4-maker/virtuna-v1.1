# Handoff — the Sim surface: wiring the tested video into the room (2026-07-26)

**Status: ✅ SHIPPED on `design/ambient-audience-v2` (4 commits). NOT merged to `main`.**
Gates: suite **4495 / 0 with the flag ON *and* unset** · `tsc` 0 · `eslint` unchanged from baseline ·
live browser pass on a REAL run.

| Commit | What |
|---|---|
| `b2c68af6` | The video Population producer — the fold reception panel was never unavailable |
| `a46f7930` | Seal the fold reception at Test time so the video drill's Population is real |
| `abfbab60` | The Test card's Simulate door opens the room, not `/analyze` |
| `055d5bce` | A tie is not a ranking — three ranked reads were crowning sort order |

---

## 0. Scope correction — read this before believing the last handoff

The previous handoff ranked "**build the Sim surface**" as the next task, and listed
`AmbientSimulate` / `AmbientDetail` / `AmbientOverview` as "built but rendering only on the
`/ambient-v2` fixture route". **Both claims were wrong**, and the owner caught it:

- `AmbientOverviewRail` has mounted `AmbientOverview`, `AmbientSimulate` (develop) and
  `AmbientDetail` on real live data for several sessions. Only `SimulateIntake` (`mode="cold"`) is
  genuinely unmounted anywhere in the app.
- The Sim surface therefore did not need building. It needed the **video path wired into it**.

The `SimSnapshot` blocker was also dead: Phase-C depth landed inline in `threads.sim_seals`.

**The real gap was two things**, and this session closed both:

1. `AmbientOverviewRail` drilled a tested video with `population: null`, commented *"the honest
   audience-unavailable state"*. It was never unavailable.
2. The Test card's `Simulate with your audience →` was still `href="/analyze/[id]"` — the last thing
   tying the Test path to the old board.

## 1. The reception data was already there, already paid for, already audience-specific

`api/analyze/route.ts:803-838` resolves `thread.active_audience_id` and hands it to the pack, so the
fold's 10 archetypes are **repainted with the creator's real audience**. Every Max row therefore
already stores an audience-specific reception panel. Verified on prod (`vSoTpo5AixUS`):

- 10 archetypes with real `scroll_past_second` (2.8s / 8.5s / 12s) and `watch_through_pct` (15→100)
- `weighted_curve` `[.78 .74 .70 .56 .48]`
- intents with honest percentile *labels* (completion 68.8 "moderate intent", loop 21 "very low")

**Field-population check across 45 days: `personas` ⇔ `persona_behavioral_aggregate` ⇔ `heatmap` are
perfectly co-present — one Wave-3 gate, 10-or-0.** That is the same gate `hasBrainData` already uses
for the Test seal, so **Sim availability == Test-seal availability**. No new empty-card class (the
Plan-02-R9 trap). Degraded runs (overall_score 0/9/15/16) carry none of it and seal nothing.

## 2. The one new piece

`src/lib/surfaces/ambient-v2-video-population.ts` — fold reception → `PopulationAggregate`. That is
all, because **every `modeled*` depth section takes nothing but an aggregate**, so terrain, tri-state,
heroRead, audienceFit and the trust strip fill from the shipped text adapter unchanged.

### 🔑 The honesty rules, each of which cost a decision

1. **N is the real cast (10), and the trust strip says so.** Expanding to 100/1,000 individuals (each
   bucket cloning its persona's verdict) would dress 10 distinct outcomes as N and make
   `RoomTrustData.simulated` overstate the run. Sections that read thin at N=10 are honestly thin.
2. **Room composition rides on segment `share`** (the real `heatmap.weights`), never on the counts.
3. **`reasons` is EMPTY by construction.** A video fold emits `reasoning: "fold-derived: <archetype>"`
   and `segment_reasons: {}` — verified on prod. **There are no per-viewer objection quotes on a video
   run**, unlike the text sim's real `scrollQuote`. The video's "why" is positional and already ships
   on the Brain tab (the measured-dip read). Don't re-litigate this by coding a reason from an
   archetype name.
4. **"Stopped" = survived the hook**, read off the engine's OWN first-segment `t_end` (3.0s on the
   reference row), matching what the verdict measures. A late bail is a **SKIM** — the tri-state's
   middle band, which video has and a binary text verdict cannot.
5. The Population's `stopPct` and the verdict chip (`weighted_hook_score`) are **different measures**
   — a headcount that survived the hook vs a weighted attention level at it. They legitimately
   differ; each is labelled with its own denominator and neither is derived from the other.

⚠️ Both slot-type spellings occur on real rows — `PersonaSlotTypeSchema` emits `niche_deep`,
`HeatmapPayload.personas[].slot_type` emits `niche`. Both map to the one `niche` weight.

## 3. Persistence — no new field, no migration

The aggregate rides on the **existing** `SimSeal.population`, so the existing `isPopulationLike`
guard applies and the rail reads it through the existing path. Only `SimSealVideo.skimmedPct` is new
(optional). Old seals and Wave-3-degraded rows read back as `population: null` ⇒ exactly today's
brain-only drill. Nothing to backfill.

## 4. The door

`SimulateVideoContext` (mirrors the shipped `OpenRoomContext`) carries the tap out of a card that
`MessageBlocks` renders with no props. The rail/sheet take `focusVideo: { id, nonce }`.

- **The nonce is load-bearing** — a bare id compares equal on a repeat tap, so backing out of the
  drill and tapping again would silently do nothing.
- Its effect is declared **after** the thread-switch reset so a request arriving in the same commit
  wins instead of being wiped.
- It **skips the reveal gate** deliberately: tapping the CTA IS the deliberate ask.
- Three states, all tested: off-composer → the `/analyze` link untouched; in-composer with a seal →
  a button, no navigation; in-composer with **no** seal → the room returns `false` and the card
  follows its link rather than leaving an inert button.

It **does not spend** — the run already measured this. Ships **unflagged** (the Test/Sim split is
already live); only the seal write stays behind `AMBIENT_V2_ENABLED`.

## 5. 🔑 What the browser caught that 4,495 green tests did not

**LOOKING IS NOT MEASURING.** Every ranked read in these adapters sorted, took `[0]`, and printed its
label. On a large text projection segments rarely tie. A video fold's districts land on 0%/100%, so
**the tie-break becomes the finding**:

- `modeledAmplification` rendered ten carriers at ×1.0 and announced *"Reach rides on **Tough Crowd**
  resharing"* — the district that bailed at 2.8s — because `RESHARE_PRIOR` is keyed on the TEXT
  vocabulary and every engine archetype defaults to 1.0. → **omit the section**.
- `modeledAudienceFit` crowned one of eight tied districts, and closed with a hardcoded *"a narrower,
  higher-intent cut"* while reporting that most of the room over-indexed.
- `heroRead` had the same crown, plus a `displayName` equality check that missed an all-equal room.
- `modeledSwing` picked its fence by `|stopPct − 50|`, but **|0−50| ties |100−50|**, so it named the
  LOSS district as *"not gone, just unconvinced"* — contradicting the terrain painting it coral. Now
  excludes the loss (matching `modeledDecisionStates`) and omits itself with no fence-sitters.
- `Receipts` rendered its kicker over zero reasons — the orphaned-label defect again.

A shared `peerLabel` helper now backs all three ranked reads so a fourth cannot reintroduce it.
**All of these were latent in the TEXT path too.**

## 6. How this was verified live (reusable)

All three reference analyses belong to `e2e-test@virtuna.local`, so no fabrication is needed:

```
# dev server, flag ON
rm -rf .next && NODE_OPTIONS="--max-old-space-size=2048" NEXT_PUBLIC_AMBIENT_V2=true PORT=3007 \
  nohup node ./node_modules/next/dist/bin/next dev -p 3007 > /tmp/dev-3007.log 2>&1 &
```

Sign in, verify the flag **behaviourally** (`document.querySelector('form[data-layout]')` → `"thread"`),
then drive the real route from an in-page fetch (same-origin ⇒ CSRF passes):

```js
await fetch('/api/tools/test/card', { method:'POST',
  headers:{'Content-Type':'application/json'}, body: JSON.stringify({ analysisId:'-pCnMyJKF6zz' }) })
```

`test/card` does **no engine work** — it is a cheap adapter over a persisted row, so this is free and
repeatable. Then confirm the seal in SQL and the render in the DOM.

Rows owned by the e2e user: `vSoTpo5AixUS` (29s, 10 personas) · `-pCnMyJKF6zz` · `o4_e2zalqzc0`.

## 7. ▶▶ NEXT

1. **Real amplification from `share_intent`.** The fold stores per-persona `share_intent` /
   `save_intent` / `comment_intent` / `rewatch_intent` and the aggregate carries honest percentile
   labels. That is the true "who spreads it" producer, and the richest video-only slice still not
   surfaced anywhere. It needs a real slot — `PopulationFrameData` has no intents section.
2. **`SimulateIntake` / `mode="cold"`** — still mounted nowhere.
3. **Does a simulation need to persist as a thread card?** Owner call this session: **no, the rail
   only, for now.** Worth revisiting — the room is ephemeral, so unlike every other skill a Sim
   leaves no artifact to save, compare or reload.
4. `ad` + `compare` runners (the two inert Start tiles).

## 8. ⚠️ Owner-gated — the flag flip is blocked on something bigger

**Vercel IS configured** (project `virtuna-v1.1` / `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url`, prod domain
`virtuna-v11.vercel.app`), so `docs/PRICING.md` is right and "not configured at all" was wrong —
**but the live production deployment is commit `c3396c89`, the PR #332 merge (2026-07-18 work,
manually redeployed 07-19), and there has been no production deployment since.** `main` is at
`46f5887b`. Roughly PRs #333→#382 — billing, thread unification, the Test seal, the mobile audience
room — have never reached users. The project also reports `"live": false`.

Two consequences:
- `NEXT_PUBLIC_*` is **inlined at build time**, so setting the var alone does nothing — a rebuild is
  required either way.
- **Fixing the broken main→production deploy is a prerequisite to the flip, and is more urgent than
  the flip.**

Also still open: **rotate the Apify key** (plaintext in the 2026-07-25 transcript; `.env.local` only,
nothing depends on that value) and the Whop / Supabase-SMTP items in `docs/PRICING.md`.
