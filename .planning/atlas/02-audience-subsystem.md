# Engine Atlas §02 — The Audience Subsystem (the moat)

> Trace-level companion to `docs/PLATFORM-MAP.md` §5 (Lane C). Goes DEEPER: every
> `path:line` is the live worktree (`~/virtuna-numen-tools`, branch `milestone/numen-tools`).
> Owner's #1 question answered here: **when a new audience is created, what's captured,
> and how does it influence every other part of the platform?**

Worktree base: `/Users/davideloreti/virtuna-numen-tools/`. All paths below are relative to it.

---

## 0. One-paragraph answer (read first)

An audience is **calibrated ONCE** (scrape → derive → bias → repaint) and then **frozen on a
DB row**. Nothing is re-derived per request. Its influence is two pre-baked artifacts carried
on the row: (a) **`persona_weights`** (four numbers — the goal-intent bias, baked once) and
(b) **`personas[]`** (10 `CalibratedPersona` with a deterministic `repaint` string each). At
skill time a thread pins one audience (`active_audience_id`); the runner turns `personas[]`
into an `archetype→repaint` map that gets folded into the Flash SIM system prompt so the SIM
"reacts as your audience", and turns the stored `profile` into a one-line grounding string for
the Qwen generation prompt. The weights are **dead-wired** in every text-mode skill today
(`void resolvedWeights`) — they exist only for the future video "Max" path and for the flywheel
to nudge. That's the whole moat: cheap, deterministic, no per-call LLM.

---

## 1. ASCII flow — create → calibrate → personas → influence

```
 CREATE (manual, no scrape)              CALIBRATE (SSE, the real path)
 POST /api/audiences                     POST /api/audiences/calibrate
 route.ts:81                             calibrate/route.ts:58
      │ Zod CreateAudienceSchema              │ Zod CalibrateSchema (handle/type/platform/
      │ (:46) + WeightsSum±0.01               │  goalIntent/name/description), sanitizeText
      ▼                                       ▼  send("status","Reading your followers…")
 createAudience(supabase, body)          calibrateFromScrape(input)   calibration.ts:172
 audience-repo.ts:288                          │
      │ user_id ← session (CR-01)              ├─ type==="personal" ──────────────┐
      │ WritableAudienceSchema                 │   Apify scrapeProfile + scrape-   │
      │ audienceToRow → flat fyp/niche/…       │   Videos(30) in Promise.all (:194)│
      ▼                                        │   THIN GATE (:211):               │
 INSERT audiences row ──────────┐              │   tier===null && videos<10        │
 (RLS audiences_all_own)        │              │     → { fallback:'general' }  ────┼─► send("fallback")
                                │              │       NEVER fabricates personas   │   → UI uses General
                                │              └─ type==="target" → zeroed mock    │
                                │                 ProfileData (:218)               │
                                │                       ▼                          │
                                │                 deriveAudienceProfile (:66)      │
                                │                 = temperature_mix + top_3        │
                                │                   dispositions + follower_tier   │
                                │                       ▼                          │
                                │                 biasForGoalIntent(goalIntent)    │
                                │                 goal-intent.ts:46  — BAKED ONCE   │
                                │                   grow→new_creator(fyp .75)       │
                                │                   sell/authority→niche_heavy(.55) │
                                │                   nurture→established(loyal .30)   │
                                │                       ▼                          │
                                │                 repaintPersonas (:144)            │
                                │                 persona-repaint.ts — NO LLM,      │
                                │                   deterministic template:         │
                                │                   base[arch] + GOAL_SUFFIX[intent][arch]
                                │                   share = slot_weight/slot_count   │
                                │                       ▼                          │
                                │                 CalibrationSuccess{audience}      │
                                │                       ▼                          │
                                └──────────────► createAudience(supabase,…) :145 ──┘
                                                       ▼  send("done",{audience})
                                          ┌──────── audiences ROW (frozen) ────────┐
                                          │ persona_weights (4 cols) + personas[10]│
                                          │ + profile + calibration{source,handle} │
                                          └────────────────────────────────────────┘
                                                       │
                  ┌────────────── active_audience_id pinned on open thread ────────┘
                  │   (PATCH /api/threads/[id]; runner reads thread, NEVER body — CR-01)
                  ▼
   RUNNER (ideas/hooks/script/chat/react/read) loads audience via getAudience()
        ├─ buildReactionPanel(profileRow, audience)         build-reaction-panel.ts:64
        │     → audienceRepaint = {archetype: repaint, …}   (undefined for General → no-op)
        ├─ buildAudienceGroundingLine(audience,…)           audience-grounding.ts:38
        │     → "Because: your tiktok audience — warm-leaning · connector · collector"
        └─ resolveAudienceWeights([audience])               resolve-audience-weights.ts:50
              → pre-baked weights via analysis_override slot   ⚠ void in every text runner
                  ▼
   runFlashTextMode(text, framing, panel, audienceRepaint)  run-flash-text-mode.ts:89
        → buildNicheAwareSystemPrompt(panel, audienceRepaint) folds repaint into SIM prompt
        → Qwen text-mode, temp 0 + seed → {personas:[{archetype,verdict,quote}]}
        → band (Strong/Mixed/Weak) + fraction = the moat verdict on the card
                  ▼
   FEEDBACK: reconciliations → confidence-gate → buildOverride(±0.05) → persona_weights
             (flywheel + audience-drift cron) — refuses General/preset
```

