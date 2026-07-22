# HANDOFF 2026-07-22 — Ambient Audience v2: the DETAIL CARD REWORK (creator + pricing)

**Status: BUILT + live-verified + merged.** This session reworked the two Detail cards (② Brain /
③ Audience) on the dev route `/ambient-v2`, for BOTH domain templates (creator + pricing), across
five owner-steered passes. All gates green throughout; nothing wired into the product yet (still a
standalone dev route — reconciliation is a later step).

- Worktree `~/virtuna-ambient-audience-v2` · branch `design/ambient-audience-v2`
- Prior SSOT (the CONFIG+RANK model + domain architecture): `docs/HANDOFF-2026-07-21-ambient-audience-v2-config-rank-model.md`
- The v2 surfaces: `src/components/audience-lens/v2/` · dev route `src/app/ambient-v2/page.tsx`
- **The platform contract is `domain-template.ts`** — a new domain is ONE `DomainTemplate` object;
  the frames (`BrainFrame`/`PopulationFrame`) are never forked. This session ADDED slots; the
  discipline held (pricing rebuilt itself from the same frames every pass — proven each time).

---

## The arc — five passes (all owner-steered, all live-verified)

### 1 · P2/P3 depth polish
- **Brain P2:** killed the raw-σ "Networks · at the playhead" jargon table. Networks now carry a
  plain-word `read` per row; a "why this second" **synthesis** heads them. (r5's rejected move was
  *hiding* networks behind an expander — we kept them visible, just translated.)
- **Population P3:** terrain knit into ONE society via **commuter edges** (nearest cross-cluster
  pairs) + stronger gravity-pull (not r5's rejected collapse-to-centre); hard-category labels
  softened; the outcome tri-state decluttered (dropped the STRONG/OKAY/LOW band-word noise).

### 2 · Cheap high-value pass (#1/#3/#7/#8 from the audit)
- **#1 the move** · **#3 the "what it is NOT" cortex note** (the #1 Sapient steal) · **#7** `P82 of
  your 41` → `top 18% of your last 41 hooks` · **#8** signal bars (65/62/61, near-identical) → the
  **delta vs baseline** (`+18 · +4 · −2`), the one informative atom.

### 3 · Read-first + consolidate (owner picked the most-decluttered option)
- **`MODELED` ×4 → ONE** card-level tag. Cortex demoted from the top; the plain read leads.
- Why-this-second dissolved: synthesis moved ONTO the attention moment; the 4-row σ table collapsed
  to a **2-network inline read** (`Focus scattered ↓ · Memory holding ↑`).
- Signals tightened to label+delta (bars/absolute score dropped). `hold 38`, `SAME PLAYHEAD` copy
  killed. The move + synthesis de-duplicated (move = the action, synthesis = the read).
- **Audience:** "who stopped · by segment" bars MERGED onto the terrain labels (`builders 82%`) —
  a whole redundant section gone. `segments` made OPTIONAL (creator omits — terrain covers it;
  pricing keeps it, WTP tiers are an orthogonal cut).

### 4 · The figure is the hero + THE UNLOCK (owner: "verdict overlaid on figure" + "cheat-code value")
- **Slim top bar** (back · pager · tabs only). The heavy 42px verdict/move block is GONE.
- **Brain hero = the cortex** (208px), **Audience hero = the node terrain** — each with the verdict
  as a **chip riding on the figure** (`VerdictChip`, bottom-left).
- **THE UNLOCK** = the cheat-code payload: **lever → modeled gain → the counterintuitive insight**
  (what already works vs what leaks). Creator: `Cut to the payoff before 0:03 → +11% would stop ·
  "the $400 opener already works — it's the wait that loses the 253 skeptics."` Pricing: `Price at
  $24 → +18% revenue · "it's fairness that breaks $29, not value."`

### 5 · Owner cleanup pass (screenshot feedback)
- **Terrain = a hero card matched to the cortex** (`rounded-[14px]`, `#131210` field, 1px border,
  208px). The two heroes read as one system.
- **Nodes are alive:** SMIL reveal-on-open + a staggered opacity **pulse on the stopped nodes** (the
  society breathing); coral loss nodes hold still. Motion = intensity only, positions stable (law).
  Active nodes are slightly larger.
- **Retention line moved UNDER the brain** (same clip = one unit).
- **THE UNLOCK de-boxed + restacked** (the bordered box squeezed the lever against the gain and read
  as slop) — now a hairline rule + type weight, each atom on its own line. And it's **brain-only** now
  (a timing/price lever makes no sense on the audience "who" page; the audience's value is its coded
  reasons + the live society).

