# Remix Shoot Sheet — design

**Date:** 2026-08-10
**Lane:** `lane/remix-shoot-sheet` · worktree `~/virtuna-remix-shoot-sheet`
**Base:** branched from `feat/apify-first-sourcing`, merged up to `origin/main` (`a8ccfbf4`)
**Status:** design approved in session, not implemented

---

## 1. Why this lane exists

The owner's framing: the highest-value workflow in Maven is **find an outlier → remix it
faithfully → post**. "Copy what's already working, in minutes." Everything else is
customisation around that spine.

Investigation found that **the spine is already built end to end**:

```
/feed (curated corpus + live-pull tab)
  → outlier tile, coral "Remix → Read" CTA   (outlier-tile.tsx:21)
  → useRemixLaunch                            (use-remix-launch.ts)
  → POST /api/tools/remix/run                 (SSE, billed, thread-persisted)
  → remix-card blocks in the open thread at /home
```

Nothing about the *path* needs building. The problem is that **the artifact at the end of it
is not worth the trip**: it is three text concepts, not a reproducible copy of a proven video.

### The finding that sets this lane's cost

`analyzeVideoWithOmni` — which already runs on every remix — **already returns everything
needed for a faithful, shot-by-shot copy**, and all of it is discarded before the adapt call
ever sees it.

Per segment (`omni-analysis.ts:197-207`):

| field | what it gives us |
|---|---|
| `t_start`, `t_end` | the real timeline — shot durations, pacing |
| `visual_event` | what the shot shows, how it's framed |
| `audio_event` | the sound/speech change at this boundary |
| `scene_boundary_reason` | why this is a cut |
| `spoken_text` | **verbatim source speech in this segment** |
| `on_screen_text` | **verbatim overlay text in this segment** |

Plus `hook_verbatim.{spoken_words, on_screen_text}`, `emotion_arc[]` (3–8 points,
`timestamp_ms` + `intensity_0_1`), and `factors[]` (`name`, `score`, `rationale`,
`improvement_tip?`).

**Where it dies.** Two deliberate collapse points:

1. `runDecode(structural)` → `DecodeResult` — 4 prose beats + `repeatable: string[]` + `luck[]`.
   Every timestamp, every spoken word, every shot description is gone.
2. `decodeResultToAdaptInput(decode, niche)` → `AdaptInput` — six strings.

`generateAdaptConcepts` writes the creator's version from those six strings. It has never seen
a timestamp, a cut, or a word the source actually said.

**Consequence for this lane's cost:** fidelity is a *contract widening*, not new
infrastructure, and it adds **zero model spend**. The expensive call already happens; we are
currently paying for perception we throw away.

---

## 2. Decisions taken (owner rulings, this session)

| # | Decision |
|---|---|
| D1 | **Scope: fix the artifact, move no surfaces.** `/feed` and `/home` untouched. No start page. No route redirects. Prominence is re-judged *after* the remix is good — promoting a weak one only exposes it. |
| D2 | **Fidelity covers structure, wording, style AND recording.** The owner was offered a narrower structure-only fidelity and explicitly rejected it. |
| D3 | **Pre-brief: one optional free-text line**, skippable. Empty = today's behaviour. Present = **it replaces the profile niche as the adaptation target**, not augments it. Cross-niche transfer is the case it exists for. |
| D4 | **Simulation's job is ranking, never an absolute verdict.** Ordering survives a weak model; calibration does not (see §7). |
| D5 | **In-chat editing must not re-run the pipeline.** Revision rewrites from the cached decode + blueprint. One LLM call, no re-resolve, no re-Omni, no re-scrape. |
| D6 | **The shoot sheet carries frames AND 2–4s muted clips per shot**, not stills alone. |
| D7 | **`derive-and-drop` is amended** to permit those clips. See §5.3 — this is a deliberate policy reversal with test coverage to rewrite. |
| D8 | **D-01's content-leak guard is reversed** for the wording lane. See §7. |

### Two prior owner decisions this lane overrules

Both were surfaced explicitly and overruled with the tradeoff visible.

**`D-01` — the adapt content-leak guard.** `decode-types.ts:155` describes `AdaptInput` as a
"structural content-leak guard": adapt is prevented *at compile time* from seeing the source's
actual content, so it can only borrow format. D2 requires adapt to see `spoken_text`. The
guard's purpose (don't copy their topic) is preserved by other means — see §7.

