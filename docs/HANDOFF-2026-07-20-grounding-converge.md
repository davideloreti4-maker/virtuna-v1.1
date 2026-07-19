# HANDOFF — Grounding: converge the generation skills onto the tool contract

> 2026-07-20. Two PRs merged this session (#342, #344); the chat side of
> corpus-as-a-service is done and live-verified. **SSOT for the architecture:
> `docs/subsystems/grounding-tools.md`** — this file is the cold-start map.
>
> ⚠️ **Read §0 before you build anything.** The previous handoff sent a session to build
> three things that already existed, two of them live in production. That failure is the
> reason this file leads with a verification step instead of a task list.

## 0. Verify before you build (the lesson that cost a session)

The last handoff was written from an audit of the corpus and never traced the *consumer*.
It said "build `search_examples`, a chat tool loop, a references block." All three existed;
`GROUNDING_CHAT_TOOL` had defaulted **ON since 2026-07-17**. A 30-second grep would have
caught it.

So, first three commands of the next session:

```bash
grep -rn "gatherCorpusForRun\|retrieveCachedExamples" src --include='*.ts' | grep -v __tests__
grep -rn "GROUNDING_" src --include='*.ts' | grep -v __tests__ | grep "process.env"
gh pr list --state merged --limit 8
```

**Trace the consumer before specifying a producer. Check a migration for callers, not for
columns.** (#338 shipped facet filters that had *zero* callers for a day — the capability
existed and changed nothing until #342 wired it.)

This applies to THIS document too. Everything below was verified on 2026-07-20; verify it
again rather than trusting it.

## 1. What is done and live

| Piece | PR | State |
|---|---|---|
| Shell guard · niche backfill | #335 | prod 524 extracted / 8 failed; 524/524 labeled |
| Tool-loop spike (prefetch discarded) | #336 | 3/3 PASS vs live corpus |
| Facet RPC (returns + filters) | #338 | prod-applied, live-verified |
| **Computed `grounded` + facet params + concurrent calls** | **#342** | `41fa951b` |
| **Citations as cards + authed E2E** | **#344** | `6aa74b90` |

Chat is the corpus's first honest consumer. `search_corpus` computes a **warrant** (not a
row count), exposes six facet filters as enums of the real stored vocabulary, and emits a
`corpus-references` card built from the tool's own rows. An ungrounded search emits **no
card** and the model is instructed to say it has nothing.

Live E2E (authed, real chat): *"show me real examples of greenscreen videos that actually
worked"* → model called `search_corpus` with `platform=tiktok · visual_setting=greenscreen
· niche=comedy-entertainment` **unprompted**, card rendered `@bentellect` · 3.0M views ·
working link · **no multiplier** (that row is unmeasured), prose stayed honest about the
thin result.

## 2. NEXT — converge (doc §7 step 8, promoted above step 6)

**The sequencing doc lists `corpus_stats` (step 6) next. I recommend step 8 instead**, and
the reasoning is in §4. If the owner prefers stats, that path is sketched in §5.

### 2.1 What converge actually means — scoped honestly

There are now **two grounding paths that share a retrieval function but not a contract**:

| | Chat tool (`corpus-tool.ts`) | Generation skills (`gather-for-run.ts`) |
|---|---|---|
| Entry | `executeCorpusSearch` | `gatherCorpusForRun` (hooks/ideas/script runners) |
| Retrieval | `retrieveCachedExamples` | `retrieveCachedExamples` — **same fn** |
| Floor | recall 0.4, **warrant 0.5 computed separately** | floor applied *inside* retrieval (0.5 topical / 0 structural) |
| Facets | six, model-selectable | **none — not plumbed** |
| "Grounded" | computed warrant + `citable` subset | `groundingExamples.length > 0` (`hooks-runner.ts:752`) |
| Citation | structured card | `ProofReceipt` via `sourceIndex` attribution |

🔴 **A claim I nearly put in this handoff and had to retract — do not repeat it.** I was
about to write that the paid skills carry the same `length > 0` bug the tool just fixed.
**They do not.** Their floor is applied *inside* `retrieveCachedExamples` via
`config.minSimilarity`, so by the time rows reach `length > 0` they have already cleared
0.5 (topical). The inference is sound *there* because the gate ran earlier.

The one place worth a hard look: **hooks runs structural with `minSimilarity: 0` and a
2000-row pool** (`retrieve.ts` `resolveRetrieveConfig`), so `length > 0` is essentially
always true → a hooks run is almost always marked `grounded`. That is *defensible* — the
curation warrant, owner call 2026-07-14 — but it means the word "grounded" means something
weaker on hook cards than it now does in chat. **Decide deliberately; don't "fix" it by
reflex.**

### 2.2 The actual work

1. **One contract object.** Lift warrant/citable out of `corpus-tool.ts` into a shared
   module both paths import, so "may this be cited / called proven" is defined once. Today
   `assessWarrant` + `warrantFloor` are private to the tool.
2. **Facets for ideas/script.** `RetrieveInput.facets` exists and is plumbed to the RPC
   (#342) but `gather-for-run` never passes it. A creator's niche/platform/format are
   already known at run time — the paid path could filter and does not.
3. **Reconcile the two floors** — or document why they differ on purpose (recall-vs-warrant
   is a real distinction, so "they differ" may be the right answer; it just must be stated).
4. **Then** the honest question underneath: hooks' `grounded` semantics (2.1).

Do **not** rewrite the generation retrieval to call `search_corpus` literally. The skills
need ranked, adapted, prompt-shaped rows; the tool needs model-readable JSON. Converge the
**contract**, not the call.

## 3. Gotchas that bit this session

- 🔴 **`npx tsc` reported "No errors found" having checked NOTHING** — a fresh worktree has
  no `node_modules`, and an `rtk` shim wraps `tsc` and `git push` the way it already wraps
  `npm test`. Caught only because fixtures that should have broken didn't.
  **Run the real binaries:** `node ./node_modules/typescript/bin/tsc --noEmit` and
  `node ./node_modules/vitest/vitest.mjs run`. Verify a push with `git ls-remote`.
- **Turbopack rejects a symlinked `node_modules`** ("points out of the filesystem root").
  Use `cp -al <trunk>/node_modules ./node_modules` (hardlinks, ~instant, no extra disk).
- **`setsid` does not exist on macOS** — use `nohup … & disown`.
- **`/dev/cards` is auth-gated.** Log in via Playwright with the e2e user
  (`npx tsx e2e/create-test-user.ts` → `e2e-test@virtuna.local` / `e2e-test-password-2026`).
  Component tests need `/** @vitest-environment happy-dom */`.
- **tsc baseline:** only `src/lib/brain/__tests__/cortex-field.test.ts` errors (5), pre-existing
  on main, brain lane. Anything else is yours.
- **New guards must FAIL against the old code first.** Stash the source, run, confirm red,
  `git stash pop`. Both PRs did this; it is cheap and it is the only proof a guard guards.

## 4. Why converge before `corpus_stats` (recommendation, not a decision)

- Hooks/ideas/script are the **paid, day-one** skills. The honesty contract lives only at
  the tool boundary; the surfaces users pay for don't share it.
- `corpus_stats` is a **new surface nobody has asked for**, on a product with no paying
  users yet, and it needs a design pass on refusal copy before it is codeable.
- Converge also *deletes* divergence rather than adding a second thing to keep in sync.

⚠️ Counter-argument, stated fairly: **grounding flags for the 3 gen skills are OFF in prod**
(`GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED`), so converge improves a path users don't hit yet.
If those flags stay off indefinitely, stats-in-chat is the higher-value lane. **That flag
decision is the owner's and it gates this recommendation.**

## 5. If the owner picks `corpus_stats` instead (doc §7 step 6)

Aggregation tool: `groupBy` (format / hook_archetype / visual_setting / editing_style /
platform / niche) + the same facet filter shape + **`minN` refusal floor, default 8** —
several cells are already thinner than 8, so the refusal is the common path, not the edge
case. Its copy needs the no-source-note voice (`proof-receipt.tsx` `NoSourceNote`,
memory `grounding-no-source-note.md`). Reuse `parseFacets` from `corpus-tool.ts`.

## 6. Key files

- `docs/subsystems/grounding-tools.md` — architecture SSOT (§7 sequencing is current)
- `src/lib/grounding/corpus-tool.ts` — tool schema · `parseFacets` · `assessWarrant` · `executeCorpusSearch`
- `src/lib/grounding/retrieve.ts` — `RetrieveFacets` · `resolveRetrieveConfig` · floors (read the comments; they carry the measurements)
- `src/lib/grounding/gather-for-run.ts` — the generation path to converge
- `src/lib/tools/chat-agent-loop.ts` — the live loop; concurrent corpus calls + card emission
- `src/components/thread/corpus-references-block.tsx` — the citation card (+ the group/row layout law)
- `scripts/smoke-corpus-warrant.ts` — live warrant + facet proof (no model call, cheap, 6/6)
- Memory: `grounding-corpus-as-a-service.md`

## 7. Housekeeping

- `~/virtuna-grounding-tools` is **retire-able** (both branches merged). It holds 1.8GB of
  hardlinked `node_modules`; `git worktree remove` when done.
- Trunk is clean on `main` at `6aa74b90`.
