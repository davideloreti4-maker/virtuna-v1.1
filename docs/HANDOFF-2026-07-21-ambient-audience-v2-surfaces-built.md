# HANDOFF 2026-07-21 — Ambient Audience v2: FOUR surfaces BUILT in code

**Status: BUILT + owner-approved through Brain.** The sketch loop is closed (see the two prior docs);
this session turned round 4 into real React. Four of the five surfaces exist, render live, and pass
the gates. Nothing is wired into the product shell yet — they live on a standalone dev review route.

- Worktree `~/virtuna-ambient-audience-v2` · branch `design/ambient-audience-v2`
- **Architecture SSOT (unchanged, do NOT re-litigate):** `docs/HANDOFF-2026-07-20-ambient-audience-v2-concept.md` (L1–L6 + laws)
- **Build brief (round-4 anatomy, marks backlog, reuse inventory):** `docs/HANDOFF-2026-07-21-ambient-audience-v2-build.md`
- **Visual target = ROUND 4** (`.scratch/panel-v6-round4.html`). r5 + p1 pass are REJECTED — do not carry them.

---

## 1 · What was built (all in `src/components/audience-lens/v2/`)

| Surface | File | State |
|---|---|---|
| ① Overview | `AmbientOverview.tsx` (362) | ✅ built + approved — rest header · staged watching-in-place · ranked list · cast |
| ② Detail shell | `AmbientDetail.tsx` (257) | ✅ shared header (pager · verdict hero · Brain\|Audience tabs). **Bar-glyph removed** per mark |
| ② Brain tab | `BrainTab.tsx` (333) | ✅ built + approved — 🔒 cortex · attention scrubber · signals · networks · how-to |
| ③ Audience tab | `AudienceTab.tsx` (241) | ✅ built — terrain (one connected society) · outcome tri-state · segments · coded reasons |
| ④ Start | `AmbientStart.tsx` (~230) | ✅ built — serif time-of-day hero · thread-default chips · composer · ACTIONS grid |
| Fixtures | `overview-fixture.ts` · `detail-fixture.ts` · `start-fixture.ts` | r4 content, typed to real contracts |
| Review route | `src/app/(app-less) ambient-v2/page.tsx` | public dev page, surface switcher chips |

**Run it:** dev server on **`http://localhost:3007/ambient-v2`** (port 3007 because :3000 = the
thread-cards worktree). Chips switch surfaces: `④ start · ① overview · ② brain`; ③ Audience is the
`The audience` tab inside Detail; Overview has a `simulating ⇄ at rest` toggle. It is a **public
route** (top-level, outside the `(app)` auth group) so it renders without login — the `(app)` layout
needs Supabase + auth. Shared fixed height `AMBIENT_PANEL_HEIGHT = 800` for the three room panels
(start is its own wider column).

⑤ **Simulate sheet — NOT built** (see §4, it has two open owner decisions first).

---

## 2 · Reuse decisions (verified live — the dedup reckoning, partial)

**Reused as-is (locked/heavy):**
- `CortexCanvas` 🔒 (default export, WebGL) via `dynamic(() => import("../CortexCanvas"), {ssr:false})`.
  Props `seed = hashSeed(seedKey)` · `bold = predictedBold(drive, t)` · `t`. Drive built inline:
  `{ mode:"simulated", stopRatio, durationS, seedKey }` from `@/lib/brain/cortex-sim`. A ~4Hz `t`
  clock recomputes `bold`; the canvas lerps + drifts on its own frame loop. **Verified: real
  anatomical rainbow renders + animates** (t-clock advances, map moves).

