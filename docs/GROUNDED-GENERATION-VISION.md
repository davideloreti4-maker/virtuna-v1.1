# Grounded Generation — Design Brief (working, not locked)

**Status:** brainstorm captured 2026-07-09. This is *thinking*, not a build plan. Decisions marked
**[LOCKED]** are ones the owner has committed to; everything else is open for refinement.

---

## 0. The gap

Today every creator-facing generation (ideas / hooks / topics / scripts / remix) runs **cold** —
static craft prose (KC) + the creator's profile. Nothing is derived from real videos that actually
worked. No social proof, no receipts. Verified in code: generation and the real-video data never
touch (grep-confirmed).

The fix is not "add a big corpus." It's to **ground every generation in real, proven, outlier videos
and show the receipt** — and to make the doing of that work *felt*.

---

## 1. The doctrine — why this wins

**The feeling = real work + real proof + made for me.** Miss any one → it collapses to "nice AI tool."

- **Real work** — the user *sees* the machine do things no human could do that fast: scan 30 top
  performers, find the outliers, tear down a 290× video, test their version on a synthetic crowd.
- **Real proof** — every card carries its receipt: `@handle · multiplier · the actual video`. Never a
  claim without a source.
- **Made for me** — grounded in the user's voice, judged by *their* audience, not a generic crowd.

**Counterintuitive core:** *speed would hurt this.* Instant = generic = ChatGPT. The **earned wait**,
where you watch real work happen, is what signals "expensive, real, mine." We don't hide the work —
we **sell** it. Streaming is the value story, not a latency patch.

**Guardrail (non-negotiable):** the theater only works because the work is *real*. Fake a progress
line, fabricate a number, or dress a generic template as "proof" → users smell it and the magic
inverts into distrust. The show is *earned* by genuine substance underneath. This is also why the
existing **honesty spine** (never show a card without a real audience reaction; never fabricate a
band) is kept.

**The thesis in one line:** *make the invisible work visible, and only ever show work that's real.*

---

## 2. Two-layer proof corpus

- **Layer 1 — Canon (curated, durable).** The Sandcastles set (~100–120 videos): hooks with typed
  `[slots]` + archetype + source handle + example video + performance multiplier, plus the
  formats / visual-hooks / editing-styles / signature-series collections. Human-verified → quality
  guaranteed. Cross-niche because it's *structural*. Slow-changing. **Role: the floor / fallback.**
- **Layer 2 — Fresh (live, per-request).** Outlier videos gathered live from the user's intent.
  Recency-weighted, niche-specific. **Role: the hero.**

They self-specialize: **fresh carries niche-specific proof; curated carries timeless structural
proof.** You rarely fall all the way back to a cold template.

> Note the mindset shift during the discussion: we moved from "curated-first with live enrichment"
> to **live-first (hero), curated as safety net** — because the product is chat-first and a user's
> request is often orthogonal to their tracked competitors.

---

## 3. What we learned from Sandcastles (decoded from the product)

- **Their flywheel is `Topic → Research → Hook → Script`** — a rigid wizard. No chat, no live, all
  pre-built. "Research" is an explicit middle step (the gather/teardown moment).
- **Video teardown lenses:** each analyzed video → `Transcript · Idea Analysis · Hook · Storytelling
  Format · Visual Layout`. **These lenses ARE the flywheel stages** and are our extraction schema.
- **They already ship the two-layer model:** "Hooks from your analyzed videos" (fresh) +
  "Sandcastles default hooks · 26" (curated).
- **"How to Personalize this Video for Your Niche" (Options 1/2/3)** = their prefill step.
- **Nav IA:** Research (Videos / Ideas / Hooks / Collections) vs Create (Scripts / Projects / Exports).

**Our wedge (what they structurally cannot do):**
1. **Chat-first**, live gather on *arbitrary* intent (they require manual video analysis).
2. **Audience simulation** — Sandcastles is backward-looking analysis ("why it worked"). We add the
   forward half: *"and here's how YOUR variant lands with YOUR synthetic audience."* Proof (past) +
   prediction (future) = the barbell. They have no audience model.

---

## 4. The content-creation flywheel + the "proof line"

Canonical creation sequence, each stage with its own *type* of proof:

| Stage | Proof type |
|---|---|
| topic / angle | soft ("spiking in your lane") |
| hook | hard (line + video + multiplier) |
| format | hard (the "N winners" collection) |
| visual hook / editing | hard (the video — how it's shot/cut) |
| **script** | **none — fully custom, inherits credibility from the proven parts above** |

**The proof line** sits above the script. Everything above carries a receipt; the script is the one
bespoke thing, *assembled from proven parts*. The product is **"a kit of proven parts → your bespoke
script."** Users never want a copyable script; they want proven structure + their voice.

**Two flywheels:**
- **Creative** (topic→hook→format→script) — makes one good video.
- **Learning** (publish→outcome→corpus) — the user's own published outliers fold back into their
  corpus over time → generations get smarter every week. *This is the compounding moat.*

---

## 5. The experience model — chat that spawns a flywheel

- **Chat is the front door.** User types intent at any stage.
- **Gather once, walk many.** The live gather fires **once**, at whatever stage intent crystallizes,
  and pulls the *full* outlier proof set for the topic/niche/platform. Walking hook→format→script
  then just **unpacks the same gathered videos through different lenses** — no re-scrape. Latency paid
  once; every later step is instant; proof stays coherent across steps.
- **Two ways to walk:**
  - **Anchored** — user falls for one video → format/editing/script unpack *that video's* DNA + their
    voice. "Make my version of this."
  - **Best-of** — no anchor → each step pulls the strongest proof of that type from the pool. A remix
    of winners.
- **Rail is offered, not imposed.** Each step ends with a soft "want the format next?"; a chat
  message is always the escape hatch back to sandbox. → *Best of Sandcastles (structured rail) +
  Stanley (chat freedom).* Maps natively to the existing thread/card architecture.
- **Browse-home for proof = `/feed`; making happens in chat.**

---

## 6. Gathering — sources & triggers

- **Request-driven & live-first.** The *chat request* is the query, decoupled from tracked
  competitors. Competitors = a **prior** + a standalone tracking/watching feature, NOT the spine.
- **Two sources, two jobs:** own-account scrape teaches **YOU (voice)**; competitors teach the
  **CEILING (what works)** — and competitors are *aspirational* (slightly ahead, winning in your lane).
- **Background pre-warm** on connect-account / add-competitor / build-audience — e.g. expand 3
  competitors → 10–15, pull their outliers. Makes warm niches skip the live scrape.
- **"Expand the network"** — from a competitor/topic, branch out to find whoever made a banger on
  *this* topic. Can be background (network growth) or live (topic-specific).

---

## 7. The outlier gate — definition AND quality filter (one mechanism)

An outlier = performs way above the account's **own baseline**, not raw views. (A 500k-follower
account doing 200k views is a *flop for them*.)

- **Cheap metric [primary, live]:** `views ÷ author_followers`. Follower counts come **free** in
  search results → computable from one scrape, no profile call.
- **Accurate metric [top few / tracked]:** `views ÷ that account's own median-of-last-N`. Needs a
  profile scrape → reserve for the winners or already-tracked competitors.
- **[LOCKED] threshold ≈ 3× (`views ÷ followers`) for the start.**
- Baselines are **per-platform** (TikTok and IG view norms differ; IG weights saves/shares).
- **Key property:** the same outlier bar is *both* the "banger" definition *and* the junk filter for
  live-scraped material → live scraping behind it is **self-cleaning**.

---

## 8. Scraper reality (Clockworks / Apify — researched)

- **Clockworks is TikTok-only.** `clockworks/tiktok-scraper` (search/hashtag/profile/URL),
  `-profile-scraper`, `-transcript-extractor`, trends/explore/discover, etc. IG = different vendor
  (`apify/instagram-scraper`), **flakier discovery, no native transcript** (whisper-on-mp4 only).
  → **TikTok is where live-gather magic works first; IG leans on warm pool + curated early.**
- **[LOCKED] search query, not hashtags** (hashtags noisy). Hashtag only as a *secondary widener*
  when a search pull is thin.
- **Free + fast:** views, likes, saves, **author followers**, caption, hashtags, posted date, sound.
- **NOT free:** the spoken hook. No scraper returns it in the base object.
  - **[LOCKED] Option B:** on the ~20% of TikToks without native captions, fall back to caption +
    on-screen text and let the LLM infer the hook (the transcript + LLM call fire anyway). Don't block
    the card on a clean spoken hook.
- **Best config for outlier discovery (TikTok):** `searchQueries` → sort **most-liked** → recency
  window → then our own `views÷followers` gate client-side + dedup per account.

