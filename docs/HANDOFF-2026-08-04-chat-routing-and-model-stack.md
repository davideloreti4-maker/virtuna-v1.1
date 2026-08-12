# Handoff — chat routing, the thread's memory, and the model stack (2026-08-04, evening)

**Base:** `origin/main` @ **`13154acb`** (PR #430, merged + deployed 2026-08-04 15:29 +0200).
Read refs with `git rev-parse` — `git log` elides merge commits in this repo.
**Worktree:** `~/virtuna-slot-a` (slot worktree; see `CLAUDE.md`).

Supersedes the P0/P1/P2 sections of `docs/HANDOFF-2026-08-04-thread-experience.md`. Read that one for
the map and the mechanisms; read THIS one for what is true now.

⚠️ **Merging to `main` IS deploying.** But **prod builds take ~4 MINUTES, not "~3 seconds"** — the
older handoff's number is wrong and it cost a false alarm today (see §5). Gate before the push.

---

## 0. What shipped today

| PR | what | state |
|---|---|---|
| **#426** | reasoning model `qwen3.7-plus` → `qwen3.7-flash`, Apollo **and** CALIBRATE held on plus | merged, live |
| **#425** | the thread-experience handoff | merged |
| **#427** | the thread REMEMBERS every skill · `read` bound tier-1 · reachability drift test | merged, live |
| **#428** | ⚠️ flash leaked the paid pack to anonymous visitors — that path held on plus | merged, live |
| **#430** | ⚠️ stop offering `predict`/`profile` — the product has them switched OFF | merged, live |

`#376` (Cursor Cloud dev env) is the only open PR and is unrelated.

---

## 1. THE MODEL STACK — five constants, three held on plus

| constant | model | scope |
|---|---|---|
| `QWEN_OMNI_MODEL` | `qwen3.5-omni-flash` | the **sensor** — the only audio-capable model |
| `QWEN_REASONING_MODEL` | **`qwen3.7-flash`** | everything else, text AND video. The ~10× cost win |
| `QWEN_APOLLO_MODEL` | `qwen3.7-plus` | score-mode judge — flash scored composite 53 vs 81, **zero** §-cites |
| `QWEN_CALIBRATE_MODEL` | `qwen3.7-plus` | audience synth — flash **0/7**, shares never summed to 1 |
| `QWEN_UNBOUND_CHAT_MODEL` | `qwen3.7-plus` | the anonymous chat turn — flash **leaked the pack 5/6** |

🔑 **NEVER collapse these into fewer constants.** Three separate live harnesses, three separate
failures, none visible to tsc, ~5,200 tests, or the build. Scoping the exception is what lets the
platform-wide cost cut ship at all.

### The lesson that has now been paid for three times

Each holdout was found by a harness the *previous* swap did not think to run:

- **Apollo** — flash returned a valid-looking result with no framework citations.
- **CALIBRATE** — flash's prose was *fine* (10 distinct personas); it failed **arithmetic**. And it
  is an OUTAGE, not a quality dip: `defaultSynthesize` has no retry, so every bake returns
  `{error:"scrape_failed"}` **after** the Apify scrape is paid for, on the onboarding path.
- **Unbound chat** — #426 measured chat dispatch on flash and it *was* identical to plus… on the
  **signed-in** path, where the generators are bound and the job is to CALL one. The anonymous path
  is a **different job**: refuse, and hold under pressure.

> 🔑 **When you swap a model, enumerate the JOBS a path performs, not the routes that call it.**

---

## 2. THE ROUTING MAP — 8 of 12, and why not more

| tier | skills | what happens in chat |
|---|---|---|
| **1 — the agent RUNS it** | `ideas` · `hooks` · `script` · **`read`** | pipeline runs inline, cards stream in, gated + billed |
| **2 — the agent BROKERS it** | `remix` · `account` · `explore` · `test` | `request_input` surfaces a field; the client runs the skill on its own route |
| **OFF in the product** | `profile` · `simulate` · `predict` | `enabled: HORIZONTAL_ENABLED`, and that flag is **false** |
| **No agent path (decided)** | `refine` | CARD-scoped; the composer's `detectRefineIntent` is its live door |

### ⚠️ Read this before you "improve coverage"

**`HORIZONTAL_ENABLED = false`** (`src/lib/flags/horizontal.ts`). In the composer `SKILLS` registry
`profile`/`simulate`/`predict` carry `enabled: HORIZONTAL_ENABLED`, and that one flag closes the pill
menu, the `/` slash menu and Enter-to-select **together** (owner call 2026-07-13 — the product
commits to the creator vertical for MVP). Routes, runners, blocks and renderers all still exist.

I brokered `predict`/`profile` into chat earlier today and it was **wrong**: it made chat the one
door still open to a surface the rest of the app deliberately denies. Fixed in #430.

> 🔑 **"Which skills are active" cannot be answered from routes, block types, or `ChatTurnKind`** —
> all three list far more than the product ships. `SKILLS` + `enabled` + `isSkillVisible` is the only
> honest source. Everything else overstates.

`SKILL_REQUESTABLE_ACTIONS` now filters by that flag and drives the `request_input` enum, the
directive lines, and the loop's arg boundary. `SKILL_INPUT_ACTIONS` deliberately keeps the FULL set —
a persisted `input-request` block must keep validating and rendering regardless. Flip the flag and
`predict`/`profile` return automatically, with no second list to remember.

### Why `read` could be promoted and its neighbours could not

`account` / `explore` / `remix` hit **Apify** — rotating FREE accounts on a **$5/month hard cap** —
so an agent that can *decide* to scrape can exhaust it with nobody tapping anything. They stay behind
a confirm tap; that is a spending-consent decision, and `chat-reachability.test.ts` asserts it.

**`read` touches no Apify path — verified, not assumed** (this assumption was the whole blocker).
`runTwoAudienceRead` awaits exactly one thing: `runFlashTextMode`. The only Apify edge anywhere in
its import graph is `resolve-tier → socials-calibration`, whose `domain-pack` import is `import type`
(erased at compile) — and both modules were extracted as leaves precisely to keep
`runPredictionPipeline → apify-client` out. `resolveTier()` is a pure sync read of a static descriptor.

> 🔑 **Import reachability ≠ call reachability.** Trace what a function `await`s, not what the module
> graph touches. A `import type` edge is erased; a dev-only mock is not the product.

`read` keys off **`draft`**, never `topic` — a Read of the model's own paraphrase is a Read of the
wrong thing. It keeps its `request_input` field too, and the two doors do not compete: the tool runs
when the model HAS the exact text, the field collects it when it does not.

---

## 3. THE THREAD'S MEMORY — the owner-reported bug, and what it actually was

**Reported:** "the chat agent and thread doesn't seem to keep memory and context of the history."

**Measured:** pure conversation was never broken — 3/3 live recall, including cross-referencing the
stored profile. The real hole was narrower and worse: `openChatPriorTurns` kept only `markdown` turns
and the **three generator card types**. Every other skill writes into the *same* open thread and none
of them is either.

**107 of 982 persisted blocks (11%) were invisible to the agent**, precisely the non-generator skills
— `multi-audience-read`, `outlier-grid`, `profile-read`, `video-test-card`, `remix-card`,
`reaction-distribution`, `prediction-gauge`, `account-read`, `brought-card`.

Worse than a hole: **a skill run from the PILL persists only its card, with no text row after it**, so
those runs produced **no turn at all**. Tap Test, ask "what should I fix first?", and the co-pilot has
never heard of it.

**Fix:** every skill block now carries a one-line **context record** into the anchor, as a **user-role**
note. Not a tool call — the agent did not call them and for most has no tool to call, so naming one
would advertise a door that does not exist. Not an assistant line either: an assistant line is a
template the model copies, and this thread's whole defect history is the model copying a sentence
instead of calling a tool ("Five hooks are on screen.").

Verified live: after an agent-dispatched Read, "which audience was it and what was the verdict?"
returns *Fitness Creators / Mixed / 4-10 stop* — facts that exist only in the previously-invisible card.

`NON_RECORD_BLOCKS` states why each remaining type is excluded, so the drift test can assert the set
is **closed** rather than trusting "everything else".

---

## 4. The guard that is NOT the fix (and why it stays)

`createArtefactGuard` (chat-agent-loop.ts) withholds a quoted span until it closes and replaces a
hook-length one with a marker — withholding, not post-filtering, because a streamed token cannot be
recalled. The guarded text is what gets **persisted**, so a redaction cannot reappear on reload or
become precedent in the next turn's replayed transcript.

⚠️ **It is not sufficient alone and must not be treated as the fix.** Flash walked straight past it by
emitting **unquoted** numbered lists. The model holdout (§1) is the actual fix; this is defence in depth.

---

## 5. Traps that cost time TODAY

1. **Prod builds take ~4 minutes, not ~3 seconds.** For 13 minutes after the #426 merge there was no
   production row anywhere and I confidently reported "the merge did not deploy". It was mid-build.
2. **GitHub's `repos/.../deployments` API LAGS Vercel and is not the source of truth.** It still
   listed the old sha while a production build for the new one was already READY. Read Vercel's own
   `list_deployments` / project `latestDeployment`.
3. **`/api/tools/chat` 401s a genuinely unauthenticated request.** The `/go` visitor is a Supabase
   **anonymous** user (`is_anonymous` JWT claim — what `isSealedVisitor` reads). "Drive an
   unauthenticated session" proves nothing; you must mint an anonymous session.
4. **The `composer-*.test.tsx` 5000ms timeouts are PRE-EXISTING.** They failed on re-run too, so they
   are not simply a cold cache. Settled by running them at pristine `origin/main` in a throwaway
   worktree with symlinked `node_modules` — identical failures, none of my code present. Do that
   instead of `git stash` bisection, which lies.
5. **The repo auto-pushes.** `.githooks/post-commit` pushes after every commit — I told the owner I
   had not pushed, and I had.
6. **A drift test can encode the defect.** Mine asserted `predict`/`profile` were correctly reachable.
   A guard that ratifies the bug is worse than no guard.

---

## 6. How to measure anything here

```bash
# CHAT DISPATCH — replays a REAL thread through the real loop. FREE (billing omitted ⇒ fail closed).
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/probe-chat-dispatch.ts
PROBE_DRY=true …                        # anchor only, no model calls

# THE FREE DOOR — a REAL anonymous visitor. FREE (no generator bound ⇒ no paid pipeline).
npm run dev -- --port 3005
node --env-file=.env.local scripts/live-chat-anon.mjs          # 6 asks; PASS = 6/6 refused, 0 leaked
FULL=1 node … scripts/live-chat-anon.mjs one "<ask>"           # full body, to judge a leak flag

# DOES THE THREAD REMEMBER — 5 turns, recall assertions. FREE (conversational only).
node --env-file=.env.local scripts/live-chat-memory.mjs

# WHAT THE AGENT SEES OF A THREAD — runs the real anchor over real rows. FREE.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/probe-thread-anchor.ts

# APOLLO §-CITES / FOLD / CALIBRATE — the model harnesses. Needed for ANY model change.
node … scripts/apollo-cite-harness.ts · scripts/fold-validate-r1.ts · scripts/calibrate-synth-harness.ts

# LIVE SIGNED-IN — SPENDS REAL CREDITS.
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<ask>" [chipSkill]
```

⚠️ `live-chat-turn.mjs`'s `RESULT: PASS/FAIL` is **generator-shaped** (`dispatched && cards>0`). A
`read` turn emits `multi-audience-read`, which does not end in `-card`, and a conversational turn
emits nothing — both print FAIL while working correctly. Read the frames, not the verdict.

**Gates:**
```bash
node node_modules/typescript/bin/tsc --noEmit          # vitest does NOT typecheck
node node_modules/vitest/vitest.mjs run > /tmp/s.log 2>&1; echo "EXIT=$?"
```
Baseline at `13154acb`: **tsc 0 · 5219 passed · 0 failures · 42 skipped.** `EXIT=1` with zero
failures is known slot-worktree drift; 3 "Errors" are pre-existing `composer.tsx` unhandled
rejections. **Never pipe the suite through `| tail`** — it eats FAIL lines and `$?` becomes the pipe's.

---

## 7. The work, ranked

### P1 — Watch a creator use it, signed in, in a browser
Everything today was verified at the wire or in the loop. **Nobody has watched a chip get tapped**
since any of it landed. ⚠️ Playwright screenshots hang on this app (ambient animations never settle)
— use raw Playwright with `animations:'disabled'` + `caret:'hide'` + a tight `clip`, or verify via
`getComputedStyle`/`getBoundingClientRect`. Worth seeing: the dispatch capsule labelling itself
~22s before cards land; the chip row under a completed turn; a Read turn's new chips; a mid-stream
credit wall.

### P2 — The chat FORMATTING decision (owner's call, deliberately not made)
The owner asked for chat output "cleaner to read, like standard Qwen output". Half of that was a
bug and is fixed: the chat turn had **no reading measure and no leading**, so answers ran the full
desktop width (`markdown-block.tsx` now caps at 68ch, matching `reading-chat.tsx`). `.md` already
styles headings, lists, bold, blockquotes and tables correctly.

**The other half is a deliberate product stance, not a bug.** `KC_CHAT_SLICE` forbids structure in
so many words — *"NOT a list of considerations, NOT a 5-point breakdown"*, *"the deliverable is the
answer, not a framework for the answer"*, *"direct opinion over enumerated options"* (owner-curated
2026-06-17, D-10). Qwen's output looks richer because it has no such rule.