---

## 2. CREATE — `/api/audiences` POST → `createAudience`

Manual create (no scrape). The real onboarding path is CALIBRATE (§3); this is the
lower-level write both share.

**Route** `src/app/api/audiences/route.ts:81-111`
1. Auth-first: `supabase.auth.getUser()` → 401 if absent (`:86-90`).
2. `CreateAudienceSchema.safeParse` (`:46-56`) — exact captured fields:
   - `name` — `string 1..80`, `transform(sanitizeText)` (strips `\x00-\x1F\x7F`, `:41`).
   - `type` — `enum("personal","target")`.
   - `platform` — `enum("tiktok","instagram","youtube","custom")`.
   - `goal_label` — `string ≤120` sanitized, nullable/optional (free-text display label).
   - `goal_intent` — `enum("grow","sell","authority","nurture")`, nullable/optional.
   - `persona_weights` — optional `WeightsSchema` (`:25`) with the **sum≈1.0 ±0.01 refine** (`:32`).
   - `personas` / `profile` / `calibration` — `z.unknown()` passthrough (validated again in repo).
3. `createAudience(supabase, parsed.data)` (`:106`) → `201 {audience}`. **`user_id` is NOT in the
   schema** — it is injected from the session inside the repo (CR-01).

**Repo** `src/lib/audience/audience-repo.ts:288-318`
- Re-validates with `WritableAudienceSchema` (`:135`).
- `getUser()` again; `audienceToRow(input, user.id)` (`:200`) **forces `user_id = session.id`** (`:206`),
  ignoring any body value.
- **DB row shape** (`AudienceRow`, `:152-171`): weights are **flat columns** `fyp/niche/loyalist/cross_niche`
  (NOT a nested object) — the object form is only the domain shape; `audienceToRow` (`:215-220`)
  splays the object into four columns and `rowToAudience` (`:185-190`) re-nests them on read.
- `personas`, `profile`, `calibration` stored as **JSONB**.
- INSERT `.select("*").single()` → `rowToAudience`.

**RLS / user_id handling**
- App layer strips/forces `user_id` from session in `audienceToRow` (`:206`) and on UPDATE
  deletes it from the payload entirely (`:344`) so it can never be overwritten.
- DB layer: `audiences_all_own` RLS policy (referenced `:17`, `:35`) is the second guard.
- The `(supabase as any).from("audiences")` casts (`:238`, `:269`, `:307`…) are a **types-not-regenerated**
  smell — `database.types.ts` lacks the `audiences` table (see Lean lens).

---

## 3. CALIBRATE — `/api/audiences/calibrate` (SSE) → `calibrateFromScrape`

