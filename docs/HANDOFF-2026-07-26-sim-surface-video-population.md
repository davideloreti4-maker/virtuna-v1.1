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

1. ~~**Real amplification from `share_intent`.**~~ ✅ **SHIPPED** — but NOT as amplification. Measured
   across every 10-persona prod row: `sharer` tops `share_intent` on 9 of the 9 rows where a Sharer is
   cast, `lurker` sits at 0–2 share on all of them, `tough_crowd` rewatch is always 0. **The carrier
   ranking is decided by the persona registry, not by the video**, so a "who spreads it" list would
   print the same winner forever — the tie defect wearing a foregone conclusion. What DOES move per
   video is the room-level profile (save alone spans 6 → 48), so the section reports that and makes no
   reach claim. Landed as `PopulationFrameData.actionIntent` + `SimSealVideo.intents` (jsonb, no
   migration). See §10.
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

---

## 9. 🚀 The reconnect runbook (owner confirmed: git is DISCONNECTED from Vercel)

Cause found and confirmed by the owner — the GitHub integration is disconnected, which is why zero
deployments were even *triggered* since 07-19. `main` is now `e534cd08` (fast-forwarded 2026-07-26 s6).

**⚠️ The disconnect was DELIBERATE, not an accident** (owner, 2026-07-26): with **113 remote
branches**, every push triggered a full Next.js preview build, and the spend was the reason. Right
instinct, wrong lever — it also killed production deploys. **So do NOT simply reconnect: land the
build gate first** (§9-0), or reconnecting re-creates the exact problem that caused the disconnect and
it will be pulled again.

### 9-0. ✅ DONE — the build gate that makes reconnecting safe (`e534cd08`)

`vercel.json` now carries:

```json
"ignoreCommand": "[ \"$VERCEL_ENV\" = \"production\" ] && exit 1 || exit 0"
```

**Exit 1 = BUILD, exit 0 = SKIP** — backwards from intuition, and getting it inverted means silently
never deploying again. Production builds; every preview from all 113 branches is skipped before it
consumes build minutes. Branch-count independent, so branch #114 is covered too.

Rejected on purpose: `git.deploymentEnabled` maps branch names to booleans and **unspecified branches
default to `true`**, so there is no "only main" allowlist — it would mean a 113-entry denylist that
rots on every new branch. And `git.deploymentEnabled: false` disables auto-deploys *including main*,
which is this exact trap in softer clothing.

**Trade-off, stated:** no preview URLs. Every merge to `main` goes straight to production with no
staged check, so verification stays local (real browser + a real prod row + the suite both flag ways —
the §6 loop). To get a preview back for one branch, name it in the condition.

### 9a. Pre-flight: the schema is READY — verified, not assumed

Prod code is five weeks stale, so the first deploy jumps ~50 PRs at once. The failure mode that
matters is code arriving ahead of its migrations. **It won't**: every object the incoming code needs
is already live (the DB is AHEAD of the deployed code — the safe direction).

| Checked in prod | Result |
|---|---|
| `threads.sim_seals` · `threads.active_audience_id` | ✅ present (this session wrote a real seal through it) |
| `reading_events.credits` (the credits meter) | ✅ present |
| `user_subscriptions.trial_started_at` · `trial_used_at` | ✅ present |
| `teardown_collections` · `reading_events` | ✅ present |
| the 5 `match_*` RPCs (facets recreate) | ✅ all present |

⚠️ Two migration FILENAMES are misleading and cost a false alarm here: `..._credits_ledger.sql` adds
a **column to `reading_events`**, not a `credits_ledger` table, and `..._match_rpc_facets.sql`
**recreates existing RPCs** rather than adding a `match_*facet*` function. Probe for the real object,
not the filename.

### 9b. 🔑 Do the reconnect and the flag flip as TWO separate deploys

`NEXT_PUBLIC_AMBIENT_V2` is **inlined at build time**, so it only takes effect on a rebuild. That
makes the ordering a real decision, not a detail:

