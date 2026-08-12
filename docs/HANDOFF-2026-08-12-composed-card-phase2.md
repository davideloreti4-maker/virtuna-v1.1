# Handoff — composed-card Phase 2, 2026-08-12

**Branch:** `lane/composed-card` in `~/virtuna-composed-card`, **13 commits, pushed, 0 behind main.**
Nothing merged. Nothing deployed. Every commit verified directly: `tsc` clean, full suite green,
`npm run build` exit 0 at each gate.

Last full run: **6049 passed / 42 skipped / 0 failed**.

---

## What landed this session

| commit | what |
|---|---|
| `693cdecf` | Task 7 — `emit_card` tool + agent-loop wiring |
| `2198a633` | the proof path could not resolve, and printed under-performance as proof |
| `0fc6d4e7` | Task 8 — spike re-run against the shipped contract |
| `1050d7a9` | make flash compose |
| `f51e6639` | the Phase 2 plan itself |

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

## ⚠️ Trunk, as of 11:07

`~/virtuna-v1.1` is on `main @ 89e84daf` and **another session is working in it**: staged changes to
`src/lib/engine/remix/decode.ts` + its test (touched 11:06), an unmerged index entry on
`.superpowers/sdd/2026-08-10-remix-shoot-sheet-phase1/progress.md`, and an untracked
`docs/superpowers/specs/2026-08-12-maven-ios-app-store-design.md`. **Do not commit in trunk** until
that clears — a partial commit would sweep it up. The Phase 3 spec amendment and the two
warm-coverage probes are still uncommitted there and still have the shortest shelf life of anything
open.