---

## The contract as it stands (`domain-template.ts`) — slots ADDED this session
- `unlock?: { lever; gain?; insight }` — the cheat-code block (brain tab only; rendered by `Unlock`).
- `brain.cortexNote?` — the "what it is NOT" claim boundary under the cortex.
- `brain.signalsBaseline?` — the referent the signal deltas measure against.
- `brain.whyThisSecond?: { moment; segments[] }` — the synthesis on the attention moment.
- `SignalRow.vsBase?` — the delta vs baseline (in `AmbientDetail.tsx`).
- `NetworkRow.read` — the plain-word state (in `AmbientDetail.tsx`).
- `population.heroRead?` — one-line interpretation under the terrain hero.
- `population.segments?` — now OPTIONAL (include only when orthogonal to the terrain).
- `verdict.move` — REMOVED (superseded by `unlock`).

## Layout laws established this session (keep these)
- **The figure is the hero** — cortex on brain, terrain on audience; verdict rides as a chip ON it.
- **Slim top bar** — nav + tabs only; no big fixed verdict block.
- **ONE `modeled` tag** card-level, not per-section.
- **THE UNLOCK is brain-only**, de-boxed (hairline + type weight, never a bordered box, never coral).
- **The two hero figures share one card treatment** (`rounded-[14px]`, `#131210`, 1px border, 208px).
- **Retention sits under the brain.** **Motion = intensity, never position** (terrain pulse, not drift).
- Brain order: cortex hero+chip → read/note → WHERE THEY DROP (retention) → BREAKDOWN → THE UNLOCK → how-to-read.
- Audience order: terrain hero+chip → heroRead → OUTCOME → (segments, pricing only) → WHY coded → calibration → how-to-read.

---

## STILL OPEN — the owner said "still a lot of improvements to make on the cards"
Next session's real work. From the earlier audit + open threads:
- **Verdict has no confidence / benchmark.** The concept's honesty law wants the headline "stable
  within its CI" — show `38.2% ± 3.1%` + a benchmark. (Needs engine data; slot/viz buildable now.)
- **Pricing shows demand but not REVENUE** — the curve that makes `$24 optimal` self-evident (revenue
  = price × share). Right now `$24` is asserted, not shown.
- **Cortex ↔ read deeper sync** — annotate which networks light at the playhead, live, so the moat
  figure is legible frame-by-frame (not just a static caption).
- **Cross-tab thread** — Brain and Audience are still siloed; the why-this-second (brain) and the
  coded reasons (audience) are the same story — link them.
- **Motion on the curves** — attention/demand/resistance are static SVG; a one-time draw-in reveal
  (like the terrain got) would give them life. Judge the terrain pulse feel first (subtle? enough?).
- **Build the COMPARE (A/B) + QUERY (ask/survey) arms** — still `soon` stubs in ⑤ intake; each is
  "the pricing recipe again" (a read-template + 1–2 new figure kinds).
- **Naming** for the light layer (rank · pulse · first take) — owner's call, still parked.
- **Wire the v2 route into the product** — later; a parallel session owns the product-thread rank comp.

## Gates + how to run (fresh session)
- Dev server on **:3007** (macOS has NO `setsid` — `nohup node node_modules/next/dist/bin/next dev -p 3007 &`).
  Route `/ambient-v2`; use the surface chips (② brain) + the **creator/pricing** + **The brain/The
  audience** toggles. Scratch sketches on :8777 (`cd .scratch && python3 -m http.server 8777`).
- **Screenshots HANG on this app** (ambient animations never settle) — verify via Playwright DOM
  (`browser_evaluate` reading `innerText` / computed styles), never `browser_take_screenshot`.
- Gates: `node ./node_modules/typescript/bin/tsc --noEmit` (0) · `node ./node_modules/eslint/bin/eslint.js
  src/components/audience-lens/v2/` (0) · matte `node ./node_modules/vitest/vitest.mjs run
  src/components/reading/__tests__/reskin-matte.test.ts` (38/38). All files <500 ln.

## Files touched this session
`AmbientDetail.tsx` (slim shell · `VerdictChip` · `Unlock`) · `BrainTab.tsx` (`BrainHero` · retention
· synthesis · signals · unlock order) · `AudienceTab.tsx` (terrain hero card + SMIL animation ·
merged segments) · `domain-template.ts` (contract slots) · `detail-fixture.ts` (CREATOR) ·
`pricing-template.ts` (PRICING).
