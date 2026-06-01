# Phase 1: Ingestion BUILD (HARD GATE) - Research

**Researched:** 2026-06-01
**Domain:** Non-owned TikTok structural ingestion — resolve a third-party URL to a fetchable mp4, feed `analyzeVideoWithOmni`, derive-and-drop the media
**Confidence:** HIGH on codebase findings (every claim re-verified file+line in the `milestone/viral-remix` worktree, 2026-06-01). MEDIUM on Apify Clockworks reliability + URL TTL (live actor test NOT run — no `.env*` present; deferred to a spike task with an exact procedure below).

## Summary

For `input_mode: "tiktok_url"`, the engine today analyzes **caption text only** — RE-VERIFIED in this worktree. `signedVideoUrl` is set only when `input_mode === "video_upload" && video_storage_path` (`pipeline.ts:496`), the multimodal Omni call is gated on `if (signedVideoUrl)` (`pipeline.ts:520`), and `tiktok_url` falls into the text branch (`pipeline.ts:568–599`) which sends `validated.content_text` to a Qwen text model and returns `video_signals: null`, `signalAvailability` all-false. A structural Decode is impossible on this path. INGEST-01 is a BUILD, and it is the hard gate.

The build is small and uses only installed deps. `analyzeVideoWithOmni(videoUrl, opts)` accepts any URL string (`pipeline.ts:522`, `omni-analysis.ts:54+`) — it does not require a Supabase path, only a fetchable URL. The capability to feed it a non-owned video already exists; what is missing is the wire that turns a pasted URL into a fetchable mp4 URL. That wire is: (a) a single-URL Clockworks resolver (`shouldDownloadVideos:true` → read `mediaUrls[0]`) added to `ApifyScrapingProvider` (today both methods take a **handle**, neither resolves one URL — `apify-provider.ts:20,51`), (b) a `tiktok_url` branch in `pipeline.ts:494–520` that sets `signedVideoUrl` (rename the var or add a parallel `omniVideoUrl`) from the resolved/re-hosted URL, (c) extend `apifyVideoSchema` to capture the mp4 field (currently dropped — `competitor.ts:52–69`), (d) a conditional Supabase re-host fallback if the Apify CDN URL TTL is shorter than the pipeline.

**Primary recommendation:** Build the resolver + the `tiktok_url` Omni branch, run the live ≥5-URL Clockworks spike FIRST (procedure in §Live Actor Test), and feed the resolved mp4 URL into the existing `analyzeVideoWithOmni`. Download-to-temp + delete-in-`finally` ONLY if Omni/ffmpeg can't fetch the resolved URL directly; never write a remix mp4 to the `videos` bucket and never set `video_storage_path` on a remix/decode row.

## User Constraints (from upstream research — no CONTEXT.md yet)

> No `*-CONTEXT.md` exists for this phase (discuss-phase not yet run). These constraints are sourced verbatim from SPEC `## Constraints` / `## Boundaries` and REQUIREMENTS.md, and carry the same authority as locked decisions for the planner.

### Locked Decisions (from SPEC + REQUIREMENTS + CLAUDE.md)
- **Qwen-only** for any model calls — no Gemini/DeepSeek/Whisper/Deepgram. Omni (`QWEN_OMNI_MODEL`) for ingestion; `QWEN_REASONING_MODEL` for any text. A Qwen ASR model is the only permitted ASR, and only if the spike proves Omni lacks hook-line fidelity.
- **No new npm dependencies** — all capabilities exist in installed deps (`apify-client`, `ffmpeg-static`, `openai`, `nanoid`, `zod`, `@supabase/supabase-js`). Verified present below.
- **TikTok-only** — canonical + `vm.`/`www.` links; no Reels/Shorts.
- **Derive-and-drop / IP boundary** — structural analysis only; never persist or rebroadcast source media. No `video_storage_path` on a remix/decode row. Delete any temp download in a `finally`.
- **Reuse, don't rebuild** — extend `ApifyScrapingProvider` and the existing `pipeline.ts` Omni path; do not add `yt-dlp` or a standalone downloader.

