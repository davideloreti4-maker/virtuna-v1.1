# HANDOFF — Grounding corpus-as-a-service: build `search_examples` in chat

> 2026-07-19. Previous session shipped the foundation (3 PRs, all merged, all
> prod-verified). A fresh session starts HERE and builds §7 step 4: the first
> user-visible tool. **SSOT for the architecture: `docs/subsystems/grounding-tools.md`**
> — this file is the cold-start map, not a replacement.

## 1. Mission (owner-locked)

The chat agent serves **any** grounded request — "show me examples," "what
formats work," "break this down" — by calling **three typed tools behind one
honesty contract**. Not raw corpus access, not more canned skills. Guardrails
live at the tool boundary; references render from structured tool output so
the model cannot hallucinate a citation.

## 2. What is DONE and live (do not redo)

| Piece | PR | State |
|---|---|---|
| Shell guard — 8 content-free ghosts `→ status='failed'` | #335 | prod: 524 extracted / 8 failed |
| Niche backfill — 17-label enum + free subniche | #335 | prod: 524/524 labeled (`scripts/backfill-niche.ts`) |
| Tool-loop spike — qwen3.7-plus drives the corpus via `tools` | #336 | 3/3 PASS (`scripts/spike-tool-loop.ts`); **prefetch fallback DISCARDED** |
| Facet RPC — visual/editing returned + format/visual/editing filters | #338 | prod-applied, live-verified (8/8 exact-style probe; 0-row probe cross-checked vs direct count) |

Corpus: 524 usable rows, 100% embedded, all facets clean. Day-1 facet set:
platform · niche (17) · format (20) · hook_archetype (13) · visual_hook (6,
**the visual SETTING — expose as `visualSetting`, never "device"**) ·
editing_style (30).

## 3. NEXT — §7 step 4, the vertical slice

Build, in order:

1. **`search_examples` tool module** (new, likely `src/lib/grounding/tools/`):
   typed input `{query, intent, facets?, proofFloor?, limit?}` → embed
   (`embedQueryText`) → `matchSharedTeardowns` (all facet filters now exist) →
   **computed `grounded`**: similarity floor at the tool boundary (reuse the
   `minSimilarity` machinery, `src/lib/grounding/retrieve.ts:149`; skills use
   0.5). 🔴 Spike finding: cosine ALWAYS returns something — `length > 0` lied
   on an absurd query (5 tangential ~0.5-sim rows) and only model judgment
   saved the answer. `grounded:false` must be computed, never inferred.
2. **Tool loop in the chat agent**: the spike's loop
   (`scripts/spike-tool-loop.ts` — assemble `delta.tool_calls` by index,
   append `role:"tool"` results, re-call until `stop`, cap rounds) ports into
   the chat streaming route. The chat agent subsystem was deliberately NOT
   mapped this session — locate it via `skill-capabilities.ts` + the /home
   chat route (PR #331 context; memory `chat-as-agent-premium-pass.md`).
   Execute parallel tool calls concurrently server-side (spike observed 4 in
   one round; sequential cost 52s).
3. **`references` block**: retrieved rows → proof cards from STRUCTURED tool
   output (thread-card pattern, `docs/subsystems/ui-skill-cards.md`; check
   `/dev/cards` first). Receipt = views + `{n}×` + `baseline_label`
   (`vs their usual views` — NOT views÷followers; follower_count is empty
   corpus-wide). Display-cap the multiplier badge (corpus max 20,154×).
4. **E2E gate on ONE intent**: "show me examples of …" through the real chat,
   authed, cards rendered. The system prompt carries warrant-vs-claim
   (≥3× on ≥3 examples = "proven"; below = "one example") — the spike's SYSTEM
   block is a working draft.

Then (later sessions): `corpus_stats` (minN refusal ≥ 8 — several cells are
already thinner), `get_teardown` (reads raw JSONB directly; 51 keys, all
present), converge the 3 gen skills onto the tool layer.

## 4. Gotchas that already bit once

- **`npm test` prints FAKE results** — run `node ./node_modules/vitest/vitest.mjs run src/lib/grounding` (128/128 green at handoff).
- **tsc baseline**: only `src/lib/brain/__tests__/cortex-field.test.ts` errors, PRE-EXISTING on main (brain lane) — not yours.
- **RPC changes need DROP + CREATE** with the exact old signature — added params create an OVERLOAD under `CREATE OR REPLACE`; re-apply `VOLATILE` + `hnsw.iterative_scan strict_order` + the db-hygiene §5 `search_path` pin (pattern: `supabase/migrations/20260719150000_match_rpc_facets.sql`).
- **Pin exact RPC payloads in tests** (`corpus-rpc-params.test.ts`) — `objectContaining` cannot catch a dropped param.
- **DashScope content filter** rejects whole batches (`data_inspection_failed`, ~85s each) — bisect, don't retry (pattern in `scripts/backfill-niche.ts`).
- **Verify subagent claims with a query before acting** — a plausible "projection bug" this session was refuted by one SELECT (the 136 null multipliers are a deliberate honesty sentinel, raw scores all 0).
- Migrations were applied to prod via MCP `apply_migration` AND committed to the repo — keep both in lockstep.
- Grounding flags for the 3 gen skills remain **OFF in prod** (owner's honest-gate call, separate lane) — the tool layer is a NEW consumer and does not depend on them.

## 5. Key files

- `docs/subsystems/grounding-tools.md` — architecture SSOT (§3 tool schemas · §5 contract · §6 spike verdict · §8 findings)
- `src/lib/grounding/corpus.ts` — `SharedMatchRow` + `matchSharedTeardowns` (all filters)
- `src/lib/grounding/retrieve.ts` — floors/admissibility to reuse; `embedder.ts` — `embedQueryText`
- `scripts/spike-tool-loop.ts` — the working tool loop + system prompt draft
- `src/lib/engine/qwen/client.ts` — `getQwenClient` / `QWEN_REASONING_MODEL` / `QWEN_SEED`
- Memory: `grounding-corpus-as-a-service.md`
