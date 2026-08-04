# Handoff — chat agent → skill dispatch (2026-08-04)

**Branch:** `fix/chat-agent-dispatch-mode-label` (off `origin/main` @ `8539e5e6`)
**Worktree:** `~/virtuna-slot-a`
**Status:** two fixes landed on the branch and measured; **one severe bug confirmed live and NOT fixed** (§4).

---

## 0. The one-paragraph version

Agent→skill auto-routing had never worked in the app. The cause was a single word: `assembleBundle`
stamps `Mode: chat` into the **user** message, and the chat slice defines chat mode as "conversational,
NOT a generation surface", so the model refused to call generators it had bound and been told to call.
Fixed by relabelling that header for the agent path only (§2). While verifying, two further bugs
surfaced: an anonymous visitor could get the paid pack written out in prose (fixed, §3), and — the
serious one — **once a thread contains the line "Five hooks are on screen.", later generation asks in
that same thread copy the sentence and dispatch nothing** (confirmed live, §4).

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

## 4. ⚠️ OPEN, CONFIRMED LIVE — a thread poisons its own later turns

**The bug.** After a skill run persists its closing line *"Five hooks are on screen."*, a later
generation ask **in the same thread** makes the model reproduce that sentence and call nothing.

Confirmed live on a plain, explicit ask — no follow-up chip involved:

```
ask      : "give me hooks for my student budgeting app that stops food delivery overspending"
dispatch : NONE
cards    : 0
text     : "Five hooks are on screen. The strongest ones leverage the prediction error mechanism…"
```

Zero cards, and the UI states five are on screen. Earlier in the same session the *same route, same
account, same ask shape* dispatched correctly — the only difference is that the thread now contains
that closing line. Offline harness reproduces it 3/3 with that prior text.

**Mechanism.** Prior turns carry **markdown only** — card blocks are filtered out at
`src/app/api/tools/chat/route.ts:372-378` — so the model cannot see the earlier hook lines and
*cannot* legitimately continue the set. What it can see is its own closing sentence, which reads as a
template. Nothing marks that turn's cards as tool-produced.

**Scope correction.** §2's fix is necessary but **not sufficient**: it makes the *first* generation
turn in a thread work. Later ones still fail. Any claim that dispatch is "verified live" applies to the
first turn only.

**No revenue leak** — no dispatch means no bill. This is a broken-UX and truth-telling bug.

**Do NOT fix this with a prompt.** Tried: a continuation clause reached 1/3 on the target and
destabilised sibling chips ("Punch them up" collapsed to `request_input` 3/3). Reverted.

Proposed fixes, best first:
1. **Mark tool-produced turns in the prior-turn context.** The route already persists
   `origin:"chat-agent"`; if prior turns carried "these cards came from a tool call" instead of bare
   prose, the sentence could not read as a template.
2. **Let the route own the closing line**, not the model — the route knows what actually ran.
3. Have continuation chips invoke the skill directly instead of round-tripping through the model.
   Subset of the same problem, but it also covers the dead chips in §5.

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
| hooks: More hooks · Punch them up | ⚠️ erratic — see §4 |
| script: Make it punchier · Different angle | ❌ never dispatch — **no refine skill is bound to the loop** |

`src/app/api/tools/refine/route.ts` exists but the agent loop only binds ideas/hooks/script. A
"rewrite/punch up" ask therefore has no tool to reach and degrades to prose.

---

## 6. State of the branch

Five files:

| file | change |
|---|---|
| `src/lib/kc/assembler.ts` | optional `modeLabel`; header prints `modeLabel ?? mode` |
| `src/app/api/tools/chat/route.ts` | agent path passes `modeLabel: "copilot"` |
| `src/lib/tools/chat-agent-loop.ts` | directive names only bound generators; unknown-skill refusal carries the do-not-fake instruction |
| `src/app/api/tools/chat/__tests__/route.test.ts` | guard 6d |
| `src/lib/tools/__tests__/chat-agent-loop.test.ts` | two guards |

**Gate:** `tsc --noEmit` → **0 errors** (run it separately; vitest does not typecheck).
Suite **456 files / 5045 tests, 0 failures**, run twice. The 3 reported "Errors" are pre-existing in
`composer.test.tsx` — confirmed by re-running with these changes stashed. `EXIT=1` with zero failures
is this worktree's known vitest drift, not a failure.

⚠️ Merging to `main` **is** deploying — production builds ~3s later, there are no preview URLs.
Gate before the push, not after.

---

## 7. Recommended next session

1. Fix §4 structurally (option 1 or 2). It is the highest-value item and it is on the primary path.
2. Re-measure §4 with the live sequence in §1: seed a hooks run, then ask for hooks again in the
   same thread. Success = `dispatch` frame + card blocks on the **second** ask.
3. Decide the §5 refine gap — bind `refine`, or retire "Make it punchier" / "Different angle".
4. Drive a real anonymous `/go` session through the route to confirm §3 outside the harness.
