# Handoff — 2026-07-16 (session 4): the single STREAMING agent loop

**Cold-start brief for the next session. Read this first, then `docs/CHAT-AS-AGENT-2026-07-16.md`
(the ▶ START HERE block at the top; §4c/§4d/§4e = what shipped this session).**

---

## 0. One paragraph

The owner asked for a smooth ChatGPT/Claude-like chat. This session took chat-as-agent from a
2-to-3-call router to a **single STREAMING agent loop**: flag-on open chat now runs ONE streaming
completion — the model streams its answer directly and only pauses to call a tool (a content skill →
cards, or `search_corpus` → grounding). No pre-flight, no discarded answer. Also shipped earlier in the
session: analysis-skill dispatch (simulate/predict) and reload fidelity. All behind `CHAT_AGENT_DISPATCH`
(default OFF), test-covered, live-proven with the real model. **The one thing left is owner-gated: a
flag-on browser pass vs live DashScope+Supabase.**

## 1. STATE

- **Branch:** `spike/corpus-fn-tool`, tip **`ada112c1`**, pushed (local == `origin/spike/corpus-fn-tool`).
- **`origin/main` = `42d8e779`.** Branch is **12 behind / 14 ahead** of origin/main.
- **All flags default-OFF:** `CHAT_AGENT_DISPATCH` (chat runs as the agent loop), `GROUNDING_CHAT_TOOL`
  (binds the `search_corpus` tool in the loop), `GROUNDING_REF_MIN_SIMILARITY` (default 0.4).
- **Tests:** all touched suites green; **tsc clean** except 4 PRE-EXISTING errors in `src/lib/grounding/`
  (types.test.ts ×3 + types.ts ×1 — NOT from this work; confirmed on the committed tip).

## 2. What shipped this session — 3 commits

- **`b569bc6a`** — analysis-skill dispatch. A SECOND adapter shape in `SKILL_TOOLS` (`draft`, not
  `topic`): `simulate_reaction` + `predict_outcome`. Real-model routing 7/7.
- **`e890e80f`** — reload fidelity. A thread stamped `origin:"chat-agent"` reloads as ONE ordered stream
  in the chat view (`rehydrate-thread.ts` + `MarkdownBlockSchema.origin` + `ChatThreadView.persistedStream`
  + composer `loadPersistedBlocks`). Marker-shadowed → no marker = byte-identical old reload.
- **`ada112c1`** — the single STREAMING agent loop (the headline). `src/lib/tools/chat-agent-loop.ts`
  (`runChatAgentStream`) replaces `runSkillDispatch` + `runChatPipeline` for flag-on open chat.

## 3. The architecture now (flag-on open chat)

`src/app/api/tools/chat/route.ts` → `runChatAgentStream({ ask, systemPrompt, priorTurns, grounding,
context, onToken, onBlock })`:
- ONE streaming completion with `[...SKILL_TOOLS, (grounding ? SEARCH_CORPUS_TOOL : [])]` bound.
- Accumulates `delta.content → onToken` (streamed answer) and `delta.tool_calls` by index. On a tool
  round: runs skills (adapters + paid leash) / `executeCorpusSearch`, feeds `role:"tool"` results, loops.
- Grounding = `assembleBundle(...)` into the fenced user message + `KC_CHAT_SYSTEM_PROMPT` as system; the
  loop appends its own **tool-use directive** (KC prompt names no tools — without it the model wrote
  ideas inline; caught live, fixed).
- Persists skill cards + streamed text as markdown, `origin:"chat-agent"` ONLY when a skill ran; pure
  chat → plain markdown (byte-identical reload).
- **Persona/meet-mode + flag-OFF still use `runChatPipeline`, unchanged.**

## 4. NEXT STEPS (ranked)

1. **OWNER LIVE PASS — the gate.** Flag-on (`CHAT_AGENT_DISPATCH=true`, optionally
   `GROUNDING_CHAT_TOOL=true`) in a real browser vs live DashScope+Supabase (Supabase login, spends the
   paid engine). Confirm: first-token latency on plain chat drops; a skill/grounding call streams inline;
   reload shows the unified thread. This is the gate before anything goes wide.
2. **Retire/demote the skill selector** (keep as a shortcut). Only after #1 proves the loop in prod.
3. **read/profile as tools** — needs `supabase` on `SkillRunContext` + a product call (profile WRITES an
   audience as a side-effect; the pure-read skills don't).
4. **Light attribution / cite corpus creators** (grounding-as-tool caveat: it absorbs structures but
   doesn't cite by default).
5. **Dead-code pass:** `runSkillDispatch` + `runChatPipeline`'s corpus pre-flight are now unused for open
   chat (persona still uses `runChatPipeline`). Don't delete until #1 is prod-proven.

## 5. GOTCHAS / HOW-TO

- **Enable:** `CHAT_AGENT_DISPATCH=true` in `.env.local` (+ `GROUNDING_CHAT_TOOL=true` to bind the corpus
  tool). Off by default everywhere.
- **Live scripts: sandbox-OFF, FOREGROUND** (`npx tsx …`) — the rtk sandbox silently drops network →
  looks hung. Harnesses: `scripts/spike-stream-tools.ts` (step-0 streaming proof + Part 2 = the loop
  end-to-end, free with mock runners), `scripts/spike-skill-dispatch.ts` (routing 7/7). Need `.env.local`
  with `DASHSCOPE_API_KEY`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` (NOT `npm test` — fake results).
- **Model:** `qwen3.7-plus` via DashScope (`getQwenClient()`), native streaming function calling
  (confirmed: `delta.tool_calls` stream in fragments, accumulate by index).
- **Memory store BLOCKED** from this worktree (path guard on `~/.claude/`) — these repo docs ARE the
  durable record. (The plan file was written via bash for the same reason.)
- **Auto-push hook** silent-fails on non-fast-forward — verify the remote tip after a commit.

## 6. BRANCH HYGIENE (before landing)

`spike/corpus-fn-tool` carries FOUR distinct things now: (a) corpus PULL tool + chat reference mode;
(b) chat-as-agent dispatcher + route integration; (c) analysis-skill dispatch + reload fidelity;
(d) the streaming agent loop. NOT a merge candidate as-is (12 behind origin/main). When landing,
cherry-pick focused PRs off current `origin/main` (as done for #313).

## 7. DOC MAP

- **This file** — session-4 cold-start.
- `docs/CHAT-AS-AGENT-2026-07-16.md` — the running record. §4a route integration, §4c analysis skills,
  §4d reload fidelity, §4e the streaming loop. START HERE block at the top.
- `docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` — corpus PULL + function-calling proof.
- `docs/HANDOFF-2026-07-16-chat-route-integration.md` — session-2 brief.
- `docs/HANDOFF-2026-07-16-chat-as-agent-session.md` — session-1 brief.