**Route** `src/app/api/audiences/calibrate/route.ts:58-173`
- `maxDuration = 300` (`:28`) — Apify runs take 1–3 min, so the function won't time out.
- SSE events: `status` (staged copy), `fallback` (thin), `error` (scrape fail), `done` (persisted).
- `CalibrateSchema` (`:37`): `handle? ≤50`, `type`, `platform`, `goalIntent` (**required here**,
  unlike create), `name 1..80`, `description? ≤500` — all sanitized.
- Emits `status:"Reading your followers…"` (`:102`) → `calibrateFromScrape` → `status:"Building your
  audience profile…"` (`:114`) → branch on result type (`:118-156`).

**Core** `src/lib/audience/calibration.ts:172-262` — *never throws; all outcomes are typed returns.*

### 3a. Personal path (scrape) — `:185-215`
1. `handle` required else `{error:"scrape_failed"}` (`:186`).
2. `new ApifyScrapingProvider()` (injectable for tests, `:190`).
3. **Parallel scrape**: `Promise.all([scrapeProfile(handle), scrapeVideos(handle, 30)])` (`:194`).
   Any throw → `{error:"scrape_failed", message}` (`:200`) — **distinct from thin** (UI shows
   "calibration failed" vs "couldn't read enough").
4. **THIN-DATA GATE** (`:210-214`, the honesty spine): `tier = getFollowerTier(profile.followerCount)`;
   if `tier === null && videos.length < THIN_MIN_VIDEOS` (`THIN_MIN_VIDEOS = 10`, `:48`) →
   `{fallback:"general", reason:"thin"}`. **NEVER fabricates personas.** Both conditions must
   hold (zero/missing followers AND <10 videos), so a big account with few videos still calibrates.

### 3b. Target path (no scrape) — `:218-230`
- `profile` stays `null`; a **zeroed mock `ProfileData`** is synthesized (`followerCount:0`, etc.)
  with `handle/displayName/bio` from `name`/`description`. No Apify call.

### 3c. Shared derivation — `:232-261`
- `deriveAudienceProfile(scrapeProfile, videos)` (`:66-106`) → `AudienceProfile`:
  - `follower_tier = getFollowerTier(profile.followerCount) ?? null`.
  - **`temperature_mix`** — ⚠ **profile-agnostic in v1**: it counts the fixed
    `TEMPERATURE_DISPOSITION` lens over the 10 archetypes (each equal-weighted), NOT the scraped
    data. So `temperature_mix` is the **same constant for every audience** (cold 4/10, warm 4/10,
    hot 2/10). The scraped `_videos` arg is **unused** (`:68` underscore).
  - `top_dispositions` — likewise counts dispositions across the 10 archetypes, top 3 — also a
    constant (`connector`, `skeptic`, `scanner` tie-broken by object order).
- `biasForGoalIntent(goalIntent)` (goal-intent.ts:46) → `persona_weights` — **baked ONCE here**.
- `repaintPersonas({audienceProfile, goalIntent, weights})` → 10 `CalibratedPersona`.
- Assembles `Omit<Audience,"id"|"created_at"|"updated_at">` (`:241`): `user_id:""` placeholder
  (route overwrites), `is_general:false`, `is_preset:false`, `calibration{source, handle, scraped_at,
  thin:false}`.
- Route persists via `createAudience(supabase, {...audienceInput, user_id:user.id})` (`:145`),
  then `send("done",{audience})`.

### 3d. The goal-intent bias table (LOCKED) — `goal-intent.ts:33-38`
Each intent → a `WEIGHT_PRESETS` preset (`audience-constants.ts:38-43`), values FINAL (W0/08-01):

| intent | preset | fyp | niche | loyalist | cross_niche | rationale |
|--------|--------|-----|-------|----------|-------------|-----------|
| `grow` | `new_creator` | **0.75** | 0.15 | 0.05 | 0.05 | cold-reach proxy, max FYP pull |
| `sell` | `niche_heavy` | 0.30 | **0.55** | 0.10 | 0.05 | converter/buyer lean, conversion in-niche |
| `authority` | `niche_heavy` | 0.30 | **0.55** | 0.10 | 0.05 | scout/skeptic lean, depth over breadth |
| `nurture` | `established` | 0.40 | 0.20 | **0.30** | 0.10 | retention, serve existing fans |

