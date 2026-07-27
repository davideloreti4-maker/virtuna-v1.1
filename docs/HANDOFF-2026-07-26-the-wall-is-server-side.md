# Handoff — the wall is server-side (2026-07-26, session 5)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · tip `349736ba` (pushed)
**Green:** suite **4602 / 0** with flags unset AND with `NEXT_PUBLIC_AMBIENT_V2` +
`AMBIENT_V2_ENABLED` + `BILLING_ENFORCE_QUOTA` on · `tsc` 0 · `npm run build` OK ·
changed files lint clean.

> Reads on top of `HANDOFF-2026-07-26-hero-is-the-funnel.md` and
> `HANDOFF-2026-07-26-funnel-is-the-platform.md`, both still accurate.
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired walkthrough. Do not build from it.
> 🔴 THE PORT TRAP IS STILL LIVE: three worktrees serve /go. THIS work is on **:3000**;
> `~/virtuna-maven-offer` on :3020 does not have it.

---

## 1. What changed, in one line

The sim verdict stopped being *hidden by the client* and became **absent from the wire**:
every response an anonymous session receives is sealed server-side, so devtools on the
conversion page shows nothing the $1 buys.

## 2. What is BUILT (`349736ba`)

### The one module — `src/lib/onboarding/verdict-seal.ts`

Keyed **strictly on `is_anonymous === true`** (mirrors `DEMO_CREDITS`): never tier `free`
(all 9 real users are tier free), never flag-gated (what crosses the wire must not depend
on which UI is mounted), and a MISSING claim reads as a REAL user — sealing a legacy
customer is the failure that matters; a missed anon costs one free verdict.

**What is stripped = the reception read**, the entire derivation surface of sealTemplate's
trio (`unlock` / `brain.whyThisSecond` / `population`) plus the would-stop chip:

| Field | Why it is the verdict |
|---|---|
| `heatmap` | carries `weighted_hook_score` — the would-stop % ITSELF, plus the curve `whyThisSecond` is pure math on |
| `personas` | the fold cast's reactions → the population drill |
| `persona_behavioral_aggregate` | action intents ("what they'd do") |
| `behavioral_predictions` | the same read at engine level (completion/share/save) |
| `predicted_engagement` | the reach forecast |

**What passes untouched = the free half** (§0b③): overall/craft score, suggestions,
verbatim transcript, the filmstrip events, the roster, the source receipt — everything the
free Test card is built from.

### The six wire paths, all sealed

1. **`POST /api/analyze`** — 4 emission sites (JSON, SSE `complete`, cached JSON, cached
   SSE). Sealed payloads carry `verdict_sealed: true` so a sealed response is
   distinguishable from a degraded run.
2. **`GET /api/analyze/[id]/stream`** — both `complete` sites. Without this the wall was
   one page-refresh deep.
3. **`GET /api/analysis/[id]`** — sealed AFTER enrichment: the route SYNTHESIZES a heatmap
   from `personas` when the row has none, so sealing the raw row would have leaked the
   synthesized curve.
4. **`GET /api/threads/open`** — `sim_seals` → the sealed wire form
   `{ sealed: true, at, video: { analysisId, craftScore } }`. Concept seals are omitted
   entirely (a text verdict has no free half; rows rehydrate honestly queued).
5. **`POST /api/tools/react`** — **403 `verdict_sealed` BEFORE any engine call or credit
   spend.** Running the sim and withholding the result would spend the demo pool on an
   answer nobody sees. The rail's watcher drops on non-OK → the row stays queued.
6. **`POST /api/tools/simulate`** — same 403, before the run AND before the thread write
   (a reaction-distribution block in `messages` would ride `threads/open` past the seal).

**DB writes stay FULL** (`analysis_results`, `threads.sim_seals`) — payment + identity
linking unlock without a re-run. `/api/tools/test/card` is untouched: the craft card IS
the free deliverable, and its seal-write is server-side.

### The sealed room (client)