**The funnel [LOCKED start values]:**
```
scrape ~30 videos  (searchQueries, most-liked, recency)     ~seconds
  → relevance prune (LLM/embedding: matches subniche?)
  → outlier gate (views÷followers ≥ 3×)
  → dedup (max 1–2 per account)
  → rank + diversify by archetype → show best 5, rest = "more"
```
`resultsPerPage` is the **latency ↔ yield dial.** Make it **adaptive**: if too few clear the bar
(narrow niche / small accounts), *widen* (more results, relax ratio, add hashtag); if still thin →
curated floor catches. The pipeline **self-heals toward "always show something proven."**

**Already wired in code:** `clockworks/tiktok-scraper` + `-profile-scraper`, `searchQueries` mode,
`downloadSubtitlesOptions:"DOWNLOAD_SUBTITLES"` (free native subs), `shouldDownloadVideos` (mp4 for
omni watch), and `src/lib/discover/outlier-compute.ts` (outlier ratio already computed). Most
primitives exist.

---

## 9. Extraction cost ladder (maps to teardown lenses AND user depth)

| Tier | Cost / latency | Yields | Fires when |
|---|---|---|---|
| **0 — metadata scrape** | seconds, near-live | ranking + **outlier ratio**, caption, hashtags, cover | every request (discovery + proof list) |
| **1 — captions + 1 LLM call** | +seconds, ~5 winners | spoken hook, template, archetype, why (Idea + Hook lens) | on the outliers we'll show |
| **2a — `plus` watches silently** | +latency (video input), 1 video | Visual Layout, Storytelling Format, editing style, visual hook | background extraction of top winners, or anchored deep-dive |
| **2b — `omni` watches + listens** | highest, sparing | delivery / tone / sound-design / music-sync; or transcript-missing spoken hook | only when AUDIO is the differentiator |

**Modality refresher [important]:** `qwen3.7-plus` watches video fine — it's just **deaf** ("sighted/
deaf: watches video, no audio"). **Omni (`qwen3.5-omni-flash`) is only needed when AUDIO matters.** So
the format/visual teardown — the proof the owner cares most about — runs on **`plus`, not omni.** Omni
shrinks to a targeted tool (audio-differentiated content + missing-transcript fallback).

**Quality unlock:** the **background extraction** call (cached, thinking-ON) can afford `plus` to
*actually watch* the top winners silently → the template carries a **real visual/format/editing
teardown**, not metadata inference. Video-input latency is free at runtime because it's background +
cached, reused on every future request in that niche. Caveat: video-input is slower than text even on
`plus`, so Tier 2a stays **off the live fast path** (background / anchored only) — not omni-scarce, but
not free-latency inline either.

**Omni stays OFF the critical path.** The fast path ("5 proven hooks with receipts") runs on Tier 0 +
free captions + Tier 1 text extraction. **Latency scales with intent depth** — browsing near-live,
committing earns the video-watch. The **single LLM call at Tier 1 does triple duty:** relevance prune +
archetype tag + hook/template extraction.

### Model routing [refined 2026-07-09]

Cost is ~flat across `plus`/`flash`; `flash` retired (plus-thinking-off already wins the small latency
gap + keeps multi-output distinct). ⚠️ "SIM-1 Flash"/"SIM-1 Max" are PRODUCT badges, both = `3.7-plus`.
So **the real lever is thinking on/off, not flash/plus** — use `plus` throughout. Only ONE change from
today's proven policy:

| Stage | Model | Thinking | Notes |
|---|---|---|---|
| classify / query-expand / relevance-prune | plus | OFF | light, live |
| **extract → template** | plus (+ silent video-watch on winners) | **ON** | **the one change** — background+cached, Apollo-pattern; thinking latency free at runtime, quality compounds |
| generate → customized | plus | OFF | critical path; rich template grounding makes CoT redundant. *(Owner: default OFF; A/B thinking-ON later.)* |
| simulate / rank | plus | OFF | unchanged, proven |
| omni watch (Tier 2b only) | omni-flash | (sensor) | audio-only niche |

Precedent: policy already reserves thinking-ON for Apollo (video-insight moat) + Calibrate (bake-once).
Extraction has the same profile → same treatment. Note: thinking-ON means `max_tokens` must budget
`thinking + answer` (set generous or JSON truncates).

---

## 10. Call architecture vs the current two-call spine