> ⚠ `sell` and `authority` are **byte-identical weight mixes** — they diverge only in the
> `repaint` prose (the `GOAL_INTENT_SUFFIX` map), not the numbers. Flagged in Lean lens.

### 3e. `repaintPersonas` — deterministic, NO LLM — `persona-repaint.ts:144-173`
- No `Date.now`, no `Math.random` → byte-identical output for same `(profile, intent, weights)`.
- For each archetype (in fixed `ARCHETYPES` order): `repaint = ARCHETYPE_BASE_DESCRIPTION[arch]
  + " " + GOAL_INTENT_SUFFIX[intent][arch]` (`:163`). Both are hand-authored static maps
  (`:31-52` base, `:55-104` suffix).
- **share** = `slot_weight / slot_member_count` via `ARCHETYPES_PER_SLOT` (`:120-125`):
  fyp(5 archetypes), niche(3), loyalist(1), cross_niche(1). e.g. grow fyp 0.75 → each of the 5
  fyp archetypes gets share 0.15.
- `temperature`/`disposition` pulled from `labelForArchetype` (the locked lens, §4).

---

## 4. The persona model

**`CalibratedPersona`** `src/lib/audience/audience-types.ts:63-76`:
```ts
{ archetype: Archetype;       // engine slug, immutable (byte-stable, cache safety)
  repaint: string;            // stored prompt-fold string (NOT regenerated per request)
  temperature: "cold"|"warm"|"hot";
  disposition: "scanner"|"skeptic"|"collector"|"connector"|"converter"|"lurker";
  share: number;              // 0..1, sums to 1.0 across the 10
  label?: string }            // creator-editable display ONLY — engine NEVER reads it
```
**Key boundary:** runners build the repaint map from `[archetype, repaint]` only
(build-reaction-panel.ts:78) and never touch `label`, keeping `label` outside the
regression-gate surface (`audience-types.ts:69-75`).

### The LOCKED 10-archetype Temperature × Disposition map
`src/lib/audience/temperature-disposition.ts:52-63` (D-02, W0-locked):

| Archetype | Temperature | Disposition | Weight slot |
|-----------|-------------|-------------|-------------|
| `tough_crowd` | cold | skeptic | fyp |
| `lurker` | cold | lurker | fyp |
| `high_engager` | warm | connector | fyp |
| `saver` | warm | collector | fyp |
| `sharer` | warm | connector | fyp |
| `purposeful_viewer` | warm | scanner | niche |
| `niche_deep_buyer` | hot | converter | niche |
| `niche_deep_scout` | hot | skeptic | niche |
| `loyalist` | hot | connector | loyalist |
| `cross_niche_curiosity` | cold | scanner | cross_niche |

- Compile-time exhaustiveness guard `_ExhaustiveCheck` (`:67-71`) breaks the build if an 11th
  archetype is added without a mapping.
- `ARCHETYPES` order is fixed in `wave3/persona-registry.ts:22-33` (drives persona array order).
- Slot grouping that drives `share` lives **separately** in `persona-repaint.ts:120` —
  **duplicated knowledge** vs `temperature-disposition` (cut candidate).

---

## 5. Virtual audiences — `audience-repo.ts:36-111`

- **`GENERAL_AUDIENCE`** (`:36-53`): sentinel `id:"general"`, `user_id:"__virtual__"`,
  `is_general:true`, `personas:[]`, `persona_weights = DEFAULT mix {fyp .65, niche .20,
  loyalist .10, cross .05}`. **No DB row** — `getAudience("general")` short-circuits via
  `VIRTUAL_BY_ID` (`:265`). Absence of `active_audience_id` ⇒ General ⇒ DEFAULT weights ⇒ the
  AUD-03 regression gate is "free by construction".
