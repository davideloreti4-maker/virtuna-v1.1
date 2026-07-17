# Handoff — 2026-07-16 session: corpus PULL → chat-as-agent (one thread, all skills)

**This is the cold-start brief for the whole session. Read this first, then the two detail docs:**
- `docs/CHAT-AS-AGENT-2026-07-16.md` — the chat-as-agent dispatcher (▶ START HERE block = the next build)
- `docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` — the corpus PULL tool + chat reference mode (Option A)

---

## 0. One paragraph

We started at the grounding work, shipped a stranded parse fix, then followed the owner's steer into a
much bigger direction: **use the Qwen model to its full ability via function calling.** We proved
`qwen3.7-plus` reliably does tool-calling over the real corpus, built a flag-gated chat "reference mode"
(the model pulls proven examples on demand), then discovered the app is **already a unified
block-message thread** — every skill already posts its cards to one shared thread. That reframed the
owner's real vision (**chat as a single agent surface: type anything, it runs the right skill inline, in
one thread, context carried, no manual skill selector**) from a scary UI build into ~80% existing
architecture + a dispatcher. We built and **proved that dispatcher end-to-end**. Everything is committed
+ pushed, flag-off. The remaining work is **route integration** (wire the dispatcher into the live chat
route), which was deliberately left for a fresh session.

## 1. SHIPPED to main
- **PR #313 — MERGED** (`origin/main` = `42d8e779`, branch deleted). Template-JSONB parse fix: beat
  timings `.optional()` so 14/300 dropped corpus rows now parse; tsc-clean (fixed 4 carried errors).
  Standalone, independent of everything below.

## 2. PROVEN + committed — branch `spike/corpus-fn-tool` (tip `8ebcc84b`, pushed, FLAG-OFF)

This session's commits on that branch (newest first):

| commit | what |
|---|---|
| `8ebcc84b` | docs: START HERE pointer for next session |
| `05aeac76` | **chat-as-agent skill dispatch** — `skill-dispatch.ts` + spike + 6 tests |
| `28d460ac` | topical-whiff **fix** — reference-mode retrieval config |
| `a58a4551` | **chat reference-mode PULL (Option A)** — `corpus-tool.ts` + chat-runner wiring + tests |
| `30108c00` | corpus function-calling **spike** — proved qwen3.7-plus tool-calling |

(Below those sit the pre-session experiment lineage: `4acd7536`/`6d97fb8b`/`11b67f1f` = grounding
adapt-as-briefer + the ORIGINAL parse-fix commit. Note `11b67f1f`'s change also reached main via #313's
squash — reconcile on rebase. See §8.)

**What each delivers:**
- **Corpus PULL tool** (`src/lib/grounding/corpus-tool.ts`): `search_corpus` tool over the existing
  `retrieveCachedExamples`; `qwen3.7-plus` calls it on demand, self-corrects on a whiff, cites real
  sources. Honest receipts via `receipt()`. Its own recall-favoring **reference config** (cross-platform
  + low model-filtered floor) — fixed a topical whiff (breakfast: 0→5 rows). The generate-path floor is
  untouched.
- **Chat reference mode (Option A)**: flag `GROUNDING_CHAT_TOOL` (default OFF). OPEN chat runs a
  pre-flight pull, grounds the streamed answer. Persona/meet-mode excluded; degrade-safe (byte-identical
  fallback). Live-verified.
- **Chat-as-agent dispatcher** (`src/lib/tools/skill-dispatch.ts`): a general skill-tool registry (one
  entry per skill = schema + thin adapter to `runXPipeline`) + `runSkillDispatch` (model routes or
  abstains, `tool_choice:auto`) + a **paid-engine leash** (`maxSkillRuns`). **Live: routing 5/5** across
  generate_ideas/generate_hooks/write_script + correct abstain on pure-chat; a **real** `runIdeasPipeline`
  through the adapter → **4 real `idea-card` blocks**; closing co-pilot line chains skills. 6 hermetic
  tests.

Full grounding+runner suites green throughout (238); tsc clean on all new files.

## 3. THE VISION (owner's, locked)

One surface. Type in chat → it runs the right skill → the real cards render **inline in the same
thread** → context carries across every skill → the **skill selector becomes optional**. Citation split:
**skill services surface real receipts** (already built — card proof blocks); **general chat = light
attribution** (recommended, not yet wired).

