# Engine Atlas §03 — Generative Skills + the Flash SIM Gate

> Trace-level companion to `docs/PLATFORM-MAP.md` §1.2 + §2. Goes DEEPER: file:line,
> actual call sequence, timing/parallelism, retry/timeout config, cut-candidates.
> Worktree: `~/virtuna-numen-tools` (branch `milestone/numen-tools`). Generated from code trace 2026-06-22.
>
> **One-line correction to PLATFORM-MAP §1.2:** the map says Flash uses `QWEN_REASONING_MODEL`.
> The code resolves Flash via `FLASH_MODEL ?? QWEN_FAST_MODEL` = **`qwen3.6-flash`**, NOT the
> reasoning model. Generation (hooks/ideas/script/decode/adapt) uses `qwen3.7-plus`; the SIM
> gate + critic use `qwen3.6-flash`. See §4 model table.

---

## 1. HOOKS — full flagship trace

Two files: route (`src/app/api/tools/hooks/route.ts`) + runner (`src/lib/tools/runners/hooks-runner.ts`).
Flash internals in `src/lib/engine/flash/*`.

### 1.1 ASCII sequence (request → SSE → persist)

```
CLIENT POST /api/tools/hooks  { ask≤2000, platform, anchor≤5000 }
   │
   ▼  route.ts:79  POST()
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ (1)  supabase.auth.getUser()            route.ts:83   → 401 if no user        │
 │ (1b) csrfGuard(request)                 route.ts:91   → 415/403               │
 │ (2)  parse body + length caps           route.ts:95-120  (2000 / 5000 chars)  │
 │      platform enum-normalize            route.ts:123                          │
 │ (3)  rate-limit = NO-OP (void consts)   route.ts:128   ← DEAD (deferred v2)   │
 │ (4)  load creator_profiles (maybeSingle)route.ts:132   1 DB read             │
 │ (5)  createOpenThreadLazy(user.id)      route.ts:140   1 DB read/insert      │
 │ (5a) active_audience_id → getAudience() route.ts:146-156  0–1 DB read        │
 │                                          (NULL=General sentinel, no query)    │
 └─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼  new ReadableStream.start(controller)   route.ts:161
   │
   ├─ SSE> stage {Generating, active}        route.ts:175
   ├─ SSE> status {"Generating hooks…"}      route.ts:177
   │
   ▼  await runHooksPipeline({ask,platform,profileRow,anchor,audience,pin})  route.ts:179
 ┌──────────────────────────────── hooks-runner.ts:274 ─────────────────────────┐
 │ STEER          buildAudienceGroundingLine(audience,platform,profileRow) :291  │
 │                audienceOverride only if calibrated (folds into bundle) :292   │
 │                                                                              │
 │ GENERATE       assembleBundle({ask,platform,mode:"hooks",anchor,overrides}) │
 │                                                            hooks-runner.ts:295│
 │   └─ QWEN CALL #1  generateHooksStructured(userMessage)   :147               │
 │        model qwen3.7-plus · json_object · temp 0 · seed 7  :157-164          │
 │        system = KC_HOOKS_SYSTEM_PROMPT + HOOKS_OUTPUT_CONTRACT :159          │
 │        AbortController timeout 300_000ms  :151  ·  NO retry (SDK maxRetries:0)│
 │        → ~8 StructuredHook {hookLine,mechanism,seedHook,channel,needsTake}    │
 │                                                                              │
 │ PANEL          buildReactionPanel(profileRow,audience)    :316               │
 │                  panel.niche = resolveNicheKey(niche_primary) (build-…:71)    │
 │                  audienceRepaint = archetype→repaint map | undefined         │
 │                resolveAudienceWeights(...) → void (DEAD-wired) :322-323       │
 │                                                                              │
 │ SIM + GATE     gateHooks(firstBatch)   hooks-runner.ts:347                   │
 │   await Promise.all( hooks.map(async hook =>      ← PARALLEL fan-out (8)     │
 │      await Promise.all([                          ← inner pair per hook      │
 │         QWEN CALL #2..N  runFlashTextMode(seed,"hook",panel,repaint) :357     │
 │            model qwen3.6-flash · json_object · temp 0 · seed 7               │
 │            timeout 60_000ms (run-flash-text-mode.ts:53) · .catch→null        │
 │         critic   isRubricCriticEnabled()? critique… : PASS_VERDICT :362-364  │
 │            ← OFF by default → Promise.resolve, NO call                       │
 │      ]) )                                                                    │
 │   per hook: aggregateFlash(personas) → {band,fraction}  :377                 │
 │   GATE:  drop band==="Weak"        :380                                       │
 │          (critic.pass irrelevant when disabled — collapses to band-only)     │
 │   selectLeadScrollQuote + deriveAudienceArchetype  :392-401                  │
 │                                                                              │
 │ REGEN?         if survivors.length===0 → ONE more generate+gate :437-442     │
 │                  (QWEN CALL #N+1 generate, then 8 more parallel SIM)          │
 │                                                                              │
 │ RANK+TRIM      sort by bandOrdinal → fraction numerator → genIndex :448-455  │
 │                survivors.slice(0, MAX_HOOKS=5)        :457                    │
 │ BUILD          HookCardBlockSchema.safeParse per card :484                    │
 │ FLYWHEEL       void pinPredictedSignature(rank-1 personas) :503  (fire&forget)│
 │ return {blocks≤5, warnings, seedHookPath:"structured"}                        │
 └──────────────────────────────────────────────────────────────────────────────┘
   │
   ├─ SSE> stage {Generating,done}                       route.ts:190
   ├─ SSE> stage {Self-judge active+done}                route.ts:198-199 ← SYNTHETIC
   ├─ SSE> stage {Simulating your audience active+done}  route.ts:200-201 ← SYNTHETIC
   ├─ SSE> stage {Ranking active+done}                   route.ts:202-203 ← SYNTHETIC
   │     (all four fired AFTER the single await — no real per-phase callbacks; D-02 "coarse")
   ├─ SSE> warning {warnings}            (if any)        route.ts:205
   ├─ SSE> status {"Scoring on your audience…"}          route.ts:210
   ├─ SSE> content {blocks[].props faces incl scrollQuote+rank+audienceArchetype} :214
   ├─ SSE> score   (per card: band, fraction)            route.ts:232-240
   │
   ▼  insertMessage(thread,"assistant",blocks,kcGenVersion)  route.ts:244  1 DB write
   │
   ├─ FOLLOW-UP  QWEN CALL (last)  ai.chat.completions.create stream  route.ts:267
   │     model qwen3.7-plus · temp 0.4 · STREAMING · system=KC_CHAT_SYSTEM_PROMPT
   │     drains stream into followupText  :276-278
   │     insertMessage(markdown)  :282   1 DB write  ·  SSE> followup {text}  :289
   │     wrapped in try/catch — NON-FATAL
   │
   └─ SSE> done {count}  route.ts:296  ·  controller.close()
```