**`derive-and-drop` / `T-03-02`.** `resolve-and-rehost.ts:66`: *"NEVER sets
video_storage_path (derive-and-drop — source media is not owned)."* A re-hosted TikTok is
deleted unconditionally in a `finally`; retention is permitted only for *owner-signable* media
(the user's own upload). D6/D7 amend this. See §5.3.

### One prior decision this lane is consistent with

`docs/DECISION-outlier-corpus-2026-08-07.md` — outliers are a curated, shared, structural
library, not a per-user niche scrape, specifically to keep the Apify free-plan cap off the
front door's critical path. This lane does not touch sourcing, and its logic reinforces that
call: if a remix is a genuine structural clone, the source need not be in the creator's niche,
so niche belongs to *adaptation* (the brief, D3), never to *selection*.

---

## 3. What the creator gets — the shoot sheet

The artifact replaces "three concept cards" as the thing a remix produces.

```
┌────────────────────────────────────────────────────────┐
│ @creator · 2.1M views · 6.2× their usual    ▶ original ↗│
│ Your version: creatine timing                          │
├────────────────────────────────────────────────────────┤
│ ▓▓▓░░░░▓▓░░░░░░▓▓▓   shot strip · tap to jump          │
├──────────────┬─────────────────────────────────────────┤
│ ▶ clip 0.0s  │ 0.0–1.8s · HOOK                         │
│   (2s, muted)│ THEY: tight crop, hard cut in, text     │
│              │   top-third, no greeting                │
│              │ YOU: "Your creatine is doing nothing."  │
│              │   6 words · ~1.7s                       │
│              │ SHOT: waist-up, phone at chest, same    │
│              │   text position                         │
├──────────────┼─────────────────────────────────────────┤
│ ▶ clip 1.8s  │ 1.8–5.4s · SETUP                        │
│              │ ⚠ source is weak here (pacing 4/10) —   │
│              │   yours cuts 1.2s earlier               │
│              │ YOU: "I tested 40 lifters for 6 weeks." │
└──────────────┴─────────────────────────────────────────┘
```

**"Optimized", not just copied.** `factors[]` already carries `score` and `improvement_tip`
per factor. Where the source is measurably weak, the creator's version **repairs** rather than
replicates, and the sheet says so. This is the difference between a clone and an optimised
clone, and the data for it is already fetched.

---

## 4. The complete flow

```
1  /feed              curated grid, correct multiplier · tap Remix
                                  ↓
2  BRIEF              source thumb + stats
                      "make it about…"  (optional · skippable)
                                  ↓
3  RUN ~240s          Resolving → Perceiving → Blueprinting
                      → Writing your version → Ranking
                      clips stream in as they trim
                                  ↓
4  RANK               3 variants ordered · "Shoot this one."
                                  ↓
5  SHOOT SHEET        per-shot clip + their move + your line + your shot
                                  ↓
6  EDIT               "shot 3 is too soft" → revise_remix
                      rewrites that slot from cache · no re-run
                                  ↓
7  SHOOT              the sheet is what goes to the phone
```

---

## 5. Architecture

### 5.1 `SourceBlueprint` — new type, deterministic, no LLM call

Assembled in plain TypeScript from `omni.segments` + `emotion_arc` + `factors`. **No model
call, no new spend.** New module: `src/lib/engine/remix/blueprint.ts`.

```ts
interface BlueprintSlot {
  index: number
  t_start: number
  t_end: number
  role: "hook" | "setup" | "turn" | "payoff" | "close"
  spoken: string | null          // verbatim source speech
  word_count: number
  on_screen_text: string | null
  visual_event: string
  audio_event: string
  /** Populated when factors[] scores this beat weak — drives the repair line. */
  weakness: { factor: string; score: number; tip: string } | null
}

interface SourceBlueprint {
  duration_s: number
  words_per_second: number
  slots: BlueprintSlot[]
}
```

`role` derivation (deterministic, no model):
- `is_hook_zone === true` → `hook`
- slot containing the `emotion_arc` peak → `turn`
- final slot → `close`
- remaining slots split `setup` (before turn) / `payoff` (after turn)

⚠️ **`is_hook_zone` is not a model judgment.** `normalize-segments.ts:272` sets it
mechanically as `t_start < HOOK_ZONE_END_S` (3s). Treat it as "the first 3 seconds", not as
"where the model thinks the hook is" — the naming invites the wrong reading.

**Why blueprint assembly is safe:** `analyzeVideoWithOmni` runs `normalizeSegments` after the
Zod parse, before returning (`omni-analysis.ts:260`), and that normalizer **always returns a
non-empty grid with `is_hook_zone` and `idx` set on every segment**, including when the model
returned no segments at all. So the blueprint always has at least one slot to build from.

**`DecodeResult` is untouched.** It is persisted to `variants.remix.decode`, carries
invariants (`D-06`: exactly 4 beats, fixed order), and is consumed independently by
`POST /api/remix/adapt`. The blueprint rides **alongside** it into `AdaptInput`.

### 5.2 Adapt rewrite

`AdaptInput` gains two fields:

```ts
interface AdaptInput {
  // …existing six
  blueprint: SourceBlueprint
  /** D3 — the brief. Replaces `niche` as the adaptation target when present. */
  target: string
}
```

`ADAPT_SYSTEM_PROMPT` changes from *"generate 3 concepts"* to **"fill every slot"**:

- one output line per blueprint slot
- matched word count, ±20% of the source slot
- same cut rhythm and slot count
- a shot instruction per slot, derived from `visual_event`
- where `weakness != null`, **repair it and say so** rather than replicating it

`AdaptConcept` gains `script: AdaptedSlot[]`. Existing fields (`hook`, `angle`,
`who_its_for`, `format_borrowed`, `production`, `personaStops`, `stopQuote`) are **kept
unchanged** so blocks persisted before this lane keep rendering.

### 5.3 Clip pipeline + the policy amendment

**Two constraints the codebase imposes — not choices:**

1. **ffmpeg cannot run in the remix runner.** `next.config.ts` marks `ffmpeg-static` external;
   it is isolated behind `/api/filmstrip/extract` (Pitfall 1). Trimming needs its own route.
2. **It cannot be inline.** Remix already measures ~240s against `maxDuration = 300`. Ten
   trims would blow the budget. Follows the filmstrip precedent: fire-and-forget, sheet
   renders with text immediately, clips fill in as they land.

**New route:** `POST /api/remix/clips` — modelled directly on `/api/filmstrip/extract`
(bearer-token gate, Zod body validation with a segment cap, SSRF deny-list, `maxDuration=300`,
`runtime="nodejs"`).

**The lifecycle race, and its fix.** `runRemixPipeline` deletes the source mp4 in a `finally`
(T-03-02). A fire-and-forget trim route still needs that file. Fix: **move lifecycle
ownership.** The trim route downloads, trims, uploads, then deletes the source. The runner's
`finally` fires only when the trim route was never successfully reached. The full source mp4
still never persists.

**The amendment.** `derive-and-drop` currently reads: *source media is not owned.* It becomes:

> The source **video** is not owned and is never retained. Muted fragments of **≤4s**,
> derived for shot-reproduction analysis, are derived artifacts and may be retained on the
> thread that produced them.

`video_storage_path` is **still never set** for a scraped source — that part of the invariant
is untouched. Clips live in their own bucket under their own column.

**Retention:** clips are deleted with the thread that owns them.

**Tests to rewrite** (they encode the current line and will fail by design):
- `src/app/api/analyze/__tests__/derive-and-drop.test.ts`
- `src/app/api/analyze/__tests__/decode-route.test.ts` (C4 block)
- `src/lib/engine/__tests__/tiktok-url-branch.test.ts`

Each gets a case asserting the **new** line: source mp4 removed, clips retained, no
`video_storage_path`.

**Frames** need no policy work at all — `extractFrameAtTimestamp` +
`uploadFrameAndGetSignedUrl` already persist `keyframe_uri` today, and take exactly the
segment shape omni produces.

### 5.4 Pre-brief

`use-remix-launch.ts` opens a brief sheet before the POST rather than firing immediately.
`RemixRunRequestSchema` gains `brief: z.string().max(200).optional()`. In the runner,
`brief` present → it becomes `AdaptInput.target`; absent → today's `audienceNiche`.

### 5.5 Ranking and presentation

**Mostly already built, and the earlier read of this was wrong.** `remix-runner.ts:295-318`
already rates every concept via `coercePersonaStops`, sorts descending by `stops` with
generation order as tie-break, and emits **all three** blocks ranked best-first.

Also worth recording, because it contradicts the card's own `model: "sim1-flash"` label:
**there is no Flash SIM on this path.** `personaStops` is the *adapt call's own self-estimate*,
carried as `provenance: "projected"`. The measured simulation is a separate, user-fired action.

So D4 is a **presentation** change, not an engine change: three separate cards become one
ranked shoot decision, and the absolute `band`/`fraction` framing comes off the face in favour
of ordering.

### 5.6 `revise_remix`

New chat-agent tool alongside `request_input` / `search_corpus`. Reads the persisted decode +
blueprint from the card, rewrites the targeted slot(s), writes back. One LLM call. Never
re-resolves, re-Omnis or re-scrapes — the source is gone by then, and that is the point.

---

## 6. Fixes bundled into this lane

Both are one-liners in the flow this lane owns; shipping the lane without them ships a
front-door surface with a known-wrong number on it.

- **The multiplier.** `/api/discover` and `/api/tools/explore` still call `rankOutliers`, whose
  baseline is the median of the returned set — the same video prints 1.4× or 28.4× purely from
  `resultsPerPage`. `src/lib/discover/author-baseline.ts` already implements the per-author
  denominator. Switch the call sites. **The label must change with the basis** — it is
  `"vs their lifetime average"`, never the corpus's `"vs their usual views"`.
- **`useRemixLaunch` swallows HTTP errors.** `use-remix-launch.ts:33` never checks `res.ok`,
  and `fetch` does not throw on HTTP status. A 402 credit refusal or a 401 navigates the user
  to `/home` with no card and no message — it reads as the product being broken. `pendingId`
  also never clears on success.

---

## 7. Testing

Standard coverage aside, three tests exist because of specific known failure modes in this
codebase.

**The echo test (guards the D-01 reversal).** Handing a model the source's words invites
paraphrase — and this codebase has already been bitten: a few-shot example drawn from the test
video came back verbatim and read as a perfect decode. Assert that **no adapted slot shares
more than one content noun** with the source slot it was written against
(`blueprint.slots[].spoken`), stopwords and the brief's own terms excluded. Structural echo
(word count, cadence, slot count) passes. Topical echo fails.

**Live-run verification, not mocks.** Per project convention and repeated experience here: a
green suite built on mocks of our own code proves nothing. The blueprint assembly must be
verified against a **real** omni response, and the clip pipeline against a **real** trim. A
mock provider has no timing to get wrong.

**Wrong-shape tolerance.** Known live-decode traps apply: models return `structure` as a list
where an object is expected, and TikTok serves subtitles in two formats. Blueprint assembly
must degrade to an honest partial rather than throwing.

---

## 8. Accepted risks

| Risk | Owner's position |
|---|---|
| **Retaining fragments of third-party video.** Raised twice, including once with the enforced-policy finding in hand. Ruled: clips are worth it. Mitigations kept: ≤4s, muted, source mp4 still deleted, clips die with the thread. |
| **A faithful clone reading as a rip.** The echo test is the mechanical guard; it cannot catch everything. |
| **Storage cost** of ~10 clips per remix run, unbounded until retention lands. Retention is in scope, not deferred. |
| **The ranking signal is a self-estimate**, not a measurement, and `reconciliations` is still 0 rows — nothing has ever been checked against a real outcome. This is why D4 forbids an absolute verdict: ordering needs no calibration. |

---

## 9. Out of scope

- No new surfaces. `/feed`, `/home`, `/start` untouched.
- No auth-redirect, funnel-event or sidebar changes.
- No sourcing changes — the curated-corpus-first call from 2026-08-07 stands.
- No `DecodeResult` schema change; `/api/remix/adapt` keeps its current contract.
- The measured simulation ("See the room →") is not touched.

---

## 10. Phasing

| Phase | Content | Ships on its own? |
|---|---|---|
| **1** | `SourceBlueprint` + adapt rewrite + echo test | Yes — text fidelity alone is the largest single value step |
| **2** | Pre-brief (D3) + the two fixes (§6) | Yes |
| **3** | Frames on the shoot sheet (no policy change) | Yes |
| **4** | Policy amendment + trim route + clips + retention | Yes — the only phase carrying the D7 reversal |
| **5** | `revise_remix` | Yes |

Phase 1 is deliberately first: it is the change that decides whether any of the rest is worth
building, and it costs no additional model spend.
