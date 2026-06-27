# Phase 4: Input Adapter - Research

**Researched:** 2026-06-27
**Domain:** Engine input normalization — multimodal stimulus ingestion (text / `.txt`/`.md` / screenshot-image / person-video) + SIM-1 tier auto-select, in a Next.js 15 / TS / DashScope-Qwen codebase
**Confidence:** HIGH (every load-bearing claim is grounded in `file:line` code evidence from this repo)

## Summary

P4 builds an **additive** input-adapter layer: a new `Stimulus` type + a normalizer (the General-path sibling of `normalizeInput`) + a SIM-1 tier rule, as a clean test-covered lib. The Socials `AnalysisInput`/`ContentPayload`/pipeline path is **untouched** (D-02). No new visible UI (D-01) — the consuming verb + badge land in P5.

The single highest-value unknown — **the IN-03 image→model call shape** — is fully resolved with code evidence and required **zero guessing**. The codebase already drives `qwen3.7-plus` (`QWEN_REASONING_MODEL`) with OpenAI-compatible multimodal `content[]` arrays: `fold.ts` sends it a `{type:"video_url", video_url:{url}}` item, and `persona-prompts-pass2.ts` already builds `{type:"image_url", image_url:{url}}` items. There is **no client wrapper to extend** — engine stages call `getQwenClient().chat.completions.create({ model, messages:[…] })` directly. The screenshot path is the exact same pattern with `image_url` instead of `video_url`, `model = QWEN_REASONING_MODEL`. **No new dependency, no new infra.**

**Primary recommendation:** Ship a cohesive `src/lib/engine/stimulus/` module (`types.ts`, `normalize.ts`, `vision.ts`, `ingest.ts` + `__tests__/`). `Stimulus` carries `{ kind, content, source, tier, subject? }`. Tier rule = **video→Max (omni), everything-else→Flash (3.7-plus)** (the audio-presence discriminator, D-03). Image read = direct `image_url` call to `QWEN_REASONING_MODEL` with a base64 `data:` URL, no Supabase round-trip. File read = in-memory `await file.text()`, zero parser deps. Widen the `StimulusType` union with `"file_text" | "image"`; do **not** touch the pipeline's `input_mode` branching and do **not** add them to the Socials pack's `stimulusTypes` list.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Adapter layer only — no new composer UI in P4.** Build `Stimulus` normalization + file/image→text ingestion + tier auto-select as a clean, test-covered lib/service with a thin internal harness. The visible inbox lands in P5/P7. SC#1 ("the composer inbox accepts…") is satisfied at the **adapter level** (the door exists + works end-to-end); the visible surface ships with its consumer.
- **D-02: Additive, alongside — Socials path UNTOUCHED.** `Stimulus` is a NEW normalized General-path type carrying: normalized **content** (text) + **modality/kind** + **source** + a **subject/goal tag** (profiler-ready, D-06) + the **resolved SIM-1 tier** (D-03). The Socials `AnalysisInput`/`ContentPayload` path is left as-is. The two converge later (P7) if ever.
- **D-03: Audio presence (not "text vs video") picks the tier.** Grounded verbatim in `qwen/client.ts`:
  - **SIM-1 Max = `qwen3.5-omni-flash`** (omni audio-visual **sensor**) ⟺ **video with audio**.
  - **SIM-1 Flash = `qwen3.7-plus`** (full multimodal incl. vision, but **deaf**) ⟺ **everything else**: text, `.txt`/`.md`, image/screenshot, and silent/visual-only video.
  - **Never a user choice.** P4 computes + carries the tier on the `Stimulus`; the visible badge renders in P5.
- **D-04: Screenshots → `qwen3.7-plus` vision.** Reuse the reasoning model's multimodal image input — semantic, no new dep, fits the profiler need. NOT Tesseract.js, NOT cloud OCR. **omni is reserved for audio-bearing video — do NOT route images through omni.**
- **D-05: `.txt` + `.md` only this phase.** Plain-text read, zero parser deps. Defer `.docx`/`.pdf`.
- **D-06: The "CIA-profiler" forensic READ is the Profile verb's deliverable — built in P5, not P4.** P4's only obligation: make the `Stimulus` profiler-ready — (a) accept **person-video as a profiled SUBJECT** (reuses existing omni video ingestion; tier=Max), and (b) carry the **subject + goal tag**. No scope balloon — person-video ingestion already exists; only the tag is new. Add a roadmap note to P5.

### Claude's Discretion
- Exact `Stimulus` type shape + field names. Lock: **additive, profiler-ready (person-video + subject/goal), carries the resolved tier.**
- Where the adapter lives (module layout) and how it widens `DomainPack.stimulusTypes` (currently `["text","tiktok_url","video_upload"]`) — **widen the descriptor; do NOT move the pipeline's `input_mode` branching** (domain-pack.ts L45–51 anti-pattern).
- Ingestion mechanics: `.txt`/`.md` read, the `qwen3.7-plus` image-vision call shape, where the test harness lives.
- **Untrusted-input hardening at the boundary** (file size/type validation, path-traversal sanitization on uploads, vision/text prompt-injection isolation). NOTE: the *user-authored-text → scorer-prompt* injection is carried to **P5** — the first place user text hits a model prompt is `simulate()`.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