### 1.2 Qwen round-trip count (the latency accounting)

Happy path (no regen, critic OFF, default):

| # | Call | Model | Shape | Timeout | Parallel? |
|---|------|-------|-------|---------|-----------|
| 1 | generate ~8 hooks | qwen3.7-plus | json_object, temp0/seed7 | 300s | — |
| 2..9 | SIM per hook (×8) | qwen3.6-flash | json_object, temp0/seed7 | 60s ea | **YES — `Promise.all` fan-out** |
| 10 | follow-up chat | qwen3.7-plus | streaming, temp0.4 | (none) | after persist |

**Total = 1 (generate) + 8 (SIM, wall-clock = slowest of 8) + 1 (follow-up) ≈ 3 serial "waves".**
Critic OFF means the inner `Promise.all([SIM, critic])` collapses to just SIM (`Promise.resolve(PASS_VERDICT)`, no HTTP). With `RUBRIC_CRITIC_ENABLED=true` it becomes **8 more parallel flash calls** (still same wall-clock wave, but doubles flash token cost and can trip regen — see §5).

Regen path (all 8 score Weak): +1 generate +8 SIM = doubles to ~5 waves.

### 1.3 Where the ~110s goes

- **Wave 1 — generate (qwen3.7-plus, reasoning, ~8 hooks json):** the heavy one. Reasoning model, large structured output. Dominant single contributor, ~30–60s.
- **Wave 2 — SIM fan-out (8× qwen3.6-flash in parallel):** wall-clock = the SLOWEST single flash call (~8–17s each per `run-flash-text-mode.ts:51`), NOT 8×. So ~15–25s wall-clock despite 8 calls. This is already parallelized correctly.
- **Wave 3 — follow-up (qwen3.7-plus streaming):** ~10–20s, runs AFTER cards persist and AFTER `content`/`score` SSE frames, so it does NOT block first paint — but it DOES delay `done`.
- DB reads/writes: ~4 reads + 2 writes, negligible (<1s).

