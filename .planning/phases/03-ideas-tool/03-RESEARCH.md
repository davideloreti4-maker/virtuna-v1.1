# Phase 3: Ideas Tool - Research

**Researched:** 2026-06-17
**Domain:** Product wiring — Ideas generation pipeline (KC grounding → Qwen generate → niche-instantiated text-SIM gate → typed `idea-card` blocks → in-thread chain) on the P1/P2 substrate. Engine sub-task: niche-instantiate the text Flash path (lever #10).
**Confidence:** HIGH (all signatures verified against current source; gaps flagged explicitly)

> **Provenance note:** Every claim below is tagged `[VERIFIED: <file>:<lines>]` (read in this session), `[CITED: <doc>]` (planning doc), or `[ASSUMED]` (training knowledge / inference). No external packages are introduced by this phase, so there is no Package Legitimacy Audit (see that section). Where a CONTEXT.md / levers-doc description conflicts with source, it is flagged `⚠️ CONFLICT`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Area 1 — Viability score (IDEAS-02, ENGINE-02):**
- **D-01:** SIM-1 Flash reacts to the **idea's seed hook** (KC emits exactly one seed hook per concept), ONE pass. Surfaced as a concept *ceiling* ("worth shooting?"), never an idea-quality verdict.
- **D-02:** Two bounded gates, ONE SIM pass: (1) KC self-rejection (generation-time, prose, BASE Value Bar) gates concept quality; (2) SIM hook-pull floor (one Flash pass) — card's seed hook must clear the recalibrated slop floor or the card is dropped. Same band drives the hidden gate AND the displayed hint.
- **D-03:** Bounded regeneration = over-generate (~5 for N=3) + filter; drop sub-floor cards; present survivors. **NO generate→critique→regenerate loop in v1** (that is deferred lever #3).
- **D-04:** Card leads with the **sharp per-persona scroll-quote** — SIM is a GATE, not a ranker. Band/fraction secondary. "All Mixed" is a valid gate answer.

**Area 2 — Niche-instantiate the text SIM (lever #10):**
- **D-05:** Thread niche/content-type into `runFlashTextMode`; build the persona panel via `selectPersonaSlots` (niche-true personas + ~30% FYP/tough_crowd weighting) instead of the generic `STABLE_FLASH_SYSTEM_PROMPT` block. Without this the gate is inert.
- **D-06:** Recalibrate `STRONG_THRESHOLD`/`MIXED_THRESHOLD`; prove the gate with a **slop-vs-strong test** (garbage must score clearly lower than a known-great idea). This is the acceptance check for the engine task.
- **D-07:** Text-path-ONLY change. SIM-1 Max (video) path untouched: engine suite green, same-video Max score-identity preserved, **`ENGINE_VERSION` NOT bumped**.

**Area 3 — Idea card anatomy + legible grounding (IDEAS-01, GROUND-03):**
- **D-08:** Concept-forward card face = title · angle · why-it-fits + lead scroll-quote. Behind expand: named mechanism, seed hook, Topic×Take×Format breakdown.
- **D-09:** Legible grounding = a dedicated, visually distinct line from REAL profile fields by semantic role ("Because: 18-25 gym beginners · last 3 myth-busts overperformed"), with honest cold-start fallback. NOT folded invisibly into angle prose.
- **D-10:** New `idea-card` typed block in the fixed registry carrying `{title, angle, whyItFits, mechanism, seedHook, needsTake, topic/take/format}` and embedding the band + scroll-quote. Validated at tool-runner boundary AND on rehydration. This is the shape Hooks replicates in P4.
- **D-11:** Visible "needs your first-hand take" badge on cards that lean on a take the creator must supply.

**Area 4 — Entry mode, volume, cold-start, chain (IDEAS-01, PROFILE-01, IDEAS-03, THREAD-05):**
- **D-12:** Auto vs seeded rides the universal composer: Idea chip + empty send → Auto; Idea chip + typed → seeded. Rides P1 D-06/D-07.
- **D-13:** N = 3 cards; over-generate ~5, gate to 3. (Exact buffer = planner's tuning call.)
- **D-14:** Cold-start → assembler degrades to universal craft + platform baseline; grounding line reads honestly. NEVER block Ideas behind onboarding.
- **D-15:** "Develop this →" appends Hooks below the idea in the SAME thread (THREAD-05); seeds the assembler `anchor` for the P4 Hooks call. (Hooks UI itself is P4 — Phase 3 ships CTA + in-thread chain seam + anchor handoff.)

### Claude's Discretion
- Exact over-generate buffer size + precise numeric slop-floor / `STRONG`/`MIXED` threshold values (tuning against the slop-vs-strong test).
- `idea-card` block exact prop names, expand interaction, grounding-line/badge visual treatment (THEME-06 flat-warm SSOT).
- Ideas API route shape + over-generate→gate→stream orchestration threading content-first (runner `stream?` seam reserved in P1).
- Internal signatures for threading niche/content-type into `runFlashTextMode` + `selectPersonaSlots` wiring.
- KC_GEN_VERSION stamping on persisted Ideas outputs (P1 deferred this to Phase 3).

### Deferred Ideas (OUT OF SCOPE)
- Generate→critique→regenerate quality loop (lever #3) — future phase.
- Real-exemplar retrieval / RAG (#1), performance-feedback flywheel (#8), creator-voice calibration (#7), flop-prediction adversarial pass (#6) — future phases.
- 4-outcome SIM model (stop + save/share/comment) — not v1 unless trivially free.
- Hooks UI (P4), open chat + Test reframe (P5), Scripts/Remix (v6.1).
- Profile redesign + social-handle scrape (v6.1) — Phase 3 reuses existing `creator_profiles` by semantic role.
- Per-card independent SIM concept-judgment (separate from the hook) — concept quality gated by KC self-rejection at generation time instead.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDEAS-01 | Generate ideas — cards (title · angle · why-it-fits) from profile (Auto) or seeded topic/angle, cold-start → baseline + degradation. | `assembleBundle({ask, platform, mode:"idea"}, profileRow)` already supports the full Ideas role set + cold-start. `KC_IDEAS_SYSTEM_PROMPT` compiled & byte-stable. Auto vs seeded = empty-vs-typed `ask`. (§Standard Stack, §Architecture P-2, §Pattern Cold-Start) |
| IDEAS-02 | Inline Flash viability hint — content-first, score streams in, never blocks content. | SSE pattern proven in `use-expert-chat.ts` + `analyze` route `ReadableStream`. Runner `stream?` seam reserved in `tool-runner.ts`. Content (cards) render on first frame; band/quote stream a beat later. (§Architecture P-4, §Pitfall 4) |
| IDEAS-03 | Chain to Hooks — "Develop this →" carries an idea into Hooks. | `assembleBundle` has the `anchor` field (verified). `insertMessage(threadId, role, blocks)` appends in-thread. P4 owns the Hooks UI; P3 ships the CTA + anchor handoff. (§Architecture P-6) |
| ENGINE-02 | SIM-1 self-judge quality gate — generations Flash-scored, weak filtered, regen bounded (over-generate + filter, NO loop). | `aggregateFlash` → band; floor = `band !== "Weak"` (or recalibrated stop-count). Bounded = one Flash pass per of ~5 candidates, no regen loop. (§Architecture P-3, §Pitfall 2) |
| GROUND-03 | Grounding legible in UI ("because your audience is 18-25 gym beginners…"). | ⚠️ **GAP**: current `PROFILE_ROLE_MAP` formatters emit GENERIC strings ("Past wins: 2 videos — steer toward…"), NOT the literal audience descriptors the example copy needs. A new by-role grounding-line extractor is required. (§Architecture P-5, §Pitfall 1, §Don't Hand-Roll) |
| PROFILE-01 | Ground on existing `creator_profiles` (9-card) + cold-start → platform baselines + graceful degradation. | `ProfileRow` + `PROFILE_ROLE_MAP` isolate column knowledge by semantic role. `isProfileThin()` drives cold-start. `niche_primary` already stores a `NICHE_TREE` primary slug = `NICHE_INSTANTIATION` key (clean niche thread-through). (§Architecture Map, §Pattern Cold-Start) |
| THREAD-05 | Chain CTAs in-thread ("Develop this →", "Test full →"). | `threads.ts` + `messages.ts` persistence in place; `insertMessage` appends a typed-block message to the same thread. (§Architecture P-6) |
</phase_requirements>

---

## Summary

Phase 3 is **predominantly a wiring + one engine sub-task phase**, not a greenfield build. Every major dependency already exists and is verified: the KC Ideas slice is authored and compiled (`KC_IDEAS_SYSTEM_PROMPT`), the grounding assembler (`assembleBundle`) already accepts `mode:"idea"`, `platform`, `anchor`, and cold-start; the tool-runner contract, typed-block registry with double-validation, thread/message persistence, the composer with a built-disabled Idea chip, and the SIM-1 Flash text path (`runFlashTextMode`) are all in place. There is even a working end-to-end prototype (`scripts/ideas-sim-rank.ts`) that does generate→SIM→rank exactly as the product runner will.

The **single highest-impact technical task** is lever #10 (D-05/D-06): the text Flash path currently fires ONE generic call (`STABLE_FLASH_SYSTEM_PROMPT` — all 10 flat archetypes, equal weight, no niche). The video path uses a *completely different, richer* machinery (`selectPersonaSlots` → niche-instantiated personas + FYP/tough_crowd weighting). The prototype's flat 6/6/6/6/5 distribution is the symptom: blindfolded judges. **Crucially, the niche thread-through is clean** — `creator_profiles.niche_primary` already stores a `NICHE_TREE` primary slug, and those 10 slugs are *exactly* the keys of `NICHE_INSTANTIATION`. So `selectPersonaSlots(contentType, profileRow.niche_primary)` wires with no taxonomy translation.

The **two real gaps** the planner must budget tasks for: (1) **GROUND-03 grounding line** — the existing `PROFILE_ROLE_MAP` formatters produce LLM-grounding prose ("Past wins: 2 videos — steer toward…"), not the human-facing audience descriptor the card needs; a new by-role extractor returning structured `{audience, wins, niche}` text fragments is required. (2) **Threshold calibration** — `STRONG_THRESHOLD=6`/`MIXED_THRESHOLD=3` were never empirically set; the slop-vs-strong test (D-06) is the acceptance gate and may require retuning after the niche personas land (niche-true personas + tough_crowd weighting will lower scores, so the floor likely moves).

**Primary recommendation:** Sequence as three waves. **Wave A (engine, isolated):** niche-instantiate the text SIM behind a new optional param on `runFlashTextMode`, add the slop-vs-strong calibration test, verify `ENGINE_VERSION` unchanged + suite green. **Wave B (grounding + block, parallel-safe):** add the `idea-card` block to the registry (write + rehydration validation) + the GROUND-03 grounding-line extractor + KC_GEN_VERSION stamping. **Wave C (pipeline + UI):** the Ideas API route (over-generate→gate→stream, content-first), the composer chip flip + Auto/seeded routing, the in-thread "Develop this →" chain seam.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Idea concept generation | API / Backend (Qwen call) | KC slice (compiled prompt) | `KC_IDEAS_SYSTEM_PROMPT` is the cached system prefix; `assembleBundle` produces the volatile user message — both server-side, never client. [VERIFIED: src/lib/kc/compiled.ts:1063, src/lib/kc/assembler.ts:196] |
| Niche-instantiated SIM scoring | API / Backend (engine) | — | The Flash call + `selectPersonaSlots` are engine modules; must run server-side (DashScope key). [VERIFIED: src/lib/engine/flash/run-flash-text-mode.ts:76] |
| Self-judge gate (drop sub-floor) | API / Backend | — | Filtering happens server-side before any card reaches the client (ENGINE-02: "before the creator sees them"). [CITED: REQUIREMENTS.md ENGINE-02] |
| Grounding-line extraction | API / Backend | DB (creator_profiles) | Reads the profile row by semantic role server-side; the card carries the finished string. [VERIFIED: src/lib/kc/profile-role-map.ts] |
| Idea-card rendering | Browser / Client | Fixed renderer registry | Typed block → React component via `MessageBlocks`; no model-generated UI. [VERIFIED: src/components/thread/message-blocks.tsx:33] |
| Content-first streaming | API (SSE producer) + Client (SSE consumer) | — | `ReadableStream` server-side, `use-expert-chat`-style reader client-side. [VERIFIED: src/hooks/queries/use-expert-chat.ts:118] |
| Composer chip selection + Auto/seeded routing | Browser / Client | — | `activeTool` state + `ask` string drive the request; pure client UI. [VERIFIED: src/components/app/home/composer.tsx:78] |
| In-thread chain persistence | API / Backend | DB (threads/messages) | `insertMessage` / thread helpers are server-side with service-client + RLS. [VERIFIED: src/lib/threads/messages.ts:73] |
| KC_GEN_VERSION stamping | API / Backend | DB (messages) | Stamp lands on the persisted message/block metadata; first phase persisting generative output. [VERIFIED: src/lib/kc/kc-version.ts:26] |

---

## Standard Stack

This phase introduces **no new external packages**. It composes existing internal modules. The "stack" is the verified internal API surface.

### Core (existing internal modules — all verified this session)

| Module | Path | Purpose | Verified Signature / Export |
|--------|------|---------|------------------------------|
| KC Ideas prompt | `src/lib/kc/compiled.ts` | Byte-stable cached system prefix for Ideas generation. | `export const KC_IDEAS_SYSTEM_PROMPT = \`${KC_BASE}\n\n---\n\n${KC_IDEAS_SLICE}\`` [VERIFIED: compiled.ts:1063] |
| Grounding assembler | `src/lib/kc/assembler.ts` | Per-request volatile user message (live grounding). | `assembleBundle(input: AssemblerInput, profileRow: ProfileRow \| null): string`; `AssemblerInput = {ask, platform: "tiktok"\|"instagram"\|"youtube", mode: "idea"\|"hooks"\|"chat", overrides?, anchor?}` [VERIFIED: assembler.ts:81-89,196] |
| Profile role map | `src/lib/kc/profile-role-map.ts` | Column knowledge isolated by semantic role. | `PROFILE_ROLE_MAP: Record<Role, (row: ProfileRow) => string \| null>`; `Role = "niche"\|"audience"\|"goals"\|"wins"\|"flops"\|"platform"` [VERIFIED: profile-role-map.ts:148,32] |
| Flash text-mode | `src/lib/engine/flash/run-flash-text-mode.ts` | One bounded Qwen json_object call → 10 persona verdicts+quotes. | `runFlashTextMode(content_text: string, framing: FlashFraming): Promise<FlashRunResult>` — **NO niche param today** (D-05 adds it) [VERIFIED: run-flash-text-mode.ts:76] |
| Flash aggregate | `src/lib/engine/flash/flash-aggregate.ts` | 10 verdicts → `{band, fraction}`. | `aggregateFlash(personas: FlashPersona[]): {band:"Strong"\|"Mixed"\|"Weak", fraction:string}`; `STRONG_THRESHOLD=6`, `MIXED_THRESHOLD=3` (exported, tunable) [VERIFIED: flash-aggregate.ts:26,29,56] |
| Persona slots | `src/lib/engine/wave3/persona-registry.ts` | Niche-instantiated 10-slot panel (the video machinery). | `selectPersonaSlots(contentType: ContentTypeSlug \| null, nicheSlug: string \| null): PersonaSlot[]`; `NICHE_INSTANTIATION: Record<string, Partial<Record<Archetype,string>>>`; `ALLOCATION_TABLE` (FYP/tough_crowd weighting) [VERIFIED: persona-registry.ts:431,238,385] |
| Flash runner | `src/lib/tools/runners/flash-runner.ts` | ToolRunner + `runFlashRunner`/`mapFlashResultToBlocks`. | `runFlashRunner(content_text, framing): Promise<{bandBlock, personasBlock, warnings}>`; `flashRunner.id = "hooks"` ⚠️ (Ideas adds "idea"); `renderer: ["band","personas"]` [VERIFIED: flash-runner.ts:59-60,97] |
| Tool-runner | `src/lib/tools/tool-runner.ts` | THREAD-06 contract + dispatch. | `dispatchToolOutput<TOut>(runner, modelOutput): OutputBlock[]`; `ToolRunner.id: "test"\|"idea"\|"hooks"\|"chat"`; `stream?: boolean` (reserved) [VERIFIED: tool-runner.ts:37,73,94] |
| Block registry | `src/lib/tools/block-registry.ts` | SSOT type→schema + double-validation. | `BLOCK_REGISTRY = {markdown, band, personas}`; `validateBlock(raw)`, `assertBlocksInRegistry(blocks, allowed)` [VERIFIED: block-registry.ts:22,34,57] |
| Block schemas | `src/lib/tools/blocks.ts` | Zod schemas + types. | `BandBlockSchema`, `PersonasBlockSchema`, `MarkdownBlockSchema`, `BlockUnionSchema` [VERIFIED: blocks.ts] |
| Thread persistence | `src/lib/threads/threads.ts` | Grounded/open thread fetch + lazy create. | `createGroundedThreadLazy(readingId, userId)`, `getThread(id)`, `getOpenThread(userId)` [VERIFIED: threads.ts:54,102,125] |
| Message persistence | `src/lib/threads/messages.ts` | Validated typed-block message rows. | `insertMessage(threadId, role:"user"\|"assistant"\|"tool", blocks: unknown[]): Promise<MessageRow>`; `loadMessages(threadId): Promise<HydratedMessage[]>` [VERIFIED: messages.ts:73,123] |
| KC version | `src/lib/kc/kc-version.ts` | Generative content version (decoupled from ENGINE_VERSION). | `export const KC_GEN_VERSION = "gen.1.0.0"` — stamping wiring DEFERRED to this phase [VERIFIED: kc-version.ts:26] |
| Engine version | `src/lib/engine/version.ts` | Protected video-scoring version. | `export const ENGINE_VERSION = "3.19.0"` — **must NOT change** (D-07) [VERIFIED: version.ts:127] |
| Qwen client | `src/lib/engine/qwen/client.ts` | DashScope OpenAI-compatible client. | `getQwenClient()`, `QWEN_REASONING_MODEL="qwen3.7-plus"`, `QWEN_FAST_MODEL="qwen3.6-flash"`, `QWEN_SEED=7` [VERIFIED: client.ts:7,41,42,28] |

### Supporting (UI + reference)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| Composer | `src/components/app/home/composer.tsx` | Universal door; holds `activeTool` state, `ToolChips`, submit loop. | Chip flip + Auto/seeded send routing (D-12). [VERIFIED: composer.tsx:78] |
| Tool chips | `src/components/app/home/tool-chips.tsx` | Chip row; Idea chip `enabled:false`. | Flip `idea` to `enabled:true` (D-12). [VERIFIED: tool-chips.tsx:44] |
| SSE consumer | `src/hooks/queries/use-expert-chat.ts` | Reference SSE reader (`event:`/`data:` frame loop). | Model the Ideas content-first stream consumer on this. [VERIFIED: use-expert-chat.ts:118-169] |
| Message renderer | `src/components/thread/message-blocks.tsx` | Maps block body → renderer components. | Add `idea-card` to `BLOCK_COMPONENTS` (mirror band/personas). [VERIFIED: message-blocks.tsx:22] |
| Band/Personas renderers | `src/components/thread/band-block.tsx`, `personas-block.tsx` | Existing Flash renderers (zone tokens, model tag, distinct Flash styling). | The `idea-card` embeds/reuses these patterns (D-10). [VERIFIED: band-block.tsx:1-40] |
| Niche taxonomy | `src/lib/niches/taxonomy.ts` | 10-primary niche tree; slugs = NICHE_INSTANTIATION keys. | Source of the niche slug for D-05 thread-through. [VERIFIED: taxonomy.ts:55,82,111] |
| Prototype | `scripts/ideas-sim-rank.ts` | Working generate→SIM→rank loop. | The blueprint the production runner formalizes; lift its stage structure. [VERIFIED: ideas-sim-rank.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `idea-card` block embedding band+quote | Reuse separate `band` + `personas` blocks per card | Rejected — D-10 locks a single self-contained card block so Hooks (P4) replicates one shape; separate blocks fragment the card face and break the scannable list. |
| `selectPersonaSlots` niche thread-through | Keep generic `STABLE_FLASH_SYSTEM_PROMPT`, just retune thresholds | Rejected — the levers SIM audit proved the flatness is *blindfolded judges*, not threshold miscalibration; retuning a niche-blind judge cannot create discrimination. [CITED: kc-improvement-levers.md SIM audit] |
| SSE streaming for the band/quote | Return-whole (block until SIM done) | Rejected by IDEAS-02 (content-first). But return-whole is the simpler fallback if SSE proves fiddly — see §Open Questions. |

**Installation:** None. `npm install` adds nothing for this phase.

**Version verification:** N/A — no external packages. All models resolve via env-overridable constants already in `qwen/client.ts` [VERIFIED: client.ts:36-50].

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — it composes existing internal modules only (verified: no new `npm install` in scope; the Ideas pipeline reuses Qwen client, KC, engine, tool-runner, and thread modules already in the tree). No SLOP/SUS/OK verdicts to render.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPOSER (client)  src/components/app/home/composer.tsx                        │
│   activeTool="idea"  +  ask (empty → Auto | typed → seeded)  +  platform chip │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                    │ POST { ask, platform, mode:"idea" }  (NEW route)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ IDEAS API ROUTE (server, NEW)  e.g. src/app/api/tools/ideas/route.ts          │
│  1. auth + load creator_profiles row (by session user_id)                     │
│  2. assembleBundle({ask, platform, mode:"idea"}, profileRow) → user message   │
│        system = KC_IDEAS_SYSTEM_PROMPT (cached)                                │
│  3. Qwen generate (QWEN_REASONING_MODEL) → OVER-GENERATE ~5 ideas              │
│        (separator-delimited; mirror scripts/ideas-sim-rank.ts parsing)        │
│        ── content frame emitted here ──►  (cards render, score pending)        │
│  4. per candidate: extract seed hook → runFlashTextMode(hook, "idea", niche)  │
│        (niche = profileRow.niche_primary → selectPersonaSlots)   [D-05]        │
│        → aggregateFlash → {band, fraction, scrollQuotes}                       │
│  5. GATE: drop band==="Weak" (or recalibrated floor)  [D-02/D-03 ENGINE-02]    │
│  6. keep top 3 survivors  [D-13]                                               │
│  7. grounding-line extractor(profileRow, roles) → whyItFits  [D-09 GROUND-03]  │
│  8. build idea-card blocks (embed band + lead scroll-quote)  [D-10]            │
│  9. validateBlock each → insertMessage(threadId,"assistant",blocks)            │
│        + stamp KC_GEN_VERSION on message metadata                              │
│        ── score frame(s) streamed per card ──►                                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                    │ SSE: content event, then per-card score events
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ THREAD VIEW (client)  MessageBlocks → IdeaCardRenderer (NEW)                   │
│   face: title · angle · whyItFits + lead scroll-quote   [D-08/D-04]            │
│   expand: mechanism · seedHook · Topic×Take×Format · "needs your take" badge   │
│   band/fraction stream in a beat after the card face  [D-04 secondary]         │
│   CTA "Develop this →"  → appends Hooks msg in SAME thread, seeds anchor [D-15]│
└─────────────────────────────────────────────────────────────────────────────┘

  PROTECTED (untouched, D-07):  pipeline.ts → runFold → SIM-1 Max video scoring
  shares selectPersonaSlots + NICHE_INSTANTIATION but via a SEPARATE call path.
```

### The two persona engines (the crux of D-05)

[VERIFIED] There are genuinely two distinct SIM machineries, and the text path uses the weak one:

| | **Video path (Test / SIM-1 Max)** | **Text Flash (Ideas / Hooks) — TODAY** |
|---|---|---|
| Entry | `runFold(foldSlots, …)` [VERIFIED: fold.ts:305] | `runFlashTextMode(content_text, framing)` [VERIFIED: run-flash-text-mode.ts:76] |
| Personas | `selectPersonaSlots(content_type, niche)` → 10 niche-instantiated `PersonaSlot`s [VERIFIED: pipeline.ts:771-775] | ONE generic `STABLE_FLASH_SYSTEM_PROMPT` with all 10 flat `ARCHETYPE_DEFINITIONS`, equal weight [VERIFIED: flash-prompts.ts:67-117] |
| System prompt | per-slot `buildPersonaSystemPrompt(slot)` carrying `slot.niche_instantiation` [VERIFIED: persona-prompts.ts:38-62] | byte-stable generic block, no niche [VERIFIED: flash-prompts.ts:117] |
| Weighting | `ALLOCATION_TABLE` row → FYP/tough_crowd ~30% [VERIFIED: persona-registry.ts:385-394] | none — all 10 equal |
| Niche input | yes (`wave0Result.niche.primary_slug`) [VERIFIED: pipeline.ts:774] | **none** — signature can't receive it |
| Call shape | ONE thinking call, 10 archetypes in one response | ONE json_object call, 10 archetypes in one response |

**Key wiring insight for the planner:** Both paths fire ONE call with all 10 archetypes — they do NOT differ in call count. The difference is purely *what's in the prompt*: niche-instantiated persona text + weighted allocation vs. flat generic. So D-05 does **not** require N parallel calls; it requires rebuilding `STABLE_FLASH_SYSTEM_PROMPT` (or a niche-aware variant) from `selectPersonaSlots(contentType, niche)` output. The text path stays one bounded call. ⚠️ **CONFLICT with a possible reading of the levers doc:** the audit says "build the panel via `selectPersonaSlots`" which the video path does as a 10-slot array, but the Flash path must *fold those 10 slots into ONE system prompt's archetype block* (since Flash is a single multi-persona call), not fan out to 10 calls. This is the one non-obvious adaptation.

### Niche thread-through is CLEAN (verified)

[VERIFIED] `creator_profiles.niche_primary` stores `branch.slug` from `NICHE_TREE` (niche-picker.tsx:58 `onChange({ primary: branch.slug })`). The 10 `NICHE_TREE` primary slugs (`beauty, fitness, education, comedy, lifestyle, food-cooking, tech-gadgets, gaming, fashion-style, music-performance` [VERIFIED: taxonomy.ts]) are **exactly** the keys of `NICHE_INSTANTIATION` [VERIFIED: persona-registry.ts:238-362]. So:

```ts
// D-05 niche source — no taxonomy translation needed:
const niche = profileRow?.niche_primary ?? null;   // already a NICHE_INSTANTIATION key
selectPersonaSlots(contentType, niche);            // niche-true personas
```

**`contentType` for the text path:** There is no Wave0 content-type for a text idea (no video to classify). `ContentTypeSlug = "talking_head"|"b_roll"|"slideshow"|"action"|"tutorial"|"vlog"|"comedy"|"other"` [VERIFIED: types.ts:693-703]. `selectPersonaSlots(null, niche)` falls back to the `other` allocation row (6/2/1/1) [VERIFIED: persona-registry.ts:435 `ALLOCATION_TABLE[contentType ?? "other"]`]. **Recommendation:** pass `null` content-type for Ideas v1 (the idea may map to a FORMAT/SHOOT cue the KC emits, but mapping that to a `ContentTypeSlug` is fragile — defer to a discretion call; `other` is the honest neutral baseline and still delivers niche-true personas + tough_crowd weighting, which is the whole point of D-05).

### Recommended Project Structure (new files)

```
src/app/api/tools/ideas/route.ts        # NEW — the Ideas pipeline route (SSE)
src/lib/tools/runners/ideas-runner.ts   # NEW — over-generate→gate→cards orchestration (or fold into route)
src/lib/kc/grounding-line.ts            # NEW — GROUND-03 by-role human-facing extractor
src/lib/tools/blocks.ts                 # EDIT — add IdeaCardBlockSchema
src/lib/tools/block-registry.ts         # EDIT — register "idea-card"
src/components/thread/idea-card-block.tsx  # NEW — the card renderer
src/components/thread/message-blocks.tsx   # EDIT — add idea-card to BLOCK_COMPONENTS
src/lib/engine/flash/flash-prompts.ts   # EDIT — niche-aware system prompt builder (D-05)
src/lib/engine/flash/run-flash-text-mode.ts  # EDIT — optional niche param (D-05)
src/lib/engine/flash/__tests__/slop-vs-strong.test.ts  # NEW — D-06 calibration gate
src/components/app/home/tool-chips.tsx  # EDIT — flip idea chip enabled:true
src/components/app/home/composer.tsx    # EDIT — Auto/seeded routing for idea chip
```

### Pattern 1: Niche-aware Flash system prompt (D-05)

**What:** Fold `selectPersonaSlots` output into the single Flash system prompt's archetype block, keeping it byte-stable per `{niche × contentType}` tuple (cache discipline).
**When to use:** The text SIM path only — never the video fold path.
**Approach (verified against source):**

```ts
// run-flash-text-mode.ts — add an optional niche/contentType param (back-compat default null):
export async function runFlashTextMode(
  content_text: string,
  framing: FlashFraming,
  panel?: { niche: string | null; contentType: ContentTypeSlug | null },  // D-05
): Promise<FlashRunResult> { ... }

// flash-prompts.ts — build the archetype block from slots when a panel is supplied:
//   const slots = selectPersonaSlots(panel.contentType, panel.niche);
//   archetypeBlock = slots.map(s => `### ${s.archetype}\n${s.niche_instantiation}\n` +
//     `Scrolls past when: ${s.scroll_past_triggers.join(", ")}.\nStops for: ${s.stop_triggers.join(", ")}.`)
//   — duplicate-archetype slots (e.g. wrapped tough_crowd, 2 loyalists) ENCODE the
//     FYP/tough_crowd weighting by REPETITION, which is exactly D-05's "~30% weighting for free".
```

⚠️ **Isolation note:** `run-flash-text-mode.ts`'s module header declares HARD ISOLATION — it imports only `flash/*`, `wave3/persona-registry.ts`, `qwen/client.ts`, `utils/strip` [VERIFIED: run-flash-text-mode.ts:7-13]. `selectPersonaSlots` lives in `wave3/persona-registry.ts` which is *already an allowed import*, so D-05 does NOT break isolation. But `persona-registry.ts` imports `@/lib/niches/taxonomy` (NICHE_TREE) [VERIFIED: persona-registry.ts:14] and `../types` (ContentTypeSlug) — both pure data/type modules, no pipeline/aggregator. Safe.

**Cache caveat:** Putting `niche_instantiation` into the system prompt means the byte-stable prefix now varies per niche (exactly as the video path's per-slot prompts do, and as the omni read does post-3.12.0). This is acceptable — the prefix is stable *per niche*, and a creator's niche is stable. Do NOT interpolate the `ask` or any per-request data into the system prompt (keep it in the user message). [VERIFIED pattern: flash-prompts.ts:59-66, persona-prompts.ts:30-36]

### Pattern 2: Over-generate → gate → present (ENGINE-02 / D-03)

**What:** One generate call producing ~5 ideas (separator-delimited), one Flash pass per idea's seed hook, drop sub-floor, keep 3.
**Source blueprint:** `scripts/ideas-sim-rank.ts` already does this exactly [VERIFIED: ideas-sim-rank.ts:90-122] — lift its structure:
- Generate: `callQwen(KC_IDEAS_SYSTEM_PROMPT, harnessUserMsg)` with a `===IDEA===` separator instruction appended to the assembler output [VERIFIED: ideas-sim-rank.ts:91-97].
- Parse: split on separator, filter fragments `< 40 chars` [VERIFIED: ideas-sim-rank.ts:99-102].
- SIM each in parallel: `Promise.all(ideas.map(simIdea))` [VERIFIED: ideas-sim-rank.ts:113].
- **Gate (NEW vs prototype):** the prototype *ranks*; the product *gates* — drop `band === "Weak"`, keep up to 3 (D-04: do not over-order; rank is soft secondary).

**The seed-hook extraction (D-01):** D-01 says SIM reacts to the *seed hook*, not the raw concept. The Ideas slice emits "ONE suggested hook per idea as a seed" [VERIFIED: corpus/ideas.md:26-30, "Idea Seed — one line: what the video is actually about + the promise"]. The runner must parse the seed hook out of each generated idea to feed `runFlashTextMode`. ⚠️ **GAP/OPEN:** the KC output is prose, not structured JSON — extracting "the seed hook" deterministically from prose is non-trivial. Options: (a) instruct the generate call to emit a machine-parseable seed-hook marker per idea (like the `===IDEA===` harness separator), or (b) emit ideas as structured JSON (a Qwen `json_object` generate call with an `outputSchema`). **Recommendation:** (b) — a structured generate matches the tool-runner's `outputSchema` path and removes brittle prose parsing; see §Open Questions Q1.

### Pattern 3: Content-first streaming (IDEAS-02 / D-04)

**What:** Card content renders on the first SSE frame; band/scroll-quote stream a beat later, never blocking the card.
**Source pattern:** `use-expert-chat.ts` SSE reader (frame split on `\n\n`, `event:`/`data:` parse) [VERIFIED: use-expert-chat.ts:124-169] + `analyze` route `ReadableStream` + `controller.enqueue` producer [VERIFIED: analyze/route.ts:636-646]. SSE headers: `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` [VERIFIED: analyze/[id]/chat/route.ts sseHeaders].
**Sequence:** emit a `content` event with the 3 gated idea-card *faces* (sans band), then per-card `score` events as each `aggregateFlash` resolves. ⚠️ **Tension:** D-03 says GATE before presenting (drop sub-floor) — but the gate requires the SIM result, which is the thing we want to stream *after* content. **Resolution:** the SIM must run server-side *before* the content frame (it gates which 3 survive); what "streams a beat later" is the *band/quote display detail*, not the gate decision. So: run all ~5 SIMs server-side → pick 3 survivors → emit content frame (3 card faces, each already carrying its lead scroll-quote since D-04 leads with the quote) → optionally stream the band chip as a secondary frame. This means the perceived latency is generate + 5 SIMs before first paint. See §Pitfall 4 + §Open Questions Q2 for the latency mitigation.

### Pattern 4: New `idea-card` typed block (D-10)

**What:** A single schema-validated block joining the registry, validated at write AND rehydration.
**Exact pattern to mirror** (3 edits, verified):
1. `blocks.ts`: add `IdeaCardBlockSchema = z.object({ type: z.literal("idea-card"), props: z.object({...}) })` + export type. [VERIFIED pattern: blocks.ts:35-44]
2. `block-registry.ts`: add `"idea-card": { schema: IdeaCardBlockSchema as z.ZodType }` to `BLOCK_REGISTRY`. `BlockType` auto-derives; `validateBlock` + `assertBlocksInRegistry` cover it for free. [VERIFIED: block-registry.ts:22-26]
3. `message-blocks.tsx`: add `"idea-card": IdeaCardRenderer` to `BLOCK_COMPONENTS` (TypeScript enforces completeness via `Record<BlockType, …>`). [VERIFIED: message-blocks.tsx:22-26]

**Double-validation is automatic** once registered: `insertMessage` validates at write [VERIFIED: messages.ts:79-86], `loadMessages` + `MessageBlocks` re-validate on rehydration [VERIFIED: messages.ts:144-152, message-blocks.tsx:37]. Invalid → `__unsupported__` sentinel, never dropped.

**Prop shape (D-10, discretion on exact names):** `{ title, angle, whyItFits, mechanism, seedHook, needsTake: boolean, topic, take, format, band: ("Strong"|"Mixed"|"Weak"), fraction, scrollQuote, model: "sim1-flash" }`. The card *embeds* the band rather than emitting a separate `band` block (D-10 "embedding the band + scroll-quote").

### Pattern 5: GROUND-03 grounding line (D-09) — ⚠️ requires a NEW extractor

**What goes wrong with reuse:** The CONTEXT.md code-context says "The grounding-line (D-09) reads the same profile fields it pulls." But the existing `PROFILE_ROLE_MAP` formatters produce *LLM-grounding prose with honesty caveats*, NOT human-facing card copy:
- `formatAudience` → `"Target audience: age 18-25, female-skewed, US, en"` [VERIFIED: profile-role-map.ts:71-81] — usable raw material, close to the example.
- `formatWins` → `"Past wins (creator-reported, directional): 3 videos — steer toward patterns that worked"` [VERIFIED: profile-role-map.ts:102-106] — this is *prompt instruction text*, NOT "last 3 myth-busts overperformed". The literal example copy ("last 3 myth-busting videos overperformed") **cannot be produced from current data** — `past_wins` stores only `{url}`, no content/mechanism [VERIFIED: ProfileRow.past_wins: Array<{url}>, profile-role-map.ts:50].

**Recommendation:** Build a NEW `grounding-line.ts` extractor that returns *card-facing* fragments by role, honoring the honesty spine:
- audience → "18-25 gym beginners" (from `target_audience.age_range` + niche/sub) — the realistic, honest version.
- wins → "your last 3 videos overperformed" (count only — NOT a fabricated "myth-busts overperformed", since the mechanism behind a win URL is unknown). The GROUND-03 *example copy* is aspirational; the honest v1 surfaces what the data supports.
- cold-start → "Based on TikTok baselines — add your profile for tailored ideas" (D-14) via `isProfileThin(profileRow)` [VERIFIED: assembler.ts:166-175].

⚠️ **Flag for discuss/planner:** the GROUND-03 example copy implies content-level win knowledge the v1 profile does not store. The grounding line will be *truthful but less specific* than the example until v6.1 RAG/scrape. This is a known honesty-spine trade, not a bug.

### Pattern 6: In-thread chain (D-15 / THREAD-05 / IDEAS-03)

**What:** "Develop this →" appends a Hooks-mode message below the idea in the SAME thread + seeds the assembler `anchor`.
**Verified seam:** `assembleBundle` accepts `anchor` (fenced upstream idea) [VERIFIED: assembler.ts:86,245]. `insertMessage(threadId, role, blocks)` appends to the same thread [VERIFIED: messages.ts:73]. Phase 3 ships the CTA + the anchor handoff; the Hooks *generation* is P4. **For P3 the CTA can:** persist the chosen idea's concept as the `anchor` payload and either (a) navigate/scroll to a Hooks message placeholder, or (b) just store the anchor + render a "Hooks coming in P4" affordance. **Recommendation:** ship the anchor write + the in-thread append seam (the testable THREAD-05 deliverable); the live Hooks call is explicitly P4 per D-15. Don't build Hooks generation here.

### Anti-Patterns to Avoid

- **Fanning out to 10 Flash calls for niche personas.** The Flash path is ONE multi-persona call; fold `selectPersonaSlots` into one system prompt. 10 calls would 10× cost/latency and break the "bounded" ENGINE-02 promise. [VERIFIED: run-flash-text-mode.ts fires one call]
- **Bumping `ENGINE_VERSION` for the text-path change.** D-07 forbids it; `ENGINE_VERSION` gates the protected video-scoring cache. Use `KC_GEN_VERSION` for generative provenance instead. [VERIFIED: version.ts header explains the cache-invalidation contract]
- **Touching `runFold` / `pipeline.ts` / `aggregator.ts`.** The text SIM and video SIM share `selectPersonaSlots` + `NICHE_INSTANTIATION` (pure data) but via separate call paths. Modifying the shared *data* would affect both — only ADD to the Flash path, never mutate the shared tables.
- **Model-generated card layout.** D-10 + THREAD-04: the model emits validated `idea-card` props only; the React component owns layout. Never let the model emit markup/HTML.
- **Putting per-request data in the Flash/KC system prompt.** Breaks the warm Qwen cache. Niche-instantiation in the system prompt is fine (stable per niche); the `ask`/idea text goes in the user message. [VERIFIED pattern: flash-prompts.ts:119-122]
- **Parsing the seed hook from free prose with regex.** Brittle. Use a structured generate (`json_object` + outputSchema) or an explicit machine marker. (§Open Questions Q1)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 10-persona niche panel | A new niche→persona mapping | `selectPersonaSlots` + `NICHE_INSTANTIATION` | Rich table + FYP/tough_crowd weighting + cross-niche adjacency already exist and are the video path's machinery (consistency). [VERIFIED: persona-registry.ts:431,238,385] |
| Verdicts → band/fraction | A new aggregation | `aggregateFlash` | Pure, deterministic, honesty-spine-compliant (no numeric score). [VERIFIED: flash-aggregate.ts:56] |
| Block validation | Ad-hoc prop checks | `validateBlock` / `assertBlocksInRegistry` | Double-validation (write+rehydration) is the structural "no model UI" enforcement; idea-card gets it for free once registered. [VERIFIED: block-registry.ts:34,57] |
| Thread/message persistence | New tables/queries | `createGroundedThreadLazy` / `getOpenThread` / `insertMessage` / `loadMessages` | RLS + service-client trust boundary already correct (CR-01 fixed). [VERIFIED: threads.ts, messages.ts] |
| Live grounding bundle | A new profile-to-prompt assembler | `assembleBundle` | Per-mode field-map, char cap, cold-start, injection fence (CR-01/CR-02 fixed) — supports `mode:"idea"` + `anchor` today. [VERIFIED: assembler.ts:196] |
| SSE plumbing | A new stream protocol | `use-expert-chat.ts` reader + `analyze` route `ReadableStream` | Proven `event:`/`data:` frame loop + SSE headers. [VERIFIED: use-expert-chat.ts:118, analyze/route.ts:636] |
| Generate→SIM→rank loop | From scratch | `scripts/ideas-sim-rank.ts` structure | Working prototype; formalize it, swap rank→gate. [VERIFIED: ideas-sim-rank.ts] |

**Key insight:** Phase 3's value is in *correct composition + the niche-instantiation fix*, not new infrastructure. The one genuinely new piece of *logic* is the GROUND-03 grounding-line extractor (because existing formatters target the LLM, not the card).

## Common Pitfalls

### Pitfall 1: The grounding line silently reuses LLM-facing formatters
**What goes wrong:** A task says "reuse `PROFILE_ROLE_MAP` for the grounding line" and the card shows "Past wins (creator-reported, directional): 3 videos — steer toward patterns that worked" — prompt instruction text leaking to the UI.
**Why it happens:** `PROFILE_ROLE_MAP` formatters are authored for the Qwen user message, with honesty caveats baked in [VERIFIED: profile-role-map.ts:102-120].
**How to avoid:** Build a dedicated card-facing extractor (`grounding-line.ts`); read the same `ProfileRow` fields by role but render human copy. Verify the card never shows "(creator-reported, directional)" or "steer toward".
**Warning signs:** Caveat phrases or "Target platform: tiktok" appearing on a card.

### Pitfall 2: Niche personas land but the floor still passes garbage
**What goes wrong:** D-05 ships, but `STRONG_THRESHOLD=6`/`MIXED_THRESHOLD=3` were calibrated against the *lenient generic* judges. Niche-true + tough_crowd-weighted personas score LOWER across the board, so a real idea now reads "Weak" and gets dropped — or the floor is so low garbage still passes.
**Why it happens:** Thresholds were "never empirically set" [VERIFIED: flash-aggregate.ts:18-23 comment; CITED: levers SIM audit].
**How to avoid:** The slop-vs-strong test (D-06) is the acceptance gate — run AFTER D-05, retune both thresholds AND the gate floor (`band !== "Weak"` may need to become a stop-count cutoff). Garbage must score clearly below a known-great idea with the niche personas active.
**Warning signs:** Calibrating thresholds before niche personas land (calibrates the wrong distribution).

### Pitfall 3: Accidentally bumping ENGINE_VERSION or mutating the shared persona tables
**What goes wrong:** A "tidy the persona registry" edit changes `NICHE_INSTANTIATION` or `ALLOCATION_TABLE`, silently shifting the *video* (Max) scores → regression-gate violation.
**Why it happens:** Text and video paths share those pure-data tables.
**How to avoid:** D-05 only ADDS a niche-aware *consumer* in the Flash path; never edits the shared tables. Keep `version.test.ts` (`ENGINE_VERSION === "3.19.0"`) green [VERIFIED: __tests__/version.test.ts]. Run the full engine suite (`npm test`, vitest) and confirm same-video Max score-identity.
**Warning signs:** Any diff in `persona-registry.ts` outside `selectPersonaSlots`'s call sites; any change in `version.ts`, `fold.ts`, `pipeline.ts`, `aggregator.ts`.

### Pitfall 4: "Content-first" perceived latency is generate + 5 SIMs
**What goes wrong:** D-04/D-03 require gating before present, but gating needs SIM results — so first paint waits for generate (~plus model) + 5 parallel Flash calls (~8-17s each, parallel). That's not "instant content".
**Why it happens:** The gate is upstream of presentation by construction.
**How to avoid:** (a) Run the 5 SIMs in parallel (`Promise.all`, as the prototype does [VERIFIED: ideas-sim-rank.ts:113]) so wall-time ≈ one SIM. (b) Stream a "generating ideas…" then "scoring on your audience…" status via SSE so the wait is legible. (c) The band/quote *display* can still arrive as a secondary frame after the card face within the same response. Accept that "content-first" here means *card face before band chip*, not *card before gate*.
**Warning signs:** Serial SIM calls; a blank screen for >20s with no status.

### Pitfall 5: Composer Auto/seeded routing arms the Test navigation
**What goes wrong:** Flipping the Idea chip live, an empty-send Auto path accidentally triggers `pendingNavRef`/`stream.start` (the Test video flow).
**Why it happens:** The composer's submit loop is wired to the analyze/Test path; `onSelect` must NOT arm navigation (Pitfall #5 already documented in composer) [VERIFIED: composer.tsx:77,222].
**How to avoid:** Idea-chip send routes to the NEW Ideas route, not `stream.start`. Keep `pendingNavRef` exclusive to the Test upload/URL paths. Empty send + Idea chip = Auto generate (valid), not a no-op or a Test trigger.
**Warning signs:** An Idea send navigating to `/analyze/[id]`.

### Pitfall 6: `flashRunner.id` is hardcoded `"hooks"`
**What goes wrong:** Reusing `flashRunner` for Ideas inherits `id: "hooks"` [VERIFIED: flash-runner.ts:60], mistagging provenance/telemetry.
**Why it happens:** P1 set it for Hooks; the comment notes "P3/P4 will also use 'idea'".
**How to avoid:** Ideas uses `runFlashRunner(text, "idea")` (the framing param, not the runner id) for scoring — the runner `id` matters for the ToolRunner contract, not for the gate call. If Ideas needs its own ToolRunner instance, create `ideaRunner` with `id:"idea"`. The `framing:"idea"` is the correct knob and already exists [VERIFIED: flash-prompts.ts:26,35-38].

## Runtime State Inventory

Not a rename/refactor/migration phase — this is additive feature work. The only persistence change is **new message rows** (typed `idea-card` blocks) into the existing `messages` table, plus a KC_GEN_VERSION stamp. No stored-data renames, no live-service config, no OS-registered state, no secret/env renames, no build-artifact churn.

- **Stored data:** None renamed. New `idea-card` block rows added to `messages.body` (existing table). [VERIFIED: messages table exists, messages.ts]
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None new required. Models resolve via existing `QWEN_*` env defaults; `FLASH_MODEL` seam already exists [VERIFIED: run-flash-text-mode.ts:43]. (DASHSCOPE_API_KEY already in use.)
- **Build artifacts:** KC corpus is already compiled to `compiled.ts`; no recompile needed unless a slice is edited (out of scope — Phase 3 consumes the P2 KC as-is). If any `.planning/corpus/*.md` IS edited, bump `KC_GEN_VERSION` and run the regen compiler.

## Code Examples

### Niche source for D-05 (verified clean — no taxonomy translation)
```ts
// Ideas route, after loading profileRow:
// niche_primary is stored as a NICHE_TREE slug = NICHE_INSTANTIATION key.  [VERIFIED]
const nicheSlug = profileRow?.niche_primary ?? null;
// contentType null → ALLOCATION_TABLE["other"] (6/2/1/1) neutral baseline.  [VERIFIED]
const panel = { niche: nicheSlug, contentType: null as ContentTypeSlug | null };
const { result } = await runFlashTextMode(seedHook, "idea", panel);   // D-05 new param
const { band, fraction } = aggregateFlash(result.personas);          // [VERIFIED: flash-aggregate.ts:56]
```

### Assembler call for Ideas (verified — supports mode:"idea" + cold-start + anchor today)
```ts
// Source: src/lib/kc/assembler.ts:196  [VERIFIED]
const userMessage = assembleBundle(
  { ask: composerText || "Generate ideas from my profile", platform, mode: "idea" },
  profileRow,   // null → honest cold-start baseline (D-14)
);
// Qwen call: system = KC_IDEAS_SYSTEM_PROMPT (cached), user = userMessage (volatile).
```

### Registering the idea-card block (3 verified edits)
```ts
// 1. blocks.ts — mirror BandBlockSchema  [VERIFIED pattern: blocks.ts:35]
export const IdeaCardBlockSchema = z.object({
  type: z.literal("idea-card"),
  props: z.object({
    title: z.string(), angle: z.string(), whyItFits: z.string(),
    mechanism: z.string(), seedHook: z.string(), needsTake: z.boolean(),
    topic: z.string(), take: z.string(), format: z.string().nullable(),
    band: z.enum(["Strong","Mixed","Weak"]), fraction: z.string(),
    scrollQuote: z.string(), model: z.literal("sim1-flash"),
  }),
});
// 2. block-registry.ts — add to BLOCK_REGISTRY  [VERIFIED: block-registry.ts:22]
//    "idea-card": { schema: IdeaCardBlockSchema as z.ZodType },
// 3. message-blocks.tsx — add to BLOCK_COMPONENTS  [VERIFIED: message-blocks.tsx:22]
//    "idea-card": IdeaCardRenderer,
```

### Slop-vs-strong test scaffold (D-06 acceptance gate)
```ts
// src/lib/engine/flash/__tests__/slop-vs-strong.test.ts  (NEW)
// Live-call test (gated behind DASHSCOPE_API_KEY like the prototype) OR a deterministic
// unit test over aggregateFlash with fixture persona arrays for the pure-logic half.
// Acceptance (D-06): garbage idea's stop-count must be clearly below a known-great idea's,
// with the NICHE panel active.  Pattern source: scripts/ideas-sim-rank.ts:73-82  [VERIFIED]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SIM scores raw concept | SIM judges the seed hook AS the finished video (idea framing already reframed) | flash-prompts.ts idea framing [VERIFIED: flash-prompts.ts:35-38] | Concept-level SIM is coherent as a GATE (levers altitude nuance UPDATED). |
| Text SIM = generic flat personas | Niche-instantiate via selectPersonaSlots (D-05) | This phase | Fixes flat 6/6/6 distribution; makes the gate able to say "no". |
| Rank ideas by stop-count | GATE (drop sub-floor), rank soft-secondary, lead with scroll-quote | Owner reframe 2026-06-17 [CITED: levers SIM reframe] | "All Mixed" is a valid answer; UX leads with the quote not the fraction. |
| KC_GEN_VERSION defined, stamping deferred | Stamp persisted Ideas output | This phase (P1 deferred it here) [VERIFIED: kc-version.ts:14-19] | First phase persisting generative output. |

**Deprecated/outdated:**
- The literal GROUND-03 example copy ("last 3 myth-busting videos overperformed") — implies content-level win knowledge not stored in v1 `creator_profiles` (URL-only). The honest v1 line is less specific.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Folding `selectPersonaSlots` into ONE Flash system prompt (not 10 calls) is the right adaptation of D-05. | §Architecture two-engines, Pattern 1 | If the planner intended per-persona calls, cost/latency model differs (but ENGINE-02 "bounded" + the prototype's single-call SIM strongly support one call). |
| A2 | `contentType = null` (→ `other` allocation) is acceptable for Ideas v1. | §Niche thread-through | If a content-type were derivable from the KC FORMAT cue, niche allocation could be sharper; `other` is the honest neutral baseline meanwhile. |
| A3 | Structured (`json_object`) generate is preferable to prose-parsing the seed hook. | Pattern 2, Open Q1 | If KC prose quality degrades under a JSON schema constraint (the KC is authored for prose discipline), a markered-prose approach may be needed instead. |
| A4 | Niche personas will lower scores, so the floor/thresholds will need retuning downward. | Pitfall 2 | Direction could differ; the slop-vs-strong test is the empirical arbiter regardless. |
| A5 | The Ideas API route is best as a new `src/app/api/tools/ideas/route.ts` (no existing tool route). | §Project Structure | If a different route convention is preferred, only the path changes; the SSE producer pattern is the same. |
| A6 | KC_GEN_VERSION stamps on the persisted message (metadata/block prop), not a new column. | §KC version | A schema migration would be heavier; message body is JSONB and can carry a provenance field cheaply. |

## Open Questions

1. **Seed-hook extraction: structured generate vs markered prose?**
   - What we know: D-01 needs the seed hook per idea to feed the SIM; the KC emits one seed hook per concept in prose [VERIFIED: corpus/ideas.md:26-30]. The prototype splits on a `===IDEA===` harness separator [VERIFIED: ideas-sim-rank.ts:91-102].
   - What's unclear: whether forcing a `json_object` outputSchema degrades the KC's authored prose craft (the KC is tuned for prose discipline, scaffolding-private).
   - Recommendation: Plan a small task to try a structured generate (idea object with explicit `seedHook` field) and fall back to a machine-marker-in-prose if quality drops. The tool-runner's `outputSchema` path is built for the structured case [VERIFIED: tool-runner.ts:99-121].

2. **Content-first latency budget — is generate + parallel-SIM acceptable for first paint?**
   - What we know: gate must precede present (D-03); SIMs run in parallel (~one-SIM wall-time) [VERIFIED: prototype Promise.all].
   - What's unclear: the acceptable first-paint latency; whether to stream a "scoring…" status.
   - Recommendation: parallelize SIMs, stream legible status events, treat "content-first" as card-face-before-band-chip. Measure end-to-end in a calibration task.

3. **Does the Ideas route create/use a grounded or open thread?**
   - What we know: `getOpenThread(userId)` exists; grounded threads wrap a Reading [VERIFIED: threads.ts:125,54]. An Auto idea has no Reading.
   - What's unclear: whether Ideas runs in the user's open thread or a fresh thread per session.
   - Recommendation: use/create the user's open thread (`type:"open"`, `reading_id` null) for Ideas; the "Develop this →" chain (D-15) appends to that same thread. Confirm with the planner against the P5 open-chat design (they share the open thread).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DashScope (Qwen) API key | generate + SIM calls | ✓ (in use by existing engine/chat) | n/a | None — same key the whole engine uses. [VERIFIED: client.ts getQwenClient] |
| `QWEN_REASONING_MODEL` | idea generation | ✓ | qwen3.7-plus (default) | env-overridable [VERIFIED: client.ts:41] |
| `QWEN_FAST_MODEL` / `FLASH_MODEL` | SIM scoring | ✓ | qwen3.6-flash (default) | `FLASH_MODEL` env seam [VERIFIED: run-flash-text-mode.ts:43] |
| Supabase (threads/messages tables) | persistence | ✓ | live (P1 migration shipped) | None — tables exist. [VERIFIED: messages.ts/threads.ts derive from generated DB types] |
| vitest | tests | ✓ | `npm test = vitest run` | None [VERIFIED: package.json:24] |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None new.

## Validation Architecture

> nyquist_validation status not found explicitly in config read this session; treating as enabled (key absent = enabled). The planner should confirm against `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest [VERIFIED: package.json:24] |
| Config file | (vitest run via `npm test`; no standalone config surfaced — uses defaults / inline) |
| Quick run command | `npx vitest run src/lib/engine/flash` (Flash-only) |
| Full suite command | `npm test` (vitest run, whole suite) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-02 / D-06 | Garbage scores below known-great with niche panel | integration (live or fixtured) | `npx vitest run src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` | ❌ Wave 0 (NEW) |
| D-05 | Niche-aware system prompt builds 10 slots, byte-stable per niche | unit | `npx vitest run src/lib/engine/flash` | ❌ Wave 0 (extend flash-prompts test) |
| D-07 | `ENGINE_VERSION === "3.19.0"` unchanged + suite green | unit | `npx vitest run src/lib/engine/__tests__/version.test.ts` | ✅ (version.test.ts) |
| D-10 | idea-card validates at write + rehydration; invalid → unsupported | unit | `npx vitest run src/lib/tools` + thread tests | ⚠️ partial (registry tests exist; add idea-card cases) |
| GROUND-03 / D-09 | grounding line emits honest by-role copy, cold-start fallback | unit | `npx vitest run src/lib/kc` (extend) | ❌ Wave 0 (NEW grounding-line.test) |
| IDEAS-01/02/03 | over-generate→gate→3 cards; anchor handoff | integration | route test (mock Qwen) | ❌ Wave 0 (NEW) |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched dir (flash / tools / kc).
- **Per wave merge:** `npm test` (full suite — proves D-07 no-regression).
- **Phase gate:** full suite green + slop-vs-strong test passing before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` — D-06 acceptance gate (ENGINE-02).
- [ ] Extend flash-prompts test for the niche-aware builder (D-05).
- [ ] `src/lib/kc/__tests__/grounding-line.test.ts` — GROUND-03 honest copy + cold-start.
- [ ] idea-card cases in the block-registry / message rehydration tests (D-10).
- [ ] Ideas route test with mocked Qwen (over-generate→gate→3, anchor write).

## Security Domain

> security_enforcement not found explicitly false this session — treating as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Route enforces session auth before any DB read (mirror `analyze/[id]/chat` T-00u-01) [VERIFIED: chat route header]. |
| V3 Session Management | yes | `user_id` from session server-side, NEVER from body [VERIFIED: threads.ts:11, messages.ts:19]. |
| V4 Access Control | yes | Thread ownership verified before `insertMessage` (service client bypasses RLS) [VERIFIED: messages.ts caller-responsibility note; threads.ts CR-01]. |
| V5 Input Validation | yes | `assemblerInputSchema.safeParse` at the assembler boundary [VERIFIED: assembler.ts:201]; `validateBlock` at write [VERIFIED: messages.ts:79]; cap composer `ask` length (mirror MAX_MESSAGE_LENGTH=2000 from chat route). |
| V6 Cryptography | no | No new crypto. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via composer `ask` / chain `anchor` | Tampering | `assembleBundle` injection fence (`<<<USER_CONTENT>>>` + sentinel-strip, overflow-safe CR-01/CR-02) [VERIFIED: assembler.ts:108-158]. Fence the anchor (already done at assembler.ts:245). |
| IDOR on thread/message | Info disclosure / Elevation | RLS-scoped reads + explicit `user_id` scoping on service-client reads [VERIFIED: threads.ts:75-90]. |
| Model-generated UI injection | Tampering | Fixed registry + double `validateBlock`; idea-card props validated, layout owned by React [VERIFIED: block-registry.ts:34, message-blocks.tsx:37]. |
| Cost/DoS via unbounded generation | DoS | Bounded over-generate (~5, D-03); rate-limit the Ideas route (mirror chat route `RATE_LIMIT_*`) [VERIFIED: chat route caps]. |
| Non-Qwen model leak | Compliance | Qwen-only via `getQwenClient` [VERIFIED: client.ts]; never import Claude/Gemini/DeepSeek. |

## Sources

### Primary (HIGH confidence — read this session)
- `src/lib/engine/flash/run-flash-text-mode.ts`, `flash-prompts.ts`, `flash-aggregate.ts`, `flash-schema.ts` — text SIM path + signatures + thresholds.
- `src/lib/engine/wave3/persona-registry.ts`, `persona-prompts.ts`, `fold.ts` (head), `src/lib/engine/pipeline.ts:740-799` — the video persona machinery + selectPersonaSlots call site.
- `src/lib/engine/persona-weights.ts`, `version.ts`, `qwen/client.ts`, `types.ts` (ContentTypeSlug).
- `src/lib/kc/assembler.ts`, `profile-role-map.ts`, `compiled.ts` (exports), `kc-version.ts`.
- `src/lib/tools/tool-runner.ts`, `runners/flash-runner.ts`, `block-registry.ts`, `blocks.ts`.
- `src/lib/threads/threads.ts`, `messages.ts`.
- `src/components/app/home/composer.tsx`, `tool-chips.tsx`, `cards/niche-picker.tsx`, `profile-interview-modal.tsx`.
- `src/components/thread/message-blocks.tsx`, `band-block.tsx` (head).
- `src/hooks/queries/use-expert-chat.ts`, `src/app/api/analyze/[id]/chat/route.ts` (head), `src/app/api/analyze/route.ts` (stream grep).
- `scripts/ideas-sim-rank.ts` (the working prototype).
- `src/lib/niches/taxonomy.ts` (slug verification).

### Secondary (planning docs — CITED)
- `.planning/phases/03-ideas-tool/03-CONTEXT.md` (D-01..D-15), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 3, `.planning/STATE.md`.
- `.planning/phases/01-engine-thread-foundation/01-CONTEXT.md`, `.planning/phases/02-knowledge-core-generative-rebuild/02-CONTEXT.md`.
- `.planning/research/kc-improvement-levers.md` (altitude flag, SIM audit, lever #10, gate-not-ranker reframe).
- `.planning/corpus/ideas.md`, `.planning/corpus/base.md` (Value Bar Tests A/B/C).

### Tertiary (LOW confidence)
- None — all claims verified against source or cited from planning docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every signature read directly this session.
- Architecture (two-engine fix, wiring): HIGH — selectPersonaSlots call site, niche slug alignment, and assembler `mode:"idea"`/`anchor` support all verified.
- Niche thread-through cleanliness: HIGH — niche_primary→NICHE_TREE slug→NICHE_INSTANTIATION key chain verified end to end.
- GROUND-03 gap: HIGH — confirmed formatters are LLM-facing; example copy exceeds stored data.
- Threshold calibration outcome: MEDIUM — direction inferred (A4); the slop-vs-strong test is the empirical arbiter.
- Seed-hook extraction approach: MEDIUM — structured-vs-prose is an open design call (Q1/A3).

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable internal codebase; re-verify if engine/flash or kc modules are refactored before planning).

---

## RESEARCH COMPLETE

**Phase:** 3 - Ideas Tool
**Confidence:** HIGH

### Key Findings
- **Mostly wiring, one engine fix.** Every dependency (KC Ideas prompt, `assembleBundle` with `mode:"idea"`+`anchor`+cold-start, tool-runner, typed-block registry with double-validation, thread/message persistence, SIM-1 Flash path, disabled Idea chip, SSE pattern) is verified present. A working generate→SIM→rank prototype (`scripts/ideas-sim-rank.ts`) is the blueprint.
- **Niche thread-through (D-05) is clean and isolation-safe.** `creator_profiles.niche_primary` already stores a `NICHE_TREE` slug that is *exactly* a `NICHE_INSTANTIATION` key; `selectPersonaSlots` lives in an already-allowed import. The non-obvious adaptation: fold the 10 slots into ONE Flash system prompt (Flash is a single multi-persona call), NOT 10 calls — repetition of weighted slots encodes the ~30% FYP/tough_crowd weighting for free.
- **Two real new pieces of logic:** (1) a GROUND-03 grounding-line extractor — existing `PROFILE_ROLE_MAP` formatters are LLM-facing prose with caveats, NOT card copy, and the literal example copy exceeds v1 stored data (honest line will be less specific); (2) threshold recalibration proven by the slop-vs-strong test (D-06) — must run AFTER niche personas land (Pitfall 2).
- **D-07 guardrail is concrete:** never edit shared persona tables, never touch fold/pipeline/aggregator, keep `version.test.ts` (`ENGINE_VERSION==="3.19.0"`) green, full `npm test` suite green.
- **Content-first has a real tension** (Pitfall 4): the gate must precede presentation, so first-paint = generate + parallel-SIM; mitigate with parallel SIMs + legible status, treating "content-first" as card-face-before-band-chip.

### File Created
`/Users/davideloreti/virtuna-numen-tools/.planning/phases/03-ideas-tool/03-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All signatures read from source this session. |
| Architecture | HIGH | selectPersonaSlots call site, niche slug chain, assembler support all verified. |
| Pitfalls | HIGH | Each grounded in a verified file/line. |

### Open Questions
1. Seed-hook extraction: structured `json_object` generate vs markered prose (Q1/A3).
2. Content-first latency budget (generate + parallel-SIM) acceptability (Q2).
3. Ideas route uses the user's open thread vs a fresh thread (Q3).

### Ready for Planning
Research complete. The planner can write executable tasks against verified signatures. Recommended waves: A (engine niche-instantiation + slop-vs-strong test, isolated), B (idea-card block + grounding-line + KC_GEN_VERSION stamping), C (Ideas route + composer chip flip + in-thread chain).
