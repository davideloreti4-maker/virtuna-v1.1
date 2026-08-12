# Handoff — composed-card Phase 2, 2026-08-12

**MERGED — PR #478, `main` @ `1b5ca085`.** `lane/composed-card` is in. Not deployed (git has been
disconnected from Vercel since 2026-08-08, so merging does not ship).

The merge was not clean: `main` moved to `a994b227` mid-PR and a co-session had extracted
`CARD_LINE` / `SKILL_BLOCK_RECORD` out of `chat-prior-turns.ts` into a new shared
`src/lib/tools/on-screen.ts` — exactly to stop two copies of that map existing. This lane had added
its `composed-card` entry to the old copy. Resolved by taking `main`'s file wholesale and moving the
entry into `on-screen.ts`, where `RECORDED_BLOCKS` and the reachability drift test can see it.
After the merge: **6308 tests pass**, `tsc` clean, `npm run build` exit 0.

Last full run (post-merge): **6308 passed / 42 skipped**.

⚠️ **The suite flakes.** Across six full runs it failed 0, 2, 5, 0, 0, 2 tests non-deterministically,
always in `src/lib/scraping/__tests__/resolve-video.test.ts` and
`src/lib/engine/__tests__/omni-analysis-*.test.ts` — different ones each time, and they flake in
isolation too. Nothing in this lane touches those files or anything they import. Pre-existing and
undiagnosed; do not read a red run there as your own regression.

---

## What landed this session

| commit | what |
|---|---|
| `693cdecf` | Task 7 — `emit_card` tool + agent-loop wiring |
| `2198a633` | the proof path could not resolve, and printed under-performance as proof |
| `0fc6d4e7` | Task 8 — spike re-run against the shipped contract |
| `1050d7a9` | make flash compose |
| `f51e6639` | the Phase 2 plan itself |
| `acba1327` | this handoff |
| `6a6d42f6` | merge `main`, moving the `composed-card` record line into `on-screen.ts` |

Tasks 1–8 are complete. **Task 9 (align the Discover feed to the one-band rule, B1) is the only
plan item left** — it changes a shipped surface and the plan gives it its own review gate.

## The state that matters

**Everything is behind `COMPOSED_CARDS`, default OFF** (`src/app/api/tools/chat/route.ts`). With it
off, a chat turn sends byte-identically what ships today — asserted by test, not by inspection. The
flag drives five things at once so they cannot drift apart: `emit_card` binding, row ids in
`search_corpus` results, `enable_thinking`, a 6-round budget, and the directive clause.

**flash works.** 6/6, 5/6, 6/6 on the spike; 5/5 end-to-end through the real loop. It did not need a
tier change — see `docs/superpowers/specs/2026-08-12-composed-card-spike-rerun.md`, and read the
**ADDENDUM first**: §1 and §2 of that document are superseded and marked as such.

## Open — all owner calls, none blocking

1. **A `teardown` whose receipt refs all fail to resolve still renders**, asserting proof it cannot
   show. `requiredSlots` checks a slot is *present*, not that it *resolves*. The obvious fix also
   kills a legitimate card on a database miss. Spike doc §3.
2. **`search_corpus` shows the model sub-floor multipliers** (`1.3×`, `1.8×`) as if they were
   evidence, from a tool whose description says the library "measurably outperformed". The card now
   correctly refuses to print them, so the model can say a number in prose that the receipt beside
   it does not show. Pre-existing, live today, independent of composed cards.
3. **`stat_row` carries `{value,label}` strings the MODEL writes.** Legal in `brief` only. It was
   deliberately not widened with `proof_strip`, but the hole it opens in `brief` is real.
4. **Save on composed cards** — still absent by design; `saved_items.item_type` has no type for it.
5. **PROVEN STRUCTURE beside no number.** Corpus-wide, 45.9% of rows print no multiplier — but
   ranked retrieval favours numbered rows (31 of 32 receipts in the spike carried one), so this is
   rarer in practice than the corpus statistic suggests. I overstated it earlier in the session.

## Traps worth carrying forward

- **The seed does not pin DashScope.** Three runs of one config spread 2/6–4/6. Never quote a single
  run of `spike-slot-composer.ts`. Use `SPIKE_MODEL` / `SPIKE_CASE` / `SPIKE_MAX_ROUNDS` /
  `SPIKE_THINKING` to chase one failure without paying for twelve.
- **The spike does not use the shipped prompt.** It has its own SYSTEM, so it cannot catch a
  directive problem — and one nearly shipped: `emit_card` bound but unmentioned produced 2,438
  characters of markdown and no tool call. `scripts/probe-thinking-stream.ts` is the end-to-end
  check; run both.
- **A verdict string is not a measurement.** "NO CARD (prose only)" was printed for turns whose
  prose was zero characters. The real cause — a retrieval loop — was invisible until the telemetry
  existed. Three of this session's wrong conclusions came from asserting a cause no instrument had
  checked.
- **Production caps a turn at 4 rounds.** Searching spends them. Any tool that needs its own round
  to be useful has to be given the room.

## Probes (all committed, all live)

| script | proves |
|---|---|
| `probe-emit-card.ts` | a real teardown row materializes; a model handle never lands |
| `probe-receipt-coverage.ts` | the 532-row coverage table |
| `probe-proof-strip-roundtrip.ts` | a `search_corpus` id round-trips into a real receipt |
| `probe-thinking-stream.ts` | reasoning stays out of the creator's stream; a card lands |

## Next session, in order

1. **Task 9** — the last plan item, and it is half-landed:
   `discover/corpus-reads.ts:33` still declares its own `EXTREME_MULTIPLIER = 100` and still DROPS
   out-of-band rows instead of clamping, while `grounding/outlier-gate.ts` owns the shared constant
   that `composed-card-receipt.ts` already clamps to. Two literals that happen to agree.
2. **Rule on the three open honesty items above** before more is built on the contract. #2 is live in
   production today, independent of this lane.
3. **Flip `COMPOSED_CARDS=true` in a preview env and use it**, before touching prod. Everything here
   is measured through probes and a harness; nobody has looked at a composed card in a running app.

## ⚠️ Trunk, as of 11:07

`~/virtuna-v1.1` is on `main @ 89e84daf` and **another session is working in it**: staged changes to
`src/lib/engine/remix/decode.ts` + its test (touched 11:06), an unmerged index entry on
`.superpowers/sdd/2026-08-10-remix-shoot-sheet-phase1/progress.md`, and an untracked
`docs/superpowers/specs/2026-08-12-maven-ios-app-store-design.md`. **Do not commit in trunk** until
that clears — a partial commit would sweep it up. The Phase 3 spec amendment and the two
warm-coverage probes are still uncommitted there and still have the shortest shelf life of anything
open.
