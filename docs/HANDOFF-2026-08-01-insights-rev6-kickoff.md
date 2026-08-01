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

## 10. Rev 7 kickoff — START HERE

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
