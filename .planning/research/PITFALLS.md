# Domain Pitfalls — Viral Remix (v3.2)

**Domain:** Adding a "decode a third-party viral TikTok + generate adapted concepts" capability to an existing TikTok prediction tool
**Researched:** 2026-05-31
**Worktree:** `~/virtuna-viral-remix` (branch `milestone/viral-remix`)
**Overall confidence:** HIGH — every codebase claim traced through `route.ts`, `pipeline.ts`, `normalize.ts`, `use-analysis-stream.ts`, `apify-provider.ts`, SPEC, PROJECT, and the engine latency AUDIT. MEDIUM only on legal/IP + decode-quality, which rest on general domain reasoning (not Context7-verifiable).

> Grouped: **Ingestion → Legal/IP → Latency/Cost → One-board-two-config UX → Decode quality.**
> Each pitfall: **Warning sign / Prevention / Owning phase.**
> Phases are *suggested* (roadmap not yet cut). Phase 1 = ingestion BUILD (req #8); it gates everything else.

---

## ⚠ Load-bearing fact that frames everything below — VERIFIED in code

**For a `tiktok_url`, the engine ingests ZERO video signal today — it analyzes only caption text.** Traced through the full path:

1. `route.ts` for `input_mode: "tiktok_url"` only regex-validates the URL (`/^https?:\/\/(www\.|vm\.)?tiktok\.com\//`, lines 238–246), then hands `validated` to `runPredictionPipeline()`.
2. `pipeline.ts:494–508` sets `signedVideoUrl` **only** for `video_upload` mode. For `tiktok_url`, `signedVideoUrl` stays `null`.
3. `signedVideoUrl === null` → the Omni video call is **never made** (`if (signedVideoUrl)`, pipeline.ts:520). No segments, no Pass 2, no audio, no `hook_decomposition`.
4. The gemini stage falls to its **text branch** (pipeline.ts:564–606): it sends only `validated.content_text` to a Qwen text model with the prompt *"Analyze this TikTok content: {content_text}"*, returns `video_signals: null`, `signalAvailability` all false.
5. Confirmed by the pipeline's own comments — "Skipped in text mode + tiktok_url mode (no segments)" (lines 116, 122, 871) — and by the AUDIT: "Text / tiktok-url mode skips Omni + Pass 2 (no segments) → ~14 calls."

**`normalize.ts:55` sets `video_url = input.tiktok_url`**, but nothing downstream fetches it — the comment "used by Apify scrape, etc." (normalize.ts:50) is an intent that is **not wired**. The only live Apify path (`apify-provider.ts`) scrapes by **handle** (`scrapeProfile`/`scrapeVideos(handle, …)`), has **no single-URL video fetch**, and returns metadata + `webVideoUrl`, not frames or transcript. A single-URL scraper exists only in **dormant** corpus code (`_dormant/corpus/apify-jobs.ts`, `clockworks/tiktok-scraper`) — off the live path.

**Consequence:** Decode (SPEC req #2: hook pattern, pacing, "the turn", emotional beat) needs *visual structure*. The current `tiktok_url` path gives it **a caption string** — and only if a caption was supplied. This is not "maybe insufficient" — it is **verified insufficient**. Requirement #8 is therefore not "confirm or deny"; it is **"build ingestion"** (single-URL scrape → download → feed the existing Omni segmentation), and that build is a prerequisite phase, not a spike footnote. Every Decode-quality pitfall below is conditional on this ingestion being built first.

---

## Critical Pitfalls

### C1. Decode built on the existing `tiktok_url` path = caption-only hallucination (the spec-killer)
**Group:** Ingestion · **Owning phase:** Phase 1 (Ingestion BUILD, req #8 — not just a spike)

**What goes wrong:** The "reuse the pipeline" constraint will lead someone to point Decode at the existing `tiktok_url` path. As verified above, that path gives the model **only the caption text** — no frames, transcript, or segments. Decode over a caption string is pure hallucination: the model invents a structural teardown from a sentence. The seed already rates Constraint Clarity 0.62 (below the 0.65 min) for this — and the code is worse than the seed feared (caption-only, not "metadata").

**Warning sign:** A Decode demo "works" the day it's built (the LLM always produces plausible structure text). Decode output is identical-shaped for structurally-different pasted videos. Phase 1 is scoped as a 1-day "spike" that only documents the gap instead of building ingestion.

**Prevention:**
- Reframe req #8 from "spike" to **ingestion BUILD phase**: the live `tiktok_url` path is confirmed caption-only, so the deliverable is working frame/transcript ingestion for a non-owned URL.
- Decide the mechanism early — a single-URL scraper (the dormant `clockworks/tiktok-scraper` postURLs pattern in `_dormant/corpus/apify-jobs.ts` is the closest existing primitive) that yields a downloadable `webVideoUrl`, then feed it into the **same Omni segmentation** the `video_upload` path already uses (`analyzeVideoWithOmni`, pipeline.ts:520–547) so Decode gets real `segments` + `hook_decomposition`.
- Test against ≥5 real non-owned URLs: high-view, region-locked, age-gated, photo-carousel (no video track), and a `vm.tiktok.com` short link.
- Hard gate: no Decode-generation plan (Phase 2) is written until a non-owned URL demonstrably produces Omni segments (or a documented, accepted fallback signal).

**Detection:** Run the same Decode on two structurally-different viral videos; if the structural fields read nearly identically, no real frame signal reached the model.

---

### C2. Reusing `/api/analyze` for Decode silently runs the full 90–332s scoring pipeline
**Group:** Latency/Cost · **Owning phase:** Phase 2 (Remix path / Decode generation)

**What goes wrong:** "Reuse the pipeline" taken literally is a trap. `POST /api/analyze` runs `runPredictionPipeline` + `aggregateScores` — Omni, Wave 3 personas (Pass 1 + Pass 2), platform-fit, Stage 10/11 LLM tail, ML — measured at **211s pipeline + 121s tail = 332s** (AUDIT §0/§2). Decode does **not** need a score; it needs a structural teardown. Routing Decode through the scoring engine pays the full latency/cost for output thrown away, and burns the daily quota.

**Warning sign:** Decode takes minutes to render. `usage_tracking` increments on a *decode* (Decode is not a graded analysis — `DAILY_LIMITS`, route.ts:151–156). Cost dashboard shows full-pipeline cents per paste. The run exceeds Vercel `maxDuration=300` (route.ts:149) and gets killed mid-stream (AUDIT bug §7.1).

**Prevention:**
- Decode gets its **own** lightweight path: ingest (C1) → Omni segment → ONE decode-specific Qwen call (Qwen-only constraint) over the segments + `hook_decomposition`. Do NOT run Wave 3 / Stage 10/11 / ML for a decode.
- The full pipeline is reused **only** for "Develop & predict" (req #4) — the one place a score is wanted.
- Keep Decode off `usage_tracking`/`DAILY_LIMITS` (or meter it separately). Paste-to-decode must not consume a scoring credit.
- Cache Decode by source-video content hash (mirror `computeContentHash`/`lookupPredictionCache`, route.ts:349–395) so re-pasting the same viral URL is near-instant and free.

**Detection:** Latency log line on the decode path; alert if it exceeds the Omni-segment budget (~30–60s per AUDIT §2) — anything in the 100s+ range means the scoring tail leaked in.

---

### C3. "Develop & predict" wired to fan-out → accidental bulk scoring
**Group:** Latency/Cost · **Owning phase:** Phase 4 (Develop & predict + lineage)

**What goes wrong:** SPEC req #4 + the explicit out-of-scope ("Bulk auto-scoring of all concepts — cost/latency prohibitive") exist because the obvious implementation — render 3 concepts, each auto-kicks an analysis — costs 3× ~332s and 3 quota units per remix (AUDIT measured E2E). Easy to introduce via a `useEffect` that fires on concept render, or a "develop all" affordance.

**Warning sign:** Pasting a viral URL produces 3 in-flight analyses. `usage_tracking` jumps by 3. Three SSE streams open at once. A concept card shows "scoring…" without a click.

**Prevention:**
- Develop is **click-gated, one concept at a time**: the Develop button calls `stream.start()` for that single concept only.
- No `useEffect`-on-mount that starts a stream for a concept — this is the exact shape of the hook's documented **Pitfall #3** ("never auto-open on mount"; `use-analysis-stream.ts:123, 305–309`).
- Disable/queue a second Develop while one is in flight (one active transport per the hook's Strict-mode reducer, line 141).
- Acceptance test from SPEC: "the other concepts are not scored unless separately developed" — assert exactly one new row + one nav.

**Detection:** Integration test: render Adapt with 3 concepts, assert 0 streams open until a click, then exactly 1.

---

### C4. Source video persisted/redistributed → IP + ToS violation (newly introduced by C1's build)
**Group:** Legal/IP · **Owning phase:** Phase 1 (ingestion design) + Phase 2 (decode route)

**What goes wrong:** The transformative/structural-analysis defense (SPEC out-of-scope: "Storing/redistributing the source video … do not persist or rebroadcast") collapses the moment the implementation downloads the MP4 and (a) writes it to Supabase Storage, (b) returns a playable URL to the client, or (c) embeds the third-party `webVideoUrl` long-term. **Today the `tiktok_url` path downloads nothing (verified above), so there is zero non-owned media in the system.** The instant Phase 1 adds a download-and-segment step to feed Omni, the pipeline starts handling third-party MP4s — and the existing Omni path expects a **Supabase Storage signed URL** (pipeline.ts:496–508), which tempts a "just upload the scraped video to our bucket" shortcut. That shortcut is the violation. The existing `storage_retention_opted_in` semantics (route.ts:278–283, `cleanupUploadedStorage`) are designed for the user's **own** uploads and must NOT be reused to retain non-owned media.

**Warning sign:** A `video_storage_path` set for a remix/decode row. Any decode response containing a media URL the client renders as a `<video>`. Source frames written to a public bucket. `storage_retention_opted_in` consulted on a remix.

**Prevention:**
- **Derive-and-drop:** if ingestion downloads media to extract signal, delete it in a `finally` (the route already models this with `cleanupRawUpload`/`cleanupUploadedStorage`, route.ts:40–85). Never persist beyond the request.
- Prefer feeding Omni the scraper's **direct `webVideoUrl`** if Omni accepts arbitrary URLs (avoids rehosting entirely); otherwise download-to-temp + delete.
- Persist only **derived structural fields** (text teardown, repeatable-vs-luck), never frames/MP4.
- For thumbnail/preview, render TikTok's **oEmbed** embed or the existing metadata preview — do not rehost.
- Schema guard: the remix/decode row type must not carry a media-path column; lint/test that no decode write touches `video_storage_path`.
- Keep the Audience frame (retained for the viral video per SPEC) from triggering a full media download solely to simulate retention — confirm it runs on derived signal.

**Detection:** Storage audit: zero objects whose provenance is a non-owned URL. Grep decode/remix code paths for `storage.from("videos")` writes.

---

## Moderate Pitfalls

### M1. Non-owned URL ingestion failure modes treated as one error
**Group:** Ingestion · **Owning phase:** Phase 1 (ingestion build) → Phase 2 (remix path error states)

**What goes wrong:** An arbitrary pasted URL hits failure classes the current "my own content" flow never sees at volume: **private** video, **region-locked**, **age-gated/login-walled**, **deleted/404**, **photo carousel** (no video track), **vm.tiktok.com** short-link needing resolution, watermark-only frames, and **Apify rate-limit / actor timeout / cost spikes**. `apify-provider.ts` currently throws a bare `Error("No profile data returned…")` (line 33) and `console.warn`s on per-video Zod failure (line 67) — no typed failure taxonomy. The new single-URL scraper (C1) will surface all of these for the first time.

**Warning sign:** Remix shows a generic "Analysis failed" for a private video. Apify bill climbs with paste volume. A `vm.` short link breaks the scraper (the route's regex allows `vm.` but the scraper may not resolve it). Carousel posts crash frame extraction.

**Prevention:**
- Phase 1 must classify each failure; Phase 2 surfaces distinct, honest copy: "This video is private / region-locked / removed — can't decode it." Not a red error toast.
- Hard timeout + cost ceiling on the single-URL ingestion call (existing actor calls use `waitSecs: 60/120`, apify-provider.ts:25/56 — pick an aggressive cap and a per-user rate limit so a paste-spammer can't run up Apify cost).
- Resolve `vm.tiktok.com` short links before scraping; reject photo carousels with a clear "video only" message.
- Reuse the tier rate-limit pattern (route.ts:296–310, the 429 branch) for remix ingestion so abuse is bounded.

**Detection:** Phase 1 artifact has a failure-mode table; Phase 2 has a test per class.

---

### M2. Stale frame state when toggling Score ⇄ Remix on the persistent board
**Group:** One-board-two-config UX · **Owning phase:** Phase 3 (board reconfiguration)

**What goes wrong:** The board mounts independent `useAnalysisStream` instances inside a **persistent** `analyze/layout.tsx` — "none of them remount on `/analyze ↔ /analyze/[id]` nav" (`use-analysis-stream.ts:510–517`). The hook already needed two custom reset triggers (the `newAnalysisSignal` store bump, line 536; the permalink-leave guard, line 548) precisely because React won't remount these nodes. A *mode swap* (Verdict+Actions → Decode+Adapt) adds a **new** staleness axis the existing machinery doesn't cover: toggling to Remix while a completed Score result sits in node state, or Decode/Adapt content surviving a flip back to Score.

**Warning sign:** Toggling to Remix briefly shows the previous Score verdict number. Toggling back to Score shows a stale Decode card. Develop-from-concept navigates but the parent's Decode lingers in a sibling frame.

**Prevention:**
- Treat a **mode change as a reset event**: bump `newAnalysisSignal` (or an analogous remix signal) so the proven `wipeToIdle()` (line 518) fires in every instance on toggle — reuse the mechanism, don't invent a parallel one.
- Decode/Adapt nodes must key on `(analysisId, mode)`; a Score-mode permalink must never hydrate a Decode node and vice-versa.
- Gate the toggle while a stream is in flight (`phase === "analyzing"`) — mirror the line-548 guard that already protects an in-flight run from being wiped.

**Detection:** Test: complete a Score analysis → toggle to Remix → assert no Verdict/Actions residue; complete a Decode → toggle to Score → assert no Decode residue.

---

### M3. `use-analysis-stream` documented pitfalls (#3/#6/#8) resurface in the Develop flow
**Group:** One-board-two-config UX / Latency · **Owning phase:** Phase 4 (Develop & predict)

**What goes wrong:** Develop reuses the SSE hook, so its known traps re-fire in a new context:
- **Pitfall #3 (auto-open):** initialData with non-null `overall_score` short-circuits to `complete` and never opens a stream (line 123). A concept card that pre-seeds initialData would render "complete" with no score. A concept *must* call user-initiated `start()` (line 305) — never auto-open.
- **Pitfall #6 (`analysisId` from `started`):** lineage (`parent_id`, req #5) must NOT be derived from the child's `started` frame (line 167–175). If Develop sets `parent_id` before `started` arrives, the write races.
- **Pitfall #8 (visibility-gated polling):** if a creator develops a concept then backgrounds the tab during the ~332s run, polling pauses on `document.hidden` (line 433–440) and the 90s ceiling (line 421–430) fires `error` even though the analysis is still running server-side — more likely with remix's longer tails.

**Warning sign:** Developed concept board sits on "Calculating…" forever (sibling-cache hydration miss — the bug the line-450 permalink-replay effect fixes). `parent_id` null on a developed row. "Stream timed out" on a backgrounded long run.

**Prevention:**
- Capture `parent_id` from the source remix analysis id (stable, known before Develop) — write it into the analyze request body so the child row is born with lineage. Do NOT derive it from the child's `started`.
- Persist `parent_id` server-side in the `analysis_results` INSERT/UPSERT (route.ts:398–481, `buildInsertRow`) — add a `parent_id` column + migration; ensure both the placeholder INSERT (line 579) and the UPSERT (line 685) carry it.
- Re-verify sibling-cache hydration (`queryClient.setQueryData`, line 251) for a child board reached via in-app nav from a concept (not a fresh permalink).
- Given the AUDIT's 332s wall vs the hook's 90s polling ceiling, lift the ceiling for remix-developed children or surface "still running" instead of `error`.

**Detection:** Lineage test: Develop a concept → assert `parent_id` non-null on the child row before `complete`. Background-tab test for the polling ceiling.

---

### M4. Mobile card-stack doesn't absorb the swapped frames
**Group:** One-board-two-config UX · **Owning phase:** Phase 3 (board reconfiguration)

**What goes wrong:** Mobile renders a separate `BoardMobile.tsx` card-stack (SPEC §Background; PROJECT mobile-board-card-view note: "phones render a card stack … auto <768px"). The Konva desktop grid and the mobile stack are two render paths. A frame swap implemented only in the Konva grid leaves mobile showing Verdict+Actions (or empty cards) in Remix mode. PROJECT/memory also flags that a frame that *throws* "blocks full-board render" (audience-redesign-v2 history) — a half-wired Decode card can take down the whole mobile stack.

**Warning sign:** Remix board correct on desktop, wrong/empty on mobile. Decode card throws → entire card-stack blank.

**Prevention:**
- Drive both render paths from a **single board-config source** (a `mode → frame list` map) consumed by the Konva grid AND `BoardMobile`, so the swap is defined once.
- Wrap each new frame (Decode, Adapt) in an error boundary so one frame's failure degrades to a placeholder, not a blank board.
- Acceptance (SPEC): "on both desktop canvas and mobile card-stack" — test both at <768px and ≥768px.

**Detection:** Mobile-viewport test asserting the 6 remix frames render as cards.

---

### M5. Decode hallucinates "why it went viral" / can't separate luck from structure
**Group:** Decode quality · **Owning phase:** Phase 2 (Decode generation)

**What goes wrong:** SPEC req #2 demands an explicit **repeatable-vs-luck** split — the brand's "honest number" ethos applied to virality. A Qwen call given thin signal (especially if C1 isn't resolved) will confidently invent causal stories ("viral because of the pattern interrupt at 0:03") for videos that won on **distribution luck**: existing large audience, a trending sound, algorithmic timing, an outlier comment thread, a duet chain. Attributing luck to structure is the single most damaging decode error — it sends creators to copy noise. Compounding risk: the AUDIT shows the engine has **no corpus ground truth** (`outcomes`/`trending_sounds`/retrieval all 0 rows), so there is no data-side check on the model's virality claims.

**Warning sign:** Decode always finds a repeatable structure (luck bucket empty). Identical-sounding teardowns across very different videos. No reference to follower count / sound trend / posting timing in the luck split. A video that went viral on creator fame still gets a "reproducible hook" verdict.

**Prevention:**
- Feed the model the **luck signals it needs to discount**: source creator follower count + the video's view multiple vs that creator's baseline (the engine already has baseline/`anti_virality_gated` concepts — PROJECT), whether the sound is trending, posting recency. Without these the luck split is fiction. (Sourcing follower/baseline for a *non-owned* creator may need the handle-based `apify-provider.ts` `scrapeProfile` — note for Phase 1/2.)
- Prompt must **require** a non-empty luck column and allow "mostly luck — little to reproduce here" as a valid, honest verdict (matches the Score frame's honest-number stance).
- Calibrate against the SPEC's "known viral test video" plus a deliberately-lucky control (huge creator, mediocre structure) — Decode should label that luck-dominant.
- Never frame the source as something to "fix" (SPEC req #2 acceptance) — it's a reference, not the user's content.

**Detection:** Eval set of {structure-driven, luck-driven, mixed} videos; assert the luck/structure split moves with the category.

---

### M6. Adapt drifts from format-adaptation into content-copying
**Group:** Legal/IP + Decode quality · **Owning phase:** Phase 3 (Adapt generation)

**What goes wrong:** SPEC req #3 + the spine ("format/structure adaptation, never content copying — 'adapt this format', never 'redo this video'") is a *generation-prompt* discipline, and LLMs default to mimicry. Given a viral cooking video, Adapt for a fitness niche can easily output "make the same recipe but for gym bros" — reproducing the source's specific subject. That's off-spec AND the IP risk surfacing at the **concept** layer (the structural-analysis defense weakens if the output tells users to recreate the specific video).

**Warning sign:** A concept references the source's specific subject/content (the recipe, the product, the storyline) rather than its structure (the 3-beat reveal, the question-hook, the before/after frame). Concepts read as "the same video in a different niche."

**Prevention:**
- Adapt prompt consumes the **Decode structural fields only** (hook pattern, pacing, the turn) — NOT the source caption/subject. Structurally prevent content leakage by not passing source content into Adapt.
- Acceptance gate (SPEC): "none reproduces the source's specific content/subject" — encode as an automated check (concept text must not contain source-caption n-grams) plus copy review.
- UI framing stays "adapt this format" everywhere; no "redo/recreate this video" affordance.

**Detection:** N-gram overlap test between source caption and generated concepts; manual copy review on the eval set.

---

## Minor Pitfalls

### m1. EventSource / polling churn from multiple node instances during remix
**Group:** Latency/Cost · **Owning phase:** Phase 4

**What goes wrong:** The board mounts several `useAnalysisStream` callers; each can independently open the GET-stream/poll on reconnect (hook lines 261–296, 398–407). In remix mode the longer (~332s) tails increase reconnect probability; uncoordinated, multiple instances could poll `/api/analysis/[id]` simultaneously. The hook mitigates with a shared TanStack cache key (lines 251, 468) — but a new Decode/Adapt node added carelessly could spawn its own poll loop.

**Warning sign:** Network tab shows >1 poller for the same analysis id; duplicate GET-stream connections.
**Prevention:** New Decode/Adapt nodes must read from the shared `queryKeys.analysis.detail(id)` cache, not open their own stream. Only Board's instance owns the transport.
**Detection:** Network assertion in an integration test: one poll loop per analysis id.

---

### m2. Niche-missing path blocks Adapt with no inline recovery
**Group:** Decode quality / UX · **Owning phase:** Phase 3 (Adapt + niche source)

**What goes wrong:** SPEC req #7: Adapt reads niche from `creator_profiles`; if empty, prompt inline. The route already reads `creator_profiles` (route.ts:278). If the empty-niche case isn't handled, Adapt either generates niche-blind concepts or silently fails after Decode already rendered — a dead-end board.

**Warning sign:** Adapt renders concepts not tied to any niche when the profile is empty; or Adapt frame is permanently empty with no prompt.
**Prevention:** Block concept generation behind an inline niche prompt when the profile niche is empty (req #7 acceptance); cache the supplied niche back to the profile. Decode can render first (it doesn't need niche); only Adapt gates on it.
**Detection:** Test both states: populated profile (no prompt) and empty profile (prompt then generate).

---

### m3. Lineage chip / Recent list breaks the permalink-replay assumptions
**Group:** One-board-two-config UX · **Owning phase:** Phase 4 (lineage)

**What goes wrong:** The "remixed from" chip (req #5) links a child board back to its parent (a *remix/decode* analysis, not a normal scored one). The permalink-replay effect (`use-analysis-stream.ts:450–508`) hydrates a board from `/api/analysis/[id]` expecting a scored row (`overall_score != null`). A parent remix/decode row will have **null** `overall_score` (Decode isn't scored — C2), so navigating to the parent via the chip leaves the board stuck in `idle`/"Calculating…" (the very Pitfall #3 the effect guards against — but it keys on `overall_score`).

**Warning sign:** Clicking "remixed from" lands on a parent board that never leaves "Calculating…". Recent list shows a decode row with no score and a broken card.
**Prevention:** Give remix/decode rows a distinct completion marker (not `overall_score`) so the hydration effect (line 488–500) recognizes a *complete decode* row; or render decode permalinks through a decode-aware loader rather than the score-gated one. Recent-list rows must render decode rows differently from scored rows.
**Detection:** Permalink test: open a decode row directly by URL → asserts it hydrates to its Decode view, not a stuck score board.

---

## Phase-Specific Warnings (roadmap input)

| Suggested Phase | Likely Pitfall(s) | Mitigation summary |
|---|---|---|
| **1 — Ingestion BUILD (req #8, HARD GATE)** | C1, M1, C4 (design) | VERIFIED: `tiktok_url` path is caption-only — build frame/transcript ingestion (single-URL scrape → download → feed existing Omni `analyzeVideoWithOmni`). Classify ≥5 failure classes; design derive-and-drop (no media persistence). **No Decode work starts until a non-owned URL produces real Omni segments.** |
| **2 — Remix path + Decode generation** | C2, M5, C4 | Decode = own lightweight Qwen path (NOT the scoring pipeline), off `usage_tracking`; force a non-empty luck split with luck signals fed in; persist derived fields only. |
| **3 — Board reconfiguration + Adapt** | M2, M4, M6, m2 | Single `mode→frames` config drives Konva + mobile; mode-change = reset signal; Adapt consumes structural fields only; inline niche prompt. |
| **4 — Develop & predict + lineage** | C3, M3, m1, m3 | Click-gated single-concept develop; `parent_id` from source id (not child `started`) + migration; reuse shared cache; decode-aware permalink hydration; lift the 90s polling ceiling for ~332s runs. |

---

## Confidence Assessment

| Pitfall area | Confidence | Basis |
|---|---|---|
| Ingestion (C1, M1) | HIGH | Traced full path: `route.ts` → `pipeline.ts:494–606` (signedVideoUrl null for `tiktok_url` → Omni skipped → caption-only text branch) → `normalize.ts:55` (`video_url` set but unwired) → `apify-provider.ts` (handle-only, no single-URL fetch). Caption-only ingestion is VERIFIED, not assumed. |
| Legal/IP (C4, M6) | MEDIUM | General IP/ToS reasoning + SPEC out-of-scope; the storage-cleanup pattern + Omni signed-URL expectation verified in `route.ts`/`pipeline.ts`. |
| Latency/Cost (C2, C3, m1) | HIGH | 332s measured E2E (AUDIT §0/§2); `maxDuration=300` (route.ts:149); `usage_tracking`/`DAILY_LIMITS` (route.ts:151) verified; bulk-scoring explicitly out-of-scope in SPEC. |
| One-board-two-config UX (M2, M3, M4, m3) | HIGH | All grounded in `use-analysis-stream.ts` documented pitfalls #3/#6/#8 + reset machinery (lines 123, 167, 433, 510–558) + PROJECT mobile/throw notes. |
| Decode quality (M5, M6) | MEDIUM | SPEC reqs #2/#3 + general virality-attribution reasoning; AUDIT confirms no corpus ground truth. Depends on C1 outcome. |

## Gaps to address (need phase-specific research)

- **RESOLVED in this research:** `tiktok_url` ingestion is caption-only (traced through `pipeline.ts`); no single-URL video fetch exists on the live path (only dormant corpus code). Phase 1 is a BUILD, not a config tweak.
- **Single-URL scraper choice + cost** — the dormant `clockworks/tiktok-scraper` postURLs pattern (`_dormant/corpus/apify-jobs.ts`) is the closest existing primitive; Phase 1 must price its per-paste cost and confirm it returns a downloadable `webVideoUrl` for non-owned URLs at acceptable latency (Omni adds ~30–60s — AUDIT §2).
- **Whether feeding the scraped video through Omni triggers C4** — Omni expects a Supabase signed URL (pipeline.ts:496); Phase 1 must design a path that segments the scraped video WITHOUT persisting it (pass the scraper's direct `webVideoUrl` to Omni if it accepts arbitrary URLs, or download-to-temp + delete-in-finally).
- **`analysis_results` schema** — confirm a `parent_id` column + migration is needed for lineage (none seen in `buildInsertRow`, route.ts:398–481).
- **TikTok oEmbed / preview** path the input already uses (`tiktok-url-input.tsx`, referenced in SPEC but not read) — confirm it's metadata-only and reusable for the non-rehosting thumbnail (supports C4 derive-and-drop).
- **Non-owned creator baseline for M5** — sourcing follower count / view-multiple for the *source* creator likely needs `apify-provider.ts` `scrapeProfile(handle)`; confirm the handle is extractable from the pasted URL.

## Sources

- `src/app/api/analyze/route.ts` (read in full, 807 lines) — URL validation, pipeline invocation, `usage_tracking`/`DAILY_LIMITS`, cache, storage cleanup, `buildInsertRow`, placeholder-INSERT/UPSERT, `maxDuration=300`.
- `src/lib/engine/pipeline.ts` (read in full, 978 lines) — VERIFIED `tiktok_url` path: signedVideoUrl null → Omni skipped → caption-only text branch (lines 494–606); "no segments in tiktok_url mode" comments (116, 122, 871); Omni reuse target `analyzeVideoWithOmni` (520–547).
- `src/lib/engine/normalize.ts` (lines 34–55) — `video_url = tiktok_url` set but the "used by Apify scrape" intent is unwired.
- `src/hooks/queries/use-analysis-stream.ts` (read in full, 589 lines) — documented Pitfalls #3/#6/#8, reset machinery, persistent-layout multi-instance hydration, polling ceiling/visibility gate.
- `src/lib/scraping/apify-provider.ts` (read in full) — handle-based scrape, no single-URL video fetch, bare error handling. Single-URL scraper exists only in `_dormant/corpus/apify-jobs.ts` (off the live path).
- `.planning/milestones/viral-remix-SPEC.md` — 8 reqs, boundaries, constraints, ambiguity report (Constraint Clarity 0.62).
- `.planning/PROJECT.md` — mobile card-stack, anti-virality/baseline concepts, milestone framing.
- `.planning/AUDIT-engine-e2e-latency-accuracy.md` — measured 211s pipeline + 121s tail = 332s; "Text / tiktok-url mode skips Omni + Pass 2"; ~26 LLM calls/run; score = two LLM opinions (no corpus ground truth); confirms the latency that forbids bulk scoring (C3) and the caption-only `tiktok_url` path (C1).
- General domain knowledge (MEDIUM): TikTok non-owned-URL ingestion failure classes + transformative-use/IP reasoning — not Context7-verifiable.