Current runners: **[generate] → [simulate]** (Qwen generation → one batched Flash SIM that rates all
candidates; cards return complete with reactions attached; `onStage` carries *status only*, honesty
spine refuses reaction-less cards).

**Key insight: extraction is a corpus job, not a per-request job.** Tearing a video into
`{archetype, template, spoken hook, why}` is a property of the *video* → extract **once, cache
forever**, reuse for any future request. So it amortizes to ~zero; the more a niche is used, the
faster it gets.

```
TODAY:      [generate] → [simulate]
WARM path:  [retrieve templates (ms, no LLM)] → [generate] → [simulate]   ← still 2 LLM calls
COLD path:  [scrape 30] → [batch-extract] → [generate] → [simulate]       ← extract cached after
```

- **The generate→simulate spine does NOT change.** Generation just *receives retrieved proven
  templates as grounding* ("adapt these frameworks for this creator") — same call, better input. The
  cleanest injection point identified: one new grounding section in the KC `assembleBundle`, threaded
  the same optional-additive way `audience` already is.
- **Template + customized as TWO stages, don't collapse:** (1) extract → **generalized template**
  (Sandcastles form; this is the *cached corpus asset* AND the *displayed proof*); (2) generate →
  **customized version** (grounded in template + voice + audience), tied back to its source template.
  Collapsing to one call throws away both the reusable asset and the shown framework.
- **Barbell intact:** extraction = analytical sensor (low temp), generation = creative voice,
  simulation = audience judge. Three jobs, three prompts; only **two on the live warm path.**
- **Extraction ideally runs background** (on gather), so live requests hit warm templates.

---

## 11. The three-beat streamed reveal

**[LOCKED] Lean heavy into option (b).** Every request, every skill, streams escalating dopamine:

1. **Proof videos stream in** as scrape/extraction lands — real thumbnails + multipliers populating
   what used to be dead spinner time. *The wow beat.*
2. **Customized hooks drop** as generation completes — each attached to its proof video.
3. **Audience reactions animate on top** as the SIM resolves — shown as a **visible "testing on your
   audience…" pending state that resolves into the band.** Honest (not a fake band — visibly in
   progress) and alive. This is the (b) choice over (a) hold-until-complete.

**Same spine on every skill** (hooks/ideas/scripts/formats/remix): *scan the field → surface the
proof → build your version → test on your people*, streamed. Consistency turns wow into habit.

**Guardrails:** curated/warm floor at t=0 (never a naked spinner) · hard timeout (~30–40s) on the
critical path → serve curated, keep fresh as async upgrade · background pre-warm underneath.

> **New plumbing, not a config flip:** today's runner returns one final payload; `onStage` streams
> status only. Real content-streaming (videos → hooks → reactions) is net-new.

---

## 11b. Dimension taxonomy + unified card grammar [from all 18 Sandcastles shots, 2026-07-09]

**Atomic unit = the torn-down video; dimensions are FACETS of it, not silos.** One extraction of one
outlier yields hook-proof AND format-proof AND visual-hook-proof AND idea-proof simultaneously → one
cached teardown feeds every skill. Skills query the facet they need.

