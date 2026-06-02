# Phase 4: Adapt Frame + Niche - Research

**Researched:** 2026-06-02
**Domain:** Qwen-only structured-output generation (DashScope/OpenAI SDK) + remix board frame wiring + creator-profile niche reuse + `variants` JSONB persistence/rehydrate
**Confidence:** HIGH (all findings file:line-grounded in the live codebase; no external deps introduced)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Decode→Adapt Contract (parallel-work linchpin)**
- **D-01:** Adapt's input is the **4 structural fields** (`hook_pattern`, `structure`, `the_turn`, `emotional_beat`) **plus the `repeatable[]` lane items** — and *nothing else*. The **luck lane is excluded** and the **raw source caption is never passed**. Content-copying is structurally impossible.
- **D-02:** Contract pinned as a **canonical TypeScript type** in a **new file `src/lib/engine/remix/decode-types.ts`** plus a realistic `decode.fixture.ts` in the same dir. Phase 4 builds against the fixture.
- **D-03:** Phase 3 (Decode) MUST import the type from `decode-types.ts` — must NOT redefine its own decode output shape. Single source of truth.

**Generation Trigger & Flow**
- **D-04:** Concepts **auto-generate** once Decode completes, **when a niche is present** — no extra click. Single lightweight Qwen call (NOT `runPredictionPipeline`).
- **D-05:** Adapt output **persisted to `variants.remix.adapt`** and **rehydrated on permalink reload** — not regenerated on reload.
- **D-06:** Adapt frame **fails independently of Decode** — malformed/failed adapt renders an Adapt-frame error/empty state while Decode still renders.
- **D-07:** **No regenerate/reroll** affordance this phase. One auto-generated set of 3.

