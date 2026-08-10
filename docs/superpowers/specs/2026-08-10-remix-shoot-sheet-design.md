# Remix Shoot Sheet — design

**Date:** 2026-08-10
**Lane:** `lane/remix-shoot-sheet` · worktree `~/virtuna-remix-shoot-sheet`
**Base:** branched from `feat/apify-first-sourcing`, merged up to `origin/main` (`a8ccfbf4`)
**Status:** design approved in session, reviewed once against the code, not implemented

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
| D4 | **Simulation's job is ranking, never an absolute verdict.** Ordering survives a weak model; calibration does not (see §8). |
| D5 | **In-chat editing must not re-run the pipeline.** Revision rewrites from the stored blueprint. One LLM call, no re-resolve, no re-Omni, no re-scrape. |
| D6 | **The shoot sheet carries frames AND 2–4s muted clips per beat**, not stills alone. |
| D7 | **`derive-and-drop` is amended** to permit those clips. See §5.4 — a deliberate policy reversal with test coverage to rewrite. |
| D8 | **D-01's content-leak guard is reversed** for the wording lane. See §7. |
| D9 | **Blueprints persist in their own table**, not inline on the block. See §5.2. |
| D10 | **Raw segments merge to at most 8 beats** before adapt sees them. One adapt call, unchanged timeout. See §5.1. |

### Two prior owner decisions this lane overrules

Both were surfaced explicitly and overruled with the tradeoff visible.

**`D-01` — the adapt content-leak guard.** `decode-types.ts:155` describes `AdaptInput` as a
"structural content-leak guard": adapt is prevented *at compile time* from seeing the source's
actual content, so it can only borrow format. D2 requires adapt to see `spoken_text`. The
guard's purpose (don't copy their topic) is preserved by other means — see §7.

