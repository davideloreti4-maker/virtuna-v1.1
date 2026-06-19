# Phase 10 — Wave-0 Apify Single-URL Metric Spike (10-02 Task 1)

**Run:** 2026-06-19
**Probe actor:** `clockworks/tiktok-scraper` (initial probe). **IMPLEMENTED actor:** `apidojo/tiktok-scraper-api`
Single Post Query tier — see "PROVIDER CORRECTION — FINAL" below. (Probe magnitudes still valid; provider changed.)
**Mode:** `{ postURLs: [<url>], resultsPerPage: 1, shouldDownloadVideos: false }`
**Probe:** throwaway `apify-client` one-shot via `npx tsx` (NOT app code; script deleted after run).
**Probe URL:** `https://www.tiktok.com/@tiktok/video/7106594312292453675` (known long-lived public TikTok post)
**Status:** ✅ OWNER SIGNED OFF (2026-06-19) — APPROVED. Task 2 + Plan 01 A1 lock unblocked.

---

## Open Q1 — Does clockworks single-URL return full public metrics, or only the media URL?

**ANSWER: Full public metrics ARE returned on the single-URL clockworks path.** Non-null on the probe item:

| Field | Value (probe) | Maps to |
|-------|--------------|---------|
| `playCount`   | 563,600 | views (denominator for all rates) |
| `diggCount`   | 98,700  | likes |
| `shareCount`  | 127     | shares → **connector** (primary) |
| `commentCount`| 1,334   | comments → **connector** (secondary) |
| `collectCount`| 58,618  | saves → **collector** (see Q2) |

Item also carried no `error`/`errorCode` keys (clean post), `itemCount: 1`. Top-level keys present include
`diggCount, shareCount, playCount, collectCount, commentCount, repostCount, mediaUrls, authorMeta, videoMeta`.

This confirms RESEARCH §Pitfall 2's expectation: clockworks single-post is the same scraper family as the
profile path and carries the full metric block — `resolveVideoUrl` only *returned* `mediaUrls` because that
was all it needed, not because the metrics were absent.

## Open Q2 — Are TikTok saves (`collectCount`/bookmarks) public on the single-URL path?

**ANSWER: YES — `collectCount: 58618` returned, non-null, on the single-URL clockworks item.**

Significant for the flywheel: **the `collector` disposition gets a PUBLIC realized signal** on TikTok single-URL
capture — it is NOT creator-supplied-dependent (the D-04 "optional private add" fallback is NOT needed for saves
on TikTok). The honesty-spine present-or-absent handling (Pitfall 3) still applies per-channel for the
genuinely creator-supplied channels (retention / `watch_through_pct`, `link_clicks`), but saves are now a
public realized channel alongside views/likes/comments/shares.

> Caveat carried forward: this is verified on **TikTok**. Instagram/YouTube field availability differs;
> the realized-signature builder must keep per-channel present-or-absent provenance (`public_scrape` vs
> `creator_supplied`) so a platform without public saves degrades honestly rather than zero-filling.

## (c) Chosen Task-2 path

**Extend `resolveVideoUrl`-style clockworks call to return `VideoData`** (NOT the creator-supplied-only fallback —
the probe proved the public metrics, including saves, are present).

Concretely for Task 2:
- Add `scrapeSinglePostMetrics(url: string): Promise<VideoData | null>` on `ApifyScrapingProvider`.
- Mirror `resolveVideoUrl` (same `VIDEO_ACTOR` clockworks call, same SSRF/HTTPS allowlist guard) but with
  `shouldDownloadVideos: false` (metrics-only; no KV media fetch needed).
- Remap the clockworks item to `VideoData` using the probe-confirmed field names:
  `playCount→views, diggCount→likes, shareCount→shares, commentCount→comments, collectCount→saves`.
- Reuse the existing `not_found` (error/errorCode) and `empty_dataset` guards from `resolveVideoUrl`.

---

## A1 — Calibration-vs-Craft disposition split (HIGHEST-VALUE owner confirmation, D-03 guard)

RESEARCH §1/§3 derive this split from the byte-stable persona-registry semantics. Plan 01 already implemented it
AS-WRITTEN (`CALIBRATION_DISPOSITIONS` / `CRAFT_DISPOSITIONS` in `reconcile.ts`, `[ASSUMED] A1` marker retained),
and **Plan 01's tests assert this split** — so a wrong A1 passes every test silently and routes craft-flops into
the Audience override (the exact D-03 failure). That is why this is a human gate, not a comment.

**Proposed split (the WHO vs the HOW-WELL):**