1. **Leave `NEXT_PUBLIC_AMBIENT_V2` UNSET.** Reconnect git (Vercel → Project Settings → Git →
   connect `davideloreti4-maker/virtuna-v1.1`, production branch `main`). This ships five weeks of
   merged work — billing, thread unification, the Test seal, the mobile room, the corpus covers —
   with v2 still off.
2. **Verify prod is healthy on that deploy** (below).
3. **Then** set `NEXT_PUBLIC_AMBIENT_V2=true` and redeploy — one isolated change with a clean
   rollback.

Doing both at once means a regression has two suspects and the flag's entire purpose (a cheap
rollback lever) is spent on the same deploy that introduced the risk.

### 9c. Keep these OFF / expect these to be absent

- `BILLING_ENFORCE_QUOTA` — stays **false/unset**. Enforcement is verified working but deliberately
  inert until the owner's Whop step (`docs/PRICING.md`).
- Whop plan ids — absent **by design**: a missing plan id is the checkout 503, and a missing *trial*
  id degrades to full price (never undercharges).
- Supabase custom SMTP is still unset, so prod auth email is capped at ~2/hour. Fine for a smoke
  test, **not** for real signup traffic.

### 9d. Verify after the deploy

- **Verify the build gate in BOTH directions** — push a no-op commit to any branch and confirm the
  deployment reads *skipped*; push to `main` and confirm it *builds*. An inverted `ignoreCommand`
  fails silently (nothing ever deploys), which looks exactly like the bug being fixed here.
- Production serves `e534cd08` (Vercel → Deployments → the production alias).
- **Crons: read the SCHEDULED-fire logs, never a manual curl** — a manual curl 401s by design and
  has previously been misread as "crons dead" ([[vercel-crons-dead-401]]).
- Spot-check one paid path end-to-end; the credits meter writes `reading_events.credits`.

---

## 10. The action-intent section — "what they'd do with it" (2026-07-26, session 2)

The last video-only read still unsurfaced. Gate is the SAME Wave-3 gate as everything else here
(`personas` ⇔ `persona_behavioral_aggregate` co-present on 11 of 11 real rows, `loop_pct` and all five
percentile labels included) ⇒ no new empty-card class.

### 10a. 🔑 Three measurements that shaped it — none visible from the schema

1. **The carrier ranking is a registry constant, not a read.** `sharer` tops `share_intent` 9/9 when
   cast. So intents are NOT the honest producer for the removed "who spreads it" — they are the honest
   producer for a room PROFILE. No carriers shipped, and no reach claim: we hold intent, not
   distribution.
2. **The top-two verb gap is noise on 10 of 11 rows** (2.3 · 3.0 · 3.0 · 3.1 · 4.6 · 5.0 · 5.1 · 5.3 ·
   6.1 · 6.3 · 12.1). Share and comment are locked together, so a "what they'd do most" crown reports
   sort order. Hence `INTENT_GAP_MIN = 8` — above the noise cluster, below the one real separation.
   Verbs GROUP unless separated; the head and the floor are found by walking consecutive gaps. This is
   `peerLabel`'s lesson generalized from ties to gaps.
3. **The five numbers are not the same KIND of number.** `completion_pct` is a flat mean of
   watch-through (a real population rate); `share/save/comment/loop_pct` are top-3-enthusiast weighted
   (`aggregator.ts:43-50`) — a 0–100 index, NOT "38% would share". One bar set would misrepresent four
   of five, so watch-through rides the header as its own figure and the note states the weighting.

### 10b. Owner calls

- **Band labels dropped** (`percentileLabel` → "low intent" ×4 on the reference row). They are fixed
  thresholds, not a corpus rank — the code was explicitly renamed off "top X%" for that reason (WR-05).
  Four stacked "low intent" chips read as a verdict on the video. Bring them back when a corpus
  baseline exists.
