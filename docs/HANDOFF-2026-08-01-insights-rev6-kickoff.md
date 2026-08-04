# Handoff — Ambient Audience v2 detail drill, rev 6 kickoff

**Date:** 2026-08-01 · **Branch:** `task/insights-rework` · **Worktree:** `~/virtuna-slot-b` · port **3002**
**Status:** rev 6 mockup built and the cortex wired — see **§9** for what shipped. (Through rev 5
this branch was design exploration with zero `src/` changes; `7241c11c` ended that.) Revs 1–5 are
all rejected; §0 is why. This document is the complete state so a fresh session starts with
everything.

> **Read this file first, then §2 of `docs/HANDOFF-2026-08-01-insights-three-tab.md`** (the verified
> code findings — still all true, not duplicated here).

---

## 0. The one thing that matters most

**Revs 3, 4 and 5 each deleted the single most distinctive asset in the product, and that is why
none of them landed.**

The shipped rail leads every tab with a **full-bleed 270px hero figure** — a real 3D cortex
(`public/brain/cortex.glb` → `CortexCanvas`) with a red→yellow→cyan activation heatmap, corner
labels, a live `t = 0:06` clock, and the verdict chip riding *on* the figure. It is genuinely
premium and it is already built.

Rev 3 kept it. Rev 4 replaced it with a 46px grey SVG glyph. Rev 5 shrank that to 54px and dimmed
it further. Each rev traded the product's wow for tidiness and each was rejected.

**The reasoning error, stated plainly so it isn't repeated:** the *"one accent, coral = loss only"*
law governs **chrome**. It was wrongly applied to **data figures**. The shipped cortex uses a full
scientific colormap and is the most premium thing on the screen. Chrome stays one-accent; figures
may carry a colormap.

---

## 1. The five revisions

| Rev | Where it lives | Idiom | Verdict |
|---|---|---|---|
| 1 | **artifact picker only** — not on disk | Two tabs (Attention · The room), honesty-first | Superseded — owner wanted three tabs + TikTok framing |
| 2 | **artifact picker only** — `rev-2-projection-led` | Three tabs: Overview / Audience / Engagement. Persistent header (thumbnail + projected stat row), led with "projected 3.2K views, ↓60% vs median" | **Owner preferred its read.** Narrative spine tested well |
| 3 | `docs/mockups/insights-three-tab-2026-07-31.html` | Card system, varied chart forms | ❌ *"doesn't read clean and premium… colors, visual read like AI slop"* |
| 4 | `docs/mockups/insights-role-tabs-2026-08-01.html` | Role-shaped tabs (The read · The room · The reaction), hairline rules, uppercase-mono labels | ❌ read like a Bloomberg terminal |
| 5 | `docs/mockups/insights-product-chrome-2026-08-01.html` | Perplexity product chrome — filled cards, chips, segmented control, persistent answer block | ❌ *"we're not there yet"* — all clarity, zero wow |

Artifact (all versions, version picker):
https://claude.ai/code/artifact/4465380d-3cac-4afe-9022-f4b6d08ea97e

⚠️ **Revs 1 and 2 were never written to disk** — they exist only as versions in that picker. They
cannot be recovered from the repo or from git history (checked). If the fresh session needs them
pixel-exact, the owner must open the picker and export them. Their *content* is described above and
in §4 of the older handoff.

Screenshots of revs 3/4/5 and the shipped rail: **`docs/mockups/reference-2026-08-01/`**.

### Why each rejection happened — don't re-introduce these

- **Rev 3:** amber `#E8B04B` added as a *second* semantic accent (WEAK/STRONG pills), gradients on
  hero cards, cards nested inside cards (borders inside borders), and form variety for its own sake
  (donut + gauge + columns + sparkline + bars in one 440px column).
- **Rev 4:** grouping by hairline rules only, uppercase-mono micro-labels everywhere, hairline-thin
  numerals at huge sizes, metadata as bare text, no hero figure at all.
- **Rev 5:** chrome was actually good (keep it) — filled cards, chips, segmented control, and a
  persistent answer block. It failed purely because it had **no hero and no wow**.

---

## 2. What is ACTUALLY rendering in the rail today

Captured live 2026-08-01 from `http://localhost:3002/ambient-v2` → `② brain` →
`creator · LIVE adapter` / `creator · TEXT sim`. Real component, real fixtures, **440×800**.

Screenshots: `docs/mockups/reference-2026-08-01/shipped-*.png`

**The brain tab**
- Full-bleed **270px hero**, `rounded-[14px]`, `background:#131210`, 1px 6% border
  (`BrainTab.tsx` — the `PredictedCortex` block)
- `CortexCanvas` renders `public/brain/cortex.glb` with a red→yellow→cyan BOLD heatmap
- Corner labels: `Predicted cortex` (tl) · `t = 0:06` (tr)
- `VerdictChip` rides bottom-left **on the figure**: `38%` + `would stop`
- Below: one-line read ("Focus running slightly below ↓ · Visual a mild lift ↑"), then the
  transcript with a live playhead and an underlined current word, the attention curve, and moment
  chips (`0:02 72` · `0:04 27`), then "Attention bottoms out at 0:04, **down 62% from its peak**"

**The audience tab**
- Same 270px hero, filled by the terrain — a soft, atmospheric node cloud. `AudienceTerrain.tsx:9`
  documents it as *"soft-edged (an SVG radial fill, matte — not a glow)"*, so the matte law holds
- Same `VerdictChip` treatment
- Then `THE READ` ("builders stop most (82%); skeptics are the ceiling (12%)"), then
  `THE ROOM · WHAT THEY DID` as **dot-matrix count rows** (`Stopped ●●●●●● 380`, `Almost 201`,
  `Not for them 176`, `Scrolled past 243` in coral), then a tri-state figure row

**What the shipped surface does well:** the hero figures, the verdict-on-figure chip, the
dot-matrix rows, the one-playhead instrument.
**What it does badly:** everything below the hero is thin and sparse; chrome is uppercase-mono and
hairline-heavy (the same tell rev 4 was rejected for); and the cortex carries **no information** —
see §3.

---

## 3. Verified code findings that bear on the design

Full list in §2 of `docs/HANDOFF-2026-08-01-insights-three-tab.md`. The three that shape rev 6:

**3.1 The hero cortex is decorative — `BrainTab.tsx:65`.** Re-read in source 2026-08-01:
```ts
const drive = useMemo<DriveInput>(
  () => ({ mode: "simulated", stopRatio, durationS: clipSeconds, seedKey }), …
```
`cortex-sim.ts` ships a **`grounded`** mode that takes a `retentionAt(u)` callback
(`cortex-sim.ts:62-70`, branch `:175-202`) — *"attention tracks who is still watching, salience
spikes where the curve breaks, and the default-mode network rises with the people who checked out."*
On every video drill, with `weighted_curve` one prop away, the cortex loops a seeded envelope
carrying zero information. **Wiring it is a few lines and turns the product's best visual from
decoration into a readout. Highest value-per-line change in the codebase.**

**3.2 The unlock is structurally absent on every real video drill —
`AmbientOverviewRail.tsx:467`.** `buildVideoDomainTemplate({...})` is called without `reasons`, so
`modeledUnlock(classifyReasons(undefined))` → `[]` → `undefined`. The one actionable element on the
page never renders in prod. A video fold genuinely has no coded reasons, so the fix is a
*video-appropriate* unlock derived from the curve/craft — not passing `reasons`.

**3.3 Video and text are INVERSE instruments.** `StimulusKind = "hook" | "video" | "idea" | "draft"`
(`AmbientSimulate.tsx:39`) — only `video` has a timeline.

| | VIDEO | TEXT (hook · idea · draft) |
|---|---|---|
| Attention curve · per-viewer retention · drop-off second | ✅ real | ❌ modeled/none |
| Craft dims · action intents · skim band | ✅ real | ❌ absent |
| **Coded reasons** | ❌ `reasons: []` **by design** | ✅ **real** |
| **Per-viewer verbatim quotes** | ❌ none | ✅ **real** |
| **4-state playbook · the unlock** | ❌ omitted | ✅ real |

**Video has the timeline and no voices. Text has the voices and no timeline.**
`domain-template.ts` already solves this: two invariant ROLES with ◇ swap slots, and `BrainDriver`
is already a union containing both `attention-scrubber` and `reason-breakdown`. Revs 1–3 never used
the seam; rev 4 and 5 did, and **that part was never rejected — keep it.** A text sim must feel like
a *different instrument*, not a video screen with empty slots.

---

## 4. Direction for rev 6

Synthesis of what survived all five rounds:

1. **Restore the hero.** Lead each tab with the full-bleed figure — 3D cortex on the video read,
   terrain on the audience read — with the verdict chip riding on it, exactly as shipped.
   **This is non-negotiable; it is the wow.**
2. **Keep rev 5's chrome for everything below the hero** — filled cards (`#212120` on `#181817`,
   14px radius, no border), chips for metadata, segmented control, sentence-case 13px medium labels
   with a line icon. Zero uppercase-mono.
3. **Keep rev 5's persistent answer block** — the verdict sentence + the fix chip above the tabs, so
   the answer is never hidden behind a tab.
4. **Figures may carry a colormap; chrome stays one-accent.** Coral `#FF6363` = loss, in chrome only.
5. **Keep the figure-swaps-per-`StimulusKind`** contract from revs 4/5.
6. **Steal rev 3's one good idea:** the TikTok-native stat row (plays · likes · comments · shares ·
   saves) — instantly legible as "analytics".
7. **Keep the shipped dot-matrix count rows** — they're a distinctive, product-native component.
8. **Wire the cortex to `grounded`** (§3.1) so the hero *means* something.

**Bar to clear:** something Perplexity, Claude or ChatGPT would ship to their own customers — on
visual design, UX, user value, the data actually displayed, and premium feel.

### Owner decisions already made (do not re-ask)

- Idiom = **Perplexity product chrome** (chosen over ChatGPT/Claude-editorial from a 3-way preview)
- Structure = **open to rethinking**, not locked to the earlier three-tab role model
- Tabs shown in the chosen preview: **Overview · Audience · Engagement**
- Honesty-labelling and wiring are **deprioritised for this phase** — *"we will rework the engine to
  produce the real numbers later."* This phase is UI, UX, user value, premium feel
- Benchmark bands: **held** — every comparison is against the creator's own catalogue
- Founding-price cohort: **rejected**, never re-propose

---

## 5. The two missing inputs — SUPPLIED 2026-08-01, recorded here so they stop going missing

Both were re-sent by the owner at the rev 6 kickoff. They are written down now because they are not
otherwise in the repo and a fresh session cannot reconstruct them.

### 5.1 The TikTok analytics reference screens

Five TikTok "Video analysis" screens (Overview · Viewers · Engagement tabs). What the idiom is
actually made of, and what rev 6 takes from it:

| TikTok screen | What it shows | Taken into rev 6? |
|---|---|---|
| Header, every tab | Thumbnail + post date, then a **5-icon stat row** — plays · likes · comments · shares · saves (94K · 15K · 7,001 · 2,609 · 3,764) | ✅ the header stat row, real line icons, one row |
| Overview · Key metrics | Four boxed tiles: Video views `94112` · Total play time `719h:27m:22s` · Average watch time `27.7s` · Watched full video `3.54%` · New followers `4845` | ✅ as the **Key rates** card — but each rate carries a delta vs the creator's own median, which TikTok never gives you |
| Overview · Retention rate | A sentence first — *"On average, viewers watched 14% of your video"* — then the curve, with the drop-off second called out (`00:03 (39%)`) | ✅ answer-first is the whole spine of rev 6; the curve + the named break second |
| Overview · Traffic sources | Horizontal bars: Other 53.7% · For You 32.6% | ✅ **Where it would surface** card |
| Viewers · Viewer types | Two split bars: New 66% / Returning 34%, Non-followers 75% / Followers 25% | ✅ folded into **Who this reaches** (the four-pool room mix) |
| Viewers · Gender | A donut | ❌ not held by the engine — no producer, so it is not drawn |

**The gap rev 6 exists to fill:** every TikTok screen is *post-hoc* — it reports what already
happened, on a post you cannot change. Virtuna's version runs *before* posting, and answers the
question TikTok cannot: **retention split by traffic pool.** That is the "No platform reports this"
line on the Audience tab, and it is the product's actual claim.

### 5.2 What drives distribution on TikTok / Instagram