**The dimensions** (superset of Sandcastles' 5 teardown lenses + 4 collection branches):

- **Message ("what you say")** — proof soft→hard:
  - *Topic* — the subject.
  - *Idea / Angle* — decomposed: `Idea Seed · Unique Angle · Common Belief to Challenge · Contrarian
    Reality · Supporting Evidence`.
  - *Hook (text/spoken)* — archetypes: `Question · Personal Experience · Secret Reveal Breakdown ·
    Authority · Contrarian · List · Case Study · Trap Mistake` (+ growable).
- **Form ("how you make it")** — proof hard (video):
  - *Format* — container: About Me, A vs B Comparison, Breakdowns/Explainers, Case Study, Challenge,
    Day in the Life, Hero's Journey, Listicle, Problem Solution, Q&A, Tier List, Reaction, Scenarios,
    Skit, Tutorial, Yap…
  - *Visual Hook* — sub `Subject Motion / Graphic-Text Overlay / Visual Effect-Transition / Pattern
    Interrupt / Visual Selection`: Crash Zoom, Camera Whip, Match Cut, Speed Ramp, Snap/Pop Reveal,
    Unusual First Image, Text Slide In…
  - *Editing Style* — sub `Studio-Set / Faceless / Greenscreen / In-World Vlog / In-World Skit`: Split
    Screen, Whiteboard, Stop-Motion, Vlog POV, Faceless Animation, Man on Street…
  - *Audio / Delivery* — music, sound design, spoken tone (**omni-only** dimension).
  - *Signature Series* — recurring-format identity (meta): Docuseries, Progress Journey, Recurring Segment…
- **Output (below proof line, no receipt, inherits)** — *Script* (beats + words), *Film instructions*
  (synthesized from format + visual + editing).

**Archetype vocabulary decision:** adopt Sandcastles' taxonomy as the **seed controlled vocabulary**
(well-researched, ~100+ named patterns / 4 branches: Visual Hooks · Formats · Editing Styles · Signature
Series, each with sub-categories) → extraction tags new videos into it; the set grows over time.

**Unified card grammar — ONE grammar, every skill/dimension:**
```
[Dimension · Archetype tag]          e.g. Hook · Secret Reveal Breakdown
YOUR VERSION           ← hero: customized, prefilled, in the user's voice
📎 @handle · 9.2× · 179K [▶ video]   ← the receipt (proof-line dimensions only)
💡 why it works: one line            ← the mechanism
👥 audience: [testing… → Strong 4/5] ← SIM verdict, pending→resolved (option b)
→ next: [turn into a format]         ← flywheel affordance
```
Different skills emphasize different rows; the grammar is **constant** → the product reads as ONE
intelligence, learned once, scannable everywhere.

**Presentation wedge vs Sandcastles:** theirs = static research tabs (analytical, past-tense, browse).
Ours = same dimensions but **customized + predicted (audience verdict per card) + personalized +
streamed in the flywheel** — actionable & made-for-you, not a library to study.

## 11c. Query expansion + audience-aware prune [the two make-or-break quality stages, 2026-07-09]

**Core principle:** *cast wide on topic, judge tight on audience.* Over-constrain the scrape → thin/no
results. Under-constrain the prune → audience-wrong proof. So the **audience qualifier is held OUT of
the search and applied at the prune.** The two stages are two halves of one strategy.

**Stage 1 — Query expansion** (one `flash` call):
1. Decompose intent into axes: `topic-core · audience-qualifier · platform · target-dimension ·
   format`. Only the **core** goes to search; the **qualifier is set aside for the prune**.
2. Bias to **creator-caption vocabulary** ("how would a creator title a banger about this?"), not the
   user's phrasing.
3. Emit a **graded query ladder** specific→broad (e.g. `creatine perimenopause → creatine women →
   creatine benefits → supplements women 40s`).
4. **Never drop the core noun** — widen by relaxing qualifiers + synonyms, not by generalizing to the
   parent category (until true last-resort).
- The ladder **IS the adaptive-widen mechanism** (fire query 1 → thin yield → climb). For *vague*
  requests, Stage 1 first resolves intent against the user's **pillars/profile** to manufacture a core.

**Stage 2 — Audience-aware relevance prune** (NOT binary — a multi-signal scorer, pre-extraction):
1. **Topical relevance** — embedding sim (request ↔ caption + hashtags + on-screen text). **Hard gate.**
2. **Audience fit** — creator bio/positioning, framing, on-screen text. **Soft rank** (not hard gate).
3. **Structural transferability** — does the *template* transfer even if audience differs? (We extract
   structure, not copy.) **Soft rank.**
- **Audience-fit is a ranking signal, not a hard gate** — hard-drop only egregious mismatch. Everything
  else ranks by proximity and carries an **honest fit label**: `● in-audience / ◐ adjacent / ○
  structural`. This is the degradation ladder applied per-video — keeps thin niches from going hollow.

**Pipeline order (cost-ordered):** scrape 30 (broad ladder) → outlier gate (free) → topical prune
(embedding, hard) → audience+transfer score (flash, soft rank + label) → rank/dedup/take ~8 → EXTRACT
survivors → generate → simulate. Prune runs **before** extraction so we never tear down junk;
audience-label can fold into the triple-duty Tier-1 call.

## 11d. The degradation ladder [makes thin/weird niches as good as hot ones, 2026-07-09]

Always land on genuinely-proven, relevant proof — never mush, never fake. Rungs best→last:

| Rung | Proof source | Fit label | When |
|---|---|---|---|
| **0** | in-niche, in-audience outliers | ● in-audience | happy path |
| **1** | in-niche, adjacent-audience outliers | ◐ adjacent | topic proven, audience differs |
| **2** | adjacent-niche, same-structure outliers | ○ structural | topic has no viral proof (boring niche) |
| **3** | curated canon (Sandcastles structural corpus) | curated | no live proof clears structural search |
| **4** | craft-only (today's cold gen), **honestly flagged** | — | nothing proven applies — say so |

**Descent = the widen loop one level up:** at each rung, widen-within (query ladder) → when exhausted,
descend. Driven by **yield vs target (~5)**. Cheap descents: **0→1 free** (same scrape, re-rank only);
**2 = corpus retrieval** (fast if warm; cold → 2nd live scrape); **3 curated = instant**. Only `2-cold`
is expensive → curated floor + streaming cover it (show Rung 3 now, upgrade with Rung 2 as it lands).

**Rung 2 = "search by structure, not topic"** (the pivotal move): topic has no proof → search the
STRUCTURE the user needs. Format known → find that format's outliers in analogous niches. Format
unknown → pick archetypes that over-index for the intent-type (B2B-edu → Authority/Secret-Reveal/
Trap-Mistake/Case-Study), pull cross-niche outliers, transplant. **The corpus IS the map** (every video
tagged `{topic, archetype, format, niche}` → retrieval filtered `archetype=needed ∩ niche≠user's`,
ranked adjacency × outlier). Outlier metric is **niche-agnostic** (per-account) → travels across niches
free. Compounds with the learning flywheel. **Gated by a flash fit-check** (does this format fit this
topic+audience? no → skip to curated) — never force a bad format.

**Reframe [important]:** for a boring/thin niche, Rung 2 is **not a consolation prize — it's the killer
feature.** That user has no viral playbook; we hand them a proven one from an analogous space =
white-space arbitrage, first-mover, low competition. **Frame as strength, not apology:** "Nobody's gone
viral on HVAC billing yet — this teardown is doing 15× in finance. Here's your version."

**Blend, don't replace:** ladder decides what's *available*; ranking picks the best *mix* (e.g. 2
in-niche-adjacent + 3 structural), all labeled, ranked `proof-strength × fit-penalty`. Labels = the
trust mechanism; provenance always visible.

## 11e. The learning flywheel [the compounding moat, 2026-07-09]

**Two loops, compounding different things:**
- **Proof loop** — creator's own published outliers → torn into dimension facets → **personal corpus**
  → grounds future generation. *Improves the proof.*
- **Calibration loop** — predicted band vs actual outcome → tunes audience-sim + why-it-works
  **per creator**. *Improves the judge.* (Plumbing partway built: outcome loop #171–186 —
  RecalibrationNudge, per-receipt numbers, planned_posts/outcomes. NEW move = extend it from
  calibrating-the-judge to also feeding-the-generator.)

**Own-proof = Rung −1** (above competitor): in-niche + in-audience + it's *them* (voice matches, zero
adaptation). "You did this, it worked — here's the next." But **own catalog is small** → high-priority
**prior, not the whole supply**; competitor/structural fills volume beneath it.

**Two-corpora architecture [important]:**
- **Shared** — competitor + curated structural. Cross-user. Powers Rung 2 map. Grows for everyone.
- **Personal** — own outcomes + calibration. **Private, per-user.** Powers Rung −1/0 + judge calibration.
- Combine at generation; stored/scoped separately. Your wins never leak into another user's map.

**Attribution:** explicit (pin Reading↔posted video, owner-gated, scoped in code) > implicit (re-scrape
+ hook-text/timing match, fuzzy). Weight explicit higher.

**Ramp not switch:** cold-start → lean shared, own-weight grows from 0 (a slope). Sparse-wins creator
still benefits — `views÷own-median` surfaces relative-best + calibration learns what does NOT work
(negative signal steers too). **Recency-weight** the personal corpus (audiences drift).

**Moat:** Day 1 = generic-ish. Month 3 = private library of *your* proven patterns + *calibrated*
audience model + known archetypes-for-you → materially better for this creator, uncopyable without their
history. Switching = abandon proven-playbook + tuned model.

## 11f. Grounding the existing skills — what changes per runner [code-verified 2026-07-09]

All 4 runners share skeleton `assembleBundle → Qwen → Flash SIM → build block`. The ONLY volatile
channel into generation is the `assembleBundle` user message → grounding = essentially one shared change.

**Shared spine (hooks/ideas/script):**
- **Add `corpus`/`retrievedExamples` to `AssemblerInput`** (`assembler.ts:81-89`), fenced non-droppable
  like `anchor` (`:263,306`), **optional-additive** (`undefined` = byte-identical no-op → preserves
  warm-cache prefix + regression gates). Copies the audience-threading pattern (`hooks-runner.ts:312`).
  One field grounds all three.
- **Retrieval runs before assembleBundle** (our pipeline fills the field). Upstream subsystem = the real
  build; runner touch is tiny.
- **Blocks gain proof fields** `proof:{handle,videoUrl,thumbnail,multiplier,fitLabel}` + corpus
  `archetype` (NB `audienceArchetype` on hooks = audience-persona tag, NOT corpus archetype → distinct
  field). Reused as-is: `mechanism`/`whyItFits`/`retentionMarker` (why-it-works) + `band`/`fraction`/
  `personas` (SIM). New = only the proof row (renderer + schema), net-new on hook/idea/script.

**Per-runner:** Ideas = ROOT (no anchor) → grounds idea/angle facet. Hooks = flagship (anchor=idea) →
hook facet, Sandcastles hook object maps 1:1. Script = anchor=hook, one card, BELOW proof line (inherits
proof) → beat-skeleton facet. **Remix = already the vision for N=1** — decode→adapt, already
"1 source→N concepts" with `coverUrl`+`sourceDecode`; generalize `AdaptInput` (`decode-types.ts:160`) to
N decoded exemplars. **Cheapest prototype** (machinery exists, extend 1→N not build-from-zero).

**Three-beat reveal = the real net-new plumbing, SEPARABLE.** Today content streams only after full
pipeline awaits (route splits `content` then `score` frame, `hooks/route.ts:202-229`). True beats need:
content-callback (`onProof`/`onHook`, not status-only `onStage`) + interleaved emission + per-card SIM
(batched SIM resolves all at once today). **Grounding ships first on the 2-frame reveal; three-beat is a
follow-on, don't couple.**

**Honesty spine extends:** "no card without real reaction" → "no proof-claim without a real source."

**Build order:** (1) retrieval/extraction subsystem (query-expand→scrape→outlier→prune→extract→corpus);
(2) wire into Hooks via the one AssemblerInput field (smallest change, biggest skill, 1:1 map) — prove
loop on 2-frame reveal; (3) fan to Ideas+Script + generalize Remix 1→N; (4) three-beat streamed reveal
last.

## 12. Locked vs open

**External validation (Sandcastles reference shots `.planning/references/sandcastles/`):** outlier
score is a first-class **filter** (0–100×) alongside views + engagement %; videos carry an
**Analyzed/Unanalyzed** status + **Bulk Analyze** → confirms extraction = a separate, cached, batchable
step (our §10 model). Their feed is **watchlist-driven** (channels curated first) — the friction our
live/request-driven gather removes; their Suggested/Describe tabs are their cold-start workaround.

**[LOCKED] so far:** live-first + curated floor · request-driven gather (competitors = prior) ·
outlier gate `views÷followers ≥ 3×` · scrape 30 · search-query over hashtags · Option B (caption
fallback for missing transcripts) · omni off critical path · template + customized as two stages ·
inline-streaming three-beat reveal, option (b) pending→resolved · honesty spine kept.

**Still open / to refine:**
- Exact archetype taxonomy (adopt Sandcastles' categories, or our own?).
- Relevance-prune mechanism (LLM vs embedding) and how strict.
- When/whether the **accurate** outlier metric (views÷median) supplements the cheap one.
- Extraction schema fields (align to the 5 teardown lenses) + the corpus table shape + embeddings.
- `/feed` as the browse-home for proof vs a pure supply depot.
- The learning-flywheel loop (folding the user's own outliers back in) — mechanism + timing.
- IG strategy day one (how second-class is it, and does curated cover the gap acceptably?).
- Cold-start feed seeding (curated exemplar accounts per broad niche). *Sandcastles pattern: a
  "Suggested" tab grouping creators by topic cluster ("Social Media Growth", "Viral Tactics", "AI
  Tools"); "Describe" tab = NL channel discovery + Platform/Account-size filters → our "expand the
  network." Account-size filter = the peer-vs-aspirational lever.*
- Cost ceiling per request (scrape + extract + generate + sim) and how the adaptive widen interacts.

---

*Owner steer during this session: this is a discussion — do not jump to implementation. Keep
refining and pressure-testing the thinking.*