- **Rewatch kept** — the completion-vs-rewatch contrast ("69% watched it through, 21 would come back")
  is the sharpest honest sentence the section makes.
- **One sentence, two facts, no third clause** — every section here that shipped a third clause ended
  up hardcoding it (`modeledAudienceFit`'s "a narrower, higher-intent cut").

### 10c. Shape

Producer `buildVideoPopulation` gains `aggregate` → returns `intents` (NUMBERS only). Sealed on
`SimSealVideo.intents` (jsonb, optional, no migration) with its own strict `isIntentsLike` guard — these
values get printed as a sentence, so a malformed blob would render "leads at NaN" rather than fail
visibly; a bad payload drops the section, never the Brain read. **The prose read is derived at RENDER**
(`buildActionIntent`), improving on the `skimmedPct` precedent: copy stays editable without a re-seal.
Rendered by `ActionIntent` in `AudienceDepth.tsx`, in the slot `amplification` omits itself from.

### 10d. Verified live (free, repeatable)

Both reference rows re-sealed through `POST /api/tools/test/card` (no engine work, no billing):

| row | rendered read |
|---|---|
| `vSoTpo5AixUS` | 69% · save 48 / comment 45 / share 38 / rewatch 21 · 8 of 10 would act · 2 would do nothing · 1 of those watched it through — *"Save, comment and share run together (38–48); rewatch is the floor at 21."* |
| `-pCnMyJKF6zz` | 58% · share 36 / comment 31 / rewatch 15 / save 8 · 7 of 10 would act · 3 would do nothing — *"Share and comment run together (31–36); rewatch and save are the floor (8–15)."* |

Two videos, two genuinely different reads — and the second correctly OMITS the "of those watched it
through" clause (its count is 0), the orphaned-label guard doing its job. Bar geometry measured, not
eyeballed: fills land at exactly 48/45/38/21% of track on a fixed 0–100 axis (a max-relative scale
would redraw the leader full-width every time and erase what the section measures), cream only, no
coral. Mobile sheet at 390px: zero horizontal overflow, header figure 90px clear of the kicker.

Gates: suite **4510 / 0 with the flag ON *and* unset** · `tsc` 0 · `eslint` clean on every touched file.

### 9e. 💸 The other cost lever, while you are in there

`vercel.json` schedules **10 crons**, one HOURLY (`calculate-trends`) and `scrape-trending` every 6
hours — and the scrapers reach paid APIs (Apify). Those fire on production regardless of builds, so on
a project reporting `"live": false` with no users they are spend buying nothing. Pause the ones that
are not earning until launch. (Not done here — it changes runtime behaviour and is the owner's call.)

---

## 11. 🔑 The Vercel environment — enumerated from the CODE, not from `.env.example`

⚠️ **`.env.example` is STALE and misleading**: it says "all 7 cron routes" (there are 10), its
`# --- AI / LLM (Qwen via DashScope) ---` section is EMPTY — omitting `DASHSCOPE_API_KEY`, the one key
that actually THROWS — and it still lists `DEEPSEEK_API_KEY`, which has **no runtime reader left**.
The list below is `grep process.env` over `src/`, with each var's real failure mode checked.
(`.env.example` is write-protected in this environment, so it could not be corrected here.)

### 11a. REQUIRED — prod is broken without these

| Var | Failure mode if missing |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | read with `!` — runtime crash on first DB call |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same (service client: crons, filmstrip signing, webhooks) |
| `DASHSCOPE_API_KEY` | **THROWS** `"Missing DASHSCOPE_API_KEY"` — every LLM call routes through it (Qwen-only pipeline). No engine, no product. |
| `NEXT_PUBLIC_APP_URL` | Apify webhook callbacks + referral links resolve to the wrong origin. Set to the real production origin. |

### 11b. SET THESE TOO — silent degradation, not a crash

| Var | What breaks quietly |
|---|---|
| `CRON_SECRET` | 🔴 **security.** `verifyCronAuth` compares against `` `Bearer ${process.env.CRON_SECRET}` ``, so with it UNSET the expected header is the literal string `"Bearer undefined"` — guessable. The 10 cron ROUTES stay publicly deployed even with every schedule removed. **Set it anyway.** |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | rate limiting is **FAIL-OPEN by design** — unset means no limiting at all, one warning logged. Fine while private; set both before public traffic. |
| `FILMSTRIP_EXTRACT_SECRET` | the extract step aborts early (logged), so analyses run with **no keyframes** — the Test card's filmstrip goes empty. |
| `APIFY_TOKEN` | all scraping/ingest fails (Discover, competitor refresh, corpus). |
| `APIFY_WEBHOOK_SECRET` | inbound Apify webhooks fail verification. |
| `NEXT_PUBLIC_SENTRY_DSN` | no error tracking on the first deploy in five weeks — exactly when you want it. |

### 11c. LEAVE UNSET / OFF (deliberate)

| Var | Why |
|---|---|
| `BILLING_ENFORCE_QUOTA` | defaults OFF (`=== "true"`). Enforcement is verified working but stays inert until the Whop step (`docs/PRICING.md`). |
| `NEXT_PUBLIC_AMBIENT_V2` | **unset for deploy #1.** Inlined at BUILD time ⇒ only takes effect on a rebuild, which is why it is deploy #2 (§9b). |
| `WHOP_*` (api key, webhook secret, 3 product ids, 3 trial plan ids) | absent BY DESIGN — a missing plan id is the checkout 503; a missing *trial* id degrades to full price and never undercharges. |
| `GEMINI_API_KEY` | its only runtime reader was the `calculate-trends` cron. With crons off it is **not needed at all**. |
| `DEEPSEEK_API_KEY` | **dead** — no non-test reader anywhere in `src/`. |

### 11d. Optional overrides — all have in-code defaults, skip unless tuning

Model pins (`FOLD_MODEL`, `FLASH_MODEL`, `EMBEDDING_MODEL`, `QWEN_{APOLLO,DECODE,OMNI,REASONING,EMBEDDING}_MODEL`), fold tuning
(`FOLD_{TEMPERATURE,MAX_TOKENS,ATTEMPT_TIMEOUT_MS,DIVERSITY_RETRY_TEMP}`, `OMNI_MAX_TOKENS`,
`DEEPSEEK_THINKING_BUDGET`), grounding (`GROUNDING_*` — **hooks/ideas/script default OFF**, needing
`="true"`; `GROUNDING_CHAT_TOOL` / `GROUNDING_CHAT_PREFLIGHT` default **ON**, needing `="false"` to
disable), `CHAT_AGENT_DISPATCH` (defaults **ON**), `APIFY_ACTOR_ID`, `SCRAPER_HASHTAGS`,
`NEXT_PUBLIC_REACT_SCAN`.

`AB_*`, `SWEEP_BUDGETS`, `SPIKE_REAL`, `SMOKE_ASK`, `RUN_VISION_LIVE_SMOKE`, `GATE_MODEL`,
`PASS2_THINKING_BUDGET`, `QWEN_FAST_MODEL`, `OUT`, `T`, `YAW`, `PITCH` are **local research scripts
only** — never set them on Vercel.

### 11e. Crons: ALL 10 schedules removed (`716b5312`)

Owner call — they fired on production regardless of builds, two reach paid Apify, on a project
reporting `"live": false`. The routes stay deployed behind `verifyCronAuth`; only the schedules are
gone, so restoring is a revert (git history holds the array verbatim).

🔴 **Two are RETENTION, not refresh** — turning them off changes what the product DOES with user data,
not just what it spends: `delete-retained-videos` auto-deletes uploads older than 30 days for users
who did not opt into retention (Phase 11 / INT-05), and `sweep-orphan-videos` clears orphaned rows.
Inert with no users. **Before real signups, restore both or honour the 30-day deletion another way** —
otherwise the product keeps uploads it told people it would delete.
