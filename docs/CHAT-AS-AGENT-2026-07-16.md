# Chat as a skill-orchestrating agent — the "one thread, all skills" vision (2026-07-16)

**Status:** dispatcher spike PASSED (routing 5/5 + a real ideas run), route integration NOT yet wired.
**Branch:** `spike/corpus-fn-tool`. **Builds on:** `docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` (function
calling proven with qwen3.7-plus).

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

## 4. What's left (route integration — the productization)

1. **Wire `runSkillDispatch` into `/api/tools/chat/route.ts`** behind a default-off flag. When the model
   runs a skill, stream its `stage`/`content`/`score` events and `insertMessage` its blocks into the
   open thread — **reuse the existing skill-route emit/persist code verbatim** (it already does exactly
   this). The closing text persists as a markdown message (the follow-up pattern, already there).
2. **Confirm the render layer** — `message-blocks.tsx` shows these blocks in the chat thread view (very
   likely, since skills already post there; verify when wiring).
3. **Generalize beyond generators.** simulate/predict/read/profile need a concept/analysis context, not
   just a topic — a second adapter shape. Do NOT force them through the generator adapter.
4. **Product call:** retire the skill selector, or keep it as a shortcut. **Keep it until the chat path
   is proven end-to-end** — don't rip it out on faith.

## 5. Guardrails (hold these)

- Paid-engine leash on every dispatch (done).
- Flag-gated; degrade to plain chat on any failure.
- Selector stays until the chat path is proven in prod.