⚠️ It lives in a **generated** file: edit `.planning/corpus/*.md`, then `npx tsx scripts/regen-kc.ts`.
`compiled.ts` carries a **byte-stability contract** for Qwen's input cache — no interpolation, no
timestamps. A regen changes the cache prefix.

Suggested narrow amendment if the owner wants it: allow structure when an answer genuinely HAS parts
(bold the thing that matters, a short list, quote a line) while keeping the anti-framework stance —
rather than reopening "a menu of considerations".

### P3 — Re-try flash on the unbound chat path
`QWEN_UNBOUND_CHAT_MODEL` is a **holdout, not a verdict**. Rollback FORWARD only behind a fresh
`live-chat-anon.mjs` run showing 6/6 refused · 0 leaked.

### P4 — The four blind scrape waits
25–126s each with artifacts already in hand. Calibration is the cheapest fix: it HAS real stages, it
just sends them as `status`. See `docs/HANDOFF-2026-08-01-thread-loading-premium.md` §7–§10.

### P5 — Should a pinned chip show its price?
A chip now reliably spends a credit where it used to degrade into free prose. Correct, but it was
previously free-by-accident. Product call. Same question now applies to `read` reached by conversation.

---

## 8. Decided — do not re-litigate

- **`refine` is NOT bound.** CARD-scoped (needs `cardRef` + the card's content as `anchor`, returns
  ONE card); the composer's `detectRefineIntent` is its live door. "Punch them up" wants a fresh
  scored hooks run = `generate_hooks`, already bound.