Net: latency concentrates in the **two qwen3.7-plus reasoning calls** (generate + follow-up), not the flash SIM fan-out. The SIM fan-out is cheap because it's parallel + flash-tier.

### 1.4 Retry / timeout config (per call)

- SDK: `getQwenClient()` sets `maxRetries: 0` (`qwen/client.ts:16`) — **no SDK-level retries anywhere**.
- Generate: `AbortController` 300_000ms (`hooks-runner.ts:71,151`). No app retry — one shot; throw propagates to route `catch` → SSE `error`.
- SIM: `AbortController` 60_000ms (`run-flash-text-mode.ts:53,128`). `.catch(()=>null)` per hook → a failed SIM drops THAT hook, never the run (`hooks-runner.ts:357-361`).
- Critic: 60_000ms (`rubric-critic.ts:66`), fail-safe → ABSTAINED/FAIL, never throws.
- Follow-up: no AbortController, no timeout — relies on platform `maxDuration`. Non-fatal try/catch.
- **No exponential backoff anywhere.** "Retry" in this subsystem = the conditional ONE regen on zero survivors (`hooks-runner.ts:437`), not HTTP retry.

---

## 2. Flash SIM internals

Files: `src/lib/engine/flash/{run-flash-text-mode, flash-prompts, flash-aggregate, flash-schema, build-reaction-panel, rubric-critic}.ts`.

### 2.1 `buildReactionPanel(profileRow, audience)` → `{ panel, audienceRepaint }`
`build-reaction-panel.ts:64`
- `panel = { niche: resolveNicheKey(profileRow?.niche_primary ?? null), contentType: null }` (:71).
  `resolveNicheKey` (14-01 fix) normalizes free-text/sub-slug → top-level `NICHE_INSTANTIATION` key. Without it, `selectPersonaSlots` exact-slug match falls back to generic → "all Mixed" (the niche-blind failure mode).
- `audienceRepaint` = `Object.fromEntries(audience.personas.map(p => [p.archetype, p.repaint]))` IF calibrated + non-empty personas, else **`undefined`** → runner omits the arg → byte-identical General no-op (:76-79).
- Repaint text is STORED at calibration (deterministic), never generated per-request.

### 2.2 `runFlashTextMode(text, framing, panel?, audienceRepaint?)`
`run-flash-text-mode.ts:89`
- Model: `FLASH_MODEL ?? QWEN_FAST_MODEL` = **qwen3.6-flash** (:47). PRODUCT label is "sim1-flash" (carried on blocks), distinct from the infra model id.
- System prompt selection (:102-105):
  - `panel.niche !== null` → `buildNicheAwareSystemPrompt(panel, audienceRepaint)` (`flash-prompts.ts:172`) — folds `selectPersonaSlots(contentType, niche)` into the archetype block; duplicate-archetype slots encode FYP/tough_crowd ~30% weighting by repetition; substitutes `audienceRepaint[archetype]` for each slot's `niche_instantiation` when present.
  - else → `STABLE_FLASH_SYSTEM_PROMPT` (`flash-prompts.ts:128`) — byte-stable, all 10 `ARCHETYPE_DEFINITIONS` verbatim (cache prefix).
