# Phase 14: KC Grounding & Quality-Loop - Research

**Researched:** 2026-06-20
**Domain:** SIM-foresight gate + quality loop (Qwen text path) + voice grounding + corpus enrichment + honesty fix
**Confidence:** HIGH (every integration point read against live code; cited file:line throughout)

## Summary

This phase is **far more built than CONTEXT.md's framing implies** — the single most important research finding. CONTEXT.md (echoing the `kc-improvement-levers.md` audit from 2026-06-17) describes the text SIM as "niche-blind — `runFlashTextMode(text, framing)` can't receive a niche." That is **stale**. The niche-aware engine landed during Phase 7 (07-04): `runFlashTextMode` now takes a 3rd `panel?: NichePanel` param, builds the persona block via `buildNicheAwareSystemPrompt` → `selectPersonaSlots`, and the Ideas/Hooks/Script/Remix runners **already pass a panel** (`{ niche: profileRow?.niche_primary ?? null, contentType: null }`). The `~30% FYP/tough_crowd` weighting and `NICHE_INSTANTIATION` table are wired in `flash-prompts.ts:172-245`.

So **KCQ-06 is ~70% done at the engine layer.** The real, live root cause of the "all Mixed / flat 6/6/6/6/5" symptom is a **niche-slug resolution gap**, not missing wiring: `selectPersonaSlots` resolves the niche via `NICHE_TREE.find(p => p.slug === nicheSlug)` (`persona-registry.ts:436`). But `profileRow.niche_primary` is a free-text `z.string().max(64)` field (`creator-profile.ts:60`) captured in the interview (`profile-interview-store.ts:151`) and can be a **sub-slug** (`personal-finance`) or arbitrary prose — neither of which matches the 10 **top-level** taxonomy slugs that key `NICHE_INSTANTIATION` (`beauty, fitness, education, comedy, lifestyle, food-cooking, tech-gadgets, gaming, fashion-style, music-performance`). On a miss, `makeSlot` silently falls back to `"general TikTok"` + a generic `niche_instantiation` (`persona-registry.ts:437,509-510`) — reproducing the flat distribution. The levers-doc example ("finance ideas") is the tell: there is **no `finance` top-level niche** — finance is `education > personal-finance` (`taxonomy.ts:115`), so it never instantiated.

