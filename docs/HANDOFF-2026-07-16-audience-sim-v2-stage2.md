# Handoff — Audience Sim v2, Stage 2 (population math) SHIPPED · 2026-07-16

**Worktree:** `~/virtuna-audience-sim-v2` · **Branch:** `feat/audience-sim-v2` (committed + pushed to origin)
**SSOT:** `docs/DESIGN-2026-07-15-audience-simulation-v2.md` (§8.3 = what shipped, §7 = feedback-loop deferral)
**Memory:** `audience-simulation-v2-design.md` + `MEMORY.md` index line (both updated)

---

## 0 · TL;DR — where a fresh session starts

Stage 2 is **done, committed, pushed, and browser-verified.** The "Population · 1,000" surface now runs
a **real O(N) score of ~1,000 sampled individuals** (not the 10 archetypes' rollup at denser resolution),
so different hooks light up different segments — with an honest *"a projection, not 1,000 replies"* frame.

**Next work is all ADDITIVE and OPTIONAL (no blockers):**
1. Wire the population aggregate into the **6 card runners** (hooks / ideas / script / remix / simulate /
   predicted-pin) and the separate **`PopulationSwarm.tsx`** (the AudienceLens *Sheet* path via
   `LensTrigger` on cards / Reading). Both currently still show the honest-lean rollup — which is also
   honestly labeled, just less rich. Reuse `reactPopulation` + thread the optional `population` prop.
2. A full **authenticated live session** (a real DB audience with v2 axes → composer → react route →
   Population·1,000 in a real browser). The pipeline is proven on a real signature + the real component;
   the end-to-end authed round-trip is not yet driven.

**Do NOT** start the feedback loop or hand-tune the scorer constants (see §4).

---

## 1 · What shipped — 4 atomic commits on `feat/audience-sim-v2`

| Commit | What |
|---|---|
| `98e33a68` | Pure population math (`population.ts`) + content characterization (`characterize-content.ts`) + verify script + 16 unit tests |
| `eec9ae69` | `/api/tools/react` computes the projection (concurrent w/ flash, guarded, degrades safely) + 3 route tests |
| `07e0b405` | The Population·1,000 view (`AmbientRoom`→`PopulationView`) renders the real projection + per-segment split + 2 component tests |
| `b50aa3fe` | Design §8.3 |
| _(uncommitted at write time, committed with this handoff)_ | Design §7 feedback-loop deferral |

---

## 2 · Architecture (files + data flow)

**Pure core — `src/lib/audience/population.ts`** (no LLM, O(N), deterministic, 16 unit tests)
- `expandSignature(signature, {N,seed})` → samples ~1,000 individuals off the 10 signature slots
  (centroid + seeded jitter; a legacy slot without `reaction` axes is skipped). Jitter σ is a FIXED
  constant (`SEGMENT_SIGMA`) — the signature stores no per-segment `spread` yet (honest v1 limit).
- `pStop(individual, contentVector)` → the tuned two-driver logit (verbatim §8.2 constants) + auditable `why`.
- `reactPopulation(signature, vector, {N,seed})` → `PopulationAggregate` { total, stop, scroll, stopPct,
  segments[] (share-sorted, each { archetype, displayName, share, total, stop, stopPct }), reasons[] }.
- `signatureHasPopulationAxes(signature)` → the guard (topic_vocab non-empty AND ≥1 persona has `reaction`).

**The one LLM call — `src/lib/audience/characterize-content.ts`** (server-only — imports the Qwen client)
- `characterizeContent(content, topicVocab)` → `ContentVector` (Qwen, temp 0 + seed + json_object, Zod).
- Imported ONLY by the route. NEVER a client bundle.

**Route — `src/app/api/tools/react/route.ts`**
- `characterizeContent` runs CONCURRENTLY with the flash reaction (it doesn't depend on it → no added
  latency), guarded to calibrated audiences with v2 axes (General/legacy → byte-identical old path).
  A characterize failure → `population: null` (never breaks the reaction). Returns `population` in the JSON.

**UI data flow (type-to-room path):**
```
/api/tools/react  →  composer.tsx (askAudience / onReask)
  →  AmbientFocus.population  +  AudienceAsk.population   (ambient-presence-types.ts)
  →  use-ambient-focus.ts (toFocus carries it)
  →  AudiencePresence  →  <AmbientRoom population={focus.population}>
  →  PopulationView   (renders real numbers + "Who it lands with" segment split + "a projection" label)
```
- All client refs to `PopulationAggregate` are `import type` → no server code leaks into the client bundle.
- When `population` is absent → byte-identical fallback to the prior honest-lean rollup of the 10.
- The 10 real personas still supply the bounce VOICES; the projection only supplies NUMBERS (never quotes).

---

## 3 · Verification done (not just green tests)

- **`scripts/verify-population.ts`** — bakes a REAL signature (real synth) → characterizes 3 niche hooks →
  scores 1,000. Distribution is DIFFERENTIATED + ROTATES per hook (ADHD-2am → Community Validators 99% /
  Method Critics 84% / Silent Scrollers 47%), 0%-segments rotate, `why` flips strong-hook↔interest.
- **Real browser** (throwaway route → real `<AmbientRoom>` in the Next/webpack bundle, DOM read): 346 stay
  / 654 bounce, "1,000 sampled from your audience · a projection", "35% loved / 65% bounced", segments at
  99%/84%/0% — **0 console errors**.
- **Gate:** tsc clean on all touched files; **403 tests pass** (audience lib + audience-lens + react route).

---

## 4 · Decisions taken this session (LOCKED)

1. **Feedback loop (P6) DEFERRED OUT OF PRODUCTION SCOPE (owner).** The naive per-user/online loop
   (continuously scrape the user's account, or have them upload the posted video) is UNRELIABLE:
   (a) **signal mismatch** — we predict stop/retention, the public scrape gives only view/like/share
   COUNTS; real retention is behind creator analytics (OAuth IG/YT partial, TikTok gated); (b)
   **attribution** — posted video ↔ in-app prediction is lossy (creators edit/deviate); (c) low compliance
   / noisy single-post sample. The realistic form is **offline + global**: bake a signature from a
   creator's PUBLIC scrape → predict → correlate predicted-stop vs the video's over/under-performance
   against the creator's baseline (`fabricated-proof-baseline` infra — no auth/upload, at scale). Ceiling:
   a CORRELATE → earns "validated," not "accurate." A validation SPIKE was OFFERED and DEFERRED (later stage).
2. **The conservative absolute stop-level is a KNOWN, ACCEPTED, honestly-framed limit** — NOT auto-fixed
   soon, and NOT to be hand-tuned (over-fits 3 hooks + characterization noise). The DIFFERENTIATION is the
   architectural bet, and it holds; the absolute anchor is a calibration the (deferred) offline pass owns.
3. **Production ships as an HONESTLY-LABELED generated simulation** — the "a projection" framing is what
   carries production, not an accuracy claim. That framing is already in place on the Stage-2 surface.

---

## 5 · Gotchas to carry forward

- **Dev server (this worktree):** `next dev --turbopack` FAILS (Turbopack rejects the out-of-root
  `node_modules` symlink). Use `next dev --webpack -p <port>` AND temporarily neutralize `DevLocator`
  (comment its import + usage in `src/app/layout.tsx` — it statically imports `react-scan`, which breaks
  under webpack; revert after). A throwaway preview route must live OUTSIDE `(app)` (that layout
  hard-redirects to /login) and avoid a `_`-prefixed folder. Screenshots hang (ambient animation never
  settles) — read the DOM via `browser_evaluate`, don't screenshot.
- **Tests:** run the real vitest binary (`node ./node_modules/vitest/vitest.mjs run <paths>`) — `npm test`
  prints fake results. The `src/components/app/home/__tests__` suite emits a harmless `ECONNREFUSED :3000`
  during teardown (an aborted in-flight fetch) — the tests still pass.
- **Auto-push:** `core.hooksPath = .githooks` is active — every `git commit` auto-pushes the branch to
  origin (the worktree convention so Web Claude sessions can read it).

---

## 6 · Pointers

- **SSOT design:** `docs/DESIGN-2026-07-15-audience-simulation-v2.md` — §8.3 (Stage 2 shipped), §8.2
  (scorer tuning), §7 (feedback-loop deferral + the offline/global alternative), §4 (architecture).
- **Reference impl:** `scripts/spike-persona-population.ts` (the original spike) + `scripts/verify-population.ts`.
- **Memory:** `audience-simulation-v2-design.md` (full status) + `MEMORY.md` START-HERE line.
