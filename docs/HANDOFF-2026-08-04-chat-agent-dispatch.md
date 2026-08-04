# Handoff — chat agent → skill dispatch (2026-08-04)

**Branch:** `fix/chat-agent-dispatch-mode-label` (off `origin/main` @ `8539e5e6`)
**Worktree:** `~/virtuna-slot-a`
**Status:** three fixes landed on the branch and measured. §4 — the severe one — is now **FIXED and
verified live** (2026-08-04, later session).

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

---

## 1. How to reproduce anything here

No browser needed. The probes drive the real code with real prompts.

```bash
# offline: real prompts + real model, call the loop directly. Omitting `billing`
# makes billable skills FAIL CLOSED, so nothing runs and nothing is charged.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json <script>.ts

# live: mint the session, drive the SSE route
node --env-file=.env.local live-hooks.mjs
```

Live auth (no Playwright — `e2e/auth.setup.ts` cannot work, the login page is code-first):
`POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` + `Authorization: Bearer <ANON>`
→ cookie `sb-<ref>-auth-token.0 = 'base64-' + base64url(JSON.stringify(session))`, chunked at 3180.
Creds are `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in `.env.local` (a **real prod account**).

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

## 5. Verified working (and the chips that are not)

**`request_input` — live, free, correct.**
"can you remix this video for me" → `input-request` `kind:link` `action:remix`;
"read my tiktok account" → `input-request` `kind:none` (confirm button). Both persist.

**Loading states — verified from the live frame order**, and the client consumes all of them
(`src/hooks/queries/use-chat-stream.ts` → `dispatchedSkill`, `stages`, `evidence`, blocks;
`composer.tsx:643` feeds `dispatchedSkill` to the follow-up row). `dispatch` arrives ~22s before the
cards, which is what lets the capsule label itself and seed the stage plan. **Not checked in a browser.**

**Follow-up chips** derive correctly — `classifyTurn(["hook-card"×5])` → `"hooks"` → *More hooks /
Which is strongest? / Punch them up*. Routing, measured offline with realistic priors:

| chip | routes to |
|---|---|
| ideas: More ideas · Script the best one · Sharper angles | ✅ 3/3 each |
| script: Hooks for this | ✅ 3/3 |
| chat: Give me ideas · Write hooks · Draft a script | ✅ |
| hooks: More hooks | ❌ 0/3 — the model pushes back for a sharper angle instead (see below) |
| hooks: Punch them up | ❌ 0/3 — no refine skill is bound (same gap as the script chips) |
| script: Make it punchier · Different angle | ❌ never dispatch — **no refine skill is bound to the loop** |

`src/app/api/tools/refine/route.ts` exists but the agent loop only binds ideas/hooks/script. A
"rewrite/punch up" ask therefore has no tool to reach and degrades to prose.

**"More hooks" is a separate, still-open defect** — measured 0/3 both before and after the §4 fix, so
it is NOT the same bug. "Give me a few more hook options." carries no subject, and the directive's
"too vague or too generic → push back ONCE for a sharper angle" clause fires: the model answers *"I
need the specific story or angle you're working with"*. Reasonable for a typed message; wrong for a
CHIP the creator pressed under cards that already name the subject. Fix shape is §4 option 3 — have
continuation chips carry the topic (or invoke the skill directly) rather than round-tripping a
subject-less sentence through the model.

---

## 6. State of the branch

Seven files:

| file | change |
|---|---|
| `src/lib/threads/chat-prior-turns.ts` **(new)** | `openChatPriorTurns` — the anchor, with each past skill run attached to the turn that announced it (§4) |
| `src/lib/threads/__tests__/chat-prior-turns.test.ts` **(new)** | 9 guards for the above |
| `src/lib/kc/assembler.ts` | optional `modeLabel`; header prints `modeLabel ?? mode` |
| `src/app/api/tools/chat/route.ts` | agent path passes `modeLabel: "copilot"`; the open-chat anchor now comes from `openChatPriorTurns` |
| `src/lib/tools/chat-agent-loop.ts` | directive names only bound generators; unknown-skill refusal carries the do-not-fake instruction; **`ChatAgentPriorTurn` + `replayPriorTurn`** (§4) |
| `src/app/api/tools/chat/__tests__/route.test.ts` | guards 6d + **6e** |
| `src/lib/tools/__tests__/chat-agent-loop.test.ts` | two guards + **three prior-turn replay guards** |

**Gate:** `tsc --noEmit` → **0 errors** (run it separately; vitest does not typecheck).
Suite **459 files / 5070 tests, 0 failures**. The 3 reported "Errors" are pre-existing in
`composer.test.tsx`. `EXIT=1` with zero failures is this worktree's known vitest drift, not a failure.

⚠️ **Run the suite on an otherwise idle machine.** A run sharing the box with a dev server + a live
probe reported 4 failures — two 5s timeouts in `composer-*.test.tsx` and two in
`resolve-video.test.ts` (which passes alone and fails only alongside the composer files). All four
were load flakes: 3/3 clean on re-run, and the clean full suite is 0 failures. Don't chase them.

⚠️ Merging to `main` **is** deploying — production builds ~3s later, there are no preview URLs.
Gate before the push, not after.

---

## 7. Recommended next session

§4 is closed. What is left, highest value first:

1. **The continuation chips.** "More hooks" and "Punch them up" both dispatch 0/3 — measured, and
   NOT the §4 bug (unchanged by its fix). Two distinct causes: a chip whose sentence carries no
   subject trips the vagueness pushback, and no refine skill is bound at all. Both point at §4
   option 3: have chips carry the topic, or invoke the skill directly. See §5.
2. **Decide the refine gap** — bind `src/app/api/tools/refine/route.ts` to the loop, or retire
   "Make it punchier" / "Different angle" / "Punch them up".
3. **Drive a real anonymous `/go` session** through the route to confirm §3 outside the harness —
   still the only claim here measured offline only.