- **The scrape skills stay brokered.** Apify's $5/mo cap is not the agent's to spend.
- **Continuation chips carry intent as DATA, not as a better sentence.** Rewording was measured: a
  continuation clause reached 1/3 and destabilised sibling chips.
- **`mode` stays `"chat"` on the agent path**; only `modeLabel` moves (`mode` selects `MODE_ROLES`).
- **Three models stay on plus.** See §1.
- **"Read another" is an UNPINNED chip** even though `read` is bound — a pin forces the tool on
  round 1 and a Read cannot run without the text, so a subject-less pin would spend the turn on the
  loop's "no draft" guard. Unpinned, the agent surfaces the field that collects it.

---

## 9. Files that matter

| file | what it owns |
|---|---|
| `src/lib/tools/skill-dispatch.ts` | `SKILL_TOOLS` — tier 1 is one entry here |
| `src/lib/tools/skill-capabilities.ts` | `SKILL_CAPABILITIES` + `SKILL_REQUESTABLE_ACTIONS` (the flag filter) |
| `src/lib/tools/chat-agent-loop.ts` | the streaming loop: binding, directive, `forceSkill`, replay, billing, the artefact guard |
| `src/lib/threads/chat-prior-turns.ts` | **the agent's memory** — records + `NON_RECORD_BLOCKS` |
| `src/lib/tools/chat-followups.ts` | `ChatTurnKind` + the chips |
| `src/lib/tools/__tests__/chat-reachability.test.ts` | the three closures: reachability · memory · wiring |
| `src/components/thread/input-request-block.tsx` | the in-thread fields (one branch per action) |
| `src/components/thread/markdown-block.tsx` | the chat answer's typography |
| `src/lib/engine/qwen/client.ts` | the **five** model constants + why each sits where it does |
| `src/lib/flags/horizontal.ts` | the flag that hides three skills |
| `docs/MODEL-POLICY.md` | the model SSOT |

---

## 10. Ground rules that keep paying off

1. **Structure beats prompt text.** Every fix that stuck was structural.
2. **Measure the thing that actually failed** — replay the real thread, never a synthetic one.
3. **A change that only dispatches MORE is not a fix.** Keep the controls and READ what they say.
4. **A green suite is not a verified feature.** ~5,200 tests were green through a routing bug that
   meant the product's main door did nothing, through Apollo losing every citation, through a
   calibration outage, and through the paid pack going out the free door.
5. **Scope the exception rather than abandon the change.** Three holdouts are why a platform-wide
   ~10× cost cut shipped instead of being reverted.
6. **Verify a finding BEFORE building on it** — and prefer the source the product itself reads.
