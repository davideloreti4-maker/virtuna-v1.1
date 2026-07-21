# HANDOFF 2026-07-21 — Ambient Audience v2: BUILD the three surfaces (round-4 anchored)

**Status: SKETCH LOOP CLOSED → BUILD.** After 5 rounds of 3-panel sketches + one focused
single-page pass, the owner called it: *sketch fidelity ≠ implementation fidelity, so more
sketching is diminishing returns.* We build the three core surfaces as real components and refine
**live in code** — the accurate medium.

- Worktree: `~/virtuna-ambient-audience-v2` · branch `design/ambient-audience-v2`
- **Architecture SSOT (do NOT re-litigate): `docs/HANDOFF-2026-07-20-ambient-audience-v2-concept.md`**
  (L1–L6, resolved opens, design laws, per-surface bets, premium mandate). This doc is the BUILD
  brief that sits on top of it.

---

## 0 · The one thing that matters most

**Visual SSOT = ROUND 4** (`.scratch/panel-v6-round4.html`). The owner reviewed every round and
said round 4 is *"the most accurate version I liked."* Build to round 4's grammar.

**SUPERSEDED — do NOT use, do NOT carry forward:**
- `.scratch/panel-v6-round5.html` — its reinterpretations were explicitly rejected in favour of r4:
  %-as-hero column · one-bar-language (row-underline = outcome bar) · signal-networks demoted to a
  disclosure + "why this second" synthesis · terrain rebuilt as one connected cloud · composition
  strip. **None of these were adopted.**
- `.scratch/p1-overview-r1.html` — a focused single-page pass, same fate.

If you find yourself reaching for a round-5 idea, stop — the owner saw it and chose round 4.

