# 01 — Ingestion Spike (HARD GATE artifact)

**Date:** 2026-06-01
**Status:** GATE CLOSED for the critical unknowns (A1, A2, A3, A4, A5, C1, core failure case). Partial on full failure taxonomy — see §3.
**Run:** Live `clockworks/tiktok-scraper` (Apify account `nettled_election`, FREE) + live `analyzeVideoWithOmni` (qwen3.5-omni-plus).
**Derive-and-drop honored:** No mp4 persisted to any bucket; Omni fetched ephemeral URLs only; throwaway runner scripts deleted post-run.

---

## 1. Confirmed Apify contract

- **Actor slug:** `clockworks/tiktok-scraper` (matches `src/lib/scraping/apify-provider.ts:9` `VIDEO_ACTOR`).
- **Input object (CONFIRMED for single pasted URL):**
  ```json
  { "postURLs": ["<url>"], "resultsPerPage": 1, "shouldDownloadVideos": true }
  ```
  with `{ waitSecs: 180 }`. **Resolves A1.** Note: single-URL resolve uses `postURLs` (NOT `profiles`, which `scrapeVideos` uses for handle scraping).
- **Confirmed mp4 download field + index → `mediaUrls[0]`. Resolves A2.**
  - This is the **exact value Plan 02 adds to `apifyVideoSchema`** (`src/lib/schemas/competitor.ts`).
  - `shouldDownloadVideos: true` makes Clockworks re-host the video to the run's Apify key-value store. The `mediaUrls[0]` value is therefore an **Apify KV-store record URL**, NOT a raw TikTok CDN URL:
    ```
    https://api.apify.com/v2/key-value-stores/<storeId>/records/video-<handle>-<yyyymmddhhmmss>-<videoId>.mp4
    ```
  - **SSRF allowlist host (for Plan 02):** `api.apify.com` (HTTPS). The plan's "TikTok/Apify-CDN allowlist" must allowlist `api.apify.com` — the resolved host is Apify, not a `tiktokcdn.com` host.

---

## 2. Per-URL result table

| # | URL class | URL | count | item keys (resolved) | mp4 field | resolveMs | anon GET | `?token=` GET | TTL@window |
|---|-----------|-----|-------|----------------------|-----------|-----------|----------|---------------|------------|
| 1 | canonical (comedy / fast-cut) | `@isi_comedy1/video/7645695501630737697` | 1 | full video item (mediaUrls present) | `mediaUrls[0]` | **25,331 ms** | **403** | **200** `video/mp4` 7,072,079 B | 200 (record persists — days) |
| 2 | canonical (talking-head / tutorial) | `@jera.bean/video/6802316199507053829` | 1 | full video item (mediaUrls present); 1 transient "unable to fetch script" retry, then OK | `mediaUrls[0]` | **38,084 ms** | **403** | **200** `video/mp4` 6,421,384 B | 200 (record persists — days) |
| 3 | deleted / 404 (fabricated dead id) | `@tiktok/video/1111111111111111111` | **1** | `[error, errorCode, url]` — `error="Post not found or private."` | — (none) | ~8 s | — | — | — |
| 4 | `vm.` short link | — | NOT TESTED | — | — | — | — | — | — |
| 5 | region-locked / age-gated | — | NOT TESTED | — | — | — | — | — | — |
| 6 | photo carousel (no video) | — | NOT TESTED | — | — | — | — | — | — |
| 7 | private account | — | NOT TESTED | — | — | — | — | — | — |

**Deviation (honest):** only 2 live canonical URLs + 1 fabricated 404 were available this run (developer supplied 2 URLs). Rows 4–7 were NOT live-tested. The failure taxonomy in §3 marks these as **inferred**, not confirmed. Plan 02 must handle them defensively; a follow-up spike can confirm their exact dataset shapes if needed.

---

## 3. Failure-mode taxonomy → Plan 02 typed errors

| Class | Live dataset shape | Status | Plan 02 typed error (recommended) |
|-------|--------------------|--------|-----------------------------------|
| Deleted / 404 / private post | **count=1**, item keys `[error, errorCode, url]`, `error="Post not found or private."` | **CONFIRMED** | Inspect `item.error` / `item.errorCode` FIRST. Throw `POST_NOT_FOUND` (or `PRIVATE_POST`). **Do NOT rely on `items.length===0`.** |
| Empty dataset | `count=0` (no items) | inferred | `EMPTY_DATASET` |
| Success item w/o media | `count=1`, no `mediaUrls` / empty array | inferred | `NO_MEDIA_URL` |
| `vm.` short link | likely resolves like canonical (Clockworks follows redirects) | NOT TESTED | treat as canonical; fall through to `NO_MEDIA_URL` if no mp4 |
| Region-locked / age-gated | unknown — may return `error` item or empty | NOT TESTED | map to `POST_NOT_FOUND` / new `REGION_LOCKED` if a distinct marker appears |
| Photo carousel (no video track) | unknown — likely success item with images, no `mediaUrls` | NOT TESTED | `NO_MEDIA_URL` (carousels have no mp4) |

**Key correction to assumptions:** the deleted/private case is **NOT an empty dataset** — it is a 1-item dataset carrying an `error`/`errorCode` field. Plan 02's classifier must branch on the presence of `item.error`/`item.errorCode` before attempting `mediaUrls` extraction.

---

## 4. TTL verdict (resolves A3)

- The resolved `mediaUrls[0]` is a **private Apify KV record**: anonymous GET → **403** (`application/json` error body); GET with `?token=<APIFY_TOKEN>` → **200 `video/mp4`**.
- Apify KV-store records from actor runs persist for the account's data-retention window (**days**, FREE default ~7d) — far longer than the 90–332s pipeline window. **No short-TTL expiry risk.**
- **→ Plan 03 does NOT need to re-host for TTL reasons.** The URL stays valid across the pipeline window. (Re-host is still recommended for a *security* reason — see §8.)

