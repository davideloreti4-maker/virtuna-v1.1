# Subsystem: Grounding Tools (corpus-as-a-service)

> **PARTLY BUILT — and more of it was already shipped than this doc originally knew.**
> Written 2026-07-19 from a verified prod audit + code trace, not from operating a live
> surface. Companion to `skills-grounding.md` (the SSOT for the existing skill-side
> grounding). This doc specifies how the chat agent gets direct, honest access to the corpus.
>
> ⚠️ **Correction, 2026-07-20.** The original header said "DESIGN — not built", and the
> step-4 handoff told the next session to build `search_examples`, a chat tool loop, and a
> references block from scratch. All three already existed and two were live in production:
> `src/lib/grounding/corpus-tool.ts` (the tool, as `search_corpus`),
> `src/lib/tools/chat-agent-loop.ts` (the loop), and `buildReferenceBlock` (prose form) —
> shipped 2026-07-17, `GROUNDING_CHAT_TOOL` **defaults ON**. The design was written from an
> audit of the *corpus* and never traced the *consumer*; the handoff flagged that gap
> honestly ("the chat agent subsystem was deliberately NOT mapped") and the gap was
> load-bearing. **Trace the consumer before specifying a producer.**

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
7. One definition of the contract: `src/lib/grounding/warrant.ts`, imported by both the chat
   tool and the generation runners (step 8 below). Three axes — topical (cosine ≥ warrant
   floor), structural (curation), provenance (extracted, no cosine to state) — and the axis is
   **declared by the caller**, because an absent `similarity` means "retrieval misbehaved" out
   of the cache and "never matched, by design" out of the scraper.

### ⚠️ Flag names (they do not mean what they look like)

| Var | Read by | Default | What it does |
|---|---|---|---|
| `GROUNDING_CHAT_TOOL` | `api/tools/chat/route.ts` | **ON** (`!== "false"`) | Kill-switch for the live streaming agent loop. |
| `GROUNDING_CHAT_PREFLIGHT` | `chat-runner.ts` | OFF | Revives the **superseded** blocking pre-flight pull. |
| `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED` | the three runners | OFF | The paid generation path. Unset in Vercel. |

