# Handoff — S3: single batched SIM call on flash (clean, lean, high-quality)

> Fresh-session handoff. Engine dissection, `~/virtuna-engine-rework` (`rework/engine-core`).
> Written 2026-06-24. Read this top-to-bottom before touching the engine.

---

## 0. Mission (one paragraph)

The Flash SIM is the 10-persona reaction engine that scores text content against the
audience. Today the **hooks** and **ideas** skills call it **once per candidate** in a
`Promise.all` fan-out (~8 and ~5 calls per run). Collapse that to **ONE batched call** that
scores all candidates in a single request, **staying on `qwen3.6-flash`** (no model change,
no `omni-plus`). Make it **clean, lean, and maximally high-quality on the flash tier** —
because this same SIM primitive powers the **ambient audience modal** (the `/api/tools/react`
path — the REACT position of the 3-position audience model, the moat surface users feel
directly). Efficiency win = ~8× fewer SIM calls on hooks/ideas; quality bar = the flash SIM
must stay diverse and well-formed, because it IS the audience experience.

**Locked decisions (from the session that produced this handoff):**
- ✅ **Model stays `qwen3.6-flash`** for the text SIM. Do NOT move it to omni-flash/omni-plus.
- ✅ **No A/B against the old per-candidate path.** The N-call fan-out is being replaced
  outright — do not build a "compare batched vs 8×" harness. (Validation that the batched
  call *works/parses/diverges* is still required — that's correctness, not a keep-the-old bake-off.)
- ✅ **Video skills: already on omni-flash by default** (`fold.ts` `FOLD_MODEL → qwen3.5-omni-flash`).
  Scope there = confirm/lock + maximize flash quality; there is NO per-candidate fan-out on
  the video side to collapse (one fold call per video). See §6.

---

## 1. Session state — what's already done (merge these FIRST)

This dissection lands one reviewable PR per item. Two PRs are open from the prior session and
should be **reviewed + merged before starting S3** (S3 rebaselines a regression gate; start clean):

| PR | Item | What | State |
|----|------|------|-------|
| **#37** | **S2** | Follow-up chat streams AFTER `done` (off the generative critical path). Server emits `done` right after cards persist; client flips `isStreaming=false` on `done`; followup streams in after. ideas/hooks/script/refine routes + use-{ideas,hooks,script}-stream. +ordering regression test. | **OPEN** |
| **#39** | **S4** | Cut the never-wired `ToolRunner`/`dispatchToolOutput`/`flashRunner` scaffolding. Deleted `tools/tool-runner.ts`; gutted `flash-runner.ts` → renamed **`runners/predicted-pin.ts`** (pin helper only). net −340 LOC. | **OPEN** |

Already merged to main this track: A1–A5 (audience weights + reconciles), S1 (niche-blind fix),
S5 (rubric-critic deletion). See `docs/DISSECTION-BACKLOG.md` DONE section.

> ⚠️ **Naming after #39 merges:** the file `src/lib/tools/runners/flash-runner.ts` becomes
> `src/lib/tools/runners/predicted-pin.ts` and its only export is `pinPredictedSignature` +
> the pin-context types. If #39 is NOT yet merged when you start, the file is still
> `flash-runner.ts`. Check before importing.

---

## 2. The current SIM path (ground truth — file:line)

**The primitive** — `src/lib/engine/flash/run-flash-text-mode.ts`
- `runFlashTextMode(content_text, framing, panel?, audienceRepaint?, intent?)` → fires ONE
  Qwen `json_object` call, returns `{ result: { personas: FlashPersona[10] }, warnings }`.
- Model: `FLASH_MODEL = process.env.FLASH_MODEL ?? QWEN_FAST_MODEL` (= `qwen3.6-flash`).
- Determinism: `temperature: 0` + `seed: QWEN_SEED`. Envelope: AbortController 60s timeout →
  `stripModelOutput` → `coerceFlashResponse` → `FlashResultSchema.safeParse`.

**The schema** — `src/lib/engine/flash/flash-schema.ts`
- `FlashPersonaSchema = { archetype: string, verdict: "stop"|"scroll", quote: 1–160 chars }`.
- `FlashResultSchema = { personas: FlashPersona[] }.length(10)` — **exactly 10**.
- `coerceFlashResponse(raw)` salvages small-model sloppiness (bare array, fenced JSON, verdict casing).

**The prompt** — `src/lib/engine/flash/flash-prompts.ts`
- `STABLE_FLASH_SYSTEM_PROMPT` — byte-stable cache prefix (all 10 archetype defs + output schema).
  **D-17 cache discipline: NEVER interpolate per-request data into the system prompt.**
- `buildNicheAwareSystemPrompt(panel, audienceRepaint?)` — niche-instantiated system prompt
  (folds `selectPersonaSlots` + per-audience repaint). `panel.niche === null` → returns the
  stable prompt (byte-identical no-op). **This is where audience calibration enters the SIM.**
- `buildFlashUserContent(text, framing, intent?)` — the volatile user message (content +
  per-framing question + band verbiage + optional `sell` lens). framing ∈ `hook|idea|chat`.

**The aggregate** — `src/lib/engine/flash/flash-aggregate.ts`
- `aggregateFlash(personas, weighting?)` → `{ band: Strong|Mixed|Weak, fraction: "N/10 stop" }`.
  A1 added optional per-slot `weighting` (calibrated audience → weighted stop-mass; General →
  `undefined` → flat count). **Leave this untouched** — it operates per-candidate's 10 personas.

**The callers (what fans out vs. what's already single):**
| Caller | file:line | Shape | S3 action |
|--------|-----------|-------|-----------|
| **hooks** | `hooks-runner.ts` `gateHooks` (~L360) | `Promise.all(hookBatch.map(runFlashTextMode))` — **N≈8 calls** | **collapse → 1 batched call** |
| **ideas** | `ideas-runner.ts` `gatePass` (~L335) | `Promise.all(ideaBatch.map(runFlashTextMode))` — **N≈5 calls** | **collapse → 1 batched call** |
| script | `script-runner.ts` (~L302) | single `runFlashTextMode(openingBeatSeed,…)` — N=1 | already single (no change, or batch w/ N=1) |
| remix | `remix-runner.ts` (~L224) | single `runFlashTextMode(chosen.hook,…)` — N=1 | already single (no change) |
| **react (ambient modal)** | `app/api/tools/react/route.ts:142` | single `runFlashTextMode(text,…)` + `aggregateFlash` | **N=1 — the quality bar; see §5** |

All callers build the niche panel + audience repaint via the shared
`buildReactionPanel(profileRow, audience)` (`flash/build-reaction-panel.ts`) and (for the
4 Flash runners) the per-slot weighting via `buildFlashWeighting(audience)` (`flash/persona-weighting.ts`).

---

## 3. Target design — batched single call

**New schema (`flash-schema.ts`):**
```
FlashBatchResultSchema = {
  candidates: [ { id: string, personas: FlashPersona[10] } ]   // length = N
}
```
- Add `coerceFlashBatchResponse(raw, expectedIds)` — same salvage spirit, nested:
  - tolerate `{candidates:[…]}` | bare array | fenced JSON;
  - **per-candidate salvage**: a malformed/short candidate drops ITSELF (the runner treats a
    missing/invalid candidate as a failed SIM → Weak/drop), never nukes the whole batch;
  - map back by `id` (model is told to echo the id); fall back to positional if ids drift.
- Keep `FlashResultSchema` (the N=1 primitive stays for react/script/remix).

**New prompt (`flash-prompts.ts`):**
- **Reuse the SAME 10-archetype system block** (`STABLE_FLASH_SYSTEM_PROMPT` /
  `buildNicheAwareSystemPrompt`) so the cache prefix + niche/repaint path are unchanged —
  only the OUTPUT-shape instruction + user message change.
- `buildFlashBatchUserContent(candidates: {id,text}[], framing, intent?)`:
  - list the N candidates, each clearly delimited with its `id`;
  - ask each of the 10 archetypes for a verdict+quote **per candidate**;
  - **independence directive** (critical for quality): "Judge each candidate on its own merits.
    The candidates are unrelated drafts — do NOT let one bias another, do NOT rank them, do NOT
    normalize across them. A weak candidate next to a strong one must still get its honest verdict."
  - restate the batched output schema (echo `id`, exactly 10 personas per candidate).

**New call fn (`run-flash-text-mode.ts`):**
- `runFlashTextModeBatch(candidates, framing, panel?, audienceRepaint?, intent?)` →
  `{ results: Map<id, FlashResult>, warnings }`. Same envelope (temp:0 + seed + json_object +
  strip + coerce + zod). One timeout (consider scaling vs. the 60s single-call budget — N×10
  personas is more output; measure).
- Keep `runFlashTextMode` (N=1) as-is for react/script/remix.

**Runner rewiring (`hooks-runner.ts`, `ideas-runner.ts`):**
- Replace the `Promise.all(map(runFlashTextMode))` with ONE `runFlashTextModeBatch(...)`.
- For each candidate: look up its `FlashResult` by id → `aggregateFlash(personas, flashWeighting)`
  (unchanged) → band gate (`band !== "Weak"`) → rank/trim (unchanged).
- **Preserve**: `generationIndex` ordering/tie-break, the FLYWHEEL pin (rank-1 candidate's
  personas via `pinPredictedSignature`), warnings aggregation, the conditional single regen
  (D-06: if ZERO survivors, regenerate once → one more batched call).
- A candidate missing from the batch result = failed SIM = dropped (mirrors today's per-call
  `.catch(() => null)`).

---

## 4. HARD constraints — do not skip

1. **ENGINE_VERSION bump.** Batching changes the SIM call → the per-candidate verdicts for a
   given hook MAY differ from the old isolated call. This is a deliberate scoring-path change.
   - `src/lib/engine/version.ts:127` — `ENGINE_VERSION = "3.19.0"` → bump (e.g. `3.20.0`).
   - Update `src/lib/engine/__tests__/version.test.ts` (pins the string) and
     `audience-regression-gate.test.ts` (asserts `ENGINE_VERSION === "3.19.0"` as a
     "no deliberate scoring change" guard — this guard is now intentionally tripped → update it
     with a comment explaining S3 is the deliberate change).
2. **Regression gate rebaseline.** The General/no-audience determinism gate
   (`src/lib/tools/runners/__tests__/steer-closure.test.ts`) pins SIM behavior. With a new call
   shape it must be **re-baselined to the batched call**, not deleted. The invariant to preserve:
   *General/no-audience still produces deterministic, weighting-free bands* (the moat-safety
   property), now via the batched path. Keep the audience-vs-General divergence property intact.
3. **Cache discipline (D-17).** The system prompt stays byte-stable per `{niche × contentType ×
   audience-repaint}`. Put the batch/independence framing + the candidate list in the USER
   message ONLY. Do not interpolate candidate text into the system prompt.
4. **Determinism.** Keep `temperature: 0` + `seed: QWEN_SEED`. Same N candidates in same order →
   same output.
5. **Honesty spine.** No fabricated numeric score/percentile/views — band + fraction only.

---

## 5. The ambient audience modal (why quality is non-negotiable)

`/api/tools/react` (`route.ts:142`) is the **REACT engine of the 3-position audience model**
(STEER / **REACT** / REFINE — see memory `audience-3-position-model`, `audience-manager-phase7`).
It's a single `runFlashTextMode` + `aggregateFlash` on the active calibrated audience — N=1, no
ENGINE_VERSION bump (text path). This is the **ambient audience modal** users interact with
directly: the calibrated audience is the moat substrate shared across every skill.

**Implication for S3:** the batched call is for hooks/ideas *efficiency*, but any prompt/schema
quality work you do (the independence directive, tighter persona framing, better coercion, leaner
tokens) should **also lift the N=1 react path** — they share `STABLE_FLASH_SYSTEM_PROMPT` /
`buildNicheAwareSystemPrompt`. Treat "make the flash SIM excellent" as the real goal; batching is
one expression of it. If a prompt change improves batched diversity, fold the safe parts back into
the shared system block so the ambient modal benefits too (re-validate the General gate).

**Do not regress the react path.** Keep `runFlashTextMode` (N=1) working and on the same shared
prompt. The ambient modal must stay fast (single bounded call) and high-fidelity.

---

## 6. Video skills (R1) — confirm/lock, do not over-reach

- `src/lib/engine/wave3/fold.ts:83-87` — `FOLD_MODEL` **already defaults to `qwen3.5-omni-flash`**
  (flipped from `omni-plus` 2026-06-11, harness-A/B'd: 5–6× faster, ~3.5× cheaper, diversity
  within ±0.x of omni-plus, audio retained). The old "omni-flash collapses to ~0 diversity"
  claim is documented in-file as **not reproducing** (was a bare-`JSON.parse` bug, since fixed).
- Memory note `engine-model-assignment` ("fold=omni-plus PAID / flash-fold WRONG") is **STALE** —
  correct it when you touch memory.
- **Action:** confirm omni-flash fold is solid (a fold-only smoke on 1 easy + 1 hard video is the
  cheap check — see memory `fold-validate-cheap-first`), and lock it. There is **no per-candidate
  fan-out** on the video side to collapse (one fold call per video). Don't invent batching here.
- `omni-plus` remains available via `FOLD_MODEL=omni-plus` (rollback only).

---

## 7. Sequenced plan

1. **Merge #37 + #39.** Start S3 from a clean main.
2. **Validation spike (needs a small live SIM budget — GET GREENLIGHT).** Prototype
   `buildFlashBatchUserContent` + `runFlashTextModeBatch` and run N=8 real hook candidates +
   N=5 idea candidates through `qwen3.6-flash`. Confirm: (a) valid batched JSON parses;
   (b) 10 personas per candidate; (c) **verdict diversity holds** (not all-stop/all-scroll, not
   identical across candidates); (d) candidates judged independently (inject one obviously-weak +
   one obviously-strong → bands diverge correctly). This de-risks the whole change. If diversity
   collapses or output truncates at N=8 → cap N (e.g. batches of 4) or tighten the prompt; record
   the finding. **No bake-off against the old 8× path — just prove the batched call is good.**
3. **Build** (one PR): schema + coercion → prompt → `runFlashTextModeBatch` → rewire
   hooks-runner + ideas-runner → ENGINE_VERSION bump → rebaseline steer-closure gate +
   version/regression tests → new unit tests for the batched coercion (per-candidate salvage,
   id-mapping, short/malformed candidate handling).
4. **Verify** (see §8) + a live E2E: one hooks run + one ideas run end-to-end on real Qwen
   (confirm cards still score + render); one react call (ambient modal unaffected).
5. **Backlog + memory:** mark S3 done in `docs/DISSECTION-BACKLOG.md`; correct the stale
   `engine-model-assignment` memory; note the new ENGINE_VERSION.

---

## 8. Verification — commands + gotchas

- **Tests (CRITICAL gotcha):** `npm test` / `npx vitest` print **fake PASS(0)/FAIL(0)** in this
  repo (rtk shim — memory `vitest-rtk-shim`). ALWAYS run:
  `node ./node_modules/vitest/vitest.mjs run [path]`
- **Full suite baseline:** ~3025 pass / 0 fail / 28 skip on current main (varies ±a few with the
  open PRs). Connection-refused-to-:3000 noise in output is a pre-existing artifact, not a failure.
- **tsc:** `npx tsc --noEmit` — **baseline is 64 errors** (all pre-existing, in test files +
  onboarding-store). "tsc net-zero" = still 64. Your changes must add 0.
- **The gate to watch:**
  `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners/__tests__/steer-closure.test.ts`
  (General-regression / audience-divergence). Plus `audience-regression-gate.test.ts` +
  `version.test.ts` (both pin ENGINE_VERSION — update intentionally).
- **eslint:** `npx eslint <files>` — keep clean.
- **Determinism check:** same candidates twice → identical bands (temp:0 + seed).

---

## 9. What NOT to do
- ❌ Don't change the SIM model off `qwen3.6-flash` (no omni-flash/omni-plus for text SIM).
- ❌ Don't build a batched-vs-8× comparison harness. The fan-out is dead; just make 1 call good.
- ❌ Don't slip the ENGINE_VERSION bump silently or delete the regression gate — rebaseline it.
- ❌ Don't interpolate candidate text into the system prompt (breaks the D-17 cache prefix).
- ❌ Don't regress or bypass the N=1 `react` path — the ambient modal rides it.
- ❌ Don't add batching to the video fold (no fan-out there; one fold per video).

## 10. Key file map (quick ref)
```
src/lib/engine/flash/run-flash-text-mode.ts   ← add runFlashTextModeBatch; keep N=1 fn
src/lib/engine/flash/flash-schema.ts          ← add FlashBatchResultSchema + coerceFlashBatchResponse
src/lib/engine/flash/flash-prompts.ts         ← add buildFlashBatchUserContent; reuse system block
src/lib/engine/flash/flash-aggregate.ts       ← UNCHANGED (per-candidate aggregate)
src/lib/engine/flash/build-reaction-panel.ts  ← UNCHANGED (panel + repaint)
src/lib/engine/flash/persona-weighting.ts     ← UNCHANGED (buildFlashWeighting)
src/lib/tools/runners/hooks-runner.ts         ← rewire gateHooks → 1 batched call
src/lib/tools/runners/ideas-runner.ts         ← rewire gatePass → 1 batched call
src/lib/tools/runners/predicted-pin.ts        ← FLYWHEEL pin (was flash-runner.ts pre-#39)
src/app/api/tools/react/route.ts              ← ambient modal; N=1; keep working, lift quality
src/lib/engine/version.ts:127                 ← ENGINE_VERSION bump
src/lib/engine/wave3/fold.ts:83               ← video fold (already omni-flash; confirm only)
docs/DISSECTION-BACKLOG.md                    ← S3 row + DONE; S6 (assertBlocksInRegistry orphan)
```

---

**First action in the fresh session:** confirm #37 + #39 are merged, then ask the user to
greenlight the §7-step-2 validation spike budget (small live `qwen3.6-flash` spend). Do not start
the build before the spike confirms the batched call holds diversity on flash.