**`derive-and-drop` / `T-03-02`.** `resolve-and-rehost.ts:66`: *"NEVER sets
video_storage_path (derive-and-drop — source media is not owned)."* A re-hosted TikTok is
deleted unconditionally in a `finally`; retention is permitted only for *owner-signable* media
(the user's own upload). D6/D7 amend this. See §5.4.

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
│ ▓▓▓░░░░▓▓░░░░░░▓▓▓   beat strip · tap to jump          │
├──────────────┬─────────────────────────────────────────┤
│ ▶ clip 0.0s  │ 0.0–1.8s · HOOK                         │
│   (2s, muted)│ THEY: tight crop, hard cut in, text     │
│              │   top-third, no greeting                │
│              │ YOU: "Your creatine is doing nothing."  │
│              │   ~1.7s to say                          │
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
5  SHOOT SHEET        per-beat clip + their move + your line + your shot
                                  ↓
6  EDIT               "beat 3 is too soft" → revise_remix
                      rewrites that beat from the stored blueprint · no re-run
                                  ↓
7  SHOOT              the sheet is what goes to the phone
```

---

## 5. Architecture

### 5.1 `SourceBlueprint` — new type, deterministic, no LLM call

Assembled in plain TypeScript from `omni.segments` + `emotion_arc` + `factors`. **No model
call, no new spend.** New module: `src/lib/engine/remix/blueprint.ts`.

```ts
interface BlueprintBeat {
  index: number
  t_start: number
  t_end: number
  duration_s: number
  role: "hook" | "setup" | "turn" | "payoff" | "close"
  spoken: string | null          // verbatim source speech, joined across merged segments
  on_screen_text: string | null
  visual_event: string           // joined across merged segments
  audio_event: string
  cuts: number                   // how many raw segment boundaries this beat absorbed
  /** Populated when factors[] scores this beat weak — drives the repair line. */
  weakness: { factor: string; score: number; tip: string } | null
}

interface SourceBlueprint {
  duration_s: number
  words_per_second: number       // source speech rate — the matching target, see §5.3
  has_speech: boolean            // false on slideshow / silent sources, see below
  beats: BlueprintBeat[]         // 1..8
}
```

#### D10 — merge raw segments to at most 8 beats

`normalize-segments.ts` sets `MIN_CELL_WIDTH_S = 1` and imposes **no upper bound on segment
count**. A 30s video can produce 20+ one-second cells. Handing those to adapt un-merged is
what would have broken the call (see §5.3).

Assembly merges adjacent segments into **at most 8 role-coherent beats**, preferring
boundaries where `scene_boundary_reason` is present and role changes. 8 beats is also closer
to how a creator thinks about a shoot than 20 one-second cells, so this is a legibility win
as well as a budget one.

**Clips and frames follow the merged beats, not the raw cells** — which also caps clip count
at 8 per source.

#### Role derivation (deterministic, no model)

Applied in this order; **first match wins**, which resolves the overlap noted below:

1. `is_hook_zone === true` → `hook`
2. beat containing the `emotion_arc` peak → `turn`
3. final beat → `close`
4. beats before the turn → `setup`; beats after → `payoff`

⚠️ **The precedence matters.** `is_hook_zone` is not a model judgment —
`normalize-segments.ts:272` sets it mechanically as `t_start < HOOK_ZONE_END_S` (3s). On a
short video the `emotion_arc` peak frequently *also* falls inside the first 3s, so a beat can
qualify as both. Hook wins.

**Why assembly is safe:** `analyzeVideoWithOmni` runs `normalizeSegments` after the Zod parse,
before returning (`omni-analysis.ts:260`), and that normalizer **always returns a non-empty
grid with `is_hook_zone` and `idx` set on every segment**, including when the model returned
no segments at all. The blueprint always has at least one beat.

#### No-speech and slideshow sources

Omni nulls speech-derived fields on silent and slideshow content (F46 — a no-speech video's
null verbatim is *correct*, not drift). Those sources produce `spoken: null` on every beat, and
speech-rate matching is meaningless.

`has_speech: false` switches the sheet to **on-screen-text-driven**: the adapted line is
written as overlay text rather than a spoken line, and the matching target becomes beat
duration alone. The sheet must not print an empty "YOU SAY" row on a silent source.

### 5.2 Persistence — `remix_blueprints`

D9. The blueprint, the adapted script and the clip URIs live in their own table, **not inline
on the block**. `RemixCardBlockSchema` is validated on every render and its blocks are
persisted into thread messages; carrying 3 × 8 beats of nested JSON inline would bloat every
message row, and inline storage gives clip dedupe no key to work with.

```
remix_blueprints
  id              uuid pk
  user_id         uuid            -- RLS scope
  thread_id       uuid            -- retention key (clips die with the thread)
  source_video_id text            -- CLIP DEDUPE KEY, see §5.4
  blueprint       jsonb
  script          jsonb           -- the adapted beats, per variant
  clip_uris       jsonb
  created_at      timestamptz
```

`RemixCardBlockSchema` gains exactly one optional field: `blueprintId?: string`. Blocks
persisted before this lane have no id, render exactly as they do today, and simply offer no
sheet. No back-compat break.

⚠️ **Migration safety.** `supabase db push` is unsafe in this project (ledger drift) — apply
this migration as a single statement via the SQL editor. RLS must be **on with a policy**;
a table with RLS on and no policies reads as empty through the caller's client, and a
swallowed write stores nothing without complaining. Read the real constraints back before
writing the first row.

### 5.3 Adapt rewrite

`AdaptInput` gains two fields and **keeps `niche`**:

```ts
interface AdaptInput {
  // …existing six, including `niche` — unchanged, still the fallback
  blueprint: SourceBlueprint
  /** D3 — the brief. When non-empty this is the adaptation target and `niche` is ignored. */
  target: string | null
}
```

`niche` is not removed: `POST /api/remix/adapt` is a separate live surface that supplies it
and knows nothing about briefs, so the field has to keep working. The runner passes
`target = brief ?? null`, and the prompt is instructed to use `target` when present and fall
back to `niche` when it is null.

`ADAPT_SYSTEM_PROMPT` changes from *"generate 3 concepts"* to **"fill every beat"**:

- one output line per blueprint beat (≤8)
- **match the beat's DURATION, not its word count** — the creator's line should take about as
  long to say as the source's did, computed against `words_per_second`. Word-count matching
  would assume the creator speaks at the source's rate; duration is what actually makes a shot
  reproducible.
- same cut rhythm and beat count
- a shot instruction per beat, derived from `visual_event`
- where `weakness != null`, **repair it and say so** rather than replicating it

`AdaptConcept` gains `script: AdaptedBeat[]`. Existing fields (`hook`, `angle`, `who_its_for`,
`format_borrowed`, `production`, `personaStops`, `stopQuote`) are **kept unchanged** so blocks
persisted before this lane keep rendering.

**Output budget.** Today: 3 concepts × ~7 short fields ≈ 21 generated strings. After D10:
3 concepts × ≤8 beats × 3 fields ≈ 72 worst case. That fits the existing `TIMEOUT_MS = 90_000`
and `MAX_RETRIES = 1` without change. **Without D10 this would have been ~180 strings** — a
truncated JSON body, a failed Zod parse, and a graceful `adapt_failed` on most real videos.
Any future change that raises the beat cap must revisit the timeout in the same commit.

### 5.4 Clip pipeline + the policy amendment

**Two constraints the codebase imposes — not choices:**

1. **ffmpeg cannot run in the remix runner.** `next.config.ts` marks `ffmpeg-static` external;
   it is isolated behind `/api/filmstrip/extract` (Pitfall 1). Trimming needs its own route.
2. **It cannot be inline.** Remix already measures ~240s against `maxDuration = 300`. Eight
   trims would blow the budget. Follows the filmstrip precedent: fire-and-forget, sheet
   renders with text immediately, clips fill in as they land.

**New route:** `POST /api/remix/clips` — modelled directly on `/api/filmstrip/extract`
(bearer-token gate, Zod body validation with a beat cap, SSRF deny-list, `maxDuration=300`,
`runtime="nodejs"`).

**Clips are deduplicated by source video.** `/feed` serves ~520 curated rows to *every* user,
so the same videos are remixed repeatedly. Trimming per run would pay ffmpeg and storage N
times for one video. The route checks `source_video_id` first and reuses existing clips when
the beat boundaries match; only a cache miss trims. This is the difference between clip
storage growing with *remix runs* and growing with *distinct source videos*.

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
is untouched. Clips live in their own bucket, referenced from `remix_blueprints.clip_uris`.

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

### 5.5 Pre-brief

`use-remix-launch.ts` opens a brief sheet before the POST rather than firing immediately.
`RemixRunRequestSchema` gains `brief: z.string().max(200).optional()`. In the runner, `brief`
present → `AdaptInput.target`; absent → `target: null` and today's `audienceNiche` behaviour
via `niche`.

### 5.6 Ranking and presentation

**Mostly already built, and the first draft of this spec got it wrong.**
`remix-runner.ts:295-318` already rates every concept via `coercePersonaStops`, sorts
descending by `stops` with generation order as tie-break, and emits **all three** blocks
ranked best-first.

Also worth recording, because it contradicts the card's own `model: "sim1-flash"` label:
**there is no Flash SIM on this path.** `personaStops` is the *adapt call's own self-estimate*,
carried as `provenance: "projected"`. The measured simulation is a separate, user-fired action.

So D4 is a **presentation** change, not an engine change: three separate cards become one
ranked shoot decision, and the absolute `band`/`fraction` framing comes off the face in favour
of ordering.

### 5.7 `revise_remix`

New chat-agent tool alongside `request_input` / `search_corpus`. Loads the `remix_blueprints`
row by `blueprintId`, rewrites the targeted beat(s), writes `script` back. One LLM call. Never
re-resolves, re-Omnis or re-scrapes — the source mp4 is gone by then, and that is the point.

---

## 6. Fixes bundled into this lane

Both sit inside the flow this lane owns; shipping without them ships a front-door surface with
a known-wrong number on it.

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

Standard coverage aside, three tests exist because of specific known failure modes here.

**The echo test (guards the D-01 reversal).** Handing a model the source's words invites
paraphrase — and this codebase has already been bitten: a few-shot example drawn from the test
video came back verbatim and read as a perfect decode.

Implementation: **stopword-list approximation, not POS tagging.** There is no NLP dependency in
`package.json` and this test must not add one. Lowercase, strip a stopword list, and assert
that **no adapted beat shares more than one remaining token** with the source beat it was
written against — excluding tokens that appear in the brief itself, which the creator asked
for. Structural echo (duration, cadence, beat count) passes. Topical echo fails.

**Live-run verification, not mocks.** Per project convention and repeated experience here: a
green suite built on mocks of our own code proves nothing. Blueprint assembly must be verified
against a **real** omni response, and the clip pipeline against a **real** trim. A mock
provider has no timing to get wrong.

**Wrong-shape tolerance.** Known live-decode traps apply: models return `structure` as a list
where an object is expected, and TikTok serves subtitles in two formats. Blueprint assembly
must degrade to an honest partial rather than throwing.

---

## 8. Accepted risks

| Risk | Owner's position |
|---|---|
| **Retaining fragments of third-party video.** Raised twice, including once with the enforced-policy finding in hand. Ruled: clips are worth it. Mitigations kept: ≤4s, muted, source mp4 still deleted, clips die with the thread, ≤8 per source. |
| **A faithful clone reading as a rip.** The echo test is the mechanical guard; it cannot catch everything. |
| **Storage cost.** Bounded by D10 (≤8 clips) and by dedupe on `source_video_id` — storage grows with distinct source videos, not with remix runs. |
| **The ranking signal is a self-estimate**, not a measurement, and `reconciliations` is still 0 rows — nothing has ever been checked against a real outcome. This is why D4 forbids an absolute verdict: ordering needs no calibration. |
| **Merging to 8 beats loses cut-level detail** on densely edited sources. `cuts` is carried per beat so the sheet can still say "3 cuts inside this beat" without generating a line for each. |

---

## 9. Out of scope

- No new surfaces. `/feed`, `/home`, `/start` untouched.
- No auth-redirect, funnel-event or sidebar changes.
- **No sourcing changes.** The curated-corpus-first call from 2026-08-07 stands. §6 changes
  how the multiplier is *computed and labelled* on tiles that already exist — it does not
  change what is scraped, when, or from where.
- No `DecodeResult` schema change; `/api/remix/adapt` keeps its current contract.
- The measured simulation ("See the room →") is not touched.

---

## 10. Phasing

| Phase | Content | Ships alone? |
|---|---|---|
| **1** | `SourceBlueprint` + merge-to-8 + `remix_blueprints` + adapt rewrite + echo test + **minimal text renderer** (timed beats as rows on the existing remix-card) | **Yes** |
| **2** | Pre-brief (D3) + the two fixes (§6) | Yes |
| **3** | Frames on the beat rows (no policy change) | Yes |
| **4** | Policy amendment + trim route + clips + dedupe + retention | Yes — the only phase carrying the D7 reversal |
| **5** | `revise_remix` | Yes |

**Phase 1 carries a minimal renderer on purpose.** Without it, phase 1 generates a timed script
into a void — nothing renders `script` until the sheet exists, so "ships alone" would be false.
The text rows are enough to judge whether the fidelity fix actually works, which is the
decision phase 1 exists to inform: it costs no additional model spend, and if the remix still
doesn't feel like a cheatcode, phase 4's policy reversal never has to be paid for.