`src/lib/surfaces/ambient-v2-sealed.ts` — `buildSealedVideoDomainTemplate` +
`templateIsSealed` (same contract as the walkthrough's `isSealed`; a test asserts BOTH
checks on the live template so the definitions can't drift). The rail
(`AmbientOverviewRail`) now takes `WireSimSealMap`:

- a sealed wire seal renders a **queued row** — "Tested video", craft score, **no %**
  (`revealed` hardcoded false; the adapter's withheld-0 sentinel stays inert);
- every door into it (row tap, quick-simulate, the Test card's `focusVideo`) opens the
  **sealed drill**: craft-score verdict chip, brain tab dim with
  *"…unlocks with the simulation verdict"*, audience tab leading with
  *"Your audience's reaction is sealed. Unlock the simulation to open the room."*
- `composer.tsx` / `AmbientOverviewSheet` retyped to the wire union; the Simulate door
  check (`.video` truthy) works unchanged on both forms.

**Deliberately minimal:** the sealed drill is two honest notes + the chip. The $1 CTA and
the wall's visual dressing belong to the CHECKOUT task — no price appears in room copy
(the CTA-copy contradiction is still `lane/maven-offer`'s open owner call).

## 3. How it was verified

- **Guards RED first**: 9 anon guards across 6 route-test files, all failing against the
  unsealed code before the routes changed; 4 narrowness tests (REAL session keeps the full
  read) green on both sides of the change.
- **Live wire, real browser, nothing billed**: /go → hero submit (analyze intercepted) →
  anon session on /home, then a thread seeded by SQL with the FULL seal (pct 61,
  population 1000, curve). Measured: `threads/open` returned only
  `{sealed:true, video:{analysisId, craftScore:84}}`; react + simulate → 403; the rail row
  read "84 viral" with no %; the drill showed the wall sentence; the DOM contained no
  "61", no "1000", no percent. Seeded thread + message deleted after.

## 4. NOT built — next session, in order

1. **Checkout + identity linking** (owner has `enable_manual_linking` + Whop in hand).
   The unlock IS the linking: `is_anonymous` flips false on link, and every seal above
   opens by construction — no unlock code path to write on the read side. Dress the
   sealed drill with the $1 CTA as part of this.
2. **The anonymous-user reaper — now 6 rows** (2 spike + 3 prior verification + 1 minted
   by this session's browser check). Left in place deliberately.
3. **The left column's void / starter-grid port** — owner call, still unanswered.

## 5. Open edges, flagged not fixed

- **Other skills stay OPEN for anon** (hooks/ideas/script/read/predict…): bounded by the
  10-credit demo pool, and their outputs are generative, not the sim verdict. Only the
  two verdict-producing routes are refused. If the owner wants anon = Test-only, that is
  one more `isSealedVisitor` refusal per route.
- **`overall_score` stays transmitted** (craft-side headline, feeds the degrade fallback
  page). If the owner considers the 0-100 score itself paid, add it to
  `SEALED_ANALYSIS_FIELDS` — one line + tests.
- **Confidence-rises-as-signals-disappear** is still untraced and now sits directly behind
  the wall on a paying visitor's own video. Unchanged this session.

## 6. Landmines (carried forward, all still live)

- `npm test` is fake — `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways.
- Dev server: **left running on :3000** (nohup, `NEXT_PUBLIC_AMBIENT_V2=true`,
  `AMBIENT_V2_ENABLED=true`). Kill it if you want the port back. `.env.local` copied here
  already (lacks only `WHOP_API_KEY`).
- ⛔ Never `npx supabase config push`. No Management API token on this machine.
- `/api/analyze` lies three ways (cache replay / degraded-200 / >30s re-host timeout).
- Playwright screenshots hang — use a11y snapshots / `browser_run_code_unsafe` asserts.
- Merging to main still deletes 143 inherited `.planning/` files — recipe in the previous
  handoffs, unchanged.
- `lane/maven-offer` will conflict on `hero-showcase.tsx` when it merges.
