# Spike — corpus function-calling (the PULL model) works with qwen3.7-plus

**Date:** 2026-07-16 · **Status:** spike PASSED, direction validated · **Branch:** `spike/corpus-fn-tool`
**Context:** `docs/DECISION-grounding-as-remix-2026-07-15.md` §4d (three consumption modes over one corpus).
**Harness:** `scripts/spike-corpus-fn-tool.ts` (nothing mocked — real model, real pgvector, real corpus).

---

## 0. One paragraph

Everything in grounding today is **push**: the pipeline pre-retrieves a slice and injects it; the model
never chooses. The owner's reframe is **pull** — expose all 532 corpus rows to the model as a
`search_corpus` **tool** and let it query "if it wants or if it needs to." This spike wired that as a
thin wrapper over the existing `retrieveCachedExamples` primitive and ran a real `qwen3.7-plus`
agentic loop with `tool_choice: "auto"` (the honest test — the tool is only *invited*, never forced).
**Result: the model called the tool unprompted in 3/3 cases, 9 calls, 0 errors, and behaved like a
competent agent — self-correcting when retrieval whiffed and grounding every final hook in a real,
cited source.** The pull architecture is real, cheap, and works with the model we already run.

## 1. What we found NOT using the model's abilities

Before the spike: a `grep` for `tools:` / `tool_calls` / `tool_choice` / `function` across `src/lib`
returned **nothing**. Every engine call — generate, chat, SIM, decode/adapt — is a **single-shot chat
completion with no tools param.** We drive a function-calling, parallel-tool-call, agentic-capable
model (`qwen3.7-plus`, confirmed native function calling on the DashScope OpenAI-compatible endpoint we
already use) **as a plain text box.** The gap is wiring, not research.

## 2. The test

- **Tool:** `search_corpus({ query, axis })` → `retrieveCachedExamples({ query, platform, skill })`
  (`axis: structural → skill hooks` = format/shape across niches; `topical → skill ideas` = subject
  cosine). Returns the **whole decoded row** (spoken hook, hook template, narrative structure, the
  belief→reality tension, view multiplier + basis, creator) — the full anatomy, not the 1% slice.
- **Loop:** system prompt *invites* the tool for a chat-style hook-brainstorm task; `tool_choice:
  "auto"`, `temperature 0`, `enable_thinking: false`; execute `tool_calls` → feed rows back → continue
  (≤6 rounds). Parallel tool calls handled.
- **Mode:** reference/inspire (chat-style) — the **gate-free** mode (§4d), so a good result is directly
  shippable without a view-outcome signal.

## 3. The result

| Case (ask) | rounds | tool calls | rows? | final grounded in a real handle? |
|---|---|---|---|---|
| high-protein breakfast for busy people | 3 | 4 | yes (after topical whiff) | ✅ @sbonnot, @iamjadenly, @conor_harris_ |
| first 1000 followers as a creator | 3 | 2 | yes | ✅ @madisonknowsbest, @creatordigest, @iamjadenly |
| morning routine isn't making you productive | 4 | 3 | yes (after topical whiff) | ✅ @orate.x, @kieranmc_mahon, @metromedia.house |

**Summary:** called the tool unprompted **3/3**, **9 tool calls**, real rows returned **YES**, API/loop
errors **0/3**. Verdict: ✅ pull model works.

### The three behaviors that matter (not just "it fired")

1. **Unprompted + agentic.** `tool_choice: "auto"` — the model *chose* to search, every case, often
   more than once with different queries/axes.
2. **Self-correcting.** Case 1's first call was topical `"high protein breakfast busy morning"` → **0
   rows**. The model reasoned about the miss and switched to the **structural** axis → 5 rows, then
   refined twice more. Same pattern in case 3. This is the "reach again if you need to" behaviour, live.
3. **Grounded with real receipts.** Every final hook cited a real source + real multiplier pulled
   straight from the tool's rows — e.g. *"I don't get how people make protein breakfast so
   complicated"* ← @sbonnot **80×**; *"my #1 tip, and no it's not posting every day"* ←
   @madisonknowsbest **458×**. Unprompted **cross-niche transfer** (a posture-fix structure → a
   breakfast hook) — the remix asset, working.

## 4. What it settles vs leaves open

- **Settles:** the pull architecture is real and cheap (thin tool + loop); `qwen3.7-plus` is a capable
  agent over the corpus; the honesty spine (receipt travels with the row) survives. For **reference/
  inspire mode (chat · explore)** this is **directly shippable** — it hands the model real evidence, it
  does not claim to beat a baseline, so the honest gate does not apply.
- **Open (unchanged):** whether grounded *generate* output **performs** (gets views). Craft ≠ virality;
  no view data. That gate blocks the generate-and-claim path only, not reference mode.

## 5. 🔎 New finding — topical retrieval whiffed (0 rows) on 2/3 first-tries

Both topical first-attempts (`"high protein breakfast busy morning"`, `"morning routine productivity
myth"`) returned **0 rows**; the creator-growth topical query returned 5. The model routed around the
misses via structural, but in prod the model should not have to guess past empty topical hits. Likely
the topical `minSimilarity` floor is too strict (structural's floor is 0 by design). **Investigate
before leaning on topical pull** — see `resolveRetrieveConfig` / `RetrieveConfig.minSimilarity` in
`src/lib/grounding/retrieve.ts`.

## 6. Reproduce

```
npx tsx scripts/spike-corpus-fn-tool.ts      # FOREGROUND, sandbox OFF
```
🔴 **rtk sandbox silently drops DashScope/Supabase network** → node sits at 0% CPU, looks hung. Run
sandbox-off in the foreground. Needs `.env.local`: `DASHSCOPE_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
(+ URL). ~1–2 min for 3 cases.

## 7. Next

1. **Productize reference mode** — wire `search_corpus` into the chat (and explore) runner behind a
   default-off flag. Gate-free, just proved out. The loop pattern here is the template.
2. **Topical-whiff dig** (§5) — before the tool leans on topical retrieval in prod.
3. Later: the same tool serves the **generate** skills (hooks/ideas/script) — but that path stays
   behind the view-outcome gate. Do **not** route predict/simulate through it (§4d: they consume the
   corpus as a benchmark distribution, not via the tool).
