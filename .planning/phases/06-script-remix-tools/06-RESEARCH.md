# Phase 6: Script & Remix Tools - Research

**Researched:** 2026-06-18
**Domain:** Studio chain-skill implementation (Next.js 15 SSE routes + Qwen pipeline + typed-block renderers) — Script (greenfield) + Remix (revive existing `engine/remix`)
**Confidence:** HIGH (all critical questions answered against live code on `milestone/numen-tools`)

## Summary

Phase 6 ships two generative skills onto the P5 chain plumbing by *appending*, not restructuring. Every seam P6 needs already exists and is pre-staged: the `CHAIN_HANDOFFS` SSOT carries three placeholder entries (`hooks→script`, `script→test`, `remix→hooks`), the block registry is one append away from new card types, the runner template is proven twice (ideas + hooks), and the SIM-1 Flash text-mode gate is reusable unchanged. Script is **greenfield** — the prior-art `analyze/[id]/script/route.ts` is confirmed ABSENT on this branch; Script mirrors the ideas/hooks runner verbatim. Remix is **revive-don't-rebuild** — the `engine/remix/*` decode+adapt logic is live, Qwen-only, and already exercised end-to-end via the `mode:'remix'` branch in `analyze/route.ts`.

**The D-05a verdict is GREEN — and emphatically so.** `decode.ts` does NOT require a SIM-1 Max Reading and is fully disjoint from the protected video-scoring path. The decode flow is `resolveAndRehost → analyzeVideoWithOmni → omniOutputToStructuralInput → runDecode`, wired in `runDecodeStream` (analyze/route.ts:326-372). That function's header (line 322) explicitly states it **"NEVER calls runPredictionPipeline, aggregateScores, or usage_tracking"** and keeps `overall_score: null`. `runPredictionPipeline` (pipeline.ts:320) is the protected Max scorer; the only live `ENGINE_VERSION` consumer is `prediction-cache.ts`, which the decode path never touches. `omni-analysis.ts` has zero references to `ENGINE_VERSION`/`overall_score`/`runPrediction`. Reuse is structurally read-only over the protected path — no `ENGINE_VERSION` bump, engine suite stays green, same-video Max score-identity preserved. **No loud flag needed.**

**Primary recommendation:** Sequence Script first (greenfield, clones ideas/hooks closely, fast spine win), then Remix (wrap the live `engine/remix` decode+adapt behind a new `/api/tools/remix/*` SSE route + a `remix-card` block). Both phases are file-disjoint enough to parallelize the runner+route+block work per skill. Add a `script` and `remix` mode-role map to the assembler and a Script/Remix slice decision to the KC corpus — neither exists today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Script generation (beats+timing+retention) | API / Backend (`/api/tools/script` SSE route + runner) | — | Mirrors `/api/tools/hooks`: auth → assembleBundle → Qwen generate → Flash gate → persist; no client LLM |
| Script hook-beat Flash gate (D-01) | API / Backend (`runFlashTextMode`) | — | Reuses the proven Hooks first-2s gate unchanged — server-side bounded Qwen call |
| Remix URL resolve + decode (D-05) | API / Backend (`engine/remix/*` via SSE route) | Database/Storage (temp rehost bucket) | Video fetch + Omni perception + decode is heavy server work; temp mp4 rehost is derive-and-drop |
| Remix niche adapt (D-05) | API / Backend (`generateAdaptConcepts`) | — | Single Qwen JSON call grounded in `KNOWLEDGE_CORE` |
| Typed card rendering (script-card / remix-card) | Browser / Client (`*-card-block.tsx`) | — | Fixed renderer owns layout; model emits validated props only (THREAD-04) |
| Chain CTA handoff (script→test, remix→hooks) | Browser / Client (React context + card CTA) | API (target route on fire) | Mirrors HookTestContext: card invokes a lifted callback; composer initiates the next step |
| Per-request grounding bundle | API / Backend (`assembleBundle`) | — | Volatile user-message tier; warm system prefix is the compiled KC slice |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 (App Router) | SSE route handlers (`route.ts`), server pages | [VERIFIED: package.json + live routes] — every tool route is a Next 15 `ReadableStream` handler |
| TypeScript | 5.x | All code, strict typing for blocks/contracts | [VERIFIED: codebase] CLAUDE.md mandate |
| Zod | (in use) | Block schemas, output-contract validation, input validation at boundary | [VERIFIED: blocks.ts, decode-types.ts] D-14 double-validation pattern |
| OpenAI SDK (DashScope-compatible) | (in use) | Qwen client (`getQwenClient`) | [VERIFIED: qwen/client.ts] Qwen-only constraint |
| Tailwind v4 | (in use) | Card styling (flat-warm THEME-06) | [VERIFIED: CLAUDE.md + hook-card-block.tsx] |
| Supabase | (in use) | Thread/message persistence, temp video rehost (remix), ownership checks | [VERIFIED: messages.ts, resolve-and-rehost.ts] |
| Vitest | (in use) | Test framework (`vitest run`) | [VERIFIED: package.json] |