- **`PRESET_AUDIENCES`** (`:64-99`): exactly 2 — `preset-growth` (`goal_intent:"grow"`) and
  `preset-conversion` (`goal_intent:"sell"`), each with `is_preset:true`,
  `persona_weights = biasForGoalIntent(intent)` but **`personas:[]`** (so they produce **no
  repaint** → SIM runs niche-only, no audience fold). Materialized to a real row only if the
  creator customizes one (not implemented — see Open Qs).
- `listAudiences` prepends `[GENERAL, ...PRESETS, ...userRows]` and filters any sentinel ids out
  of the DB results (`:247-251`).

---

## 6. INFLUENCE — how an audience propagates downstream (the critical part)

### 6a. The pin
`threads.active_audience_id` (per-thread, set via AudienceChip → `PATCH /api/threads/[id]`).
Every runner reads it from the **thread, never the body** (CR-01). Canonical load idiom
(chat route `src/app/api/tools/chat/route.ts:206-216`, mirrored in script/read/ideas/hooks):
```
activeAudience = GENERAL_AUDIENCE;            // default
id = thread.active_audience_id ?? null;       // NULL ⇒ General, no DB query
if (id) { loaded = await getAudience(supabase, id); if (loaded) activeAudience = loaded; }
// load failure is non-fatal → falls back to General (no regression)
```

### 6b. Three derived artifacts at skill time (ideas-runner.ts:281-301, hooks-runner.ts:287-322)
1. **`buildReactionPanel(profileRow, audience)`** `build-reaction-panel.ts:64-82` →
   `{panel, audienceRepaint}`.
   - `audienceRepaint = Object.fromEntries(personas.map(p => [p.archetype, p.repaint]))`
     **only if** `audience && !is_general && personas.length>0` (`:77`); else `undefined`.
   - `panel.niche = resolveNicheKey(profileRow?.niche_primary)` — niche resolved at the
     **runner layer**, never inside the shared `selectPersonaSlots` (keeps the SIM-1 Max video
     path bytes untouched, ENGINE_VERSION 3.19.0 stable).
2. **`buildAudienceGroundingLine(audience, platform, profileRow)`** `audience-grounding.ts:38-95` →
   - General/null → delegates to `buildGroundingLine` (zero change).
   - Calibrated → `"Because: your {platform} audience — {dominant temp ≥40%} · {top 3 dispositions}"`
     (`:92`) from the **stored** `profile`; **no fabricated counts** (honesty spine). This line is
     injected into the Qwen *generation* prompt's "why it fits".
3. **`resolveAudienceWeights([audience])`** `resolve-audience-weights.ts:50-65` →
   - Empty/General → `resolveWeights(DEFAULT, {})` (source `default`).
   - Calibrated → pre-baked `persona_weights` through `analysis_override` (highest precedence).
   - ⚠ **`void resolvedWeights`** in BOTH text runners (ideas-runner.ts:296, hooks-runner.ts:322):
     the weights are **dead-wired** — the Flash text path uses the *repaint*, not the weights.
     Weights matter only to (a) the future video "Max" path and (b) the flywheel's nudge target.

### 6c. Flash SIM reacts as the audience
`runFlashTextMode(text, framing, panel, audienceRepaint)` `run-flash-text-mode.ts:89-105`:
- If `panel.niche !== null` → `buildNicheAwareSystemPrompt(panel, audienceRepaint)` (`:104`)
  **folds the stored per-audience repaint strings into the SIM system prompt**; else the
  byte-stable `STABLE_FLASH_SYSTEM_PROMPT` (General no-op, D-17).
- `temperature:0` + seed (`:123`) → deterministic. Output `{personas:[{archetype, verdict, quote}]}`
  → aggregated to **band** (≥6 stop=Strong, ≥3=Mixed, else Weak) + **fraction** = the card verdict.
- **The single point where audience identity enters the model** is `audienceRepaint` here. Bias
  (weights) is applied at **calibration time only**, never per call.

### 6d. AudienceLens UI spine
`src/components/audience-lens/AudienceLens.tsx` (thin Sheet) → `AudienceLensContent.tsx`:
- **Panel·10 ⇄ Population·1,000** scale toggle (`AudienceLensContent.tsx:104-105`, `useLensScale`)
  — `PopulationSwarm` renders 1,000 dots cascaded from the 10 persona shares.