---

## 5. Latency verdict (resolves A5)

- Clockworks resolve: **25–38 s** (container cold-start + scrape + media download).
- Omni analysis: **35–37 s** per video.
- **resolve + Omni ≈ 60–75 s wall-clock — comfortably under `maxDuration=300` (`route.ts:149`).**
- **→ Plan 03 can run the resolve INLINE** within the existing request; no async/queue split required for the resolve+Omni hop. (Budget for the remaining downstream pipeline stages, but the ingestion hop itself fits inline with wide margin.)

---

## 6. Omni fidelity sample (resolves A4)

Both videos returned **non-empty `segments`** and **`signalAvailability` all-true** (`gemini_hook`/`gemini_body`/`gemini_cta` = true) via the token-scoped URL. The earlier all-false/empty result was solely the missing token (403), NOT a fidelity problem.

**Comedy** — `content_type=comedy`, 6 segments [0–3, 3–5.5, 5.5–8, 8–11, 11–14, 14–16.8], hook_decomposition:
`visual_stop_power:9, audio_hook_quality:10, text_overlay_score:9, first_words_speech_score:10, weakest_modality:text_overlay_score, visual_audio_coherence:10, cognitive_load:2`.

**Talking-head** — `content_type=tutorial`, 7 segments [0–3, 3–6, 6–19, 19–26, 26–35, 35–47, 47–59], hook_decomposition:
`visual_stop_power:9, audio_hook_quality:9, text_overlay_score:10, first_words_speech_score:10, weakest_modality:visual_stop_power, visual_audio_coherence:10, cognitive_load:2`.

**A4 verdict — ASR NOT required for Phase 3.** Omni's `hook_decomposition.first_words_speech_score` and `audio_hook_quality` are populated and reflect real audio; the `content_summary` accurately transcribes spoken content (the tutorial summary names the exact app "Splice" and the step sequence). Omni's built-in audio/speech fidelity is sufficient for the Decode phase. A separate Qwen ASR transcript is **gated/deferred** — do NOT build ASR in Phase 1. Revisit only if Decode prompt design surfaces a concrete spoken-hook gap.

---

## 7. C1 differential (criterion 2 — real signal, NOT caption hallucination)

Two structurally-different videos produced **materially different** structural signal:

| Field | Comedy | Talking-head | Differs? |
|-------|--------|--------------|----------|
| content_type | comedy | tutorial | ✅ |
| niche | comedy / character_impersonation | education / social_media_tips | ✅ |
| video length (max t_end) | 16.8 s | 59 s | ✅ |
| segment count | 6 | 7 | ✅ |
| segment boundaries | short 2–3 s cuts | long 12–13 s blocks | ✅ |
| weakest_modality | text_overlay_score | visual_stop_power | ✅ |
| content_summary | Mr. Bean POV impersonation, wide-angle, driveway, 'Pov: Mr Bean' overlay | TikTok editing tutorial via Splice app: grab sound → import → extract audio → edit to beat → re-upload | ✅ |

Both summaries describe **visual/temporal specifics obtainable only by watching the video** (wide-angle lens & driveway; on-screen app named "Splice" and the editing step sequence). This is **real multimodal signal, not caption-text hallucination** — the C1 guard PASSES. The build is valid: a non-owned URL demonstrably produces real Omni segments.

---

## 8. Plan 03 strategy decision (the gate's forward-parameterization)

The resolved `mediaUrls[0]` is fetchable **only with the Apify token**. Two ways to make it reach Omni:

- **Option A — token-scoped pass-through:** append `?token=<APIFY_TOKEN>` to `mediaUrls[0]` and feed straight to `analyzeVideoWithOmni`. **PROVEN to work** (both videos: full segments + all signals). Simplest, lowest latency, no storage. **SECURITY CAVEAT: leaks a full-access Apify API token to DashScope/Alibaba** (token travels in the URL to a third-party LLM). Unacceptable for production with an account-wide token.
- **Option B — Supabase re-host with derive-and-drop (RECOMMENDED):** download `mediaUrls[0]` server-side with the token (Virtuna owns it; 200/~7 MB proven), upload to the Supabase `videos` bucket, mint a short-lived signed URL, feed the **signed URL** to Omni, then **delete the object in `finally`** and **never set `video_storage_path`** on a `tiktok_url` row. Matches the existing `video_upload` path (`omni-analysis.ts` header: "Video is passed as a Supabase signed URL"). Latency: +download(~7 MB)+upload+sign — still well under 300 s inline. No token leak.

**Recommendation: Option B.** It is the secure path, reuses the proven signed-URL Omni contract, and aligns with Plan 03's already-stated derive-and-drop requirement. The spike's contribution is the *why*: re-host is required for **security (token non-leakage)**, not for TTL.

---

## A1–A5 resolution summary

| ID | Question | Verdict |
|----|----------|---------|
| A1 | Clockworks input key for one URL | `{ postURLs:[url], resultsPerPage:1, shouldDownloadVideos:true }` ✅ |
| A2 | mp4 download field + index | `mediaUrls[0]` (an `api.apify.com` KV-store URL) ✅ |
| A3 | Resolved-URL TTL vs pipeline window | Persists days >> window; private (needs token). No expiry risk ✅ |
| A4 | Omni hook fidelity / separate ASR needed? | Fidelity sufficient; ASR deferred (do NOT build in Phase 1) ✅ |
| A5 | resolve+Omni latency vs maxDuration=300 | ~60–75 s << 300 s → inline viable ✅ |