- User content: `buildFlashUserContent(text, framing)` (`flash-prompts.ts:258`) — swaps ONLY the per-framing QUESTION + band VERBIAGE. `framing ∈ {hook, idea, chat}` (`FRAMING_QUESTION` :41, `FRAMING_BAND_VERBIAGE` :58).
- Call: `json_object`, temp 0, seed 7, AbortController 60s (:107-128). Single bounded call, return-whole (no stream).
- Parse: `stripModelOutput` (strips `<think>`/fences) → `JSON.parse` → `coerceFlashResponse` (salvages bare-array/casing) → `FlashResultSchema.safeParse` (:146-165). Throws on validation fail (caller's `.catch` handles).
- Output: `{ personas: [{archetype, verdict:"stop"|"scroll", quote≤160ch}] }` × exactly 10.

### 2.3 `aggregateFlash(personas)` → `{ band, fraction }`
`flash-aggregate.ts:94` — PURE, deterministic, no I/O.
- `stops = count(verdict==="stop")`.
- band: `stops ≥ 6 → Strong` (`STRONG_THRESHOLD`:64); `stops ≥ 3 → Mixed` (`MIXED_THRESHOLD`:67); else `Weak`.
- fraction: `` `${stops}/${total} stop` `` e.g. "6/10 stop".
- **Honesty spine:** exactly two fields. No 0–100 score, percentile, views, engagement. Gate floor = `band !== "Weak"` (stops ≥ 3).

### 2.4 The critic — `critiqueAgainstRubric(item, framing, panel)`
`rubric-critic.ts:201` — **DEACTIVATED BY DEFAULT.**
- Master switch `isRubricCriticEnabled()` = `process.env.RUBRIC_CRITIC_ENABLED === "true"` (:58). Default false.
- When OFF: runners skip the call entirely (`Promise.resolve(PASS_VERDICT)`), gate collapses to band-only. No extra API hit.
- Model qwen3.6-flash, json_object, temp0/seed7, 60s (:209-224). System = `RUBRIC_SYSTEM_PROMPT` (BASE Value Bar: Test A Named Mechanism / B Concrete Instantiation / C Fit + Prohibition 6 obvious-list). Output `{pass, predictedFailureMode}`.
- Fail-safe: transport/parse error → `ABSTAINED` ({pass:false, abstained:true}), NEVER throws. Runner WR-01: abstention degrades to band-only + warning (doesn't hard-drop), genuine `!pass` drops.
- **Why off (rubric-critic.ts:46-57):** over-strict critic failed ~100% of candidates → tripped regen-on-zero → doubled wall-clock (the 2-3× the owner felt). Code + tests retained for env-flag re-enable / A/B.

### 2.5 `flash-runner.ts` — separate ToolRunner + the FLYWHEEL pin
`src/lib/tools/runners/flash-runner.ts`
- `flashRunner` (`:62`) is a `ToolRunner` contract object (id:"hooks", model:"sim1-flash", renderer:["band","personas"]). **Per its own doc (:11-13) it was NEVER wired to UI** — Ideas/Hooks call `runFlashTextMode` directly, not `flashRunner.run()`. `runFlashRunner` helper (:100) is likewise unused by the live skill routes. **Cut-candidate (§5).**
- `pinPredictedSignature(supabase, personas, ctx)` (:155) IS used — every runner fires it `void` (fire-and-forget) post-SIM to pin the predicted disposition vector + audience_id for the flywheel reconciliation loop. Non-fatal.

---

## 3. Other skills as DELTAS from hooks

All share the envelope (auth → CSRF → caps → open-thread → audience) and the GENERATE→SIM→build spine. Only deltas below.

| Skill | Route / runner | Generate (model) | SIM calls | Survivors | Key delta vs hooks |
|-------|----------------|------------------|-----------|-----------|---------------------|
| **Ideas** | `tools/ideas` · `ideas-runner.ts:258` | ~5 ideas, qwen3.7-plus json | **parallel** per idea (`Promise.all` :325) | up to **3** (`MAX_SURVIVORS`:74) | gate-only (NO rank/trim by tier); breaks at 3 survivors; same conditional-regen-once; follow-up chat |
| **Script** | `tools/script` · `script-runner.ts:234` | **1** script (beats+openingBeatSeed), qwen3.7-plus | **1** — opener only (`runFlashTextMode(openingBeatSeed,"hook")` :288) | 0 or **1** card | builds panel inline (NOT `buildReactionPanel` — no `resolveNicheKey`, :273-274 → niche-blind risk); no rank; SIM scores OPENER not full script (honesty) |
| **Remix** | `tools/remix/run` · `remix-runner.ts:123` | decode (qwen3.7-plus, thinking_budget 2000) + adapt (qwen3.7-plus) | **1** — adapted hook only (:213) | 0 or **1** card | longest chain: resolveAndRehost(Apify)→analyzeVideoWithOmni(qwen3.5-omni-flash)→runDecode→generateAdaptConcepts(pick concepts[0])→SIM. `cleanup()` in finally. NO `resolveNicheKey` (inline panel :209) |
| **Refine** | `tools/refine` · route only | re-runs hooks OR ideas pipeline whole (:180/188) | full pipeline's SIM fan-out | **top 1** survivor | append-only (never overwrites); fresh SIM (moat); one-line chat note; takes `allBlocks[0]` |
| **React** | `tools/react` · route only | **NONE** | **1** ephemeral SIM (:125) | n/a | JSON not SSE; audience server-resolved (CR-01); returns `{fraction,scrollQuote}`; **NOT persisted**; uses `buildReactionPanel` (correct niche path) |
| **Explore** | `tools/explore` · `explore-runner.ts:87` | **NONE** | **NONE** | tiles | NO LLM at all. Apify scrape(30)→`rankOutliers`(half-life decay)→`rankWithAudienceFit` (pure math). outlier-grid block |
| **Ideas/develop** | `tools/ideas/develop` · route | calls runHooksPipeline (:112) | hooks' SIM fan-out | up to 5 | JSON not SSE; synchronous; "Develop this →" chain anchor; returns `{threadId,messageId,fencedHooksBundle,ideaId}` |
| **Two-audience Read** | `flash/two-audience-read.ts:runTwoAudienceRead` | NONE | **2** SIM (one per audience, :each resolve+run) | 1 multi-audience-read block | delta interpretation computed from 2 bands, NO extra LLM; `MAX_AUDIENCES=2` |

### 3.1 The dual remix routes (PLATFORM-MAP §9.7 flag — confirmed)
- `/api/tools/remix/run` (SSE) → `runRemixPipeline` — FULL pipeline (resolve→omni→decode→adapt→SIM→remix-card). `maxDuration=300` (~240s worst case). Stages emitted coarse-synchronously after one await (route.ts:161-187), same limitation as hooks.
- `/api/remix/adapt` (JSON) — adapt-ONLY from wire `{decode, niche}`, does NOT read DB, calls `generateAdaptConcepts` (`adapt/route.ts:148`), read-merge-writes `variants.remix.adapt`. This is a Lane-B (Read) sub-route, NOT a generative-skill card path. The two do not share an orchestrator. See §5.

---

## 4. Exact Qwen model IDs per skill + call shape

Source: `src/lib/engine/qwen/client.ts:46-50` (env-overridable defaults).

| Constant | Default ID | Skills using it |
|----------|-----------|-----------------|
| `QWEN_REASONING_MODEL` | **qwen3.7-plus** | hooks/ideas/script GENERATE, follow-up chat, refine note, decode (`QWEN_DECODE_MODEL` falls back to it), adapt |
| `QWEN_FAST_MODEL` (via `FLASH_MODEL`) | **qwen3.6-flash** | ALL Flash SIM (`runFlashTextMode`) + rubric critic |
| `QWEN_OMNI_MODEL` | qwen3.5-omni-flash | remix PERCEIVE (`analyzeVideoWithOmni`) |

generate→SIM→follow-up shape per skill:
- **hooks:** generate(3.7-plus) → 8×SIM(3.6-flash, parallel) → [rank] → followup(3.7-plus stream).
- **ideas:** generate(3.7-plus) → 5×SIM(3.6-flash, parallel) → followup(3.7-plus stream).
- **script:** generate-1(3.7-plus) → 1×SIM-opener(3.6-flash) → followup(3.7-plus stream).
- **remix:** omni(3.5-omni-flash) → decode(3.7-plus, thinking) → adapt(3.7-plus) → 1×SIM(3.6-flash). No followup.
- **react:** 1×SIM(3.6-flash) only.
- All json_object generation/SIM/critic calls: temp 0 + seed 7. Follow-up/note chat: temp 0.3–0.4, streaming.

---

## 5. Lean lens / cut-candidates

1. **`flash-runner.ts` `flashRunner` ToolRunner + `runFlashRunner`/`mapFlashResultToBlocks` helpers — DEAD UI path.** Per its own header (`flash-runner.ts:11-13`) it was never wired; live skills call `runFlashTextMode` directly. Only `pinPredictedSignature` from this file is used. **Cut the runner object + helpers, keep the pin function** (move to a `flywheel-pin.ts`). Removes the unused `ToolRunner`/`dispatchToolOutput`/`block-registry` coupling.

2. **Rubric critic infrastructure — deactivated, ~390 lines + tests carried dark.** `rubric-critic.ts` (255L) + the `criticEnabled`/`abstainedKept`/WR-01 branches in BOTH `hooks-runner.ts` (:351-421) and `ideas-runner.ts` (:321-409). It is OFF by default and the doc says it failed ~100% of candidates. Either (a) recalibrate + ship, or (b) delete it and the dual-branch gate logic, collapsing each gate to `band !== "Weak"`. Right now every gate carries a `Promise.all([SIM, Promise.resolve(PASS_VERDICT)])` wrapper that exists only to support a disabled feature. **Strong cut candidate.**

3. **Dual remix routes.** `/api/tools/remix/run` (full SSE card) and `/api/remix/adapt` (JSON, wire-only, writes `variants.remix.adapt`) overlap on `generateAdaptConcepts`. The adapt-only route belongs to the Read/analysis path, not generative skills. Confirm the UI only calls one; if `/api/remix/adapt` is orphaned, cut it. At minimum they should share an adapt orchestrator so concept logic can't diverge.

4. **Synthetic SSE stages.** hooks/ideas/refine/remix all emit `Self-judge`/`Simulating`/`Ranking` stage frames AFTER the single awaited pipeline call (e.g. `hooks-runner` route.ts:198-203). They are theatrical — fired back-to-back with no real boundary. Either thread real per-phase callbacks through the runner (so the UI reflects actual progress) or drop the fake transitions. Low-risk cleanup.

5. **`resolveAudienceWeights(...) → void` dead-wire** in every runner (`hooks-runner.ts:322-323`, ideas/script/remix identical). Computed then discarded ("future Max-path"). Dead until that path exists — cut or gate behind a flag.

6. **Inconsistent niche resolution = latent bug, not just bloat.** hooks/ideas/react use `buildReactionPanel` (with `resolveNicheKey`). **script (`script-runner.ts:273`) and remix (`remix-runner.ts:209`) build the panel INLINE without `resolveNicheKey`** → for free-text/sub-slug niches they silently fall to the generic "all Mixed" panel (the exact failure 14-01 fixed elsewhere). Route script + remix through `buildReactionPanel` too — one-line fix, restores moat discrimination.

7. **Follow-up chat (3.7-plus streaming) blocks `done`.** It runs after persist but before `done` (hooks route.ts:267-296). It's non-fatal but adds ~10–20s to perceived completion. Consider firing it `void` (don't await) or moving to a second request — cards already painted.

8. **Parallelize the two reasoning waves?** generate(3.7-plus) and follow-up(3.7-plus) are the latency floor. Follow-up depends on the generated hooks so can't move earlier, but could be dropped from the critical path (see #7). Generate is irreducible without a faster model or smaller buffer (8→6 hooks would cut output tokens).

---

## 6. Latency / parallelism notes (summary)

- **SIM fan-out IS parallel** (`Promise.all`, hooks-runner.ts:353; ideas-runner.ts:325). 8 (hooks) / 5 (ideas) flash calls run concurrently; wall-clock = slowest single call (~8–17s), not the sum. Already optimal.
- **Per-hook inner pair** `Promise.all([SIM, critic])` is also parallel (hooks-runner.ts:356) — but critic is `Promise.resolve` when disabled (no HTTP), so it's just SIM today.
- **Serial waves:** generate → SIM-fan-out → (rank/build, CPU only) → follow-up. ~3 network waves happy-path.
- **Critic ON doubles flash cost + risks regen:** enabling adds a parallel flash call per candidate (same wall-clock) BUT its ~100% fail rate trips the zero-survivor regen (hooks-runner.ts:437) = +1 generate +8 SIM = roughly 2× wall-clock. This is the documented "2-3× the owner felt".
- **Regen is the hidden tail:** one extra full generate+gate pass when all candidates score Weak. Bounded to ONCE (never a loop).
- **Remix is the long pole:** omni perception + thinking-mode decode + adapt + resolve/rehost (Apify) → `maxDuration=300`, ~240s worst case. Serial by nature (each stage feeds the next).
- **Dominant cost = the two qwen3.7-plus reasoning calls**, not the flash SIM tier.

---

## 7. Open questions

1. **Flash model vs PLATFORM-MAP:** code uses `qwen3.6-flash` for SIM (run-flash-text-mode.ts:47), map §1.2 says `QWEN_REASONING_MODEL`. Which is intended? If flash, the map's "Flash SIM uses the reasoning model" line is wrong and should be corrected. (Memory `[[engine-model-assignment]]` says read=omni-flash/fold=omni-plus but is silent on the text-SIM model.)
2. **Is the rubric critic ever going to ship?** It's ~390 LOC + dual-branch gate logic carried dark behind an env flag that defaults off and is documented as failing ~100%. Recalibrate-or-delete decision pending. (Memory `[[rubric-critic-deactivated]]` confirms deactivation but not the long-term plan.)
3. **`flashRunner` ToolRunner — confirm truly unreferenced** before cutting (grep for `flashRunner` / `runFlashRunner` usages outside tests).
4. **script + remix niche-blindness:** confirmed they bypass `resolveNicheKey`. Is that intentional (they were exempted from 14-01) or an oversight? If oversight, their SIM gate is niche-blind in production.
5. **`/api/remix/adapt` ownership:** does any live UI call it, or is it an orphan from the Lane-B remix flow? Determines whether the dual-route flag is real debt.
6. **Follow-up on critical path:** intentional that `done` waits on the follow-up chat stream? Cards are already painted; awaiting it just delays the completion signal.
7. **Two-audience Read SIM count:** runs 2 SIM calls serially or parallel? (`runTwoAudienceRead` — verify the two `readForAudience` calls aren't awaited sequentially; if serial, easy parallelize win.)
