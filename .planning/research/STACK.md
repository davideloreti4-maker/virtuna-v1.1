# Stack Research — Viral Remix (v3.2)

**Domain:** Non-owned TikTok structural ingestion + Qwen concept generation + analysis lineage
**Researched:** 2026-05-31
**Confidence:** HIGH on the in-repo findings (every claim is file+line grounded); MEDIUM on the external Apify download-flag behavior (flagged as the spike's first live test — Context7/Apify docs were unreachable from the sandbox).

---

## TL;DR for the roadmapper + spike

- **Almost nothing new needs to be installed.** Every dependency the three features need is already in `package.json`: `apify-client@2.9.3`, `ffmpeg-static@5.2.0`, `openai@4.77.0` (DashScope OpenAI-compat), `nanoid@5.0.9`, `zod@3.24.1`, `@supabase/supabase-js@2.47.10`.
- **The ingestion gap is a code bug, not a missing capability.** The full tiktok_url → frames pipeline is already wired end-to-end **except one undefined method**: `resolve-video.ts:66` calls `provider.resolveVideoUrl(tiktok_url)`, but `ApifyScrapingProvider` (`apify-provider.ts`) never defines it. The path was committed as a WIP scaffold (`6dc4f0d wip(engine): wave1 omni + media resolve scaffold`).
- **Decode signal source is Qwen-Omni's multimodal ingestion, not a transcript string.** `extractTranscript` is a hard-coded `return null` stub (`transcript.ts:20`). Frames/audio reach the model only because DashScope fetches the resolved `videoUrl` server-side (`client.ts:44`). No usable mp4 URL today ⇒ silent degrade to caption-only.
- **Concept generation needs zero new infra** — `QWEN_MODELS.TEXT = "qwen-max"` already exists (`dashscope/models.ts:12`); add a prompt, not a provider.
- **Lineage needs one column** — `analysis_results` has no `parent_id`; it already has a `variants: Json` extensibility bag (`database.types.ts`).

---

## Recommended Stack

### Core Technologies (all ALREADY in the repo — reuse, don't add)

| Technology | Version (pinned) | Purpose for Remix | Why it already covers this |
|------------|------------------|-------------------|----------------------------|
| `apify-client` | 2.9.3 | Resolve a non-owned TikTok URL → CDN mp4 download URL | `ApifyScrapingProvider` already wraps Clockworks actors (`apify-provider.ts:8-9`). Latest npm is 2.12.1 (same major; **no upgrade required**). |
| `ffmpeg-static` | 5.2.0 | Frame extraction from a remote mp4 URL | `extractFrameAtTimestamp(videoUrl, t)` already spawns ffmpeg against a **remote URL** (`filmstrip/extract.ts:33-40`) — works on any fetchable mp4, not just owned uploads. |
| `openai` (DashScope OpenAI-compat) | 4.77.0 | Qwen-Omni multimodal call + Qwen-Max concept generation | `callDashScopeOmni` already accepts `videoUrl` and lets DashScope fetch it (`client.ts:35-45`). `QWEN_MODELS.TEXT/OMNI/VISION/ASR` registered (`models.ts:9-16`). |
| `@supabase/supabase-js` | 2.47.10 | `parent_id` lineage column + `variants` JSONB for decode/adapt payloads | `analysis_results.variants: Json` already exists and is the documented extensibility bag for craft + filmstrip (`route.ts:88-145`). |
| `nanoid` | 5.0.9 | Child analysis IDs (Develop & predict) | Already used for `analysisId` (`route.ts:578`). |
| `zod` | 3.24.1 | Validate remix request body + decode/adapt LLM output | `AnalysisInputSchema` already discriminates `input_mode` (`engine/types.ts:83`). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `qwen-audio-asr` (model, not a package) | n/a | Real transcript string if Decode needs verbatim spoken hook copy | Only if the spike proves Omni's structured output lacks hook-line fidelity. `QWEN_MODELS.ASR = "qwen-audio-asr"` is already registered (`models.ts:15`); `extractTranscript` (`transcript.ts:15`) is the wiring point. **Default: do NOT wire it** — Omni already ingests audio. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Apify console (manual run) | Confirm Clockworks returns a fetchable mp4 for a single arbitrary URL | First action of the spike. Run `clockworks/tiktok-scraper` against ONE non-owned URL with the download flag; inspect output JSON for `mediaUrls` / `videoMeta.downloadAddr`. |
| `scripts/measure-pipeline.ts` (existing) | Verify a real tiktok_url run produces non-empty `video_signals` once `resolveVideoUrl` lands | Referenced in PROJECT memory for latency; reuse to prove frame signal, not just timing. |

---

## Ingestion (THE SPIKE — req #8): verified-present / verified-absent / unconfirmed

The non-owned-URL ingestion chain, traced in code:

```
Board.tsx:407-414  body = { input_mode: "tiktok_url", tiktok_url }   [VERIFIED PRESENT]
        │
        ▼
/api/analyze route.ts:238-246   validates URL FORMAT ONLY (regex)     [VERIFIED — no media fetch here]
        │
        ▼
run-pipeline → wave1.ts:32  resolveVideoSource(input)                 [VERIFIED PRESENT]
        │
        ▼
resolve-video.ts:58-78  input_mode==="tiktok_url" branch:
   line 66:  provider.resolveVideoUrl(input.tiktok_url)               [VERIFIED ABSENT — method undefined]
        │                                                             ApifyScrapingProvider only defines
        │                                                             scrapeProfile (apify-provider.ts:20)
        │                                                             + scrapeVideos (apify-provider.ts:51)
        ▼  (would throw → caught at resolve-video.ts:72 → returns null)
wave1.ts:38 runOmniAnalysis({ videoUrl: null, ... })                  [VERIFIED — degrades]
        │
        ▼
qwen-omni.ts:34  !videoUrl → textOnlyAnalysis(contentText)           [VERIFIED — caption-only result]
```

**Characterization per the quality gate:**

| Link in the chain | Status | Evidence |
|-------------------|--------|----------|
| UI sends `input_mode: tiktok_url` | **VERIFIED PRESENT** | `Board.tsx:407-414` |
| Route ingests video for a URL | **VERIFIED ABSENT** | `route.ts:238-246` does URL-format regex only; no scrape/download |
| `resolveVideoSource` tiktok branch exists | **VERIFIED PRESENT** | `resolve-video.ts:58-78` |
| `provider.resolveVideoUrl()` is defined | **VERIFIED ABSENT** | grep: only call site is `resolve-video.ts:66`; not in `apify-provider.ts` nor `ScrapingProvider` interface (`scraping/types.ts:27-33`); introduced WIP in `6dc4f0d` |
| Frame extraction works on a non-owned remote mp4 | **VERIFIED PRESENT (capability)** | `filmstrip/extract.ts:33-40` runs ffmpeg against any `videoUrl` |
| Qwen-Omni ingests frames+audio from a URL | **VERIFIED PRESENT (capability)** | `client.ts:44-45` pushes `{type:"video_url", video_url:{url}}`; DashScope fetches server-side |
| Transcript string available to the engine | **VERIFIED ABSENT** | `transcript.ts:15-21` is a `return null` stub; Omni handles audio implicitly |
| Clockworks actually returns a fetchable mp4 for an arbitrary URL | **UNCONFIRMED — NEEDS SPIKE** | Apify/Context7 unreachable from sandbox. Code comment at `schemas/competitor.ts:54-55` asserts the actor *can* return `mediaUrls` but the current schema drops them. TikTok CDN mp4 URLs are also signed/short-TTL — must confirm they survive long enough for DashScope to fetch. |

### What the spike must test (concrete, in order)

1. **Live Clockworks run on ONE arbitrary non-owned URL.** Enable video download (`shouldDownloadVideos` or equivalent input flag) and capture the raw item. Confirm a field with a directly-fetchable mp4 (`mediaUrls[]` and/or `videoMeta.downloadAddr`). This is the single make-or-break unknown.
2. **mp4 fetchability + TTL.** `curl` the returned URL from a server context (DashScope's fetcher and `ffmpeg-static` both fetch server-side). TikTok CDN URLs are often signed and expire in minutes — confirm the window covers a ~90–312s pipeline, or plan to re-host (download → Supabase `videos` bucket → signed URL, reusing `filmstrip/storage.ts` pattern).
3. **Omni signal on a non-owned mp4.** Run the resolved URL through `callDashScopeOmni` and assert non-empty `video_signals` / hook / pacing fields — i.e. Decode-grade structure, not metadata.
4. **Transcript necessity.** Decide if Omni's structured output already names the hook line / spoken beats. If yes, leave `extractTranscript` stubbed. If no, wire `qwen-audio-asr` (already registered, `models.ts:15`).
5. **Latency + cost delta** of the Apify resolve hop added in front of the ~90–312s pipeline (Apify run alone can be 30–120s; spike must measure).

---

## Concept-generation stack (Adapt frame — req #3)

**Add a prompt, not a provider.** Everything is present:

- `QWEN_MODELS.TEXT = "qwen-max"` (`dashscope/models.ts:12`) — Qwen-only constraint satisfied (no Gemini/DeepSeek).
- DashScope client + auth already initialized (`dashscope/client.ts`).
- `zod` for output-shape validation of the 3-concept array.
- Niche source: `creator_profiles` table is already queried in the route (`route.ts:278-283`); read niche there with inline fallback (req #7).

Integration point: a new `src/lib/engine/remix/` module (decode prompt + adapt prompt + parse), invoked **outside** the score pipeline because Decode/Adapt run on generation, while Predict reuses `/api/analyze` per concept (req #4). Do **not** call the full `runPredictionPipeline` for decode/adapt — that's the expensive scorer; decode/adapt are two cheap `qwen-max` calls over the Omni structural output.

---

## Lineage / storage (req #5)

- **One migration:** add `parent_id text references analysis_results(id)` + index to `analysis_results`. No `parent_id` exists today (grep clean across `database.types.ts` + `supabase/`).
- **Decode/Adapt payload:** persist into the existing `variants: Json` bag (e.g. `variants.remix = { decode, concepts }`) — same read-merge-write pattern already used for `variants.craft` (`route.ts:121-138`). **No new columns for the payload.** This honors "structural analysis only, never store the source video" (boundary): you store derived JSON, not media.
- **"Remixed from" chip + Recent:** the sidebar already lists analyses by `user_id`; add `parent_id` to the select and render the chip. No new table.

---

## What to add (the complete list — minimal by design)

| # | Add | Where | Why |
|---|-----|-------|-----|
| 1 | `resolveVideoUrl(tiktokUrl): Promise<string \| null>` **method** | `src/lib/scraping/apify-provider.ts` + add to `ScrapingProvider` interface (`scraping/types.ts`) | The one missing link `resolve-video.ts:66` already calls. Single-video Clockworks run → extract the mp4 from the item. |
| 2 | Extend `apifyVideoSchema` to keep `mediaUrls` / download field | `src/lib/schemas/competitor.ts:35` (comment at :54-55 says it's deliberately dropped today) | So `resolveVideoUrl` can read the mp4 URL the actor returns. |
| 3 | mp4 re-host fallback (download → Supabase `videos` bucket → signed URL) | reuse `filmstrip/storage.ts` upload+sign pattern | Only if the spike finds TikTok CDN URLs expire before DashScope fetches them. **Conditional on spike step 2.** |
| 4 | `src/lib/engine/remix/` — decode + adapt prompts + zod parse | new dir | Decode/Adapt generation (`qwen-max`). |
| 5 | Migration: `analysis_results.parent_id` + index | `supabase/migrations/` | Lineage (req #5). |
| 6 | (Conditional) wire `qwen-audio-asr` in `extractTranscript` | `transcript.ts:15` | Only if spike step 4 says Omni output lacks hook-line fidelity. |

**No new npm packages** unless the spike's step-2 mp4 fetchability fails for ALL approaches via apify-client — see "What NOT to use" before reaching for `yt-dlp`.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `yt-dlp` / `@distube/ytdl` / standalone tiktok-downloader npm packages | New runtime dependency + binary; TikTok actively breaks scrapers; duplicates capability the **already-installed** Apify Clockworks actor provides. Violates the SPEC "reuse, don't rebuild" constraint. | Add `resolveVideoUrl` on top of the existing `apify-client` (item #1). Only revisit if the spike proves Clockworks cannot return a fetchable mp4. |
| A separate transcription/ASR SaaS (Whisper API, Deepgram, AssemblyAI) | Breaks the Qwen-only constraint; new vendor + key + cost. Omni already ingests the audio track. | `qwen-audio-asr` (already in `models.ts:15`), and only if proven necessary. |
| A new table for remix lineage / decode payload | `analysis_results.variants: Json` + a `parent_id` column cover both. New table = new RLS, new joins, more surface area. | `variants.remix` JSON + `parent_id` column (items #2/#5). |
| Calling `runPredictionPipeline` to generate decode/adapt | That's the ~90–312s scorer; decode/adapt are cheap `qwen-max` calls. Bulk-scoring is explicitly out of scope (req #4). | Dedicated `engine/remix/` prompts; Predict reuses `/api/analyze` only on per-concept Develop. |
| Upgrading `apify-client` to 2.12.1 | No feature need; risk for zero benefit. | Stay on 2.9.3 (same major). |
| Persisting the source mp4 long-term | Boundary: "do not store/redistribute third-party media." | Resolve URL transiently for analysis; persist only derived JSON. |

---

## Integration Points (exact file paths for the spike + roadmap)

| Concern | File:line | Action |
|---------|-----------|--------|
| Define the missing method | `src/lib/scraping/apify-provider.ts` (after :92) + `src/lib/scraping/types.ts:33` | Add `resolveVideoUrl` to class + interface |
| Capture the mp4 field | `src/lib/schemas/competitor.ts:35-55` | Keep `mediaUrls` (currently dropped) |
| Ingestion branch (consumer) | `src/lib/engine/media/resolve-video.ts:58-78` | Already correct; un-breaks once method exists |
| Frame extraction (reuse) | `src/lib/engine/filmstrip/extract.ts:33-40` | Works on the resolved remote mp4 as-is |
| Omni multimodal call (reuse) | `src/lib/engine/dashscope/client.ts:35-45` | Already accepts `videoUrl` |
| Transcript wiring point | `src/lib/engine/media/transcript.ts:15-21` | Stub; wire `qwen-audio-asr` only if needed |
| Concept generation model | `src/lib/engine/dashscope/models.ts:12` (`qwen-max`) | New `engine/remix/` calls this |
| Niche source | `src/app/api/analyze/route.ts:278-283` (`creator_profiles`) | Read niche; inline fallback (req #7) |
| Decode/Adapt payload persistence | `src/app/api/analyze/route.ts:121-138` (`persistCraftToVariants` pattern) | Mirror for `variants.remix` |
| Remix request entry | `src/components/board/Board.tsx:398-414` | Add remix mode + decode/adapt branch (req #1) |
| Lineage column | `supabase/migrations/` + `analysis_results` (no `parent_id` today) | New migration (req #5) |
| Child analysis id | `src/app/api/analyze/route.ts:578` (`nanoid`) | Reuse; set `parent_id` on insert |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Extend Apify Clockworks actor (`resolveVideoUrl`) | `yt-dlp` server binary | Only if the spike proves Clockworks returns no fetchable mp4 AND a re-host strategy also fails. High maintenance — TikTok breaks downloaders often. |
| Pass resolved mp4 URL directly to DashScope | Download bytes → inline `data:` URI to Omni (`client.ts:46-51` already supports it) | If TikTok CDN URLs are not externally fetchable by DashScope but ARE fetchable by our server. Bytes path exists but is base64-heavy; prefer URL or Supabase re-host. |
| Omni structural output as Decode signal | Wire `qwen-audio-asr` for a verbatim transcript | If Decode needs the exact spoken hook line and Omni's JSON doesn't surface it (spike step 4). |
| Supabase re-host fallback for the mp4 | Trust TikTok CDN URL for the full pipeline duration | If spike step 2 shows the signed URL outlives the ~90–312s run. |

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `apify-client` | 2.9.3 (latest 2.12.1) | Same major; `resolveVideoUrl` needs no upgrade. |
| `ffmpeg-static` | 5.2.0 | Already proven against remote URLs in `filmstrip/extract.ts`. |
| `openai` | 4.77.0 | DashScope OpenAI-compat; `video_url` content part already used (`client.ts:45`). |
| `next` | 15.1.3 | Route already `runtime="nodejs"` + `maxDuration=300` (`route.ts:147-149`) — required for the long SSE + the added Apify hop. Watch the latency budget. |

---

## Open Questions for the Spike

1. **(blocking)** Does `clockworks/tiktok-scraper` return a directly-fetchable mp4 for a single arbitrary non-owned URL, and what is the exact field (`mediaUrls[]` vs `videoMeta.downloadAddr`)? — UNCONFIRMED; Apify docs unreachable from sandbox.
2. **(blocking)** Do the returned TikTok CDN URLs stay fetchable long enough (server-side) for DashScope + ffmpeg across a ~90–312s pipeline, or is Supabase re-host mandatory?
3. Does Qwen-Omni's structured output already name the hook line / spoken beats well enough for Decode, or is `qwen-audio-asr` required?
4. What latency/cost does the Apify resolve hop add in front of the existing pipeline (Apify single-run can be 30–120s)?
5. Should the remix path resolve the mp4 once and reuse it for both Omni and filmstrip extraction (avoid double-fetch of a short-TTL URL)?

---

## Sources

- In-repo code (HIGH — all file+line cited above): `apify-provider.ts`, `scraping/types.ts`, `engine/types.ts`, `engine/media/resolve-video.ts`, `engine/engine/wave1.ts`, `engine/analysis/qwen-omni.ts`, `engine/media/transcript.ts`, `engine/dashscope/client.ts`, `engine/dashscope/models.ts`, `filmstrip/extract.ts`, `filmstrip/storage.ts`, `app/api/tiktok/preview/route.ts`, `app/api/analyze/route.ts`, `components/board/Board.tsx`, `schemas/competitor.ts`, `types/database.types.ts`, `package.json`, git (`6dc4f0d`, base `9626c92`).
- npm registry (HIGH): `apify-client` latest = 2.12.1.
- Apify Clockworks `shouldDownloadVideos` / `mediaUrls` behavior (MEDIUM — training data + in-repo comment `schemas/competitor.ts:54-55`; Context7 CLI + Apify docs unreachable from sandbox). Flagged as spike step 1, must be confirmed by a live run before Decode is planned.

---
*Stack research for: Viral Remix non-owned ingestion + Qwen concept generation + lineage*
*Researched: 2026-05-31*