**Concept Card Anatomy (Adapt occupies Actions' old tall right-column bounds)**
- **D-08:** 3 concepts render as **three stacked cards**, all fully visible (no accordion, no tabs). Raycast card language (12px radius, 6% border).
- **D-09:** Within each card: **`hook` is the bold headline**, **`format_borrowed` is a small chip/label** (e.g. "Borrowed: open-loop cold open"), **`angle` + `who_its_for` render as quiet muted sub-rows**.
- **D-10:** Mobile card-stack (`BoardMobile.tsx`, <768px) mirrors desktop — 3 stacked cards in the Adapt slot.

**Empty-Niche Inline Prompt (ADAPT-02)**
- **D-11:** Empty niche = **`niche_primary` AND `niche_sub` both null**. When empty, embed the **existing `NichePicker`** (compact variant) **inline in the Adapt frame** — pick in place, then concepts generate.
- **D-12:** Niche picked inline is **persisted to `creator_profile`** (PATCH `niche_primary`/`niche_sub` via existing `/api/profile/creator-profile`), **then** concepts generate.

### Claude's Discretion
- Exact compact styling/density of the inline `NichePicker` inside a board frame (must conform to Raycast — 6% borders, 8px radius, Inter).
- The Qwen adapt **prompt design** enforcing "exactly 3 distinct concepts" and "format not content" — structured-output schema + repair/retry strategy on malformed/short output.
- Exact `format_borrowed` chip copy/derivation and muted-row typography for angle/who-it's-for.
- The realistic content of `decode.fixture.ts` — hand-author a representative repeatable-lane fixture now; swap for a captured real decode once Phase 3 lands.
- Whether the Adapt source type / concept type are threaded as typed unions in TS and where `engine/remix/adapt.ts` is wired into the remix path.

### Deferred Ideas (OUT OF SCOPE)
- **Concept regenerate/reroll** — one set of 3 this phase (D-07).
- **"Develop & predict →" per-concept scoring + `parent_id` lineage + "remixed from" chip** — Phase 5.
- **Decode frame content itself** — Phase 3; consumed via fixture until it lands.
- **Free-text / richer niche capture beyond the taxonomy** — out of scope; taxonomy `NichePicker` is the niche source.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADAPT-01 | Adapt frame renders exactly 3 concepts, each adapting the source's *format/structure* (not content) to the niche, each with `angle`, `hook`, `who_its_for`, `format_borrowed`, generated Qwen-only in `engine/remix/adapt.ts` | Qwen structured-output pattern (`omni-analysis.ts`, `wave3/pass2.ts`); Zod `.length(3)` enforcement + repair loop; prompt receives only D-01 structural fields |
| ADAPT-02 | Adapt grounded in creator-profile niche; empty profile prompts inline before concepts generate | `useCreatorProfile`/`useUpdateCreatorProfile` (`use-creator-profile.ts`); `NichePicker` controlled API; `niche_primary`/`niche_sub` PATCH (`creator-profile/route.ts:92`); taxonomy label helpers |
</phase_requirements>

## Summary

Phase 4 is **overwhelmingly a wiring + prompt-engineering task** with **zero new npm dependencies** (REQUIREMENTS Out of Scope confirms this). Every capability needed already exists in the codebase: the Qwen structured-output call pattern, the `variants` JSONB read-merge-write persistence seam, the dual-read rehydrate pattern, the `NichePicker` controlled component, and the creator-profile GET/PATCH hooks. The genuine net-new surface is exactly four files: `decode-types.ts` (contract), `decode.fixture.ts` (stub), `adapt.ts` (the Qwen generator), and the Adapt frame body React tree (`AdaptFrameBody.tsx` + `AdaptConceptCard.tsx`).

The single most important architectural decision the planner must make is **WHERE the adapt Qwen call runs**. The Phase 2 board frames (`AdaptShellNode`, `ContentAnalysisFrame`) take **no result props** — they self-source data via `useAnalysisStream` + `usePermalinkAnalysis` and do a **dual-read** (live `PredictionResult` top-level vs persisted `variants.X` nested). Decode is Phase 3's; Adapt depends on Decode's `repeatable[]` lane (D-01). Given D-04 (auto after Decode), D-05 (persist + rehydrate, no regen), and D-06 (independent failure), the clean, parallel-safe architecture is a **dedicated client-triggered POST endpoint** (`/api/remix/adapt`) that the `AdaptFrameBody` calls once it observes (a) Decode output is present and (b) a niche exists — the endpoint runs one Qwen call, merges into `variants.remix.adapt` via the proven read-merge-write helper, and returns the concepts. This keeps adapt entirely off `runPredictionPipeline`/`usage_tracking`/`DAILY_LIMITS` and isolates its failure from Decode.

The content-copying defense (ADAPT-01 success criterion 2) is **structural, not behavioral**: it is enforced by the D-01 contract — the adapt prompt's input is assembled in code from only the 4 structural fields + `repeatable[]`, and the raw source caption / `content_summary` is never in scope to pass. The planner must verify the adapt input-builder physically cannot reach the source caption.

**Primary recommendation:** Build `decode-types.ts` first (contract, both worktrees converge on it). Then `adapt.ts` as a single `qwen3.6-plus` JSON-mode call mirroring `wave3/pass2.ts` (temp:0, seed:7, maxRetries:0, manual retry loop, Zod `.length(3)` validation + a repair attempt on short/invalid output). Wire a `/api/remix/adapt` endpoint that read-merge-writes `variants.remix.adapt` (mirroring `persistCraftToVariants`). Build the frame body as a self-sourcing client component (mirroring `ContentAnalysisFrame`) reusing `NichePicker` + `useCreatorProfile`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 3-concept generation (Qwen call) | API / Backend (`/api/remix/adapt` → `engine/remix/adapt.ts`) | — | API key (`DASHSCOPE_API_KEY`) is server-only; the generator already lives engine-side. Never call Qwen from the browser. |
| Decode→Adapt contract type | Shared lib (`engine/remix/decode-types.ts`) | — | Pure TS, imported by both worktrees + the adapt generator. No tier — it's a type. |
| Adapt persistence (`variants.remix.adapt`) | API / Backend (read-merge-write into `analysis_results`) | Database | Mirrors `persistCraftToVariants` (route.ts:102). RLS + service client server-side. |
| Niche read (creator-profile) | API / Backend (GET `/api/profile/creator-profile`) | Frontend (`useCreatorProfile` TanStack query) | Existing route + hook; auth enforced server-side. |
| Niche write (inline picked) | API / Backend (PATCH `/api/profile/creator-profile`) | Frontend (`useUpdateCreatorProfile`) | Existing route; CSRF + RLS already implemented (route.ts:115-125,187). |
| Concept cards render | Frontend Server (RSC tree) → Client (interactive frame body) | — | Frame body is `'use client'` (it self-sources stream/permalink data + holds picker state). Cards themselves are static DOM. |
| Empty-niche inline prompt | Client (`NichePicker` is controlled, interactive) | — | Reuse wholesale (`niche-picker.tsx`). |
| Frame mount (desktop + mobile) | Client (Board.tsx overlay loop; BoardMobile.tsx card list) | — | DOM overlay, NOT Konva (Phase 2 Pattern 1). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` (DashScope compat) | installed | Qwen chat completions via `getQwenClient()` | The engine's sole LLM transport. `client.ts:7-18` wraps OpenAI SDK pointed at `dashscope-intl.aliyuncs.com/compatible-mode/v1`. [VERIFIED: src/lib/engine/qwen/client.ts:1-18] |
| `zod` | installed | Validate Qwen JSON output (enforce exactly-3, field presence) | Every Qwen call in the engine Zod-validates + repairs. [VERIFIED: src/lib/engine/qwen/schemas.ts, wave3/pass2.ts:190] |
| `@tanstack/react-query` | installed | `useCreatorProfile` / `useUpdateCreatorProfile`, permalink query | Existing data layer. [VERIFIED: src/hooks/queries/use-creator-profile.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | installed | request IDs for the adapt endpoint logger | If adding `/api/remix/adapt`, mirror route.ts:171 |
| `@sentry/nextjs` | installed | capture adapt-call failures | Mirror `omni-analysis.ts:282` |

### Models (Qwen-only — memory [[qwen-only-pipeline]])
| Constant | Default | Use for Adapt? |
|----------|---------|----------------|
| `QWEN_OMNI_MODEL` | `qwen3.5-omni-plus` | NO — Omni is for video input; adapt has no video |
| `QWEN_REASONING_MODEL` | `qwen3.6-plus` | **YES (recommended)** — reasoning over structural fields → 3 concepts. Same model `wave3/pass2.ts` + the text-analysis branch (pipeline.ts:673) use. [VERIFIED: src/lib/engine/qwen/client.ts:32] |
| `QWEN_FAST_MODEL` | `qwen3.6-flash` | Possible cheaper alternative; `platform-fit.ts`/`wave3.ts` use it. Tradeoff: less structural-reasoning fidelity. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `/api/remix/adapt` endpoint | Chain adapt inside the SSE pipeline after Decode | Couples adapt to pipeline lifecycle, complicates independent-failure (D-06), and forces adapt onto the scoring path's `usage_tracking` flow. Separate endpoint is cleaner for D-04/D-06. |
| `qwen3.6-plus` | `qwen3.6-flash` | Flash is cheaper/faster but weaker at the "3 *distinct* angles, format-not-content" reasoning. Use plus unless cost measured as a problem. |

**Installation:** None. REQUIREMENTS Out of Scope: "New npm dependencies — Research confirmed all capabilities exist in installed deps." [VERIFIED: .planning/REQUIREMENTS.md:60]

**Version verification:** No new packages → no registry verification needed. All imports resolve to existing in-repo modules.

## Package Legitimacy Audit

**No external packages are installed in this phase.** The phase uses only already-installed deps (`openai`, `zod`, `@tanstack/react-query`, `nanoid`, `@sentry/nextjs`) and in-repo modules. Slopcheck not applicable — no install step exists. REQUIREMENTS explicitly forbids new npm dependencies. [VERIFIED: .planning/REQUIREMENTS.md:60]

## Architecture Patterns

### System Architecture Diagram

```
                       Phase 3 (parallel worktree)              Phase 4 (this worktree)
                       ───────────────────────────             ─────────────────────────
  remix video  ──►  pipeline.ts tiktok_url Omni branch
  (TikTok URL)        │  (resolve → re-host → Omni → derive-and-drop)
                      ▼
              Decode Qwen call (Phase 3, engine/remix/decode.ts)
                      │  produces DecodeOutput { hook_pattern, structure,
                      │  the_turn, emotional_beat, repeatable[], luck[] }
                      ▼
              persist → variants.remix.decode   ◄── decode-types.ts (CONTRACT, this phase)
                      │                                    │ imported by BOTH worktrees (D-02/D-03)
                      │                                    ▼
                      │                          decode.fixture.ts (stub Adapt builds against)
                      │
   ═══════════════════╪═══════════════════════════════════════════════════════════
                      │  (Adapt path — independent of Decode failure, D-06)
                      ▼
   AdaptFrameBody (client) observes:
     (a) decode present?  (b) niche present (creator_profile)?
            │                        │
            │ niche EMPTY ──► inline NichePicker ─► PATCH /api/profile/creator-profile ─┐
            │                                          (niche_primary, niche_sub)        │
            ▼ niche PRESENT (auto, D-04)  ◄────────────────────────────────────────────┘
   POST /api/remix/adapt  { decodeOutput.repeatable[] + 4 structural fields, niche }
            │  ── input builder NEVER includes raw source caption (D-01 structural guard) ──
            ▼
   engine/remix/adapt.ts  →  qwen3.6-plus JSON mode (temp:0, seed:7, maxRetries:0)
            │  Zod validate: exactly 3 concepts, each {hook, angle, who_its_for, format_borrowed}
            │  on short/invalid → 1 repair attempt (mirrors omni-analysis MAX_RETRIES loop)
            ▼
   read-merge-write → variants.remix.adapt   (mirrors persistCraftToVariants, route.ts:102)
            │
            ▼
   AdaptFrameBody renders 3 AdaptConceptCard
   (desktop: Board.tsx overlay slot; mobile: BoardMobile.tsx adapt slot)
            │
            ▼ on permalink reload (D-05)
   dual-read: live PredictionResult top-level  OR  persisted variants.remix.adapt
   (mirrors ContentAnalysisFrame.tsx:79-99) — NO regeneration
```

### Recommended Project Structure
```
src/lib/engine/remix/
├── decode-types.ts          # NEW — canonical DecodeOutput type (D-02, both worktrees import)
├── decode.fixture.ts        # NEW — realistic repeatable-lane fixture (D-02)
├── adapt.ts                 # NEW — generateAdaptConcepts(decode, niche): single Qwen call
└── __tests__/
    └── adapt.test.ts        # NEW — exactly-3 enforcement, repair loop, no-caption guard

src/app/api/remix/adapt/
└── route.ts                 # NEW — POST: validate → adapt.ts → merge variants.remix.adapt

src/components/board/adapt/
├── AdaptShellNode.tsx       # EXISTS (Phase 2 shell) — replace body with AdaptFrameBody
├── AdaptFrameBody.tsx       # NEW — orchestrates loading → niche-prompt → 3 cards (UI-SPEC)
├── AdaptConceptCard.tsx     # NEW — one card: hook headline + chip + angle/who-it's-for rows
└── __tests__/

src/hooks/queries/
└── use-adapt-concepts.ts    # NEW (optional) — TanStack mutation calling /api/remix/adapt
```

### Pattern 1: Qwen structured-output call (the canonical adapt.ts template)
**What:** A single `chat.completions.create` with `response_format: { type: "json_object" }`, `temperature: 0`, `seed: QWEN_SEED`, wrapped in a manual retry loop with Zod validation and a repair instruction on the second attempt.
**When to use:** `engine/remix/adapt.ts` exactly mirrors this. Note `maxRetries:0` on the client (client.ts:15) means **the app owns the retry loop** — do NOT rely on SDK retries.
```typescript
// Source: src/lib/engine/qwen/omni-analysis.ts:161-212 (the canonical retry+repair shape)
const MAX_RETRIES = 1; // 2 total attempts
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const extraInstruction = attempt > 0
      ? "\nIMPORTANT: Return EXACTLY 3 concepts as valid JSON, no explanation."
      : "";
    const completion = await ai.chat.completions.create({
      model: QWEN_REASONING_MODEL,                 // qwen3.6-plus
      messages: [
        { role: "system", content: SYSTEM_PROMPT + extraInstruction }, // keep STABLE for cache prefix
        { role: "user",   content: buildAdaptUserContent(decode, niche) },
      ],
      response_format: { type: "json_object" },
      temperature: 0,                              // reproducible (client.ts:20-28)
      seed: QWEN_SEED,                             // 7
    }, { signal: controller.signal });
    clearTimeout(timer);
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripModelOutput(raw)); // strip <think> + fences (utils/strip.ts)
    const result = AdaptConceptsZodSchema.safeParse(parsed); // .length(3) enforced here
    if (!result.success) { lastError = result.error; continue; } // → repair attempt
    return result.data;
  } catch (err) { clearTimeout(timer); lastError = err; if (attempt >= MAX_RETRIES) break; }
}
// graceful failure: return null/empty → frame shows error state (D-06)
```

### Pattern 2: Enforce "exactly 3" with Zod (ADAPT-01)
**What:** `.length(3)` on the concepts array — the same technique `omni-analysis.ts` uses for `factors` (`.length(5)`) and `wave3/pass2.ts` uses for `segment_reactions.length` matching.
```typescript
// Source pattern: src/lib/engine/qwen/schemas.ts:125 (factors .length(5))
const AdaptConceptZodSchema = z.object({
  hook:           z.string().min(1).max(200),
  angle:          z.string().min(1).max(300),
  who_its_for:    z.string().min(1).max(200),
  format_borrowed: z.string().min(1).max(200),
});
const AdaptConceptsZodSchema = z.object({
  concepts: z.array(AdaptConceptZodSchema).length(3), // exactly 3 — ADAPT-01 crit 1
});
```
Belt-and-suspenders (mirrors pass2.ts:197 explicit count guard): after Zod, if `concepts.length !== 3` throw to trigger the repair attempt.

### Pattern 3: Read-merge-write into `variants` (the persistence seam, D-05)
**What:** Read current `variants`, spread it, add the new nested key, write back. The `variants` JSONB has **multiple concurrent writers** (`craft`, `filmstrip_segments`) — a wholesale overwrite would clobber them.
```typescript
// Source: src/app/api/analyze/route.ts:122-138 (persistCraftToVariants)
const { data: row } = await service.from("analysis_results").select("variants").eq("id", id).single();
const current = (row?.variants ?? {}) as Record<string, unknown>;
const currentRemix = (current.remix ?? {}) as Record<string, unknown>;
await service.from("analysis_results")
  .update({ variants: { ...current, remix: { ...currentRemix, adapt: concepts } } as unknown as Json })
  .eq("id", id);