**Built LEAN in r4 grammar (deliberately NOT reused):**
- Watching card, attention curve-as-scrubber, signal/network rows, terrain. Rationale:
  `retention-scrubber.tsx` is video/`PredictionResult`-coupled + has no transcript/moment-chips;
  `PopulationSwarm` scatters dots around anchors with **no connecting edges** (can't render the "one
  connected society"); `BrainView` (1189 ln) fuses one `drive` state to every section. The terrain
  is a deterministic **seed-42 LCG** graph (stable across runs + SSR — design law 8).
- Did **NOT** drag in `audience-presence`'s switcher/portal apparatus or `AudienceLensContent`.

**Motion** = `requestAnimationFrame`, gated on `reducedMotion` (static frame). Verified animating:
watching fill + count-up + staged log (sealed verdict), cortex t-clock, attention playhead.

**Not yet consolidated:** the legacy 3-tab `AmbientRoom` (960) + `BrainView` (1189) +
`audience-presence` (998) etc. still exist untouched. The v2 surfaces are a parallel clean build; the
legacy deletion/graft happens when these wire into the product (a later step).

---

## 3 · Data contract status (build brief §6)

- **Maps to REAL contracts:** ranked list (`AmbientFocusSibling`), cast (`Person`), per-segment %
  (`PopulationAggregate.segments`), per-signal 0–100 (`BrainSignal`), per-network σ (`NetworkSigma`),
  attention curve (`AttentionCurve`). Cortex drive is real (`predictedBold`).
- **NEW / fixture-backed (degrade later):** the staged watching progress (engine emits terminal
  snapshots, no partial-vote stream — so "sealed until n-of-n" is the honest read, NOT a data gap);
  the tri-state **"skimmed" middle** (live attention axis is binary stop/scroll); coded-reasons ×count
  (objection clustering); the terrain 2D layout. r4's signal label "Credibility" has no live axis —
  reconcile in the P2 rework.

---

## 4 · Pending — the live-refine backlog + ⑤

**Owner marks (built faithful to r4 FIRST, refine in code next — NOT via r5's rejected solutions):**
- **P1** — Overview watching state read "confusing / unrefined." Refine UI + which data + UX.
- **P2** — signal breakdown + networks need the real rework: **translate σ into plain words + a "why
  this second" synthesis** (ref `.planning/references/sapient/` 12/13 — the translation is the value).
- **P3** — terrain → ONE *interactive* cloud, less hard-category (ref AS as-03) · **declutter** the
  outcome/who-stopped section (ref as-06).

**⑤ Simulate sheet — needs two owner decisions before building** (arming an instrument, not a form:
lens = question × segment + SIM-1 Flash/Max):
1. **Scene-mismatch treatment** — encounter platform ≠ calibration provenance: disclaimer vs soft-block? (open #8)
2. **Best preset-question set** — `stop/want/believe/share/buy` is a draft; needs a pass *with custom-compile in mind*.

---

## 5 · Verification done (this session)

- **tsc `--noEmit`: 0 errors** (whole project) · **eslint: clean** on all v2 files · reskin-matte guard 38/38.
- Live browser pass via Playwright `getComputedStyle`/`getBoundingClientRect` (screenshots misalign on
  element-capture — use **viewport** screenshots, they work; the CLAUDE.md screenshot-hang is real).
  Confirmed per surface: exact tokens (380×800, #1f1f1e, 6% border, Inter, mono kickers, Newsreader
  serif verbatims), **coral confined to one loss zone** each (Overview 1, Brain 3 = attention weakness,
  Audience = skeptics + 21%/12%/×253, Start 0 = nothing lost yet), glyph absent on Detail, cortex WebGL
  mounts + both clocks animate, terrain 100 nodes/144 edges, hydration clean.

---

## 6 · This-app gotchas (carry forward)

- Worktree started with **no `node_modules`** (`pnpm install`) and **no `.env.local`** (copied the
  gitignored one from a sibling worktree — needed or the `(app)` layout 500s on Supabase).
- Dev server: direct-node, detached (Python `os.fork()`+`setsid`), 2GB cap, port 3007. `rm -rf .next` on branch switch.
- Tests: `node ./node_modules/vitest/vitest.mjs run` · tsc: `node ./node_modules/typescript/bin/tsc --noEmit` · eslint: `node ./node_modules/eslint/bin/eslint.js …` (the `.bin` shims aren't node-runnable).
- **Disk filled mid-session** (many worktrees' `.next` + a fresh `pnpm install`) — watch it.

---

## 7 · Next-session protocol

1. Read this doc + the architecture SSOT (concept doc). Recall memory `ambient-audience-v2-concept`.
2. `cd ~/virtuna-ambient-audience-v2` · relaunch dev on :3007 · open `/ambient-v2`.
3. Pick up the owner's call: **refine a mark (P1/P2/P3)** — build faithful-to-r4 exists, so this is
   pure in-code iteration with live owner review — **or resolve ⑤'s two decisions then build it** —
   **or start wiring the v2 surfaces into the product** (the legacy `AmbientRoom`/`BrainView` graft).
4. Keep the r4 grammar laws (de-box, coral = one loss zone, serif = voice, sealed verdicts, section =
   kicker + human question + owning number, 🔒 cortex rainbow).

**Commit format:** `type(ambient-audience): description`.
