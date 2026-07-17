# Handoff — 2026-07-16 (session 2): chat-as-agent ROUTE INTEGRATION wired

**Cold-start brief for the next session. Read this first, then the two detail docs:**
- `docs/CHAT-AS-AGENT-2026-07-16.md` — dispatcher + route integration detail. **§4a = what shipped,
  §4b = the ranked next work, ▶ START HERE block at the top.**
- `docs/HANDOFF-2026-07-16-chat-as-agent-session.md` — the PRIOR session's brief (dispatcher spike +
  corpus PULL). Still the source for the corpus-tool half of this branch.

---

## 0. One paragraph

Last session proved the chat-as-agent dispatcher (type in chat → the model runs the right skill → real
cards in one thread) and left ROUTE INTEGRATION for a fresh session. **This session wired it.**
`runSkillDispatch` is now plumbed into the live `/api/tools/chat` route behind a **default-off flag
`CHAT_AGENT_DISPATCH`**, across three layers (server dispatch branch → client transport → render). A
chat turn now runs a skill and its real card-blocks stream + persist into the SAME thread, no manual
skill selector. Committed + pushed, flag-off. What's left is the REACH work (reload fidelity, non-
generator skills, light attribution, a live browser run) — see §4b of the detail doc.

## 1. STATE

- **Branch:** `spike/corpus-fn-tool`, tip **`dc1e06dd`**, pushed (local == `origin/spike/corpus-fn-tool`).
- **`origin/main` = `42d8e779`** (parse-fix PR #313, from last session).
- **All flags default-OFF.** New flag this session: `CHAT_AGENT_DISPATCH`.
- **Tests:** 423 green across the four touched areas; **tsc clean** (the 4 remaining tsc errors are
  pre-existing in `src/lib/grounding/` — confirmed on the committed tip, NOT from this work).

## 2. What shipped this session — commit `dc1e06dd`

`feat(chat): route integration — chat dispatches skills into one thread behind CHAT_AGENT_DISPATCH`

Wiring across three layers (320 lines):
- **Server** (`src/app/api/tools/chat/route.ts`): open chat only (persona/meet EXCLUDED). Flag on →
  the turn goes through `runSkillDispatch`. If a skill ran: each card streams as `event: block` + is
  `insertMessage`d into THIS thread; the co-pilot closing line streams as a `token` + persists as a
  markdown message; `stage` events ride the skill's real `onStage`. If NO skill ran → falls through to
  the existing grounded `runChatPipeline` (pure chat NOT degraded). Flag OFF → byte-identical. Reader:
  `isChatAgentDispatchEnabled()`.
- **Transport** (`src/hooks/queries/use-chat-stream.ts`): consumes `block` + `stage` into ordered
  `streamingBlocks` / `stages`, alongside the existing token/meta/done/error handling.
- **Render** (`src/components/thread/chat-thread-view.tsx` + composer prop `streamingCardBlocks`): the
  streamed cards render through the EXISTING `MessageBlocks` (a renderer per card type). Proven a real
  idea-card renders inside the chat view.

Tests added: +5 route tests (skill-ran, no-skill fallback, flag-off gate, persona bypass) in the chat
route test; new `src/hooks/queries/__tests__/use-chat-stream.test.ts`; new
`src/components/thread/__tests__/chat-thread-view.test.tsx`.

**Key design decisions (mine):**
- **Separate flag** `CHAT_AGENT_DISPATCH` (independent of `GROUNDING_CHAT_TOOL` — different levers).
- Streamed a general **`event: block`** (full validated card) rather than the ideas route's
  `content`+`score` two-phase emit — the two-phase shape is generator-specific; one block event is the
  GENERAL fit and is where §4b's non-generator skills will land. `stage` events are reused as-is.
- **Pure-chat cost:** flag-on plain-chat turns make one thin dispatch-detection call before the grounded
  answer. Deliberate (don't degrade grounded chat); optimizable later.
- Paid-engine leash unchanged (`runSkillDispatch`'s `maxSkillRuns`, default 2).

## 3. NOT yet done / honest gaps

- **No live flag-on browser run** against real DashScope+Supabase. The dispatcher itself was
  live-proven last session; the NEW plumbing is deterministic + fully test-covered, but a real
  end-to-end session is owner-auth-gated (Supabase login) and spends the paid engine.
- **Reload fidelity gap (by design):** live streaming shows dispatched cards in the CHAT view, but on
  reload the composer's `loadPersistedBlocks` splits persisted blocks by TYPE into per-tool buckets and
  restores `activeTool` to the last card type → a chat-run ideas set reappears in the IDEAS view, not
  chat. True "one thread on reload" needs a unified persisted-block render.

## 4. NEXT STEPS (ranked — detail in `docs/CHAT-AS-AGENT-2026-07-16.md` §4b)

1. **Reload fidelity.** Stop segregating persisted blocks by tool; render the thread as one ordered
   block stream in the chat view (bigger composer refactor). This is what makes "one thread" true on
   reload, not just live.
2. **Generalize beyond generators.** simulate/predict/read/profile need a concept/analysis context, not
   just a topic → a SECOND adapter shape in `SKILL_TOOLS` (`src/lib/tools/skill-dispatch.ts`). Do NOT
   force them through the generator adapter. The `event: block` transport already generalizes.
3. **Wire light attribution** in general chat (owner decision — still unwired).
4. **Live proof:** run the flag-on flow in a real browser (owner-auth-gated).
5. **Product call:** retire the skill selector or keep it as a shortcut. **Keep it until the flag-on
   path is proven in prod.**

## 5. GOTCHAS / HOW-TO

- **Enable the feature:** set `CHAT_AGENT_DISPATCH=true` in the env (`.env.local` for dev). Off by
  default everywhere.
- **Live scripts (DashScope/Supabase): sandbox-OFF, FOREGROUND** (`npx tsx …`). The `rtk` sandbox
  silently drops network → looks hung. Existing scripts: `scripts/spike-skill-dispatch.ts` (routing
  free; `SPIKE_REAL=1` for a paid ideas run), `scripts/smoke-chat-corpus-pull.ts`,
  `scripts/spike-corpus-fn-tool.ts`. Need `.env.local`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` (NOT `npm test` — fake results).
- **Model:** `qwen3.7-plus` via DashScope (`getQwenClient()`), native function calling.
- **Memory store BLOCKED** from this worktree (path guard) — these repo docs ARE the durable record.
- **Flags (all default-off):** `CHAT_AGENT_DISPATCH` (chat runs skills), `GROUNDING_CHAT_TOOL` (chat
  reference-mode corpus PULL), `GROUNDING_REF_MIN_SIMILARITY` (reference floor, default 0.4), plus the
  pre-existing `GROUNDING_HOOKS_*`.
- **Auto-push hook** silent-fails on non-fast-forward — verify the remote tip after a commit.

## 6. BRANCH HYGIENE (before landing — unchanged from prior handoff §8)

`spike/corpus-fn-tool` carries THREE distinct things + the pre-session experiment lineage. NOT a merge
candidate as-is. When landing, cherry-pick focused PRs off current `origin/main` (as done for #313):
(a) corpus PULL tool + chat reference mode (Option A) + topical fix; (b) chat-as-agent dispatcher +
route integration (this session). Watch the `11b67f1f` parse-fix commit — already landed via #313, will
show as already-applied on rebase.

## 7. DOC MAP

- **This file** — session-2 cold-start.
- `docs/CHAT-AS-AGENT-2026-07-16.md` — dispatcher + route integration (§4a done, §4b next, START HERE).
- `docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` — corpus PULL + Option A + findings.
- `docs/HANDOFF-2026-07-16-chat-as-agent-session.md` — prior session's brief.
- `docs/DECISION-grounding-as-remix-2026-07-15.md` — the prior grounding-as-remix reasoning.