```
**Critical:** nest as `variants.remix.adapt` so it coexists with `variants.remix.decode` (Phase 3) AND `variants.craft` (existing). Spread `current.remix` so Decode's write isn't clobbered if it lands first.

### Pattern 4: Self-sourcing frame body with dual-read rehydrate (D-05)
**What:** The frame body takes only `{ camera, layout }` props (like `ContentAnalysisFrame`) and self-sources data via `useAnalysisStream` + `usePermalinkAnalysis`, dual-reading live (top-level) vs persisted (`variants.X`).
```typescript
// Source: src/components/board/content-analysis/ContentAnalysisFrame.tsx:64-99
const { data: permalinkData } = usePermalinkAnalysis();          // @/hooks/queries/use-permalink-analysis
const stream = useAnalysisStream({ initialData: permalinkData ?? null });
const row = stream.result as unknown as AdaptRow | null;
// dual-read: on a fresh live result the adapt concepts may arrive via the mutation response (top-level
// state); on permalink reload they're nested under variants.remix.adapt. Read both.
const adapt = row?.variants?.remix?.adapt ?? liveAdaptState ?? null;
```
Note: unlike craft (which the engine emits inline so it's top-level on the live `PredictionResult`), **adapt is generated by a separate endpoint** — so the "live" source is the `/api/remix/adapt` mutation response held in local/TanStack state, and the "permalink" source is `variants.remix.adapt`. The dual-read still applies.

### Pattern 5: Inline NichePicker reuse (ADAPT-02 / D-11)
**What:** `NichePicker` is pure-controlled (`primary`/`sub`/`onChange`) — embed directly, hold state, gate the "Generate concepts" CTA until `sub` is selected, PATCH on confirm.
```typescript
// Source: src/components/app/cards/niche-picker.tsx:24-38 (controlled API)
const { data: profile } = useCreatorProfile();                       // use-creator-profile.ts:54
const updateProfile = useUpdateCreatorProfile();                     // use-creator-profile.ts:75
const nicheEmpty = profile?.niche_primary == null && profile?.niche_sub == null; // D-11
const [draft, setDraft] = useState({ primary: null, sub: null });
// on CTA: await updateProfile.mutateAsync({ niche_primary: draft.primary, niche_sub: draft.sub });
//         then trigger adapt generation (mutation invalidates the profile cache → nicheEmpty flips)
<NichePicker primary={draft.primary} sub={draft.sub} onChange={setDraft} />
```
The niche string to feed the prompt: `getPrimaryLabel(slug)` + `getSubLabel(primary, sub)` from `taxonomy.ts:330-335` (use labels, not slugs, for prompt readability).

### Anti-Patterns to Avoid
- **Calling Qwen from the browser** — `DASHSCOPE_API_KEY` is server-only (`client.ts:9`). Adapt generation MUST be a server route.
- **Wholesale `variants` overwrite** — would clobber `variants.craft` and `variants.remix.decode`. Always read-merge-write (Pattern 3).
- **Passing the source caption / `content_summary` into the adapt prompt** — violates D-01 and ADAPT-01 crit 2. The input builder must physically receive only the 4 structural fields + `repeatable[]`.
- **Relying on SDK retries** — client has `maxRetries:0` (client.ts:15). Own the loop (Pattern 1).
- **Adding adapt to `usage_tracking`/`DAILY_LIMITS`** — D-04: lightweight path, off the scoring quota.
- **Regenerating on permalink reload** — D-05: persisted row is source of truth; only generate when `variants.remix.adapt` is absent AND it's the live session.
- **Konva node for the frame body** — Phase 2 Pattern 1: remix frame bodies are DOM overlays (`Board.tsx:516-517` mounts `<AdaptShellNode />` as a child of `GroupFrameOverlay`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Qwen JSON-mode call + retry/repair | A new fetch wrapper | `getQwenClient()` + the omni-analysis retry loop (Pattern 1) | client owns endpoint, key, maxRetries:0 contract; `stripModelOutput` handles `<think>`/fences |
| Output validation | Manual field checks | Zod `.length(3)` + `.safeParse` (Pattern 2) | Matches every engine call; gives the repair-loop its trigger |
| `variants` persistence | New column / migration | Read-merge-write into `variants` JSONB (Pattern 3) | No migration needed (REQUIREMENTS); coexists with craft + decode |
| Niche input UI | A new niche selector | `NichePicker` (controlled, a11y-complete) | Already built, proven, role="group"/aria-pressed (niche-picker.tsx) |
| Niche read/write | New API route | GET/PATCH `/api/profile/creator-profile` + `useCreatorProfile`/`useUpdateCreatorProfile` | CSRF + RLS + Content-Type guards already implemented (route.ts:92-211) |
| Niche label resolution | Hardcoded niche names | `getPrimaryLabel`/`getSubLabel` (taxonomy.ts:330-335) | Single source of truth for slugs→labels |
| Permalink rehydrate | New fetch | `usePermalinkAnalysis` + dual-read (Pattern 4) | `/api/analysis/[id]` already `select("*")` returns `variants` + `mode` (analysis/[id]/route.ts:28) |

**Key insight:** This phase introduces no new infrastructure. The only judgment calls are the adapt prompt design and the endpoint placement — everything else is composing existing, tested seams.

## Runtime State Inventory

> This is a greenfield additive phase (new files + new nested JSON key), not a rename/refactor. No existing stored strings change.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `variants.remix.adapt` is a NEW nested key in the existing `analysis_results.variants` JSONB. No existing keys renamed. Coexists with `variants.craft` and (Phase 3) `variants.remix.decode`. | None — additive write only |
| Live service config | None — verified no external service stores adapt state | None |
| OS-registered state | None — verified no OS-level registration involved | None |
| Secrets/env vars | `DASHSCOPE_API_KEY` (existing, reused by `getQwenClient`); `QWEN_REASONING_MODEL` optional override (existing). No new secrets. | None — reuse existing |
| Build artifacts | None — TS source only, no compiled artifacts carry phase-specific names | None |

**The canonical question — what runtime systems still have old strings cached?** None. This phase adds a new JSONB sub-key and new files; it renames nothing.

## Common Pitfalls

### Pitfall 1: Content leak through the prompt (ADAPT-01 crit 2 / D-01)
**What goes wrong:** The adapt prompt receives the source caption or `content_summary`, so concepts reproduce the source's *subject* instead of borrowing its *format*.
**Why it happens:** The decode output object, if naively passed whole, may carry summary/caption fields; or a dev adds "for context" the source text.
**How to avoid:** The `buildAdaptUserContent(decode, niche)` builder must accept ONLY `{ hook_pattern, structure, the_turn, emotional_beat, repeatable[] }` + niche — and the `DecodeOutput` type's `repeatable[]`/4-field shape should be the *only* thing in scope at the call site. Exclude `luck[]` (D-01) and never thread `content_summary`/caption.
**Warning signs:** A test that feeds a decode fixture about "a chef's pasta recipe" and asserts the 3 concepts contain no food/pasta-specific nouns (only format language).

### Pitfall 2: Clobbering concurrent `variants` writers (D-05)
**What goes wrong:** Adapt's write overwrites `variants.craft` or `variants.remix.decode` because it does `update({ variants: { remix: { adapt } } })` instead of read-merge-write.
**Why it happens:** `variants` has ≥3 writers (craft route, filmstrip extract route, decode, adapt) that may land in any order (route.ts:96-100 documents the craft/filmstrip race).
**How to avoid:** Pattern 3 — read current `variants`, spread `current` AND `current.remix`, then set `remix.adapt`.
**Warning signs:** Craft pillars or Decode content blank out after an adapt write; a test that pre-seeds `variants.craft` + `variants.remix.decode` then writes adapt and asserts all three survive.

### Pitfall 3: Double-generation / regenerate on reload (D-05/D-07)
**What goes wrong:** The frame re-fires the adapt call on every permalink reload (cost + latency + non-determinism), or fires twice in one session.
**Why it happens:** No guard distinguishing "live, no concepts yet" from "permalink, concepts already persisted."
**How to avoid:** Generate only when `variants.remix.adapt` is absent AND this is the live session (a niche just resolved / decode just completed). On permalink with `variants.remix.adapt` present, render straight from it. Gate the mutation on an "already-fired" ref (mirrors `streamingAnalysisIdRef`, Board.tsx:182).
**Warning signs:** Network tab shows `/api/remix/adapt` POST on a permalink page load.

### Pitfall 4: Adapt failure cascades into Decode (D-06)
**What goes wrong:** A thrown adapt error or a shared loading boundary blanks the Decode frame too.
**Why it happens:** Frames sharing a try/catch or a single suspense boundary.
**How to avoid:** Adapt generation is its own endpoint + its own frame state machine (loading/niche-prompt/cards/error). Decode renders from `variants.remix.decode` independently. A null adapt result → Adapt error state only (UI-SPEC §Error State).
**Warning signs:** Killing the adapt endpoint blanks Decode; assert in a test that a failed adapt fetch leaves Decode content intact.

### Pitfall 5: Niche cache staleness after inline PATCH (D-12)
**What goes wrong:** User picks a niche inline, PATCH succeeds, but `useCreatorProfile` still returns the old (empty) niche, so the picker re-renders / adapt doesn't fire.
**Why it happens:** TanStack cache not invalidated, OR adapt fires before the PATCH resolves.
**How to avoid:** `useUpdateCreatorProfile` already invalidates `profile.creatorProfile()` on success (use-creator-profile.ts:95-99). Use `mutateAsync` and `await` it, then trigger adapt — don't race the invalidation. Pass the just-picked niche directly into the adapt call rather than re-reading the cache.
**Warning signs:** Picker doesn't dismiss after generate; adapt prompt receives a null niche.

### Pitfall 6: `<think>` tokens / fences break JSON.parse
**What goes wrong:** `qwen3.6-plus` (reasoning model) may emit `<think>...</think>` or markdown fences; raw `JSON.parse` throws.
**Why it happens:** Reasoning models prepend thinking blocks.
**How to avoid:** Always run `stripModelOutput(raw)` (utils/strip.ts:1-9) before `JSON.parse` — exactly as omni-analysis.ts:204 does.
**Warning signs:** Intermittent parse failures only on the reasoning model.

## Code Examples

### Decode→Adapt contract (decode-types.ts, D-02) — the input shape
```typescript
// Source: synthesized from ROADMAP Phase 3 crit 1 + CONTEXT D-01. Phase 3 MUST import this (D-03).
export interface RepeatableItem {
  label: string;          // e.g. "open-loop cold open"
  why_repeatable: string; // structural reason it can be reused
}
export interface DecodeOutput {
  hook_pattern:   string;            // the 4 structural fields (DECODE-01)
  structure:      string;
  the_turn:       string;
  emotional_beat: string;
  repeatable:     RepeatableItem[];  // the lane Adapt draws from (D-01)
  luck:           RepeatableItem[];  // EXCLUDED from adapt input (D-01) — present for the Decode frame only
}
// Adapt input builder receives ONLY the structural fields + repeatable[] (Pitfall 1):
export type AdaptInput = Pick<DecodeOutput,
  'hook_pattern' | 'structure' | 'the_turn' | 'emotional_beat' | 'repeatable'> & { niche: string };
