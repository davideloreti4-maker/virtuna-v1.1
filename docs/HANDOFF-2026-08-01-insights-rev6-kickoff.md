# Handoff — Ambient Audience v2 detail drill, rev 6 kickoff

**Date:** 2026-08-01 · **Branch:** `task/insights-rework` · **Worktree:** `~/virtuna-slot-b` · port **3002**
**Status:** design exploration only — **zero `src/` changes on this branch.** Five mockup revisions,
all rejected. This document is the complete state so a fresh session starts with everything.

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

## 5. ⚠️ Two inputs the owner must re-send

Neither is in this repo and neither survived into this session's context. **Ask for them before
starting design work:**

1. **The TikTok + YouTube Studio reference screens** — the visual reference for the analytics idiom.
2. **The earlier session output on what is most relevant for the TikTok / Instagram algorithm** —
   which metrics actually drive distribution.

What *does* exist is the metric ledger (engine → UI), from §3 of the older handoff:

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