## 4. KEY DISCOVERY — why this is cheap

The app is ALREADY a unified block-message thread:
- Messages are `{ role, blocks[] }`; `BLOCK_REGISTRY` has a type per skill (`idea-card`, `hook-card`,
  `script-card`, `markdown`, …), validated on write + rehydration.
- Every `/api/tools/<skill>` route already `insertMessage`s its blocks into the **same open thread**.
- `src/components/thread/message-blocks.tsx` already renders them.
- A co-pilot follow-up turn already glues runs conversationally.

→ The only missing piece is chat DISPATCHING to skills. No new rendering/persistence/message model.

## 5. NEXT STEPS (ranked)

1. **Route integration (the build).** Client-scout FIRST: how the chat thread client consumes the SSE +
   renders streamed blocks, and how skill-route clients do it. Then wire `runSkillDispatch` into
   `src/app/api/tools/chat/route.ts` behind a **default-off flag** — when the model runs a skill, stream
   its `stage`/`content`/`score` events and `insertMessage` its blocks (reuse the skill routes' code
   verbatim); closing text → a markdown message. Confirm `message-blocks.tsx` renders in the chat view.
2. **Generalize beyond generators.** simulate/predict/read/profile need a concept/analysis context, not
   just a topic → a second adapter shape. Do NOT force them through the generator adapter.
3. **Wire light attribution** in chat reference mode (owner decision below).
4. **Land the work as focused PRs** (§8 branch hygiene).

## 6. OPEN OWNER DECISIONS
- **Citation in general chat** — recommended: *light attribution* (name the source only when leaning on
  a specific structure). Not yet wired. Skill-service receipts already exist.
- **Retire the skill selector?** Keep it until the chat path is proven end-to-end — don't rip it out on
  faith.
- **Reference/generate honest gate** — the corpus PULL for *generation* still has no view-outcome signal;
  reference/inspire mode is gate-free (real evidence, no baseline claim) and is what shipped flag-off.

## 7. GOTCHAS / HOW-TO
- **Live scripts (DashScope/Supabase): sandbox-OFF, FOREGROUND.** The `rtk` sandbox silently drops
  network → looks hung. Scripts: `scripts/spike-corpus-fn-tool.ts`, `scripts/smoke-chat-corpus-pull.ts`,
  `scripts/spike-skill-dispatch.ts` (routing free; `SPIKE_REAL=1` for a paid ideas run). Need `.env.local`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` (NOT `npm test` — fake results).
- **Model:** `qwen3.7-plus` via DashScope OpenAI-compatible endpoint, `getQwenClient()`. Native function
  calling + parallel tool calls confirmed. We were using it single-shot (no tools) everywhere before.
- **Memory store blocked** from this worktree (path guard) — these repo docs ARE the durable record.
- **Flags (all default-off):** `GROUNDING_CHAT_TOOL` (chat reference pull), `GROUNDING_REF_MIN_SIMILARITY`
  (reference floor, default 0.4), plus the pre-existing `GROUNDING_HOOKS_*`.

## 8. BRANCH HYGIENE (before landing)
`spike/corpus-fn-tool` carries THREE distinct things + the pre-session experiment lineage. It is NOT a
merge candidate as-is. When landing, split into focused PRs off current `origin/main` (`42d8e779`):
(a) corpus PULL tool + chat reference mode (Option A) + topical fix; (b) chat-as-agent dispatcher +
route integration. Cherry-pick onto fresh branches off `origin/main` (as we did for #313), don't merge
the whole spike branch. Watch the `11b67f1f` parse-fix commit — its change already landed via #313, so
it'll show as already-applied on rebase.

## 9. DOC MAP
- **This file** — session cold-start.
- `docs/CHAT-AS-AGENT-2026-07-16.md` — dispatcher detail + ▶ START HERE (route integration).
- `docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md` — corpus PULL + Option A + findings (§8 = Option A status).
- `docs/DECISION-grounding-as-remix-2026-07-15.md` — the prior grounding-as-remix reasoning (three
  consumption modes §4d; this session is mode 2 = retrieve-to-cite/inspire made real via the tool).
