# Handoff — Test card rework (the video craft teardown)

**Date:** 2026-07-21 · **Branch:** `lane/skill-cards-prod` · **Status:** design direction LOCKED as a sketch; NOT built.
**Approved mockup:** `docs/mockups/test-card-rework-2026-07-21.html` (open in a browser) · live Artifact: https://claude.ai/code/artifact/b7da2365-a590-47ac-8f04-7fe4c149edc0

This session was a shaping + design session. No card code was changed (one unrelated fix landed — see §7). The next session builds the card from this spec.

---

## 1. The decision that frames everything

**Simulation is being separated from skills.** Skills no longer auto-simulate the audience. Two complementary surfaces, built in two parallel sessions:

| | **TEST** — *the editor's cut* | **SIMULATION** — *the test screening* |
|---|---|---|
| **This session owns** | ✅ yes (in-thread) | ❌ no — parallel session, separate surface |
| **Question** | How well-made is it? How do I improve it? | How will it perform when I post it? |
| **Uses the video** | FREEZES it — frame by frame | PLAYS it — reception over time |
| **Headline** | a **craft score** + reasoning | predicted reception ("38% would stop") |
| **Owns** | hook mechanics, pacing/edit, framing, delivery, the fixes, filmstrip, Apollo frame read | attention/retention curve, brain cortex, population segments, who-stops, reach |
| **Nature** | now · static · technical · **video-only** | future · temporal · audience · **medium-agnostic** |

**The line (airtight):** anything that draws a **curve over time** or **splits an audience** ⇒ Simulation. A **frozen frame + a mechanic** ⇒ Test.

**The two SCORES complement — keep both.** Test = craft quality ("well-made?"). Sim = predicted performance ("will it land?"). technically-90-but-sim-says-flop (great cut, wrong message) vs rough-60-but-sim-says-pop — the GAP is itself the insight.

**No separate analysis page.** The Test renders FULLY IN-THREAD like every other skill. The legacy full-page route `/analyze/[id]` (rendered by `src/components/reading/*`) is DISSOLVED: its CRAFT content folds into the in-thread card; its RECEPTION content (retention curve, who-leaves, reach, the crowd) leaves for the Simulation surface. The old "See the full breakdown → /analyze" door becomes an in-thread expand; the ONLY out-of-thread seam is **"Simulate it →"**.

---

## 2. The new card — section by section (see the mockup)

Order, top to bottom:

1. **Header** — a **craft score ring** (`77 Craft`, KEPT per owner) on the left; the **craft-driver bars** beside it (Hook 87 · Credibility 80 · Clarity 72 · Substance 70). No "read"/verdict sentence. A slim footnote: *"Retention & reach aren't craft — they're measured in Simulate."* (Retention is reception → dropped from the craft cluster.)
2. **Filmstrip** — *"Your video, frame by frame"*: the real segments as labeled frames (cold open → setup → **stall** → payoff → close), cold-open marked sage *asset*, the 0:08 stall marked amber *weak beat*, over a 0:00→0:15 timeline. The director's structural read.
3. **Working / Not working** — a two-column ledger. Sage ✓ strengths, coral ✕ weaknesses. (This is the "know what's working/not" the owner asked for.)
4. **The director's fixes** — the heart. Each fix = **the referenced video FRAME (theirs) → diagnosis → WHY (psychological mechanism, NEUTRAL styling) → the move → PROVEN (a real corpus example, where one fits).** Grounding is SELECTIVE — the mockup shows 2 grounded fixes + 1 ungrounded (CTA) to demonstrate the honest-absence state.
5. **Simulate it →** — the only door out, with a line making the Test/Sim split legible.