| Side | Dispositions | Meaning | Routes to |
|------|-------------|---------|-----------|
| **CALIBRATION** ("WHO showed up") | `collector`, `connector`, `converter` | which segment actually showed up vs the modeled mix | the **Audience override** (PersonaWeights `analysis_override`) — may PROPOSE a recalibration |
| **CRAFT** ("HOW WELL it delivered") | `scanner`, `lurker`, `skeptic` | whether the content delivered to whoever showed up (retention, hook survival) | **Account Read** guidance ONLY — NEVER mutates the model |

**Registry grounding:** collector/connector/converter are defined by *what action the viewer takes*
(save / share / buy) = identity of the segment present. scanner/lurker/skeptic are defined by
*how far / whether they watch* = a verdict on the content's delivery. First answers "did we model who's here?";
second answers "was the content good for them?". The split is the mechanical basis of D-03 — a content flop
(craft) can never reach the override path.

---

## ✅ OWNER SIGN-OFF (2026-06-19) — APPROVED

> **"approved"** — both items confirmed:
> 1. **Metric shape:** APPROVED. Single-URL scrape returns full public metrics incl. saves.
>    **Provider corrected (see FINAL section below):** implemented against `apidojo/tiktok-scraper-api`
>    (Single Post Query tier), remapping the apidojo shape `views/likes/comments/shares/bookmarks→saves`
>    via `remapApidojoVideo`. (The earlier clockworks `playCount→views … collectCount→saves` plan was
>    superseded once the separate single-post apidojo actor was found.) ✅
> 2. **A1 split:** APPROVED AS-WRITTEN — calibration = `{collector, connector, converter}`,
>    craft = `{scanner, lurker, skeptic}`. Plan 01's `reconcile.ts` `[ASSUMED] A1` marker is now
>    owner-confirmed and REMOVED (the split is locked). ✅

---

## ⚠️ PROVIDER CORRECTION — FINAL (web-verified, 2026-06-19)

> **Supersedes an earlier interim conclusion in this section.** The interim note concluded single-URL must
> stay on clockworks because *"apidojo forbids single-post URLs."* That was true only of the **all-in-one**
> apidojo actor (`apidojo/tiktok-scraper`). Further research found a SEPARATE apidojo actor that DOES
> support single-post capture. The corrected, implemented finding is below.

**The two apidojo actors are different:**

| Actor | Single-post? | Use |
|-------|-------------|-----|
| `apidojo/tiktok-scraper` (all-in-one) | ❌ No — requires ≥10 posts/query (the original Pitfall 2 actor) | Discover multi-post (`scrapeVideos`/`scrapeProfile`) |
| `apidojo/tiktok-scraper-api` (**separate**) | ✅ Yes — "Single Post Query" tier ($0.003 flat), `startUrls:[url]` → exactly 1 video, NO 10-post min | **Single-URL outcome capture (`scrapeSinglePostMetrics`)** |

`apidojo/tiktok-scraper-api` single-post output carries the full public metric block in the apidojo field
shape (`views/likes/comments/shares/bookmarks`) — the SAME shape the Discover apidojo actors return.

**Implemented resolution (single source = apidojo; clockworks retired for single-URL metrics):**

- `scrapeSinglePostMetrics(url)` calls `apidojo/tiktok-scraper-api` with `{ startUrls: [url], resultsPerPage: 1 }`.
- Remap via the existing apidojo `apidojoVideoSchema` / `remapApidojoVideo` (`bookmarks→saves,
  views→views, likes→likes, comments→comments, shares→shares`) — NOT clockworks `apifyVideoSchema`.
  Reusing the wrong schema would silently ZERO every metric (the bug `apidojo-remap.test.ts` guards;
  test extended with single-post cases).
- SSRF guard (`isAllowedPostUrl`, HTTPS + TikTok host) retained on the pasted URL.
- **clockworks now serves ONLY `resolveVideoUrl`** (Remix mp4 download — it needs the downloadable KV
  media the metrics-only apidojo actor does not return). Single-URL METRIC capture no longer touches
  clockworks. Both providers are NOT wired for single-URL: `apidojo/tiktok-scraper-api` is the single source.

**Plan-07 UAT verification (live token required):** confirm the live INPUT field is `startUrls` (vs
`postURLs`/`profiles`) and the saves field is `bookmarks` on this actor's dataset version; adapt the
remap if the live shape differs. The original probe magnitudes above
(`views 563,600 / saves 58,618`) remain valid as the EXPECTED numbers for the probe URL — only the
provider/field-names changed.