### Claude's Discretion
- Whether to pass the resolved Apify CDN URL directly to Omni vs. re-host to Supabase first (gated on the spike's TTL result).
- Whether to resolve/re-host the mp4 once and reuse the single URL for both Omni and filmstrip extraction.
- The exact failure-mode taxonomy typing and error-class shape on the resolver.
- Whether the resolve hop runs inline within `maxDuration=300` or is moved async (gated on the spike's latency measurement).

### Deferred Ideas (OUT OF SCOPE for Phase 1)
- Decode prompt schema, Adapt concepts, mode toggle UI, board frame swap, `parent_id` lineage — all later phases. Phase 1 produces real Omni signal + a spike artifact, nothing downstream.
- Sourcing the source-creator follower count for the repeatable-vs-luck 5× Rule (Phase 3 concern; note the handle is extractable via `normalizeHandle` in `competitor.ts:9`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INGEST-01 | For a non-owned TikTok URL submitted in Remix mode, the pipeline obtains real frame/segment/transcript signal (not preview metadata) through `analyzeVideoWithOmni` — sufficient for a structural Decode; source media derived-and-dropped, never persisted. | Gating mechanism verified (`pipeline.ts:494–520`); resolver pattern grounded in `apify-provider.ts` + live `corpus/apify-jobs.ts`; Omni accepts any URL (`omni-analysis.ts:54`); derive-and-drop pattern mirrors `cleanupRawUpload`/`cleanupUploadedStorage` (`route.ts:40–85`); re-host pattern in `filmstrip/storage.ts:16–43`; ffmpeg-on-remote-URL in `filmstrip/extract.ts:21–40`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve TikTok URL → mp4 URL | API / Backend (Apify actor call) | — | External scrape; runs server-side in the engine, never client. Apify token is a server secret. |
| Download/re-host mp4 (conditional) | API / Backend | Database / Storage (Supabase `videos` bucket, transient) | Only if Apify CDN TTL < pipeline duration; re-host is server-side, temp-only. |
| Frame/segment/transcript extraction (Omni) | API / Backend (DashScope Qwen-Omni) | — | `analyzeVideoWithOmni` fetches the URL server-side; no client involvement. |
| Derive-and-drop / temp cleanup | API / Backend | — | `finally`-block deletion in the route/pipeline; IP boundary enforced server-side. |
| URL validation (format) | API / Backend | — | Already at `route.ts:238–246`; remix path reuses the same regex. |

No client/browser tier work in Phase 1. This is a pure backend ingestion build.

## Standard Stack

### Core (all ALREADY installed — verified in package.json; no additions)
| Library | Version (pinned) | Purpose for Phase 1 | Why standard / verified seam |
|---------|------------------|---------------------|------------------------------|
| `apify-client` | ^2.22.1 | Single-URL Clockworks resolver | `ApifyScrapingProvider` already wraps `clockworks/tiktok-scraper` as `VIDEO_ACTOR` (`apify-provider.ts:9`); cron + corpus also call it live. [VERIFIED: apify-provider.ts:1,9] |
| `ffmpeg-static` | ^5.3.0 | Frame extraction from a remote mp4 (filmstrip + any frame-level need) | `extractFrameAtTimestamp(videoUrl, t)` spawns ffmpeg against ANY remote URL (`-i <url>`), returns null on failure. [VERIFIED: filmstrip/extract.ts:21–40] |
| `openai` (DashScope Qwen-compat) | ^6.22.0 | Qwen-Omni multimodal ingestion | `analyzeVideoWithOmni(videoUrl, {niche,onEvent})` — URL string in, structured segments + hook_decomposition out. [VERIFIED: omni-analysis.ts:54, pipeline.ts:522] |
| `@supabase/supabase-js` | ^2.93.1 | Conditional mp4 re-host (transient) + service client | `uploadFrameAndGetSignedUrl` shows the upload+sign pattern (filmstrips bucket). For a video re-host use the `videos` bucket signed-URL pattern at `pipeline.ts:497–507`. [VERIFIED: filmstrip/storage.ts:16–43, pipeline.ts:497] |
| `nanoid` | ^5.1.6 | (later phases) child analysis ids | `nanoid(12)` at `route.ts:171,523,578`. [VERIFIED] |
| `zod` | ^4.3.6 | Extend `apifyVideoSchema`; validate resolver output | `apifyVideoSchema` already a zod object. [VERIFIED: competitor.ts:52–69] |

**Installation:** none — `npm install` not run; all deps present.

**Version verification:** Not re-queried against the registry this session (no network actor test possible without `.env`). Versions copied from STACK.md's prior verification (apify-client latest 2.23.3, same major as the ^2.22.1 pin — no upgrade). `[CITED: .planning/research/STACK.md:209]` — re-confirm `npm view apify-client version` during planning if currency matters.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Qwen ASR model (model, not package) | n/a | Verbatim transcript of the spoken hook line | ONLY if the spike proves Omni's `hook_decomposition` lacks first-words/hook-line fidelity. Default: do NOT add — Omni ingests the audio track from a video URL. [CITED: STACK.md:38] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Clockworks single-URL resolver | `yt-dlp` / standalone tiktok-downloader | New runtime binary; TikTok actively breaks scrapers; violates "reuse, don't rebuild". Last resort only if Clockworks proves unreliable AND re-host fails. [CITED: STACK.md:143] |
| Pass resolved mp4 URL to Omni | Download bytes → base64 `data:` inline to Omni | Use only if our server can fetch the URL but DashScope's fetcher cannot. Base64-heavy; prefer URL or Supabase re-host. |
| Trust Apify/TikTok CDN URL for the full run | Supabase re-host fallback | If spike step 2 shows the URL outlives the ~90–332s pipeline, skip re-host. Otherwise re-host is mandatory. |

## Architecture Patterns

### System Architecture Diagram (the path to BUILD)

```
[Remix submit: input_mode="tiktok_url", tiktok_url, mode="remix"]   (mode arrives Phase 2)
        │
        ▼
/api/analyze route.ts:238–246  ── URL FORMAT regex only (www.|vm.)  ── [reused as-is]
        │  validated = AnalysisInputSchema.parse  (route.ts:333)
        ▼
runPredictionPipeline(validated)  ── pipeline.ts
        │
        ▼  ┌──────────────────────────────────────────────────────────────┐
        │  │ pipeline.ts:494–520  signedVideoUrl resolution               │
        │  │   EXISTING: video_upload → createSignedUrl(videos bucket)    │
        │  │   ★ NEW BRANCH: tiktok_url → resolveTikTokVideoUrl(url)      │
        │  │        ├─ ApifyScrapingProvider.resolveVideoUrl(url)  [NEW]  │
        │  │        │     clockworks/tiktok-scraper                       │
        │  │        │     { postURLs:[url], shouldDownloadVideos:true }   │
        │  │        │     → dataset item → mediaUrls[0]  (fetchable mp4)  │
        │  │        ├─ (cond) re-host → Supabase videos bucket → signed   │
        │  │        │     (only if Apify CDN TTL < pipeline duration)     │
        │  │        └─ set signedVideoUrl/omniVideoUrl                    │
        │  └──────────────────────────────────────────────────────────────┘
        │
        ▼
pipeline.ts:520  if (signedVideoUrl) analyzeVideoWithOmni(url, …)  [reused — now reached for tiktok_url]
        │   → segments[], hook_decomposition, video_signals, signalAvailability
        ▼
[real structural signal]  +  finally { delete temp / drop re-host if used }  ★ derive-and-drop
        │
        ▼
SPIKE ARTIFACT: documents exact signal + failure-mode taxonomy + TTL/latency
```

File-to-responsibility:
- `src/lib/scraping/apify-provider.ts` — add `resolveVideoUrl(url): Promise<ResolvedVideo>` (new method); register on `ScrapingProvider` interface (`types.ts:27–33`).
- `src/lib/schemas/competitor.ts:52–69` — extend `apifyVideoSchema` with `mediaUrls: z.array(z.string().url()).optional()` (and optionally `videoMeta.coverUrl`); currently the mp4 field is dropped.
- `src/lib/engine/pipeline.ts:494–520` — add the `tiktok_url` branch that sets the Omni input URL.
- `src/app/api/analyze/route.ts` — derive-and-drop cleanup wiring for any temp/re-host artifact (mirror `cleanupRawUpload`/`cleanupUploadedStorage`, lines 40–85).

### Recommended Project Structure
```
src/lib/scraping/
├── apify-provider.ts      # + resolveVideoUrl(url) single-URL resolver
├── types.ts               # + resolveVideoUrl on ScrapingProvider; ResolvedVideo type
src/lib/schemas/
└── competitor.ts          # apifyVideoSchema += mediaUrls
src/lib/engine/
└── pipeline.ts            # tiktok_url Omni branch (494–520)
.planning/phases/01-.../
└── 01-INGESTION-SPIKE.md  # the spike artifact (criterion 1 + 4 deliverable)
```

### Pattern 1: Apify actor single-URL run (grounded in this repo's live calls)
**What:** Call `clockworks/tiktok-scraper` with `postURLs` for one URL and `shouldDownloadVideos:true`, then read `mediaUrls[0]` from the dataset item.
**When to use:** The resolver method; the spike test.
**Example:**
```ts
// Pattern mirrors apify-provider.ts:21–35 (.actor().call() + dataset().listItems())
// and cron/scrape-trending/route.ts:62 (.actor().start() with input).
// Clockworks input shape confirmed via corpus/apify-jobs.ts:104 (buildClockworksInput).
const run = await this.client
  .actor("clockworks/tiktok-scraper")
  .call(
    { postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: true },
    { waitSecs: 120 },                       // existing scrapeVideos uses 120 (apify-provider.ts:56)
  );
const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
if (!items.length) throw new IngestError("empty_dataset", url);
const parsed = apifyVideoSchema.parse(items[0]);   // mediaUrls now captured
const mp4 = parsed.mediaUrls?.[0];
if (!mp4) throw new IngestError("no_media_url", url);  // private / region-locked / carousel
return { mp4Url: mp4, durationSeconds: parsed.videoMeta?.duration ?? 0 };
```
> NOTE: `postURLs` is the documented Clockworks single-URL input key per Apify store pages `[CITED: apify.com/clockworks/tiktok-scraper]`. The repo's live calls use the `hashtags`/`profiles` keys, so `postURLs` + `shouldDownloadVideos` + the `mediaUrls` output field are **`[ASSUMED]` until the live spike confirms them** (see Assumptions A1–A3).

### Pattern 2: Derive-and-drop (mirror existing cleanup)
**What:** If the resolver downloads bytes or re-hosts to Supabase, delete in a `finally`. Never persist beyond the request.
**When to use:** Only the re-host/temp path; preferred path passes the Apify URL straight to Omni and persists nothing.
**Example:**
```ts
// Mirrors cleanupRawUpload / cleanupUploadedStorage (route.ts:40–85), which
// service.storage.from("videos").remove([path]).catch(...) — fire-and-forget delete.
let rehostPath: string | null = null;
try {
  // ... resolve, (optional) re-host to videos bucket, run Omni ...
} finally {
  if (rehostPath) {
    service.storage.from("videos").remove([rehostPath]).catch(/* log only */);
  }
}
```

### Anti-Patterns to Avoid
- **Reusing `storage_retention_opted_in` for non-owned media** — that flag governs the user's OWN uploads (`route.ts:278–283`). A remix mp4 must be deleted unconditionally; never consult retention. [VERIFIED: route.ts:278–283]
- **Writing `video_storage_path` on a remix/decode row** — `buildInsertRow` only sets it for `video_upload && retentionOptedIn` (`route.ts:450–455`). A remix row must keep it `null`. A test must assert this.
- **Calling `runPredictionPipeline` for "decode"** — that's the ~332s scorer (Phase 3 concern, but stated here so the ingestion build doesn't accidentally bolt onto the scoring tail).
- **Trusting the caption-only path** — `tiktok_url` text branch returns `video_signals: null` (`pipeline.ts:594`); never source Decode from it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Download a TikTok mp4 from a URL | A custom TikTok downloader / `yt-dlp` wrapper | `apify-client` + Clockworks `shouldDownloadVideos` | TikTok breaks scrapers constantly; Apify maintains the actor. Already installed + wired for handle scraping. |
| Extract frames from the mp4 | A raw `child_process` ffmpeg invocation | `extractFrameAtTimestamp` (`filmstrip/extract.ts`) | Already spawns `ffmpeg-static` against remote URLs, graceful-degrades to null. |
| Multimodal video understanding | A bespoke vision call | `analyzeVideoWithOmni` (`qwen/omni-analysis.ts`) | Qwen-only, returns segments + hook_decomposition; the `video_upload` path already proves it. |
| Re-host + sign a video | A custom upload+sign | `createSignedUrl` (`pipeline.ts:497`) / `uploadFrameAndGetSignedUrl` pattern | Proven Supabase storage pattern; transient signed URLs. |
| Temp-file cleanup | An ad-hoc unlink | The `cleanupRawUpload`/`finally` pattern (`route.ts:40–85`) | The IP boundary depends on guaranteed deletion; reuse the proven shape. |

**Key insight:** Phase 1 is wiring, not new infrastructure. Every primitive (scrape, download, frame-extract, Omni, re-host, cleanup) already exists and is verified present. The single missing primitive is a single-URL resolver method; everything else is reuse.

## Runtime State Inventory

> This is a code-and-config BUILD (new ingestion path), not a rename/refactor/migration. No existing runtime state is renamed or migrated. The relevant "state" risk is the *opposite*: ensuring the new path persists NOTHING durable for non-owned media.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None created by Phase 1. Decode/adapt payloads + `parent_id` are later phases. | None — verified: Phase 1 writes no new durable rows/columns. |
| Live service config | Apify account (Clockworks actor) — billed per run; no config stored in git. Spike runs consume Apify credits. | Confirm `APIFY_TOKEN` present in the target runtime before the spike; set an aggressive `waitSecs` cap + per-user rate limit (reuse `route.ts:296–310` 429 pattern) to bound cost. |
| OS-registered state | None. | None. |
| Secrets/env vars | `APIFY_TOKEN` (read at `apify-provider.ts:16`, cron `route.ts:38`, corpus `orchestrator.ts:431`). `process.env.DASHSCOPE`/Qwen key (existing). **No `.env*` file exists in this worktree** — secrets injected at runtime/Vercel. | None to rename. The resolver reuses `APIFY_TOKEN`; no new secret. Spike requires the token to be present at run time. |
| Build artifacts | None. No package changes (no new deps). | None. |

**Derive-and-drop guard (the load-bearing inverse of "persisted state"):** After a remix ingestion completes, the system must hold ZERO non-owned media — no object in the `videos` bucket whose provenance is a pasted URL, no `video_storage_path` on the row, no client-renderable media URL in the response. Acceptance test: storage audit + grep for `storage.from("videos")` writes on the remix path.

## Common Pitfalls

### Pitfall C1: Caption-only hallucination (spec-killer)
**What goes wrong:** Decode (later) gets pointed at the existing `tiktok_url` path, which feeds the model a caption string. The LLM invents a plausible structural teardown from a sentence.
**Why it happens:** `signedVideoUrl` is null for `tiktok_url` → Omni skipped → text branch → `video_signals: null`. [VERIFIED: pipeline.ts:494–520, 568–599]
**How to avoid:** Phase 1 must make a non-owned URL reach `analyzeVideoWithOmni` and produce non-empty segments. Hard gate: no Decode prompt until this is demonstrated.
**Warning signs / detection:** Same ingestion on two structurally-different viral videos yields near-identical structural fields ⇒ no real signal reached the model. This is success criterion 2 — encode it as the C1 guard test.

### Pitfall C4: Source media persisted → IP violation (newly introduced by this build)
**What goes wrong:** The download step writes the mp4 to the `videos` bucket, returns a playable URL, or sets `video_storage_path` — collapsing the transformative-use defense.
**Why it happens:** Omni's existing path expects a Supabase signed URL (`pipeline.ts:496–507`), tempting a "just upload the scraped video to our bucket" shortcut that then forgets to delete.
**How to avoid:** Prefer feeding the Apify URL directly to Omni (no persistence). If re-host is required, delete in `finally`. Never set `video_storage_path` on a remix row; never consult `storage_retention_opted_in`.
**Detection:** Storage audit (zero non-owned objects); schema/lint test asserting no remix write touches `video_storage_path`.

### Pitfall M1: Non-owned URL failure modes treated as one error
**What goes wrong:** Private, region-locked, age-gated, deleted/404, photo-carousel (no video track), `vm.` short link, watermark-only, Apify rate-limit/timeout all surface for the first time. Today `apify-provider.ts` throws a bare `Error` (`:33`) and `console.warn`s on per-item zod failure (`:67`) — no taxonomy.
**Why it happens:** The "my own content" flow never sees these at volume.
**How to avoid:** Phase 1 classifies each failure into typed error classes; Phase 2 maps them to honest copy. Resolve `vm.` short links before/within scraping; reject carousels with a clear "video only" message; cap `waitSecs`; per-user rate limit (reuse `route.ts:296–310`).
**Detection:** Spike artifact ships a failure-mode table tested across ≥5 varied URLs (success criterion 4).

### Pitfall: Latency vs `maxDuration=300`
**What goes wrong:** Apify resolve (commonly 30–120s for single-video runs) + optional re-host + Omni (~30–60s) on top of the existing pipeline can breach the Vercel `maxDuration=300` ceiling and get the stream killed mid-run.
**Why it happens:** `maxDuration = 300` at `route.ts:149`. [VERIFIED] The full scoring pipeline alone is ~332s per the AUDIT — but note a **decode path does NOT run the full scorer** (Phase 3), so the relevant budget for Phase 1 is resolve + re-host + Omni, not 332s. Still must be measured.
**How to avoid:** Measure the resolve-hop latency in the spike. If resolve+Omni breaches 300s, move the resolve step async (resolve → store the resolved URL → then run Omni) or bump `maxDuration` (comment at `route.ts:23` notes 800 is available on Pro).
**Detection:** Spike step 5 records measured wall-clock per stage against 300s.

## Code Examples

### Existing Omni call signature (the reuse target)
```ts
// Source: src/lib/engine/pipeline.ts:520–525 (VERIFIED)
if (signedVideoUrl) {
  const omniOut = await analyzeVideoWithOmni(signedVideoUrl, {
    niche: validated.niche ?? creatorContext.niche ?? undefined,
    onEvent: onStageEvent,
  });
  // omniOut.segments, omniOut.geminiResult.analysis, omniOut.signalAvailability
}
```

### Existing signed-URL mint (the re-host target shape)
```ts
// Source: src/lib/engine/pipeline.ts:497–507 (VERIFIED)
const { data: signedData } = await supabase.storage
  .from("videos")
  .createSignedUrl(validated.video_storage_path, 3600); // 1-hour TTL
signedVideoUrl = signedData.signedUrl;
```

### Existing actor call + dataset read (the resolver template)
```ts
// Source: src/lib/scraping/apify-provider.ts:51–61 (VERIFIED — scrapeVideos)
const run = await this.client.actor(VIDEO_ACTOR)   // "clockworks/tiktok-scraper"
  .call({ profiles: [handle], resultsPerPage: limit }, { waitSecs: 120 });
const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tiktok_url` = caption text analysis | (Phase 1) `tiktok_url` = real Omni multimodal via resolved mp4 | This phase | Unlocks all Decode/Adapt/Develop work |
| Gemini segmented (3 Files-API calls) | Single `qwen3.5-omni-plus` call | Pre-milestone (already shipped) | Omni is the one multimodal entry point; reuse it, don't add a vision vendor |

**Deprecated/outdated:**
- The `normalize.ts:55` `video_url = tiktok_url` assignment with comment "used by Apify scrape, etc." is an **unwired intent**, not a working path. `[CITED: STACK.md:60, PITFALLS.md:24]` — do not assume it does anything.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Clockworks `tiktok-scraper` accepts `postURLs: [url]` for a single arbitrary non-owned URL (vs only `profiles`/`hashtags`). | Pattern 1 | If the input key differs (e.g. `startUrls`), the resolver call shape changes. Low risk — store docs document `postURLs`; confirm in spike. |
| A2 | `shouldDownloadVideos: true` populates `mediaUrls` with a fetchable mp4 link, and `mediaUrls[0]` is the video. | Pattern 1, Stack | If the field is named differently (`downloadAddr`, `videoUrl`) or empty, the schema extension + read index change. Confirm in spike; ~10%+ empty rate reported in actor issues. |
| A3 | The returned mp4 URL is fetchable server-side by DashScope's Omni fetcher AND by ffmpeg-static for the pipeline window. | Architecture, Latency pitfall | If TTL is short or DashScope can't fetch it, re-host to Supabase becomes mandatory (criterion-4 fallback). Confirm in spike step 2. |
| A4 | Omni's `hook_decomposition`/segments carry enough spoken-hook fidelity that no separate Qwen ASR transcript is needed. | Supporting stack | If false, add a Qwen ASR helper (stays Qwen-only). Confirm in spike step 3 — gates Phase 3 decode schema. |
| A5 | Resolve-hop + Omni fits under `maxDuration=300` for a decode (which does NOT run the 332s scorer). | Latency pitfall | If it breaches, async-resolve or bump maxDuration. Measure in spike step 5. |

**All five are the spike's blocking unknowns.** They are exactly the items the ROADMAP research flag requires resolved before any Decode code. None can be answered from code alone.

## Open Questions

1. **(BLOCKING) Clockworks reliability for single arbitrary URLs.** What is the empty/dead-`mediaUrls` rate across high-view / region-locked / deleted / carousel / `vm.` links? → Resolve via live spike (≥5 URLs). Recommendation: if failure rate is high, the resolver returns typed failures and Phase 2 surfaces honest copy; escalate to `yt-dlp` only as last resort.
2. **(BLOCKING) URL TTL vs pipeline window.** Does the Apify CDN mp4 URL stay fetchable long enough? → `curl` from a server context across the measured window; if short, re-host is mandatory (criterion 4).
3. **(BLOCKING) Omni fidelity for hook line.** Does Omni name the spoken hook/beats well enough for Decode? → Inspect real `hook_decomposition` + `segments` (gates Phase 3 prompt schema).
4. **Single-fetch reuse.** Resolve/re-host once and reuse the one URL for both Omni and any frame extraction, to avoid double-fetching a short-TTL URL? → Recommended yes; confirm after TTL is known.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `apify-client` | URL resolver | ✓ (installed, wired) | ^2.22.1 | — |
| `ffmpeg-static` | frame extraction | ✓ (installed, wired) | ^5.3.0 | graceful null per-frame |
| `openai`/DashScope Qwen | Omni ingestion | ✓ (installed, wired) | ^6.22.0 | — |
| `@supabase/supabase-js` | re-host (conditional) | ✓ | ^2.93.1 | — |
| `APIFY_TOKEN` (env) | live resolver + spike | ✗ in this worktree (no `.env*` file present) | — | Provide at runtime/Vercel before the spike; cannot run the live actor test from this worktree |
| Live Apify run (network) | spike confirmation | ✗ (not run — no creds, unattended-unsafe to bill) | — | Spike task §Live Actor Test must be executed in an env with the token |

**Missing dependencies with no fallback (block the spike, not the build wiring):**
- `APIFY_TOKEN` + a billable Apify account — required to execute the live ≥5-URL spike. The resolver/branch code can be written and unit-tested with a mocked provider without it, but criteria 1, 2, and 4 (real signal, TTL, failure taxonomy) cannot be satisfied until the live test runs.

## Live Actor Test — NOT RUN (deferred to spike task; exact procedure)

> No `.env*` file exists in `/Users/davideloreti/virtuna-viral-remix/` (verified: `.env`, `.env.local`, `.env.development.local`, `.env.production.local` all absent). `APIFY_TOKEN` is read from the runtime environment in code but is not present in this worktree, and an unattended billable actor run is unsafe to fire blind. **The live test was NOT run. It is the plan's first task.** Procedure:

**Inputs — the ≥5 URL matrix (criterion 4):**
1. High-view canonical: `https://www.tiktok.com/@<creator>/video/<id>` (a known viral, currently-live video)
2. `vm.` short link: `https://vm.tiktok.com/<short>/`
3. Region-locked / age-gated video
4. Deleted / 404 video URL
5. Photo carousel (no video track) post URL
6. (recommended 6th) A private-account video URL

**Command (run in an env with `APIFY_TOKEN` set):**
```bash
# Per URL — single-video Clockworks run, download enabled
node -e '
const { ApifyClient } = require("apify-client");
const c = new ApifyClient({ token: process.env.APIFY_TOKEN });
(async () => {
  const url = process.argv[1];
  const t0 = Date.now();
  const run = await c.actor("clockworks/tiktok-scraper")
    .call({ postURLs:[url], resultsPerPage:1, shouldDownloadVideos:true }, { waitSecs:180 });
  const { items } = await c.dataset(run.defaultDatasetId).listItems();
  console.log(JSON.stringify({
    url, resolveMs: Date.now()-t0, count: items.length,
    mediaUrls: items[0]?.mediaUrls ?? null,
    keys: items[0] ? Object.keys(items[0]) : [],
  }, null, 2));
})();
' "<URL>"
```

**Expected output shape to capture (and record in the spike artifact):**
- `count` (1 on success; 0 on private/deleted/carousel → classify)
- `mediaUrls` (array; `mediaUrls[0]` should be a fetchable mp4 URL) — confirms A2
- full item `keys` — to discover the actual download-field name if not `mediaUrls`
- `resolveMs` — feeds the latency budget (A5)

**Then, per resolved URL:**
```bash
# TTL / fetchability (criterion 4, A3): curl headers immediately and after ~300s
curl -sI "<mediaUrls[0]>" | head -5
sleep 300 && curl -sI "<mediaUrls[0]>" | head -5   # still 200 ⇒ no re-host needed

# Omni fidelity (criterion 1+3, A4): feed the URL through analyzeVideoWithOmni
# (write a throwaway script importing src/lib/engine/qwen/omni-analysis.ts;
#  assert non-empty segments + populated hook_decomposition; eyeball hook-line text)
```

**C1 guard (criterion 2):** run the Omni step on TWO structurally-different viral videos; assert the structural fields differ materially (not near-identical). Identical ⇒ no real signal.

**Deliverable:** `01-INGESTION-SPIKE.md` documenting: per-URL result table, empty-rate, exact mp4 field name, TTL window, resolve+Omni latency vs 300s, sample Omni output (segments + hook_decomposition), and the C1 two-video differential. This artifact IS success criteria 1 and 4.

## Regression Surface (criterion 5 — what must stay untouched)

| Area | File:line | Why it must not change |
|------|-----------|------------------------|
| `video_upload` signed-URL branch | `pipeline.ts:496–508` | The grade path's Omni input. The new `tiktok_url` branch must be ADDITIVE (an `else if`/parallel branch), not a rewrite of this block. |
| Text branch | `pipeline.ts:568–599` | `text` mode (and `tiktok_url` until the branch lands) still flows here. Don't break the text path. |
| `video_upload` validation | `route.ts:249–260` | Unchanged. |
| `cleanupUploadedStorage`/`cleanupRawUpload` | `route.ts:40–85` | Govern OWN uploads via `retentionOptedIn`. New remix cleanup must be a SEPARATE unconditional path; do not entangle with retention logic. |
| `buildInsertRow` `video_storage_path` rule | `route.ts:450–455` | Stays `video_upload && retentionOptedIn`-only. A remix row keeps it null — assert, don't alter the existing rule. |
| `AnalysisInputSchema` | `types.ts:135–165` | `mode`/`parent_id` are Phase 2/5 additions. Phase 1 needs NO schema change (it operates on existing `input_mode: "tiktok_url"`). Adding fields here risks the grade path — defer. |
| `apifyVideoSchema` extension | `competitor.ts:52–69` | Adding `mediaUrls` as `.optional()` is additive and safe; `scrapeVideos` ignores the new field. Verify `scrapeVideos` still parses (it uses `safeParse`, skips on failure — `apify-provider.ts:65`). |

**Regression test:** a `video_upload` analysis and a `text` analysis must produce identical results before/after the Phase 1 change. The `tiktok_url` text-branch behavior changes by design (that's the build); everything else is frozen.

## Validation Architecture

> `workflow.nyquist_validation` not found disabled in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (repo uses `*.test.ts(x)`; existing engine + scraping tests, e.g. `corpus/__tests__/apify-jobs.test.ts`, `learning/__tests__/ingest.test.ts`) |
| Config file | `vitest.config.*` (confirm during planning — present in repo per existing test dirs) |
| Quick run command | `npx vitest run src/lib/scraping src/lib/engine/__tests__ -t <name>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 (crit 1) | Non-owned URL → non-empty Omni segments | integration (mocked Apify + real/mocked Omni) | `npx vitest run src/lib/scraping/__tests__/resolve-video.test.ts` | ❌ Wave 0 |
| INGEST-01 (crit 2) | Two different videos → different structural signal (C1 guard) | spike/eval (live Omni) | manual spike + recorded artifact assertion | ❌ Wave 0 (live, in spike) |
| INGEST-01 (crit 3) | Remix row has null `video_storage_path`; temp deleted in finally (C4) | unit + integration | `npx vitest run src/app/api/analyze/__tests__/derive-and-drop.test.ts` | ❌ Wave 0 |
| INGEST-01 (crit 4) | Failure taxonomy: each class returns a typed error, not a bare throw | unit (mocked dataset shapes) | `npx vitest run src/lib/scraping/__tests__/resolve-video.failures.test.ts` | ❌ Wave 0 |
| INGEST-01 (crit 5) | `video_upload` + `text` paths unchanged | regression (existing) | `npx vitest run src/lib/engine` | partial (existing engine tests) |

### Sampling Rate
- **Per task commit:** the relevant `src/lib/scraping` + `src/lib/engine` vitest subset
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green AND the live spike artifact present with criteria 1/2/4 recorded, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/scraping/__tests__/resolve-video.test.ts` — happy-path resolve (mocked Apify dataset → mediaUrls[0]) — covers crit 1
- [ ] `src/lib/scraping/__tests__/resolve-video.failures.test.ts` — empty dataset, no mediaUrls (private/carousel), 404, vm-link — covers crit 4
- [ ] `src/app/api/analyze/__tests__/derive-and-drop.test.ts` — asserts no `video_storage_path` on remix row + finally-delete invoked — covers crit 3/C4
- [ ] `01-INGESTION-SPIKE.md` artifact — the live ≥5-URL run + Omni fidelity + C1 differential (cannot be automated; live + recorded)

## Security Domain

> `security_enforcement` not disabled in config — section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | TikTok URL regex (`route.ts:239`) + zod parse (`AnalysisInputSchema`); resolver must validate the resolved mp4 URL is a `https` TikTok/Apify CDN host before fetch (SSRF guard). |
| V4 Access Control | yes | Auth already enforced upstream of the route; per-user rate limit (reuse 429 pattern `route.ts:296–310`) bounds Apify-cost abuse from paste-spam. |
| V6 Cryptography | no | No new crypto; signed URLs use existing Supabase signing. |
| V2/V3 Auth/Session | no | Unchanged; no new auth surface in Phase 1. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via attacker-controlled resolved URL fed to ffmpeg/Omni | Tampering / Info Disclosure | Validate resolved URL scheme+host allowlist (TikTok/Apify CDN) before fetch; reject `file://`, internal IPs. |
| Cost-exhaustion via paste-spam (each remix = an Apify run) | Denial of Service | Per-user rate limit + `waitSecs` cap; reuse `DAILY_LIMITS`/429 branch. |
| IP/ToS violation via persisted non-owned media | (Legal, not STRIDE) | Derive-and-drop; no `video_storage_path`; storage audit test. |
| Leaking a re-hosted private video via a public/long-TTL signed URL | Info Disclosure | Short TTL on any re-host (mirror 1-hour at `pipeline.ts:500`); delete in finally; never return a media URL to the client. |

## Sources

### Primary (HIGH confidence — file+line, re-verified in worktree 2026-06-01)
- `src/lib/engine/pipeline.ts:494–520, 568–599` — signedVideoUrl gate (video_upload-only), Omni gated on it, text branch returns video_signals:null
- `src/lib/engine/qwen/omni-analysis.ts:28–47, 54+` — `analyzeVideoWithOmni(videoUrl, opts)` URL-in/segments-out signature
- `src/lib/scraping/apify-provider.ts:8–9, 20–61` — Clockworks actor wiring, handle-only methods, bare error handling
- `src/lib/scraping/types.ts:27–33` — `ScrapingProvider` interface (no single-URL method)
- `src/lib/schemas/competitor.ts:9, 52–69` — `apifyVideoSchema` drops mediaUrls; `normalizeHandle`
- `src/lib/engine/filmstrip/extract.ts:21–40` — ffmpeg-static on any remote URL
- `src/lib/engine/filmstrip/storage.ts:16–43` — Supabase upload+sign pattern
- `src/app/api/analyze/route.ts:40–85 (cleanup), 149 (maxDuration), 238–246 (URL regex), 278–283 (retention), 296–310 (429), 333 (parse), 397–481 (buildInsertRow), 450–455 (video_storage_path rule), 578–597 (placeholder insert)`
- `src/lib/engine/types.ts:135–165` — `AnalysisInputSchema` (input_mode enum, no mode/parent_id)
- `src/lib/engine/corpus/apify-jobs.ts:104–112` — live Clockworks input shape (resultsPerPage etc.)
- `src/app/api/cron/scrape-trending/route.ts:38,62` — live `client.actor().start()` actor invocation pattern
- Env audit: no `.env*` file present in worktree (Bash verification)

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,STACK,ARCHITECTURE,PITFALLS}.md` — converged milestone research (this phase builds on it)
- Apify Clockworks store pages (the `postURLs`/`shouldDownloadVideos`/`mediaUrls` contract) — `[CITED]`, unverified live:
  - https://apify.com/clockworks/tiktok-scraper
  - https://apify.com/clockworks/free-tiktok-scraper/issues/mediaurls-is-empty-yUio0G3mpxOfrObyL

### Tertiary (LOW confidence — must validate)
- Exact single-URL input key (`postURLs`) + output field (`mediaUrls[0]`) + empty-rate — `[ASSUMED]` A1–A2, resolved only by the live spike

## Metadata

**Confidence breakdown:**
- Gating mechanism / what to build: HIGH — every line re-read in this worktree
- Reuse seams (Omni, ffmpeg, storage, cleanup): HIGH — verified present
- Apify single-URL contract + reliability + TTL: LOW until live spike (A1–A3, A5)
- Omni hook-line fidelity: LOW until live spike (A4)

**Research date:** 2026-06-01
**Valid until:** ~2026-06-30 for codebase findings (stable); ~7 days for the Apify external contract (re-verify at spike time — actor inputs/output can change)