- **PersonaChatDrawer** (`:45`) — "Ask them why →" → `POST /api/tools/chat` with
  `personaGrounding{archetype, reactionToConcept, conceptText}`; the chat system prompt is
  prefixed by `buildPersonaSystemPrefix(archetype, verdict)` sourced read-only from
  `ARCHETYPE_DEFINITIONS`/`ARCHETYPE_TRIGGERS`. Turns persist as `persona-chat-turn` blocks
  scoped by archetype.
- **Rewrite-for-audience** loop (`LensRewrite`, `:54-70`) — sticky CTA that re-runs the concept
  through the SIM for the active audience and shows the stop-count delta.

---

## 7. Feedback loops

### 7a. Flywheel — `/api/flywheel/proposals` (NO LLM)
`src/app/api/flywheel/proposals/route.ts` — thin auth-first wrapper over `propose.ts`.
- **GET** `?audience_id=` → `getPendingProposals` (propose.ts:102): `getAudience` →
  `isRecalibratableAudience` refuses General/preset (returns null, no query, `:108`) →
  `listReconciliations` → `evaluateGate` (confidence-gate.ts:76).
- **Gate** (confidence-gate.ts:29-35): per CALIBRATION disposition, propose iff
  `n ≥ N_MIN(5)` AND `|mean| ≥ DIV_THRESHOLD(0.12)` AND `agree ≥ AGREE_THRESHOLD(0.70)`.
  Craft dispositions can never propose (gate iterates `CALIBRATION_DISPOSITIONS` only). One
  viral/flop post can't yank weights — needs consistent direction across ≥5 posts.
- **POST** confirm → `confirmProposal` (propose.ts:139): re-checks the gate, then
  `buildOverride(proposal, audience.persona_weights)` (recalibration.ts:65) →
  `updateAudience({persona_weights})`. Contributing reconciliation rows → `'confirmed'` (no re-nag).
- **Bounded nudge** (recalibration.ts:33,65-83): `ASSUMED_STEP = 0.05` (⚠ **NOT ±0.1** as the
  platform map/brief claim). `slot_new = clamp(slot_old + 0.05·sign(mean), 0, 1)` then
  `normalizeWeights` re-sums to 1.0. Disposition→slot map (`:43-47`): `collector→fyp`,
  `converter→niche`, `connector→[fyp,loyalist]`. **Only `persona_weights` is ever written** —
  DEFAULT/ARCHETYPE_DEFINITIONS/ENGINE_VERSION untouched (the moat-safety boundary).
- Decline → rows `'declined'`, audience untouched.

### 7b. Audience-drift cron — `/api/cron/audience-drift` (NO LLM)
`src/app/api/cron/audience-drift/route.ts:101-248` (weekly Mon 05:00, `maxDuration 300`).
- `verifyCronAuth` + `CRON_SECRET` first; `createServiceClient()` bypasses RLS, reads `user_id`
  from each row.
- Selects `type='personal' AND !is_general AND !is_preset` with a `calibration.handle` (`:111-125`).
- Per audience: `calibrateFromScrape` re-scrape (`:142`); a thin/failed result writes **no drift
  row** (honesty spine, `:160`).
- Builds realized vs predicted **disposition** vectors from fresh vs stored personas' shares
  (`compositionVector`, `:58`); if `hasShift` (`:67`) → insert `outcome_signatures` row
  `source='drift_scrape'` (`:181`) → `reconcile` (`:203`) → `reconciliations` row
  `proposal_state='logged'`. **Drift is NOT a separate mechanism** — it feeds the SAME gate +
  nudge path as outcome capture (D-01). Returns `{scanned, drifted, skipped}`.

---

## 8. Lean lens / cut-candidates

1. **`deriveAudienceProfile` is theatre.** `calibration.ts:66-106` ignores the scraped
   `_videos` entirely and derives `temperature_mix` + `top_dispositions` by counting the **fixed
   10-archetype lens** — so **every audience gets the identical profile** regardless of who was
   scraped. The only real scraped signal that survives is `follower_tier`. The grounding line
   ("warm-leaning · connector · collector") is therefore **the same string for everyone**. Either
   make it data-driven or cut it to just `follower_tier`. **Biggest finding.**