**Primary recommendation:** Reframe KCQ-06 as **"resolve niche_primary → a valid NICHE_INSTANTIATION key + re-validate the gate with a live slop-vs-strong run,"** NOT "wire persona-registry in" (already wired). The best-of-N loop (KCQ-02) and gate (KCQ-05) are also partly built — the Ideas/Hooks runners already over-generate → parallel-SIM → gate-drop-Weak → keep top-N. The genuinely new work: (a) niche resolution + threshold re-validation, (b) add a **Flash-critique-against-Value-Bar-rubric** stage (today's gate is a SIM stop/scroll band, not a rubric critique), (c) flop-pass reveal, (d) voice priority promotion, (e) the 26-template corpus fold-in, (f) delete the citation pills. All pure text-path + corpus + UI — **no `ENGINE_VERSION` bump** (the SIM-1 Max video path is untouched).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Niche resolution (KCQ-06) | API/Backend (engine lib) | Database (profile row) | `niche_primary` lives in `creator_profiles`; resolution is pure engine-lib logic |
| SIM gate / band (KCQ-05/06) | API/Backend (engine flash) | — | `runFlashTextMode` + `aggregateFlash` are Qwen-call + pure-reducer |
| Best-of-N critique (KCQ-02) | API/Backend (tool runners) | — | Ideas/Hooks runners orchestrate generate→SIM→critique |
| Flop-prediction pass (KCQ-04) | API/Backend (tool runners) | Browser (opt-in reveal) | Internal gate is backend; drill-to-reveal is a typed-renderer UI affordance |
| Voice calibration (KCQ-08) | API/Backend (kc assembler + corpus) | — | Priority reorder in `assembler.ts` + instruction in corpus slice |
| 26-template grounding (D-16) | API/Backend (corpus compile) | — | `hooks.md` → `compiled.ts` → `kc-version.ts`; private-reasoning only |
| Made-for-you rationale (KCQ-09) | Browser (card renderer) | API/Backend (grounding line) | Inline micro-copy on the card; data from existing `buildGroundingLine` |
| Citation-pill delete (HONESTY-01) | Browser (ExpertChatThread) | — | Pure client-render deletion |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Core tier (full depth) = SIM spine + grounding + loop + voice: KCQ-06 + KCQ-05 + KCQ-01 + KCQ-02 + KCQ-04 + KCQ-08. Pure pipeline — no new data infra.
- **D-02:** KCQ-06 → KCQ-05 is the moat spine and a HARD sequence. Formalizing the gate (KCQ-05) is pointless until KCQ-06 fixes niche-blindness + recalibrates thresholds. Build KCQ-06 first.
- **D-03:** SIM = quality/resonance GATE, not a ranker. Clears the slop floor + per-persona "why they scrolled" texture; does NOT finely order good ideas. Card leads with a sharp scroll-quote, not the fraction.
- **D-04:** Tail = thin KCQ-07 + KCQ-09; KCQ-08 promoted to core. KCQ-09 = thin inline "made-for-you" rationale (NOT source-citation).
- **D-05:** Best-of-N loop = PARALLEL over-generate (≈1× latency), Flash-critique against the Value Bar rubric, ship best passer.
- **D-06:** Conditional regeneration ONLY when ALL candidates fail the rubric floor (rare). No unbounded loop.
- **D-07:** N = 3.
- **D-08:** Critic model = SIM-1 Flash (`run-flash-text-mode.ts`). Independent judge beats self-critique.
- **D-09:** Loop scope = Ideas + Hooks ONLY. Excluded: Script, Test, Chat.
- **D-10:** KCQ-04 flop pass = internal filter + opt-in reveal. Internal gate kills/regenerates likely-floppers AND per-item predicted failure-mode available on drill/expand. No always-visible flop card; not silent-only.
- **D-11:** KCQ-08 in CORE, cheap. N1 voice sample already shipped (`d2f121e7`); `writing_voice_sample` is real + plumbed into `assembler.ts:111-115`.
- **D-12:** KCQ-08 work = prompt calibration not infra: (a) promote voice priority (stop dropping first), (b) explicit "write in this voice"/style-match instruction, (c) optionally few-shot the voice sample.
- **D-13:** Delete the fake `§N` citation pills in `ExpertChatThread.tsx`.
- **D-14:** Do NOT re-light citation pills. Template/corpus grounding used silently. HONESTY-01 = delete, full stop.
- **D-16:** Fold the owner's 26 ready hook templates into P14 as a THIN grounding addition (used silently — no pills). Concrete exemplar layer UNDER the `hooks.md` archetype table; ship via the compile pipeline (`hooks.md` → `compiled.ts` → `kc-version.ts` bump, byte-stable, tested).
- **D-17:** Templates feed PRIVATE REASONING, never emitted verbatim. Pattern inspiration, not output scaffolds. Primary surface = Hooks (+ Ideas where relevant).
- **D-18:** Map-before-merge. Eyeball the 26 against the archetype table before wiring. Owner shares the list at planning/execution.

### Claude's Discretion
- Exact rubric wording for the Flash critic (extend the existing Value Bar / BASE Test B).
- The precise threshold values from the slop-vs-strong recalibration.
- The inline-legibility (KCQ-09) micro-copy/placement.

### Deferred Ideas (OUT OF SCOPE — do NOT research depth)
- **D-15:** KCQ-03 live-exemplar RAG; its N2 cited-research pass; any large scraped/curated exemplar library beyond the owner's 26. Dormant retrieval stack (`_dormant/retrieval/`) exists but is untouched this phase.
- KCQ-08 deeper voice (own-transcript RAG) — usage-gated, deferred.
- KCQ-09 full field-legibility surface → P12 IA (only minimal inline in P14).
- Performance-feedback flywheel (lever #8) — its own track.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KCQ-01 | Live-profile grounding — gate must test *with* real profile + exemplars, not cold-start | Profile already flows to the gate via `niche_primary` panel + `assembler.ts`. Gap is niche-slug resolution, not profile loading. See §Pitfall 1 + Critical Verification 7 |
| KCQ-02 | Generate→critique→regenerate best-of-N w/ rubric, Ideas+Hooks only | Over-generate→parallel-SIM→gate-top-N already in `ideas-runner.ts:282-375` + `hooks-runner.ts:327-451`. Add Flash-critique-against-rubric stage. See §Pattern 2 |
| KCQ-04 | "Will this flop?" adversarial pass | New Flash framing or critique field; internal gate + opt-in reveal. See §Pattern 3 |
| KCQ-05 | SIM-rank verification loop — formalize the existing Flash gate | Gate exists (`aggregateFlash` + `band !== "Weak"`); formalize after KCQ-06. See §Pattern 1 |
| KCQ-06 | SIM niche-blind fix — wire persona-registry into text Flash | **~70% done** — wired in 07-04. Remaining: niche-slug resolution + threshold re-validation. See §Pattern 1 + Critical Verifications 1-3 |
| KCQ-07 | Runtime trope/specificity auto-reject (thin) | Corpus floor done (BASE Prohibition 6 + Value Bar Test B, `base.md:260,275-303`). Thin runtime = critique rubric reuse. See §Pattern 2 |
| KCQ-08 | Voice calibration | Voice plumbed but drops first under cap (`assembler.ts:112` MODE_ROLES tail). Reorder + add style instruction. See §Pattern 4 |
| KCQ-09 | Field-level legibility — made-for-you rationale (inline only) | `buildGroundingLine`/`buildAudienceGroundingLine` already produce a `whyItFits` line on cards. Surface inline micro-copy. See §Pattern 5 |
| HONESTY-01 | Delete fake §N citation pills | Exact deletion target identified: `ExpertChatThread.tsx:26-38,335-337,366-376`. See Critical Verification 9 |

## Critical Verifications (against live code)

### 1. KCQ-06 niche-blind state — CORRECTED

`runFlashTextMode` signature (`run-flash-text-mode.ts:89-94`):
```ts
export async function runFlashTextMode(
  content_text: string,
  framing: FlashFraming,
  panel?: NichePanel,                      // ← niche IS receivable (07-04)
  audienceRepaint?: Record<string, string>,
): Promise<FlashRunResult>
```
It resolves the system prompt (`run-flash-text-mode.ts:102-105`):
```ts
const systemPrompt =
  panel && panel.niche !== null
    ? buildNicheAwareSystemPrompt(panel, audienceRepaint)   // niche-instantiated
    : STABLE_FLASH_SYSTEM_PROMPT;                            // generic fallback
```
So the claim "uses a generic equal-weighted persona block and does NOT call persona-registry" is **FALSE as of 07-04**. `buildNicheAwareSystemPrompt` (`flash-prompts.ts:172-245`) calls `selectPersonaSlots(panel.contentType, panel.niche)` and encodes the ~30% FYP/tough_crowd weighting by slot repetition. `[VERIFIED: src/lib/engine/flash/run-flash-text-mode.ts:89-105, src/lib/engine/flash/flash-prompts.ts:172-245]`

The **only** path that still uses the flat block is when `panel.niche === null` — which happens when `profileRow.niche_primary` is null/empty OR (the live bug) when it's non-null but fails slug resolution downstream (see Verification 2). `[VERIFIED: src/lib/engine/wave3/persona-registry.ts:436-438,509-510]`

**Thresholds** (`flash-aggregate.ts:51,54`): `STRONG_THRESHOLD = 6`, `MIXED_THRESHOLD = 3`. Consumed in `aggregateFlash` (`flash-aggregate.ts:81-93`): `stops >= 6 → "Strong"`, `stops >= 3 → "Mixed"`, else `"Weak"`. Gate floor across all runners = `band !== "Weak"` (drop `< 3` stops). The in-file comment (`flash-aggregate.ts:45-48`) **asserts** "no recalibration needed; the key fix was the niche panel." This conflicts with CONTEXT.md's "never empirically set." Reconciliation: the thresholds were calibrated against a *fixture* (`slop-vs-strong.test.ts` HALF 1, pure/deterministic) and a `DASHSCOPE_API_KEY`-gated LIVE half (HALF 2) that **only runs with a real key** and uses a hardcoded `FITNESS_PANEL = { niche: "fitness" }`. If the live niche never resolves to `fitness` (the bug), the calibration was validated on a path production never hits. `[VERIFIED: src/lib/engine/flash/__tests__/slop-vs-strong.test.ts:176-214]`

### 2. persona-registry wiring path (KCQ-06) — root cause is slug resolution

`selectPersonaSlots(contentType, nicheSlug)` (`persona-registry.ts:431-495`):
- Inputs: `contentType: ContentTypeSlug | null`, `nicheSlug: string | null`.
- `const niche = nicheSlug ? NICHE_TREE.find((p) => p.slug === nicheSlug) : null;` (`:436`) — **exact top-level slug match**.
- On miss → `nicheLabel = "general TikTok"`, `resolvedNicheSlug = "general"` (`:437-438`), and per-slot `niche_instantiation` falls back to the generic `"You're part of the ... viewing audience"` (`:509-510`).
- `NICHE_INSTANTIATION` (`:238-362`) is keyed by the **10 top-level** taxonomy slugs only: `beauty, fitness, education, comedy, lifestyle, food-cooking, tech-gadgets, gaming, fashion-style, music-performance`. The latter 5 are all `[PLACEHOLDER]` cells.
- The text path builds its panel via `{ niche: profileRow?.niche_primary ?? null, contentType: null }` in all 4 runners (`ideas-runner.ts:283-284`, `hooks-runner.ts:312-313`, `script-runner.ts:273`, `remix-runner.ts:209`). `[VERIFIED: file:lines above]`

**The concrete gap:** `niche_primary` is free text (`creator-profile.ts:60`, `z.string().max(64)`) and the interview may store a sub-niche slug like `personal-finance` (`taxonomy.ts:115`). Neither matches a top-level key → generic fallback → flat scores. **KCQ-06's real task** is a niche-resolution function: `niche_primary → top-level NICHE_INSTANTIATION key` (map sub-slug → parent, normalize free text, or fall back to the cross-niche adjacency). Until that lands, the panel is effectively `null`-niche in production even though the wiring is complete. `[VERIFIED — cross-referenced taxonomy.ts:55-298 vs persona-registry.ts:238-362]`

### 3. Threshold recalibration method (KCQ-06)

Concrete, cheap, owner-runnable procedure (extends the existing test):
1. **Fixtures already exist** in `slop-vs-strong.test.ts:70-103` (SLOP_PERSONAS, STRONG_PERSONAS) for the pure half, and `:183-190` for the LIVE half (`SLOP_HOOK`, `STRONG_HOOK`). These live in the test file, not a separate fixtures dir.
2. **The regression gate** (`slop-vs-strong.test.ts`) asserts: `STRONG_THRESHOLD === 6`, `MIXED_THRESHOLD === 3`, slop band `=== "Weak"`, strong band `!== "Weak"`, and a `margin >= 3` discrimination gap (pure half, `:147-171`). The LIVE half asserts `strongStops - slopStops >= 2` (`:210`).
3. **Recalibration loop:** after the niche-resolution fix, run a small labeled set (≥5 known-slop, ≥5 known-strong items per niche) through `runFlashTextMode(hook, "idea"|"hook", resolvedPanel)` with `DASHSCOPE_API_KEY` set; record stop-counts; set STRONG/MIXED so slop lands `< MIXED` and strong lands `>= STRONG`. Owner-judge the labels. Keep the assertion-pair (`STRONG_THRESHOLD`/`MIXED_THRESHOLD` constants) in the test so any future drift fails loud.
4. **Byte-stability / score-identity preservation:** `selectPersonaSlots` is deterministic (no `Math.random`/`Date.now`, `persona-registry.ts:8-9`); `runFlashTextMode` uses `temperature: 0 + seed: QWEN_SEED` (`run-flash-text-mode.ts:122-125`). Same `{niche × contentType}` → byte-identical prompt → reproducible scores. Changing a threshold constant does NOT touch prompt bytes, so the cache prefix is unaffected. `[VERIFIED: file:lines above]`
   - **Note:** if recalibration changes which niches resolve (Verification 2 fix), the *General* (null-niche) path MUST stay byte-identical to preserve the 61/0 baseline — the fix should only ADD resolution for previously-unresolved niches, never alter the `STABLE_FLASH_SYSTEM_PROMPT` fallback.

### 4. Best-of-N loop (KCQ-02)

`run-flash-text-mode.ts` can absolutely double as the cheap critic (D-08) — it's a bounded single Qwen json_object call (`:107-120`). **But today's gate is NOT a rubric critique** — it's the SIM stop/scroll band (`aggregateFlash`). The two are different:
- **Existing (SIM-band gate):** `ideas-runner.ts:301-337` fires `runFlashTextMode(idea.seedHook, "idea", panel)` in `Promise.all` over ~5 candidates (IDEA_BUFFER=5, `:67`), drops `band === "Weak"`, keeps top 3 (MAX_SURVIVORS=3, `:70`). Hooks: `hooks-runner.ts:327-390`, HOOK_BUFFER=8, gate-then-RANK, MAX_HOOKS=5.
- **New (KCQ-02 Flash-critique-against-Value-Bar-rubric):** a *separate* critic call (or extended framing) that judges each candidate against the **Value Bar** (`base.md:275-303`): Test A (named mechanism), Test B (non-fakeable concrete), Test C (fit to this creator) + Prohibition 6 (not a niche trope, `base.md:260-272`). This is the rubric text to extend for the critic prompt. Ship-best-passer; regenerate ONLY if all 3 fail the rubric floor (D-06).
- **Where over-generation already exists:** the IDEA_BUFFER=5 / HOOK_BUFFER=8 over-generate-then-trim is exactly the P3/P4 "over-generate → gate → top-N" pattern. KCQ-02 inserts the rubric-critique *between* generate and gate (or replaces the SIM-band gate's drop logic with a rubric-pass + SIM-band combined criterion). `[VERIFIED: src/lib/tools/runners/ideas-runner.ts:64-70,282-375; hooks-runner.ts:60-64,327-451; .planning/corpus/base.md:260-303]`

**Open design choice for planner:** is the Flash critic (a) a 2nd Flash call per candidate (rubric-judge), doubling Flash cost but staying ≈1× wall-clock via `Promise.all`, or (b) an extended single Flash call returning both persona-verdicts AND a rubric-pass field? Option (b) is cheaper (one call) but couples gate + critique; option (a) keeps the independent-judge property D-08 prizes. Recommend **(a) parallel independent critic** — matches D-08 + the parallel-not-serial reframe (D-05), and the cost is cheap Flash tokens not wall-clock.

### 5. Flop pass (KCQ-04)

Mechanism: an **internal gate** that predicts each item's failure mode for this audience and kills/regenerates likely floppers, PLUS a per-item predicted failure-mode surfaced on drill/expand (D-10). Placement relative to best-of-N: it is the **negative twin** of the critique — where best-of-N picks the best passer, the flop-pass rejects predicted floppers. Cheapest implementation: **share the Flash critic call** — extend the rubric-critic to return both a `pass` verdict AND a `predictedFailureMode: string | null` (the "if this flops, here's why" texture). This avoids a 3rd call. The internal-gate behavior reuses the existing `band === "Weak"` drop; the *reveal* is a new optional field on the idea/hook card block consumed by the typed renderer (drill-to-expand). **Does it share the Flash critic call?** Recommend YES — one critic call returns `{ pass, failureMode }`; keeps cost at the KCQ-02 budget. `[VERIFIED: gate-drop pattern at ideas-runner.ts:336-337; card-block shape at tools/blocks.ts via IdeaCardBlockSchema]`

### 6. Voice calibration (KCQ-08)

`assembler.ts` MODE_ROLES (`:110-116`):
```ts
idea:   ["niche", "audience", "goals", "wins", "flops", "platform", "voice"],  // voice LAST
hooks:  ["niche", "audience", "platform", "wins", "flops", "voice"],            // voice LAST
script: ["niche", "audience", "platform", "wins", "flops", "voice"],            // voice LAST
remix:  ["niche", "audience", "platform", "wins", "flops", "voice"],            // voice LAST
chat:   ["niche", "audience", "platform"],                                       // voice EXCLUDED
```
Roles are dropped tail-first under `BUNDLE_CHAR_CAP = 4000` (`assembler.ts:53,279-285` — `keptProfile.pop()` from the tail). So voice is **"appended last, drops first under cap"** — CONFIRMED (`assembler.ts:111` comment + the pop loop). `[VERIFIED: src/lib/kc/assembler.ts:110-116,277-286]`

`writing_voice_sample` is a real populated field: `profile-role-map.ts:53`, `creator-profile.ts:60`, captured at `profile-interview-store.ts:185` (`return { writing_voice_sample: draft.voice.trim() || null }` — Card 9). `formatVoice` (`profile-role-map.ts:151-160`) wraps it in an injection fence with a "emulate STYLE/rhythm/tone only; do NOT reuse specific content" header. `[VERIFIED: file:lines above; N1 shipped d2f121e7 per CONTEXT D-11]`

**Three KCQ-08 changes, concrete landing points:**
- **(a) Promote voice priority** — reorder MODE_ROLES so `voice` is NOT last for idea/hooks/script/remix (`assembler.ts:110-116`). Recommend moving it ahead of `wins`/`flops`/`platform` so a routine cap-drop never silently removes it. **Caveat:** this changes the assembled bundle bytes → it changes the *user message* (volatile tier), NOT the cached system prompt, so cache discipline is preserved; but it WILL change generation output → not byte-stable for outputs (acceptable, it's a deliberate quality change, no ENGINE_VERSION bump since it's KC/text path).
- **(b) Style-match instruction** — strengthen `formatVoice` header (`profile-role-map.ts:154-156`) from "emulate the STYLE... only" to an explicit "Write in this voice: match its sentence rhythm, vocabulary register, and tone" directive. This is one string edit in the role formatter. Alternatively add it to the Hooks/Ideas corpus slice (`hooks.md`/`ideas.md` → recompile).
- **(c) Optional few-shot** — include the voice sample as a worked example in the user message. Lowest-risk place: extend `formatVoice` to frame the sample as "Example of my writing voice (match this style):". Already fenced; no new infra.

Recommend (a)+(b) as core, (c) as optional (D-12 marks it optional). `[VERIFIED: src/lib/kc/profile-role-map.ts:140-160]`

### 7. Live-profile grounding (KCQ-01)

"The gate must test WITH the real profile + exemplars, not cold-start" decodes, in live code, to: **the SIM gate currently runs with `panel.niche = profileRow?.niche_primary`** — so profile DOES flow in. It is NOT cold-start in the sense of "no profile loaded." The cold-start problem is the **niche-resolution miss** (Verification 2): even with a real profile, an unresolved niche → generic panel → the gate behaves as if cold-start. So KCQ-01 and KCQ-06 are the **same underlying fix** at the niche layer. `assembler.ts` already loads the full profile row into the generation bundle (`assembleBundle(input, profileRow)`) and the runners pass `profileRow` to both generation (`assembleBundle`) and the gate (`panel`). The "exemplars" half of KCQ-01 is the deferred RAG (D-15) — out of scope. **So KCQ-01 in P14 = ensure the gate's panel resolves a real niche (the KCQ-06 fix) + confirm the generation bundle is non-thin (already handled by `isProfileThin`, `assembler.ts:176-186`).** `[VERIFIED: src/lib/kc/assembler.ts:176-186,207-210; ideas-runner.ts:268-284]`

### 8. 26-template fold-in (D-16/17/18)

Compile pipeline (`compiled.ts:1-10` header + `scripts/regen-kc.ts`):
1. Edit `.planning/corpus/hooks.md` (357 lines; archetype table = private reasoning, never emitted — `hooks.md:6-7` header asserts the no-`[SLUG]`-leak discipline).
2. Run `npx tsx scripts/regen-kc.ts` → regenerates `src/lib/kc/compiled.ts` (`KC_HOOKS_SLICE` at `compiled.ts:587`, `KC_HOOKS_SYSTEM_PROMPT = KC_BASE + KC_HOOKS_SLICE` at `:1312`). Output is byte-deterministic (`regen-kc.ts:8-13`).
3. Bump `KC_GEN_VERSION` in `src/lib/kc/kc-version.ts` (currently `"gen.1.0.0"`) — a MINOR bump for a meaningful authoring update. NOTE: this is `KC_GEN_VERSION`, **decoupled from `ENGINE_VERSION`** (`kc-version.ts` header explicitly says do-not-import engine version).
4. Keep flash + kc tests green; the compiled output must stay structurally byte-stable (no interpolation).

**Where the 26 templates slot:** as a concrete exemplar block **UNDER the archetype table** in `hooks.md` (after the archetype/mechanism definitions, before/alongside the INTRA-BATCH DIVERSITY RULE near `hooks.md:327+`). Frame them as "concrete instances of the mechanisms above — use as pattern inspiration for private reasoning, NEVER emit verbatim or as fill-in-the-blank" (D-17), mirroring the existing "Hook Reasoning Scaffold → Clean Deliverable" discipline. `[VERIFIED: .planning/corpus/hooks.md:1-7,327-357; src/lib/kc/compiled.ts:1-10,587,1312; scripts/regen-kc.ts:1-49; src/lib/kc/kc-version.ts]`

**EXECUTION-TIME INPUT (flag for planner):** the owner's actual 26 templates are NOT in the repo. The planner must insert a `checkpoint:human-input` task — "owner provides the 26 hook templates" — before the fold-in task, and a map-before-merge review task (D-18). `[ASSUMED — templates not found in repo; owner-supplied per D-18]`

### 9. HONESTY-01

Exact deletion targets in `src/components/command-bar/ExpertChatThread.tsx`:
- `CORPUS_SECTIONS` map (`:26-38`) — the static fake-section tooltip map.
- `insertCitationMarkers(content)` (`:331-337`) — the `§(\d+)` → `` `§cite:$1` `` preprocessor; remove the function AND its call site (`:389` `{insertCitationMarkers(content)}` → `{content}`).
- The `§cite:` branch inside the `code` component (`:363-377`) — the coral-outline pill render. Remove the `if (text.startsWith('§cite:')) {...}` block; keep the real-code fallback (`:378-385`).
- Update the JSDoc header line (`:6`) that documents "§citation pills inline."

**Nothing else depends on it:** `CORPUS_SECTIONS` and `insertCitationMarkers` are file-local (no exports, no other importers — confirmed by grep, only self-references). `VALID_FRAMES` / `parseFrameTag` (`:40-43,402+`) is a SEPARATE feature (board-frame pills) — leave it intact. `[VERIFIED: grep across src/ shows §/cite/CORPUS_SECTIONS confined to ExpertChatThread.tsx]`

### 10. Regression gate + ENGINE_VERSION discipline

**Pure text-path (NO `ENGINE_VERSION` bump):** all of KCQ-01/02/04/05/06/07/08/09 + the 26-template fold-in + HONESTY-01. None touch `src/lib/engine/version.ts` (`ENGINE_VERSION = "3.19.0"`) or the SIM-1 Max video-scoring path (`pipeline.ts`/`fold.ts`/`aggregator.ts`). `run-flash-text-mode.ts` has HARD ISOLATION from those modules (`:11-13`). The 26-template fold-in bumps `KC_GEN_VERSION` (decoupled). `[VERIFIED: src/lib/engine/version.ts:127; run-flash-text-mode.ts:7-13; kc-version.ts header]`

**Anything that could touch Max video scoring:** NONE in this phase's scope. Caveat: `selectPersonaSlots` is shared between the text path AND the video path (`pipeline.ts:771`, `wave3.ts:105`). A KCQ-06 *niche-resolution* fix that modifies `selectPersonaSlots` or `NICHE_INSTANTIATION` table bytes COULD perturb the Max path's persona prompt → would require an `ENGINE_VERSION` bump + same-video score-identity check. **Recommendation:** implement niche-resolution as a NEW function (e.g. `resolveNicheKey(niche_primary)`) called at the *runner* layer before building the panel, NOT inside `selectPersonaSlots` — this keeps the shared engine function byte-identical and avoids any Max-path risk + ENGINE_VERSION bump. `[VERIFIED: src/lib/engine/pipeline.ts:771-772; src/lib/engine/wave3.ts:98-110]`

**Test suites that must stay green + commands:**
- `npm test` (= `vitest run`, `package.json:24`) — full suite.
- Flash suite: `npx vitest run src/lib/engine/flash` — `flash-aggregate.test.ts`, `flash-prompts.test.ts`, `flash-schema.test.ts`, `slop-vs-strong.test.ts`, `two-audience-read.test.ts`, `who-not-for.test.ts`.
- KC suite: `npx vitest run src/lib/kc` — `assembler.test.ts`, `__tests__/grounding-line.test.ts`.
- Runner suites: `npx vitest run src/lib/tools/runners` + `src/app/api/tools`.
- After any corpus edit: `npx tsx scripts/regen-kc.ts` then re-run flash+kc (61/0 baseline noted in source doc — the byte-stable assertion).
- `npm run build` + `npm run lint` before commit (CLAUDE.md). `[VERIFIED: package.json:12,14,24]`

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  Composer ask ──────────▶│  Ideas/Hooks runner (tool runner layer)     │
  + profileRow            │                                             │
  + active audience       │  1. resolveNicheKey(niche_primary) ◀── NEW  │  KCQ-06
                          │       → top-level NICHE_INSTANTIATION key    │  KCQ-01
                          │  2. assembleBundle(mode, profileRow)         │
                          │       voice promoted in MODE_ROLES ◀── KCQ-08│
                          │       → volatile user message                │
                          │  3. generate N candidates (Qwen reasoning)   │
                          │       N=5 ideas / N=8 hooks (over-generate)  │
                          └───────────────┬─────────────────────────────┘
                                          │ candidates[]
                          ┌───────────────▼─────────────────────────────┐
                          │  PARALLEL critique (Promise.all)             │
                          │  per candidate:                              │
                          │   ┌─────────────────────────────────────┐   │
                          │   │ runFlashTextMode(seed, framing,      │   │
                          │   │   panel={resolvedNiche, ct})         │   │  KCQ-06
                          │   │  → 10 niche-instantiated personas    │   │  (panel now
                          │   │  → aggregateFlash → band + fraction  │   │   resolves)
                          │   └─────────────────────────────────────┘   │
                          │   ┌─────────────────────────────────────┐   │
                          │   │ Flash rubric-critic (Value Bar):     │   │  KCQ-02
                          │   │  TestA mechanism / TestB concrete /  │   │  KCQ-07
                          │   │  TestC fit / Prohibition-6 trope     │   │  KCQ-04
                          │   │  → { pass, predictedFailureMode }    │   │  (shared call)
                          │   └─────────────────────────────────────┘   │
                          └───────────────┬─────────────────────────────┘
                                          │
                       ┌──────────────────▼──────────────────┐
                       │ GATE: band !== "Weak" AND rubric.pass│  KCQ-05
                       │  all candidates fail? → regenerate    │  (formalized
                       │  (conditional, rare — D-06)           │   gate)
                       └──────────────────┬──────────────────┘
                                          │ survivors (top 3 / top 5)
                       ┌──────────────────▼──────────────────┐
                       │ BUILD card blocks (typed renderer):  │
                       │  band + fraction + scrollQuote +     │  KCQ-09 (whyItFits inline)
                       │  whyItFits + predictedFailureMode    │  KCQ-04 (opt-in reveal on drill)
                       └─────────────────────────────────────┘

  Chat panel (ExpertChatThread): DELETE §cite pill render ◀── HONESTY-01 (independent, no gate)
```

### Pattern 1: Niche-resolution + gate formalization (KCQ-06 → KCQ-05)
**What:** Resolve `niche_primary` to a valid top-level `NICHE_INSTANTIATION` key at the runner layer, then formalize the existing `aggregateFlash` band as the named gate.
**When to use:** First (hard sequence D-02).
**Example:**
```ts
// Source: NEW function, lives at runner/lib layer (NOT inside selectPersonaSlots — keeps engine byte-stable)
// Maps free-text/sub-slug niche_primary → a top-level NICHE_INSTANTIATION key.
function resolveNicheKey(nichePrimary: string | null): string | null {
  if (!nichePrimary) return null;
  const norm = nichePrimary.trim().toLowerCase();
  // 1. direct top-level slug hit (beauty, fitness, ...)
  if (NICHE_INSTANTIATION[norm]) return norm;
  // 2. sub-slug → parent (walk NICHE_TREE children, e.g. personal-finance → education)
  const parent = NICHE_TREE.find(n => n.subItems?.some(s => s.slug === norm));
  if (parent && NICHE_INSTANTIATION[parent.slug]) return parent.slug;
  // 3. fuzzy/keyword fallback (free text) → nearest top-level, else null (generic, honest)
  return null;
}
// runner: const panel = { niche: resolveNicheKey(profileRow?.niche_primary ?? null), contentType: null };
```
**Why this lands where it does:** keeps `selectPersonaSlots`/`NICHE_INSTANTIATION` byte-identical → no ENGINE_VERSION bump, no Max-path risk (Verification 10).

### Pattern 2: Parallel best-of-N rubric critique (KCQ-02 + KCQ-07)
**What:** Insert a parallel Flash rubric-critic between generate and gate; ship best passer; regenerate only on all-fail.
**Source pattern:** extends the existing `Promise.all` SIM loop in `ideas-runner.ts:301-309` / `hooks-runner.ts:327-335`.
**Rubric source to extend:** `base.md:275-303` (Value Bar Test A/B/C) + `base.md:260-272` (Prohibition 6 trope test).
**Anti-pattern:** serial regeneration (the "2-4× latency" objection D-05 explicitly dissolves) — never loop serially; over-generate in parallel.

### Pattern 3: Shared-call flop pass (KCQ-04)
**What:** The same Flash rubric-critic returns `{ pass: boolean, predictedFailureMode: string | null }`. Internal gate uses `pass`; the card block carries `predictedFailureMode` for opt-in drill-reveal.
**When to use:** Same stage as KCQ-02 (one call, two uses — cheapest per owner instinct).

### Pattern 4: Voice priority promotion (KCQ-08)
**What:** Reorder `MODE_ROLES` so `voice` survives the cap-drop + strengthen the `formatVoice` style instruction.
**Where:** `assembler.ts:110-116` (order) + `profile-role-map.ts:154-156` (instruction).

### Pattern 5: Inline made-for-you rationale (KCQ-09, thin)
**What:** Surface the existing `whyItFits` grounding line as inline card micro-copy (e.g. "because your audience is X and your last wins were Y").
**Where:** `buildGroundingLine`/`buildAudienceGroundingLine` already produce the line (consumed at `ideas-runner.ts:315,351`). KCQ-09 = render it inline on the card via the fixed typed renderer (NOT model-generated UI — CLAUDE.md). Full surface deferred to P12.

### Anti-Patterns to Avoid
- **Modifying `selectPersonaSlots` or `NICHE_INSTANTIATION` bytes for KCQ-06** → perturbs the shared Max video path → forces ENGINE_VERSION bump + score-identity re-validation. Resolve niche at the runner layer instead.
- **Mad-libs / fill-in-the-blank from the 26 templates** (D-17) → the exact anti-slop enemy P2 fought. Private reasoning only.
- **Re-lighting citation pills** (D-14) → HONESTY-01 is delete-only.
- **Serial best-of-N regeneration** (D-05) → kills latency; parallel over-generate instead.
- **Model-generated card UI** (CLAUDE.md / REQUIREMENTS line 207) → use the fixed numen-rework typed renderer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Niche-instantiated personas | A new persona engine for text | `selectPersonaSlots` + `NICHE_INSTANTIATION` (already wired) | Exists, byte-stable, FYP-weighted; only needs slug resolution |
| Parallel over-generate→gate | A new pipeline | The existing `ideas-runner`/`hooks-runner` `Promise.all` + gate | Already ships N=5/N=8 over-generate + top-N trim |
| Critique rubric | New rubric prose | BASE Value Bar Test A/B/C + Prohibition 6 (`base.md:275-303`) | Owner-curated, gate-proven, byte-stable |
| Voice grounding | New profile field / scrape | `writing_voice_sample` + `formatVoice` (shipped N1) | Real populated field; only priority + instruction change |
| Corpus compile | Hand-edit `compiled.ts` | `npx tsx scripts/regen-kc.ts` | Generated file; hand-edits break byte-stability |
| Citation pill removal | Re-architect chat render | Delete 3 confined code regions | File-local, no dependents |

**Key insight:** P14's dominant risk is **re-building things that already exist** because CONTEXT.md/levers-doc describe a pre-07-04 codebase. The cheap+certain path (owner instinct) is: add the small missing seams (niche resolution, rubric-critic stage, voice reorder, template fold-in, pill delete) onto proven infra — not rebuild the SIM.

## Runtime State Inventory

> Refactor-adjacent: KCQ-06 niche-resolution + voice reorder change generation behavior, and the corpus fold-in re-stamps KC_GEN_VERSION. Inventory of non-file runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `creator_profiles.niche_primary` is free-text and may hold sub-slugs or prose that never resolved to a NICHE_INSTANTIATION key. Existing rows are unaffected by code change but will START resolving once `resolveNicheKey` lands. | None (code-only); optionally backfill/normalize niche_primary in a future data task — NOT required for P14 |
| Live service config | None — no external service stores P14-touched strings | None — verified: SIM runs in-process via DashScope/Qwen client |
| OS-registered state | None | None — verified: no scheduled tasks / daemons touch the text path |
| Secrets/env vars | `DASHSCOPE_API_KEY` gates the LIVE half of `slop-vs-strong.test.ts`; `FLASH_MODEL` env seam (`run-flash-text-mode.ts:47`) | None — recalibration needs the key present locally to run the LIVE half; no key rename |
| Build artifacts | `src/lib/kc/compiled.ts` is GENERATED from corpus; stale after a `hooks.md` edit if `regen-kc.ts` isn't re-run | Re-run `npx tsx scripts/regen-kc.ts` after the 26-template fold-in; verify byte-stable + tests green |

## Common Pitfalls

### Pitfall 1: Treating KCQ-06 as "wire persona-registry in" (it's already wired)
**What goes wrong:** Planner schedules an engine task to add panel-passing that already exists → wasted wave, possible byte-drift in the shared Max path.
**Why it happens:** CONTEXT.md + levers-doc describe the pre-07-04 state.
**How to avoid:** Scope KCQ-06 as **niche-slug resolution at the runner layer + threshold re-validation**. Read `run-flash-text-mode.ts:89-105` first.
**Warning signs:** A task that says "add a panel param to runFlashTextMode" — it's already there.

### Pitfall 2: Modifying the shared `selectPersonaSlots` and forgetting the Max path
**What goes wrong:** A niche-resolution fix inside `selectPersonaSlots` or `NICHE_INSTANTIATION` changes the video-path persona prompt bytes → silent Max-scoring regression + missing ENGINE_VERSION bump.
**Why it happens:** `selectPersonaSlots` is imported by both `pipeline.ts:771` (video) and the flash text path.
**How to avoid:** Implement `resolveNicheKey` as a NEW runner-layer function; pass the resolved key into the existing `{ niche, contentType }` panel. Leave the engine function byte-identical.
**Warning signs:** A diff touching `persona-registry.ts` lines 431-528 or 238-362.

### Pitfall 3: Threshold "already calibrated" claim vs live flat distribution
**What goes wrong:** Trusting `flash-aggregate.ts:45-48` ("no recalibration needed") and skipping KCQ-06's recalibration → gate still can't say "no" in production.
**Why it happens:** The calibration was validated against fixtures + a hardcoded `fitness` LIVE panel that production niches don't reach (the resolution bug).
**How to avoid:** Re-run the LIVE slop-vs-strong with `DASHSCOPE_API_KEY` AFTER the resolution fix, with the ACTUAL resolved niche, and confirm the margin holds.
**Warning signs:** All survivors land "Mixed" with the same fraction in a real run.

### Pitfall 4: Breaking the General (null-niche) 61/0 byte-stable baseline
**What goes wrong:** A voice reorder or corpus edit changes the `STABLE_FLASH_SYSTEM_PROMPT` / General-path bytes → cache miss + regression-gate fail.
**Why it happens:** The General path must stay byte-identical (D-17 cache + the 61/0 baseline).
**How to avoid:** Voice changes touch the *user message* (volatile tier) only; corpus changes go through `regen-kc.ts` + the byte-stable assertion. Keep `panel.niche === null` returning `STABLE_FLASH_SYSTEM_PROMPT` unchanged.
**Warning signs:** `flash-prompts.test.ts` or the byte-stable kc assertion fails.

### Pitfall 5: Serial best-of-N
**What goes wrong:** Implementing critique→regenerate as a serial loop → 2-4× latency, breaks the snappy UX.
**How to avoid:** Parallel over-generate (D-05); conditional regenerate only on all-fail (D-06).

## Code Examples

### Resolve niche at runner layer (KCQ-06, avoids Max-path risk)
```ts
// Source: derived from src/lib/engine/wave3/persona-registry.ts:431-510 + taxonomy.ts:55-298
// Called in ideas-runner.ts:283 / hooks-runner.ts:312 BEFORE building the panel.
const resolvedNiche = resolveNicheKey(profileRow?.niche_primary ?? null);
const panel = { niche: resolvedNiche, contentType: null } as const;
// resolvedNiche is now guaranteed to be a NICHE_INSTANTIATION key or null (honest generic fallback)
```

### Flash rubric-critic shape (KCQ-02 + KCQ-04 shared call)
```ts
// Source: extends base.md:275-303 (Value Bar) into a Flash json_object critic.
// One parallel call per candidate alongside the SIM band call.
interface RubricVerdict {
  pass: boolean;                       // Test A+B+C + Prohibition 6 all clear
  predictedFailureMode: string | null; // KCQ-04 opt-in reveal; null when pass
}
// Gate: keep candidate iff band !== "Weak" && verdict.pass
// Regenerate iff EVERY candidate fails (rare — D-06)
```

## State of the Art

| Old Approach (CONTEXT/levers framing) | Current Approach (live code, post-07-04) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runFlashTextMode(text, framing)` can't receive a niche | 3rd `panel` param + `buildNicheAwareSystemPrompt` wired | Phase 7 (07-04) | KCQ-06 reduces to niche-resolution + recalibration |
| Text SIM uses flat generic personas always | Niche-instantiated personas when `panel.niche` resolves | Phase 7 | Root cause is slug-miss, not missing engine |
| Gate is a one-pass self-judge | Over-generate → parallel SIM → gate top-N (Ideas/Hooks) | Phase 3/4 | KCQ-02 adds the rubric-critic layer on top |
| Voice not grounded | `writing_voice_sample` plumbed (drops first under cap) | N1 (`d2f121e7`) | KCQ-08 = priority + instruction only |

**Deprecated/outdated:**
- The levers-doc "niche-blind: `runFlashTextMode(text, framing)` can't receive a niche" line — outdated; the panel param shipped in 07-04.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The owner's 26 hook templates are not in the repo and must be owner-supplied at execution | Critical Verification 8 | LOW — confirmed absent by search; planner gates with a human-input checkpoint |
| A2 | `niche_primary` can in practice hold a sub-slug or free text (not just top-level slugs) | Critical Verification 2 | MEDIUM — the resolution fix is harmless if it's already top-level; verify with a quick prod-data spot-check (or assume worst case and resolve defensively) |
| A3 | Implementing `resolveNicheKey` at the runner layer (not inside `selectPersonaSlots`) avoids any ENGINE_VERSION bump | Critical Verification 10 + Pitfall 2 | LOW — verified the shared-import path; runner-layer resolution provably leaves engine bytes untouched |
| A4 | A shared Flash critic call returning `{pass, failureMode}` is cheaper than two separate calls and preserves D-08's independent-judge property | Critical Verification 5 | LOW — design choice; planner may split into two parallel calls if independence matters more than token cost |

**Note:** the 5-of-10 `NICHE_INSTANTIATION` niches are `[PLACEHOLDER]` cells (`persona-registry.ts:300-362`) — gaming, tech-gadgets, food-cooking, fashion-style, music-performance. For a creator in one of those, resolution succeeds but the instantiation text is a placeholder. If a P14 test niche falls in that set, the discrimination may stay weak — flag for the planner to either pick a non-placeholder niche for recalibration (beauty/fitness/education/comedy/lifestyle) or fill the placeholder as part of KCQ-06.

## Open Questions

1. **Does `niche_primary` actually store sub-slugs/free text in production rows?**
   - What we know: schema is `z.string().max(64)`; interview captures `draft.niche_primary`; taxonomy has top-level + sub slugs; the levers-doc "finance" example has no top-level match.
   - What's unclear: the exact distribution of stored values (no prod-data query run this session).
   - Recommendation: planner adds a 1-line spot-check (query distinct `niche_primary` values) as the first KCQ-06 task; resolve defensively regardless.

2. **KCQ-02 critic: one extended Flash call or two parallel calls?**
   - What we know: D-08 wants an independent judge; owner wants cheap.
   - What's unclear: whether coupling the SIM-band call with the rubric verdict degrades either.
   - Recommendation: default to a separate parallel rubric-critic call (independence + parallel = ≈1× latency); fall back to a single extended call if token budget is tight.

3. **Recalibration niche choice given placeholders.**
   - Recommendation: calibrate on a non-placeholder niche (fitness has the richest cells) or fill the relevant placeholder first.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `DASHSCOPE_API_KEY` | LIVE slop-vs-strong recalibration (KCQ-06) | unknown (env) | — | Pure/deterministic half runs without it; LIVE half skips |
| Qwen / DashScope (omni-flash, reasoning) | SIM gate + generation + critic | ✓ (in use) | per `qwen/client.ts` | none — core dependency, already wired |
| vitest | Regression gate | ✓ | ^4.0.18 (`package.json:109`) | — |
| `npx tsx` | `regen-kc.ts` corpus compile | ✓ | tsx present (scripts run) | — |

**Missing dependencies with no fallback:** none (all core deps in use).
**Missing dependencies with fallback:** `DASHSCOPE_API_KEY` for the LIVE recalibration half — pure-fixture half always runs; planner should ensure the key is present locally when running the recalibration task.

## Sequencing (wave structure for the planner)

Hard sequence (D-02): **KCQ-06 → KCQ-05**. Additional ordering derived from the code:

- **KCQ-01 ≡ KCQ-06** at the niche layer (Verification 7) — they are the same fix; do them together, FIRST. Recalibration (KCQ-06 step 2) MUST run AFTER niche resolution lands (so it calibrates with real resolved niches, not the generic fallback) — this is the "calibration needs real profiles" ordering the sequencing-note asks about: **YES**, profile/niche resolution must precede recalibration.
- **KCQ-02 depends on the recalibrated gate** — best-of-N's gate criterion combines `band !== "Weak"` (needs real discrimination) with the rubric verdict. Build after KCQ-06's recalibration so the SIM half of the gate actually discriminates.
- **KCQ-04 shares KCQ-02's critic call** — same wave as KCQ-02.
- **KCQ-05** (formalize the gate) — lands as the naming/wiring of the now-discriminating gate; effectively the closure of the KCQ-06→KCQ-02 chain.
- **KCQ-08 (voice), the 26-template fold-in (D-16), KCQ-07 (thin reject), HONESTY-01** are INDEPENDENT of the SIM chain — parallelizable in their own wave. (Caveat: the 26-template fold-in and KCQ-07 both touch `hooks.md`/corpus compile — serialize those two against each other to avoid byte-stability merge conflicts, or do both in one corpus pass + one `regen-kc.ts` run + one `KC_GEN_VERSION` bump.)
- **KCQ-09 (inline rationale)** — UI/card layer, depends on the card blocks the SIM chain produces; do after KCQ-02 builds the block shape (or in parallel since `whyItFits` already exists).

**Proposed waves:**
- **Wave 1 (the moat spine):** KCQ-06 niche-resolution + KCQ-01 (same fix) → KCQ-06 threshold recalibration (LIVE) → KCQ-05 gate formalization.
- **Wave 2 (quality loop):** KCQ-02 best-of-N rubric-critic + KCQ-04 flop pass (shared call) — depends on Wave 1.
- **Wave 3 (corpus + voice + honesty, parallel to/after Wave 1, independent of the SIM chain):** KCQ-08 voice promotion; 26-template fold-in (D-16) + KCQ-07 thin reject (one corpus pass, one compile, one version bump); HONESTY-01 pill delete.
- **Wave 4 (surface):** KCQ-09 inline made-for-you rationale on the typed-renderer cards.

## Project Constraints (from CLAUDE.md / REQUIREMENTS)

- **Qwen-only** pipeline — no Gemini/DeepSeek (REQUIREMENTS:206). The SIM + critic stay on Qwen/DashScope.
- **Honesty spine** — never present ungraded as graded; never fabricate a Flash score; degrade gracefully when profile/KC is thin (REQUIREMENTS:203). HONESTY-01 + the cold-start honest flag enforce this.
- **Fixed typed-renderer UI** — NOT model-generated UI (REQUIREMENTS:207). KCQ-09/KCQ-04 reveal use the numen-rework renderer library.
- **Flat-warm THEME-06** design SSOT; Raycast tokens (6% borders, 10% hover, 12px radius, coral accents) for any UI touch (HONESTY-01 pill area, KCQ-09 micro-copy).
- **Engine OPEN but regression-gated** — keep flash+kc suites green; bump `ENGINE_VERSION` only on deliberate Max video-scoring change (none in P14); bump `KC_GEN_VERSION` on corpus change.
- **CLAUDE.md:** read before edit; never save to root; files < 500 lines; validate input at boundaries (assembler already does); run tests after changes; verify build before commit; TDD-London where new code; never commit secrets (DASHSCOPE_API_KEY stays in env).
- **No `nyquist_validation`, no `security_enforcement`** (config.json:71,76 both `false`) — Validation Architecture and Security Domain sections omitted by config.

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/lib/engine/flash/run-flash-text-mode.ts` — runFlashTextMode signature + panel resolution
- `src/lib/engine/flash/flash-prompts.ts` — STABLE prompt, buildNicheAwareSystemPrompt, framing
- `src/lib/engine/flash/flash-aggregate.ts` — STRONG/MIXED thresholds + aggregateFlash
- `src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` — calibration regression gate
- `src/lib/engine/wave3/persona-registry.ts` — selectPersonaSlots, NICHE_INSTANTIATION, ALLOCATION_TABLE
- `src/lib/tools/runners/ideas-runner.ts`, `hooks-runner.ts` — over-generate→SIM→gate→top-N
- `src/lib/kc/assembler.ts` — MODE_ROLES, voice tail-drop, BUNDLE_CHAR_CAP
- `src/lib/kc/profile-role-map.ts` — formatVoice, niche role, writing_voice_sample
- `src/stores/profile-interview-store.ts` — voice + niche capture
- `src/components/command-bar/ExpertChatThread.tsx` — §cite pill render (deletion target)
- `.planning/corpus/base.md` — Value Bar Test A/B/C, Prohibition 6
- `.planning/corpus/hooks.md` — archetype table, fold-in slot, compile pipeline header
- `src/lib/kc/compiled.ts`, `src/lib/kc/kc-version.ts`, `scripts/regen-kc.ts` — compile pipeline
- `src/lib/niches/taxonomy.ts` — top-level vs sub slugs (niche-resolution root cause)
- `src/lib/schemas/creator-profile.ts`, `src/lib/engine/version.ts`, `package.json`, `.planning/config.json`

### Secondary (MEDIUM confidence)
- CONTEXT.md, REQUIREMENTS.md, ROADMAP.md, kc-improvement-levers.md (planning docs — some stale vs live code, flagged in State of the Art)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all integration points read at file:line; the stack is the existing in-repo engine/corpus
- Architecture: HIGH — the SIM/gate/runner flow traced end-to-end against live code; the niche-resolution root cause is verified by cross-referencing taxonomy vs instantiation keys
- Pitfalls: HIGH — each pitfall maps to a specific verified code fact (stale CONTEXT framing, shared-import Max path, fixture-vs-live calibration, byte-stable baseline)
- 26-template fold-in: MEDIUM — pipeline verified; the templates themselves are an execution-time owner input (A1)

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable in-repo code; re-verify if the flash/runner files change before planning)
