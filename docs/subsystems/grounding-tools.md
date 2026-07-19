# Subsystem: Grounding Tools (corpus-as-a-service)

> **DESIGN — not built.** Written 2026-07-19 from a verified prod audit + code trace,
> not from operating a live surface. Companion to `skills-grounding.md` (the SSOT for
> the existing skill-side grounding). This doc specifies how the chat agent gets
> direct, honest access to the corpus.

## 1. What it is (one paragraph)

The owner's goal: the chat agent should serve **any** grounded request — "show me
examples," "what formats work," "break down why this worked," "give me a visual
hook" — not just the three canned generation skills. Today the corpus
(`outlier_teardowns`, 524 usable rows) is reachable only through
hooks/ideas/script (`src/lib/grounding/retrieve.ts`), so every "show me / tell
me" request has no path. The design: expose the corpus as **three typed tools
behind one honesty contract**, and make the chat agent their first agentic
consumer. Guardrails move from per-skill to the tool boundary — every future
consumer inherits them for free.

## 2. Current state (verified 2026-07-19, prod `qyxvxleheckijapurisj`)

Retrieval today: embed ask → `match_shared_teardowns` RPC (pure pgvector cosine,
`20260710000000_grounded_generation_teardowns.sql:246-322`) → TS admissibility
(`retrieve.ts:376-382`) → skill-picked ranking (`RankStrategy` at
`retrieve.ts:49`: `structural` archetype-spread for hooks via `rank.ts:89-122`,
`topical` cosine-floor 0.5 for ideas/script). The RPC returns 22 fields; the
model sees `spoken_hook`, `hook_template`, `why_it_works`, `idea.*`,
`template.beats` (`prompt.ts:269-339`).

### Facet audit (532 rows; 524 extracted after the shell guard)

| Facet | State | Grade |
|---|---|---|
| `visual_hook` | 6 clean values, 98.5% — **holds the visual SETTING** (in-world-vlog 180 · studio-set 104 · greenscreen 81 · skit 70 · faceless 55) | ✅ day-1 |
| `editing_style` | 30 values, 98.5% (vlog-hybrid, greenscreen, office-yap, split-screen…) | ✅ day-1 |
| `format` | 20 values, balanced | ✅ day-1 |
| `hook_archetype` | 13 values, balanced | ✅ day-1 |
| `platform` | IG 333 / TT 177 / YT 22 | ✅ day-1 |
| content fields (spoken_hook, hook_template, why_it_works, idea.\*, template.\*) | 98.5%; 92% have ≥3 timed beats | ✅ day-1 |
| `outlier_multiplier` | 396 measured + **136 honestly-unmeasured** (raw `outlier_score=0` sentinel — deliberate null, NOT a bug; verified all 136 raw scores are exactly 0) | ✅ as-is |
| `niche` / `subniche` | was 100% NULL (no upstream field) — backfilled via `scripts/backfill-niche.ts` (17-label enum, deterministic: 3.7-plus temp 0 seed 7) | 🔧 backfilled |
| `embedding` | 100% | ✅ |
| `signature_series` (149 distinct free-text), `follower_count` (0%), `hook_source`/`extraction_tier`/`status` (constants) | — | ❌ not facets |
| raw `teardown` JSONB | 51 keys, 100% present; un-hoisted gold: `summary`, `structure_summary`, `supporting_evidence[]`, `format_reasoning` | ✅ for get_teardown |

Repairs shipped with this doc:
- `20260719120000_fail_shell_teardowns.sql` — 8 unextracted shells (embedding
  ghosts, all with raw `failure_reason`) moved to `status='failed'`; the existing
  RPC gate (`…:311`) now excludes them. Zero code.
- `scripts/backfill-niche.ts` — niche/subniche classification pass.

## 3. The three tools

Typed, small, composable. **No raw SQL access, ever.**

```ts
// 1. Retrieval — the existing pipeline exposed as a callable.
search_examples({
  query: string,                  // topic/subject; embedded for cosine match
  intent: "hook" | "idea" | "structure" | "visual" | "reference",
                                  // picks ranking axis + which fields render
  facets?: {                      // optional post-RPC or RPC-level filters
    platform?, format?, hookArchetype?, visualSetting?, editingStyle?, niche?
  },
  proofFloor?: number,            // min outlier_multiplier; default 3 for "proven" language
  limit?: number                  // default 5, max 12
}) → { grounded: boolean, examples: RetrievedExample[] }

// 2. Aggregation — the "what's working" answer machine. New capability.
corpus_stats({
  groupBy: "format" | "hook_archetype" | "visual_setting" | "editing_style"
         | "platform" | "niche",
  facets?,                        // same filter shape
  proofFloor?: number,
  minN?: number                   // REFUSAL floor, default 8: below it a cell is not reported
}) → { grounded: boolean, cells: {label, n, medianMultiplier, medianViews}[] }

// 3. Point lookup — "break this down."
get_teardown({ id: string })
  → full honest render: facets + receipt + beats + summary + structure_summary
    + supporting_evidence + format_reasoning  (reads raw JSONB directly; no hoisting)
```