> Sketches are gitignored (live only in this worktree's `.scratch/`). Serve them with
> `cd .scratch && python3 -m http.server 8777` → open `panel-v6-round4.html`. Round-4's anatomy is
> also transcribed in §3 below, in case the files are gone.

---

## 1 · What to build (scope)

The three core surfaces from the locked state machine:

| # | Surface | Role |
|---|---|---|
| ① | **Overview + watching** | The room's home. Rest header + live watching state IN PLACE + ranked screening list. The screen users live in. |
| ② | **Detail — Brain** (tab 1) | Out-Sapient Sapient: cortex replay + attention scrubber + signals + ask-why. |
| ③ | **Detail — Audience** (tab 2) | Out-AS AS: terrain canvas + outcome + segments + coded reasons + interviewable cast. |

Detail is **always ONE stimulus** (L-lock). Overview owns comparison (the ranked list) + the
watching/loading state. Two detail tabs replace the old 3-tab AmbientRoom.

**DEFERRED — not this build:** ④ start screen and ⑤ simulate sheet (⑤ still has open design
decisions: scene-mismatch treatment, best preset-question set). Ship ①②③ first.

---

## 2 · Architecture you're building to (load-bearing summary; full detail in the concept doc)

- **L1** — one audience per thread, hard-locked at thread start (room chip). New audience = new thread.
- **L3** — two-page instrument **Brain | Audience**; the rail/receipt keeps the v4 cascade
  (brain → population → voices) as the at-a-glance summary. Rail routing: brain figure → Brain tab;
  outcome % / terrain / voices → Audience tab.
- **L4** — three-shelf config (Audience = slow/WHO · Thread = platform·scene·fidelity · Run =
  question·segment·stimulus). Nothing configurable in two places.
- **L5** — fidelity tiers **SIM-1 Flash (n=1,000) / SIM-1 Max (n=10,000)**; receipts carry the full
  config sentence incl. n. Terrain layout never changes with n.
- **L6** — configuration is loud exactly once, at its container's birth; quiet chips + receipt after.
- **State machine** — Overview = rest header + running-item-as-watching-in-place + ranked list;
  detail = one stimulus with a `1 of N ‹ ›` pager; detail needs no empty states.
- **Design laws** — cascade order · organs never move (states change intensity) · **cream is the
  room, coral is only where you lose them** · sealed verdicts during watching (no fabricated
  partials) · **terrain is ONE connected society** · serif = voice/verbatims only · type floor 12px ·
  ask-chips belong to the chat composer, never the report panels · every section = mono kicker +
  human question + owning number · Sapient de-box (hairlines, never bordered tiles) · 🔒 cortex
  rainbow ramp is owner-locked.

---

## 3 · Round-4 anatomy (the visual target, transcribed)

**① Overview** — room header (`Your audience · calibrated · 3d ▾`) · `SIMULATING NOW · SIM-1 FLASH`
run card (staged `reading·brains·votes·verdict`, `N of 1,000 decided`, `sealed`) · `RANKED · WOULD
THEY STOP · SIMULATED` list (5 rows: stimulus + % + thin bar; coral bar on the worst) ·
`＋ Test a new variant` · cast avatars (`M D P T +8 on call`).

**② Brain** — `← All 5` + `hook 2 of 5` pager · **`38.2%` would stop** hero + (r4 had a small
bar-glyph here — see marks) · tabs `The brain | The audience` · **Predicted cortex** figure (🔒
rainbow, corner chips `PREDICTED CORTEX` / `MODELED` / `t=`) · `ATTENTION · SAME PLAYHEAD` →
"Where attention holds · hold 38" (play button + transcript with the peak word underlined + attention
curve-as-scrubber + moment chips `0:01 72` / `0:04 28` / `0:07 46`) · `SIGNAL BREAKDOWN` (Emotional
hit 65 strong / Credibility 62 okay / Visual pull 61 okay) · `NETWORKS · AT THE PLAYHEAD` (z-scored:
Focus −1.1σ / Memory +0.7σ / Emotion +0.4σ / Visual −0.4σ) · `HOW TO READ THESE NUMBERS ›`.

**③ Audience** — hero + tabs · terrain map (nodes = people, clustered) · `OUTCOME · P82 OF YOUR 41 ·
SIMULATED` tri-state (38% stopped strong / 41% skimmed okay / 21% scrolled past low-coral) · `WHO
STOPPED · BY SEGMENT` (builders 82 / scrollers 51 / drop-ins 40 / skeptics 12-coral) · `WHY · CODED
FROM 1,000` (3 reasons ×count + serif verbatim + `Name · segment · interview ›`) · `HOW TO READ ›`.

**r4 grammar laws:** de-box (hairline dividers, no bordered tiles) · figures self-label with corner
chips · moment chips seek the playhead · staged watching (sealed) · `＋ Test a new variant` ghost row ·
trust footer · one person never "speaks for" N — a coded reason does, the persona is its exemplar.

---

## 4 · Owner's round-4 marks = the in-code refinement backlog

The owner marked round 4 this session. **Build r4 faithfully first, then resolve these LIVE in code
with owner review.** Do NOT pre-apply round-5's specific solutions (rejected) — solve fresh, keeping
r4's feel.

| Where | Mark | Notes |
|---|---|---|
| **Global** | All three panels the **same fixed height** | Platform height is already fixed. Safe to bake in from the start. |
| **P1** | Overview + loading/watching state read "a bit confusing / unrefined" | Refine UI, what data is shown, and UX. |
| **P2 + P3** | The small **bar-chart glyph** beside the `38.2%` adds no value | Replace with a better visual or remove. Safe to remove early. |
| **P2** | **Signal breakdown + networks** section needs real improvement | UI/UX/user-value/which-data. Ref **Sapient** (sapient-12 nine-signals de-box · sapient-13 raw-network **plain-word translation** + "why this second" synthesis — the *translation* is the value, the raw σ jargon is not). |
| **P3** | Terrain must be **ONE connected interactive cloud** — not 4 disconnected category islands | Ref **AS** (as-03 one-organism network). Owner: "one cloud, nice and interactive," maybe without hard categories. Aligns with the locked "one connected society" law. |
| **P3** | Outcome / who-stopped-why section is **cluttered/unstructured** | Declutter + restructure. Ref **AS** insights (as-06). |

Competitor refs on disk: `.planning/references/sapient/` (03/07/10/12/13/14) ·
`.planning/references/artificial-societies/` (as-01…07).

---

## 5 · Existing code — REUSE, don't rebuild (verified 2026-07-21)

This is a **reorganization + reskin into the r4 grammar + 2-page structure**, not greenfield.
`src/components/audience-lens/` (~24 files) + `src/components/reading/` already hold most primitives.

**KEEP / REUSE:**
- `CortexCanvas.tsx` (588) 🔒 locked — backed by `src/lib/brain/cortex-{colormap,field,sim}.ts`.
- `AttentionCurve.tsx` + `reading/retention-scrubber.tsx` (569) — the attention scrubber.
- `PopulationSwarm.tsx` (323) — terrain/population (the P3 "one cloud" rework target).
- `SignalGrid.tsx` / `SigmaBars.tsx` / `SignalHeatmap.tsx` — signal/network viz (the P2 rework targets).
- `PersonaChatDrawer.tsx` (356) — interview / ask-why surface.
- `ReplayController.tsx` (215) · `HowToRead.tsx` · `reading/score-gauge.tsx` · `reading/reading-hero.tsx`.

**CONSOLIDATE / REPLACE — the dedup reckoning** (build-time, per concept doc §7):
- `AmbientRoom.tsx` (960, the 3-tab shell) → **Overview + 2-page Brain|Audience.**
- `BrainView.tsx` (1189) → the new **Brain** tab (rework, don't fork).
- `AudienceLensContent.tsx` (476) · `audience-presence.tsx` (998) · `ClusterView.tsx` ·
  `reading/audience-orbit.tsx` (238) · `reading/audience-breakout.tsx` (361) · `reading/persona-cloud.tsx`
  → reconcile into **Audience** tab + Overview. Expect real overlap; pick one home per concept (L4).

**Logic/contract:** `src/lib/room-contract/types.ts` (Read/Reaction/Person/ActiveAudience atoms —
start here for the run-result shape) · `read-to-card-reaction.ts` · `lens-derive.ts` · `room-readout.ts`
· `flat-card-reactions.ts`. Mounts today: `src/app/(app)/dev/cards/page.tsx` + `reading/reading-room.tsx`.

> **First code step: map this surface and decide reuse-vs-replace per component BEFORE writing.**
> The inventory above is your starting map.

---

## 6 · Data contracts (sequencing, not blockers)

- **READY** (build against now): split / voices / segments / signals per run · CI (bootstrap over
  agents) · percentile vs own history (within same fidelity tier, L5).
- **VERIFY** early: per-agent response intensity · what `read-to-card-reaction.ts` + the skill
  pipelines actually emit · Qwen auto-reaction call cost at scale (L2 assumes unmetered-cheap).
- **NEW** (LLM/data work — may gate the richest bits): coded reasons w/ counts (objection
  clustering) · standing findings · track record / MAE · **terrain layout** (stable taste-embedding
  → 2D, same across runs) · chat → lens compilation.

→ **Overview + Brain need mostly READY data. Audience's coded-reasons + terrain-layout are NEW** —
sequence Audience last and degrade gracefully where a contract isn't live yet.

---

## 7 · Build sequence (recommended) — the new refine loop

**Overview → Brain → Audience.** For each: build in r4 grammar → run the dev server → owner reviews
**live** → refine the marked areas in code. Overview first: most locked, needs mostly READY data, and
carries the watching-motion that only judges true in the real material (the reason we left sketches).
This IS the replacement for the sketch loop.

---

## 8 · Design system + gotchas (this app)

- **Tokens (SSOT `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`):** bg `#1f1f1e`, cream `#ece7de`
  (never `#fff`), accent coral **`#FF6363`**, borders 6% (hover 10%), radius 12 cards / 8 inputs,
  Inter for chrome, **Newsreader serif for voice/verbatims ONLY**, type floor 12px.
- **⚠️ Playwright screenshots HANG on this app** (ambient animations never settle) → verify via
  `getComputedStyle` / `getBoundingClientRect`, or raw Playwright with `animations:'disabled'` +
  `caret:'hide'` + tight `clip`.
- Lightning CSS strips `backdrop-filter` → apply via React inline style.
- `--color-hover` is an overlay tint, not a fill → use a solid tone in floating docks.
- Dev server: direct-node not npx, `rm -rf .next` + restart on branch switch.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (plain `npm test` is a shim/fake). Keep
  `reading/__tests__/reskin-matte.test.ts` green (bans legacy coral/glass; does NOT ban `#FF6363`).
- Tailwind v4: `--font-*` is the family namespace — never declare weight tokens there.

---

## 9 · Start-here protocol (fresh session)

1. Read this doc + the concept doc (§0 architecture SSOT).
2. Serve `.scratch` on :8777 → open **`panel-v6-round4.html`**. (Do NOT open round5 / p1 files.)
3. Map `audience-lens/` + `reading/` (the §5 inventory is your starting map); decide reuse-vs-replace.
4. Verify the run-result data contract (`room-contract/types.ts` + what the engine emits) — confirm
   READY vs NEW (§6).
5. Build **Overview** in r4 grammar — same fixed height, glyph removed. Run dev server, review live
   with owner, refine the P1 marks.
6. Then **Brain**, then **Audience**, same loop.
7. Verify: full suite green + a live browser pass (use the screenshot-hang workaround in §8).

**Commit format:** `type(ambient-audience): description`. Atomic commits per surface/step.