### Supporting (all internal — the reuse surface)
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `src/lib/tools/chain-handoff.ts` | `CHAIN_HANDOFFS` SSOT + `SkillId` union + `handoffsFor` | Append `"script"`/`"remix"` to union; set placeholder endpoints (script→test context handoff = null) |
| `src/lib/tools/runners/hooks-runner.ts` | generate→SIM-gate→rank→typed-card template | Script's hook-beat gate clones the `runFlashTextMode(..., "hook", panel)` call verbatim |
| `src/lib/tools/runners/ideas-runner.ts` | generate→SIM-gate→self-judge→build-card (canonical, one card vs N) | Script's "one card per run" (D-02) is closer to ideas' single-survivor shape |
| `src/lib/engine/flash/run-flash-text-mode.ts` | SIM-1 Flash text-mode (10 personas, niche panel) | Script gate calls with `framing:"hook"` on the opening beat seed (D-01) |
| `src/lib/engine/flash/flash-aggregate.ts` | `aggregateFlash` → `{band, fraction}`; `MIXED_THRESHOLD=3`, `STRONG_THRESHOLD=6` | Reuse unchanged — no new SIM calibration (D-01) |
| `src/lib/kc/assembler.ts` | `assembleBundle` per-request grounding; `MODE_ROLES` map | ADD `script` + `remix` mode entries (currently `idea`/`hooks`/`chat` only) |
| `src/lib/kc/compiled.ts` | `KC_*_SYSTEM_PROMPT` byte-stable prefixes | Decide Script/Remix slice vs reuse Hooks slice (no script/remix slice exists today) |
| `src/lib/tools/blocks.ts` + `block-registry.ts` | Block schemas + registry | ADD `ScriptCardBlockSchema` / `RemixCardBlockSchema`; register in `BLOCK_REGISTRY` + `BLOCK_COMPONENTS` |
| `src/lib/engine/remix/resolve-and-rehost.ts` | URL→signed temp video URL (derive-and-drop) | Remix entry — reuse as-is |
| `src/lib/engine/remix/decode.ts` | `runDecode` + `omniOutputToStructuralInput` (real structural anatomy) | Remix decode — reuse as-is (D-05a GREEN) |
| `src/lib/engine/remix/adapt.ts` | `generateAdaptConcepts` (3 niche concepts, Qwen-only) | Remix adapt — reuse; cardinality decision (1 vs 3) is Claude's discretion |
| `src/lib/threads/messages.ts` (`insertMessage`) + `threads.ts` (`createOpenThreadLazy`) | Open-thread persistence + KC_GEN_VERSION stamp | Both skills append to the same open thread (P5 D-01) |
| `src/lib/hook-test-context.tsx` (`HookTestContext`) | Card→composer test-handoff callback seam | Script→Test rides this exact pattern (or a sibling `ScriptTestContext`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `/api/tools/remix/*` route | Reuse `/api/remix/adapt` route as-is | Existing route is non-SSE, takes a pre-decoded `decode` body, persists to `variants.remix.adapt` (a Reading row, not the open thread). For the studio thread you need an SSE route that runs the full resolve→decode→adapt chain and writes a `remix-card` to the open thread. **Recommendation: new `/api/tools/remix/run` SSE route** that reuses the three engine functions; decide post-scout per D-06. |
| `script→test` as an endpoint | `script→test` as a context handoff | **Use context handoff (endpoint: null)** — mirrors `hooks→test` exactly (chain-handoff.ts:135-141 already pre-stages it as `anchorFrom:"context"`). The composer's `handleTestHook` (composer.tsx:235) is the proven seam. |
| Reuse `HookTestContext` for Script | New `ScriptTestContext` | Reuse is viable if the test brief shape matches (`hookLine + audienceArchetype`); a script brief is richer. **Recommendation: a sibling context (or a generalized `TestBriefContext`)** carrying the script's opening-beat line as the test anchor — Claude's discretion within D-07. |

**Installation:** No new external packages required. All dependencies are internal modules already in the repo. (See Package Legitimacy Audit.)

**Version verification:** Not applicable — zero new npm/PyPI/crates packages. The phase is pure internal-module composition.

## Package Legitimacy Audit

> No external packages are installed by this phase. Script and Remix compose existing internal modules (`@/lib/tools/*`, `@/lib/engine/*`, `@/lib/kc/*`) and already-present dependencies (Next.js, Zod, OpenAI SDK, Supabase, Tailwind, Vitest).

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| *(none)* | — | — | No installs this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
SCRIPT (greenfield — mirrors Hooks):

  Composer (activeTool="script")          ── client ──
    │  ask (topic) OR anchor (hookLine from "Write script →" CTA)
    ▼
  POST /api/tools/script  (SSE route)     ── server ──
    │  auth → cap ask/anchor → load profile → createOpenThreadLazy
    ▼
  runScriptPipeline()                     ── runner ──
    1. assembleBundle({mode:"script", anchor}) → user message
    2. Qwen json_object generate: ONE script {beats[], per-beat timing, per-beat retention marker}
    3. SELF-JUDGE (bounded, like ideas/hooks)
    4. GATE: runFlashTextMode(openingBeat.seed, "hook", {niche}) → aggregateFlash → band
       (scores the OPENING HOOK BEAT ONLY — D-01, reuses Hooks gate)
    5. BUILD: script-card block (ScriptCardBlockSchema.safeParse — D-14)
    ▼
  SSE: stage events → content (script card face) → score (band chip) → followup → done
    ▼
  insertMessage(openThread, "assistant", [scriptCard], kcGenVersion)
    ▼
  ScriptThreadView renders card → "Test full →" via context handoff (script→test)


REMIX (revive engine/remix):

  Composer (activeTool="remix")           ── client ──
    │  pasted trending/competitor URL
    ▼
  POST /api/tools/remix/run  (SSE route)  ── server ──
    │  auth → CSRF/Content-Type guards → URL validation → createOpenThreadLazy
    ▼
  resolveAndRehost(url, requestId)        ── engine/remix (REUSE) ──
    │  Apify resolve → server-side mp4 download → temp Supabase rehost → 1h signed URL
    ▼  (finally: cleanup() unconditional — derive-and-drop)
  analyzeVideoWithOmni(signedUrl)         ── Omni perception (NOT Max scoring) ──
    ▼
  omniOutputToStructuralInput(omni) → runDecode(structural)   ── REUSE; overall_score stays null ──
    │  → DecodeResult {beats[4], repeatable[], luck[]}
    ▼
  decodeResultToAdaptInput(decode, niche) → generateAdaptConcepts(input)  ── REUSE ──
    │  → AdaptConcept[] (3; pick 1 OR keep ranked set — discretion)
    ▼
  GATE: runFlashTextMode(adapted hook, "hook", {niche}) → band  (Flash score, D-05)
    ▼
  BUILD: remix-card block → insertMessage(openThread)
    ▼
  RemixThreadView renders card → "Develop into hooks →" (remix→hooks, anchorFrom:"card")
```

### Recommended File Structure (additions only — append, don't restructure)
```
src/lib/tools/
├── chain-handoff.ts          # EDIT: add "script"|"remix" to SkillId; set placeholder endpoints
├── blocks.ts                 # EDIT: add ScriptCardBlockSchema, RemixCardBlockSchema + union
├── block-registry.ts         # EDIT: register "script-card", "remix-card"
└── runners/
    ├── script-runner.ts      # NEW: runScriptPipeline (clone ideas/hooks template)
    └── remix-runner.ts       # NEW: runRemixPipeline (wrap engine/remix resolve→decode→adapt)
src/app/api/tools/
├── script/route.ts           # NEW: SSE route (clone hooks/route.ts)
└── remix/run/route.ts        # NEW: SSE route (resolve→decode→adapt→flash→remix-card)
src/components/thread/
├── script-card-block.tsx     # NEW: ScriptCardRenderer (clone hook-card-block.tsx)
├── remix-card-block.tsx      # NEW: RemixCardRenderer
├── script-thread-view.tsx    # NEW: clone hooks-thread-view.tsx
├── remix-thread-view.tsx     # NEW
└── message-blocks.tsx        # EDIT: add "script-card"/"remix-card" to BLOCK_COMPONENTS
src/hooks/queries/
├── use-script-stream.ts      # NEW: clone use-hooks-stream.ts
└── use-remix-stream.ts       # NEW
src/lib/kc/
├── assembler.ts              # EDIT: add script+remix to modeSchema + MODE_ROLES
└── compiled.ts               # EDIT (via corpus): KC_SCRIPT_SYSTEM_PROMPT / reuse hooks
.planning/corpus/
└── script.md (+ remix?)      # NEW: authored slice → regen-kc.ts → compiled.ts
src/components/app/home/
├── composer.tsx              # EDIT: add activeTool "script"/"remix" branches + thread views
└── tool-chips.tsx            # EDIT: add script/remix chips
```

### Pattern 1: Runner template (generate → self-judge/gate → typed card)
**What:** Every studio skill is a runner returning `{ blocks, warnings }`. The route owns SSE + persistence + the json_object `OUTPUT_CONTRACT` (because DashScope requires the literal word "json" in the message and the compiled KC prompt is pure craft).
**When to use:** Both Script and Remix.
```typescript
// Source: src/lib/tools/runners/hooks-runner.ts (verbatim template)
// 1. GENERATE
const userMessage = assembleBundle({ ask, platform, mode: "script", ...(anchor ? { anchor } : {}) }, profileRow);
const out = await generateScriptStructured(userMessage); // Qwen json_object + SCRIPT_OUTPUT_CONTRACT
// 2. GATE (Flash on opening beat only — D-01)
const sim = await runFlashTextMode(out.beats[0].seedLine, "hook", { niche, contentType: null });
const { band, fraction } = aggregateFlash(sim.result.personas);
// 3. BUILD + validate (D-14 belt-and-suspenders)
const block = { type: "script-card" as const, props: { ...beats, band, fraction, model: "sim1-flash" } };
const validated = ScriptCardBlockSchema.safeParse(block);
```

### Pattern 2: SSE route (content-first stream + named stages + persist + follow-up)
**What:** `ReadableStream` with `send(event, data)`; emits `stage` (active/done), `status`, `content` (card face), `score` (band chip a beat later), `followup`, `done`/`error`. Persists via `insertMessage(threadId, "assistant", blocks, kcStamp().kcGenVersion)`.
**When to use:** Both routes. Clone `src/app/api/tools/hooks/route.ts` exactly.
```typescript
// Source: src/app/api/tools/hooks/route.ts:151-270
send("stage", { name: "Generating", status: "active" });
const { blocks, warnings } = await runScriptPipeline({ ask, platform, profileRow, anchor });
send("stage", { name: "Generating", status: "done" });
send("stage", { name: "Self-judge", status: "active" }); send("stage", { name: "Self-judge", status: "done" });
send("stage", { name: "Simulating your audience", status: "active" }); /* ...done */
send("content", { blocks: blocks.map(b => ({ type: b.type, props: { /* face fields, band/fraction deferred */ } })) });
for (const b of blocks) send("score", { band: b.props.band, fraction: b.props.fraction, model: b.props.model });
if (blocks.length > 0) await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);
send("done", { count: blocks.length });
```
*(Note: stage transitions are coarse — emitted around the single awaited runner call. Per-phase callbacks are deferred — STATE Phase 05-04 decision. Match that posture.)*

### Pattern 3: Typed card block (schema + registry + renderer)
**What:** Define a Zod schema `{ type: z.literal("script-card"), props: z.object({...}) }`, add to `BlockUnionSchema`, register `{ schema }` in `BLOCK_REGISTRY`, wire the renderer in `BLOCK_COMPONENTS`. Double-validated (runner output boundary + rehydration via `validateBlock`). Renderer owns ALL layout — model emits props only (THREAD-04).
**When to use:** `script-card` + `remix-card`.
```typescript
// Source: src/lib/tools/blocks.ts (HookCardBlockSchema pattern)
export const ScriptCardBlockSchema = z.object({
  type: z.literal("script-card"),
  props: z.object({
    beats: z.array(z.object({
      label: z.string(),            // e.g. "Hook", "Setup", "Turn", "Payoff", "CTA"
      content: z.string(),          // the scripted line(s)
      timing: z.string(),           // per-beat timing (D-02) — e.g. "0–3s"
      retentionMarker: z.string(),  // "why this beat holds attention" (D-02)
    })),
    openingBeatSeed: z.string(),    // the line fed to the Flash hook-beat gate (D-01)
    band: z.enum(["Strong", "Mixed", "Weak"]),  // opening-beat Flash band only
    fraction: z.string(),           // e.g. "6/10 stop"
    scrollQuote: z.string(),
    model: z.literal("sim1-flash"),
    // honesty: band/fraction describe the OPENER ONLY — label it as such in the renderer
  }),
});
```
*(Exact beat schema/timing units/copy = Claude's discretion within D-02's beats+timing+retention shape.)*

### Pattern 4: Chain handoff (context vs card)
**What:** `anchorFrom:"context"` → card invokes a React-context callback the composer lifts (no card-level fetch); `anchorFrom:"card"` → card POSTs its own props to an endpoint.
**When to use:** `script→test` = context (mirror `hooks→test`/`handleTestHook`); `remix→hooks` = card (POST adapted concept to `/api/tools/ideas/develop` or a remix-specific develop, carrying the adapted hook as anchor).
```typescript
// Source: src/lib/hook-test-context.tsx + composer.tsx:235
// Script→Test: lift a handler in the composer, provide via context, card invokes it.
const handleTestHook = useCallback((line, archetype) => { setActiveTool("test"); setTestBrief({ ... }); }, []);
// chain-handoff.ts placeholder script→test is ALREADY { endpoint: null, anchorFrom: "context" } — just wire the view.
```

### Anti-Patterns to Avoid
- **Wiring old-board remix UI** (`components/board/adapt/AdaptConceptCard.tsx`, `RemixedFromChip.tsx`) — pre-numen-rework, DEAD. Reference for concept shape only; build a fresh `remix-card` (D-06).
- **Hunting for `analyze/[id]/script/route.ts`** — CONFIRMED ABSENT. Script is greenfield (watch-out verified).
- **Calling `runPredictionPipeline` / Max scoring from decode** — decode runs on `analyzeVideoWithOmni` only; never the protected scorer (D-05a). Do not "improve" Remix by routing it through a full Reading.
- **Model-generated UI** — fixed renderers only (THREAD-04). The model emits validated props; never markup.
- **Mutating the module-level runner const with per-request grounding** — `assembleBundle` returns the volatile user message; the static `knowledgeBundle` is build-time (assembler.ts header, Pitfall #4).
- **Putting the json_object directive in the KC system prompt** — it lives in the runner's `*_OUTPUT_CONTRACT` (DashScope 400 if the word "json" is absent; KC prompt stays pure + cache-warm).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL → video bytes | Custom Apify/SSRF/rehost logic | `resolveAndRehost` | Preserves token-non-leak (T-03-01) + derive-and-drop cleanup (T-03-02); battle-tested |
| Structural video decode | A metadata/transcript "guess" rewrite | `analyzeVideoWithOmni` + `runDecode` | D-05: decode the REAL video (4 beats + repeatable + luck), Zod-validated, retry+Sentry built in |
| Niche adaptation | New adapt prompt | `generateAdaptConcepts` | Qwen-only, KC-grounded, content-leak guard (no luck/caption), bounded retry |
| SIM-1 Flash scoring | A new score path / calibration | `runFlashTextMode("hook")` + `aggregateFlash` | D-01: zero new calibration; thresholds (STRONG=6/MIXED=3) already empirically tuned |
| Open-thread persistence | New thread/message tables | `createOpenThreadLazy` + `insertMessage` | THREAD-07 proven; KC_GEN_VERSION stamping built in; re-validates blocks at write |
| Block validation | Ad-hoc prop checks | `validateBlock` / `*Schema.safeParse` | D-14 double-validation; invalid → `UnsupportedBlock` sentinel |
| Chain CTA wiring | One-off handoff code | `CHAIN_HANDOFFS` append + context/card pattern | STUDIO-03 SSOT; zero structural plumbing (D-07) |
| Test-handoff callback | New prop-threading | `HookTestContext` pattern | Proven seam; composer lifts `handleTestHook` |

**Key insight:** P6's correct shape is *composition of existing seams*, not new engineering. The risky-looking part (Remix's video decode) is the most thoroughly pre-built — the engine functions exist, are tested, and are already invoked in production via the `mode:'remix'` analyze branch.

## Runtime State Inventory

> Not a rename/refactor phase — this is additive feature work. Inventory is light but relevant for the decode-reuse + persistence surfaces.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Open-thread messages persist `body` (block JSON) + `kc_gen_version`. New `script-card`/`remix-card` blocks must pass `validateBlock` on rehydration or they become `UnsupportedBlock`. | Register both block types in `BLOCK_REGISTRY` + `BLOCK_COMPONENTS` BEFORE persisting any — else rehydration silently drops them. |
| Live service config | Remix uses Apify (`APIFY_TOKEN`) + Supabase `videos` bucket (`remix-temp/{requestId}.mp4`). | None — reuse `resolveAndRehost`'s existing env/bucket usage; cleanup is unconditional. |
| OS-registered state | None — verified (no OS-level registration in this feature). | None |
| Secrets/env vars | `APIFY_TOKEN`, `FLASH_MODEL`, `QWEN_*_MODEL`, `QWEN_SEED` all already consumed by reused modules. `QWEN_DECODE_MODEL` (optional override) exists. | None new. |
| Build artifacts | `compiled.ts` is GENERATED from `.planning/corpus/*.md` via `scripts/regen-kc.ts`. Adding a `script.md` slice requires re-running regen. | If a Script/Remix slice is authored, run `npx tsx scripts/regen-kc.ts` (do not hand-edit `compiled.ts`). |

## Common Pitfalls

### Pitfall 1: Forgetting to register the new block before persisting
**What goes wrong:** A `script-card` persisted before `BLOCK_REGISTRY` includes it rehydrates as `UnsupportedBlock` (validateBlock returns `{ok:false}` for unknown types).
**Why it happens:** Three files must change in lockstep: `blocks.ts` (schema + union), `block-registry.ts` (registry entry), `message-blocks.tsx` (component map). `BlockType` is `keyof typeof BLOCK_REGISTRY`, so TypeScript enforces the component-map completeness — but only at compile time.
**How to avoid:** Land schema + registry + component in one task before any route persists the block. The `BLOCK_COMPONENTS` record type forces completeness.
**Warning signs:** Cards render fine while streaming (from the content event) but vanish/placeholder on reload.

### Pitfall 2: Mode not added to assembler → assembleBundle throws
**What goes wrong:** `assembleBundle({mode:"script"})` throws "invalid input" because `modeSchema = z.enum(["idea","hooks","chat"])` rejects `"script"`/`"remix"`.
**Why it happens:** The assembler validates mode at the boundary (assembler.ts:201) and `MODE_ROLES` has no `script`/`remix` key.
**How to avoid:** Extend `modeSchema` + add `MODE_ROLES.script` / `MODE_ROLES.remix` (e.g. script = `["niche","audience","platform","wins","flops"]`, mirroring hooks). GROUND-02 anti-dilution: keep the slice tight (niche + relevant craft), not whole-profile.
**Warning signs:** Runner throws on the first generate call.

### Pitfall 3: DashScope json_object 400 — "messages must contain the word 'json'"
**What goes wrong:** Qwen rejects `response_format: json_object` if no message literally contains "json".
**Why it happens:** The compiled KC prompt is pure craft and carries no serialization directive.
**How to avoid:** Append a `SCRIPT_OUTPUT_CONTRACT` (static, byte-stable, contains the word "json") to the system content in the runner — exactly as `HOOKS_OUTPUT_CONTRACT` / `IDEAS_OUTPUT_CONTRACT` do.
**Warning signs:** 400 from DashScope on generate.

### Pitfall 4: Remix latency / Vercel maxDuration
**What goes wrong:** Resolve (Apify fetch + download + rehost) + Omni perception + decode + adapt + Flash can exceed the platform default (~60s) and 504.
**Why it happens:** Heavy chain — decode alone is 90s timeout with 1 retry; adapt is ~65s; the existing `/api/remix/adapt` route already sets `maxDuration = 300`, and `analyze/route.ts` does too.
**How to avoid:** Set `export const maxDuration = 300; export const runtime = "nodejs"; export const dynamic = "force-dynamic";` on the new Remix route (copy from adapt/route.ts:57-59). Stream stages so the user sees progress. Script stays cheap (single Flash on one beat).
**Warning signs:** Remix run dies silently at ~60s in production but works locally.

### Pitfall 5: Honesty-spine violation on the Script band
**What goes wrong:** Labeling the Script's Flash band as a full-watch/retention prediction.
**Why it happens:** Flash only predicts scroll-stop on the opening beat (D-01); the rest is the self-judge's job, not a fabricated number.
**How to avoid:** Renderer copy must scope the band to the OPENER ("this opener stops the scroll"). Never a view-count promise (ENGINE-03). The per-beat retention markers are craft reasoning, NOT scores.
**Warning signs:** UI implies the whole script's retention is SIM-scored.

### Pitfall 6: Decode returns null (graceful) — handle it, don't crash
**What goes wrong:** `runDecode` returns `null` on final failure (and `omniOutputToStructuralInput` returns null if Omni perception failed). The runner must treat null as "decode unavailable" and surface an error state, not throw.
**Why it happens:** Decode has fail-fast timeouts; video fetch can fail.
**How to avoid:** Mirror `runDecodeStream` (analyze/route.ts:348-355): `structural ? await runDecode(structural) : null`, then branch. Surface a `SkillRunError` (the existing tap-to-retry block) on null. ALWAYS call `cleanup()` in `finally`.
**Warning signs:** Unhandled null → adapt receives empty input → cascade failure.

## Code Examples

### Extend CHAIN_HANDOFFS (D-07, 4-step procedure documented in-file)
```typescript
// Source: src/lib/tools/chain-handoff.ts (placeholders ALREADY present, lines 121-153)
// Step 1: add to union
export type SkillId = "idea" | "hooks" | "script" | "remix" | "test"; // already present
// Step 2: set endpoints on existing placeholders (do NOT add new entries — they exist)
//   hooks→script: endpoint = "/api/tools/script"   (anchorFrom: "card")
//   script→test:  endpoint = null                  (anchorFrom: "context" — HookTestContext-style)
//   remix→hooks:  endpoint = "/api/tools/remix/develop" (anchorFrom: "card")
// Step 3: implement runner + card renderer
// Step 4: wire context in the thread view for the null-endpoint (context) handoff
```

### Remix runner core (revive engine/remix — D-05/D-06)
```typescript
// Source: composed from analyze/route.ts:343-355 (runDecodeStream) + decode-types.ts:210
import { resolveAndRehost } from "@/lib/engine/remix/resolve-and-rehost";
import { analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";
import { runDecode, omniOutputToStructuralInput } from "@/lib/engine/remix/decode";
import { decodeResultToAdaptInput } from "@/lib/engine/remix/decode-types";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";

const { signedUrl, cleanup } = await resolveAndRehost(url, requestId);
try {
  const omni = await analyzeVideoWithOmni(signedUrl);          // perception, NOT Max scoring (D-05a GREEN)
  const structural = omniOutputToStructuralInput(omni);
  const decode = structural ? await runDecode(structural) : null;
  if (!decode) { /* surface SkillRunError */ return; }
  const adaptInput = decodeResultToAdaptInput(decode, niche);   // luck never mapped in (D-01 guard)
  const concepts = await generateAdaptConcepts(adaptInput);     // 3 concepts; pick 1 OR keep set (discretion)
  // Flash-gate the chosen adapted hook, build remix-card, persist to open thread.
} finally {
  await cleanup(); // derive-and-drop — UNCONDITIONAL (T-03-02)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old-board Remix UI (`AdaptConceptCard`, `RemixedFromChip`) | Fresh thread `remix-card` typed block | numen-rework (v5.0) | Old UI is dead; reuse the engine LOGIC only (D-06) |
| `analyze/[id]/script/route.ts` (cited in 05-CONTEXT) | Does NOT exist on this branch | n/a | Script is greenfield — verified absent |
| Per-tool one-off chain wiring | `CHAIN_HANDOFFS` SSOT (append-only) | P5 (05-04) | P6 plugs in with zero structural plumbing |
| 10-pass audience sim / text fold | omni-flash fold + Apollo rubric-sum (Max path) | engine-hardening (3.4→3.19) | Irrelevant to P6 — decode/Script never touch the Max scorer |

**Deprecated/outdated:**
- `components/board/adapt/*` — pre-numen-rework board UI. Do not import.
- `training-data.json` exemplars — explicit liability, not an asset (REQUIREMENTS Out of Scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new `/api/tools/remix/run` SSE route is preferred over reusing `/api/remix/adapt` | Stack Alternatives | Low — D-06 explicitly leaves this to post-scout Claude's discretion; the existing route's shape (non-SSE, Reading-row persist) makes reuse awkward but possible |
| A2 | Script reuses a sibling test-context (or generalized TestBriefContext) rather than `HookTestContext` verbatim | Pattern 4 | Low — D-07 allows either; the chain-handoff placeholder is already `anchorFrom:"context"` |
| A3 | Remix output = 1 chosen card into Hooks (studio one-card feel) vs the 3-concept adapt set | Diagram / Don't-Hand-Roll | Low — explicitly Claude's discretion (CONTEXT Area 6 + Deferred); planner decides |
| A4 | A `script` MODE_ROLES set mirroring hooks (`niche/audience/platform/wins/flops`) is the right grounding slice | Pitfall 2 | Medium — GROUND-02 anti-dilution; the exact role set should be confirmed against the authored Script slice |
| A5 | Script/Remix reuse the Hooks KC slice rather than getting a new authored slice | KC grounding (Open Q1) | Medium — affects generation quality; see Open Question 1 |

**Most claims are VERIFIED against live code.** The assumptions above are all design-choice areas the CONTEXT already flagged as Claude's discretion or post-scout decisions.

## Open Questions

1. **KC slice for Script/Remix: new authored slice vs reuse Hooks slice?**
   - What we know: `compiled.ts` has only `KC_BASE`, `KC_IDEAS_SLICE`, `KC_HOOKS_SLICE`, `KC_CHAT_SLICE` (no script/remix). Corpus has `base.md`, `ideas.md`, `hooks.md`, `chat.md` only — **no `script.md`/`remix.md` authored** (P2 GROUND-01 did not author them). The Remix adapt prompt already grounds in `KNOWLEDGE_CORE` (apollo-core) via `§6 Rewrite + §2`, and the engine `remix-core-grounding.test.ts` asserts decode/adapt reference the shared core.
   - What's unclear: Whether Script generation quality needs a dedicated `KC_SCRIPT_SYSTEM_PROMPT` (script craft: beat structure, pacing, retention) or can ride `KC_HOOKS_SYSTEM_PROMPT` + an output contract. Script craft (multi-beat structure) is meaningfully different from hook craft (first-2s).
   - Recommendation: **Author a thin `script.md` slice** (beats/pacing/retention craft) → regen-kc → `KC_SCRIPT_SYSTEM_PROMPT`. For Remix, **reuse the existing `KNOWLEDGE_CORE`-grounded adapt prompt** (no new slice — adapt already works). Confirm against GROUND-02 anti-dilution (tight slice, not whole-profile). This is a content workstream — flag for the planner as a likely Wave-0 dependency for the Script runner.

2. **`structure_pacing` beat-id naming in remix-card display**
   - What we know: decode emits beats `hook_pattern · structure_pacing · the_turn · emotional_beat` (decode-types.ts); the adapter renames `structure_pacing → structure`.
   - What's unclear: The exact `remix-card` face composition (which decode/adapt fields are face vs expand).
   - Recommendation: Mirror the AdaptConcept UI mapping documented in decode-types.ts:178-192 (hook → headline, format_borrowed → "Borrowed:" chip, angle/who_its_for → sub-rows) but in the flat-warm thread-card style. Claude's discretion within D-02-equivalent shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Qwen / DashScope (`getQwenClient`) | Both skills (generate + Flash) | ✓ (in use across engine) | n/a | — (Qwen-only, no fallback by constraint) |
| Apify (`APIFY_TOKEN`) | Remix resolve | ✓ (used by analyze remix mode) | n/a | — (URL resolve fails → SkillRunError) |
| Supabase `videos` bucket | Remix temp rehost | ✓ (used by resolveAndRehost) | n/a | — |
| `analyzeVideoWithOmni` (Omni perception) | Remix decode | ✓ | n/a | decode returns null → graceful error |
| Vitest | Tests | ✓ | (package.json) | — |

**Missing dependencies with no fallback:** none — all reused infrastructure is live.
**Missing dependencies with fallback:** none.

## Validation Architecture

> nyquist_validation not explicitly false in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <path>` (single file) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRIPT-01 | runScriptPipeline: generate → opening-beat Flash gate → one script-card | unit | `npx vitest run src/lib/tools/runners/__tests__/script-runner.test.ts` | ❌ Wave 0 |
| SCRIPT-01 | ScriptCardBlockSchema validates + rehydrates (D-14) | unit | `npx vitest run src/lib/tools/__tests__/blocks-script.test.ts` | ❌ Wave 0 |
| SCRIPT-01 | /api/tools/script SSE: auth, caps, persist, content-first | unit | `npx vitest run src/app/api/tools/script/__tests__/route.test.ts` | ❌ Wave 0 |
| REMIX-01 | runRemixPipeline: resolve→decode→adapt→flash→remix-card; cleanup in finally; null-decode graceful | unit | `npx vitest run src/lib/tools/runners/__tests__/remix-runner.test.ts` | ❌ Wave 0 |
| REMIX-01 | RemixCardBlockSchema validates + rehydrates | unit | `npx vitest run src/lib/tools/__tests__/blocks-remix.test.ts` | ❌ Wave 0 |
| REMIX-01 (D-05a) | Engine suite stays green; ENGINE_VERSION unchanged (3.19.0) | regression | `npm test -- src/lib/engine` | ✅ exists (`version.test.ts`, `decode.test.ts`, `adapt.test.ts`, `omni-to-structural.test.ts`, `remix-core-grounding.test.ts`) |
| Both | CHAIN_HANDOFFS endpoints resolve for script/remix | unit | `npx vitest run src/lib/tools/__tests__/chain-handoff.test.ts` (extend existing) | ⚠️ extend |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` + `npm run lint`
- **Per wave merge:** `npm test -- src/lib/engine` (REGRESSION GATE — must stay green, D-05a) + the wave's new tests
- **Phase gate:** full `npm test` green + `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tools/__tests__/blocks-script.test.ts` + `blocks-remix.test.ts` — schema/registry/rehydration (D-14)
- [ ] `src/lib/tools/runners/__tests__/script-runner.test.ts` — gate-on-opening-beat, one-card
- [ ] `src/lib/tools/runners/__tests__/remix-runner.test.ts` — full chain + cleanup + null-decode (mock engine fns)
- [ ] `src/app/api/tools/{script,remix}/__tests__/route.test.ts` — auth/caps/persist/SSE (clone hooks route test)
- [ ] Extend `chain-handoff.test.ts` for new SkillIds + endpoints
- [ ] **Regression gate baseline:** confirm `npm test -- src/lib/engine` green BEFORE starting (existing infra covers it — no new framework install needed)

## Security Domain

> security_enforcement enabled (default). Both skills cross trust boundaries (user input → LLM, pasted URL → server fetch).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` → 401 FIRST, before any DB/LLM work (clone hooks/adapt routes) |
| V4 Access Control | yes (Remix decode persists to a Reading; Script persists to open thread) | Open-thread: user_id from session only (never body). If Remix writes a Reading row: ownership `select user_id → 404` (adapt route T-04-05 pattern) |
| V5 Input Validation | yes | Server-side ask/anchor caps (MAX_MESSAGE_LENGTH=2000, MAX_ANCHOR_LENGTH=5000); URL regex validate (Remix); `assembleBundle` injection fence (`<<<USER_CONTENT>>>`) |
| V6 Cryptography | no (no new crypto) | — |
| CSRF | yes (state-changing POST) | Content-Type 415 + cross-origin 403 guards (adapt route T-04-07 pattern) |
| SSRF | yes (Remix fetches a user-pasted URL) | `resolveAndRehost` uses `ApifyScrapingProvider.resolveVideoUrl` (SSRF-validated); token never leaves server (T-03-01) |

### Known Threat Patterns for {Next.js SSE + LLM + user-pasted URL}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via ask/anchor/URL metadata | Tampering | `assembleBundle` fences user content; sentinel-strip; never interpolate raw user text into the system prompt |
| SSRF via pasted Remix URL | Information Disclosure | `resolveAndRehost` SSRF-validated resolver; server-side fetch only; derive-and-drop temp object |
| Apify token leak | Information Disclosure | Token appended ONLY to server-side fetch URL, NEVER to the Omni-facing signed URL (T-03-01) |
| Cross-user thread write | Elevation of Privilege | user_id from session; ownership 404 on any Reading-row write |
| Content-leak (luck/caption into adapt) | Information Disclosure | `AdaptInput` is a compile-time guard — no `luck[]`/caption fields (D-01); adapter never maps luck in |
| Unbounded LLM cost | DoS | Bounded retries (decode 1, adapt 1); single Flash on one beat for Script; no regen loops |
| Temp video orphan | — | `cleanup()` in `finally` (unconditional) — T-03-02 |

## Sources

### Primary (HIGH confidence) — live code on `milestone/numen-tools`
- `src/lib/tools/chain-handoff.ts` — CHAIN_HANDOFFS SSOT + pre-staged placeholders + 4-step extend procedure
- `src/lib/tools/runners/{hooks,ideas}-runner.ts` — runner template
- `src/lib/tools/tool-runner.ts` — THREAD-06 contract + dispatch
- `src/lib/tools/{blocks,block-registry}.ts` — typed-block schema + registry pattern
- `src/components/thread/{hook-card-block,hooks-thread-view,message-blocks}.tsx` — renderer + context-handoff + registry wiring
- `src/lib/engine/flash/{run-flash-text-mode,flash-aggregate}.ts` — Flash gate (reused unchanged) + thresholds
- `src/lib/engine/remix/{resolve-and-rehost,decode,adapt,decode-types}.ts` — Remix revive surface
- `src/app/api/analyze/route.ts:317-372,888-921` — `runDecodeStream` (D-05a proof: decode disjoint from runPredictionPipeline)
- `src/app/api/remix/adapt/route.ts` — adapt route (security controls + maxDuration=300)
- `src/app/api/tools/hooks/route.ts` + `ideas/develop/route.ts` — SSE route + pinned endpoint template
- `src/lib/kc/{assembler,compiled}.ts` + `.planning/corpus/*.md` — grounding (no script/remix slice exists)
- `src/components/app/home/composer.tsx:235-345` — `handleTestHook` context-handoff seam + activeTool routing
- `src/lib/engine/version.ts` + `__tests__/version.test.ts` — ENGINE_VERSION=3.19.0 regression gate
- `src/lib/hook-test-context.tsx` — context-handoff callback pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/06-script-remix-tools/06-CONTEXT.md` — locked decisions D-01..D-07
- `.planning/REQUIREMENTS.md` / `STATE.md` — SCRIPT-01/REMIX-01 + cross-cutting constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all internal modules read directly; zero new packages
- Architecture: HIGH — runner/route/block/handoff patterns proven twice (ideas+hooks) and read verbatim
- D-05a verdict: HIGH — traced full call graph; decode confirmed disjoint from `runPredictionPipeline`/`ENGINE_VERSION`/`prediction-cache`
- Pitfalls: HIGH — derived from in-code comments documenting the exact failure modes
- KC grounding (Open Q1): MEDIUM — no script/remix slice exists; authoring need is a judgment call

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable internal surface; revisit if engine version bumps or P5 chain plumbing changes)