2. **`sell` vs `authority` are weight-identical.** `goal-intent.ts:35-37` both map to
   `niche_heavy`. Four intents, three distinct weight mixes. If the only difference is repaint
   prose, the 4-way taxonomy is over-specified for the weight engine — collapse to 3 or make
   `authority` distinct.

3. **`resolveAudienceWeights` is dead-wired in all text skills** (`void` at ideas-runner.ts:296,
   hooks-runner.ts:322). It runs, normalizes, and is discarded on every ideas/hooks call. Its only
   live consumers are the future Max video path (not built) and the flywheel write target. Cut the
   per-call invocation from the text runners until the Max path lands (saves a function call + the
   reader confusion of "why is this voided").

4. **Preset audiences have `personas:[]`** (`audience-repo.ts:73,91`) → they carry weights but
   produce **no repaint**, so picking a preset gives a niche-only SIM with zero audience fold —
   functionally close to General with different weights (and weights are voided in text skills, §3).
   Presets are near-inert in the current text-only product. Either populate their personas at
   definition time or drop them until the Max path uses weights.

5. **Slot→archetype knowledge is duplicated.** `ARCHETYPES_PER_SLOT` (persona-repaint.ts:120) and
   the slot column in `TEMPERATURE_DISPOSITION`/registry are two sources for the same grouping.
   Centralize in the registry.

6. **`(supabase as any)` casts everywhere** (audience-repo.ts:238/269/307, drift cron:110/181/206)
   — the `audiences`/`outcome_signatures`/`reconciliations` tables were never added to
   `database.types.ts`. This is real type debt, not just cosmetic — every audience read/write is
   unchecked. Regenerate types and drop the casts.

7. **Two weight schemas + two `sanitizeText`** duplicated between `route.ts` and
   `calibrate/route.ts` and `audience-repo.ts` (`WeightsSchema` defined 3×). Hoist to one module.

8. **Manual create (`POST /api/audiences`) overlaps calibrate.** The SSE calibrate route is the
   real path; the plain POST exists mostly for tests / preset materialization that isn't wired.
   Confirm any UI actually hits the plain POST or fold it into calibrate.

---

## 9. Open questions

1. **Is `deriveAudienceProfile` intended to be constant?** The `_videos` arg is unused and
   `temperature_mix` never reflects the scraped account. Was a data-driven derivation planned and
   stubbed, or is the constant lens the intended v1? (This determines whether the grounding line
   carries any real signal — currently it doesn't.)

2. **±0.1 vs 0.05 nudge.** Brief + `PLATFORM-MAP.md §5.7` say the flywheel writes a **bounded
   ±0.1** shift; code is `ASSUMED_STEP = 0.05` (recalibration.ts:33). Which is canonical? Doc or
   code is stale.

3. **Preset materialization** ("customize a preset → real row") is referenced in comments
   (audience-repo.ts:62, repo header) but I found no write path that flips a preset to a row.
   Is it implemented anywhere, or dead intent?

4. **Where does the grounding line actually land in the prompt?** Confirmed it's built in
   ideas/hooks runners, but only ideas-runner was noted in P7 as the sole consumer (AUD-08
   blast-radius gate, ideas-runner.ts:300). Do hooks/script actually inject it into the Qwen
   *generation* user message, or only compute it? Worth confirming it isn't computed-and-dropped
   like the weights.

5. **`FOLD_MODEL`/Max path & weights.** The persona_weights (the only real per-account scraped
   signal besides follower tier… which itself is also unused in derive) feed only the unbuilt Max
   video path. Until that ships, the audience's *numeric* calibration influences **nothing** in the
   live text product — only the repaint prose does. Is that the intended interim state?

6. **`label` round-trip.** `CalibratedPersona.label` is creator-editable and explicitly never read
   by the engine. Confirm the persona-edit form persists it via the `personas` JSONB override and
   that drift re-scrape (which overwrites `personas`) doesn't silently wipe creator labels.
