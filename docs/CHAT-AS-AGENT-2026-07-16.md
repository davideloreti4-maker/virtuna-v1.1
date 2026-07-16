# Chat as a skill-orchestrating agent — the "one thread, all skills" vision (2026-07-16)

**Status:** dispatcher spike PASSED (routing 5/5 + a real ideas run) **AND route integration WIRED**
(flag `CHAT_AGENT_DISPATCH`, default OFF) — a chat turn now runs a skill and its real cards render in
the same thread. **Branch:** `spike/corpus-fn-tool`. **Builds on:**
`docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` (function calling proven with qwen3.7-plus).

> **▶ START HERE (next session).** Route integration is DONE at three layers and proven by tests (§4a).
> **Session 3 shipped BOTH ranked reach items:** (1) ✅ **reload fidelity DONE (§4d)** — a thread
> stamped chat-agent now reloads as ONE ordered stream in the chat view (marker-shadowed, regression-
> safe: no marker → byte-identical old reload). (2) ✅ **generalize beyond generators DONE for
> simulate/predict (§4c)** — the SECOND adapter shape (`draft`, not `topic`) is in `SKILL_TOOLS`
> (`simulate_reaction` + `predict_outcome`); real-model routing **7/7**. **Still open (ranked):**
> **(a) read/profile dispatch** — needs `supabase` on `SkillRunContext` + a product call on profile's
> save side-effect (profile WRITES an audience). **(b) light attribution** in general chat (owner
> decision, still unwired). **(c) selector retirement** — keep it until the flag-on path is proven in
> prod. **Not yet run:** a full flag-on browser session against live DashScope+Supabase (owner-auth-
> gated; the dispatcher is already live-proven, and all new plumbing is deterministic + test-covered).
> Live scripts: **sandbox-OFF, foreground** (`npx tsx …`). Tests: `node ./node_modules/vitest/vitest.mjs
> run …` (NOT `npm test`).

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

**Honest gaps.** (1) The unified reload wraps the whole stream in one `SkillResultCard` (label "Chat")
— acceptable one-turn presentation, not per-message chrome. (2) A chat-agent turn that returns NO
closing text persists no marker → that thread reloads via the old per-tool path (cards still present,
just in the tool view). Rare (the prompt always asks for a closing line) and a graceful degrade. (3) Not
live-run in a browser (owner-auth-gated) — same gate as the rest of the feature.

## 5. Guardrails (hold these)

- Paid-engine leash on every dispatch (done).
- Flag-gated; degrade to plain chat on any failure.
- Selector stays until the chat path is proven in prod.