**Owner design notes captured this session:**
- Craft number STAYS (a technical/craft grade, NOT a reception score).
- Show the actual video FRAME wherever a moment is referenced (so the user sees exactly what's called out).
- Psychological "why" per fix — but styled NEUTRAL, not as a coral warning.
- Grounding on SOME fixes, not all — "show the user an example to improve toward" where the corpus has a real match.
- A filmstrip breakdown of THEIR video.
- Drivers sit NEXT TO the score; no title/sentence beside the score.

---

## 3. The raw material (what the pipeline actually produces)

The Test pipeline emits a `PredictionResult` (~40 fields). Data shape lives in `src/components/reading/__tests__/fixtures/reading-fixture.ts` — READ IT FIRST. Craft-relevant fields (all real, all available):

- **`apollo_reasoning.dimensions[]`** — 6 scored 0–100, fixed order `[hook, retention, clarity, share_pull, substance, credibility]`. Each `{ name, band: 'strong'|'mid'|'weak', score, lever (a named craft lever, e.g. "Contrast / curiosity gap (§2.1)"), evidence (prose) }`. **CRAFT subset = hook, clarity, substance, credibility** (± share_pull). **retention = reception → belongs to Sim**, drop from Test craft cluster.
- **`apollo_reasoning.rewrites[]`** — `{ original (verbatim hook), variant (rewritten), lever_fixed }`. The hook "move" for a fix.
- **`counterfactuals.suggestions[]`** — `{ type: 'fix'|'reinforcement', headline, detail, timestamp_ms, signal_anchor: 'hook'|'retention'|'cta' }`. The actionable fixes + the "keep" reinforcements.
- **`heatmap.segments[]`** — `{ idx, t_start, t_end, label ('cold open'/'setup'/'stall'/'payoff'/'close'), is_hook_zone, keyframe_uri }`. The filmstrip + frame evidence. (`heatmap.personas` / `weighted_curve` / `weighted_top_dropoff_t` are RECEPTION → Sim, do NOT render on Test.)
- `apollo_reasoning.ceiling_capper`, `confidence_scope`, `composite_score`.

**The craft score** = compute from the craft dims only (exclude retention). Mockup uses 77 as an illustrative craft-subset grade.

---

## 4. Grounding the fixes (the corpus)

The 500-video corpus is exposed via `src/lib/grounding/corpus-tool.ts`:
- `SEARCH_CORPUS_TOOL` / `executeCorpusSearch(...)` — filter by `hook_technique` (47 first-frame devices: crash-zoom, match-cut, cold-open…), `hook_archetype`, `visual_setting`, `editing_style`, `format`, `niche`, axis `topical|structural`.
- Returns rows with `handle, views, multiplier, spoken_hook, hook_template, structure, archetype, …` under the **warrant honesty contract** (`grounded`/`citable`) — a curated exemplar is never dressed as a proven outlier.
- `gatherReferencesViaTool(...)` is the agentic scout loop (latency); for a per-fix targeted retrieval prefer a DIRECT `executeCorpusSearch` keyed off the fix's lever/technique.

**Render the corpus ref with `src/components/thread/proof-receipt.tsx` (`ProofReceipt`)** — the same grounding receipt the hook/idea cards use. `HookProof` shape is in `src/lib/tools/blocks.ts`.

**Rule (owner):** ground the **top 1–2 fixes** where a warranted match exists; otherwise the fix stands on its Apollo rewrite alone (state the absence honestly — see `NoSourceNote` idiom). Do NOT force a proof onto every fix.

---

## 5. Files to touch (build plan)

- `src/lib/tools/blocks.ts` — extend `VideoTestCardBlock` schema: craft score + drivers[], filmstrip segments[], fixes[] (frame + diagnosis + why + move + optional grounded `HookProof`), keep[]. Drop reception fields.
- `src/app/api/tools/test/card/route.ts` — the `PredictionResult → block` mapping. Add: craft-score computation (craft dims only), map dimensions/rewrites/counterfactuals/segments, and run the **corpus retrieval for the top fix(es)**.
- `src/components/thread/video-test-card-block.tsx` — **rebuild** the renderer to the new spec (currently a thin verdict card that navigates out to `/analyze`).
- `src/components/thread/proof-receipt.tsx` — reuse `ProofReceipt` for the PROVEN corpus refs (no change likely).
- `src/components/reading/*` — SOURCE to adapt (filmstrip from `segments`+keyframes; the Apollo dims logic). The `/analyze` page + route to eventually DISSOLVE (persistence/permalink reconciliation is a follow-up — scope it).
- `src/app/(app)/dev/cards/page.tsx` + `.../dev/cards/fixtures.ts` — update the gallery: the new card renders under the **Skills** tab (video-test-card); the **Reading** tab (full `/analyze`) is what's being dissolved.
- `src/components/thread/__tests__/…` — guard the new block.

**Dev:** server on **:3011** (see memory `dev-server-launch`); test user `e2e-test@virtuna.local` / `e2e-test-password-2026`; `/dev/cards` is the real renderer (auth-gated → 307 to /login). `.env.local` is per-worktree gitignored.

---

## 6. Open forks (decide during build)

1. **Grounding retrieval timing** — run corpus retrieval at Test-run time (adds latency) vs lazily on expand. (Recommend: at run-time for the top fix only; it's cheap and the card is already a paid Max run.)
2. **Fixes collapsed by default?** — the card is tall (filmstrip + ledger + 3 fixes). Consider showing fix 1 + "2 more →".
3. **`SIM-1 Max` badge dies on Test** — Max now = Sim population size; Test runs no population. Give Test its own provenance ("frame-by-frame read" / Apollo). NB "Max" was never a bigger model — Flash = text-only call, Max = same `qwen3.7-plus` WITH video (`docs/MODEL-POLICY.md:25`).
4. **/analyze dissolution scope** — the card rebuild can ship first (card links to old /analyze or stubs it); fully removing the route (SSE hook, board layout, permalink persistence) is a bounded follow-up.

---

## 7. Already landed this session

- **`b178d679`** `fix(cards): unique keys for corpus-references rows` — the `corpus-references-block` dup-React-key bug (row keyed on `videoUrl`, collided when two rows shared a URL). Committed + pushed. Unrelated to the Test rework.

---

## 8. Guardrails (don't regress)

- **Reception-pure Test** — no retention curve, no crowd/ProofUnit reaction, no reach, no "% would stop" on the Test card. Those are the Sim's.
- **Keep the craft number** (owner-locked).
- **Honesty spine** — corpus refs obey the warrant contract; state absences (no fabricated proof); reuse `ProofReceipt`.
- **Design system** = flat-warm charcoal, SSOT `src/app/globals.css` (`@theme`) — accent coral `#FF6363` near-zero dosage; sage `#8ea68a` = working/positive; borders 6%/10%; card radius 12–14. See `docs/DESIGN-SYSTEM.md`.
- **Don't build the Simulation surface** — that's the parallel session.

Related memory: `test-vs-simulation-split`, `skill-cards-prod-lane`, `skill-card-run-capsule`, `grounding-corpus-as-a-service`.