`GROUNDING_CHAT_TOOL` is an **off**-switch, not an on-switch — chat grounding has been live
since 2026-07-17. Until 2026-07-20 `chat-runner.ts` read that same var with the opposite default
(`=== "true"`), so setting it to `"true"` — the intuitive "turn grounding on" — revived the dead
pre-flight *on top of* the live loop: two corpus pulls and an extra blocking model call per
message. Renamed to `GROUNDING_CHAT_PREFLIGHT`; nothing sets it.

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
3. ✅ RPC facet migration (PR #338) — visual_hook/editing_style returned;
   filter_format/filter_visual/filter_editing accepted; exact-payload guard
   (`corpus-rpc-params.test.ts`); prod-applied + live-verified
4. Retrieval tool in chat — ✅ **shipped 2026-07-17**, discovered 2026-07-20 (see the
   header correction). `search_corpus` (query + axis) bound into the streaming agent
   loop, flag default-ON. It shipped without the honesty machinery below.
4b. ✅ **Warrant + facets (2026-07-20).** Closed the two holes the spike had already
   found in the shipped tool:
   - `grounded` is now **computed** from measured cosine at a WARRANT floor
     (`GROUNDING_WARRANT_MIN_SIMILARITY`, default 0.5) that is deliberately distinct
     from the recall floor (0.4). Recall decides what the model *sees*; warrant decides
     what it may *cite*. `RetrievedExample.similarity` carries the measurement out of
     retrieval; only `citable` rows reach a reference block. Structural batches are
     warranted on SHAPE with an explicit "never as topic evidence" note.
   - Facet filters (#338) now have callers: pushed down to the RPC via
     `RetrieveInput.facets`, exposed to the model as **enums of the real stored
     vocabulary** (platform · format · hook_archetype · visual_setting · editing_style
     · niche). Live-verified: `scripts/smoke-corpus-warrant.ts`, 6/6.
   - Corpus calls in a round execute concurrently; warrant-vs-claim stated in the agent
     directive.
5. ✅ **`references` as structured CARDS + authed E2E (2026-07-20).** The `corpus-references`
   block renders the tool's own rows through `ProofReceipt`, so handles, multipliers and view
   counts are DATA — the model writes the argument, the card carries the evidence. Enforced at
   the boundary: an ungrounded search emits **no block** (a source card is itself a relevance
   assertion, so prose degrades and cards don't get to); topical vs structural headers make
   different claims; a curated row with no measured multiplier states no number; blocks persist,
   or the citation would vanish on reload while the prose citing it stayed.
   - **Layout rule, found by LOOKING at it twice:** the GROUP states what its rows share, a ROW
     states only what its siblings don't. The group's claim per-row printed "REAL EXAMPLE" ×3
     under a header that had just said "3 real videos"; the row's own facets then printed
     "GREENSCREEN" ×3 under a greenscreen FILTER. A facet that is already a filter is redundant
     by construction — skip it, keep the axis that varies.
   - **E2E PASSED, live + authed:** "show me real examples of greenscreen videos that actually
     worked" → the model called `search_corpus` with `platform=tiktok · visual_setting=greenscreen
     · niche=comedy-entertainment` (it reaches for the new facet params unprompted), the card
     rendered a real row (@bentellect · 3.0M views · working source link) showing **no
     multiplier** because that row is unmeasured, and the prose stayed honest about the thin
     result: "the corpus only returned one that matched all filters tightly".
6. `corpus_stats` + insight card (minN refusal ≥ 8; several cells are already thinner than
   that, and the refusal copy needs a design pass in the no-source-note voice)
7. `get_teardown` + teardown card
8. ✅ **Converge — the shared warrant contract (2026-07-20).** `src/lib/grounding/warrant.ts`
   is now the ONE definition of "may this be cited / called proven"; `corpus-tool.ts` (chat)
   and `gather-for-run.ts` (hooks/ideas/script) both import it. The runners' inlined
   `groundingExamples.length > 0` is gone — they take `grounded` off the gather result.
   - 🔴 **A two-axis lift would have shipped a regression, and no existing test would have
     caught it.** Scraped rows carry `similarity: null` by design (`orchestrator.ts` — never
     matched against a query, so no cosine exists). Judged topically that reads as onSubject 0
     → ungrounded, so a paid **"Find new outliers"** run would have rendered its real,
     proof-gated outliers as *not grounded*. Every scrape-path fixture in
     `gather-for-run.test.ts` carried `similarity: 0.71`, so the suite would have stayed green.
     Hence a **third axis, `provenance`**: warranted by search-by-subject + the outlier proof
     gate, stating the closeness is unquantified rather than implying it was measured.
   - **The axis is DECLARED by the caller, never inferred from the rows.** The first cut
     sniffed provenance from `measured === 0` and #342's "absent is not passing" guard caught
     it within one run: out of the corpus cache a null similarity is a *malfunction*, not a
     provenance signal, and the inference would have handed a broken chat batch the same
     warrant as a paid scrape. Same null, opposite meanings — only the caller knows which.
   - **Behaviour is otherwise unchanged by construction:** ideas/script retrieve at a 0.5 floor
     that already equals the warrant floor, and hooks' structural axis grounds on rows alone —
     so all three keep their current verdicts, now for a stated reason instead of a coincidence.
   - Guards: `warrant.test.ts` (16) + 5 in `gather-for-run.test.ts`, verified RED against both
     a two-axis lift and a no-provenance-branch build before landing.

**Deferred out of step 8, with the evidence:**

- **Facets for ideas/script — BLOCKED on a vocabulary bridge, do not just wire it.** The plan
  said "a creator's niche/platform/format are known at run time, so filter on them." Measured
  against prod: `creator_profiles.niche_primary` uses the `NICHE_TREE` taxonomy (`beauty`,
  `fitness`, `education`, and the only real value in prod today, `comedy`) while
  `outlier_teardowns.niche` uses the corpus enum (`beauty-fashion`, `health-fitness`,
  `education-science`, `comedy-entertainment` ×69). Passing one as the other filters to **zero
  rows** and silently ungrounds the paid path — the exact greenscreen failure `corpus-tool.ts`
  warns about, reintroduced. Needs an explicit `NICHE_TREE → NICHES` map first.
  ⚠️ Also note `filterPlatform: false` was a deliberate owner call (2026-07-17); passing
  `facets.platform` from the runner would silently reverse it.
- **Hooks' `grounded` semantics — examined, deliberately UNCHANGED.** Hooks retrieves at
  `minSimilarity: 0`, so `grounded` is near-always true and means something weaker than it does
  in chat. That asymmetry never becomes a false claim: an attributed card renders `ProofReceipt`
  whose eyebrow is already **"Proven structure"** — the structural claim, correct for hooks —
  and an unattributed one renders `NoSourceNote`, which claims nothing. Raising the floor would
  delete the cross-subject transfer it was lowered to permit and buy no honesty the renderer
  wasn't already providing.

> **▶ NEXT — step 6 (`corpus_stats`) or the niche bridge.** Step 8's contract has landed, so the
> remaining converge value is the bridge above. Both are gated on the same open decision: the
> gen-skill grounding flags (`GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED`) are **not set in Vercel**
> (owner, 2026-07-20 — work locally with them on), so the paid grounded path is still not one
> users hit in prod.

## 8. Open questions

- ~~Chat model tool-calling reliability on DashScope~~ — ✅ verified, §6.
- ~~🔴 **Spike finding — `grounded` must be COMPUTED, not inferred.**~~ ✅ **CLOSED
  2026-07-20** (§7 step 4b). Cosine always returns something: arm B got 5 tangential rows
  at ~0.5 similarity and the naive `grounded = examples.length > 0` said true; only the
  model's judgment kept the answer honest. Now enforced at the tool boundary with a
  warrant floor separate from the recall floor. Live-verified: the absurd ask returns 5
  rows at `grounded:false`.
- ~~**Spike finding — the model is only as honest as the interface is
  expressive.**~~ ✅ **CLOSED 2026-07-20.** Arm C asked for greenscreen examples; the
  corpus HAS them (`editing_style`: visual-greenscreen 60 + notes-article-greenscreen 17,
  plus 81 rows whose `visual_hook` setting IS greenscreen) but the tool didn't expose the
  facet, so the model reported "no greenscreen tag". The RPC migration (#338) made it
  *possible*; step 4b gave it callers and enum-constrained schema params, which made it
  *actual*. A shipped migration with no caller changes nothing — check for consumers, not
  just for columns.
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