```

### Concept output type (ADAPT-01)
```typescript
// Source: CONTEXT D-09 + UI-SPEC Component Inventory
export interface AdaptConcept {
  hook:            string; // bold headline (UI-SPEC: text-base font-semibold)
  angle:           string; // muted sub-row
  who_its_for:     string; // muted sub-row
  format_borrowed: string; // coral chip, prefixed "Borrowed:" in UI (UI-SPEC Copywriting)
}
```

### `/api/analysis/[id]` already returns variants + mode (rehydrate works, D-05/D-15)
```typescript
// Source: src/app/api/analysis/[id]/route.ts:28 — select("*") returns variants (incl. remix.adapt) + mode.
// No route change needed for adapt rehydrate.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gemini for video analysis | Qwen-only (`qwen3.5-omni-plus` / `qwen3.6-plus`) via DashScope | pre-2026-06 (memory [[qwen-only-pipeline]]) | Adapt MUST use Qwen; `deepseek.ts`/`gemini/` are legacy names resolving to Qwen |
| New DB column per feature | `variants` JSONB extensibility bag | established (craft, filmstrip) | Adapt persists to `variants.remix.adapt`, no migration |

**Deprecated/outdated:**
- `gemini/` dir + `deepseek.ts` constant names — cosmetic legacy; both route to Qwen (deepseek.ts:24-25). Do not introduce any actual Gemini/DeepSeek call.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adapt runs as a dedicated `/api/remix/adapt` endpoint (vs chained in the SSE pipeline) | Summary / Architecture | If the planner instead chains it server-side after Decode, the persistence + independent-failure wiring differs. This is a Claude's-Discretion call (CONTEXT D-04/D-06) — recommend the endpoint but the planner may justify otherwise. |
| A2 | `qwen3.6-plus` (`QWEN_REASONING_MODEL`) is the right model for adapt | Standard Stack | If concept quality is poor, may need prompt tuning or model bump; reversible (env-overridable). |
| A3 | The `DecodeOutput` field names (`hook_pattern`, `structure`, `the_turn`, `emotional_beat`, `repeatable[]`, `luck[]`) | Code Examples / decode-types.ts | Phase 3 imports this type (D-03), so Phase 4 effectively defines the contract. If Phase 3's real Omni output suggests different field granularity, the type must be reconciled at merge. The fixture lets Phase 4 proceed regardless. |
| A4 | The "live" adapt source is the mutation response held in client state (not a top-level field on `PredictionResult`) | Pattern 4 | `PredictionResult` has no adapt field (it's generated outside the pipeline). If a future change threads adapt into the SSE complete payload, the dual-read's "live" arm changes. Low risk — additive. |
| A5 | `RepeatableItem` shape (`label` + `why_repeatable`) | decode-types.ts | Illustrative; the actual repeatable-lane item shape is Phase 3's to finalize against real Omni output. Keep the fixture and type loose enough to absorb Phase 3's reality. |

## Open Questions

1. **Exact `repeatable[]` item shape from real Decode output**
   - What we know: Decode produces a repeatable-vs-luck split (ROADMAP Phase 3 crit 3); Adapt draws from repeatable only (D-01).
   - What's unclear: Whether each repeatable item is a plain string or a structured `{label, why}` — Phase 3 finalizes this against real Omni output (its Research flag).
   - Recommendation: Define `decode-types.ts` with a structured `RepeatableItem` now (richer is safer); hand-author `decode.fixture.ts` to match; flag for reconciliation at the Phase 3↔4 merge. Phase 4 builds entirely against the fixture (D-02), so it is unblocked.

2. **Endpoint vs pipeline-chained adapt (A1)**
   - What we know: D-04 (lightweight, off pipeline), D-06 (independent failure), D-05 (persist + rehydrate).
   - What's unclear: Whether the planner prefers a standalone `/api/remix/adapt` POST or a server-side chain after Decode.
   - Recommendation: Standalone endpoint — cleanest fit for D-04/D-06 and keeps adapt off `usage_tracking`. Documented as A1 for the planner to confirm.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `DASHSCOPE_API_KEY` | adapt Qwen call | ✓ (existing engine secret) | — | None — adapt cannot run without it (same as all engine LLM calls) |
| Supabase (variants persist + creator_profiles) | D-05 persist, D-12 niche PATCH | ✓ | — | None — core infra |
| Existing installed npm deps | everything | ✓ | per package.json | None needed |

**Missing dependencies with no fallback:** None — all infra exists and is in active use by Phases 1-2.

## Validation Architecture

> nyquist_validation = true (.planning/config.json:61) — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`package.json:104`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/engine/remix src/components/board/adapt` |
| Full suite command | `npm test` (`vitest run`) |
| DOM env directive | `/** @vitest-environment happy-dom */` (per AdaptShellNode.test.tsx) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADAPT-01 | adapt.ts returns exactly 3 concepts each with 4 fields (Zod `.length(3)`) | unit | `npx vitest run src/lib/engine/remix/__tests__/adapt.test.ts` | ❌ Wave 0 |
| ADAPT-01 | malformed/short Qwen output triggers repair attempt; final invalid → null (graceful) | unit (mock Qwen client) | same file | ❌ Wave 0 |
| ADAPT-01 | input builder never includes source caption/content_summary (content-leak guard, Pitfall 1) | unit | same file — assert builder signature only accepts AdaptInput | ❌ Wave 0 |
| ADAPT-01 | concepts drawn from repeatable[], luck[] excluded (D-01) | unit | same file — feed fixture with distinct luck/repeatable, assert prompt content | ❌ Wave 0 |
| ADAPT-01 | 3 stacked AdaptConceptCard render hook headline + chip + 2 muted rows | component | `npx vitest run src/components/board/adapt/__tests__` | ❌ Wave 0 |
| ADAPT-02 | empty niche (both null) shows inline NichePicker; populated niche renders cards | component | same dir | ❌ Wave 0 |
| ADAPT-02 | inline niche PATCH then generate (mutateAsync awaited, no race — Pitfall 5) | component (mock hooks) | same dir | ❌ Wave 0 |
| D-05 | variants.remix.adapt rehydrates on reload, no regeneration (Pitfall 3) | component | same dir — assert no fetch when variants present | ❌ Wave 0 |
| D-05 | read-merge-write preserves variants.craft + variants.remix.decode (Pitfall 2) | unit (endpoint/persist) | `npx vitest run src/app/api/remix/adapt/__tests__` | ❌ Wave 0 |
| D-06 | adapt failure leaves Decode frame intact (Pitfall 4) | component | adapt dir | ❌ Wave 0 |
| ADAPT crit 5 | grade-mode board unchanged (no regression) | existing suite | `npm test` | ✅ existing Board/BoardMobile tests |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/engine/remix src/components/board/adapt src/app/api/remix`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/engine/remix/__tests__/adapt.test.ts` — exactly-3, repair loop, no-caption guard, luck-exclusion (mock `getQwenClient`)
- [ ] `src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx` — niche-prompt vs cards, rehydrate-no-regen, independent failure
- [ ] `src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx` — card anatomy (hook/chip/rows)
- [ ] `src/app/api/remix/adapt/__tests__/route.test.ts` — read-merge-write preservation, auth, validation
- [ ] Test fixtures: `decode.fixture.ts` doubles as the test input fixture (hand-authored, D-02)
- [ ] Qwen client mock pattern — reference existing engine `__tests__` that mock `getQwenClient`/`chat.completions.create`

## Security Domain

> security_enforcement not explicitly false in config → included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All routes call `supabase.auth.getUser()` → 401 (creator-profile/route.ts:54-58, analyze/route.ts:181). New `/api/remix/adapt` MUST do the same. |
| V3 Session Management | no | Supabase cookie session, unchanged |
| V4 Access Control | yes | RLS on `analysis_results` + `creator_profiles` (`user_id = auth.uid()`); adapt write uses service client scoped to the row's owner. Verify the adapt endpoint confirms the analysis row belongs to the caller before writing. |
| V5 Input Validation | yes | Zod-validate the adapt request body (analysis id, decode payload, niche) — mirror `creatorProfilePatchSchema.safeParse` (creator-profile/route.ts:138). |
| V6 Cryptography | no | No new crypto; reuse existing secrets handling |

### Known Threat Patterns for {Next.js API route + Qwen + Supabase}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated adapt generation (cost abuse) | Elevation/DoS | `getUser()` 401 gate + verify row ownership before generate/write |
| CSRF on the niche PATCH | Spoofing | Already mitigated: Content-Type 415 guard + cross-origin 403 guard (creator-profile/route.ts:95-125) |
| Prompt injection via niche string | Tampering | Niche comes from the fixed taxonomy (slugs → labels via taxonomy.ts), not free text — bounded input. Still pass labels, not arbitrary user text. |
| Leaking the source caption to DashScope/Alibaba | Information Disclosure | D-01 structural guard: caption never enters the adapt input (also aligns with the milestone's derive-and-drop IP boundary) |
| Cross-user `variants` write | Elevation | Service-client update scoped by `.eq("id", id)` after ownership check; RLS backstop |

## Sources

### Primary (HIGH confidence — live codebase, file:line)
- `src/lib/engine/qwen/client.ts:1-33` — Qwen client, models, seed, maxRetries:0 contract
- `src/lib/engine/qwen/omni-analysis.ts:149-291` — canonical retry+repair+Zod+strip call shape
- `src/lib/engine/qwen/schemas.ts:120-164` — Zod `.length(N)` enforcement precedent
- `src/lib/engine/wave3/pass2.ts:130-201` — reasoning-model JSON-mode call + explicit count guard
- `src/lib/engine/pipeline.ts:494-707` — tiktok_url Omni branch + derive-and-drop + text-Qwen fallback
- `src/app/api/analyze/route.ts:88-145,490-728` — `persistCraftToVariants` read-merge-write; SSE persist seam
- `src/components/board/content-analysis/ContentAnalysisFrame.tsx:64-99` — self-sourcing frame + dual-read rehydrate
- `src/components/board/Board.tsx:130-170,486-518` — boardMode derivation; AdaptShellNode mount
- `src/components/board/BoardMobile.tsx:37-143` — mobile adapt slot
- `src/components/board/adapt/AdaptShellNode.tsx` — Phase 2 shell (mount point)
- `src/components/app/cards/niche-picker.tsx:24-119` — controlled NichePicker API + a11y
- `src/hooks/queries/use-creator-profile.ts` — useCreatorProfile / useUpdateCreatorProfile (invalidation)
- `src/app/api/profile/creator-profile/route.ts:48-211` — GET/PATCH, CSRF + Content-Type guards, niche columns
- `src/lib/niches/taxonomy.ts:326-335` — getNicheBranches/getPrimaryLabel/getSubLabel
- `src/app/api/analysis/[id]/route.ts:28` — select("*") returns variants + mode (rehydrate)
- `src/lib/engine/utils/strip.ts:1-9` — stripModelOutput (<think>/fence stripping)
- `src/types/database.types.ts:208,230` — `mode` (string), `variants` (Json | null) columns
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `04-CONTEXT.md`, `04-UI-SPEC.md`, `02-CONTEXT.md` — requirements, decisions, UI contract

### Secondary (MEDIUM confidence)
- memory [[qwen-only-pipeline]] — Qwen-only constraint (corroborated by codebase: gemini/deepseek are legacy names → Qwen)

### Tertiary (LOW confidence)
- None — all findings verified in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all transports verified in-repo
- Architecture: HIGH — every seam (Qwen call, variants persist, dual-read, NichePicker, creator-profile) is file:line-grounded; endpoint-vs-chain is the one open discretion call (A1)
- Pitfalls: HIGH — each derived from a documented in-code hazard (variants race route.ts:96, maxRetries:0 client.ts:15, dual-read regression ContentAnalysisFrame.tsx:78)
- Contract (decode-types): MEDIUM — Phase 4 defines it but Phase 3's real Omni output may refine field granularity (A3/A5); mitigated by building against the fixture per D-02

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable — internal codebase, no fast-moving external deps)
