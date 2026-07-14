# Handoff — per-persona generation, and the two rules that got it there

**Written:** 2026-07-14 (session 3) · **Worktree:** `~/virtuna-explore-b` (`explore-b-sync`, clean, synced)
**Base:** `main` @ `2b9b6b78` · **Gates on it:** `tsc` 0 · **3702 passed / 0 failed**
**Shipped this session:** #298 · #299 · #302 · #303 (all merged)

> **This is the START-HERE doc.** The older `docs/HANDOFF-2026-07-13-audience-next.md` is still the
> deep reference for the /audience subsystem (§3 facts F1–F10, §6 traps, P4). Read this first, then
> that one only if you need the subsystem detail.

---

## 0 · The two rules. Both are load-bearing. Neither is optional.

**RULE 1 — NOTHING IS DONE UNTIL IT HAS BEEN RUN ONCE AGAINST REAL DATA.**
Not a mocked test. A real call, a real row, eyes on the output.

**Six features in this subsystem have now been run against reality for the first time. Six were
broken.** `tsc`, `eslint` and 3,600+ unit tests caught **none** of them. One live run caught **each**,
usually in under two minutes. The shape is always the same: *the one input that makes the feature the
feature, dropped in silence, with every test green.*

**RULE 2 — MEASURE YOUR INSTRUMENT BEFORE YOU TRUST IT.**
A result from one blunt metric is not a finding — in **either** direction. This has now cost a wrong
conclusion three times:

- a 3-concept control arm put a noise floor **6× too high** and nearly killed a real feature;
- an embedding metric said "no effect" when it was simply **topic-blind**;
- and this session's headline number (60%) would have been **meaningless without a control arm** —
  it only means something because hooks-written-for-nobody scored **13.3%**.

**And always DUMP THE PROMPT/PAYLOAD to prove your input arrived before you conclude anything about
the output.**

---

## 1 · What is now TRUE (all measured live, none of it read from code)

| | |
|---|---|
| The audience **DOES** steer the RANKING + the SIM verdicts | 8/10 Reads show persona divergence, 80% reproducible, vs a 0.2 flips/Read noise floor |
| The audience **DOES NOT** steer generation **as prompt context** | 20 runs, two independent methods, both at chance (embeddings p=0.43; a blind judge *told who the audience is* scored **45%**) |
| The audience **DOES** steer generation **as an ASSIGNMENT** ✅ NEW | blind judge IDs the target persona **60%** vs a **13.3% control** (chance 20%) |

**⛔ DEAD END, DO NOT RETRY: "just put the persona repaints into the generation prompt."** Built,
measured, reverted. ~900 tokens/run for zero effect. The prompt was DUMPED — all 10 personas were
present. **The writer ignores ambient audience text.** The calibrated prompt already carried the
creator's voice + niche (2,267 chars vs General's 307) and *still* produced indistinguishable hooks.

**✅ WHAT WORKS — and why it is different:** the persona became a **structural assignment carried by
the output contract**. Hook N is written for person N, and the model must echo `targetArchetype` back.
Differentiation is guaranteed by the schema instead of prayed for. **The contract is the mechanism —
not the text.** Do not re-read this as "so more prompt text works after all."

---

## 2 · The two rules the codebase got wrong (fixed — don't re-learn these)

### 🔴 A new card prop has **FIVE** touchpoints, not four

```
schema → runner → ROUTE SSE EMIT → stream parse → toBlocks
                  ^^^^^^^^^^^^^^ the one everybody forgets
```