The mental model, from the owner's earlier session output. Four layers; every metric is a proxy for
one of them, and **cost of signal rises left → right, which is roughly the algorithmic weight.**

| Layer | The question the algorithm asks | Metric family |
|---|---|---|
| Attention | Did they stop and stay? | hook rate, watch time, retention curve, completion |
| Reaction | Did staying cost them effort? | likes, comments, saves, shares |
| Propagation | Did they hand it to someone else? | sends/DM shares, external shares, duets/stitches |
| Consequence | Did it change their relationship to you? | follows, profile visits, link taps, purchases |

Signal-cost ladder (cheap → expensive):
`impression < 1s view < 3s view < like < completion < rewatch < comment < save < share/send < follow < link tap < purchase`

**TikTok optimizes for time.** Average watch time is its single strongest ranking input; completion
buys distribution and shares multiply it. Rewatch/loop is a TikTok-specific superpower — a loop
counts as new watch time.
**Instagram optimizes for relationships.** Mosseri's stated Reels priority: watch time → likes per
reach → **sends per reach** (he named this the reach lever) → watched-fully %. Saves buy the long
tail. Likes are near-noise.

**Both punish the same thing: early drop-off. If hook rate is broken, no downstream metric can save
the post — fix in the order hook → hold → share.**

> **This single sentence is the spine of rev 6.** It is why the answer block leads with the hook,
> why the Overview tab is the attention layer, and why the read on Key rates is *"The hook is the
> only thing broken"* — the content beats the median everywhere the hook lets people reach.

Always normalize by **reach, not followers**. ER-by-followers is inflated theatre. Derived metrics
worth holding: hook rate (3s ÷ reach) · hold rate (avg watch ÷ length) · completion · save rate ·
share rate · send-per-reach · follower conversion · velocity (views in first 1h/3h/24h) · long-tail
ratio (views after day 7 ÷ total).

Rough orientation bands (they swing hard by niche/length/geo — **not** targets):

| Metric | Weak | Solid | Strong |
|---|---|---|---|
| TikTok 3s hook rate | <40% | 55–65% | >75% |
| TikTok completion (<15s) | <25% | 40–55% | >70% |
| TikTok share rate | <0.3% | 0.8–1.5% | >2.5% |
| IG Reels ER (by reach) | <3% | 5–8% | >10% |
| IG non-follower reach | <30% | 50–70% | >85% |
| IG send-per-reach | <0.5% | 1–2% | >3% |

⚠️ These bands are **orientation for us**, not UI copy. The owner's benchmark decision stands: every
comparison shown to a creator is against **their own catalogue**, never an industry band.

Negative signals (Not Interested · hide · report · swipe-before-1s · unfollow · mute) are invisible
in analytics and real in ranking. You infer them from an abnormal reach ceiling despite good rates —
we do not hold them, so we do not draw them.

### 5.3 The metric ledger (engine → UI)

From §3 of the older handoff:

| TikTok/IG metric | Engine source | Kind |
|---|---|---|
| Hook rate (3s) | `weighted_hook_score`; `scroll_past_second ≤ hookEnd` | video |
| Retention curve | `heatmap.weighted_curve` | video |
| Retention per viewer type | `heatmap.personas[].attentions[]` grouped by `slot_type` | video |
| Avg watch · watched-full | `watch_through_pct`, `completion_pct` | video |
| Rewatch / loop | `loop_pct`, `rewatch_intent` | video |
| Saves · comments · shares | `save_pct` · `comment_pct` · `share_pct` | video |
| Traffic sources | `heatmap.weights` + `slot_type` (`fyp`/`niche`/`loyalist`/`cross_niche`) | both |
| New vs returning · non-follower % | `slot_type` (loyalist = returning) | both |
| Why they reacted | `agg.reasons` (real tally) | **text** |
| Verbatim objections/endorsements | `PopulationPersona.quote` | **text** |
| Post window | `OptimalPostWindow` | both |
| Views · reach · likes · follows | **none — no producer exists** | — |

---

## 6. Design laws (verified, non-negotiable)

- **Palette is `AmbientDetail.tsx:85` `TONE`**, not a new system: rail `#181817`, well `#262624`,
  cream `#ece7de` (never `#fff`), coral `#FF6363` (**loss only, chrome only**), border 6%, hair 8%.
  Rev 5 added `#212120` card fill and `#2b2a28`/`#343330` chip fills — those worked, keep them.
- **Matte** — no gradient, no glass, no glow, no inset-shine, no shadow. Verify by walking computed
  style (`backgroundImage` / `boxShadow` / `backdropFilter`), not by grepping the source.
- **One accent in chrome.** If "good" must read as good, use weight, size and position — cream at
  full strength IS the positive state. Active/interactive = cream on a lighter fill, never coral.
- **No card-in-card.** The failure was *borders inside borders*. Grouping by **fill**, exactly one
  level deep, is fine and is what rev 5 did.
- **The rail is 440px** (`AmbientDetail.tsx:321` `max-w-[440px]`) and full-height with one left
  hairline, no rounding, no shadow (`:329`). Verify mockups at exactly 440.
- Type: Inter/system for chrome; **Newsreader serif for voice moments ONLY** (audience verbatims).
- ⚠️ `--font-*` in Tailwind v4 `@theme` is the font-FAMILY namespace — never put weights there.
- ⚠️ tailwind-merge silently deletes custom `text-*` classes.

---

## 7. Environment / process

- Branch `task/insights-rework`, worktree `~/virtuna-slot-b`. **Do not switch branches.**
- Dev server **port 3002**, cap 2 GB:
  `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev --turbopack --port 3002`
  A launchd reaper kills idle servers after ~10 min — confirm `lsof -ti:3002` before hitting it.
- **Live review surface: `/ambient-v2`** — outside the `(app)` route group, so **no auth needed**.
  Chips: `② brain` → `creator · authored` / `creator · LIVE adapter` / `creator · TEXT sim` /
  `pricing template`. This is how to see the real rail.