### Deferred Ideas (OUT OF SCOPE)
- **Profiler forensic READ** (behavioral / deception analysis) → Phase 5. P4 only makes the `Stimulus` profiler-ready.
- **Visible General inbox surface** → P5 (consuming verb) + P7 (front-door picker).
- **`.docx` / `.pdf` ingestion** → deferred until a real use case demands.
- **SIM-1 Flash/Max visible badge** → renders in P5 (P4 computes + carries the tier).
- **Unifying Socials `AnalysisInput` into `Stimulus`** → P7 or later.
- **User-authored-text → scorer-prompt injection hardening** → P5 (`simulate()`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IN-01 | Accept text + file (`.txt`/`.md`) uploads, normalize into a `Stimulus` | FormData→`File.text()` in-memory read (avatar route template, `api/profile/avatar/route.ts`); zero parser deps (D-05); new `Stimulus` normalizer mirrors `normalize.ts:42` |
| IN-02 | SIM-1 tier (Flash/Max) auto-selects from input type, never a user choice | Audio-presence rule (D-03) grounded in `qwen/client.ts:36,41,51`; operational rule = video→Max, else→Flash; tier carried on `Stimulus`, badge is P5 |
| IN-03 | Accept screenshot/image, read into `Stimulus` | `image_url` content item to `QWEN_REASONING_MODEL` — exact shape proven in `persona-prompts-pass2.ts:107,127` + `fold.ts:322-329` (3.7-plus already takes multimodal `content[]`); base64 `data:` URL, no new dep |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File/image upload receipt | API / Backend (route handler) | — | FormData parsed server-side; mirrors `api/profile/avatar/route.ts`. P4 ships the lib; the route that calls it is thin (and largely P5's surface) |
| `.txt`/`.md` text extraction | API / Backend (lib) | — | `await file.text()` in-memory; pure server lib, no client |
| Image → text read (vision) | API / Backend (lib → DashScope) | External (DashScope Qwen) | `qwen3.7-plus` multimodal call; server-only (holds `DASHSCOPE_API_KEY`) |
| Tier resolution | API / Backend (lib, pure) | — | Pure function on the `Stimulus.kind`; no I/O |
| `Stimulus` normalization | API / Backend (lib, pure-ish) | — | Sibling of `normalizeInput`; lives in the engine lib |
| Person-video ingestion (profiler subject) | API / Backend (existing omni path) | External (DashScope omni) | **Reuses** `analyzeVideoWithOmni` (`omni-analysis.ts:234`); P4 adds only the subject/goal tag |

**Note:** P4 is a server-side **library** phase. No browser/SSR tier work (the visible inbox is P5/P7, D-01). The "boundary" P4 hardens is the **lib's ingestion surface** (untrusted file bytes + untrusted image → model), not an HTTP route's auth (that arrives with P5's surface).

## Standard Stack

No new packages. Everything needed is already in the repo and proven on the exact call paths this phase widens.

### Core (already installed — reuse)
| Library | Version | Purpose | Why Standard (evidence) |
|---------|---------|---------|--------------|
| `openai` (SDK) | in repo | OpenAI-compatible client → DashScope | `getQwenClient()` returns `new OpenAI({ baseURL: DASHSCOPE_ENDPOINT })` — `qwen/client.ts:15`. Every engine call uses `ai.chat.completions.create` |
| `zod` | in repo | Input + output boundary validation | `AnalysisInputSchema` (`types.ts:154`), `Pass2ResponseSchema` (`persona-prompts-pass2.ts:214`) — the established boundary-validation pattern |
| `@supabase/*` (`@/lib/supabase/server`) | in repo | Auth + (only if persisting video) Storage | `api/profile/avatar/route.ts:1` `createClient()`; video_upload storage path already wired (`pipeline.ts:415`) |
| Web `FormData` / `File` | platform (Next 15) | Multipart upload parse + `File.text()` | `request.formData()` + `formData.get("file") as File` — `api/profile/avatar/route.ts:17-18` |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/logger` `createLogger` | in repo | Structured stage logging | Mirror `omni-analysis.ts` / `extract.ts:11` logging in the vision + ingest modules |
| `@sentry/*` | in repo | Error capture on model-call failure | Mirror `pipeline.ts:656` `Sentry.captureException` around the vision call |

### Alternatives Considered
| Instead of | Could Use | Tradeoff (why rejected) |
|------------|-----------|----------|
| `qwen3.7-plus` vision (D-04) | Tesseract.js | New dep; dumb glyph OCR, weak on chat-bubble layouts; loses the semantic "understand this screenshot" the profiler needs |
| `qwen3.7-plus` vision | Cloud OCR API (Google/AWS) | New vendor + cost + key |
| `await file.text()` (D-05) | `mammoth`/`pdf-parse` | New parser deps + scanned-PDF/layout failure modes; not needed for `.txt`/`.md` |
| base64 `data:` URL to model | Upload image to Supabase Storage → signed URL → model | Extra round-trip + a stored-PII artifact for a transient read. Base64 in-memory is simpler and DashScope accepts `data:` URLs (see Code Examples). **Recommend base64.** |

**Installation:** none. `npm install` is a no-op for this phase.

## Package Legitimacy Audit

> Not applicable — **this phase installs zero external packages** (D-05 mandates zero parser deps; the vision + tier + normalize work reuses `openai`, `zod`, `@supabase/*`, all already in `package.json`). No SLOP/SUS surface introduced.

## Architecture Patterns

### System Architecture Diagram

```
              ┌─────────────────────── P4 SCOPE (the lib) ───────────────────────┐
              │                                                                    │
 raw input    │   ┌──────────────┐      ┌────────────────────┐    ┌───────────┐   │   Stimulus
 ───────────► │   │  ingest()    │ ───► │  normalizeStimulus │ ─► │ resolveTier│  │ ──────────► (P5 consumer:
 text         │   │  (per-kind)  │      │  (build Stimulus)  │    │ (pure)    │   │              simulate() /
 .txt/.md ──► │   │              │      │                    │    │           │   │              Profile verb)
 image ─────► │   │  ├ text: raw │      │  { kind, content,  │    │ video→Max │   │
 (screenshot) │   │  ├ file:.text()     │    source, tier,   │    │ else→Flash│   │   carries:
 video ─────► │   │  ├ image: vision()─┐ │    subject? }      │    └───────────┘   │   - resolved SIM-1 tier
 (person)     │   │  └ video: (tag only)│                     │                    │   - subject/goal tag
              │   └──────────────┘    │ │                                          │   - normalized text content
              │                       ▼ │                                          │
              │            ┌────────────────────────┐                              │
              │            │ getQwenClient()         │  image_url item →            │
              │            │ .chat.completions       │  QWEN_REASONING_MODEL        │
              │            │ ({model, messages:[…]}) │  (qwen3.7-plus, vision)      │
              │            └────────────────────────┘                              │
              │                       │ video: REUSES analyzeVideoWithOmni()        │
              │                       ▼ (omni-flash, tier=Max) — NO new infra       │
              └────────────────────────────────────────────────────────────────────┘

  UNTOUCHED (D-02):  AnalysisInput ─► normalizeInput() ─► ContentPayload ─► runPredictionPipeline()  [Socials path]
```

The `Stimulus` is the lib's output object. P4 wires the door + normalizer + tier rule; the verb that *runs* a `Stimulus` against an audience is P5.

### Recommended Project Structure (DISCRETION — decisive pick)

```
src/lib/engine/
├── stimulus/                      # NEW — cohesive General-path input concern
│   ├── types.ts                   # Stimulus, StimulusKind, Sim1Tier
│   ├── normalize.ts               # normalizeStimulus(...) — the adapter (sibling of ../normalize.ts)
│   ├── ingest.ts                  # readTextFile() (.txt/.md), validateUpload() (size/type/path)
│   ├── vision.ts                  # readImageWithVision() → text (qwen3.7-plus image_url call)
│   ├── tier.ts                    # resolveSim1Tier(kind) — pure
│   └── __tests__/
│       ├── normalize.test.ts
│       ├── tier.test.ts
│       ├── ingest.test.ts
│       └── socials-untouched.smoke.test.ts   # D-02 structural smoke
```

**Why a `stimulus/` subfolder (not flat at engine root):** the engine already organizes cohesive sub-concerns into folders with their own `__tests__/` — `qwen/`, `wave3/`, `filmstrip/`, `corpus/`, `learning/`, `retrieval/` (the last has `retrieval/__tests__/`, confirmed). A new 4–5 file input concern is exactly such a unit. Co-locating tests in `stimulus/__tests__/` mirrors `retrieval/__tests__/`. **Confidence: HIGH** (grounded in the observed folder layout). The competing option — flat files at engine root + central `__tests__/` (mirroring `normalize.ts`/`__tests__/normalize.test.ts`) — is also defensible; pick the folder for cohesion since this is a multi-file new concern, not a single sibling file.

### Pattern 1: Multimodal `content[]` call to `QWEN_REASONING_MODEL` (the IN-03 spine)
**What:** Drive `qwen3.7-plus` with an OpenAI-compatible `content` array mixing a media item and a text item.
**When to use:** The screenshot read. This is the **proven** path — `fold.ts` does it with `video_url`; `pass2` builds it with `image_url`.
**Evidence:**
```ts
// Source: src/lib/engine/wave3/fold.ts:317-329 — QWEN_REASONING_MODEL receives a multimodal content[] array
const callParams = {
  model: FOLD_MODEL,                                  // FOLD_MODEL = QWEN_REASONING_MODEL (fold.ts:64) = qwen3.7-plus
  messages: [
    { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT },
    { role: "user" as const,
      content: buildFoldUserContent(slots, segments, verbatim, emotionArc, videoUrl, audienceRepaint) as never },
  ],
  response_format: { type: "json_object" as const },
};
// fold-prompts.ts:172-174 — the content item shape:
//   videoUrl ? [{ type: "video_url", video_url: { url: videoUrl } }, textItem] : [textItem]
```
```ts
// Source: src/lib/engine/wave3/persona-prompts-pass2.ts:106-134 — the EXACT image item shape
type ContentItem =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };
// ...
items.push({ type: "image_url", image_url: { url: uri } });   // L127
```
**The concrete IN-03 call** (assemble from the two proven shapes above):
```ts
// Source: synthesized from omni-analysis.ts:259-287 (call structure) + pass2:127 (image item) + pipeline.ts:621-635 (3.7-plus params)
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../qwen/client";

const ai = getQwenClient();
const params = {
  model: QWEN_REASONING_MODEL,                     // qwen3.7-plus — vision-capable, deaf (client.ts:41,51)
  messages: [
    { role: "system", content: STIMULUS_VISION_SYSTEM_PROMPT },
    { role: "user", content: [
        { type: "image_url", image_url: { url: dataUrl } },   // dataUrl = "data:image/png;base64,...."
        { type: "text", text: "Read this screenshot. Return JSON: { content: <verbatim/semantic text> }." },
    ] },
  ],
  response_format: { type: "json_object" as const },
  temperature: 0,
};
// @ts-expect-error — DashScope extension (mirrors pipeline.ts:632-634)
params.seed = QWEN_SEED;
// @ts-expect-error — DashScope extension: thinking OFF (latency; 3.7-plus defaults thinking ON)
params.enable_thinking = false;
const completion = await ai.chat.completions.create(params as never);
```
**Key facts:**
- There is **no client wrapper** to extend — stages call `ai.chat.completions.create` directly. The "wrapper" is just `getQwenClient()` (`qwen/client.ts:7`). So nothing must be *added* to the client; the new `vision.ts` module simply assembles the call. **This directly answers the #1 research unknown: the existing client CAN express a multimodal image message today — `pass2` already builds the item type.** [VERIFIED: repo grep + file reads]
- DashScope extension params (`seed`, `enable_thinking`) are passed by mutation + `@ts-expect-error` because they're not in the OpenAI TS types — established convention at `pipeline.ts:631-634`, `fold.ts:333-339`, `omni-analysis.ts`. Reuse it; don't fight the types.
- Use `response_format: { type: "json_object" }` + `stripModelOutput()` + `JSON.parse` + a Zod schema, exactly like `omni-analysis.ts:291-297`.

### Pattern 2: Additive normalizer (sibling of `normalizeInput`)
**What:** `normalizeStimulus(...)` is to the General path what `normalizeInput` (`normalize.ts:42`) is to Socials — same shape of idea (raw input → normalized object), a **separate** function, Socials untouched.
**When to use:** Always — it's the adapter's core.
**Evidence:** `normalize.ts:42` `normalizeInput(input: AnalysisInput): ContentPayload` is pure, no side effects, builds a flat object. Mirror it.

### Pattern 3: FormData upload receipt (the ingestion surface)
**What:** Parse multipart, get the `File`, validate type+size before touching content.
**Evidence:**
```ts
// Source: src/app/api/profile/avatar/route.ts:17-39 — the upload template to mirror
const formData = await request.formData();
const file = formData.get("file") as File | null;
if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
if (!allowedTypes.includes(file.type)) return Response.json({ error: "Invalid file type" }, { status: 400 });
if (file.size > 2 * 1024 * 1024) return Response.json({ error: "File too large" }, { status: 400 });
```
For **text** files: `const text = await file.text();` (no Buffer, no storage). For **images**: `const buf = Buffer.from(await file.arrayBuffer()); const dataUrl = \`data:${file.type};base64,${buf.toString("base64")}\`;`.
**Scope note:** the HTTP route is largely P5's surface (D-01). P4 ships the **lib functions** (`validateUpload`, `readTextFile`, `readImageWithVision`) + a **thin internal harness** to exercise them; the route that calls them in production lands with the P5 inbox.

### Anti-Patterns to Avoid
- **Collapsing `input_mode` into the pack key.** Documented anti-pattern at `domain-pack.ts:45-51`. Widen the `StimulusType` *union*; the pipeline keeps branching on `input_mode`. (DISCRETION confirms this.)
- **Touching the Socials path.** `normalizeInput`, `AnalysisInput`, `ContentPayload`, `runPredictionPipeline` branches stay byte-untouched (D-02). The `Stimulus` is a new, separate type.
- **Routing images through omni.** Founder-locked: omni (`qwen3.5-omni-flash`) is the **audio** sensor only. Images go to `qwen3.7-plus` (D-04). omni-flash being "flash" in its name ≠ "SIM-1 Flash tier" — SIM-1 **Flash = `qwen3.7-plus`**, SIM-1 **Max = `qwen3.5-omni-flash`** (D-03). Do not conflate the two "flash"es.
- **Re-cutting the contract in P5.** Carry the subject/goal tag now (D-06) so P5 consumes `Stimulus` with no re-cut (P1 D-05 "cut once").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OCR / screenshot reading | Tesseract.js glyph pipeline; a custom layout parser | `qwen3.7-plus` `image_url` vision call (D-04) | Semantic read of chat-bubble layouts; no new dep; same model already in the stack |
| Multipart parse | Manual boundary parsing | `request.formData()` + `File` (Web platform) | Built into Next 15; template at `api/profile/avatar/route.ts:17` |
| Image base64 framing | Custom MIME sniffing | `file.type` + `Buffer.from(await file.arrayBuffer()).toString("base64")` | `File.type` already carries the MIME; DashScope wants `data:${mime};base64,…` |
| `.txt`/`.md` read | Stream/encoding handling | `await file.text()` | Web `File` decodes UTF-8 for you; zero deps (D-05) |
| DashScope client | A new fetch wrapper | `getQwenClient()` (`qwen/client.ts:7`) | Singleton, `maxRetries:0`, correct baseURL already configured |
| Model-output JSON parse | `JSON.parse` raw | `stripModelOutput()` then parse then Zod | Models fence output; `omni-analysis.ts:291-297` is the proven sequence |

**Key insight:** the entire IN-03 capability is an **assembly** of patterns already live in `wave3/` — not new engineering. The risk is choosing the wrong shape, and that's now nailed with evidence.

## Common Pitfalls

### Pitfall 1: Conflating "omni-flash" with "SIM-1 Flash"
**What goes wrong:** Routing images/text to `qwen3.5-omni-flash` because both say "flash."
**Why it happens:** Naming collision. `QWEN_OMNI_MODEL = "qwen3.5-omni-flash"` (`client.ts:36`) is SIM-1 **Max**; `QWEN_REASONING_MODEL = "qwen3.7-plus"` (`client.ts:41`) is SIM-1 **Flash**.
**How to avoid:** Encode the mapping once in `tier.ts` as named constants and never inline a model id elsewhere. The discriminator is **audio**, not the word "flash."
**Warning signs:** An image call with `model: QWEN_OMNI_MODEL`.

### Pitfall 2: Forgetting the DashScope extension params / type-cast convention
**What goes wrong:** TS errors on `seed`/`enable_thinking`, or thinking-mode latency on `qwen3.7-plus` (it defaults thinking ON — `pipeline.ts:618`).
**How to avoid:** Mutate the params object + `@ts-expect-error` per the established convention (`pipeline.ts:631-634`); set `enable_thinking = false` for the vision read (it's perception, not reasoning) and `seed = QWEN_SEED` for determinism.
**Warning signs:** Vision call 2–3× slower than expected; non-reproducible reads.

### Pitfall 3: Using the user-supplied filename as a storage/path key
**What goes wrong:** Path traversal (`../../etc/...`) if a filename is ever interpolated into a storage path.
**How to avoid:** Never use `file.name` as a path. If a video is persisted, follow the avatar pattern `${user.id}/<fixed-or-uuid>.${ext}` (`avatar/route.ts:42`). For text/image, P4 reads **in-memory** (no path at all) — preferred. Only derive the extension for MIME inference, validated against an allowlist.
**Warning signs:** Any `storage.upload(userControlledString, …)`.

### Pitfall 4: Oversized base64 image exceeding DashScope's per-image limit
**What goes wrong:** The model call rejects an over-limit image (DashScope errors on images over its size cap).
**How to avoid:** Validate `file.size` against an image cap **before** base64-encoding (base64 inflates ~33%). Recommend a 10 MB raw cap and an allowlist of `image/png|jpeg|webp`. [CITED: DashScope vision docs — base64 must be `data:image/{format};base64,…` and `{format}` must match the supported-format list]
**Warning signs:** Intermittent vision failures on large screenshots.

### Pitfall 5: `npm test` / `npx vitest` reporting fake PASS(0)/FAIL(0)
**What goes wrong:** A green run that executed zero tests.
**How to avoid:** Run `node ./node_modules/vitest/vitest.mjs run`. [VERIFIED: project memory + CONTEXT D-50]
**Warning signs:** "PASS (0)" with no file names.

## Runtime State Inventory

> P4 is **greenfield-additive** (a new lib + type), not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts are renamed or moved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `Stimulus` is a new in-memory type; no DB schema, no collection/key rename | None (verified: no migration in scope; Socials tables untouched per D-02) |
| Live service config | None — no new env var required (`DASHSCOPE_API_KEY` already present, `qwen/client.ts:9`) | None |
| OS-registered state | None | None |
| Secrets/env vars | Reuses existing `DASHSCOPE_API_KEY`; no new key | None |
| Build artifacts | None — pure TS source addition | None |

## Code Examples

### Read a `.txt`/`.md` upload → text (IN-01)
```ts
// Source: synthesized from api/profile/avatar/route.ts:17-39 (FormData/validate) + Web File API
const ALLOWED_TEXT = new Set(["text/plain", "text/markdown", ""]); // some browsers send "" for .md
const TEXT_EXT = new Set([".txt", ".md"]);
const MAX_TEXT_BYTES = 1 * 1024 * 1024; // 1 MB

export async function readTextFile(file: File): Promise<string> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!TEXT_EXT.has(ext)) throw new Error(`Unsupported file type: ${ext}`);
  if (file.type && !ALLOWED_TEXT.has(file.type)) throw new Error(`Bad MIME: ${file.type}`);
  if (file.size > MAX_TEXT_BYTES) throw new Error("File too large");
  return (await file.text()).trim();   // zero parser deps (D-05)
}
```

### Image → base64 data URL → vision read (IN-03)
```ts
// Source: avatar/route.ts:25-39 (validate) + pass2:127 (image_url) + omni-analysis.ts:291-297 (parse seq)
const ALLOWED_IMG = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMG_BYTES = 10 * 1024 * 1024;

export async function readImageWithVision(file: File): Promise<string> {
  if (!ALLOWED_IMG.has(file.type)) throw new Error(`Bad image type: ${file.type}`);
  if (file.size > MAX_IMG_BYTES) throw new Error("Image too large");
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${file.type};base64,${b64}`;
  // ... assemble the QWEN_REASONING_MODEL call from Pattern 1, parse with stripModelOutput + Zod
  return readText; // the model's text read of the screenshot
}
```

### Tier rule (IN-02) — pure
```ts
// Source: D-03 + client.ts:36,41 model mapping
export type Sim1Tier = "flash" | "max";
// flash → qwen3.7-plus (QWEN_REASONING_MODEL); max → qwen3.5-omni-flash (QWEN_OMNI_MODEL)
export function resolveSim1Tier(kind: StimulusKind): Sim1Tier {
  return kind === "video" ? "max" : "flash";  // audio-bearing video → omni sensor; all else → 3.7-plus
}
```

### Recommended `Stimulus` shape (DISCRETION)
```ts
export type StimulusKind = "text" | "file_text" | "image" | "video";
// (omit "tiktok_url" from the General Stimulus — URL ingestion is the Socials path, D-02;
//  add later in P7 if Socials unifies. Person-video = "video", tier=Max.)

export interface Stimulus {
  kind: StimulusKind;
  content: string;              // normalized text (raw text | file text | image read | video transcript-later)
  source: {                     // provenance, untrusted-origin tagged
    origin: "text" | "file" | "image" | "video";
    filename?: string;          // for display only — NEVER used as a path (Pitfall 3)
    mime?: string;
    storagePath?: string;       // ONLY set for video (reuses existing video_upload storage)
  };
  tier: Sim1Tier;               // resolved (D-03), carried for P5's badge
  subject?: {                   // profiler-ready (D-06) — only set when this is a person to profile
    isProfiledSubject: true;
    goal?: string;              // the user's goal scope (Profile verb consumes in P5)
  };
}
```
For person-video, `content` may be empty in P4 (the omni read runs when P5 actually simulates); P4 sets `kind:"video"`, `source.storagePath`, `tier:"max"`, and the `subject` tag. **Do not run omni in P4** unless the harness needs it — P4 just makes the `Stimulus` carry the video reference + tag (D-06: "person-video ingestion already exists; only the tag is new").

### Widen the `StimulusType` union (DISCRETION)
```ts
// Source: domain-pack.ts:51 — widen the TYPE, do NOT add to Socials pack's list
export type StimulusType = "text" | "tiktok_url" | "video_upload" | "file_text" | "image";
// packs/socials.ts:74 stays ["text","tiktok_url","video_upload"] — Socials doesn't gain these;
// the General path's future pack declares file_text/image. Pipeline input_mode branching UNCHANGED.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three-model stack incl. `qwen3.6-flash` | **Two-model stack**: omni sensor + `qwen3.7-plus` everything | 2026-06-25 (`client.ts:42`) | Tier rule maps cleanly to exactly two models; no third option to reason about |
| `qwen3.6-plus` reasoning | `qwen3.7-plus` (vision-capable, deaf) | 2026-06-15 (`client.ts:40`) | The image reader is free — 3.7-plus already has vision |

**Deprecated/outdated:** `QWEN_FAST_MODEL` / `qwen3.6-flash` — RETIRED (`client.ts:42`). Do not reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DashScope per-image size cap ≈ 10 MB (used to size the validation cap) | Pitfall 4 / Code Examples | Low — if the real cap is lower, the model returns a clear size error; tighten the constant. The *format* requirement (`data:image/{format};base64,…`, format must match allowlist) is CITED, not assumed |
| A2 | `qwen3.7-plus` accepts a base64 `data:` URL in `image_url` (not just hosted URLs) | Pattern 1 | Low — DashScope OpenAI-compat docs state `data:` URLs are accepted [CITED]; repo only demonstrates hosted/signed URLs. **Mitigation: the planner should add a 1-call smoke that sends a tiny base64 PNG to `QWEN_REASONING_MODEL` early** to confirm before building on it. If base64 is rejected, fall back to the avatar-style Storage upload → signed URL (already proven in repo) — a known, small pivot |
| A3 | Browsers may send `.md` with empty `file.type` | Code Examples (readTextFile) | Low — allowlist includes `""` + extension check covers it |

**Highest-leverage action for the planner:** make A2 a **Wave-0 smoke task** (send a 1×1 base64 PNG to `qwen3.7-plus`, assert a 200 + parseable read). It de-risks the one remaining unknown for <1 min of model spend.

## Open Questions

1. **Does `qwen3.7-plus` accept base64 `data:` image URLs, or only hosted URLs?**
   - What we know: the SDK + content-array shape are identical to the proven `image_url`/`video_url` calls; DashScope docs say `data:` URLs are accepted [CITED].
   - What's unclear: the repo only ships hosted/signed-URL examples (keyframes, video). Base64 to this exact model id isn't exercised in-repo.
   - Recommendation: **Wave-0 base64 smoke** (A2). Fallback = Storage-upload → signed URL (avatar pattern). Either way IN-03 ships; this only decides whether a Storage round-trip is needed.

2. **Where does the upload HTTP route live (P4 vs P5)?**
   - What we know: D-01 says no new visible UI in P4; the lib + thin internal harness is P4's deliverable.
   - Recommendation: P4 ships the lib + a non-public harness (test or a dev-only route). The production upload route ships with P5's inbox. Keep the lib's public functions stable so P5 wires them with no re-cut.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `DASHSCOPE_API_KEY` | IN-03 vision call | ✓ (assumed — engine already runs on it) | env | None needed — it's the existing engine key (`qwen/client.ts:9`) |
| `openai` SDK | all model calls | ✓ | in `package.json` | — |
| `zod` | boundary validation | ✓ | in repo | — |
| Web `File`/`FormData` | upload parse | ✓ | Next 15 runtime | — |
| `ffmpeg-static` | (video only — NOT needed in P4) | ✓ | in repo | P4 doesn't extract frames; person-video reuses omni which takes a URL |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `nyquist_validation` enabled. Tests run via `node ./node_modules/vitest/vitest.mjs run` ONLY.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (in repo; engine tests under `src/lib/engine/__tests__/` + per-module `__tests__/`) |
| Config file | `vitest.config.*` (present — repo runs Vitest; confirm path in Wave 0) |
| Quick run command | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus` |
| Full suite command | `node ./node_modules/vitest/vitest.mjs run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IN-01 | text input → `Stimulus{kind:"text", content, tier:"flash"}` | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus/__tests__/normalize.test.ts` | ❌ Wave 0 |
| IN-01 | `.txt`/`.md` `File` → `content` = file text; bad ext rejected; oversize rejected | unit | same file | ❌ Wave 0 |
| IN-02 | `resolveSim1Tier`: video→"max", text/file_text/image→"flash" | unit (pure) | `… run src/lib/engine/stimulus/__tests__/tier.test.ts` | ❌ Wave 0 |
| IN-03 | image `File` → base64 data URL assembled; vision call shape (model=REASONING, image_url+text items); model mocked | unit (mock `getQwenClient`) | `… run src/lib/engine/stimulus/__tests__/vision.test.ts` | ❌ Wave 0 |
| IN-03 | A2 — real base64 PNG → `qwen3.7-plus` returns parseable read | smoke (live, Wave 0, gated) | dev harness / `it.skip` unless `DASHSCOPE_API_KEY` present | ❌ Wave 0 |
| D-02 | Socials path structurally unchanged: `normalizeInput`/`AnalysisInput`/`ContentPayload`/pipeline branches untouched | light structural smoke | `… run src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts` + existing `normalize.test.ts`, `pipeline.test.ts` stay green | ❌ Wave 0 (new) / ✅ (existing suites) |
| D-06 | person-video → `Stimulus{kind:"video", tier:"max", subject.isProfiledSubject, subject.goal}` | unit | `normalize.test.ts` | ❌ Wave 0 |

**Critical behaviors to validate (per the brief):** (1) each input kind normalizes correctly; (2) the audio-presence tier rule resolves the right SIM-1 tier per kind; (3) the Socials path is structurally unchanged — **light smoke, not byte-golden** (P1 D-02/D-03). The vision model call is **mocked** in unit tests (assert request shape + response parsing); the one live touch is the gated A2 base64 smoke.

### Sampling Rate
- **Per task commit:** `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus`
- **Per wave merge:** `node ./node_modules/vitest/vitest.mjs run` (full suite — catches any accidental Socials-path regression)
- **Phase gate:** Full suite green + the D-02 structural smoke green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/engine/stimulus/__tests__/normalize.test.ts` — IN-01 + D-06
- [ ] `src/lib/engine/stimulus/__tests__/tier.test.ts` — IN-02
- [ ] `src/lib/engine/stimulus/__tests__/vision.test.ts` — IN-03 (mock `getQwenClient`)
- [ ] `src/lib/engine/stimulus/__tests__/ingest.test.ts` — file validate (size/type/ext)
- [ ] `src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts` — D-02
- [ ] A2 base64 vision live smoke (gated on `DASHSCOPE_API_KEY`)
- [ ] Confirm `vitest.config` path (framework already installed — no install needed)

## Security Domain

> `security_enforcement` enabled (default). P4's surface = the **ingestion boundary** (untrusted file bytes + untrusted image → model). The user-text→scorer-prompt injection is explicitly **carried to P5** (DISCRETION + Deferred) — do not solve it here.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (P4) | The lib is auth-agnostic; the production route (P5) does `supabase.auth.getUser()` (avatar pattern). A P4 dev harness need not auth |
| V3 Session Management | no | — |
| V4 Access Control | no (P4) | Arrives with the P5 route |
| V5 Input Validation | **yes** | Zod at the `Stimulus` boundary; file ext+MIME allowlist; size caps (text 1 MB, image 10 MB); reject before processing |
| V6 Cryptography | no | No new crypto |
| V12 File Upload | **yes** | MIME+extension allowlist; size cap pre-decode; **never use `file.name` as a path** (in-memory read preferred); for video reuse the `${userId}/…` storage convention |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via uploaded filename | Tampering | Never interpolate `file.name` into a path; in-memory read for text/image; `${user.id}/<uuid>` for video (avatar pattern, `avatar/route.ts:42`) |
| Oversized / decompression-bomb upload | Denial of Service | `file.size` cap **before** base64/`text()`; reject early (avatar pattern) |
| Malicious MIME / disguised file | Spoofing | Allowlist MIME **and** extension; don't trust one alone |
| Prompt injection via image/text content → model | Tampering / Info Disclosure | P4: isolate untrusted content in the **user**-content array (never the system prompt); use `response_format: json_object` + Zod-validate the model's read. **NOTE:** the deeper user-text→`simulate()`-prompt injection is **P5's** carry-forward — not solved here |
| Stored PII (screenshots may contain personal data) | Info Disclosure | Prefer in-memory base64 (no persisted artifact) over a Storage round-trip for the transient image read |

## Sources

### Primary (HIGH confidence) — repo code evidence
- `src/lib/engine/qwen/client.ts:7,15,28,36,41,42,51` — `getQwenClient`, two-model stack, model id mapping, deaf-not-blind
- `src/lib/engine/wave3/persona-prompts-pass2.ts:106-134` — the `image_url` content-item shape (the IN-03 proof)
- `src/lib/engine/wave3/fold.ts:64,317-339` + `fold-prompts.ts:149-175` — `QWEN_REASONING_MODEL` driven with a multimodal `content[]` array
- `src/lib/engine/qwen/omni-analysis.ts:234,259-297` — call structure + parse sequence (strip→JSON→Zod)
- `src/lib/engine/pipeline.ts:415,452,612-635` — input_mode branching; text-mode 3.7-plus params + DashScope extension casts
- `src/lib/engine/normalize.ts:42-66` — the normalizer to mirror
- `src/lib/engine/types.ts:154-216` — `AnalysisInputSchema` + `ContentPayload` (the untouched Socials contract)
- `src/lib/engine/domain-pack.ts:45-51,129-141` — `StimulusType` + anti-pattern note + descriptor
- `src/lib/engine/packs/socials.ts:74` — Socials `stimulusTypes` list (stays as-is)
- `src/app/api/profile/avatar/route.ts:17-47` — FormData upload + validate + Storage template
- `src/lib/engine/filmstrip/extract.ts` — ffmpeg path (NOT needed in P4; documents the video-frame path P4 avoids)
- `src/lib/engine/__tests__/` + `retrieval/__tests__/` — test layout precedent

### Secondary (MEDIUM confidence) — official docs
- [Integrate Qwen-VL via Model Studio (OpenAI-compatible)](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-compatible-with-openai) — `image_url` content type, compatible-mode base URL
- [Model Studio: Image and video understanding](https://www.alibabacloud.com/help/en/model-studio/vision) — base64 `data:image/{format};base64,…` requirement; format must match supported list
- [Call Qwen via OpenAI API](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) — DashScope OpenAI-compat surface

### Tertiary (LOW confidence)
- Exact per-image byte cap (≈10 MB) — not pinned to an official number this session (A1); used only to size a validation constant

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all reuse, every lib evidenced in-repo
- Architecture / IN-03 call shape: HIGH — the exact `image_url` item + multimodal `content[]` to `QWEN_REASONING_MODEL` are both already in the codebase
- Tier rule: HIGH — model mapping verbatim in `client.ts`
- Pitfalls: HIGH — each tied to a `file:line`
- Base64-to-model acceptance: MEDIUM — CITED in docs, not exercised in-repo (de-risked by the A2 Wave-0 smoke)

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable; the only volatile element is the DashScope model roster, pinned via env in `client.ts`)

## RESEARCH COMPLETE

**Phase:** 4 - Input Adapter
**Confidence:** HIGH

### Key Findings
- **The #1 unknown is solved with zero guessing:** `qwen3.7-plus` (`QWEN_REASONING_MODEL`) already receives multimodal `content[]` arrays in `fold.ts`, and the exact `{type:"image_url", image_url:{url}}` item is already built in `persona-prompts-pass2.ts:127`. **There is no client wrapper to extend** — stages call `getQwenClient().chat.completions.create({model, messages:[…]})` directly. IN-03 = assemble that call with `model: QWEN_REASONING_MODEL`, a base64 `data:` URL, `enable_thinking:false`, `seed`, `response_format:json_object`.
- **One residual unknown (A2):** base64 `data:` URLs are CITED-accepted by DashScope but only hosted/signed URLs are exercised in-repo. De-risked by a <1-min Wave-0 base64 smoke; fallback = avatar-style Storage→signed-URL.
- **Tier rule is two named constants:** SIM-1 Max = `qwen3.5-omni-flash` (audio sensor, video only), SIM-1 Flash = `qwen3.7-plus` (everything else). Operational rule: `kind==="video" ? "max" : "flash"`. Beware the omni-**flash** / SIM-1-**Flash** name collision.
- **Zero new packages, zero new infra, zero parser deps** (D-05). Reuse `openai`, `zod`, `@supabase/*`, Web `File`/`FormData`. `.txt`/`.md` = `await file.text()`.
- **Module layout (decisive):** new `src/lib/engine/stimulus/` folder (`types`/`normalize`/`ingest`/`vision`/`tier` + `__tests__/`), mirroring `qwen/`, `wave3/`, `retrieval/`. Widen the `StimulusType` union with `"file_text"|"image"`; do NOT touch `input_mode` branching or the Socials pack list (D-02 + domain-pack.ts:45-51).

### File Created
`.planning/phases/04-input-adapter/04-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All reuse; every lib evidenced in-repo |
| Architecture (IN-03 call shape) | HIGH | Exact item shape + multimodal call already in codebase |
| Pitfalls | HIGH | Each tied to file:line |
| Base64-to-model acceptance | MEDIUM | CITED in docs, not in-repo; A2 Wave-0 smoke de-risks |

### Open Questions
- A2: base64 `data:` image acceptance by `qwen3.7-plus` — resolve with a gated Wave-0 smoke; fallback proven.
- Upload HTTP route home (P4 thin harness vs P5 production route) — keep lib functions stable so P5 re-cuts nothing.

### Ready for Planning
Research complete. The planner has the exact IN-03 call shape, the tier mapping, the module layout, the boundary-hardening controls, and a Wave-0 test map. Planner can now create PLAN.md files.
