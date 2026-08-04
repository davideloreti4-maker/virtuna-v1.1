# Handoff — chat agent → skill dispatch (2026-08-04)

**Branch:** `fix/chat-agent-dispatch-mode-label` — **rebased onto `origin/main` @ `8896bac7`** (PR #423)
on 2026-08-04. Read that ref with `git rev-parse` — `git log --format` here elided the merge and
reported main as `d3b5afb8`, the squashed commit *below* its own tip.
**Worktree:** `~/virtuna-slot-a`
**Status:** five fixes landed on the branch and measured — §2, §3 (mitigation), §4, §5, §6b. §4 and §5
are verified **live**. **PR #424 is open, unmerged** — the merge is held on one product decision, the
chip pricing note in §5.

---

## 0. The one-paragraph version

Agent→skill auto-routing had never worked in the app. The cause was a single word: `assembleBundle`
stamps `Mode: chat` into the **user** message, and the chat slice defines chat mode as "conversational,
NOT a generation surface", so the model refused to call generators it had bound and been told to call.
Fixed by relabelling that header for the agent path only (§2). While verifying, two further bugs
surfaced: an anonymous visitor could get the paid pack written out in prose (fixed, §3), and — the
serious one — **once a thread contained the line "Five hooks are on screen.", later generation asks in
that same thread copied the sentence and dispatched nothing**. That one is now fixed too, structurally,
by replaying a past turn's skill runs as the tool-call exchange they actually were (§4).

A fourth followed from the third. With routing working, the **follow-up chips** still did not: "More
hooks" and "Punch them up" dispatched 0/3 because a chip's sentence, read alone, has no subject, so
the loop's own "too vague → push back" clause fired on a command the creator had already issued by
tapping. Fixed structurally again — the chip now DECLARES its generator and the loop pins the first
`tool_choice` to it (§5). The much-discussed "refine gap" turned out to be a mis-framing: refine is
card-scoped and already has a live door, so nothing about it changes.

A fifth was then caught by §5's own no-dispatch **control**, which is exactly why a control earns its
keep: it passed the thing under test and failed at its real job. "Which is strongest?" replied *"I
don't have the specific hook lines in front of me"* — because §4 replays a run as a COUNT and never
the card text. The replayed result now carries the lines (§6b), and the chip answers.

Four recurring lessons hold across all of it: **precedent and structure beat prompt text**, **measure
the thing that actually failed**, **a change that only dispatches MORE is not a fix** — every control
here is preserved by construction rather than by the model's good judgement — and **read what your
controls SAY, not just whether they passed.**

---

## 1. How to reproduce anything here

Two committed probes. No browser — the app's ambient animations never settle, and `e2e/auth.setup.ts`
cannot drive the code-first login page.

```bash
# OFFLINE — replays a real thread through the real loop, prose-only vs runs-replayed, 5 asks × 3 seeds.
# COSTS NOTHING: `billing` is omitted, so billable skills FAIL CLOSED and the paid engine never runs.
# What it measures is the model's DECISION, which is the thing under test.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/probe-chat-dispatch.ts

# LIVE — mints a session, drives the SSE route. SPENDS REAL CREDITS (one hooks run per turn).
npm run dev -- --port 3005
node --env-file=.env.local scripts/live-chat-turn.mjs                        # the §4 sequence
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<ask>" # one turn, existing thread
```

🔑 **Replay the conversation that actually failed — do not write a synthetic one.** A hand-built
two-turn transcript carrying the same poisoned sentence dispatched **3/3 and proved nothing**; the
real thread reproduced the bug on the first run. `probe-chat-dispatch.ts` therefore loads the thread
from the DB and cuts its history at the failing ask, exactly where the route would.

Live auth: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` +
`Authorization: Bearer <ANON>` → cookie `sb-<ref>-auth-token.0 = 'base64-' + base64url(JSON(session))`,
chunked at 3180. Creds are `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in `.env.local` (a **real prod
account**). The thread a turn lands in is the `maven_active_thread` cookie — `__new__` forces a fresh
one; omit it and the newest open thread wins.

⚠️ `curl` is not installed on this machine — use `node -e` with `fetch`.
⚠️ `next dev` buffers stdout when not a TTY: the log file stays 0 bytes while the server serves fine.
Probe it with a request; do not tail the log to decide whether it is up.

---

## 2. FIXED — the `Mode: chat` label suppressed every dispatch

`src/lib/kc/assembler.ts:279` prints its `mode` into a header that lands in the **user** message:

```
## Live Grounding Bundle
Mode: chat | Platform: tiktok
```

`KC_CHAT_SLICE` (the system prompt) then says chat mode is *"not a content generator"* and names
**"Over-generating"** as a failure mode: *"Generation belongs in IDEAS and HOOKS mode; chat mode is
conversational, not a generation surface."* The user message announced the exact mode the system
prompt forbids generating in, so the model obeyed the label over the loop's own "DISPATCH EAGERLY"
directive — with `generate_hooks` bound and unused.

**Fix.** New optional `modeLabel` on the assembler input; the header prints `modeLabel ?? mode`. The
chat route's agent path passes `modeLabel: "copilot"`. **`mode` stays `"chat"`** — it is the
`MODE_ROLES` selector, so the grounding content is byte-identical (asserted in the probe).

Measured on the shipped prompts, real profile row, 4 seeds:

| variant | dispatched |
|---|---|
| raw ask, no bundle | 4/4 |
| full bundle **as shipped** | **0/4** |
| same bundle, `Mode: chat` deleted | 4/4 |
| `modeLabel: "copilot"` (the fix) | **4/4** |

**Live:** `dispatch {"skill":"hooks"}` at 3.4s → stage frames → `evidence` → 5 `hook-card` blocks →
`done` at 28.5s. Persisted as cards + prose with `origin:"chat-agent"`.

Never worked in the app: `Mode:` dates to 2026-06-21, the agent path adopted the bundle 2026-07-17 (#316).

**Why 5000 green tests missed it:** `chat-agent-loop.test.ts` passes `systemPrompt: "sys"`, and the
route test mocks `assembleBundle` down to `input.ask`. Neither the real KC prompt nor the real bundle
enters any test. Guard added: route test **6d** asserts the agent path passes a `modeLabel` that is not
`"chat"` while `mode` stays `"chat"` — verified failing without the fix.

---

## 3. FIXED — anonymous visitors got the paid pack in prose

`FREE_SKILL_TOOLS` is **empty** (every generator is billable), so a `/go` visitor is bound `skills: []`
— but `toolUseDirective` named all three generators regardless. The model called `generate_hooks`, got
a bare `{"error":"unknown skill"}` (the only refusal branch carrying no do-not-fake instruction), and
wrote the hooks out in prose: the paid product delivered free through the one door that is free by design.

**Fix.** The directive now names only the generators actually bound, and carries an explicit "you may
not produce the artefact yourself, in any wrapper" clause when none are; the unknown-skill branch got
the same do-not-substitute-prose instruction every other refusal has.

| | refuses honestly | delivers a pack anyway |
|---|---|---|
| before | **0/6** | **5/6** |
| after | **6/6** | **1/6** |

The residual 1/6 is the ceiling of a prompt-level guard. **This is a mitigation, not a seal**, and it
has only been measured offline — no real anonymous session has been driven through the HTTP route yet.

Two guards added to `chat-agent-loop.test.ts` (unbound skills are never advertised; the refusal carries
the instruction), both verified failing without the fix.

---

## 4. FIXED — a thread no longer poisons its own later turns

**The bug.** After a skill run persisted its closing line *"Five hooks are on screen."*, a later
generation ask **in the same thread** made the model reproduce that sentence and call nothing:

```
ask      : "give me hooks for my student budgeting app that stops food delivery overspending"
dispatch : NONE
cards    : 0
text     : "Five hooks are on screen. The strongest ones leverage the prediction error mechanism…"
```

Zero cards, and the UI stating five were on screen.

**Mechanism.** A dispatching turn persists as two rows — the cards, then the model's closing line
stamped `origin:"chat-agent"`. Only `markdown` crossed into the prior-turn anchor (the filter at
`route.ts`), so the transcript the model saw of its own best turn was a bare sentence claiming five
hooks exist, with **no trace of a tool call anywhere**. Asked for hooks again it did the only thing
that transcript supports: it reproduced the sentence. The sentence was the sole precedent it had, and
precedent beats instruction — which is exactly why the prompt attempt failed (1/3, and it
destabilised sibling chips).

**Fix — the transcript now tells the truth.** Two halves:

| file | change |
|---|---|
| `src/lib/threads/chat-prior-turns.ts` *(new)* | `openChatPriorTurns` — walks the thread in order and hands each announcing turn back **with the runs that produced its cards** (`toolRuns: [{name, cards, topic}]`). Cards land in their own row immediately before the text row, so attribution needs no join. `origin:"chat-agent"` is the *confirmation*, never the signal: an `input-request` or `corpus-references` turn carries the same stamp and must not replay as a generator run. |
| `src/lib/tools/chat-agent-loop.ts` | `replayPriorTurn` — a turn carrying `toolRuns` is replayed as `assistant/tool_calls → tool result → the closing line`, byte-identical to the shape this loop builds for a live turn. A run whose tool is **not bound** (anonymous visitor) falls back to plain text, so no dangling tool name is ever advertised. |

The route now calls `openChatPriorTurns` instead of the inline markdown filter. Extraction lives in
`lib/` because a Next.js `route.ts` may only export HTTP methods — and because it is the piece worth
testing directly.

**Measured offline** by replaying the REAL persisted thread that failed (`f5bdbadb…`), rebuilding the
anchor exactly as the route does at the moment of the failing ask. Real KC prompt, real bundle, real
profile row, `billing` omitted so billable skills fail closed and nothing is charged — the DECISION
is what is measured, not the run. 3 seeds, grounding ON (the live default):

| ask | expect | shipped | fixed |
|---|---|---|---|
| the failing ask | dispatch | **0–1/3** | **3/3** |
| "Give me a few more hook options." | dispatch | 0/3 | 0/3 — unchanged, see §5 |
| "Which is strongest?" | no dispatch | 0/3 | 0/3 |
| "why do my videos flop after the first 3 seconds?" | no dispatch | 0/3 | 0/3 |
| "Punch them up" | — | 0/3 | 0/3 — unchanged, see §5 |

The shipped row moved between runs (0/3 then 1/3) — the DashScope `seed` is not fully deterministic,
so treat these as rates, not fingerprints. **The two no-dispatch controls stayed 0/3**: the fix buys
dispatches on the ask that should dispatch without making the model dispatch-happy elsewhere.

**Verified LIVE** against a real signed-in session on the SSE route (3 hooks runs, real credits):

| turn | thread | result |
|---|---|---|
| 1 — seed | fresh | `dispatch hooks` @4.9s → 3 stages → evidence → **5 hook-cards**, 29.9s |
| 2 — the target ask | **same thread** | `dispatch hooks` @2.2s → **5 hook-cards**, 25.7s |
| 3 — a third hooks ask | same thread | `dispatch hooks` @2.8s → **5 hook-cards**, 27.4s |
| 4 — the target ask | **the original poisoned thread** `f5bdbadb…` | `dispatch hooks` @2.4s → **5 hook-cards**, 26.7s |

Turn 4 is the strongest evidence: that thread still contains **two** bare "Five hooks are on screen."
lines with no cards behind them — the buggy turns themselves, which no fix can retroactively repair
because they carry no run to replay. One truthful replayed run was enough to outweigh two false
templates. Its closing sentence is now *true*.

**Scope, corrected.** §2 + §4 together mean agent routing works on the first turn in a thread **and
on later ones**. Nothing about §3 changes (still an offline-only mitigation).

**Guards** — all verified failing with the fix neutered (7 tests red, then green on restore):
`chat-prior-turns.test.ts` (9 tests: the fix, per-generator mapping, two runs in one turn, a
`run-header` alongside the cards, `input-request`/`corpus-references` never fabricating a run, no
forward leak onto later turns, the cap) · `chat-agent-loop.test.ts` (+3: the replay shape, unbound
fallback, plain turns unchanged) · route **Test 6e** (the route actually hands `toolRuns` over).

⚠️ One thing the probe surfaces but does not change: under the artificial fail-closed condition the
model sometimes writes hooks in prose after the tool error, despite the do-not-substitute instruction.
That is the §3 ceiling, not a new defect — live, the billing seam is wired and the tool runs.

---

## 5. FIXED — the continuation chips now reach a tool

**Follow-up chips** derive correctly — `classifyTurn(["hook-card"×5])` → `"hooks"` → *More hooks /
Which is strongest? / Punch them up*. Routing, measured offline with realistic priors:

| chip | routes to |
|---|---|
| ideas: More ideas · Script the best one · Sharper angles | ✅ 3/3 each |
| script: Hooks for this | ✅ 3/3 |
| chat: Give me ideas · Write hooks · Draft a script | ✅ |
| hooks: More hooks | ❌ 0/3 → **✅ 3/3 measured** (below) |
| hooks: Punch them up | ❌ 0/3 → **✅ 3/3 measured** (below) |
| script: Make it punchier · Different angle | ❌ 0/3 → now declare `script`, **not re-measured** ⚠️ |

⚠️ Be precise about what was measured. The two **hooks** chips were re-measured on the real thread and
moved 0/3 → 3/3. The two **script** chips were not: they carry the identical defect and the identical
declaration, so the same mechanism covers them, but nobody has run the numbers. The thread the probe
replays is a hooks thread — measuring them means seeding a script thread first.

### The bug — one cause, not two

Both failures are the same thing: **a chip's sentence, read alone, has no subject.** "Give me a few
more hook options." trips the loop directive's *"too vague or too generic → push back ONCE for a
sharper angle"* clause, and the model answers *"I need the specific story or angle you're working
with"*. That is right for a typed message and wrong for a chip the creator pressed **under cards that
already name the subject** — the UI had already resolved the intent, and round-tripping it through
the model's judgement is where it was lost.

⚠️ The subject was NOT missing from the context. After §4 the transcript carries the original ask and
the tool call that produced the cards; the model still pushed back. So "it can't see the topic" is the
wrong diagnosis — it can, it just would not carry it forward. That is why this could not be fixed by
rewording the chip, and why the prompt attempt reached 1/3 while destabilising siblings.

**The refine gap was a mis-framing.** `/api/tools/refine` is not missing from the loop — it is a
**card-scoped** re-run (needs `cardRef` + the card's content as `anchor`, returns ONE card) and it
already has a live door: the composer's `detectRefineIntent` fires on "make hook 2 punchier" and
routes to `hooks.startRefine`. A TURN-level chip has no card in hand, so binding refine to the agent
would mean inventing a `cardRef` the creator never named. What "Punch them up" actually promises is a
fresh SIM-scored hooks run under a tighter brief — which is `generate_hooks`, already bound. **Decision:
do not bind refine; do not retire the chips.** Nothing about the refine route changes.

### The fix — the chip declares its skill, and the loop pins `tool_choice`

Structural, per §4 option 3, and deliberately NOT prompt text:

| file | change |
|---|---|
| `src/lib/tools/chat-followups.ts` | `ChatFollowup.skill?: "ideas" \| "hooks" \| "script"` — the generator a chip MEANS, declared as data. 18 chips carry one; every conversational chip carries none. |
| `src/lib/tools/chat-agent-loop.ts` | `forceSkill` input → resolves the display key against the BOUND skills and pins **round 1** to `tool_choice: {type:"function", function:{name}}`. Round 2+ returns to `"auto"`. |
| `src/app/api/tools/chat/route.ts` | reads `body.skill`, forwards it as `forceSkill`. |
| `use-chat-stream.ts` · `followup-context.ts` · `followup-row.tsx` · `composer.tsx` | carry `skill` from the tapped chip to the POST body. |

The model still writes the arguments (it pulls the subject off the transcript) and still writes the
closing line. What it no longer gets to do is re-litigate a decision the creator made by tapping.

🔑 **Named `tool_choice` works on DashScope** — verified before building anything, against
`qwen3.7-plus` on the streaming path. It returned `generate_hooks({"topic": "student budgeting app
that stops food delivery overspending"})`: the pin picks the tool, the model still resolves the
subject from the conversation. `"required"` also works, but picks any tool and is not what we want.

**Three things bound the blast radius, by construction rather than by good judgement:**
- a chip with **no** declared skill sends no field — so the conversational chips and every **typed**
  message are byte-identical to before, and the no-dispatch controls cannot move;
- the key is resolved against the skills bound **for this user**, so an anonymous `/go` visitor
  (`skills: []`) silently gets the unpinned path instead of a forced paid run;
- the pin is **round 1 only** — left in place the model would call the same tool every round instead
  of writing the line that tells the creator what it made.

The gate is untouched: a pinned call is admitted, priced and billed exactly like a chosen one.

One nuance worth knowing before you debug something odd: a pinned round 1 means the model cannot open
the turn with `search_corpus`. That costs nothing real — the generator pipelines ground themselves and
emit their own `evidence` — and round 2 is `auto`, so it can still search after the cards. But if you
ever see a chip turn with no agent-level corpus citation where a typed ask has one, this is why.

**Measured** with the committed probe (§1) on the real thread, 3 seeds, grounding ON:

| ask | chip skill | expect | prose-only | runs replayed | **+ chip pin** |
|---|---|---|---|---|---|
| the §4 failing ask | — | dispatch | 0/3 | 3/3 | — |
| "Give me a few more hook options." | hooks | dispatch | 0/3 | **0/3** | **3/3** |
| "Which is strongest?" | — | no-dispatch | 0/3 | 0/3 | — |
| "why do my videos flop after the first 3 seconds?" | — | no-dispatch | 0/3 | 0/3 | — |
| "Rewrite these hooks tighter and more specific." | hooks | dispatch | 0/3 | **0/3** | **3/3** |

The controls declare no skill, so the pin **cannot** reach them — that is the point of the column
being `—` rather than a number. The §4 row also re-confirms 3/3 after the rebase onto `8896bac7`.

⚠️ The probe previously measured the literal string **"Punch them up"**, which is what the button
*says* and never what it *sends*. The chip rows now use the real prompt.

**Verified LIVE** against a real signed-in session on the SSE route, in the same poisoned thread §4
used (`f5bdbadb…`) — one real hooks run:

| turn | sent as | result |
|---|---|---|
| "Give me a few more hook options." | **chip**, `skill: "hooks"` | `dispatch hooks` @2.6s → 3 stages → evidence → **5 hook-cards**, 28.4s |
| "Which of these hooks is strongest…?" | typed, **no skill** | `dispatch NONE`, 0 cards, 2.6s — the control held |

The closing line came back *"Five new hooks are on screen. These lean into the 'comedy storytelling'
angle by framing **food delivery overspending** as a relatable…"* — so the pin picked the tool and the
model still resolved the right subject off the transcript, which was the open question about forcing.

> ⚠️ `live-chat-turn.mjs` prints `RESULT: FAIL` for the control row. That is the harness's criterion
> (`dispatched && cards > 0`), written for dispatch turns; for a no-dispatch control the FAIL label
> **is** the pass. Read the frames, not the verdict line.

**Guards** — all verified failing with the fix neutered, then green on restore:
`chat-agent-loop.test.ts` (+6: the round-1 pin and the `auto` handback, display-key resolution,
unbound-skill drop, unknown-key drop, the no-`forceSkill` control, and that a pinned run is still
gated) · `chat-followups.test.ts` (+3: declared names must exist in the registry's namespace, the six
artefact chips declare one, the twelve conversational chips declare none) · route **Test 6f** (the
field reaches the loop; a typed ask carries none).

💰 **This is a small pricing change, stated plainly:** a chip that used to degrade into free prose now
reliably runs a metered skill. That is the intent — prose delivery of a paid pack was the §3 leak
shape — but it means "More hooks" now costs what a hooks run costs, every time.

---

## 5b. Verified working (unchanged by this lane)

**`request_input` — live, free, correct.**
"can you remix this video for me" → `input-request` `kind:link` `action:remix`;
"read my tiktok account" → `input-request` `kind:none` (confirm button). Both persist.

**Loading states — verified from the live frame order**, and the client consumes all of them
(`src/hooks/queries/use-chat-stream.ts` → `dispatchedSkill`, `stages`, `evidence`, blocks;
`composer.tsx:643` feeds `dispatchedSkill` to the follow-up row). `dispatch` arrives ~22s before the
cards, which is what lets the capsule label itself and seed the stage plan. **Not checked in a browser.**

**The card-scoped refine path** (`detectRefineIntent` → `/api/tools/refine`) — untouched here, and
still the right door for "make hook 2 punchier". See the mis-framing note above before touching it.

---

## 6. State of the branch

Sixteen files:

| file | change |
|---|---|
| `src/lib/threads/chat-prior-turns.ts` **(new)** | `openChatPriorTurns` — the anchor, with each past skill run attached to the turn that announced it (§4); each run now also carries its cards' identifying **lines** (§6b) |
| `src/lib/threads/__tests__/chat-prior-turns.test.ts` **(new)** | 9 guards for §4 + **4 for the lines** (§6b) |
| `src/lib/kc/assembler.ts` | optional `modeLabel`; header prints `modeLabel ?? mode` |
| `src/app/api/tools/chat/route.ts` | agent path passes `modeLabel: "copilot"`; the open-chat anchor now comes from `openChatPriorTurns`; forwards a tapped chip's `body.skill` as `forceSkill` (§5) |
| `src/lib/tools/chat-agent-loop.ts` | directive names only bound generators; unknown-skill refusal carries the do-not-fake instruction; **`ChatAgentPriorTurn` + `replayPriorTurn`** (§4); **`forceSkill` pins round 1's `tool_choice`** (§5); the replayed result carries `cards_on_screen` (§6b) |
| `src/app/api/tools/chat/__tests__/route.test.ts` | guards 6d + **6e** + **6f** (§5) |
| `src/lib/tools/__tests__/chat-agent-loop.test.ts` | two guards + three prior-turn replay guards + **6 for `forceSkill`** (§5) + **3 for the replayed lines** (§6b) |
| `scripts/probe-chat-dispatch.ts` **(new)** | the offline probe of §1 — replays a real thread; three variants: prose-only / runs-replayed / **+ chip pin** (§5) |
| `scripts/live-chat-turn.mjs` **(new)** | the live probe of §1 — mints a session, drives the SSE route. 4th arg sends a turn **as a chip** (§5) |
| `src/lib/tools/chat-followups.ts` | `ChatFollowup.skill` — the generator a chip declares (§5) |
| `src/lib/tools/__tests__/chat-followups.test.ts` | 3 guards for the above |
| `src/hooks/queries/use-chat-stream.ts` · `src/lib/followup-context.ts` · `src/components/thread/followup-row.tsx` · `src/components/app/home/composer.tsx` | carry the tapped chip's `skill` into the POST body (§5) |
| `src/components/thread/__tests__/chat-turn.test.tsx` | the chip-tap guard now pins the declared skill too, + a conversational-chip control |

**Gate (re-run 2026-08-04 after the rebase + §5 + §6b):** `tsc --noEmit` → **0 errors** (run it
separately; vitest does not typecheck). Suite **460 files / 5106 tests, 0 failures**, 42 skipped. The
3 reported "Errors" are the pre-existing unhandled rejections in `composer.test.tsx` (`composer.tsx:2019`).
`EXIT=1` with zero failures is this worktree's known vitest drift, not a failure.

⚠️ **Do not read the suite through `| tail -n`.** The first §5 run reported "3 failed" and the tail had
already discarded the names, costing a whole re-run to identify them. Redirect the full log to a file
(`> /tmp/suite.log 2>&1`) and grep it — and note that piping also makes `$?` the *pipe's* exit status,
so `EXIT=0` after a pipe means nothing at all.

⚠️ Of those first 3 failures, **2 were load flakes and 1 was real** (`chat-turn.test.tsx` — the chip
handler gained a second argument). Re-run before you believe a failure; and do not let the flakes
camouflage the one that is yours.

🔑 **`composer-*.test.tsx` fails on a COLD vitest cache and passes on the next run — and bisecting it
with `git stash` will lie to you.** The failure is `Error: Test timed out in 5000ms` at
`await import('../composer')`: a module-TRANSFORM cost, not behaviour. Every `git stash push` / `pop`
rewrites the files it touches, which invalidates that cache — so the very act of bisecting changes
the variable you are measuring. During §6b this produced a clean, entirely false result: "passes
without the change, fails with it", reproduced twice.

What settles it: **stash EVERYTHING back to the committed HEAD and run the file twice.** At HEAD, with
none of the new code present, run 1 failed and run 2 passed. That is the whole story.
- A `5000ms` timeout on an `import()` line is a cache symptom, never a logic bug — read the failure
  message before reaching for `git stash`.
- ⚠️ `git stash push -u` sweeps UNTRACKED files too. This worktree is shared with another session
  whose `zz-*` files are untracked; they were stashed and restored intact here, but a `stash drop`
  would have destroyed someone else's work. Prefer stashing by explicit path, without `-u`.

⚠️ **Run the suite on an otherwise idle machine.** A run sharing the box with a dev server + a live
probe reported 4 failures — two 5s timeouts in `composer-*.test.tsx` and two in
`resolve-video.test.ts` (which passes alone and fails only alongside the composer files). All four
were load flakes: 3/3 clean on re-run, and the clean full suite is 0 failures. Don't chase them.

⚠️ Merging to `main` **is** deploying — production builds ~3s later, there are no preview URLs.
Gate before the push, not after.

⚠️ **Rebase first.** `main` moved to `8896bac7` (PR #423) while this branch was being built — 2
commits, one of them a merge that `git log --format` does not print. `git rev-parse origin/main` is
the only ref that tells the truth here.

---

## 6b. FIXED — "Which is strongest?" could not see the cards it was asked about

Found by the §5 live **control** turn, which is the whole reason a no-dispatch control earns its keep:
it passed the thing being measured (no dispatch, no cards) while failing at its actual job.

```
ask  : "Which of these hooks is strongest for my audience, and why?"   (the shipped chip prompt)
reply: "I don't have the specific hook lines you're referring to in front of me. Paste the 2–3
        options you're debating, and I'll give you a direct read…"
```

**The model never saw the hook lines.** §4 replayed a past run as `{ran, produced: "5 card(s)"}` — a
COUNT, not content. That was right for §4, which only had to prove a tool ran; but it left the one
chip whose whole job is *judging the cards* structurally unable to do it, asking the creator to paste
back lines the app itself had put on screen.

The mirror image of §5: there the model would not act on what it could see; here it genuinely could
not see it.

**Fix.** The replayed tool result now carries `cards_on_screen` — each card's identifying line, in
order (`hookLine` for hooks, `title` for ideas/scripts), extracted in `chat-prior-turns.ts` and capped
at **6 lines × 200 chars** per run. The `note` tells the model to refer to them and **never re-list
them**, because a chip that answers by reprinting the pack is just the pack again.

Three decisions worth keeping:
- **Omitted, never empty.** A run with no extractable line replays byte-identically to before. An
  empty `cards_on_screen` would tell the model the pack has no contents — worse than telling it
  nothing. Pre-existing threads therefore degrade cleanly.
- **The count stays honest.** `cards: 12` with 6 quoted lines; the cap bounds the quoting, not the truth.
- **An anonymous visitor never receives the lines.** Unbound runs already replay as plain text, so the
  hook lines cannot ride into a session that binds no generators — that would be the §3 leak through
  a new door. Pinned by its own test.

**Measured**, same probe, same thread, 3 seeds — the answer, not the dispatch:

| | reply |
|---|---|
| before | *"I don't see any hook options in our conversation to compare. Did you mean to paste a list…"* (3/3 seeds) |
| after | *"**Hook #2** wins because it weaponizes the 'prediction error' mechanism by linking a physical cue (form) to an unrelated, high-stakes domain (bank account)…"* (3/3 seeds name a specific card and quote its real text) |

**It stayed a no-dispatch control at 0/3**, and it compares rather than re-lists — the two ways this
change could have gone wrong. Every §5 row is unchanged.

**Guards** — 5, each verified failing with the fix neutered: `chat-prior-turns.test.ts` (+4: the lines
and their order, the per-type prop, the two caps, blank/non-string dropped without a placeholder, and
omission when none are extractable) · `chat-agent-loop.test.ts` (+3: the replayed result carries them
with the do-not-re-list note, a line-less run keeps the original shape, and the anonymous visitor
never receives them).

---

## 7. Recommended next session

§2, §4, §5 and §6b are closed and measured. The refine question is **decided, not deferred** (§5:
refine stays card-scoped; the chips route to the bound generators). What is left:

1. **Drive a real anonymous `/go` session** through the route to confirm §3 outside the harness —
   still the only claim in this document measured offline only. Highest value of what remains,
   because it is the free door into the paid engine. Now doubly worth doing: §6b puts real card text
   into the replayed transcript, and the guard that keeps it away from an unbound session is a unit
   test, not a live observation.
2. **Look at the chips in a browser.** Every claim about them here is measured at the wire or in the
   loop; nobody has watched a creator tap one. The Playwright caveat in `CLAUDE.md` applies (the
   ambient animations never settle — use `animations: 'disabled'` + a tight clip).
3. **Consider whether a pinned chip should show its price before it runs.** A chip now reliably
   spends a credit where it used to degrade to free prose (§5). That is the intended behaviour, but
   it was previously free-by-accident, so the affordance may deserve a beat of UI.

Not worth doing: binding `/api/tools/refine` to the agent loop. See the mis-framing note in §5 — it
needs a `cardRef` the agent has no way to name.
