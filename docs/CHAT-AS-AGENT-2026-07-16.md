# Chat as a skill-orchestrating agent — the "one thread, all skills" vision (2026-07-16)

**Status:** dispatcher spike PASSED (routing 5/5 + a real ideas run) **AND route integration WIRED**
(flag `CHAT_AGENT_DISPATCH`, default OFF) — a chat turn now runs a skill and its real cards render in
the same thread. **Branch:** `spike/corpus-fn-tool`. **Builds on:**
`docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` (function calling proven with qwen3.7-plus).

> **▶ START HERE (next session).** The chat path is now a **single STREAMING agent loop (§4e)** — the
> ChatGPT/Claude-native shape the owner asked for. Flag-on open chat runs ONE streaming completion:
> the model streams its answer directly and only pauses to call a tool (a skill → cards, or
> `search_corpus` → grounding). The old 2-to-3-call path (discarded dispatch pre-flight → runChatPipeline
> → its own corpus scout) is GONE for flag-on open chat. Proven live (Part 2 of
> `scripts/spike-stream-tools.ts`) + unit-tested; DashScope streams `delta.tool_calls` in fragments
> (step-0 spike). Earlier session-3 work still stands: reload fidelity (§4d), analysis-skill dispatch
> (§4c). **Session 5 (§4f):** multi-turn reload FIXED (per-turn rehydration — §4d gap #1 closed) +
> grounding arm LIVE-VERIFIED headless (search_corpus fires, answer grounds on real corpus creators).
> **Session 6 (§4g):** live turn persistence (scroll/disappear bug) + premium frameless chat chrome +
> typing indicator — all owner-hands-on + browser-verified. **Still open (ranked):** **(a) FINISH the
> OWNER LIVE PASS** — walk EVERY skill via chat (ideas/hooks/script/simulate/predict) with mock OFF,
> checking latency + correctness; owner did a partial pass (found+fixed the 3 §4g issues). This is the
> gate before (b). Belt-and-suspenders: re-run the scroll fix with a real hooks dispatch (verified with
> plain chat; identical code path). **(b) DEFAULT the flag on + retire the selector** (product call,
> keep until prod-proven). **(c) read/profile as tools** (needs `supabase` on the context + profile
> WRITES an audience — product call). **(d) light attribution / cite corpus creators** as a formal card
> (model already cites in prose). **(e) skill-dispatch loading** — show the progress spine (chat.stages
> already emitted) during the ~1min run instead of only typing dots. **(f) DEV papercut:** mock-mode +
> unmocked chat = a misleading "rephrase" error (dev-only, prod hard-gates mock off) — clearer message
> OR add a chat fixture. **(g) branch hygiene:** `spike/corpus-fn-tool` has grown past a spike — merge
> to main via a clean PR after (a)/(b); clean up the throwaway test account + seeded mock threads.
> Live scripts: **sandbox-OFF, foreground** (`npx tsx …`). Tests:
> `node ./node_modules/vitest/vitest.mjs run …` (NOT `npm test`). Enable: `CHAT_AGENT_DISPATCH=true`
> (+ optional `GROUNDING_CHAT_TOOL=true` to bind the corpus tool).

---

## 0. The vision (owner)

One surface. You chat, ask for ideas, then hooks on the best one, then a script — **all in the same
thread**, so context carries the whole way, and you **never manually pick a skill**. The skill
*selector* becomes optional.

## 1. The discovery — the vision is ~80% already built

The app is **already a unified block-message thread**:

- Every message row is `{ role, blocks[] }`; the **BLOCK_REGISTRY** already has a type for every skill's
  output (`markdown`, `idea-card`, `hook-card`, `script-card`, `remix-card`, `outlier-grid`,
  `multi-audience-read`, `prediction-gauge`, `persona-chat-turn`, …), validated on write + rehydration.
- **Every skill route** (`/api/tools/{hooks,ideas,simulate,script,…}`) already runs its pipeline and
  `insertMessage(openThread.id, "assistant", blocks)` into the **SAME open thread** ("Hooks chain
  appends to the same open thread as Ideas").
- The thread already renders all of it (`src/components/thread/message-blocks.tsx`).
- Conversational glue already exists: after a hooks run, the route makes a co-pilot Qwen call that
  writes an observation + a next step, persisted as a markdown message in the same thread.

So the make-or-break "inline card rendering / shared context" is **already the shipping architecture**.
The skill selector is just a UI convenience picking which route the composer POSTs to — they all write
to the same thread. **The only missing piece: chat doesn't DISPATCH to the other skills.**

## 2. What was built — the dispatcher (spike)

`src/lib/tools/skill-dispatch.ts` — chat-as-agent, **general by construction**:

- A **skill-tool registry** (`SKILL_TOOLS`): each skill = one entry (tool schema + a thin adapter to its
  `runXPipeline`). The three generators share one input shape, so the adapter is uniform. Adding a skill
  is one entry.
- `runSkillDispatch({ ask, context })`: gives the chat model the toolbelt, `tool_choice: "auto"`; the
  model either answers (pure chat) or calls a skill; we run its pipeline and collect the block-cards +
  a closing co-pilot line. Returns `{ text, skillRuns: [{name, blocks}], toolCalls }`.
- **PAID-ENGINE LEASH** (`maxSkillRuns`, default 2): skills hit the paid engine; over the cap the tool
  returns a refusal the model relays instead of running. An LLM spending money needs a limit.
- Unknown-skill / empty-topic / run-error are all absorbed into tool results (never throw).

## 3. Spike results (live, real qwen3.7-plus)

**Routing — 5/5** (real model decides, mock runners → free):

| ask | dispatched to |
|---|---|
| "Give me 3 ideas for a video about morning routines" | ✅ `generate_ideas` |
| "Write me some hooks for a video on meal prep" | ✅ `generate_hooks` |
| "Write a full script for a video about budgeting tips" | ✅ `write_script` |
| "What actually makes a good hook these days?" | ✅ (none — chat) |
| "I'm stuck at 400 followers, what should I focus on?" | ✅ (none — chat) |

The closing text is the co-pilot voice and **chains skills**: *"I've generated 3 fresh angles… let me
know if one stands out, or if you'd like hooks for any of them."*

**Real run (`SPIKE_REAL=1`):** the dispatcher ran the real `runIdeasPipeline` → **4 real `idea-card`
blocks** (the exact type the thread renders) + *"Which one resonates, or would you like me to write a
script for one of them?"*

**Tests:** `src/lib/tools/__tests__/skill-dispatch.test.ts` — 6 hermetic (routing, abstain, leash,
unknown, no-topic, error). Green, tsc clean. Harness: `scripts/spike-skill-dispatch.ts`.

## 4a. Route integration — DONE (flag `CHAT_AGENT_DISPATCH`, default OFF)

Wired across three layers; 320 lines, +5 route tests + 2 new test files; 423 tests green in the touched
areas; tsc clean.

- **Server** (`src/app/api/tools/chat/route.ts`): open chat only (persona/meet EXCLUDED — a viewer
  reacts in-voice, it doesn't orchestrate skills; mirrors the corpus-tool exclusion). When the flag is
  on, the turn goes through `runSkillDispatch`. If a skill ran: each card streams as `event: block` +
  is `insertMessage`d into THIS thread; the co-pilot closing line streams as a `token` + persists as a
  markdown message; `stage` events ride the skill's real `onStage` boundaries. If NO skill ran (pure
  chat / strategy talk) → `dispatched` stays false and control falls through to the **existing grounded
  `runChatPipeline`**, so plain-chat quality is never degraded. Flag OFF → byte-identical.
- **Transport** (`src/hooks/queries/use-chat-stream.ts`): consumes `block` + `stage` into an ordered
  `streamingBlocks` / `stages`, alongside the existing token/meta/done/error handling.
- **Render** (`src/components/thread/chat-thread-view.tsx` + composer prop): the streamed cards render
  through the EXISTING `MessageBlocks` (a renderer per card type). New prop `streamingCardBlocks`.

Design notes:
- **Separate flag** `CHAT_AGENT_DISPATCH` (independent of `GROUNDING_CHAT_TOOL` — they're different
  levers). Read via `isChatAgentDispatchEnabled()`.
- I streamed a general **`event: block`** (the full validated card) rather than reusing the ideas
  route's `content`+`score` two-phase emit verbatim — that two-phase shape is generator-specific; a
  single block event is the GENERAL fit (band/fraction already on the block; honest one-shot render) and
  is the natural home for §4b's non-generator skills.
- **Pure-chat cost:** flag-on plain-chat turns make one thin dispatch-detection call before the grounded
  answer. Deliberate tradeoff (don't degrade grounded chat); optimizable later.
- The **paid-engine leash** stays (`runSkillDispatch`'s `maxSkillRuns`, default 2).

## 4b. What's left (the reach)

1. ✅ **Reload fidelity — DONE (session 3, §4d).** A thread stamped chat-agent reloads as one ordered
   stream in the chat view. Regression-safe by construction (marker-shadowed).
2. ✅ **Generalize beyond generators — DONE for simulate/predict (session 3, §4c).** read/profile still
   open: they need `supabase` on `SkillRunContext`, and profile SAVES an audience (a heavier side-effect
   → an owner product call), so they were deliberately left out of this pass.
3. **Wire light attribution** in general chat (owner decision — §6 of the handoff).
4. **Product call:** retire the skill selector, or keep it as a shortcut. **Keep it until the flag-on
   path is proven in prod** — don't rip it out on faith.
5. **Live proof:** run the flag-on flow in a real browser session (DashScope+Supabase). Owner-auth-gated.

## 4c. Session 3 — analysis skills dispatch (simulate + predict)

The dispatcher was hardwired to the generator shape (`topic` required; adapter → `runXPipeline({ask})`).
Session 3 added the **SECOND adapter shape** for analysis skills, which read a SPECIFIC drafted
message/scenario, not a subject. **One file changed: `src/lib/tools/skill-dispatch.ts`** — the route's
dispatch branch, the `event: block` transport, and `MessageBlocks` were already block-type-agnostic, so
`reaction-distribution` + `prediction-gauge` ride the existing path untouched.

- **Args generalized.** `SkillToolArgs` now carries `topic?` / `anchor?` (generators) OR `draft?`
  (analysis). Each `SkillTool` names its own `primaryArg` (`"topic"` default, `"draft"` for analysis);
  the dispatcher validates the right required field instead of hardcoding `topic`. Missing primary arg →
  the same absorb-don't-throw tool result ("no draft provided") the model relays.
- **Two registry entries** via a new `analysisSchema` builder: `simulate_reaction` → `runSimulate`,
  `predict_outcome` → `runPredict`. Each adapter: `normalizeStimulus({kind:"text", text: draft})` →
  runner → one block. Eligibility guard `requireDirectionalAudience(ctx.audience)` throws a
  creator-facing message (absorbed as a tool result) when there's no General (Directional) audience —
  the SAME rule the simulate/predict routes enforce with a 400. `ctx.audience` is already populated by
  the chat route (`activeAudience`).
- **System prompt** now distinguishes generators (pass `topic`) from analysis (pass the `draft`).

**Proof.** `skill-dispatch.test.ts` → 9 green (added: analysis routing, no-draft refusal, a registry
structural test locking both shapes). tsc clean (the 4 `src/lib/grounding/` errors are pre-existing).
Route/transport/render suites still green (25 across the four areas). **Live routing 7/7** (real
qwen3.7-plus, mock runners → free, `scripts/spike-skill-dispatch.ts`): the model routes both analysis
asks correctly AND extracts `draft` (the actual hook / scenario), never `topic`. NOT live-run through
the real adapter (runners mocked) — but that path is identical to the shipping simulate/predict routes;
the dispatcher is just a new caller with the same `{audience, stimulus}` args.

**Deliberately deferred: read/profile.** `runProfile` needs a `supabase` client on `SkillRunContext`
(new field), handles a video/max tier the chat can't supply, and — unlike the pure-read
simulate/predict — SAVES a General-mode audience as a side-effect. Dispatching an implicit audience
*write* from a chat turn is an owner product call, so it's a documented follow-up, not this pass.

## 4d. Session 3 — reload fidelity (one thread on reload)

**Problem.** Live streaming already shows a dispatched skill's cards in the chat view, but on reload
the composer's `loadPersistedBlocks` split persisted blocks by TYPE into per-tool buckets and restored
`activeTool` to the most-recent card type — so a chat-run ideas set reappeared in the IDEAS view, its
cross-skill ordering (cards + co-pilot line) lost. **There is no structural difference** between "ideas
dispatched from chat" and "ideas run from the selector" — identical `user → cards → co-pilot markdown`.
So reload can't tell a chat thread apart without a marker.

**Approach — marker-shadowed, regression-safe by construction.** Only a thread PRODUCED by chat-agent
dispatch reloads as one unified stream; every existing / selector / flag-off thread is byte-identical.

- **The marker.** The chat route stamps the co-pilot closing markdown with `props.origin="chat-agent"`
  — written ONLY in the flag-on dispatch branch, so the marker is the flag's shadow on the client (no
  client-side flag read needed). `MarkdownBlockSchema` gained an optional `origin` field: a non-strict
  Zod object silently STRIPS unknown props, so without the schema field the marker would vanish on
  rehydration. Optional → every existing block still validates.
- **Pure helpers** (`src/components/app/home/rehydrate-thread.ts`, unit-tested): `isChatAgentThread`
  (any assistant markdown carries the marker) + `orderedAssistantBlocks` (the full non-user block stream
  in message order). Extracted so the decision is a tested pure function, not more logic inlined into
  the 2600-line composer.
- **Composer** (`loadPersistedBlocks`): if `isChatAgentThread`, set `persistedChatStream` = the ordered
  stream and force `restored = "chat"` (overriding the card-type restore, still behind the
  `hasUserSelectedToolRef` guard). Absent marker → `persistedChatStream` stays `[]` and the per-tool
  buckets remain the sole source. **One new state + three small edits; no `hasThread` change** (a
  chat-agent thread always has its marked markdown in the existing markdown bucket, which already flips
  `hasThread`).
- **ChatThreadView**: new optional `persistedStream` prop; when non-empty it REPLACES the markdown-only
  persisted body (rendered via the existing `MessageBlocks`, one renderer per card type). Normal chat
  thread → empty stream → unchanged.

**Proof.** blocks (origin survives validation), rehydrate-thread (6 — marker detection + ordering),
chat-thread-view (persistedStream renders the mixed stream + takes precedence), and a **discriminating
composer reload pair**: a STAMPED thread renders the card AND the co-pilot line (only the chat view
shows markdown → proves `activeTool` flipped to chat), while an UNSTAMPED selector thread renders only
the card (ideas view, no markdown) — the second test FAILS if all threads were unified, so it locks the
no-regression guarantee. 108 green across the touched areas; tsc clean (4 grounding errors pre-existing).

**Honest gaps.** (1) ✅ **CLOSED (§4f, session 5).** The unified reload wrapped the whole stream in one
`SkillResultCard` under one user bubble — fine single-turn, but on multi-turn it dropped earlier
questions and misattributed answers. Now renders per-turn (`orderedTurns`). (2) A chat-agent turn that returns NO
closing text persists no marker → that thread reloads via the old per-tool path (cards still present,
just in the tool view). Rare (the prompt always asks for a closing line) and a graceful degrade. (3) Not
live-run in a browser (owner-auth-gated) — same gate as the rest of the feature.

## 4e. Session 4 — the single STREAMING agent loop (ChatGPT/Claude-native chat)

**Problem.** Flag-on open chat was slow because it made 2–3 sequential model calls: `runSkillDispatch`
(a NON-streaming tool decision whose abstain-answer was THROWN AWAY) → `runChatPipeline` (a second call
for the grounded answer) → and if `GROUNDING_CHAT_TOOL` was on, that pipeline ran its OWN non-streaming
corpus scout before its streamed answer. First token was slow on the most common case (just talking) —
the opposite of the instant ChatGPT feel.

**What shipped.** A single streaming agent loop replaces all of that for flag-on open chat.

- **Step 0 de-risk (`scripts/spike-stream-tools.ts`):** no streaming-with-tools call existed anywhere
  in the repo, and DashScope streaming `delta.tool_calls` was unproven. The spike proved it: tool calls
  stream in fragments (7 fragments → reassembled to `generate_ideas({"topic":"morning routines"})`),
  text streams token-by-token (102 deltas), and the two never co-occur in one delta. No hybrid fallback
  needed.
- **`src/lib/tools/chat-agent-loop.ts` — `runChatAgentStream`.** ONE streaming completion with the
  skills + (when grounding on) `search_corpus` bound as tools. It accumulates `delta.content → onToken`
  and `delta.tool_calls` by index; at round end, if the model called tools it executes each (a skill
  adapter → `onBlock` each card; or `executeCorpusSearch` → rows fed back as a `role:"tool"` message)
  and loops so the model continues streaming with the results. No pre-flight, no discarded answer.
  Reuses `SKILL_TOOLS` + adapters + the paid-engine leash, and `SEARCH_CORPUS_TOOL` +
  `executeCorpusSearch`. The streaming completion is an injectable seam (`deps.streamComplete`) so the
  whole loop is unit-tested with a mock chunk stream. The loop OWNS a **tool-use directive** appended to
  the caller's system prompt (KC_CHAT_SYSTEM_PROMPT grounds voice but never mentions the tools — without
  the directive the model wrote ideas inline instead of calling the skill; caught in the live Part-2
  run, then fixed).
- **Route (`src/app/api/tools/chat/route.ts`).** The flag-on open-chat branch now calls
  `runChatAgentStream` (grounding via `assembleBundle` into the fenced user message + `KC_CHAT_SYSTEM_
  PROMPT` as system; prior turns as real role messages). `onToken → token`, `onBlock → block`,
  `onStage → stage`. Persists skill cards + the streamed text as markdown — MARKED `origin:"chat-agent"`
  only when a skill ran (reuses the §4d reload marker); pure chat persists plain markdown (byte-identical
  reload). Persona/meet-mode + flag-off still use `runChatPipeline`, unchanged.

**Proof.** `chat-agent-loop.test.ts` (7: pure-chat streaming, fragmented-tool-call accumulation + skill
run + continue, `search_corpus` feedback, grounding-off = corpus tool not bound, the leash, missing-arg
refusal, error absorption). Route tests rewritten to the loop shape (11 green — including "pure chat →
NO runChatPipeline fallback" and the origin-marker persistence). tsc clean (4 grounding errors pre-
existing). **Live end-to-end** (Part 2 of the spike, real qwen3.7-plus, mock runners → free): an ideas
ask calls `generate_ideas` (1 card via `onBlock`) then streams a closing line — one continuous turn; a
pure-chat ask streams 1557 chars directly, no tool. The double-call is gone.

**Honest gaps.** (1) NOT run flag-on in a real browser (owner-auth-gated) — the final latency proof.
(2) Text/card persistence order: cards persist before the streamed text, so a rare model lead-in BEFORE
a tool call would reload slightly out of order (the spike showed 0 lead-in text before a tool call).
(3) `runSkillDispatch` + `runChatPipeline`'s corpus pre-flight are now dead for open chat (persona still
uses `runChatPipeline`) — a later dead-code pass.

## 4f. Session 5 — multi-turn reload fix + grounding live-verified

**The reload bug (§4d honest gap #1, now CLOSED).** Session-4's live pass found the mega-card gap was
worse than "not per-message chrome": `orderedAssistantBlocks` flattened EVERY assistant block across ALL
turns into one stream, and `ChatThreadView` dumped it into ONE `SkillResultCard` under ONE user bubble.
So any thread with ≥1 skill turn reloaded with **earlier questions dropped and answers misattributed** —
a plain-chat answer reattached under the *next* question, above unrelated cards. For a multi-turn chat
product that's a real defect, not cosmetic. It shipped green because §4d's tests only asserted
single-turn reload (the accomplice pattern).

**Fix — per-turn rehydration.**
- New pure `orderedTurns(messages)` (`rehydrate-thread.ts`, unit-tested) groups persisted messages into
  `{ userTurn, blocks }[]` — one turn per user message, consecutive assistant messages merged into it.
  `orderedAssistantBlocks` stays (still correct for the per-tool bucket split, where the question is
  never shown beside the cards).
- `ChatThreadView` renders **one question-bubble + one result-card PER turn**, in order; the live
  streaming turn renders as the last turn with its own bubble. Prop `persistedStream` → `persistedTurns`.
- Composer passes `persistedChatTurns` (via `orderedTurns`) and now **clears it on New Thread** — a
  latent bug where a prior chat-agent thread's turns lingered under a fresh thread until reload resolved.
- Verified against the REAL route persistence shape: a 2-turn thread (plain-chat Q → ideas Q) writes
  `user(Q1) → assistant md(A1) → user(Q2) → assistant cards → assistant md(A2, origin:chat-agent)`, and
  `orderedTurns` groups exactly that into two correctly-attributed turns.

**Proof.** `rehydrate-thread` (10 — incl. multi-turn attribution) + `chat-thread-view` (5 — incl. a
**multi-turn DOM-order guard** the old single-card render could not pass). 234 green across the touched
areas; tsc clean (4 grounding errors pre-existing). **BROWSER-VERIFIED (session 5):** loaded the real
2-turn thread (hook-Q → ideas-Q) on a full page reload → the real persistence path renders **2 question
bubbles + 2 per-turn cards**, DOM order Q1→A1→Q2→A2 (`q1_answer_not_under_q2` true), 0 console errors.
The old flatten would show 1 bubble + 1 card, so this is unambiguously the new code. (Reload portion of
the "owner live pass" gate is done; the full flag-on latency/owner pass is still separate.)

**Grounding arm — live-verified (closes the §4e "not triggered" note).** Drove `runChatAgentStream`
headless with REAL deps (real DashScope stream + real `executeCorpusSearch`) on a growth-strategy ask.
The model called `search_corpus` → 5 real corpus rows (4827 chars) fed back → the streamed answer
grounded on real creators quoted **verbatim** (`cassie.schoonover` 421k/5.2×, `madisonknowsbest`
819k/458.3×, `luvswallet`). Confirmed those handles are genuinely in the corpus rows (no-model check),
not hallucinated. So on the streaming loop the tool binds, the model chooses it for strategy asks, and
rows feed the grounded answer. (Gap (d) "cite corpus creators" — the model already does this in prose;
a formal citation card is still optional.)

## 4g. Session 6 — live turn persistence + premium chat chrome (owner hands-on pass)

Owner ran the flag-on chat hands-on and surfaced three issues; all fixed + browser-verified (real
DashScope, the throwaway account, a live multi-turn thread).

1. **Scroll/disappear (functional).** After a skill dispatch the earlier turns vanished (owner: "couldn't
   scroll up"; a reload brought them back). Root cause: `useChatStream` holds only the CURRENT turn
   (reset per send) and `persistedChatTurns` loaded only on mount, so live multi-turn dropped prior
   turns. Fix (`composer.tsx`): on `chat.isDone`, re-read the open thread into `persistedChatTurns` THEN
   `chat.reset()` in ONE commit — each finished turn swaps live→persisted, nothing disappears, region
   stays scrollable. Live now renders identically to a reload. Also made the mount populate of
   `persistedChatTurns` UNCONDITIONAL (only rendered in the chat view, so selector threads are
   unaffected — DEFAULT_TOOL is "chat", so a pure plain-chat thread now rehydrates per-turn too).
   Verified live: 4-turn thread, all turns persist, scroll works both ways, 0 console errors.

2. **Frameless premium chrome (visual).** Every turn was wrapped in a bordered "Chat · General"
   `SkillResultCard` (the §4f per-turn fix multiplied it). Owner wants a Claude/Perplexity feel. Fix
   (`chat-thread-view.tsx`): assistant answers render as clean prose under a quiet "Maven" label — NO
   frame, NO header; skill cards self-frame so they lost the redundant wrapper too. `SkillResultCard`
   import dropped from the chat view (still used by other surfaces).

3. **Typing indicator (visual).** Replaced the heavy centered constellation skeleton (chat variant) with
   `ChatTypingIndicator` (`thread-loading.tsx`) — three soft pulsing dots under the label, reduced-motion
   aware. Old skeleton still used for the "Opening thread…" rehydrate state + other views.

**Proof.** `chat-thread-view` +2 tests (typing indicator present + no result-card header; old
`thread-loading-skeleton` gone); 236 green across thread/home/chat-route; tsc clean. Browser: frames
gone (computed-style, no border), typing indicator (component test), scroll/persistence (4-turn live).

**Gotcha surfaced (NOT a bug).** Flag-on chat 503s with a misleading "That answer didn't come through —
rephrase" when **mock mode is armed** (`numen_mock` cookie / ⚙ DevMockPanel "Mock skills" toggle),
because the chat skill has no mock fixture. Dev-only (prod hard-gates mock off). Fix while testing:
toggle Mock OFF. Candidate polish = (f) in START HERE.

## 5. Guardrails (hold these)

- Paid-engine leash on every dispatch (done).
- Flag-gated; degrade to plain chat on any failure.
- Selector stays until the chat path is proven in prod.
