# Domain Pitfalls — Viral Remix (v3.2)

**Domain:** Adding a "decode a third-party viral TikTok + generate adapted concepts" capability to an existing TikTok prediction tool
**Researched:** 2026-05-31
**Worktree:** `~/virtuna-viral-remix` (branch `milestone/viral-remix`)
**Overall confidence:** HIGH for codebase-grounded pitfalls (read `route.ts`, `use-analysis-stream.ts`, `apify-provider.ts`, SPEC, PROJECT); MEDIUM for domain/legal risks (general TikTok-ingestion + IP knowledge, not Context7-verifiable).

> Grouped: **Ingestion → Legal/IP → Latency/Cost → One-board-two-config UX → Decode quality.**
> Each pitfall: **Warning sign / Prevention / Owning phase.**
> Phases are *suggested* (roadmap not yet cut). Phase 1 = the ingestion-depth spike (req #8); it gates everything else.

---

## ⚠ Load-bearing unknown that frames everything below

**The analyze route validates a `tiktok_url` but never downloads it.** Verified in `src/app/api/analyze/route.ts`: for `input_mode: "tiktok_url"` the route only regex-checks the URL (`/^https?:\/\/(www\.|vm\.)?tiktok\.com\//`, lines 238–246) and then hands `validated` to `runPredictionPipeline()`. Whatever frame/transcript ingestion exists lives *inside the pipeline*, which I could not open in this session (could not enumerate `src/lib/engine/`). The existing `ApifyScrapingProvider` (`src/lib/scraping/apify-provider.ts`) scrapes by **handle** (`scrapeProfile`/`scrapeVideos(handle, …)`) — it has **no single-URL video fetch path** and returns metadata + `webVideoUrl`, not frames or transcript.

**This is exactly requirement #8.** Do NOT plan Decode (Phase ≥3) until Phase 1 documents, on a real non-owned URL, *which of* {keyframes, transcript/captions, audio, raw metadata} `/api/analyze` actually obtains. Every Decode-quality pitfall below is conditional on this answer.

---

## Critical Pitfalls

### C1. Decode planned on metadata-only ingestion (the spec-killer)
**Group:** Ingestion · **Owning phase:** Phase 1 (Ingestion spike, req #8)

**What goes wrong:** Decode requires structural signal (hook pattern, pacing, "the turn", emotional beat — SPEC req #2). If the pipeline only has caption + thumbnail + view counts for a non-owned URL, Decode is built on a hallucination surface (see D1). The seed itself rates Constraint Clarity 0.62 (below the 0.65 min) *solely* because of this.

**Warning sign:** Phase 1 spike report says "we get caption + metadata" and is silent on keyframes/transcript. Anyone proposing to "just start the Decode frame" before the spike artifact exists.

**Prevention:**
- Phase 1 is a **hard gate**: ship the spike artifact (`acceptance` of req #8) before any Decode plan is written.
- Test against ≥5 real non-owned URLs spanning: high-view, region-locked, age-gated, photo-carousel (not video), and a `vm.tiktok.com` short link.
- The artifact must enumerate per-URL: keyframes? transcript/auto-captions? audio? duration? — yes/no/partial, with the literal payload.
- If frames/transcript are absent, document remediation **cost** (single-URL scraper actor, e.g. a `clockworks/tiktok-scraper` `postURLs` variant, or a download+segment step) **before** Decode is scoped — that remediation may itself be a phase.

**Detection:** Decode fields render but read generically ("strong hook, good pacing") regardless of which video is pasted — the tell that no real frame signal reached the model.

---

### C2. Reusing `/api/analyze` for Decode silently runs the full 90–312s scoring pipeline
**Group:** Latency/Cost · **Owning phase:** Phase 2 (Remix path / decode route)

**What goes wrong:** The "reuse the pipeline" constraint is a trap if taken literally. `POST /api/analyze` (`route.ts`) runs `runPredictionPipeline` + `aggregateScores` — Wave 3 personas, Stage 10/11 LLM tail, ML, the whole 90–312s E2E (PROJECT.md + SPEC §Background). Decode does **not** need a score; it needs a structural teardown. Routing Decode through the scoring engine pays the full latency/cost for output you throw away.

**Warning sign:** Decode takes ~2–5 minutes to render. `usage_tracking` increments on a *decode* (Decode is not a graded analysis and should not burn the daily quota — `DAILY_LIMITS`, route.ts:152). Cost dashboard shows full-pipeline cents per paste.

**Prevention:**
- Decode gets its **own** lightweight path (a decode-only Qwen call over ingested signal), NOT the scoring pipeline. The pipeline is reused **only** for "Develop & predict" (req #4) — that's the one place a score is wanted.
- Keep Decode off `usage_tracking`/`DAILY_LIMITS` (or meter it separately). A paste-to-decode must not consume a scoring credit.
- Cache Decode by source-video content hash (mirror `computeContentHash`/`lookupPredictionCache`, route.ts:352–395) so re-pasting the same viral URL is ~instant and free.

**Detection:** Add a latency log line for the decode path; alert if it exceeds ~15s.

---

### C3. "Develop & predict" wired to fan-out → accidental bulk scoring
**Group:** Latency/Cost · **Owning phase:** Phase 4 (Develop & predict + lineage)

**What goes wrong:** SPEC req #4 + the explicit out-of-scope ("Bulk auto-scoring of all concepts — cost/latency prohibitive") exist because the obvious implementation — render 3 concepts, each auto-kicks an analysis — costs 3× (270–940s, 3 quota units) per remix. Easy to introduce via a `useEffect` that fires on concept render, or a "develop all" affordance.

**Warning sign:** Pasting a viral URL produces 3 in-flight analyses. `usage_tracking` jumps by 3. Three SSE streams open at once. A concept card shows "scoring…" without a click.

**Prevention:**
- Develop is **click-gated, one concept at a time**: the Develop button calls `stream.start()` for that single concept only.
- No `useEffect`-on-mount that starts a stream for a concept (this is the exact shape of the hook's documented **Pitfall #3** — "never auto-open on mount"; see `use-analysis-stream.ts:123, 305–309`).
- Disable/queue a second Develop while one is in flight (one active transport per the hook's Strict-mode reducer, line 141).
- Acceptance test from SPEC: "the other concepts are not scored unless separately developed" — assert exactly one new row + one nav.

**Detection:** Integration test: render Adapt with 3 concepts, assert 0 streams open until a click, then exactly 1.

---

### C4. Source video persisted/redistributed → IP + ToS violation
**Group:** Legal/IP · **Owning phase:** Phase 1 (ingestion design) + Phase 2 (decode route)

**What goes wrong:** The transformative/structural-analysis defense (SPEC out-of-scope: "Storing/redistributing the source video … do not persist or rebroadcast") collapses the moment the implementation downloads the MP4 and (a) writes it to Supabase Storage, (b) returns a playable URL to the client, or (c) embeds the third-party `webVideoUrl` long-term. The existing pipeline already has a video path with `storage_retention_opted_in` semantics (route.ts:278–283, `cleanupUploadedStorage`) — that retention logic is designed for the user's **own** uploads and must NOT be reused for non-owned source media.

**Warning sign:** A `video_storage_path` set for a remix/decode row. Any decode response containing a media URL the client renders as a `<video>`. Source frames written to a public bucket. `storage_retention_opted_in` consulted on a remix.

**Prevention:**
- **Derive-and-drop:** if ingestion downloads media to extract signal, delete it in a `finally` (the route already models this pattern with `cleanupRawUpload`/`cleanupUploadedStorage`, route.ts:40–85). Never persist beyond the request.
- Persist only **derived structural fields** (text teardown, repeatable-vs-luck), never frames/MP4.
- For thumbnail/preview, render TikTok's **oEmbed** embed or the existing preview thumbnail — do not rehost.
- Add a schema guard: the remix/decode row type must not have a media-path column; lint/test that no decode write touches `video_storage_path`.
- Keep the Audience frame (which the SPEC retains for the viral video) from triggering a full media download solely to simulate retention — confirm it can run on derived signal.

**Detection:** Storage audit: zero objects whose provenance is a non-owned URL. Grep decode/remix code paths for `storage.from("videos")` writes.

---

## Moderate Pitfalls

### M1. Non-owned URL ingestion failure modes treated as one error
**Group:** Ingestion · **Owning phase:** Phase 1 (spike) → Phase 2 (remix path error states)

**What goes wrong:** An arbitrary pasted URL hits failure classes the current "my own content" flow never sees at volume: **private** video, **region-locked**, **age-gated/login-walled**, **deleted/404**, **photo carousel** (no video track), **vm.tiktok.com** short-link needing resolution, watermark-only frames, and **Apify rate-limit / actor timeout / cost spikes**. `apify-provider.ts` currently throws a bare `Error("No profile data returned…")` (line 33) and `console.warn`s on per-video Zod failure (line 67) — no typed failure taxonomy.

**Warning sign:** Remix mode shows a generic "Analysis failed" for a private video. Apify bill climbs with paste volume. A `vm.` short link 400s the regex (the route allows `vm.` but the scraper may not resolve it). Carousel posts crash frame extraction.

**Prevention:**
- Phase 1 spike must classify each failure and Phase 2 must surface distinct, honest copy: "This video is private / region-locked / removed — can't decode it." Not a red error toast.
- Hard timeout + cost ceiling on the single-URL ingestion call (the existing actor calls use `waitSecs: 60/120`, apify-provider.ts:25/56 — pick an aggressive cap and a per-user rate limit so a paste-spammer can't run up Apify cost).
- Resolve `vm.tiktok.com` short links before scraping; reject photo carousels with a clear "video only" message.
- Reuse the tier rate-limit pattern (route.ts:296–310, the 429 branch) for remix ingestion so abuse is bounded.

**Detection:** Phase 1 artifact has a failure-mode table; Phase 2 has a test per class.

---

### M2. Stale frame state when toggling Score ⇄ Remix on the persistent board
**Group:** One-board-two-config UX · **Owning phase:** Phase 3 (board reconfiguration)

**What goes wrong:** The board mounts independent `useAnalysisStream` instances inside a **persistent** `analyze/layout.tsx` — "none of them remount on `/analyze ↔ /analyze/[id]` nav" (`use-analysis-stream.ts:510–517`). The hook already needed two custom reset triggers (the `newAnalysisSignal` store bump, line 536, and the permalink-leave guard, line 548) precisely because React won't remount these nodes. Adding a *mode swap* (Verdict+Actions → Decode+Adapt) introduces a **new** state-staleness axis the existing reset machinery doesn't cover: toggling to Remix while a completed Score result sits in node state, or Decode/Adapt content surviving a flip back to Score.

**Warning sign:** Toggling to Remix shows the previous Score result's verdict number briefly. Toggling back to Score shows a stale Decode card. Develop-from-concept navigates but the parent's Decode lingers in a sibling frame.

**Prevention:**
- Treat a **mode change as a reset event**: bump `newAnalysisSignal` (or an analogous remix signal) so the existing `wipeToIdle()` (line 518) fires in every instance on toggle — reuse the proven mechanism rather than inventing a parallel one.
- Decode/Adapt nodes must key on `(analysisId, mode)`; a Score-mode permalink must never hydrate a Decode node and vice-versa.
- Gate the toggle while a stream is in flight (`phase === "analyzing"`) — the line-548 guard already protects against wiping an in-flight run; mirror that for mode flips.

**Detection:** Test: complete a Score analysis → toggle to Remix → assert no Verdict/Actions residue; complete a Decode → toggle to Score → assert no Decode residue.

---

### M3. `use-analysis-stream` documented pitfalls (#3/#6/#8) resurface in the Develop flow
**Group:** One-board-two-config UX / Latency · **Owning phase:** Phase 4 (Develop & predict)

**What goes wrong:** Develop reuses the SSE hook, so its known traps re-fire in a new context:
- **Pitfall #3 (auto-open):** initialData with non-null `overall_score` short-circuits to `complete` and never opens a stream (line 123). A concept card that pre-seeds initialData would render "complete" with no score. Conversely, a concept *must* call user-initiated `start()` (line 305) — never auto-open.
- **Pitfall #6 (`analysisId` from `started`):** lineage (`parent_id`, req #5) depends on capturing the child's id from the `event: started` frame (line 167–175). If Develop sets `parent_id` before `started` arrives, the write races.
- **Pitfall #8 (visibility-gated polling):** if a creator develops a concept then backgrounds the tab during the 90–312s run, polling pauses on `document.hidden` (line 433–440) and the 90s ceiling (line 421–430) may fire `error` even though the analysis is still running server-side — more likely with remix's longer tails.

**Warning sign:** Developed concept board sits on "Calculating…" forever (sibling-cache hydration miss, the exact bug the line-450 permalink-replay effect fixes). `parent_id` null on a developed row. "Stream timed out" on a backgrounded long run.

**Prevention:**
- Capture `parent_id` from the source remix analysis id (stable, known before Develop) — do NOT derive it from the child's `started`; write it into the analyze request body so the row is born with lineage.
- Persist `parent_id` server-side in the `analysis_results` INSERT/UPSERT (route.ts:398–481, `buildInsertRow`) — add a `parent_id` column + migration; ensure both the placeholder INSERT (line 579) and the UPSERT (line 685) carry it.
- Re-verify the sibling-cache hydration (`queryClient.setQueryData`, line 251) works for a child board reached via in-app nav from a concept (not a fresh permalink).
- Consider lifting the 90s polling ceiling for remix-developed children, or surface "still running" instead of `error`.

**Detection:** Test lineage: Develop a concept → assert `parent_id` non-null on the child row before `complete`. Background-tab test for the polling ceiling.

---

### M4. Mobile card-stack doesn't absorb the swapped frames
**Group:** One-board-two-config UX · **Owning phase:** Phase 3 (board reconfiguration)

**What goes wrong:** Mobile renders a separate `BoardMobile.tsx` card-stack (SPEC §Background; PROJECT mobile-board-card-view note: "phones render a card stack … auto <768px"). The Konva desktop grid and the mobile stack are two render paths. A frame swap implemented only in the Konva grid leaves mobile showing Verdict+Actions (or empty cards) in Remix mode. The memory note also flags a parallel risk: a frame that *throws* "blocks full-board render" (audience-redesign-v2 history) — a half-wired Decode card can take down the whole mobile stack.

**Warning sign:** Remix board correct on desktop, wrong/empty on mobile. Decode card throws → entire card-stack blank.

**Prevention:**
- Drive both render paths from a **single board-config source** (a `mode → frame list` map) consumed by Konva grid AND `BoardMobile`, so the swap is defined once.
- Wrap each new frame (Decode, Adapt) in an error boundary so one frame's failure degrades to a placeholder, not a blank board.
- Acceptance (SPEC): "on both desktop canvas and mobile card-stack" — test both at <768px and ≥768px.

**Detection:** Mobile viewport test asserting the 6 remix frames render as cards.

---

### M5. Decode hallucinates "why it went viral" / can't separate luck from structure
**Group:** Decode quality · **Owning phase:** Phase 2 (Decode generation)

**What goes wrong:** SPEC req #2 demands an explicit **repeatable-vs-luck** split — the brand's "honest number" ethos applied to virality. A Qwen call given thin signal (esp. if C1 isn't resolved) will confidently invent causal stories ("it went viral because of the pattern interrupt at 0:03") for videos that won on **distribution luck**: existing large audience, a trending sound, algorithmic timing, an outlier comment thread, a duet chain. Attributing luck to structure is the single most damaging decode error — it sends creators to copy noise.

**Warning sign:** Decode always finds a repeatable structure (luck bucket empty). Identical-sounding teardowns across very different videos. No reference to follower count / sound trend / posting timing in the luck split. Decode for a video that went viral purely on creator fame still claims a reproducible hook.

**Prevention:**
- Feed the model the **luck signals it needs to discount**: creator follower count + the video's view multiple vs the creator's baseline (the existing engine concept of baseline/anti-virality; PROJECT "anti_virality_gated"), whether the sound is trending, posting recency. Without these the luck split is fiction.
- Prompt must **require** a non-empty luck column and allow "mostly luck — little to reproduce here" as a valid, honest verdict (matches the Score frame's honest-number stance).
- Calibrate against the SPEC's "known viral test video" acceptance case, and add a deliberately-lucky control video (huge creator, mediocre structure) — Decode should label it luck-dominant.
- Never frame the source as something to "fix" (SPEC req #2 acceptance) — it's a reference, not the user's content.

**Detection:** Eval set of {structure-driven, luck-driven, mixed} videos; assert the luck/structure split moves with the category.

---

### M6. Adapt drifts from format-adaptation into content-copying
**Group:** Legal/IP + Decode quality · **Owning phase:** Phase 3 (Adapt generation)

**What goes wrong:** SPEC req #3 + the spine ("format/structure adaptation, never content copying — 'adapt this format', never 'redo this video'") is a *generation-prompt* discipline, and LLMs default to mimicry. Given a viral cooking video, Adapt for a fitness niche can easily output "make the same recipe but for gym bros" — reproducing the source's specific subject. That's both an off-spec result and the IP risk surfacing at the **concept** layer (the structural-analysis legal defense weakens if the output tells users to recreate the specific video).

**Warning sign:** A concept references the source's specific subject/content (the recipe, the specific product, the exact storyline) rather than its structure (the 3-beat reveal, the question-hook, the before/after frame). Concepts read as "the same video in a different niche."

**Prevention:**
- Adapt prompt consumes the **Decode structural fields only** (hook pattern, pacing, the turn) — NOT the source caption/subject — as input. Structurally prevent content leakage by not passing the source content into Adapt.
- Acceptance gate (SPEC): "none reproduces the source's specific content/subject" — encode as an automated check (concept text must not contain source caption n-grams) plus copy-review.
- Framing in UI copy stays "adapt this format" everywhere; no "redo/recreate this video" affordance.

**Detection:** N-gram overlap test between source caption and generated concepts; manual copy review on the eval set.

---

## Minor Pitfalls

### m1. EventSource / polling churn from multiple node instances during remix
**Group:** Latency/Cost · **Owning phase:** Phase 4

**What goes wrong:** The board mounts several `useAnalysisStream` callers; each can independently open the GET-stream/poll on reconnect (hook lines 261–296, 398–407). In remix mode the longer tails increase reconnect probability; uncoordinated, multiple instances could poll `/api/analysis/[id]` simultaneously. The hook mitigates with a shared TanStack cache key (line 251, 468) — but a new Decode/Adapt node added carelessly could spawn its own poll loop.

**Warning sign:** Network tab shows >1 poller for the same analysis id; duplicate GET-stream connections.
**Prevention:** New Decode/Adapt nodes must read from the shared `queryKeys.analysis.detail(id)` cache, not open their own stream. Only Board's instance owns the transport.
**Detection:** Network assertion in an integration test: one poll loop per analysis id.

---

### m2. Niche-missing path blocks Adapt with no inline recovery
**Group:** Decode quality / UX · **Owning phase:** Phase 3 (Adapt + niche source)

**What goes wrong:** SPEC req #7: Adapt reads niche from `creator_profiles`; if empty, prompt inline. PROJECT confirms `creator_profiles` is read in the route (line 278). If the empty-niche case isn't handled, Adapt either generates generic concepts (niche-blind) or silently fails after Decode already rendered — a dead-end board.

**Warning sign:** Adapt renders concepts not tied to any niche when the profile is empty; or Adapt frame is permanently empty with no prompt.
**Prevention:** Block concept generation behind an inline niche prompt when `creator_profiles.niche` is empty (req #7 acceptance); cache the supplied niche back to the profile. Decode can render first (it doesn't need niche); only Adapt gates on it.
**Detection:** Test both states: populated profile (no prompt) and empty profile (prompt then generate).

---

### m3. Lineage chip / Recent list breaks the permalink-replay assumptions
**Group:** One-board-two-config UX · **Owning phase:** Phase 4 (lineage)

**What goes wrong:** The "remixed from" chip (req #5) links a child board back to its parent (a *remix/decode* analysis, not a normal scored one). The permalink-replay effect (`use-analysis-stream.ts:450–508`) hydrates a board from `/api/analysis/[id]` expecting a scored row (`overall_score != null`). A parent remix/decode row may have **null** `overall_score` (Decode isn't scored — see C2), so navigating to the parent via the chip could leave the board stuck in `idle`/"Calculating…" (the very Pitfall #3 the effect guards against, but it keys on `overall_score`).

**Warning sign:** Clicking "remixed from" lands on a parent board that never leaves "Calculating…". Recent list shows a decode row with no score and a broken card.
**Prevention:** Give remix/decode rows a distinct completion marker (not `overall_score`) so the hydration effect (line 488–500) recognizes a *complete decode* row; or render decode permalinks through a decode-aware loader rather than the score-gated one. Recent-list rows must render decode rows differently from scored rows.
**Detection:** Permalink test: open a decode row directly by URL → asserts it hydrates to its Decode view, not a stuck score board.

---

## Phase-Specific Warnings (roadmap input)

| Suggested Phase | Likely Pitfall(s) | Mitigation summary |
|---|---|---|
| **1 — Ingestion spike (req #8, HARD GATE)** | C1, M1, C4 (design) | Document exact signal per non-owned URL across ≥5 failure classes; classify failures; design derive-and-drop. **No Decode work starts until this artifact lands.** |
| **2 — Remix path + Decode generation** | C2, M5, C4 | Decode = own lightweight Qwen path (not the scoring pipeline), off `usage_tracking`; force a non-empty luck split with luck signals fed in; persist derived fields only. |
| **3 — Board reconfiguration + Adapt** | M2, M4, M6, m2 | Single `mode→frames` config drives Konva + mobile; mode-change = reset signal; Adapt consumes structural fields only; inline niche prompt. |
| **4 — Develop & predict + lineage** | C3, M3, m1, m3 | Click-gated single-concept develop; `parent_id` from source id (not child `started`) + migration; reuse shared cache; decode-aware permalink hydration. |

---

## Confidence Assessment

| Pitfall area | Confidence | Basis |
|---|---|---|
| Ingestion (C1, M1) | HIGH that the route doesn't ingest video; MEDIUM on what the pipeline does (could not open `src/lib/engine`) | `route.ts` + `apify-provider.ts` read directly; pipeline body unseen → this IS req #8 |
| Legal/IP (C4, M6) | MEDIUM | General IP/ToS reasoning + SPEC out-of-scope; existing storage-cleanup pattern verified in `route.ts` |
| Latency/Cost (C2, C3, m1) | HIGH | 90–312s figure in PROJECT + SPEC; pipeline cost shape + `usage_tracking`/`DAILY_LIMITS` verified in `route.ts`; bulk-scoring explicitly out-of-scope in SPEC |
| One-board-two-config UX (M2, M3, M4, m3) | HIGH | All grounded in `use-analysis-stream.ts` documented pitfalls #3/#6/#8 + reset machinery (lines 123, 167, 433, 510–558) + PROJECT mobile/throw notes |
| Decode quality (M5, M6) | MEDIUM | SPEC reqs #2/#3 + general virality-attribution reasoning; depends on C1 outcome |

## Gaps to address (need phase-specific research)

- **Exact pipeline ingestion behavior for `tiktok_url`** — could not enumerate `src/lib/engine/`; Phase 1 must open `runPredictionPipeline` and trace the `tiktok_url` branch. This is the single biggest unknown.
- **Whether a single-URL Apify (or other) fetch path exists** anywhere outside the handle-based `apify-provider.ts`. If not, ingestion remediation is a build, not a config.
- **`analysis_results` schema** — confirm a `parent_id` column / migration is needed (none seen in `buildInsertRow`).
- **TikTok oEmbed / preview** path the input already uses (`tiktok-url-input.tsx`, referenced in SPEC but not read) — confirm it's metadata-only and reusable for the non-rehosting thumbnail.

## Sources

- `src/app/api/analyze/route.ts` (read in full, 807 lines) — URL validation, pipeline invocation, `usage_tracking`/`DAILY_LIMITS`, cache, storage cleanup, `buildInsertRow`, placeholder-INSERT/UPSERT.
- `src/hooks/queries/use-analysis-stream.ts` (read in full, 589 lines) — documented Pitfalls #3/#6/#8, reset machinery, persistent-layout multi-instance hydration, polling ceiling/visibility gate.
- `src/lib/scraping/apify-provider.ts` (read in full) — handle-based scrape, no single-URL video fetch, bare error handling.
- `.planning/milestones/viral-remix-SPEC.md` — 8 reqs, boundaries, constraints, ambiguity report (Constraint Clarity 0.62).
- `.planning/PROJECT.md` — 90–312s latency, mobile card-stack, anti-virality/baseline concepts, milestone framing.
- General domain knowledge (MEDIUM): TikTok non-owned-URL ingestion failure classes + transformative-use/IP reasoning — not Context7-verifiable.
