# Stack Research — Viral Remix (v3.2)

**Domain:** Non-owned TikTok structural ingestion + Qwen concept generation + analysis lineage
**Researched:** 2026-05-31
**Confidence:** HIGH on the in-repo findings (file+line grounded from direct reads). MEDIUM on the external Apify download behavior (WebSearch + Apify store pages; Context7 + the actor store page were partly unreachable from the sandbox — flagged as the spike's first live test).

> Correction note: an earlier draft of this file referenced `resolve-video.ts`, a `media/` dir, a `dashscope/` dir, and a `resolveVideoUrl` provider method. **None of those exist in this repo.** This version is re-grounded against the files that actually exist. The real engine lives under `src/lib/engine/qwen/`, and the `tiktok_url` path runs through `pipeline.ts` directly.

---

## TL;DR for the roadmapper + spike

- **No new npm packages are required for the happy path.** Everything is already installed: `apify-client@^2.22.1`, `ffmpeg-static@^5.3.0`, `openai@^6.22.0` (DashScope OpenAI-compat client), `nanoid@^5.1.6`, `zod@^4.3.6`.
- **The ingestion gap is VERIFIED ABSENT, not just unconfirmed.** For `input_mode: "tiktok_url"`, the pipeline does **not** fetch frames, audio, or a transcript. It runs a **caption-only** text analysis. The multimodal Omni call is gated on `signedVideoUrl`, which is populated **only for `video_upload` mode** (`pipeline.ts:494-508, 520`). A pasted third-party URL therefore decodes from its caption alone today — insufficient for structural Decode.
- **What IS unconfirmed is the remediation, not the gap:** whether Clockworks `tiktok-scraper` reliably returns a fetchable mp4 for a single arbitrary non-owned URL, and whether that URL survives long enough (server-side) for Omni + ffmpeg. That is the spike's blocking test.
- **Concept generation needs no new infra** — the text model (`QWEN_REASONING_MODEL`, `qwen/client.ts`) already exists and is Qwen-only. Add a prompt module, not a provider.
- **Lineage needs one migration** — `analysis_results` (`database.types.ts:180`) has no `parent_id`; the route already writes derived JSON into a `variants`/extensibility bag pattern (`route.ts:88-145`).

---

## Recommended Stack (all ALREADY in the repo — reuse, don't add)

### Core Technologies

| Technology | Version (pinned) | Purpose for Remix | Why it already covers this |
|------------|------------------|-------------------|----------------------------|
| `apify-client` | ^2.22.1 (latest 2.23.3) | Resolve a non-owned TikTok URL → mp4 download URL | `ApifyScrapingProvider` already wraps Clockworks actors (`apify-provider.ts:8-9`). **Same major as latest — no upgrade needed.** |
| `ffmpeg-static` | ^5.3.0 | Frame extraction from a remote mp4 URL | `extractFrameAtTimestamp(videoUrl, t)` already spawns ffmpeg against a **remote URL** (`filmstrip/extract.ts:33-40`) — works on any fetchable mp4, not just owned uploads. |
| `openai` (DashScope OpenAI-compat) | ^6.22.0 | Qwen-Omni multimodal ingestion + Qwen text concept generation | The Qwen client + `analyzeVideoWithOmni` already exist (`qwen/client.ts`, `qwen/omni-analysis.ts`); the pipeline calls Omni with `signedVideoUrl` (`pipeline.ts:520-525`). |
| `@supabase/supabase-js` | ^2.93.1 | `parent_id` lineage column + derived decode/adapt payload storage | `analysis_results` table exists (`database.types.ts:180`); the route already does read-merge-write of derived JSON (`route.ts:121-138`). |
| `nanoid` | ^5.1.6 | Child analysis IDs (Develop & predict) | Already used for `analysisId` (`route.ts:578`, `pipeline.ts:417`). |
| `zod` | ^4.3.6 | Validate remix body + decode/adapt LLM output | `AnalysisInputSchema` already discriminates `input_mode` (`engine/types.ts:135-167`). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Qwen ASR model (`qwen-audio-asr` or equivalent, model not package) | n/a | Verbatim transcript string, IF Decode needs the exact spoken hook line | Only if the spike proves Omni's structured output lacks hook-line fidelity. Stays Qwen-only. **Default: do NOT add** — Omni ingests the audio track when given a video URL. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Apify console (manual run) | Confirm Clockworks returns a fetchable mp4 for ONE arbitrary non-owned URL | First action of the spike. Run `clockworks/tiktok-scraper` with `shouldDownloadVideos: true` against a single video URL; inspect the dataset item for `mediaUrls[0]`. |
| `scripts/measure-pipeline.ts` (existing) | Prove a real `tiktok_url` run produces non-empty `video_signals` once a resolver lands | Referenced in project memory for latency; reuse to prove frame/Omni signal, not just timing. |

---

## Ingestion (THE SPIKE — req #8): verified-present / verified-absent / unconfirmed

The actual non-owned-URL chain, traced in code that exists:

```
Board.tsx:302-305   body = { input_mode:"tiktok_url", tiktok_url, content_type:"video" }   [VERIFIED PRESENT]
        │
        ▼
/api/analyze route.ts:238-246   validates URL FORMAT ONLY (regex)                          [VERIFIED — no media fetch]
        │
        ▼
runPredictionPipeline → normalize.ts:55   video_url = tiktok_url   (stored, NOT fetched)   [VERIFIED]
        │
        ▼
pipeline.ts:494-508   signedVideoUrl set ONLY if input_mode==="video_upload"               [VERIFIED ABSENT for URL]
        │                                                                                   tiktok_url ⇒ signedVideoUrl = null
        ▼
pipeline.ts:520  if (signedVideoUrl) { analyzeVideoWithOmni(...) }                          [VERIFIED — Omni SKIPPED for URL]
        │  (false for tiktok_url)
        ▼
pipeline.ts:564-606  text-only branch: Qwen analyzes validated.content_text (CAPTION ONLY) [VERIFIED — no frames/audio]
        │            video_signals: null; signalAvailability all false
        ▼
pipeline.ts:871  Pass 2 / segments skipped for tiktok_url ("no segments")                  [VERIFIED]
```

**Characterization per the quality gate:**

| Link in the chain | Status | Evidence |
|-------------------|--------|----------|
| UI sends `input_mode: tiktok_url` | **VERIFIED PRESENT** | `Board.tsx:302-305` |
| Route ingests video for a URL | **VERIFIED ABSENT** | `route.ts:238-246` — URL-format regex only; no scrape/download |
| Pipeline fetches a video for `tiktok_url` | **VERIFIED ABSENT** | `pipeline.ts:496` gates the signed-URL fetch on `input_mode==="video_upload"`; `tiktok_url` never enters it |
| Omni multimodal call runs for a URL | **VERIFIED ABSENT** | `pipeline.ts:520` `if (signedVideoUrl)` — null for `tiktok_url`, so `analyzeVideoWithOmni` is skipped |
| What `tiktok_url` actually analyzes | **VERIFIED: caption text only** | `pipeline.ts:564-606` text branch over `validated.content_text`; `video_signals: null`, all `signalAvailability` false (`:597`) |
| Frame extraction works on a non-owned remote mp4 (capability) | **VERIFIED PRESENT** | `filmstrip/extract.ts:33-40` runs ffmpeg against any `videoUrl` |
| Omni can ingest frames+audio from a URL (capability) | **VERIFIED PRESENT** | `analyzeVideoWithOmni(signedVideoUrl, …)` already does this for owned uploads (`pipeline.ts:522`) — needs a video URL fed in |
| Apify resolves a SINGLE arbitrary URL → mp4 | **VERIFIED ABSENT in code** | `apify-provider.ts` only exposes `scrapeProfile(handle)` + `scrapeVideos(handle)`; both take a **handle**, neither resolves one video URL. No single-URL resolver exists. |
| `apifyVideoSchema` captures the mp4 download field | **VERIFIED ABSENT** | `schemas/competitor.ts:52-69` keeps `webVideoUrl` (page URL) + `videoMeta.duration` only — drops `mediaUrls`/`downloadAddr` |
| Transcript string available to the engine | **VERIFIED ABSENT** | text branch sets no transcript; Omni would handle audio implicitly only when fed a video URL |
| Clockworks reliably returns a fetchable mp4 for an arbitrary URL | **UNCONFIRMED — NEEDS SPIKE** | MEDIUM: store pages confirm `shouldDownloadVideos: true` → `mediaUrls` (one Apify CDN link), but multiple actor issues report `mediaUrls` empty/dead for a meaningful fraction (~10%+). Must be confirmed live. |
| Resolved mp4 URL stays fetchable for the ~90–312s pipeline | **UNCONFIRMED — NEEDS SPIKE** | TikTok CDN URLs are signed/short-TTL; Apify CDN copies have their own TTL. Confirm or plan a re-host. |

### What the spike must test (concrete, in order)

1. **Live Clockworks run on ONE arbitrary non-owned URL** with `shouldDownloadVideos: true`. Capture the raw dataset item; confirm `mediaUrls[0]` (and/or any `downloadAddr`) is a directly-fetchable mp4. Measure the empty-result rate across ~10 varied URLs (actor issues report non-trivial failures). This is the single make-or-break unknown.
2. **mp4 fetchability + TTL.** `curl` the returned URL from a server context. Confirm the window covers a ~90–312s pipeline; if not, plan a re-host (download → Supabase `videos` bucket → signed URL, reusing the `filmstrip/storage.ts` upload+sign pattern, then feed that signed URL into `analyzeVideoWithOmni`).
3. **Omni signal on a non-owned mp4.** Feed the resolved/re-hosted URL into `analyzeVideoWithOmni` and assert non-empty `video_signals` + hook/pacing/segments — i.e. Decode-grade structure, not metadata.
4. **Transcript necessity.** Decide whether Omni's structured output already names the hook line / spoken beats. If yes, add nothing. If no, wire a Qwen ASR model (stays Qwen-only).
5. **Latency + cost delta** of the Apify resolve hop (single-video runs commonly take 30–120s) added in front of the existing ~90–312s pipeline against `route.ts` `maxDuration=300` (`route.ts:149`). May force re-host + async or a `maxDuration` bump.

---

## Concept-generation stack (Adapt frame — req #3)

**Add a prompt module, not a provider.** All infra exists:

- The Qwen text/reasoning model (`QWEN_REASONING_MODEL`, `qwen/client.ts`) — Qwen-only, no Gemini/DeepSeek; same model the text branch already uses (`pipeline.ts:572`).
- DashScope-compatible `openai` client + auth already initialized (`qwen/client.ts`).
- `zod` for output-shape validation of the 3-concept array.
- Niche source: `creator_profiles` is already queried in the route (`route.ts:278-283`); read niche there with inline fallback (req #7).

Integration: a new `src/lib/engine/remix/` module (decode prompt + adapt prompt + zod parse), invoked **outside** the scoring pipeline. Decode + Adapt are two cheap Qwen text calls over the Omni structural output. Do **not** call `runPredictionPipeline` for decode/adapt — that's the ~90–312s scorer; Predict reuses `/api/analyze` only on per-concept Develop (req #4, bulk scoring out of scope).

---

## Lineage / storage (req #5)

- **One migration:** add `parent_id text references analysis_results(id)` + index to `analysis_results`. No `parent_id` exists today (grep clean across `database.types.ts`).
- **Decode/Adapt payload:** persist into the route's existing derived-JSON bag pattern (`route.ts:88-145`, `persistCraftToVariants`) — e.g. `variants.remix = { decode, concepts }`. No new columns for the payload, and it honors "structural analysis only, never store the source video" — you persist derived JSON, not media.
- **"Remixed from" chip + Recent:** the sidebar already lists analyses by `user_id`; add `parent_id` to the select and render the chip. No new table.

---

## What to add (complete list — minimal by design)

| # | Add | Where | Why |
|---|-----|-------|-----|
| 1 | A single-URL video resolver (Clockworks `tiktok-scraper` with `shouldDownloadVideos: true`, read `mediaUrls[0]`) | new method on `ApifyScrapingProvider` (`src/lib/scraping/apify-provider.ts`) + add to `ScrapingProvider` interface (`scraping/types.ts:27-33`) | No single-video resolver exists today; both current methods take a handle. |
| 2 | A `tiktok_url` ingestion branch that sets a video URL for Omni | `src/lib/engine/pipeline.ts:494-525` (mirror the `video_upload` signed-URL → `analyzeVideoWithOmni` path) | This is the gap: `signedVideoUrl` is `video_upload`-only, so `tiktok_url` never reaches Omni. |
| 3 | Extend `apifyVideoSchema` to capture the mp4 field | `src/lib/schemas/competitor.ts:52-69` (currently keeps only `webVideoUrl` + duration) | So the resolver can read the downloadable mp4 URL. |
| 4 | mp4 re-host fallback (download → Supabase `videos` bucket → signed URL) | reuse `filmstrip/storage.ts` upload+sign pattern | Conditional on spike step 2 (short-TTL URLs). |
| 5 | `src/lib/engine/remix/` — decode + adapt prompts + zod parse | new dir | Decode/Adapt generation via the Qwen text model. |
| 6 | Migration: `analysis_results.parent_id` + index | `supabase/migrations/` | Lineage (req #5). |
| 7 | (Conditional) Qwen ASR transcript | new helper in `src/lib/engine/qwen/` | Only if spike step 4 says Omni output lacks hook-line fidelity. |

**No new npm packages** unless the spike's step-1/step-2 prove Clockworks cannot reliably return a fetchable mp4 — see "What NOT to use" before reaching for `yt-dlp`.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `yt-dlp` / `@distube/ytdl` / standalone tiktok-downloader npm packages | New runtime dependency + binary; TikTok actively breaks scrapers; duplicates capability the **already-installed** Apify Clockworks actor provides. Violates the SPEC "reuse, don't rebuild" constraint. | Add a single-URL resolver on top of the existing `apify-client` (item #1). Only revisit if the spike proves Clockworks is unreliable AND re-host fails. |
| A separate transcription/ASR SaaS (Whisper API, Deepgram, AssemblyAI) | Breaks the Qwen-only constraint; new vendor + key + cost. Omni ingests the audio track when given a video URL. | A Qwen ASR model — and only if the spike proves it necessary. |
| A new table for remix lineage / decode payload | A `parent_id` column + the existing derived-JSON `variants` bag cover both. New table = new RLS, new joins, more surface. | `variants.remix` JSON + `parent_id` column (items #5/#6). |
| Calling `runPredictionPipeline` to generate decode/adapt | That's the ~90–312s scorer; decode/adapt are cheap Qwen text calls. Bulk-scoring is explicitly out of scope (req #4). | A dedicated `engine/remix/` prompt module; Predict reuses `/api/analyze` only on per-concept Develop. |
| Upgrading `apify-client` past 2.22.x | No feature need; risk for zero benefit. Latest is 2.23.3 (same major). | Stay on the pinned `^2.22.1`. |
| Persisting the source mp4 long-term | Boundary: "do not store/redistribute third-party media." | Resolve URL transiently for analysis; persist only derived JSON. |
| Trusting the caption-only `tiktok_url` path for Decode | VERIFIED: it produces `video_signals: null` and all-false signal availability (`pipeline.ts:594-597`) — no structural signal. | Build the Omni ingestion branch (item #2). |

---

## Integration Points (exact file paths for the spike + roadmap)

| Concern | File:line | Action |
|---------|-----------|--------|
| Remix request entry | `src/components/board/Board.tsx:302-305` | Add remix mode + decode/adapt branch (req #1) |
| Route validation (URL) | `src/app/api/analyze/route.ts:238-246` | Already validates format; add remix-mode routing |
| The ingestion gap | `src/lib/engine/pipeline.ts:494-525` | `signedVideoUrl` is `video_upload`-only; add a `tiktok_url` branch that resolves a video URL and feeds `analyzeVideoWithOmni` |
| Single-URL resolver | `src/lib/scraping/apify-provider.ts` + interface `src/lib/scraping/types.ts:27-33` | New method (item #1) |
| Capture the mp4 field | `src/lib/schemas/competitor.ts:52-69` | Add `mediaUrls` (currently dropped) |
| Frame extraction (reuse) | `src/lib/engine/filmstrip/extract.ts:33-40` | Works on the resolved remote mp4 as-is |
| Re-host (reuse) | `src/lib/engine/filmstrip/storage.ts:16-43` | Upload+sign pattern for the mp4 re-host fallback |
| Omni multimodal call (reuse) | `src/lib/engine/qwen/omni-analysis.ts` (`analyzeVideoWithOmni`), called at `pipeline.ts:522` | Feed it the resolved/re-hosted URL |
| Concept-generation model | `src/lib/engine/qwen/client.ts` (`QWEN_REASONING_MODEL`) | New `engine/remix/` calls this |
| Niche source | `src/app/api/analyze/route.ts:278-283` (`creator_profiles`) | Read niche; inline fallback (req #7) |
| Decode/Adapt payload persistence | `src/app/api/analyze/route.ts:88-145` (`persistCraftToVariants` pattern) | Mirror for `variants.remix` |
| Lineage column | `supabase/migrations/` + `analysis_results` (`database.types.ts:180`; no `parent_id` today) | New migration (req #5) |
| Child analysis id | `src/app/api/analyze/route.ts:578` (`nanoid`) | Reuse; set `parent_id` on insert |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Extend Apify Clockworks (single-URL resolver) | `yt-dlp` server binary | Only if the spike proves Clockworks `mediaUrls` is too unreliable AND a re-host strategy also fails. High maintenance. |
| Pass resolved/re-hosted mp4 URL to Omni | Download bytes → inline `data:`/base64 to Omni | If the URL is fetchable by our server but not by DashScope's fetcher. Base64-heavy; prefer URL or Supabase re-host. |
| Omni structural output as Decode signal | Wire a Qwen ASR transcript | If Decode needs the exact spoken hook line and Omni's JSON doesn't surface it (spike step 4). |
| Supabase re-host fallback for the mp4 | Trust the Apify/TikTok CDN URL for the full pipeline duration | If spike step 2 shows the URL outlives the ~90–312s run. |

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `apify-client` | ^2.22.1 (latest 2.23.3) | Same major; single-URL resolver needs no upgrade. |
| `ffmpeg-static` | ^5.3.0 | Already proven against remote URLs (`filmstrip/extract.ts`). |
| `openai` | ^6.22.0 | DashScope OpenAI-compat; Omni multimodal already used for owned uploads. |
| `next` | 16.1.5 | Route is `runtime="nodejs"` + `maxDuration=300` (`route.ts:147-149`) — the added Apify hop may push past 300s; watch the budget / consider async resolve. |
| `zod` | ^4.3.6 | v4 — confirm decode/adapt schemas use v4 API (the repo is already on v4). |

---

## Open Questions for the Spike

1. **(blocking)** Does `clockworks/tiktok-scraper` with `shouldDownloadVideos: true` reliably return a fetchable mp4 (`mediaUrls[0]`) for a single arbitrary non-owned URL, and what is the empty/dead-URL rate? — MEDIUM evidence it works ~90% of the time; must be confirmed live.
2. **(blocking)** Do the returned URLs stay fetchable long enough (server-side) for Omni + ffmpeg across a ~90–312s pipeline, or is a Supabase re-host mandatory?
3. Does Qwen-Omni's structured output already name the hook line / spoken beats well enough for Decode, or is a Qwen ASR transcript required?
4. What latency/cost does the Apify resolve hop add, and does it breach `route.ts` `maxDuration=300`? Does resolution need to move async (resolve → store → then run pipeline)?
5. Should the remix path resolve/re-host the mp4 once and reuse the single URL for both Omni and filmstrip extraction (avoid double-fetch of a short-TTL URL)?

---

## Sources

- In-repo code (HIGH — file+line cited above, from direct reads): `app/api/analyze/route.ts`, `lib/engine/pipeline.ts` (esp. 494-525, 564-606, 871), `lib/engine/normalize.ts:55`, `lib/engine/types.ts:135-178`, `lib/scraping/apify-provider.ts`, `lib/scraping/types.ts`, `lib/schemas/competitor.ts:52-69`, `lib/engine/filmstrip/extract.ts:33-40`, `lib/engine/filmstrip/storage.ts:16-43`, `components/board/Board.tsx:284-306`, `types/database.types.ts:180`, `package.json`.
- npm registry (HIGH): `apify-client` latest = 2.23.3 (2026-05-30); repo pins `^2.22.1`.
- Apify Clockworks `shouldDownloadVideos` / `mediaUrls` behavior (MEDIUM — Apify store pages + actor issue threads via WebSearch; the actor input/output schema page returned 403 from the sandbox). Confirmed: `shouldDownloadVideos: true` populates `mediaUrls` with an Apify CDN link; reported caveat: `mediaUrls` empty/dead for a non-trivial fraction of URLs. Must be confirmed by a live run before Decode is planned.
  - https://apify.com/clockworks/tiktok-scraper
  - https://apify.com/clockworks/free-tiktok-scraper/issues/mediaurls-is-empty-yUio0G3mpxOfrObyL
  - https://apify.com/clockworks/tiktok-scraper/issues/some-tiktok-videos-h-PhthzZcKdeDdnJnPR

---
*Stack research for: Viral Remix non-owned ingestion + Qwen concept generation + lineage*
*Researched: 2026-05-31*