#287's four-touchpoint rule omits the route's hand-built `send("content", …)` map. That is exactly
where `grounded` was being dropped (#298) — so #287's own no-source note could only ever appear
*after a reload*, never on the live stream, which is the only path a user watches. The line directly
above it fixes the identical bug for `proof`, **with a comment saying so.**

### 🔴 The route test layer had been DEAD for months (fixed in #298)

Every `/api/tools/*` route opens with `maybeMockSkillRun()` → `await cookies()`, which **throws**
outside a Next request scope, and no test file anywhere mocked `next/headers`. The throw fired before
any route body ran.

| | before | after |
|---|---|---|
| `src/app/api/tools` | 15 passed / **73 failed** | 88 / **0** |
| full suite | 3548 / **72 failed** | 3702 / **0** |

That included **the 7/8 explore failures the old handoff logged as unexplained** — 7 failures, 7
`cookies` errors, one line. And the blind spot was double: **the old gate command ran `src/lib/tools`
but NOT `src/app/api/tools`.** The route layer was outside the gate *and* untested. Gate now fixed.

---

## 3 · The bug that proves rule 1 (the 6th, and the sharpest)

The assignment list renders each person as `1. [lurker] …`, and my output contract said *"use the
exact bracketed slug"* — so the model returned:

```json
"targetArchetype": "[lurker]"
```

Brackets and all. The assignment map is keyed on the **bare** slug → every lookup missed → **every
card silently lost its target line.**

The writer had complied **perfectly** — its own reasoning cited *"the lurker"*, *"the loyalist"*,
*"the niche buyer"* by name. **The BINDING broke, not the generation.** `tsc`, `eslint` and 3,600
tests were green and the feature was **100% dead on the only path a user watches.**

**⚠️ THE GENERALISABLE LESSON: an exact-match lookup on free-form model output is a silent-failure
machine.** Brackets, quotes, case and spacing must **never** decide whether a value binds
(`normalizeTargetArchetype` absorbs them). What must **still** fail loudly is a value we never
assigned — a writer that ignores its brief yields a card with **no target line**, never a generic
hook wearing a personalised label.

---

## 4 · The map — what exists now

| file | what it is |
|---|---|
| `src/lib/audience/select-hook-targets.ts` | **The deterministic cast.** Top-N by share, forced to span the 4 `persona_weights` slot types. **No LLM** — "your five biggest groups" is a product claim, so it must be auditable. Already generic; reusable by ideas/script as-is. |
| `src/lib/audience/archetype-names.ts` | **SSOT for what the 10 personas are CALLED.** Quiet Watchers · Savers · Commenters · Sharers · Tough Crowd · Purposeful Viewers · Deep Fans · Scouts · Regulars · Passers-by. Typed `Record<Archetype,string>` → a new engine archetype without a name is a **type error**. |
| `src/lib/tools/runners/hooks-runner.ts` | `buildTargetAssignments` (the prompt block) · `targetedOutputContract` · `normalizeTargetArchetype` · `bindHookTarget` (the honesty gate). |
| `scripts/measure-hook-targeting.ts` | **The blind judge + the control arm.** Re-run it before trusting any change here. |
| `scripts/measure-divergence.ts` | The Read-divergence harness (session 2). |

**Three rules `select-hook-targets` encodes, each of which is a bug if you break it:**
1. **Source = `audience.personas`**, NOT `getPersonaRoster()` (which prefers `signature.personas`).
   `buildAudienceRepaint` projects the former — the latter would aim a hook at a persona **the SIM
   never repaints**.
2. **Excludes unbindable archetypes** (#282 — their repaint reaches the model *never*).
3. **Cycles rather than shrinking the shelf** — authored audiences carry 3–4 personas, not 10.

**F7 STILL HOLDS AND MUST:** a persona's `label` **never** reaches the model. The engine binds on
`archetype`; the writer is briefed with `repaint`. Verified by prompt dump on a live run.

---

## 5 · ▶ NEXT — in the order I'd do it

### 1. Fan the assignment out to `ideas` and `script`  ← START HERE

Same runner shape, same `overrides` seam, same 5-touchpoint prop path, and `select-hook-targets.ts`
is **already generic**. Mechanically this is mostly a copy of what #299 did to hooks.

> ⚠️ **RE-RUN THE MEASUREMENT PER SKILL. A SCRIPT IS NOT A HOOK.** The effect transferring is a
> **hypothesis, not a given.** A hook is one atomic line where a persona's whole psychology can show
> up in eight words; a script is 5 beats where per-persona differences may wash out — or where
> targeting a 5% segment may make the script *worse for everyone*. `scripts/measure-hook-targeting.ts`
> generalises with a one-line change of pipeline. **If a blind judge can't tell them apart, say so and
> don't ship it.** That is the finding, not a failure.

### 2. Close the two holes in the 60% result

- **n = 6 topics, all on-niche** (the feature's best case) — and **one scored 1/5, BELOW chance.** The
  effect is large but **not uniform.** Run the harness on **off-niche asks** and on a **second
  calibrated audience** before any product copy claims anything.
- **The judge is the same model family as the writer.** The control rules out generic
  phantom-matching; it does **not** rule out same-model self-preference. **A different-family judge is
  the cheapest remaining hole.**

### 3. Watch the ranking interaction (unmeasured, and it might matter)

Ranking is still global stop-count. A hook aimed at a 5% segment will tend to rank last — so rank
partially recovers share order. Live, that read fine (the misses were genuinely weak hooks), but
**nobody has measured whether targeting made the top-ranked hook WORSE.** Worth one experiment:
targeted vs untargeted, compare rank-1 band.

### 4. Everything else

- **P4 ("dissolve the account tab") — DO NOT start.** Dead as specced; needs an owner decision first
  (see the 07-13 handoff §4).
- 🔴 **OWNER-ONLY, older than all of this: prod crons are DEAD** (missing `SUPABASE_SERVICE_ROLE_KEY`
  in Vercel). Blocks billing. Not a code task.
- **Grounding flag is still OFF in prod.** #298 fixed a prop it needs (`grounded`), so its no-source
  note now works on the live stream — but **that path has still never been run for real with the flag
  ON.** Per rule 1, assume it is broken until it isn't.

---

## 6 · Gates (CORRECTED — the old one had a hole)

```bash
npx tsc --noEmit                                   # 0
npx eslint <changed files>                         # 0 errors

# ⚠️ `src/app/api/tools` IS NOW IN THE GATE. The route layer is where props go to die.
node ./node_modules/vitest/vitest.mjs run src/lib/audience src/components/audience \
  src/app/api/audiences src/app/api/tools src/lib/engine/flash src/lib/tools

# Touching anything shared (src/test/setup.ts, blocks.ts)? Run EVERYTHING:
node ./node_modules/vitest/vitest.mjs run          # 3702 passed / 0 failed @ 2b9b6b78
```

- **NEVER `npm test` / `npx vitest`** — a shim prints fake results.
- **Run suites SERIALLY** — two concurrent scopes produce phantom call-count failures.
- **ALWAYS confirm a failure against the base commit (`git stash`) before chasing it.** That habit
  saved this session twice.
- **Mutation-check any test you write for a silent-drop bug:** revert the fix and confirm *exactly*
  that test goes red. A test that can't fail isn't a test.

## 7 · Dev server + auth

```bash
NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3007
```
Logged in as `e2e-test@virtuna.local` / `e2e-test-password-2026`.

- **Audience is pinned PER THREAD** (`threads.active_audience_id`) — not passed in the request body.
  To run a calibrated hooks call, pick the audience in the composer. Drive it from the **browser**;
  the tools routes need the session cookie.
- Calibrated audience **"Zach King"** = `6b1114e6-bae9-462e-9f06-a2964b17ee67` — the ONLY row with
  `calibration.source='scrape'`. ⚠️ `calibration` is a **TOP-LEVEL column**, not a key inside
  `signature`.
- **Fixtures are DELIBERATE — keep them:** 2 connected accounts (zachking tiktok + instagram, the only
  multi-account fixture) and the persisted Reads that feed the divergence panel.
- **Screenshots hang** (ambient animations never settle) — inject CSS to kill animations, or read the
  DOM (`browser_evaluate`), which is what I did all session and it was faster anyway.

## 8 · Housekeeping left on this worktree (cosmetic, not blocking)

- **~15 stray PNGs in the repo root** (`amb-*.png`, etc.) from earlier sessions. Gitignored, so they
  have never been committed — but the project rule is *never save working files to root*. Safe to
  delete; left them because deleting files wants a human nod.
- **~100 stale local branches.** Pre-existing debt, not from this session. The 4 branches this session
  created were merged and their remotes auto-deleted.
