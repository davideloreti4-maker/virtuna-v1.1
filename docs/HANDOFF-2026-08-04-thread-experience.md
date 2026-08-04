# Handoff — thread experience + the model stack (2026-08-04)

**Goal:** one thread that feels smooth, clean and finished — a creator talks, the right thing happens,
nothing on screen lies to them, and the whole thing runs on the cheap model wherever the cheap model is
actually good enough.

**Base:** `origin/main` @ **`6d48efab`** (PR #424 merged 2026-08-04, deployed). Read refs with
`git rev-parse`, never `git log --oneline` — it elides merge commits in this repo.
**Worktree:** `~/virtuna-slot-a` (a slot worktree; see `CLAUDE.md`).

**Open PRs from this session:**

| PR | branch | what | state |
|---|---|---|---|
| **#426** | `lane/qwen-flash-swap` @ `7dcec9ac` | reasoning model plus → flash, Apollo held back | rebased, re-measured, **needs a merge decision** |
| **#425** | `docs/thread-experience-handoff` | this handoff + closing the dispatch lane | docs only |
| #376 | — | Cursor Cloud dev env | pre-existing, unrelated |

**Predecessor:** `docs/HANDOFF-2026-08-04-chat-agent-dispatch.md` — ✅ CLOSED (merged as #424). Read it
for mechanisms and traps, not for work.

⚠️ **Merging to `main` IS deploying.** Prod builds ~3s later; there are no preview URLs. Gate before
the push, not after — and a green Vercel check on a PR is **not** a build (`ignoreCommand` skips and
posts success). Run `tsc` yourself; vitest does not typecheck.

---

## 0. Where things stand

**Agent→skill routing works** and did not before 2026-08-04 — broken since #316 (2026-07-17). Five
defects fixed and measured (see the predecessor). A creator can now ask for ideas / hooks / a script in
chat and the real pipeline runs; it keeps working on the *second* and *third* ask in the same thread;
tapping a follow-up chip runs what the chip promises; and the model can discuss the cards it made.

**Two things are NOT done**, and they are the whole of §2:
1. chat reaches **a third of the product** (§1);
2. the platform still runs the expensive reasoning model — the swap is written and measured but
   **unmerged** (§1b).

---

## 1. THE MAP — what chat can actually reach

Twelve creator-facing skills.

| tier | skills | what happens when a creator asks in chat |
|---|---|---|
| **1 — the agent RUNS it** | `ideas` · `hooks` · `script` | pipeline runs inline, cards stream into the thread, credit gated + billed |
| **2 — the agent BROKERS it** | `remix` · `account-read` · `explore` · `read` · `test` | `request_input` surfaces a field or a confirm button; the **client** runs the skill on its own route on submit |
| **3 — no agent path at all** | `predict` · `profile` · `simulate` · `refine` | tap-only. Chat cannot start them |

**8 of 12 reachable through conversation, 3 of 12 actually driven by the agent.**

### Why tier 2 is not tier 1 — mostly NOT a capability limit

`explore-runner.ts`, `remix-runner.ts`, `predict-runner.ts`, `profile-runner.ts` and
`simulate-runner.ts` all exist as extractable modules in the exact shape `SKILL_TOOLS` wraps. Binding
one is a **registry entry**, not a build. The five split in two:

**Genuinely blocked — the model cannot fabricate the input (2):** `test` (needs a real video **file**
or a TikTok URL) · `remix` (needs a *specific external video link*; a model inventing one is the
failure mode).

**A policy choice, not a limit (3):** `account-read` (`kind:"none"` — needs nothing typed) · `explore`
("leave it blank to pull your niche") · `read` (a concept the model could extract like a `topic`).

### The policy has a real reason — do not casually undo it

The confirm tap is a **spending-consent gate on a different wallet**. Tier 1 spends *credits* (own
ledger, gated, billed). `account-read` / `explore` / `remix` hit **Apify scrapes**: rotating FREE
accounts on a **$5/month hard cap** (~$3.40 left, resets 2026-08-20), 25–126s each. An agent that can
*decide* to scrape can burn that cap with nobody tapping anything.

🔑 The promotion candidate is **`read`** — an audience SIM, not a scrape. **Verify it touches no Apify
path before moving it**; that assumption is unverified.

### Tier 3 is NOT dormant — checked, not assumed

`composer.tsx` calls all three routes: `simulate` is the shipped ＋door lane, `profile` is the
evidence-upload path (`handleProfileSubmit`), `predict` renders through `reaction-distribution-block.tsx`.
Live skills a creator can tap but cannot ask for. (`refine` is deliberately here — §3.)

---

## 1b. THE MODEL STACK — two models, one holdout (PR #426, unmerged)

The engine splits on **one capability line: audio.**

| constant | model | scope |
|---|---|---|
| `QWEN_OMNI_MODEL` | `qwen3.5-omni-flash` | **the sensor** — the ONLY audio-capable model. Wave 0 read + audience-bake watch. Audio is distilled once into text; everything downstream reasons over that. Already flash since 2026-06-06 |
| `QWEN_REASONING_MODEL` | `qwen3.7-plus` → **`qwen3.7-flash`** (#426) | **everything else, text AND video** (sighted, deaf). Generation, SIM scoring, the fold, chat, decode/adapt, audience synth |
| `QWEN_APOLLO_MODEL` | `qwen3.7-plus` — **HELD** | the score-mode judge. Scoped separately *precisely* so it can stay put |

Same generation, still sighted, still deaf → **no call site changes capability and the audio boundary
is exactly where it was.**

> 🔎 The omni flip (plus → flash, 2026-06-06) is already on `main` but is almost unfindable: it landed
> under the commit message **`test: changes`** (`ba02cd1b`). `git log -S'qwen3.5-omni-flash'` is the
> only way to see it. Its rationale survives only because someone wrote it into the code comment.

### ⚠️ Apollo on flash is BROKEN — the holdout is load-bearing

`scripts/apollo-cite-harness.ts`, same video, both models:

| | `qwen3.7-plus` | `qwen3.7-flash` |
|---|---|---|
| composite | **81** | **53** |
| §-cites | `§2.1 §2.2 §2.3 §2.5` | **none** |

Flash returned a valid-looking Apollo result with **zero framework citations** while tsc, ~5,080 tests
and the build were all green. Only the live harness saw it. **Never "simplify" the three constants
into two.** That is exactly what `QWEN_APOLLO_MODEL` is for.

### Re-measured 2026-08-04 after rebasing onto `6d48efab`

| check | result |
|---|---|
| Apollo §-cites, reasoning on flash | `[§2.1,§2.2,§2.3,§2.5]`, 0 danglers, 0 prose leaks, **composite 81** — identical to the plus baseline |
| fold output diversity (`fold-validate-r1.ts`, 8-segment video) | `avgCurveRange` **0.28** (floor 0.10, healthy 0.27–0.41), latency 13.7s vs 90s ceiling, clean parse, no diversity retry |
| **chat dispatch on flash** *(new coverage)* | shipped path **identical to plus** — target 3/3, both pinned chips 3/3, both no-dispatch controls 0/3 |

The dispatch probe is coverage the lane never had. #424 merged the same morning, and a cheaper
reasoning model is the most plausible way to silently undo it. It didn't. One difference in flash's
favour: the *prose-only* variant (the pre-#424 anchor) moved **0/3 → 3/3** — flash is less prone to
copying a thread's own poisoned "Five hooks are on screen." sentence. Controls held, so that is
robustness, not eagerness.

### Cost, and a rollback that is not symmetric

Roughly **10× cheaper**: `$0.03/$0.13` per M at ≤32K input vs plus's `$0.40/$1.60`. Flash is priced in
**context BANDS** ($0.10/$0.40 through 256K, $0.20/$0.80 through 1M) — `qwen/cost.ts` now models that;
a flat rate would have understated every video call.

⚠️ **`ENGINE_VERSION` bumps 3.21.0 → 3.22.0** because the prediction cache keys on it (without the bump
every plus-scored row keeps replaying). Rollback is env-only (`QWEN_REASONING_MODEL=qwen3.7-plus`) —
**but rolling the model back does NOT roll the version back**, so plus rows re-score once under 3.22.0.
Reverting costs a re-score.

### 🔑 Three different "flash"es in one mapping

```
SIM-1 Max   → QWEN_OMNI_MODEL      (qwen3.5-omni-FLASH — the audio sensor)
SIM-1 FLASH → QWEN_REASONING_MODEL (qwen3.7-FLASH — deaf, vision-capable)
```

The tier named Flash does NOT get the model named omni-flash; the mapping is inverted, and the
reasoning model is now itself called flash. **Read the CONSTANT, never the word.**

---

## 2. The work, ranked

### P0 — Decide #426 (the flash swap)
Everything is measured: rebased, tsc clean, suite green, Apollo re-verified, dispatch unchanged, fold
diversity healthy. It is a **~10× cost reduction on every text and video call**, the single biggest
lever in this document. What is left is a merge decision, not engineering — and the one thing to weigh
is the asymmetric rollback above.

### P1 — Drive a real anonymous `/go` session through the chat route
The **only** claim in the predecessor measured offline-only, and it guards the free door into the paid
engine. `FREE_SKILL_TOOLS` is empty, so an anonymous visitor binds NO generators and the agent must
refuse honestly rather than writing the pack out in prose. Offline: 0/6 → 6/6, with a residual **1/6
leak** that is the ceiling of a prompt-level guard.

Doubly worth doing now: §6b of the predecessor puts real card text into the replayed transcript, and
the guard keeping it away from an unbound session is a **unit test, not a live observation**.

Done = a real unauthenticated session through `/api/tools/chat`, showing the refusal and **no
hook/idea/script lines** in the body.

### P2 — Close the coverage gap: `read` → tier 1, `predict`/`profile` → tier 2
Takes conversation from 8/12 to 10/12 without touching the scrape budget.
- `read` — a `SkillTool` registry entry + an adapter over its runner. Check the Apify question first.
- `predict` / `profile` — `SKILL_CAPABILITIES` entries so `request_input` can surface their field
  (`predict` → `kind:"text"`, `profile` → `kind:"upload"`).

Add either way: a drift test asserting every `ChatTurnKind` is bound, brokered, or on an explicit
"no agent path" allowlist — so the next skill added cannot silently be unreachable.

### P3 — Look at the thread in a browser
Every claim about chips, capsules and loading states is measured at the wire or in the loop. **Nobody
has watched a creator tap one.** ⚠️ Playwright screenshots hang on this app (ambient animations never
settle) — use raw Playwright with `animations:'disabled'` + `caret:'hide'` + a tight `clip`, or verify
via `getComputedStyle`/`getBoundingClientRect`. Worth seeing: the dispatch capsule labelling itself
~22s before cards land; the chip row under a completed turn; a mid-stream credit wall.

### P4 — Decide whether a pinned chip should show its price
A chip now reliably **spends a credit** where it used to degrade into free prose. Correct, but it was
previously free-by-accident, so the affordance may deserve a beat of UI. Product call.

### P5 — The four blind scrape waits
25–126s each with artifacts already in hand. Calibration is the cheapest fix: it HAS real stages, it
just sends them as `status`. See `docs/HANDOFF-2026-08-01-thread-loading-premium.md` §7–§10.

---

## 3. Decided — do not re-litigate

- **`refine` is NOT bound to the agent loop.** It is CARD-scoped (needs `cardRef` + the card's content
  as `anchor`, returns ONE card) and already has a live door — the composer's `detectRefineIntent`
  fires on "make hook 2 punchier". A turn-level chip has no card in hand. "Punch them up" wants a
  fresh scored hooks run = `generate_hooks`, already bound.
- **Continuation chips carry intent as DATA, not as a better sentence.** Rewording was measured: a
  continuation clause reached 1/3 and destabilised sibling chips.
- **`mode` stays `"chat"` on the agent path**; only `modeLabel` moves. `mode` selects `MODE_ROLES`, so
  changing it changes the grounding content.
- **Apollo stays on `qwen3.7-plus`** until something changes its citation behaviour. See §1b.

---

## 4. How to measure anything here

```bash
# CHAT DISPATCH — replays a REAL thread through the real loop. 5 asks × 3 seeds × 3 variants.
# COSTS NOTHING: `billing` is omitted, so billable skills FAIL CLOSED and the paid engine never runs.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/probe-chat-dispatch.ts
PROBE_DRY=true …                        # anchor only, no model calls
PROBE_THREAD=<id> PROBE_ASK="<ask>" …   # a different thread / cut point

# APOLLO §-CITES — the real production Apollo path, not the smoke. Needs a video:
#   default "$HOME/Downloads/TikTok Video Downloader.mp4"
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/apollo-cite-harness.ts
# → HARNESS_RESULT cites=[…] danglers=[] prose_leaks=0 composite=NN

# FOLD DIVERSITY — the risk that retired qwen3.6-flash in June
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/fold-validate-r1.ts

# LIVE CHAT — mints a session, drives the SSE route. SPENDS REAL CREDITS (one run per turn).
npm run dev -- --port 3005
node --env-file=.env.local scripts/live-chat-turn.mjs                                 # the §4 sequence
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<ask>"          # one typed turn
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<prompt>" hooks # …as a CHIP
```

🔑 **Replay the conversation that actually failed — never a synthetic one.** A hand-built transcript
carrying the same poisoned sentence dispatched **3/3 and proved nothing**; the real thread reproduced
the bug on the first run.

🔑 **Keep the no-dispatch controls, and READ WHAT THEY SAY.** A change that only dispatches MORE is not
a fix — and §6b of the predecessor, a whole defect, was hiding inside a control that was passing.

🔑 **A model swap needs a LIVE harness.** Apollo's citation collapse was invisible to tsc, 5,080 tests
and the build. If you change a model, run the harness for every capability that model carries.

Live auth: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` + `Authorization:
Bearer <ANON>` → cookie `sb-<ref>-auth-token.0 = 'base64-' + base64url(JSON(session))`, chunked at
3180. Creds `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in `.env.local` — a **real prod account**. The
thread a turn lands in is the `maven_active_thread` cookie; `__new__` forces a fresh one.

⚠️ `curl` is not installed — use `node -e` with `fetch`.
⚠️ `next dev` buffers stdout when not a TTY: the log stays 0 bytes while the server serves fine. Probe
it with a request; do not tail the log to decide whether it is up.
⚠️ Model IDs are `process.env`-overridable and Vercel env vars here are write-only `sensitive` —
unreadable even in the dashboard. **The code default is not proof of what prod runs.** `.env.local` has
no `QWEN_*` overrides, so dev follows the code; to settle prod, probe the running app.

---

## 5. Gates, and the traps in them

```bash
node node_modules/typescript/bin/tsc --noEmit     # vitest does NOT typecheck — run separately
node node_modules/vitest/vitest.mjs run > /tmp/suite.log 2>&1; echo "EXIT=$?"
```

Baseline at `6d48efab`: **tsc 0 errors · 460 files / 5106 tests / 0 failures · 42 skipped.**
On #426: **5111 passed, 0 real failures.**

- ⚠️ **`EXIT=1` with zero failures** is known drift in the slot worktrees. Judge on `Tests N failed`.
- ⚠️ **3 "Errors"** are pre-existing unhandled rejections from `composer.tsx:2019` in `composer.test.tsx`.
- ⚠️ **Never pipe the suite through `| tail -n`** — it discards the `FAIL` lines you need, and the pipe
  makes `$?` the *tail's* status, so `EXIT=0` means nothing. This cost a full re-run.
- 🔑 **`composer-*.test.tsx` fails on a COLD vitest cache and passes on re-run** — `Error: Test timed
  out in 5000ms` at `await import('../composer')`, a module-TRANSFORM cost, not behaviour. **Bisecting
  it with `git stash` LIES**: stashing rewrites the files whose transform cache is the variable you are
  measuring. It produced a clean, false "my change caused it", twice. Settle it by stashing back to the
  committed HEAD and running the file **twice** — at HEAD, run 1 failed and run 2 passed with none of
  the new code present. It recurred on #426 and was confirmed a flake the same way.
- ⚠️ `git stash push -u` sweeps **untracked** files. This worktree is shared with another session whose
  `zz-*` files are untracked. Stash by explicit path, without `-u`. Stage by name; never `git add -A`.

---

## 6. Files you will touch

| file | what it owns |
|---|---|
| `src/lib/tools/skill-dispatch.ts` | `SKILL_TOOLS` — the registry. **Tier 1 is one entry here.** |
| `src/lib/tools/skill-capabilities.ts` | `SKILL_CAPABILITIES` — the `request_input` actions (tier 2) |
| `src/lib/tools/chat-agent-loop.ts` | the streaming loop: tool binding, the directive, `forceSkill`, `replayPriorTurn`, the billing seam |
| `src/lib/threads/chat-prior-turns.ts` | the anchor — past runs + their card lines |
| `src/lib/tools/chat-followups.ts` | the chips and their declared `skill` |
| `src/app/api/tools/chat/route.ts` | the SSE route: binds skills per user, forwards `forceSkill`, persists |
| `src/components/thread/thread-turn.tsx` | THE turn renderer — one component, every skill, live or reloaded |
| `src/lib/engine/qwen/client.ts` | the three model constants + why each sits where it does |
| `src/lib/engine/qwen/cost.ts` | per-model pricing, incl. flash's **context bands** |
| `docs/MODEL-POLICY.md` | the model SSOT — rewritten on #426 |

---

## 7. Ground rules that keep paying off

1. **Structure beats prompt text.** Every fix that stuck was structural; every prompt attempt
   plateaued and destabilised something else.
2. **Measure the thing that actually failed** — replay the real thread, not a synthetic one.
3. **A change that only dispatches MORE is not a fix.** Keep controls, and preserve them by
   construction rather than by the model's good judgement.
4. **Read what your controls SAY, not just whether they passed.**
5. **A green suite is not a verified feature.** 5,000 tests were green through a routing bug that meant
   the product's main door did nothing — and through Apollo losing every framework citation. Both
   needed a live harness.
6. **Scope the exception rather than abandon the change.** #426 ships a platform-wide cost cut because
   ONE constant was scoped separately for the one component that regressed. A blanket swap would have
   been reverted; a scoped one ships.