- E2E creds if a signed-in route is ever needed: `e2e-test@virtuna.local` /
  `e2e-test-password-2026` (set in this worktree's gitignored `.env.local`). ⚠️ It is a **real
  production account** — dev and prod share one Supabase project.
- **Screenshots hang** on this app (ambient animations never settle). Use raw Playwright with
  `animations:'disabled'`, `caret:'hide'`, element `.screenshot()`, and inject
  `*{animation:none!important;transition:none!important}`. A script outside the repo must import
  `node_modules/playwright/index.js` by **absolute path**.
- `NEXT_PUBLIC_AMBIENT_V2=true` is set here. It inlines at **build** time — restart dev + clear
  `.next/` after touching it.
- Mockup convention: `docs/mockups/<name>-<date>.html`. Commit atomically. PR **#412** is open on
  this branch.
- Before any `src/` change: `npx tsc --noEmit` + relevant vitest. Note vitest does **not** typecheck,
  and a green Vercel check is not a build.

---

## 8. Key files

| Path | Role |
|---|---|
| `src/components/audience-lens/v2/AmbientDetail.tsx` | Tab shell · `TONE` `:85` · `VerdictChip` `:192` · rail `:321`/`:329` |
| `src/components/audience-lens/v2/BrainTab.tsx` | Brain frame · **`:65` the `mode:"simulated"` bug** · the 270px hero |
| `src/components/audience-lens/v2/AudienceTab.tsx` · `AudienceTerrain.tsx` | Population frame · the terrain hero |
| `src/components/audience-lens/v2/domain-template.ts` | **The ◇ swap-slot contract** — `BrainDriver`, `PopulationMain` |
| `src/components/audience-lens/v2/AmbientOverviewRail.tsx` | Mount · **`:467` missing `reasons`** |
| `src/components/audience-lens/v2/detail-fixture.ts` · `detail-live-fixture.ts` | The fixtures `/ambient-v2` renders |
| `src/lib/brain/cortex-sim.ts` | **`grounded` mode, never called** (`:62-70`, `:175-202`) |
| `public/brain/cortex.glb` | The 3D cortex model |
| `src/lib/surfaces/ambient-v2-{brain,video-population,population,modeled}.ts` | The adapters · the LCG fabrication zone |
| `src/app/ambient-v2/page.tsx` | **The no-auth live review surface** |
| `docs/HANDOFF-2026-08-01-insights-three-tab.md` | Prior handoff — §2 verified code findings, §3 metric ledger |
| `docs/mockups/reference-2026-08-01/` | Screenshots: shipped rail + revs 3/4/5 |

---

## 9. Rev 6 — what shipped on this branch (2026-08-01)

| Commit | What |
|---|---|
| `a52702ee` | The rev 6 mockup — `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` + six screenshots in `docs/mockups/reference-2026-08-01/rev6-*.png` |
| `7241c11c` | The cortex grounded on the real retention curve (§3.1's "highest value-per-line change") |

**The mockup.** Open the HTML directly — no server needed. Left strip switches stimulus
(video / text) and tab (Overview / Audience / Engagement); the rail is exactly 440px.
**Drag the retention curve** on video · Overview: one playhead drives the transcript, the clock and
the cortex readout together. Attention runs 91% → 38% across the break while drift climbs 26% → 60%.
Those three bars use `cortex-sim`'s grounded drive verbatim (`neuralDrive`, `:175-202`), so the
mockup's readout *is* the shipped model.

Held to the laws: 440px, 0 gradients, 0 shadows, 0 backdrop-filter, 0 uppercase chrome, Newsreader
confined to the four voice quotes, coral on losses only. Verified by walking computed style across
all six screens, not by grepping source.

**Known mockup-only artifacts** (they do not exist in the build): the hero is a *still* cropped from
the shipped screenshots, so the reference PNGs' own baked chrome is painted out with two `.mask`
bands. The live `CortexCanvas` renders no chrome at all.

**The grounded wiring.** `driveFor()` in `cortex-sim.ts` is now the ONE place that chooses grounded
vs simulated; `BrainFrameData.retentionCurve` carries the curve, sourced from the same
`weighted_curve` the scrubber draws. Covered by `drive-for.test.ts` + `BrainTab.grounded.test.tsx`,
the second mutation-checked (drop the prop → red).

> ⚠️ **Behaviour change to design around.** Grounded mode plays ONCE (`u = clamp01(t/dur)`), so each
> replay restarts from resting state and the canonical ~5s HRF lag leaves the first seconds of the
> loop washed out — verified live at t=0:02, a near-uniform pale map. Simulated mode looped, so its
> convolution always reached back into a prior cycle and never sat at rest. Rev 6 hands the playhead
> to the user and opens on the break instead of free-running from 0, which dissolves it. **If the
> implementation keeps a free-running loop, offset its start past `HRF_PEAK_S` or the hero opens
> flat.**

### Still to do

1. Implement rev 6 in `src/components/audience-lens/v2/` — held pending owner review of the mockup,
   because five revisions have been rejected and the implementation is the expensive step.
2. §3.2 remains open: `AmbientOverviewRail.tsx:467` calls `buildVideoDomainTemplate` without
   `reasons`, so the unlock never renders on a real video drill. Rev 6's answer block carries the
   fix chip in the header, which is the video-appropriate unlock the handoff asked for — it lands
   with the implementation.

---

## 10. Rev 7 kickoff — SUPERSEDED, start at §12

> ⚠️ This section kicked off rev 7 and is now historical. A fresh session starts at **§12** —
> five owner-directed revisions (7 → 7.5) happened after this was written, and several calls
> below (the pinned answer, the three heroes, the 283px header) were REVERSED during them.

The owner reviewed rev 6 and has **a lot of adjustments**, to be given in a fresh session. Rev 6 is
NOT approved; nothing has been implemented in React. Read §0 (why revs 3/4/5 died), §4 (the
direction), §6 (the laws), then this section.

### Where everything is

| | |
|---|---|
| Worktree · branch | `~/virtuna-slot-b` · `task/insights-rework` — **do not switch branches** |
| PR | **#412**, open. Tip `a3a074ed`. |
| The mockup | `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` — **this one file is everything**: the 440px rail AND the review scaffolding column. Open it directly, no server. |
| The review link | https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3 |
| Rebuild the link | `node scripts/build-insights-review-artifact.mjs /tmp/review.html`, then publish with the Artifact tool **passing that URL as `url`** so the owner's link keeps working. |
| Screenshots of rev 6 | `docs/mockups/reference-2026-08-01/rev6-*.png` |
| Live shipped rail | `/ambient-v2` → `② brain` → `creator · LIVE adapter` / `creator · TEXT sim`. No auth. Port 3002. |

### The loop for an adjustment

1. Edit the mockup. Everything lives in that one file — no build step to see it.
2. Re-screenshot to check it (screenshots hang on this app; use raw Playwright with
   `animations:'disabled'`, `caret:'hide'`, and `.screenshot()` on the `.rail` element).
3. `node scripts/build-insights-review-artifact.mjs` → publish to the SAME artifact URL.
4. Commit atomically.

### Traps this session hit — they will cost you an hour each

- **Duplicate class names silently break layout.** `.win` was used for both the answer block's
  positive-emphasis span and the post-window strip; `display:flex` on the strip turned a
  `<span class="win">` inside a paragraph into a flex container and blew a 2-line paragraph to 5.
  The header measured 342px instead of 283px and I nearly redesigned the copy to fix it.
  **Measure the sub-blocks before rewriting anything.**
- **`.foot` and `.lede` are cascade collisions** between the scaffolding column and the rail. `.foot`
  is the rail's own "How to read these numbers" row — the aside uses `.note-foot`. And the mockup's
  `.ctl>p` (0,1,1) beats a bare `.lede` (0,1,0), hence `.ctl p.lede`. Both are commented in place.
- **The hero stills are cropped from the shipped screenshots**, which carry the shipped surface's
  own baked chrome. Two `.mask` bands paint it out. **Geometry** (1x coords of the reference PNGs):
  the cortex window is source y 112→375 at scale 1.0266 (`width:452px;left:-33px;top:-115px`), masks
  28px top / 42px bottom; the baked corner label sits at y 120–136 and the baked verdict chip at
  y 336–365, so any reframing must clear both. The terrain is `width:739px;left:-180px;top:-294px`
  with a 4px bottom mask. **If you change `hero()`, update `CROP` in the build script to match.**
- **Verify the artifact with all network blocked**, not just locally — that is the condition the CSP
  actually imposes. `ctx.route('**://**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort())`.
- **`document.fonts.check()` is false for a face not yet used on screen.** To prove a webfont really
  rendered, measure a string's width against a forced fallback (Newsreader 321.7 vs Georgia 324.2 vs
  Inter 350.1 at 40px) — a computed `font-family` proves nothing.

### What is already settled — do not relitigate

- The hero stays. §0. This is the whole reason rev 6 exists.
- Rev 5's chrome below the hero stays: filled `#212120` cards with no border, chips, segmented
  control, sentence-case labels, zero uppercase-mono.
- The persistent answer block stays above the tabs.
- Video and text are inverse instruments (§3.3) — video has the timeline and no voices, text has the
  voices and no timeline. Neither side is stubbed.
- Benchmarks are always the creator's own catalogue, never an industry band (§5.2).
- The cortex grounding is DONE and merged into this branch (§9). Do not re-do it.

### The four calls most likely to be adjusted

They are listed in the mockup's own scaffolding column, so the owner was reading them while
reviewing: the cut signal-cost ladder · coral on one reason bar instead of three · the 283px header
that forced a one-line ellipsised title · Engagement leading with the terrain re-lit a third time.

---

## 11. Rev 7 — the three tabs rebuilt metric-first (2026-08-01)

**The owner's rev 6 critique** (given verbatim as the rev 7 brief): the three tab cards read as
walls of text, not a good UX; UI not intentional enough; information not clean; below the
Claude/Perplexity/ChatGPT bar. Keeps: "the concept of having the brain, population nodes, video as
hero" and the TikTok/IG reference idiom (retention, watch time — the metrics that matter).

**What rev 7 did** (same file, `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` —
edited in place so the build script and artifact URL keep working; title now says rev 7):

- **De-prosed.** Every `.read`/`.sub`/`.herofoot` paragraph and the unlock section are gone. Each
  card now ends in exactly ONE `.insight` line; each fact appears exactly once (rev 6 stated the
  fix twice and "62% leave" three times).
- **Key-metric tiles** (`.tiles`/`.tile`) — the TikTok "Key metrics" idiom: label · big number ·
  delta vs the creator's own median. Used on Overview (hook/avg watch/full/rewatch) and Engagement
  (saves/shares/comments/follows). Coral marks the ONE dominant loss per screen (`.bad`); lesser
  misses keep a quiet ↓.
- **Three heroes, no repeats** — cortex on Overview, terrain on Audience, **the post itself on
  Engagement** (resolves §10's "terrain re-lit a third time"). The video hero is an inline-SVG
  striped placeholder + play chip in the mockup; the build renders the drill's real cover. Cortex
  and terrain framing UNCHANGED — the build script's `CROP` still matches.
- Each hero's verdict chip states that tab's headline: `38% would stop` · `90% non-followers` ·
  `1.4% would share`.
- **Transcript is one line** (`.tstrip`), playhead-synced with the current word centred — rev 6's
  five-line grey block is gone. Nets row now carries live % values.
- Audience leads with **"Who watches — and how long"**: pool mix bar + per-pool retention rows
  in one card (right-meta: "no platform reports this"). Pills replaced by `.lg` legend rows.

Verified: all six states screenshotted (`rev7-*.png` in `reference-2026-08-01/`), one-playhead
sync probed (clock/readout/nets/strip move together), computed-style law walk = 0 violations,
artifact re-verified under a full network block with fonts proven by width (Newsreader 437.1 vs
Georgia 456.3 @40px — remember to `document.fonts.load()` first, the §10 trap). Republished to the
SAME review URL. React implementation still deliberately not started.

**Rev 7.1 (same day).** The owner, on rev 7: *"nobody wants to read all these sentences — it
doesn't feel nice to read the UI."* Even one sentence per card was too much. So: every `.insight`
became a **≤6-word takeaway fragment** ("Only the hook is broken." · "Who stays, stays to the
end." · "Recognition, not disagreement.") or was deleted outright (pools-for-text, Best window —
whose answer moved into its card header meta: `Tue · 7–9pm`). The retention read is now **pinned
on the figure** (`.anno`, "62% gone by 0:03" at the break — the YouTube key-moments idiom) instead
of written under it, and the answer-block body shrank to one clause. Tab heights dropped 80–130px.
The copy bar going forward: **numbers in tiles, type only points — no clauses.**

**Rev 7.2 (same day).** Owner, with a screenshot of the pinned header and the TikTok Studio
screens: *"I don't like this fixed header at all — remove it or make it content on pages"*, and
*"declutter the pages."* So: **⚠️ the rev-5 "persistent answer, never behind a tab" decision is
REVERSED by the owner** — do not restore it. The pinned strip is now nav + tabs only (283px →
102px, the TikTok chrome); the identity row and the answer block render at the top of every tab's
scroll content (`identBlock()`/`answerBlock()`). Declutter pass: card headers are plain text (no
icons), right-metas survive only where the label IS data ("vs your last 41" · the live scrub
readout · "Tue · 7–9pm"), the 41-tick catalogue strip is gone (the hook tile's delta carries it),
the curve legend is gone ("your median" is labeled inside the figure).

**Rev 7.3 (same day).** Owner, circling the identity+answer block that 7.2 repeated per tab:
*"we don't need this on every page and it shouldn't be the hero — audit and review the structure
from the [TikTok] screenshot; retention and video metrics should be combined with the video
playing."* The structural audit against the TikTok screens produced:

- **Identity once, above the tabs** — it scrolls away; the tabs are `position:sticky` inside the
  scroll (`.tabbar`), TikTok's exact chrome. Pinned strip = nav row only.
- **The answer appears exactly once**, inside Overview's Retention card — the slot TikTok gives
  its "viewers watched 14% of your video" sentence. On Text it leads "Why they stopped" instead.
- **Retention is THE instrument**: verdict + fix chip + the playing post (`.vmini`, 132×234
  centred like TikTok's) + curve + moments + one-line transcript, one card, one timeline.
- **Traffic sources moved to Overview** (`surfaceCard()`) — TikTok has them there.
- **Engagement is a figure-less numbers page** (reaction tiles + best window; + voices on Text) —
  each figure appears exactly once: cortex/Overview, room/Audience, post/Retention.
- The nets meter row and `groundedDrive()` demo are deleted from the mockup — the shipped
  `driveFor()` wiring in src is untouched; the live CortexCanvas is its own readout.

Probes: sticky verified at scrollTop 400, exactly one `.answer`/`.ident` in the DOM, scrub still
drives clock + readout + transcript, law walk 0. Tab heights: Overview absorbed the instrument
(1716px), Engagement slimmed to 868px.

**Rev 7.4 (same day).** Owner, circling the Retention instrument: *"this should be the hero on the
Engagement page, right? think about all the pages — the information should be for the best UX and
user value."* Confirmed and applied — **one job per page**:

- **Overview = the TL;DR**: cortex hero → the answer (verdict + fix chip, its ONLY home) → Key
  metrics tiles → traffic sources.
- **Audience = who**: unchanged.
- **Engagement = how they engaged**: the Retention instrument LEADS (second-by-second watching IS
  engagement) → reaction tiles → best window. On Text, the voices lead instead (its instrument).
- The scrubber moved with the instrument — `paint()` now binds it on `engagement`+`video`. The
  cortex clock on Overview is static `t = 0:02` (the still opens on the break).

Page weights after: 1219 / 1146 / 1221px — near-equal. Probes re-run: scrub on Engagement drives
readout + transcript, one `.answer` (Overview only), law walk 0.

**Rev 7.5 (same day) — the audit pass.** Owner asked for a UX/user-value/flow audit; 12 findings,
all applied on their "all":

- **The fix chip ROUTES** (`fixJump()`): video → Engagement with the instrument parked on the
  break; text → smooth-scrolls to `#reasons`. Verdict → evidence → action. The chip is a real
  `<button>` now.
- **The pager is a stepper** — ‹ › walk the room's drills (in the mockup: the two fixtures, which
  is why video is "2 of 5" and text "4 of 5"). Back label fixed: `← The room` (was a collision
  with the Overview tab).
- **The frame answers the scrubber** — `.vprog` progress line on the mini video, synced to `ph`;
  in the build the real video seeks.
- Overview's cortex corner reads **"at the break"** (the frozen `t = 0:02` clock read as stuck
  once the scrubber left the page).
- Stat row carries a quiet **"projected"** tag (it reads as real TikTok analytics otherwise).
- "Stopped" → **"Stopped to watch"** (dm `.nm` 100→112px) · Best-window's **7–9pm sits on the Tue
  bar** (meta softened to "followers online") · "your median" label moved **below** the dash ·
  tile deltas bumped `--faint`→`--dim` · moment chips 6→8px pad · text-Overview's duplicate 41%
  tile dropped (tiles = Novel to them · Would finish, the `t3` grid died with it).

Probed, not assumed: fix-chip jump lands on Engagement at `0:02 · 58%` with vprog 7.1%; scrub to
0:21 → vprog 75%; pgNext steps 2 of 5 → 4 of 5 with the title swapping; text fix scrolls body
288px; law walk 0.

---

## 12. Rev 8 kickoff — SUPERSEDED, start at §13

Rev 7.5 is on the review artifact awaiting the owner's next adjustments. This session (2026-08-01,
slot-b) ran six owner-directed revisions — each was published to the SAME artifact URL, committed
atomically, and recorded in §11. Read this section, then §0 (why revs 3/4/5 died), §11 (what
each 7.x did and WHY — the owner's words are quoted), §6 (the laws). §10 is superseded.

### Where everything is

| | |
|---|---|
| Worktree · branch | `~/virtuna-slot-b` · `task/insights-rework` — do not switch branches |
| PR | **#412**, open. Tip `cdfd50cb` = rev 7.5. |
| The mockup | `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` — **one file is everything** (rail + review scaffolding). Filename still says rev6 on purpose: the build script and this doc point at it; the `<title>` says rev 7. Open directly, no server. |
| The review link | https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3 — republish to THIS url or the owner's link dies |
| Rebuild the link | `node scripts/build-insights-review-artifact.mjs` → publish output (`$TMPDIR/insights-review.html`) with the Artifact tool passing that URL as `url`. Favicon 🧠, title "Insights rev 7 — metric-first tabs". |
| Screenshots | `docs/mockups/reference-2026-08-01/rev7-*.png` (6 states, current = 7.5) |
| Live shipped rail | `/ambient-v2` → `② brain` → creator chips. No auth. Port 3002. |
| React implementation | **deliberately NOT started** (task #3) — five revs were rejected before rev 6; implementation is the expensive step. |

### The structure as of rev 7.5 (the owner shaped every piece of this — do not undo silently)

Pinned chrome = nav row only (`← The room` + the ‹ 2 of 5 › **stepper**, which walks the room's
drills — in the mockup it toggles the two fixtures). Identity (thumb · title · TikTok 5-stat row +
"projected" tag) renders ONCE above the tabs and scrolls away; the tabs are `position:sticky`
inside the scroll (`.tabbar`). One job per page:

- **Overview = the TL;DR.** Cortex hero (corner: "at the break") → the answer block (verdict +
  one clause + **fix chip**, its ONLY home) → Key metrics tiles → Where it would surface.
- **Audience = who.** Terrain hero (chip: 90% non-followers) → "Who watches — and how long"
  (mix bar + per-pool retention sparks + drop times) → "What they did" dot-matrix.
- **Engagement = how they engaged.** The Retention instrument LEADS: mini video (`.vmini`, with a
  playhead-synced progress line) + curve (annotated ON the figure: "62% gone by 0:03", "your
  median") + moment chips + one-line transcript. Then Projected reaction tiles → Best window
  (7–9pm sits on the Tue bar).
- **Text inverts** (§3.3): no timeline anywhere; Engagement leads with the VOICES; Overview's
  answer leads to "Why they stopped" (reason bars); Key metrics = Novel to them · Would finish.
- **The fix chip ROUTES** (`fixJump()`): video → Engagement parked on the break; text → scrolls
  to `#reasons`. Verdict → evidence → action.

### Settled THIS session — the owner said each of these explicitly

1. **No sentences in the UI.** Takeaways are ≤6-word fragments or nothing; numbers live in tiles;
   reads are annotated ON figures. ("nobody wants to read all these sentences")
2. **The answer block is NOT pinned and NOT repeated** — the rev-5 "persistent answer" decision
   is owner-REVERSED. It appears once, on Overview, as content.
3. **TikTok Studio is the structural reference** — identity once above sticky tabs, plain-text
   card headers (no icons), right-meta only where the label IS data.
4. **Retention + the playing video are ONE instrument, and it is Engagement's hero.**
5. Each figure appears exactly once: cortex/Overview, room/Audience, post/Engagement.
6. Still standing from before: hero restored (§0), figures may carry a colormap while chrome
   stays one-accent, benchmarks vs the creator's own catalogue only, 440px matte rail (§6).

### The loop for an adjustment

1. Edit the mockup (one file).
2. Screenshot all six states + probe interactions. The shoot script is deleted after each use —
   recreate at `scripts/tmp-shoot-rev7.mjs` (a Write to the scratchpad is BLOCKED by a
   worktree-path-guard hook; write inside the repo and `rm` after). Pattern: raw Playwright,
   `deviceScaleFactor:2`, per state set `.rail` height to `body.scrollHeight + body.offsetTop`,
   `.screenshot({animations:'disabled',caret:'hide'})` on `.rail`, then probe (fix-chip jump,
   scrub → `#retro`/`#vprog`/`#tin`, pager step) and walk computed style for
   backgroundImage/boxShadow/backdropFilter = 0.
3. `node scripts/build-insights-review-artifact.mjs` → Artifact tool with the URL above.
4. Commit atomically (auto-push hook runs; verify `git rev-parse origin/task/insights-rework`).

### Traps (all hit this session; §10's list still applies too)

- **The path-guard hook** rejects Write/Edit outside the worktree — including the session
  scratchpad AND the memory directory. For memory files use `python3` via Bash.
- **The build script's `CROP` is coupled to `hero()`'s img framing** — unchanged since rev 6; if
  you reframe, update both. It THROWS if the img regex misses, and refuses leftover
  `reference-2026-08-01` refs (that's why `.vmini` is an inline SVG pattern, id `vs`).
- **`document.fonts.check()`/ready lies for unused faces** — `document.fonts.load('400 40px
  Newsreader')` FIRST, then compare widths vs Georgia (Newsreader ~437 vs Georgia ~456 @40px on
  "The room stays to the end").
- **Verify the artifact with ALL network blocked** (`ctx.route`), not just locally.
- The two fixtures ARE pager positions 2 and 5 — the stepper toggles `kind`; keep `D[kind].pager`
  consistent if you add fixtures.
- Duplicate class names silently break layout (`.win`, `.foot`, `.lede` — see §10 list).

### For the implementation session (when the owner approves)

- `fixJump()` = tab switch + `ph` park; in src this is rail tab state + a seek on the real video.
- `.vprog` → the real `<video>` seeks with the scrubber (owner: "combined with the video playing").
- Sticky `.tabbar` needs an opaque rail fill inside the scroll container.
- §9's HRF warning stands: a free-running grounded cortex opens washed out — offset past
  `HRF_PEAK_S` or hand the playhead to the user.
- §3.2 (unlock absent on real video drills) is addressed BY the answer-block fix chip — wire
  `buildVideoDomainTemplate` accordingly.

---

## 13. Rev 9 kickoff — START HERE

Rev 8.1 is on the review artifact awaiting the owner's next adjustments. Read this section, then
§0 (why revs 3/4/5 died — never delete the hero figure), §6 (the laws), §11 (the 7.x arc, owner's
words quoted). §10 and §12 are superseded; §12's *traps* and *loop* still apply verbatim.

### Where everything is

| | |
|---|---|
| Worktree · branch | `~/virtuna-slot-b` · `task/insights-rework` — do not switch branches |
| PR | **#412**, open. Tip = rev 8.1. |
| The mockup | `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` — **one file is everything**. Filename still says rev6 on purpose (the build script + this doc point at it); the `<title>` says rev 8. Open directly, no server. |
| The review link | https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3 — republish to THIS url or the owner's link dies |
| Rebuild the link | `node scripts/build-insights-review-artifact.mjs` → publish `$TMPDIR/insights-review.html` with the Artifact tool passing that URL as `url`. Favicon 🧠. |
| Shipped-vs-mock bench | https://claude.ai/code/artifact/c21c62c2-7a03-48ae-89e4-69f7e0f869f1 · rebuild with `node scripts/build-insights-compare-artifact.mjs` (a SEPARATE url — never publish the mock to it) |
| Screenshots | `docs/mockups/reference-2026-08-01/rev8-*.png` (10 states) · `live-*.png` (4 shipped-rail states) |
| Live shipped rail | `/ambient-v2` → `② brain` → creator chips. No auth. Port 3002. |
| React implementation | **still deliberately NOT started** (task #3). |

### The structure as of rev 8.1

Pinned chrome = nav row only. Identity (thumb · title · **dimmed** projected stat row · "projected"
tag) renders ONCE above the tabs and scrolls away; tabs are `position:sticky` inside the scroll.
Three pages, one job each — **`brain` · `audience` · `engagement`** (page 1 was renamed from
Overview to **Brain** by the owner 2026-08-01; the tab id was renamed with the label on purpose,
see the trap list below).

- **Brain** — cortex hero (states the loss: `62% · leave by 0:03`, plus an on-figure read
  `0:03 · 38% still watching`) → the answer block (verdict + one clause + **the fix button**, its
  ONLY home) → Key metrics tiles → Where it would surface → the method drawer.
- **Audience** — terrain hero → "Who watches — and how long" → "What they did", whose rows are
  **tappable and speak** (a serif verbatim per segment).
- **Engagement** — the Retention instrument leads (mini post + playhead-synced progress line +
  curve + moment chips + one-line transcript) → Projected reaction → Best window.
- **Text inverts** (§3.3): no timeline; Engagement leads with the VOICES; Brain's answer leads to
  "Why they stopped".

### What rev 8 changed, and the evidence for each

1. **The fix ACTS.** `domain-template.ts:289` types unlock as `{lever,gain,insight}` — text, no
   handler — while the v1 room already ships an `onRewrite` that re-simulates and returns a fresh
   stop count. Pressing the fix now re-runs: answer → before/after (`62% → 11%`), cortex corner
   → "after the trim", tiles flip to ↑, Engagement redraws `TRIMMED` with `CURVE` kept as a coral
   ghost, clip → 0:25, transcript slices `TRIM_WORDS`. **Undo** restores all of it.
2. **One unit — "share of the room still watching".** This fixed a live contradiction: the hero
   read `38% · would stop` above an answer saying "62% leave", but `CURVE[3]=.38` is who **stays**,
   and `ROOM`'s "Stopped to watch" means stopped *scrolling* (the good outcome). Moment chips were
   labelled `38` at 0:02 where the curve says 58. All reconciled.
3. **The instrument folds, it is not deleted.** `brain-signals.ts` states the nine signals are
   derived from the same seven networks the σ bars show raw — one quantity, two scales, stacked.
   Nine signals + σ bars + the per-second grid now live behind "How these numbers are made".
   **Zero coral in the drawer**: that file calls the grades "a cutoff on a MODELED signal, NOT a
   benchmark against real outcomes". The σ bars gained the **zero centre line** the shipped ones
   lack — a z-score bar without one cannot be read.
4. **Coral once per screen** (measured, see the probe below). Tiles, insights, dot rows and moment
   chips all gave it up; loss reads by position and weight.
5. **The stat row is dimmed** to 11.5px faint — projections for an unposted video must not be the
   loudest data on the page.
6. **The primary is cream-filled** — the system says active is cream on a lighter fill, never coral.
7. **An action bar carries the fix** on Audience and Engagement, which hold no fix control of their
   own, and goes quiet once applied.

### Still open — the recommendations rev 8 did NOT take

- **§3.2 stands:** `AmbientOverviewRail.tsx:467` calls `buildVideoDomainTemplate` without `reasons`,
  so the unlock never renders on a real video drill. Rev 8 designs the fix as the page's primary
  control, which makes this a **blocker for implementation**, not a nicety.
- **The cortex does not repaint after the trim** in the mockup (same still, corner says "after the
  trim"). In the build it must repaint from the new curve — `grounded` mode already takes
  `retentionAt(u)` and that wiring shipped (§9).
- **Text-sim dead rows**: the shipped rail renders VISUAL/AUDIO/FACE for a text concept and then
  explains they are empty. Rev 8's drawer shows them flat with a note; deciding whether they should
  render at all is still open.
- Owner has not yet ruled on which of the seven shipped-only blocks (§ the bench) stay demoted.

### Traps (all hit; §12's list still applies in full)

- **The path-guard hook** rejects Write/Edit outside the worktree — including the session
  scratchpad AND the memory directory. Use `python3` via Bash for memory files; write temp scripts
  **inside** the repo (`scripts/tmp-*.mjs`) and `rm` them after.
- **`import { chromium } from '.../playwright/index.js'` FAILS** — it is CommonJS. Use
  `import pw from ...; const { chromium } = pw;`.
- **The shipped rail reveals on scroll** (`opacity:0/translateY(20px)` → 1). Any capture that
  expands the scroller without walking it renders the signal grid and heatmap as **blank voids**.
  Walk the scroller, then force survivors to the end state. This nearly shipped a false comparison.
- **A launchd reaper kills the dev server after ~10 min idle** — `lsof -ti:3002` before blaming code.
- **Do not guess a scroll offset for sticky UI — measure it.** Rev 8's action bar was first written
  to appear once the answer scrolled away; that rule fires **never** (at an 812px rail, Brain is
  1127px in a 772px viewport → max scroll 354px, answer at 418px). The working rule is "show it
  when no `.fix` is reachable on screen".
- **Tab label and tab id were renamed together.** A UI reading "Brain" over `tab==="overview"` is
  the two-namespace drift this repo has been bitten by twice (see the run-header and start-tile
  traps). `data-tab`, `tab`, `brainTab()` and the `TILES.*Brain*` keys all say `brain`.
- The build script's `CROP` is coupled to `hero()`'s img framing — unchanged since rev 6. It THROWS
  if the img regex misses and refuses leftover `reference-2026-08-01` refs.
- `document.fonts.check()` lies for unused faces — `document.fonts.load()` FIRST, then compare
  widths (Newsreader ~437.1 vs Georgia ~456.3 @40px on "The room stays to the end").
- **Verify the artifact with ALL network blocked** (`ctx.route`), not just locally.

### The loop for an adjustment

1. Edit the mockup (one file).
2. Re-shoot the states + probe interactions. Recreate the shoot at `scripts/tmp-*.mjs`, `rm` after.
   Probe pattern: raw Playwright, `deviceScaleFactor:2`, set `.rail` height to
   `body.scrollHeight + 120`, `.screenshot({animations:'disabled',caret:'hide'})` on `.rail`, then
   walk computed style for `backgroundImage`/`boxShadow`/`backdropFilter` = 0 and count coral zones.
3. `node scripts/build-insights-review-artifact.mjs` → Artifact tool with the URL above.
4. Commit atomically (auto-push hook runs; verify `git rev-parse origin/task/insights-rework`).

---

## 14. Rev 9 — each page answers its own question (2026-08-02)

**The owner's brief** (verbatim intent): review what renders live on the brain + population pages
and audit the sketch's three pages — "we have a lot of metrics which maybe should be on another
page better, and we have some stuff that's missing on the brain page"; refine for UI/UX/user
value/flow.

**The audit confirmed the diagnosis exactly.** The page the owner renamed *Brain* contained no
brain: its two content cards were watch metrics (readings of Engagement's retention instrument)
and traffic sources (a who/where fact). The live brain tab's actual brain material — the
plain-word network reads, the moment-anchored synthesis — existed in the mock only as raw σ bars
inside the drawer. Fresh live captures (post-grounding): `live-*.png`, re-shot 2026-08-02.

**What moved (all in the one mockup file):**
- **Key metrics → Engagement**, under the Retention instrument, 3-up (`.tiles.t3`). "Watched past
  0:03" DIED in the move — the curve's anno + hero figread already state it; one fact, once.
  Its insight ("Only the hook is broken") became Brain's third beat.
- **Where it would surface → Audience** (video only) · **Best window → Audience** (both kinds —
  TikTok keeps best-time-to-post under Followers).
- **NEW "What the brain saw" on Brain** (video only — text's brain read stays the reason bars,
  §3.3 inversion): three time-anchored beats (`BEATS`), no numbers (every % it could show already
  lives in figread/answer), break beat reads by weight, not coral. Sourced from the live rail's
  material: visual +0.35σ open, dorsal −0.73σ at the break, the flat tail of CURVE.
- **The swing restored** as a `.swline` riding the Almost segment's voice ("Win these 201:
  stopped 38% → 47%" — the live rail's numbers). "tap to hear them" meta → "1,000 simulated"
  (right-meta only where the label IS data, the 7.2 rule).
- **The drawer names its calibration** — "your 4.2k followers · confidence 0.82" (the shipped
  trust strip the mock had dropped).

Verified: 11 states re-shot (`rev9-*.png`), 28 probes PASS (structure, scrub sync, applied-state
flips incl. watch tiles via `setTab` — NOTE: probing applied-state across tabs must use `setTab`,
`setKind` resets `applied`), law walk 0 violations, ≤1 coral zone per page, artifact re-verified
under full network block. Republished to the SAME review URL.

**Live-only bugs found during the audit** (for the implementation session):
- `AudienceDepth` amplification kicker renders "WHO SPREADS ITMODELED REACH" — kicker and tag
  collide, no separator.
- The text fixture reuses one quote across two coded reasons twice over ("took too long…" on both
  Strong hook ×224 AND Too slow ×63; "curious enough…" on both On-topic interest AND Weak hook) —
  and "Strong hook" sits in the LEAKING (coral) half, which reads as polarity drift.
- Still open from §13: §3.2 (reasons absent on real video drills — blocker), cortex repaint after
  trim, text-sim dead rows, the seven shipped-only blocks awaiting the owner's ruling (amplification
  ×5.1 and audience-fit index bars are the two with real user value not yet in the mock).

### Rev 9.1 (2026-08-02) — the shipped rail's value blocks return

Owner: *"improve the sketch with everything we can add from what's currently rendering in the
rail… add everything which you think is good… as high user value as possible."* This settles the
§14 open question on the shipped-only blocks:

- **Who this is for** (live `IndexBars`) and **Who spreads it** (live `Amplification`) join
  Audience, restyled from mono-uppercase into the card grammar (`.fx` rows; the ×5.1 flow reuses
  `.delta` on a chip fill). Segment names use the ROOM namespace (learners/drive-by — the live
  fixture's scrollers/drop-ins would be a second namespace). Negative index / sub-1× = `.low`
  (faint), never coral — Audience keeps its one coral (For You's 0:02).
- **Audience page order** = the who-story: who's here → how long → what they did → who it's for →
  who spreads it → where it surfaces → when to post.
- **Every voice carries "interview ›"** (`.ivw`) — the shipped PersonaChatDrawer/onInterview
  affordance the mock never surfaced.
- **Drawer honesty** gains "calibrated for engagement, not purchase" (the live RoomStrip clause).
- **Unit fix:** text figread said "590 simulated readers"; the room codes from 1,000 everywhere
  (590 = who read past the hook, the "218 of 590" denominator). Now "1,000 simulated readers".
- **Left out on purpose:** the tri-state row (38/62 = hero + answer, one fact once) and the
  unlock explainer prose (covered by the answer + beat 2). Both listed as reversible calls on
  the artifact.

16 probes PASS (incl. fit/spread order, low≠coral, interview counts, applied-flow intact), law
walk 0 violations, artifact re-verified offline, republished to the SAME url.

### Rev 9.2 (2026-08-02) — Brain is the instrument again

Owner, after viewing the LIVE brain tab beside the sketch: *"add most of the UI from 'the brain'
page back into the sketch for the brain. and i want the brain to run of the cortex canvas and
retention as before"* + the standing rule *"each page should be dedicated and optimized to its
purpose, each section and page refined to UX and user value / flow."*

**Rev 8 folded the instrument into the drawer so the surface would speak one unit. That was the
wrong cure** — it left the Brain tab thinner than the shipped one it was replacing. The instrument
is back on the surface; the unit problem is solved instead by each card's right-meta NAMING its
scale (`0–100 · vs your baseline`, `z-scored · at the playhead`, `28s · 10 systems`).

**Brain now runs headline → when → what → substrate**, and every block on it is brain material:
cortex hero (its corner is a live `t = 0:0X`) → the two networks that matter in words (`.nread`,
the shipped line) → the answer + fix → **The moment** (curve-as-scrubber + moment chips +
transcript) → **Signal breakdown** (the nine, 3×3, score · delta · grade) → **Network activation**
(seven σ bars, zero centre line, each with its plain-word read inline) → **Activation per second**
(10-system heatmap + ramp legend).

- **ONE PLAYHEAD** drives the cortex clock, the hero's figread, the curve, the moment chips and
  the transcript — and Engagement's video frame is already parked at the same second on arrival
  (`ph` is global; `paint()` binds the scrubber on Brain and reads it everywhere).
- **The curve moved Brain-ward from Engagement.** Where attention broke is a cognition question.
  Engagement keeps the video frame + watch tiles + projected reaction ("What they watched" →
  "Projected reaction"): each figure still appears exactly once (cortex+curve/Brain, terrain/
  Audience, post/Engagement).
- **"See the evidence" scrolls instead of routing** — the evidence is now directly below.
- **The drawer stopped duplicating and started explaining**: the three scales on the page + what
  the model cannot claim. Renamed "How to read these numbers" (the shipped label).
- **Grades stay colourless** (live paints WEAKNESS coral) — an unbenchmarked cutoff must not
  shout, and Brain's one coral belongs to the loss. Text Brain keeps the whole instrument, with
  reason bars in the moment's slot and the dead VISUAL/AUDIO/FACE rows explained.
- Deleted with their last caller: `BEATS`/`beatsCard`/`.beat` (rev 9's stand-in — the real
  material supersedes it) and `TILES.textBrain*`.

27 probes PASS, law walk 0 violations (Brain carries 2 coral zones — the answer and the curve
break, which are one claim said once and located once), no JS errors, artifact re-verified
offline. Page heights 1801/1989/996 (video), 1839/1666/1084 (text).

### Rev 9.3 (2026-08-02) — retention back to Engagement, and the tab order settled

Owner: *"lets move retention again into engagement tab. and how do we want to order the tabs
best?"*

**Retention returned to Engagement** (reverting 9.2's move, keeping everything else 9.2 added).
It is what the room DID with the clip second by second, so it belongs with the video that produced
it and the outcomes it explains; Brain keeps the cognitive read of the same clip. Engagement =
Retention instrument (video frame + curve + chips + transcript) → Key metrics (the 3 watch tiles)
→ Projected reaction. Brain's cortex corner is `at the break` again (no scrubber on that page —
rev 7.5's fix for a clock that reads as stuck), and `seeEvidence()` routes to Engagement again.

**Tab order is now `Brain · Engagement · Audience`** — proposed and applied this session, easy to
flip. The reasoning, so it doesn't get re-litigated blind:
1. **The answer's evidence is the retention curve**, so verdict and proof are adjacent — "See the
   evidence →" steps ONE tab right instead of skipping over Audience.
2. **Brain and Engagement are both about the CLIP; Audience is about the ROOM.** Grouping the two
   content pages beats interleaving content · people · content.
3. **Scope widens left to right** — the clip → the clip over time → the room around it.
⚠️ Both the rail `.seg` and the review-panel `.ctl [data-tab]` carry the order; a probe asserts
they match, because a control panel that disagrees with the rail is the two-namespace trap again.

26 probes PASS, law walk 0 violations and now **exactly one coral zone on every page** (9.2's
Brain carried two — the answer plus the curve break; moving the curve off resolved it). Heights
1504/1249/1989 (video), 1839/1084/1666 (text). Artifact republished to the SAME url.

---

## 15. Rev 10 kickoff — START HERE (refine, then IMPLEMENT)

Rev **9.3** is on the review artifact. This session (2026-08-02, slot-b) ran the page-job audit and
four revisions — 9 · 9.1 · 9.2 · 9.3, all recorded in §14, all published to the SAME url.
Read this section, then §14 (what each rev did and why), then §0 (never delete the hero figure),
§6 (the laws), §11 (the 7.x arc — the owner's words are quoted there and still bind).
§10, §12 and §13 are superseded; §12's and §13's **trap lists still apply in full**.

### Where everything is

| | |
|---|---|
| Worktree · branch | `~/virtuna-slot-b` · `task/insights-rework` — **do not switch branches** |
| PR | **#412**, open. Tip = rev 9.3 (`5e47ca13`). |
| The mockup | `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` — **one file is everything**. Filename says rev6 on purpose (build script + this doc point at it); `<title>` says 9.3. Open directly, no server. |
| The review link | https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3 — republish to THIS url or the owner's link dies |
| Rebuild the link | `node scripts/build-insights-review-artifact.mjs` → Artifact tool with that url as `url`, favicon 🧠 |
| Shipped-vs-mock bench | https://claude.ai/code/artifact/c21c62c2-7a03-48ae-89e4-69f7e0f869f1 · `scripts/build-insights-compare-artifact.mjs` (SEPARATE url — never publish the mock to it) |
| Screenshots | `docs/mockups/reference-2026-08-01/rev9-*.png` (11 states, current = 9.3) · `live-*.png` (4 live-rail states, re-shot 2026-08-02 post-grounding) |
| Live shipped rail | `/ambient-v2` → `② brain` → creator chips. No auth. Port 3002. |

### The structure as of rev 9.3

Pinned chrome = nav row only (`← The room` + the ‹ 2 of 5 › stepper). Identity (thumb · title ·
**dimmed** projected stat row · "projected" tag) renders ONCE above the tabs and scrolls away;
tabs are `position:sticky` inside the scroll. **Tab order `brain · engagement · audience`** —
verdict next to its evidence, the two CLIP pages grouped against the ROOM page, scope widening
left to right (§14 rev 9.3 has the full reasoning).

- **Brain — why it happened in the head.** Cortex hero (corner "at the break") → the two networks
  that matter in words (`.nread`) → the answer block (verdict + one clause + **the fix**, its ONLY
  home) → Signal breakdown (nine, 3×3, score · delta · colourless grade) → Network activation
  (7 σ bars, zero centre line, plain-word read inline) → Activation per second (10-system heatmap)
  → the drawer.
- **Engagement — what they did with it.** Retention instrument (video frame + curve-as-scrubber +
  moment chips + one-line transcript, ONE playhead) → Key metrics (avg watch · watched full ·
  rewatch) → Projected reaction.
- **Audience — who was in the room.** Terrain hero → Who watches and how long → What they did
  (rows tap open a serif verbatim + `interview ›`, the "Almost" row carries the swing) → Who this
  is for (index vs room average) → Who spreads it (saw → reshared → networks, ×5.1) → Where it
  would surface → Best window.
- **Text inverts** (§3.3): no timeline; Brain's moment slot becomes "Why they stopped" reason bars
  and the instrument continues below it; Engagement leads with the VOICES; no traffic card.
- **The fix ACTS** — re-simulates: answer → before/after, curve redraws with the original kept as
  a coral ghost, tiles flip, clip 0:28 → 0:25, transcript slices `TRIM_WORDS`. **Undo** restores.

### Settled this session — do not silently undo

1. **Each page answers ONE question**, and a block lives on the page whose question it answers.
   That test moved the watch tiles, traffic, and Best window in rev 9 and it is the standing rule.
2. **Fix mixed units by NAMING each scale in the card's right-meta, never by hiding the block.**
   Rev 8 hid the instrument in a drawer to keep one unit; the owner called the result too thin.
3. **The instrument belongs on Brain** (nine signals · σ bars · per-second heatmap · the network
   read line). The drawer explains the three scales and what the model can't claim — it holds no
   copy of the instrument.
4. **Retention is Engagement's** (owner, twice). Brain keeps the cognitive read of the same clip.
5. **Grades carry no colour**; **one coral zone per page** — every page satisfies this at 9.3.
6. Standing from before: hero restored (§0), figures may carry a colormap while chrome stays
   one-accent, benchmarks vs the creator's own catalogue only, 440px matte rail (§6), no sentences
   in the UI (≤6-word fragments), answer appears once and is NOT pinned.

### Open — the owner has not ruled

- **§3.2 is a BLOCKER for implementation.** `AmbientOverviewRail.tsx:467` calls
  `buildVideoDomainTemplate({...})` with no `reasons`, so `modeledUnlock(classifyReasons(undefined))`
  → `[]` → `undefined`: the unlock never renders on a real video drill. The mock makes the fix the
  page's primary control, so this must be wired before the design can ship.
- **The cortex does not repaint after the trim** in the mockup (same still, corner says "after the
  trim"). In the build it must repaint from the new curve — `grounded` mode already takes
  `retentionAt(u)` and that wiring shipped (§9).
- **Text-sim dead rows** — VISUAL/AUDIO/FACE render flat with a note; whether they should render
  at all is undecided.
- **Live-only defects found in the audit** (all still present in `src`):
  `AudienceDepth` amplification kicker renders **"WHO SPREADS ITMODELED REACH"** (kicker and tag
  collide, no separator) · the text fixture **reuses one quote across two coded reasons, twice**
  ("took too long…" on Strong hook ×224 AND Too slow ×63; "curious enough…" on On-topic interest
  AND Weak hook) · **"Strong hook" sits in the LEAKING (coral) half**, which reads as polarity drift.

### Implementation map — READ BEFORE WRITING ANY `src/`

**The shipped rail has TWO tabs; the mock has THREE.** `AmbientDetail.tsx:257` is
`type Tab = "brain" | "audience"` and `:361` hardcodes `(["brain","audience"] as const).map(...)`.
Adding Engagement touches the type, that map, the label ternary (`:374`), the `dim` availability
logic, and the body switch (`:385+`).

| Piece | Where it lives now |
|---|---|
| Rail shell · `TONE` palette · tabs · scroller | `src/components/audience-lens/v2/AmbientDetail.tsx` (440px, `#181817`, one left hairline) |
| Brain page | `BrainTab.tsx` → `BrainFrame`: `BrainHero`(→`CortexFigure`, grounded via `driveFor`) · `BrainDriverSlot` (`attention-scrubber` \| `reason-breakdown` \| `resistance-curve`) · `SignalRows`/`SignalGridV2` · `NetworkSigmaBars` · `KpiHeatmap` · `BuyIntentCurve` · `Unlock` · `HowToRead` |
| Audience page | `AudienceTab.tsx` → `PopulationFrame`: `TerrainMap` · `heroRead` · `DecisionStates` · `PopulationMainSlot` · `IndexBars` · `Amplification` · `ActionIntent` · `Segments` · `Receipts` (**already ships `onInterview` + `onJumpToBrain`**) · `Swing` · `RoomStrip` |
| Depth components | `BrainDepth.tsx` · `AudienceDepth.tsx` (both use `StaggerReveal` — see the scroll-reveal trap) |
| Types | `domain-template.ts` — `DomainTemplate` (`:278`), `unlock?: {lever,gain,insight}` (`:289`, **text, no handler** — the mock's acting fix needs a callback here), `BrainDriver` union (`:59`) |
| Cortex | `lib/brain/cortex-sim.ts` — `driveFor`, `grounded` mode, `predictedBold`; wiring SHIPPED (`7241c11c`) |
| Fixtures | `detail-fixture.ts` · `detail-live-fixture.ts` (`CREATOR_LIVE_TEMPLATE`, `CREATOR_LIVE_TEXT_TEMPLATE`) · `pricing-template.ts` |

⚠️ **`<AmbientDetail>` is rendered by FOUR /go landing surfaces**, not just the app rail:
`components/offer/ambient-panel.tsx` (`presentation="sheet"`), `offer/hero-product-window.tsx`
(`presentation="rail"` — *"the exact ≥xl /home mount"*), `offer/walkthrough/walkthrough.tsx`,
`offer/shots/shot-stages.tsx`. **Restructuring the rail changes the marketing page.** Check all
four before and after. Also `app/(app)/dev/cards/page.tsx` and `app/ambient-v2/page.tsx`.

Gates: `src/components/audience-lens/v2/__tests__/AmbientDetail.locked.test.tsx` (locks the
absent-population / noteAction / back affordances — a third tab must not break its queries),
`BrainTab.grounded.test.tsx`, `AmbientOverviewRail.test.tsx`. Run `npx tsc --noEmit` **and** the
vitest files; **vitest does not typecheck**, and a green Vercel check is not a build.

### The loop for an adjustment

1. Edit the mockup (one file).
2. Re-shoot + probe. Recreate the shoot at `scripts/tmp-shoot-*.mjs`, `rm` after (a Write to the
   scratchpad is BLOCKED by a worktree-path-guard hook). Pattern: raw Playwright,
   `deviceScaleFactor:2`, set `.rail` height to `body.scrollHeight + 120`,
   `.screenshot({animations:'disabled',caret:'hide'})` on `.rail`; then probe structure, the
   playhead, the applied flow, and walk computed style for `backgroundImage`/`boxShadow`/
   `backdropFilter` = 0 and count coral zones (**≤1 per page** as of 9.3).
3. `node scripts/build-insights-review-artifact.mjs` → Artifact tool with the url above.
4. Commit atomically (auto-push hook; verify `git rev-parse origin/task/insights-rework`).

### Traps (§12's and §13's lists still apply — these bit THIS session)

- **`setKind` resets `applied`; `setTab` does not.** Probing an applied state across tabs must use
  `setTab`, or the probe silently tests the un-applied page. Cost a false FAIL.
- **`text-transform:uppercase` changes `innerText`.** A lowercase `includes()` against an uppercase
  label fails while the UI is correct — use a case-insensitive regex. Cost two false FAILs.
- **The CSSOM normalizes `style.width`** — `"75.0%"` reads back as `"75%"`. Compare `parseFloat`.
- **The path-guard hook** rejects Write/Edit outside the worktree (scratchpad AND the memory dir).
  Use `python3` via Bash for memory files; write temp scripts inside the repo.
- **`import { chromium } from '.../playwright/index.js'` FAILS** — CommonJS. Use
  `import pw from ...; const { chromium } = pw;`.
- **The shipped rail reveals on scroll** (`StaggerReveal`). A capture that expands the scroller
  without walking it renders the signal grid and heatmap as **blank voids**. Walk it, then force
  `opacity:0` survivors to the end state.
- **A launchd reaper kills the dev server after ~10 min idle** — `lsof -ti:3002` before blaming code.
- **Do not guess a scroll offset for sticky UI — measure it.**
- `document.fonts.check()` lies for unused faces — `document.fonts.load()` FIRST, then compare
  widths (Newsreader 437.1 vs Georgia 456.3 @40px on "The room stays to the end").
- **Verify the artifact with ALL network blocked** (`ctx.route`), not just locally.
- The build script's `CROP` is coupled to `hero()`'s img framing — unchanged since rev 6; it THROWS
  if the img regex misses and refuses leftover `reference-2026-08-01` refs.
- Duplicate class names silently break layout (`.win`, `.foot`, `.lede` — §10's list).

## 16. Rev 10 — the social-media pass (2026-08-02)

The owner's audit call: "optimize for social media… I don't like the naming (lurkers, sceptics)
at all… just random sentences or confusing metrics… something Claude, Perplexity or ChatGPT
would release." Rev 10 implements that audit. On the SAME artifact url; shots `rev10-*.png` (9).

1. **One audience taxonomy.** builders/learners/skeptics/drive-by RETIRED (owner rejection —
   never re-propose). The room splits by relationship: **Followers · Returning · New viewers ·
   Outside niche** — TikTok's own analytics vocabulary — across terrain districts, watch-time
   pools, fit index and spread. Decision states are plain behaviour: Watched · Almost stayed ·
   Wrong audience · Scrolled past. Voices carry human descriptors ("small creator"), keyed by
   decision row; echo counts now fit inside their rows (296 ≤ 380).
2. **The verb "stop" is BANNED.** The live rail uses "would stop" as GOOD, TikTok/mock as BAD.
   Now: kept watching / scrolled past / leave by. Probe asserts /\bstop/i absent per page.
3. **Feet are metric-anchored.** "Everyone who stays converts." (contradicted by its own ↓ tiles)
   → "Saves lead — follows lag." Every foot cites a number visible in its card.
4. **Answer-first**: Engagement and Audience open with a one-line `.plede` page-answer (Brain's
   answer block already is one). The Audience plede interprets ("Mostly strangers") because the
   hero chip below it already states the 90%.
5. **Counts, not rates**: Projected reaction tiles are counts of projected reach ("102 saves"),
   rate in the delta line, denominator in the card meta ("of 3.2K reached"); applied swaps to
   the 8.4K set.
6. **Encoding fixes**: fit index bars are diverging with a zero line (−68% no longer draws longer
   than +5%); Signal breakdown leads with 3 full-width MOVERS rows (from `MOVERS`), other six
   keep the 3×3→3×2 grid — all nine visible, rank replaces the rev-8 drawer; networks renamed by
   function (Focus/Body/Mind-wandering…), anatomy moved to the drawer; two signals translated
   (Cognitive grip → Easy to follow, Voice impact → Delivery).
7. **Chrome**: identity row = views only + projected tag (the other four counts live as
   Engagement tiles); pager labelled ("clip 2 of 5" / "draft 4 of 5"); action bar label is a
   short tabular fact (`barLab`) that cannot truncate; hero corner says "at 0:03, the drop";
   the hero figread polarity-duplicate ("38% still watching" under "62% leave") is deleted;
   `.simline` sim disclosure (1,000 · 4.2K · confidence 0.82) is the last line of EVERY page.

Probes (were in `scripts/tmp-shoot-rev10.mjs`, deleted per the loop; recreate from §15's
pattern): banned-vocab regexes per page, ≤1 coral zone, no shadow/backdrop/gradient, diverging-
bar geometry, mover/grid counts (3+6), action-bar no-truncate, tab-order parity, drawer keeps
the anatomical mapping. All green at commit time.

## 17. Rev 11 — prose becomes chrome (2026-08-02)

Owner feedback on rev 10, with crops of the nread line, the action-bar label, and BOTH pledes:
"alot of sentences or plain text… still a bit overloaded and not that clean, especially audience."
The rev-10 pledes and metric-anchored feet were themselves read as prose. Rev 11 deletes the
text layer instead of improving it — **"or nothing" won**:

1. **All `.insight` card feet deleted** (video and text). Cards end on their data.
2. **The `.plede` page-answer lines deleted** (they lasted one revision — do not reintroduce).
3. **The floating network read (`.nread`) deleted** — flagged in both audits; its facts live in
   the Network activation rows. The answer now sits directly under the cortex.
4. **The answer's evidence is a stat row** (`.astat`: number+label pairs — coral 62% · leave by
   0:03 · 3.2K · vs usual 8.1K), not a clause. Applied state: delta row + one stat pair.
5. **Action bar label is a stat** (`barLab` is now a [value,label] pair, value 13px/500).
6. **Audience decluttered**: Where-it-surfaces + Best-window merged into ONE "Where & when"
   card (`distCard()`; text kind keeps only the window). Page = hero + 5 cards, zero prose.
7. Simline shortened to "1,000 simulated · your 4.2K followers · confidence 0.82".

The surface's ONE sentence is the verdict headline. Serif voice quotes are content, not chrome,
and stay. Probes (temp script deleted per the loop; §15 pattern): `.plede/.insight/.nread`
count == 0 per page, 1 `.astat` on Brain, 5 cards on Audience, plus all rev-10 probes. Green.
Shots `rev11-*.png` (8). Same artifact url.

## 18. Rev 12 — the rail quiets down (2026-08-02)

Owner, with crops: the two segmented `.mix` composition strips on Audience → **removed
completely** (the percentages live in the rows beneath); the pinned action bar → **removed
completely** ("i dont like this sitting at the bottom") — the fix now exists ONCE, in the Brain
answer block, and Engagement/Audience carrying no fix control is the design, not a gap. Third
ask: Engagement felt empty next to the other pages. It fills out with DATA, not prose:

- **Rank strip** inside Key metrics (`rankStrip()`, `.rank`): the "vs your last 41 videos" meta
  is now drawn — 41 dim dots on a 0–28s track (`RANK41`), a median tick (11.2s), this clip as
  the cream marker (9.7s → 16.4s when the trim is applied).
- **When they react** card (`reactCard()`, `.rrow`): per-second intensity rows for Saves /
  Shares / Comments on the clip's own 28s axis (`REACT`), heatmap grammar, counts matching the
  Projected reaction tiles (102/45/16, ×2.64 applied). Video kind only (§3.3: text has no
  timeline).

Video Engagement = Retention · Key metrics+rank · When they react · Projected reaction (4 cards).
Audience = hero + 5 cards. Deleted from the codebase: `.actionbar` + `syncBar()` + `actionBar()`
+ `hasbar`, `.mix`, `barLab`. Probes: deleted-class count == 0 per page, 4 cards on video
Engagement (1 `.rank`, 3 `.rrow`), 5 on Audience, plus all standing probes. Green. Shots
`rev12-*.png` (8). Same artifact url.

## 22. The visual audit, and the eight defects it closed (2026-08-04)

§21's loop, run against the BUILD rather than the mockup: all 14 states (4 templates × 3 tabs + 2
applied) shot full-height and read. **Every design law held** — 270px cortex hero, instrument on
Brain, retention on Engagement, ≤1 coral zone per page, colourless grades, no banned verb 14/14,
diverging zero-line bars correct, card counts, simline last. 0 shadow · 0 backdrop-filter · 0 console
errors. Twelve defects were found underneath the laws; **eight are closed here**, four are below.

> 🔑 **A law-shaped probe passes a page that is unreadable.** Every one of these sat under a green
> gate. The audit that found them shot the surface and *looked*; the gate that missed them counted
> elements. Two of the twelve were also **misstated by the audit itself** and only the code settled
> them (§ "what the code corrected", below) — a visual read is necessary and still not sufficient.

| # | Defect | Fix |
|---|---|---|
| 1 | **A soft gradient shipped on a matte surface** — `BrainTab`'s WEAK→STRONG legend was a true `linear-gradient(90deg, .08 → .85)`, added by `dfed0727` under a verification that recorded "0 gradient". | The key is drawn in the grid's OWN `HeatCells` at the alphas a real row uses — a sample of the figure, not a second encoding of it. |
| 6 | **Same number, opposite grade, one named scale** — `68 Visual pull STRONG` beside `68 Hesitation WEAK` under "0–100 · vs your baseline". | `SignalCell.lowerIsBetter`, set from `GRID_DIMS[].invert`. The banding was always right (`100 − score`); the CARD never said the direction. Marked cell + one legend line. |
| 5 | **A sort order carrying meaning nothing encoded** — friction sorted first, but "Strong hook 51%" still drew the longest bar on a card titled *Why they scrolled*. | Named group captions at the break: **Why they left** / **What held the rest**. Suppressed when the tally is single-polarity. |
| 7 | **The worst legibility defect** — district labels sat bare on the densest part of the node cloud; "new 62%" was partly occluded. | A knock-out casing in the figure's own `#131210`, painted under the glyphs (`paint-order`). The corner chips' scrim, shaped to the letters. |
| 9 | **The transcript read broken, not windowed** — and its FIRST WORD was invisible at rest. | The fade ramp finished inside one word (10%); now `TRACK_PAD` px, with matching track padding so a terminal word always clears it. **Measured at both extremes: exactly 26px clear at each end.** |
| 10 | **Three reaction rows at one density** — each row's intensity was normalised WITHIN itself, so 16 comments drew as heavy as 102 saves. | Weighted against the heaviest row, square-rooted so the lightest stays legible. Peaks now **0.80 / 0.54 / 0.34**. |
| 11 | **The benchmark did not say it was the benchmark** — an unlabelled median tick on a strip drawn to hold one. | `median 11.2s` captioned at the tick, flipping side past 66% so it cannot run off the card. |
| 12 | **The applied state's only control was dim plain text.** | A chip with an undo glyph. Not cream-filled: the primary action is spent, and undo is a way back. |

### What the CODE corrected in the audit

Two findings were wrong as written, and acting on them verbatim would have made the surface worse:

- **"The transcript has no fade"** — it had one (`maskImage`, 10%). The defect was WIDTH, plus a
  first-word bug the audit could not see because it only ever shot the strip at one playhead position.
- **"Hesitation is inverted and nothing says so"** — the inversion was implemented and tested
  (`brain-signals.ts`, `ambient-v2-modeled.ts:162`). Only the DISCLOSURE was missing. Reading it as a
  logic bug would have "fixed" a correct grade into a wrong one.

> ⚠️ **`↓` and `↑` were already taken.** The direction mark started as `↓` and the probe caught it:
> the watch and reaction tiles one tab over use those glyphs for went-down/went-up ("↓1.5s",
> "0.5% of viewers ↓"). Shipping `↓` for *lower is better* would have put two meanings on one mark
> inside a single instrument — the very defect #6 exists to close, one level down. The mark is `*`,
> which appears nowhere else on the surface. **Before adding a glyph, grep the surface for it.**

### Verified

`npx tsc --noEmit` clean · **4905 vitest passing** (same count as `dfed0727`; the 3 unhandled
rejections are pre-existing in `composer.test.tsx`, a different surface) · eslint clean on all 7
changed files — it caught a component declared during render, now hoisted to `ReasonGroup`.
Re-shot all 14 states: **0 shadow · 0 backdrop-filter · 0 soft gradient · 0 console errors · no
banned verb · every terrain label cased 4/4 · no page carrying both `*` and arrow glyphs.**
Shots refreshed at `docs/mockups/reference-2026-08-01/audit-*.png` (14, committed).

> The shoot script needed two repairs worth keeping: expanding the scroller **mutates every ancestor
> and those mutations accumulate**, so later template chips become unclickable — each state must start
> from a fresh load. And a fixed `waitForTimeout` after `domcontentloaded` is not hydration; on a cold
> dev route it silently produces "button not found". Wait on the element.

### The three honesty-spine items — CLOSED (2026-08-04, `4a2868ff` + `d4680365`)

**1. The live retention curve contradicted its own headline.** "66% gone by 0:04" (⇒34% remain) over
chips reading `0:04 34% · 0:05 34% · 0:07 52%`. The cause was one field read as another, by five
consumers. `weighted_curve` is — in `engine/types.ts`'s own words — "weighted aggregate **ATTENTION**
per segment", an intensity that legitimately rises when a clip re-grips the room. It was drawn under
the title "Retention", annotated "N% gone by", banded by `curveBreak` into "the share still watching",
divided into "Avg watch", and a fifth consumer read `weighted_completion_pct` as "Watched full" —
though its producer comment calls it the "weight-normalized mean of per-persona timeline mean", i.e.
mean attention under a name containing `completion`.

> 🔑 **The honest curve was one field away the whole time.** The fold emits `swipe_predicted` beside
> attention and its own prompt pins the semantics — it "becomes true at the scroll-away moment and
> stays true for all subsequent segments", i.e. **monotonic by construction**. `swipe_predicted_at`
> persists the second it flipped and `HeatmapPayload` has always carried it. `retentionCurveOf()` and
> `watchStatsOf()` derive the real share still watching, the real avg watch and a real completion
> rate from it, using the aggregator's own weighting helpers so both curves share a denominator.
> Nothing was invented, and nothing had to be hidden.

Live now: **"58% gone by 0:04" over chips 42% · 42% · 27%** — monotonic, nothing above 100%.

> ⚠️ **Both fixtures carried `personas: []` beside a populated `weighted_curve`** — a shape production
> cannot emit, since the curve is COMPUTED from the personas. *That* is what let this survive: with no
> swipe data there was nothing to contradict the attention reading. Both now carry a real cast, and
> the live one finally matches its own docstring ("the exact shape `/api/analyze` Max writes").
> The tell was in the unlock sentence, which no test asserted on: reading a ratio of two attention
> values as a share, it rendered **"200% of the room still watching at 0:06 stays to the end."** A new
> guard fails any percentage above 100 in that sentence.

**2. The live "Key metrics" now names its scale** — `this clip · no baseline yet`. The authored card
says "vs your last 41 videos" because the design demo holds a catalogue; live holds none, so it says
so. Naming a scale is not inventing a benchmark.

**3. The TEXT activation grid no longer prints seconds it does not have.** `clipSeconds: 6` is a
nominal proxy for the cortex loop, and it was surfacing as "6s · 10 systems / 0s → 6s / each cell = 1s"
— three lines under the comment that took the modeled retention curve off the text driver for exactly
this reason. `KpiHeatmapData.untimed` keeps all ten rows (the owner's parity call stands) and drops
only the clock: the head reads "Where each system fires", the axis start → end. Video is untouched.

### Still open — ONE item, and it is the owner's

**The applied fix moves retention + cortex and nothing else** (`detail-fixture.ts:170` carries
`retention`/`tiles`/`rank`/`reaction` only). Signal breakdown, Network activation and Activation per
second are byte-identical before and after, so the cortex visibly repaints while the three cards
describing that same brain sit still. **Not fixable by inventing deltas** — same sin as a fabricated
benchmark. It is a decision: leave it, mark those cards "measured before the fix", or hide them in the
applied state.

Also unresolved, and NOT a finding: "Who spreads it" renders per-segment multipliers sorted
descending (Returning ×3.2 → Outside niche ×0.3). That is a carrier ranking, and this repo carries a
*never a carrier ranking* law — but the rev-12 test only asserts its absence from **Engagement**, so
it may be intended on Audience. Settle it before treating it as a bug.

### Scope this pass did not cover

The systematic **build-vs-design diff** (`impl-*.png` vs `rev12-*.png`, page by page) is still undone.
This audit measured the build against the LAWS, which is a different question and structurally cannot
find drift from the drawing.

---

## 21. NEXT SESSION — START HERE (the build exists; review it, then land it)

> 📌 **Read §22 FIRST** (2026-08-04) — the visual audit of the built rail and the eight defects it
> closed. It supersedes §20's "Verified" line, carries the four items still open, and names the one
> scope §21 never covered. Everything below still stands.

Read **§20** (what shipped, and the four leaks it found), then §6 (the laws) and §16–§18 (what the
design IS). §10 · §12 · §13 · §19 are all superseded — §19 was the implementation kickoff and it is
done. §15's *traps* still apply verbatim.

### Where everything is

| | |
|---|---|
| Worktree · branch | `~/virtuna-slot-b` · `task/insights-rework` — **do not switch branches** |
| PR | **#412**, open. Tip = **`dfed0727`** (the rev-12 implementation), pushed. |
| ⚠️ Base drift | **63 commits behind `origin/main`** as of 2026-08-02. Rebase before opening the merge — and re-check the count, `main` moves while you work. |
| The built rail | `/ambient-v2` → `② brain` → the four chips. **No auth.** Port 3002. |
| Shots of the BUILD | `docs/mockups/reference-2026-08-01/impl-*.png` (8) |
| Shots of the DESIGN | `docs/mockups/reference-2026-08-01/rev12-*.png` (8) — the reference to diff against |
| The mockup | `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` — **unchanged**, still the design SSOT |
| The review link | https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3 — still shows the MOCKUP. Republishing it does not show the build; a session that wants the owner to review the BUILD should send `impl-*.png` or a dev-server walkthrough. |

### The one thing that matters most now

**Five revisions were rejected on the sketch, and the sixth through twelfth were refined on it. There
is now a REAL one.** The owner has never reviewed the built rail — only stills of a mockup. Get it in
front of them before touching the design again: what reads differently in a live 440px scroller with
a spinning cortex is not knowable from a PNG.

Do NOT start by re-editing the mockup. The build is the artefact under review now; the mockup is the
contract it was measured against.

### The loop for an adjustment (changed — the build is the target)

1. Edit `src/components/audience-lens/v2/` (the pages) or `detail-fixture.ts` (the authored data).
2. `npx tsc --noEmit` **and** vitest — **vitest does NOT typecheck**, and a green Vercel check is not
   a build.
3. Re-shoot + probe live. Recreate the shoot at `scripts/tmp-*.mjs` and `rm` it after (a Write to the
   scratchpad is BLOCKED by a worktree-path-guard hook). Pattern: raw Playwright,
   `import pw from '…/playwright/index.js'; const { chromium } = pw;` (CommonJS — the named import
   FAILS), `deviceScaleFactor:2`, scope tab clicks INSIDE `[data-testid=ambient-detail]` (the dev
   page's own `② brain` chip collides with the `Brain` tab under strict mode), expand the scroller,
   `.screenshot({animations:'disabled',caret:'hide'})`. Then walk computed style for
   `backgroundImage`/`boxShadow`/`backdropFilter` = 0 and assert `/\bstop/i` is absent per page.
4. Commit atomically (auto-push hook; verify `git rev-parse origin/task/insights-rework`).

### Open, in the order they are worth doing

1. **Owner review of the built rail** — the blocker for everything else.
2. **Text-sim dead rows** — VISUAL/AUDIO/FACE render flat with one honest note. Whether they should
   render at all has been open since rev 8 and is still the owner's call.
3. **The four missing producers**, which is why the LIVE Engagement page is thinner than the authored
   one: reach/views/likes/follows · the creator's own median post · the last-41 catalogue · the
   reaction timeline. §5.3's ledger says none exists. The authored fixture carries all four because
   it is the design's demo clip (tagged `projected`); the adapters OMIT each one.
   ⚠️ **Do not "fill in" the live page.** That gap IS the honesty spine — an adapter inventing a
   benchmark band is fabricated proof, and the walkthrough's own honesty gate exists for this.
4. **`offer/ambient-panel.tsx` and `offer/walkthrough/walkthrough.tsx` have NO consumer.** They
   typecheck and their fixtures are tested, but nothing mounts them. Either wire them or retire them;
   right now they are two more surfaces that can silently drift from the rail.
5. `/dev/cards` renders no gallery content in this worktree — **pre-existing** (verified on the
   pre-change tree). Do not debug it as a regression from this work.

### Before you merge

**MERGING TO `main` IS DEPLOYING** — production builds ~3s after the merge and there are no preview
URLs. Verify BEFORE, never after. The rail ships on `/go`, so this is a marketing-page change too.

---

## 20. Rev 12 — IMPLEMENTED in React (2026-08-02)

§19's kickoff is DONE. The rail on `/ambient-v2` is the reviewed design, not an approximation of it.
Shots of the built surface: `docs/mockups/reference-2026-08-01/impl-*.png` (8) — diff those against
`rev12-*.png`, which stay the design reference.

### What shipped

| | |
|---|---|
| §3.2 — the blocker | `curveBreak()` + `curveUnlock()` in `ambient-v2-brain.ts`. A video fold codes **no reasons by design**, so passing fake ones was the wrong repair: the lever now comes off the measured curve (steepest run → the second the collapse finishes → `Trim 0:00–0:0X`), and `modeledUnlock(...) ?? curveUnlock(...)` keeps the reason-derived lever wherever reasons exist. Four regression tests, incl. the real mount's exact input (no `reasons` at all) and the two honest-absence paths. |
| The third tab | `Tab = "brain" \| "engagement" \| "audience"`, segmented control, sticky inside the scroll, identity once above it, nav row only pinned. `dim` covers all three absences. |
| The pages | `BrainTab.tsx` rebuilt · **`EngagementTab.tsx` new** · `AudienceTab.tsx` rebuilt · **`rail-kit.tsx` new** (the shared card grammar). |
| The fix ACTS | `DrillFix.applied` carries the whole re-simulated state, so before → after is ONE swap and `Undo` is one flip. Verified live: curve redraws with the original as a coral ghost, chips 58/33/27 → 92/75/59, tiles → 16.4s/9.8%, clip 0:28 → 0:25, transcript slices, reach ×2.64, cortex repaints from the new curve. `onApplyFix` is the seam for a host that can genuinely re-run. |
| Contract | `domain-template.ts` gains `identity` · `answer` (+`fix`) · `engagement` · `pools` · `distribution` · `heroVerdict` · `heroFigread` · `simline` · `method` · `signalMovers`/`signalScale`/`networkScale` — **all optional**, so pricing and the sealed/walkthrough templates render unchanged. |
| Adapters | `ambient-v2-drill.ts` (new) derives the rev-12 blocks from real persisted output for BOTH kinds. |
| Deleted | `BrainDepth.tsx` · `AudienceDepth.tsx` and the r4 chrome in `AmbientDetail` (`Kick`/`SecHead`/`HowToRead`/`Unlock`) — last callers gone. Two renderers for one dataset is how this repo's drift traps start. |

### Bugs the build found that the design could not

1. **The wall leaked.** `sealTemplate`/`templateIsSealed` stripped `unlock`/`population`/`whyThisSecond`
   but not `answer` or `engagement` — which are the verdict, the lever and the retention instrument,
   i.e. exactly what the $1 buys. Both now strip them and both `isSealed` guards assert it.
2. **The applied fix leaked across stimuli.** `setTab` must not reset it (walking to the evidence and
   back is one reading) but a NEW stimulus must — and the hosts swap `template` in place rather than
   remounting. Reset on a stable identity string, adjusted during render; keying on the template
   OBJECT would clear it every render, because the adapters build a fresh one each time.
3. **A coral run that lied.** `curvePath(curve.slice(0, break+1), …)` re-scaled four points across the
   whole card: the figure claimed the room left over 28 seconds when it left over three. `curvePath`
   now takes a `span`.
4. **A pull reason led a card about leaving.** The dominant-reason tally is mixed by construction, so
   sorting by count put "Strong hook" at the top of "Why they scrolled". Friction sorts first; the
   pull rows stay, at their true weight, below.

### §15's Open list — closed

- **"Strong hook" in the coral half** — `codedReasons` took `loss` from the *exemplar persona's*
  verdict while its own comment said we do not claim the persona uttered the label. Polarity now comes
  from `REASON_POLARITY`, the semantic map.
- **Reused quotes** — `pool[i % pool.length]` indexed by ROW, so 2 scrollers + 2 stoppers over 4
  reasons handed rows 0/2 and 1/3 the same voice. Each pool walks its own cursor.
- **The `WHO SPREADS ITMODELED REACH` kicker collision** — gone with `Kick`; the card head owns its
  right-meta.
- **The banned verb** — `modeledDecisionStates` said `Stopped`/`Almost`/`Not for them`, `modeledSwing`
  said `+N% would stop`, and the terrain chip said `would stop`. All replaced; a probe asserts
  `/\bstop/i` is absent from every page of every template.
- **The cortex after the trim** — repaints from the re-simulated curve (the mockup's one honest gap).

### Verified

`npx tsc --noEmit` clean · **4905 vitest passing**, incl. all three named gates · lint clean on every
new/changed file. Live at `:3002` on all four templates × three tabs × applied: **0 shadow, ~~0 gradient~~,
0 backdrop-filter, ≤1 coral zone per page, no banned verb, 0 JS errors.**
⚠️ **"0 gradient" was WRONG** — this very commit added one (`BrainTab.tsx`, the WEAK→STRONG legend ramp).
The probe behind the claim tested the wrong thing; see §22, finding 1. Fixed there. Mounts checked before and
after: `/ambient-v2` ✅ · `/go` (hero-product-window) ✅ · `/dev-shots` (shot-stages, 2 mounts) ✅ ·
`offer/ambient-panel` + `offer/walkthrough` — in-tree with **no consumer**, typecheck + tests only.
⚠️ **`/dev/cards` renders NO gallery content in this worktree** (0 `<section>`, signed in) — confirmed
identical on the pre-change tree, so it is pre-existing, not this work. It mounts
`CREATOR_LIVE_TEMPLATE` + `CREATOR_LIVE_TEXT_TEMPLATE`, both verified live on `/ambient-v2`.

### Still open (unchanged by this pass)

- **Text-sim dead rows** — VISUAL/AUDIO/FACE render flat with one honest note. Whether they should
  render at all is still the owner's call.
- **No producer exists** for reach/views/likes/follows, the creator's own median post, the last-41
  catalogue, or the reaction timeline. The AUTHORED fixture carries all four (it is the design's demo
  clip, tagged `projected`); the adapters OMIT each one rather than draw a band nobody produced. The
  live Engagement page is therefore Retention + two watch tiles until those producers land.
- The rev-12 mockup is unchanged and still the design SSOT; the artifact URL still points at it.

---

## 19. IMPLEMENTATION KICKOFF — paste this into a fresh context

> Implement the insight-drill rework (rev 12) in React.
>
> Worktree `~/virtuna-slot-b` · branch `task/insights-rework` (PR #412). Do not switch branches.
> SSOT: `docs/HANDOFF-2026-08-01-insights-rev6-kickoff.md` — read **§15** (implementation map,
> gates, traps), then **§16–§18** (revs 10–12 — what the design IS now; §10/§12/§13 are
> superseded). Target = `docs/mockups/insights-rev6-hero-restored-2026-08-01.html` (open
> directly, no server; filename says rev6 on purpose, `<title>` says rev 12) and the shots
> `docs/mockups/reference-2026-08-01/rev12-*.png`. Review artifact (owner's link):
> https://claude.ai/code/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3
>
> Build order:
> 1. **Fix §3.2 first** — `AmbientOverviewRail.tsx:467` calls `buildVideoDomainTemplate` with no
>    `reasons`, so the unlock never renders on a real video drill. The design makes the fix the
>    page's primary control; wire this before any UI.
> 2. **Third tab** — `AmbientDetail.tsx:257` `type Tab = "brain"|"audience"` → add
>    `"engagement"`; touch the `:361` tabs map, `:374` label ternary, the `dim` logic, and the
>    `:385+` body switch. Order: brain · engagement · audience.
> 3. **Rebuild the three pages to rev 12**: one audience taxonomy (Followers / Returning / New
>    viewers / Outside niche — archetype names are owner-REJECTED), decision states Watched /
>    Almost stayed / Wrong audience / Scrolled past, verb "stop" banned everywhere, NO card
>    feet / pledes / read lines (the verdict headline is the surface's one sentence), answer
>    evidence as a stat row, signals as 3 movers + 6-cell grid (all nine visible), networks
>    named by function (anatomy in the drawer), diverging fit bars with a zero line, reaction
>    tiles as counts of projected reach, rank strip + When-they-react on Engagement, Where &
>    when merged card on Audience, simline on every page, no action bar, no mix strips.
> 4. **The fix must ACT** — `domain-template.ts:289` types `unlock` as `{lever,gain,insight}`
>    text with no handler; the re-simulate maps to the v1 room's `onRewrite`. Before → after
>    delta, curve ghost, tiles flip, Undo restores.
>
> ⚠️ `<AmbientDetail>` renders on FOUR /go landing surfaces (`offer/ambient-panel.tsx`,
> `offer/hero-product-window.tsx`, `offer/walkthrough/walkthrough.tsx`,
> `offer/shots/shot-stages.tsx`) plus `dev/cards` and `/ambient-v2` — check all before/after.
> Gates: `AmbientDetail.locked.test.tsx` · `BrainTab.grounded.test.tsx` ·
> `AmbientOverviewRail.test.tsx` · `npx tsc --noEmit` (vitest does NOT typecheck; a green
> Vercel check is NOT a build — merging to main DEPLOYS numenmachines.com, verify BEFORE merge).
>
> Laws that survived 12 revisions — do not relitigate: never shrink the 270px cortex hero; the
> instrument stays on Brain's surface (no drawers); retention stays on Engagement; every scale
> named in its card's right-meta; ≤1 coral zone per page; grades colourless; benchmarks vs the
> creator's own catalogue only; live rail defects to fix while in there: the
> "WHO SPREADS ITMODELED REACH" kicker collision, the reused fixture quotes, "Strong hook" in
> the coral half (§15 "Open" list).