Later, the same interface extends over `personal_teardowns` ("show me MY best
hooks") — `matchPersonalTeardowns` (`corpus.ts`) is the existing socket with no
producer.

### Plumbing deltas required
- RPC: add `visual_hook`, `editing_style`, `niche` to the returned columns +
  optional filter params (`filter_format`, `filter_visual`, `filter_editing`).
  One migration; `filter_niche`/`filter_archetype`/`filter_platform` already exist.
- `SharedMatchRow` (`corpus.ts:243-275`) + `RetrievedExample`
  (`retrieve.ts:286-312`): carry the new fields.
- **Naming honesty:** expose `visual_hook` as `visualSetting` in tool schemas —
  it is a setting/layout taxonomy, not a first-frame device
  (`types.ts:94-112`). A "visual hook" answer is COMPOSED from setting +
  editing_style + beat 1 of `template.beats` — all present today.

## 4. The `references` block

Retrieved rows render as proof cards **from structured tool output, not model
prose** — the model cannot hallucinate a citation, same pattern as thread cards
(`docs/subsystems/ui-skill-cards.md`). Card = hook line / format + facet chips +
receipt (`views`, `{n}×`, `baseline_label` — which is `vs their usual views`,
NOT views÷followers) + creator handle + link. Multiplier badge display-capped
(corpus max is 20,154× — render `>100×`).

## 5. The honesty contract (at the tool boundary)

1. Only admissible rows return (status gate + shells failed + TS admissibility).
2. Every example carries its receipt; `proof_captured_at NULL` = evergreen.
3. Empty/weak retrieval → `grounded:false` → agent must degrade honestly.
   **Gate on `grounded`, never on `proof`** (locked rule, PR #287).
4. Warrant-vs-claim in the agent system prompt: ≥3× on ≥3 examples = "proven";
   one example = "one example"; below `proofFloor` = craft reference, never proof.
5. `corpus_stats` refuses cells below `minN` — no insight theater over 4 rows.
6. `allowScrape` stays false; fresh data flows only through the explicit
   "Find new outliers" offer pattern (server decides availability, user
   authorizes — PR #322/#323).

## 6. Integration fork — ✅ DECIDED: native tool loop (spike passed 2026-07-19)

Chat today routes-and-reloads (`skill-capabilities.ts` action protocol). Tools
need results to come **back mid-turn**.

**`scripts/spike-tool-loop.ts` ran three arms against the LIVE corpus
(qwen3.7-plus, temp 0, seed 7, real embed → real RPC): all PASS.**

- **A — round-trip:** emitted valid `tool_calls`, and refined unprompted
  (called twice: "fitness" then "workout") — multi-hop that prefetch cannot do.
  Used the niche enum + platform filter correctly. Final answer enforced
  warrant-vs-claim from the system prompt alone: "PROVEN (≥3×)" vs "one
  example — no baseline, not proof", citing only returned rows.
- **B — honest degrade:** on an absurd topic the model refused to fabricate
  proof and labeled its craft advice ungrounded. See the §8 finding this
  exposed — the save came from model judgment, which the contract must not
  rely on.
- **C — streaming:** `delta.tool_calls` assembled cleanly (371 chunks, FOUR
  parallel tool calls in one round), streamed final composition. The chat
  integration path is real.

Latency: 24–52s per full loop (2–4 sequential tool executions, each embed +
RPC). Fine under the chat progress spine; parallelize tool executions server-side.

The detect-and-prefetch fallback is **discarded**.

## 7. Sequencing

1. ✅ Shell guard migration + niche backfill (PR #335)
2. ✅ Tool-loop spike (`scripts/spike-tool-loop.ts`) — PASS ×3, §6 decided
3. RPC migration (new returned columns + filter params) + `SharedMatchRow` widening
4. `search_examples` + `references` block, E2E on one intent ("show me examples of…")
5. `corpus_stats` + insight card
6. `get_teardown` + teardown card
7. Converge: hooks/ideas/script retrieval becomes `search_examples` calls —
   one pipeline, one contract

## 8. Open questions

- ~~Chat model tool-calling reliability on DashScope~~ — ✅ verified, §6.
- 🔴 **Spike finding — `grounded` must be COMPUTED, not inferred.** Cosine
  always returns something: arm B got 5 tangential rows at ~0.5 similarity and
  the naive `grounded = examples.length > 0` said true; only the model's
  judgment kept the answer honest. `search_examples` v1 must enforce a
  relevance floor at the tool boundary (reuse the skills' `minSimilarity`
  machinery, `retrieve.ts:149`) and return `grounded:false` below it.
- **Spike finding — the model is only as honest as the interface is
  expressive.** Arm C asked for greenscreen examples; the corpus HAS them
  (`editing_style`: visual-greenscreen 60 + notes-article-greenscreen 17) but
  the spike tool didn't expose that facet, so the model reported "no
  greenscreen tag". The RPC facet migration (§7 step 3) is what makes facet
  questions answerable.
- Facet filters at RPC level vs TS post-filter: RPC-level shrinks the vector
  candidate pool under a filter (good: no "20 results, 19 inadmissible" holes);
  TS-level avoids a migration. Default: RPC-level for the 3 high-selectivity
  facets, TS for the rest.
- `corpus_stats` on 524 rows: several format×platform cells are already <8.
  Refusal message copy ("not enough proven examples in this slice") needs a
  design pass with the no-source note voice.
- Does `intent:"visual"` need its own renderer or is it a `search_examples`
  render variant? (Leaning: render variant — setting + editing + beat-1.)

## 9. Instrument notes (why this doc trusts what it trusts)

- The signal audit's headline "multiplier projection bug — backfill 136 rows"
  was **false**: all 136 raw scores are exactly 0 (Sandcastles' not-computed
  sentinel); the NULLs are the honesty guard working as designed
  (`20260714120000_normalize_curated_teardowns.sql`). Killed by one
  verification query before a wrong migration was written. Verify subagent
  claims with a query before acting on them.
- An earlier session-level claim that `visual_hook` held "garbage" was also
  wrong: the data is clean and well-distributed — it is *mislabeled* (a
  setting, not a device). The fix is naming, not re-extraction.
