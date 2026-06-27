# Phase 4: Input Adapter - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 8 (6 new, 1 modified, 1 read-only-analog confirm)
**Analogs found:** 8 / 8

All file:line anchors below were RE-VERIFIED against live code this session (not copied blind from RESEARCH.md).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/stimulus/types.ts` (NEW) | model / type | transform | `src/lib/engine/types.ts:154-216` (`AnalysisInputSchema` + `ContentPayload`) | role-match (alongside, additive) |
| `src/lib/engine/stimulus/normalize.ts` (NEW) | service (lib, pure) | transform | `src/lib/engine/normalize.ts:42-66` (`normalizeInput`) | exact (sibling normalizer) |
| `src/lib/engine/stimulus/tier.ts` (NEW) | utility (pure fn) | transform | `src/lib/engine/qwen/client.ts:36,41` (two-model constants) | grounding-ref |
| `src/lib/engine/stimulus/ingest.ts` (NEW) | service (lib) | file-I/O | `src/app/api/profile/avatar/route.ts:17-47` (FormData validate + read) | role-match |
| `src/lib/engine/stimulus/vision.ts` (NEW) | service (lib → DashScope) | request-response | `wave3/persona-prompts-pass2.ts:106-134` + `wave3/fold.ts:317-339` + `qwen/omni-analysis.ts:291-297` | exact (assembly of proven shapes) |
| `src/lib/engine/domain-pack.ts:51` (MODIFY) | config / descriptor | transform | self (widen union in place) | in-place edit |
| `src/lib/engine/stimulus/__tests__/*` (NEW) | test | — | `src/lib/engine/retrieval/__tests__/` + `src/lib/engine/__tests__/` | layout precedent |
| `src/lib/engine/normalize.ts` + `types.ts` + `packs/socials.ts:74` | model/service | — | **READ-ONLY ANALOG (D-02 — do NOT modify)** | n/a |

## Pattern Assignments

### `src/lib/engine/stimulus/types.ts` (model/type, transform)

**Analog:** `src/lib/engine/types.ts:154-216` — `AnalysisInputSchema` + `ContentPayload`. `Stimulus` sits **ALONGSIDE** this contract, additive (D-02). Do NOT edit `types.ts`.

**Pattern to mirror:** Zod-schema-at-boundary + exported TS interface (the same `AnalysisInputSchema` → `ContentPayload` shape style). Recommended shape from RESEARCH (DISCRETION-locked: additive, profiler-ready, carries resolved tier):

```ts
export type StimulusKind = "text" | "file_text" | "image" | "video";
export type Sim1Tier = "flash" | "max";

export interface Stimulus {
  kind: StimulusKind;
  content: string;              // normalized text
  source: {
    origin: "text" | "file" | "image" | "video";
    filename?: string;          // display ONLY — NEVER a path (Pitfall 3)
    mime?: string;
    storagePath?: string;       // ONLY for video (reuses existing video_upload storage)
  };
  tier: Sim1Tier;               // resolved (D-03), carried for P5 badge
  subject?: { isProfiledSubject: true; goal?: string };  // profiler-ready (D-06)
}
```
Note: omit `tiktok_url` from `StimulusKind` — URL ingestion is the Socials path (D-02), unifies in P7 if ever.

---

### `src/lib/engine/stimulus/normalize.ts` (service, transform) — EXACT sibling

**Analog:** `src/lib/engine/normalize.ts:42-66` (VERIFIED). Pure, no side effects, builds a flat object.

**Core pattern to mirror** (lines 42-66):
```ts
export function normalizeInput(input: AnalysisInput): ContentPayload {
  const contentText = input.content_text ?? "";
  return {
    content_text: contentText,
    content_type: input.content_type,
    input_mode: input.input_mode,
    video_url: input.tiktok_url ?? null,
    video_storage_path: input.video_storage_path ?? null,
    // ...derived fields
  };
}
```
`normalizeStimulus(...)` is the General-path twin: raw per-kind input → flat `Stimulus`. Separate function, Socials `normalizeInput` byte-untouched. For person-video set `kind:"video"`, `source.storagePath`, `tier:"max"`, `subject` tag — do NOT run omni in P4 (D-06: tag only).

---

### `src/lib/engine/stimulus/tier.ts` (utility, pure)

**Analog/grounding:** `src/lib/engine/qwen/client.ts:36,41` (VERIFIED).
```ts
export const QWEN_OMNI_MODEL      = process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-flash"; // L36 → SIM-1 Max
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.7-plus";       // L41 → SIM-1 Flash (deaf, vision-capable; L51 "3.7-plus is deaf")
```
`QWEN_FAST_MODEL`/`qwen3.6-flash` RETIRED (L42) — do NOT reference. Pure rule (audio-presence discriminator, D-03):
```ts
export function resolveSim1Tier(kind: StimulusKind): Sim1Tier {
  return kind === "video" ? "max" : "flash";
}
```
PITFALL: omni-**flash** name ≠ SIM-1-**Flash**. SIM-1 Max = `qwen3.5-omni-flash` (audio), SIM-1 Flash = `qwen3.7-plus`. Encode the kind→model map once here; never inline a model id elsewhere.

---

### `src/lib/engine/stimulus/ingest.ts` (service, file-I/O)

**Analog:** `src/app/api/profile/avatar/route.ts:17-47` (VERIFIED).

**Validate-then-read pattern** (lines 17-39):
```ts
const formData = await request.formData();
const file = formData.get("file") as File | null;
if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
if (!allowedTypes.includes(file.type)) return Response.json({ error: "Invalid file type" }, { status: 400 });
if (file.size > 2 * 1024 * 1024) return Response.json({ error: "File too large" }, { status: 400 });
```
P4 ships **lib functions** (not the HTTP route — that's P5, D-01): `validateUpload`, `readTextFile`. Text read = `await file.text()` (zero parser deps, D-05); allowlist MIME **and** ext (`.txt`/`.md`; `""` MIME tolerated for `.md`), size cap 1 MB.

**Path-traversal guard (Pitfall 3):** NEVER use `file.name` as a path. avatar route's storage-key pattern (L42, `${user.id}/avatar.${ext}`) is the ONLY safe interpolation, and only for video persistence; text/image read in-memory (no path at all).

---

### `src/lib/engine/stimulus/vision.ts` (service → DashScope, request-response) — assembly, not new engineering

**Analogs (three, assemble):**
1. `wave3/persona-prompts-pass2.ts:106-134` (VERIFIED) — the EXACT `image_url` content-item shape:
```ts
type ContentItem =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };
items.push({ type: "image_url", image_url: { url: uri } }); // L127
items.push({ type: "text", text: ... });                    // text item last
```
2. `wave3/fold.ts:317-339` — `QWEN_REASONING_MODEL` driven with a multimodal `content[]` array + `response_format: { type: "json_object" }`.
3. `pipeline.ts:626-635` (VERIFIED) — the DashScope extension param-mutation + `@ts-expect-error` convention:
```ts
const params = { model: QWEN_REASONING_MODEL, messages: [...], response_format: { type: "json_object" as const }, temperature: 0 };
// @ts-expect-error — DashScope extensions not in OpenAI types
params.seed = QWEN_SEED;
// @ts-expect-error — DashScope extension: thinking-off
params.enable_thinking = false;
const completion = await ai.chat.completions.create(params as never);
```
4. `qwen/omni-analysis.ts:291-297` (VERIFIED) — the strip→parse→Zod sequence:
```ts
const raw     = completion.choices[0]?.message?.content ?? "";
const cleaned = stripModelOutput(raw);
const parsed  = JSON.parse(cleaned);
const result  = OmniAnalysisZodSchema.safeParse(coerced);
```

**Concrete IN-03 call:** `model: QWEN_REASONING_MODEL`, user-content `[{ image_url: { url: dataUrl } }, { text: "Read this screenshot..." }]`, `dataUrl = "data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}"`, `enable_thinking=false`, `seed=QWEN_SEED`, json_object, then strip+parse+Zod. NO client wrapper to extend — `getQwenClient()` (client.ts:7) called directly. NEVER `model: QWEN_OMNI_MODEL` for images (D-04). Wrap in `Sentry.captureException` (mirror pipeline.ts:656).

**A2 OPEN UNKNOWN:** base64 `data:` URL acceptance by `qwen3.7-plus` is CITED-in-docs but not exercised in-repo (only hosted/signed URLs). Planner: Wave-0 gated live smoke (1×1 base64 PNG → assert 200 + parseable). Fallback = avatar-style Storage upload → signed URL.

---

### `src/lib/engine/domain-pack.ts:51` (config descriptor, MODIFY in place)

**Self-edit.** VERIFIED current (L45-51):
```ts
// The STIMULUS axis = `input_mode` enum. Orthogonal to the pack/domain key...
export type StimulusType = "text" | "tiktok_url" | "video_upload";
```
**Widen the union ONLY** → add `"file_text" | "image"`. Do NOT move the pipeline's `input_mode` branching (the documented L45-51 anti-pattern: "collapsing input_mode into the pack key"). `packs/socials.ts:74` (`stimulusTypes: ["text","tiktok_url","video_upload"]`) STAYS as-is — Socials doesn't gain the new kinds; the General path's future pack declares them.

---

### `src/lib/engine/stimulus/__tests__/` (test)

**Layout precedent:** `src/lib/engine/retrieval/__tests__/` (per-module co-located `__tests__/`) — VERIFIED the engine organizes cohesive sub-concerns into folders with their own `__tests__/` (`qwen/`, `wave3/`, `retrieval/`). Files: `normalize.test.ts` (IN-01 + D-06), `tier.test.ts` (IN-02 pure), `vision.test.ts` (IN-03, mock `getQwenClient`), `ingest.test.ts` (validate size/type/ext), `socials-untouched.smoke.test.ts` (D-02 structural smoke). Runner: `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus` (NEVER `npm test`/`npx vitest` — fake PASS(0)).

## Shared Patterns

### DashScope model call (cross-cutting — vision.ts + any model touch)
**Source:** `getQwenClient()` `src/lib/engine/qwen/client.ts:7` (singleton, `maxRetries:0`, correct baseURL). **Apply to:** vision.ts.
```ts
const ai = getQwenClient();
const completion = await ai.chat.completions.create(params as never);
```
Plus the `@ts-expect-error` seed/enable_thinking mutation convention (pipeline.ts:631-634) and strip→parse→Zod sequence (omni-analysis.ts:291-297).

### Boundary validation (V5/V12)
**Source:** `api/profile/avatar/route.ts:24-39`. **Apply to:** ingest.ts (text) + vision.ts (image). MIME allowlist **and** extension allowlist; `file.size` cap BEFORE decode/`text()`/base64 (base64 inflates ~33%); text 1 MB, image 10 MB; reject early. Isolate untrusted content in the **user** content array (never the system prompt).

### Additive / wrap-don't-refactor (D-02, P1 D-01/D-06)
**Source:** posture inherited from `domain-pack.ts` + `normalize.ts`. **Apply to:** all new files. The Socials path (`normalizeInput`, `AnalysisInput`/`ContentPayload`, `runPredictionPipeline` branches, `packs/socials.ts` list) is READ-ONLY analog — classify, mirror, NEVER modify.

## No Analog Found

None. Every new/modified file has a verified in-repo analog (this is a greenfield-additive assembly of live patterns, not new engineering).

## Metadata

**Analog search scope:** `src/lib/engine/` (`normalize`, `types`, `domain-pack`, `qwen/`, `wave3/`, `packs/`, `retrieval/__tests__/`), `src/app/api/profile/avatar/`.
**Files scanned (read this session):** 7 (normalize.ts, qwen/client.ts, avatar/route.ts, domain-pack.ts, persona-prompts-pass2.ts, omni-analysis.ts, pipeline.ts).
**Pattern extraction date:** 2026-06-27

## PATTERN MAPPING COMPLETE

**Phase:** 4 - input-adapter
**Files classified:** 8 (6 new, 1 modify, 1 read-only-analog group)
**Analogs found:** 8 / 8

### Coverage
- Files with exact analog: 3 (normalize.ts, vision.ts, types.ts)
- Files with role-match analog: 4 (ingest.ts, tier.ts, domain-pack.ts, __tests__/)
- Files with no analog: 0

### Key Patterns Identified
- IN-03 vision = pure ASSEMBLY of live shapes: `image_url` item (pass2:127) + multimodal `content[]` to `QWEN_REASONING_MODEL` (fold.ts) + `@ts-expect-error` seed/thinking mutation (pipeline.ts:631) + strip→parse→Zod (omni-analysis.ts:291). No client wrapper to extend.
- Tier rule = two named constants from client.ts:36/41 surfaced as `resolveSim1Tier(kind)`; audio-presence (video→Max) discriminator, never user choice. Beware omni-flash vs SIM-1-Flash name collision.
- Stimulus is ADDITIVE alongside the Socials contract (D-02) — normalize.ts/types.ts/socials.ts are read-only analogs, NOT modify targets. Only `domain-pack.ts:51` union widens in place.

### File Created
`.planning/phases/04-input-adapter/04-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog file:line + excerpts directly in PLAN.md actions.
