# Handoff — composed-card, after Task 9 + the first browser look, 2026-08-12

**Branch:** `lane/composed-card-task9` in `~/virtuna-composed-card`, branched from `main @ da6fa773`.
Nothing merged. Nothing deployed (git is still disconnected from Vercel).

Supersedes `docs/HANDOFF-2026-08-12-composed-card-phase2.md` for open items; that document's
"Traps worth carrying forward" all still hold.

---

## What landed

| commit | what |
|---|---|
| `e57c9aad` | Task 9 — the one band rule, plus the feed-badge honesty bug it exposed |
| *(this commit)* | `probe-composed-card-rate.ts` — the first instrument that measures the real route |

**Task 9 was the last item in the Phase 2 plan. The plan is now complete.**

## Task 9, and the bug that was hiding behind it

The mechanical part went as written: `EXTREME_MULTIPLIER` re-exports `MAX_PRINTABLE_MULTIPLIER`,
`toCorpusVideo` clamps the display while `extreme`/`proven` stay keyed off the raw value, and the
feed admits proven rows regardless of `extreme`. Measured in prod: the pool goes **230 → 285**, so
**55 rows** are newly admitted, not the ~31 the plan estimated.

**The plan's safety argument was false, and only a browser showed it.** The plan says the honesty
flag is untouched because `MultiplierChip` renders `⚠` in a non-proven tone. But the outliers feed
does **not** use `MultiplierChip` — `outliers-panel.tsx` draws its own badge over the cover scrim,
unconditionally `▲ N×` in `--color-positive`. `MultiplierChip` is only used by `collections-panel`
and `teardown-detail`, which are exactly the surfaces where extremes were *already* visible. So
admitting 55 thin-baseline rows through that badge would have printed every one of them as proof.

Fixed in the same commit: the feed badge now carries the same rule, with the overlay's styling
rather than the pill (a pill on an arbitrary video frame was rejected earlier for good reason).
Guarded by `outliers-panel-band.test.tsx`, which was **verified to fail 3/5 against the old badge**
— not a tautology.

Measured in a signed-in browser on `/feed`:

| sort | badges | proven green (▲) | flagged (⚠) | flagged wearing the proven colour |
|---|---|---|---|---|
| Recent | 24 | 16 | 8 | **0** |
| Highest × | 24 | 0 | 24 | **0** |

### 🔶 One consequence for the owner

**"Highest ×" now opens on a solid wall of tied `100× ⚠` rows** — 24 above the fold, 55 in total,
none of them proof-grade. The rule this replaced existed for a stated reason: *"a feed sorted by
highest × must not open on a 20,154×."* The clamp honours the letter of that (no 20,154× prints)
while arguably breaking its intent — a genuine 41.6× receipt is now buried under 55 flagged rows.
Options: leave it, drop `extreme` rows out of the *multiplier sort* only, or sort on the raw value
so the flagged band lands last. **Not my call — flagging it, not fixing it.**

## 🔴 The gap that was actually worth closing

The previous handoff was right that nothing had been looked at in a browser. It has now.
**Composed cards do render, and they look correct** — screenshot evidence: a `comparison` card with
hero claim, a two-column comparison slot, bullets, a note and the Copy affordance, sitting in a
real thread. That part is fine.

What the browser changed is the *rate*, and how much any earlier number is worth.

`probe-thinking-stream.ts` is described as the end-to-end check that caught the silent-directive
bug, and scored 5/5. But it passes its **own** one-line system prompt and
`context: { profileRow: null, audience: null }`. The route passes `KC_CHAT_SYSTEM_PROMPT`
(**25,268 chars**) and a real creator's profile + calibrated audience. **The documented caveat "the
spike does not use the shipped prompt" applies to the end-to-end probe too, one level up.**

`scripts/probe-composed-card-rate.ts` closes that: it POSTs the real route as a real signed-in user
and counts blocks off the SSE stream.

| instrument | prompt | card rate |
|---|---|---|
| spike harness | its own | 6/6, 5/6, 6/6 |
| `probe-thinking-stream.ts` | its own one-liner | 5/5 |
| **`probe-composed-card-rate.ts`** | **the shipped one, real user** | **1/6, 4/6, 2/6 → 7/18 ≈ 39%** |

⚠️ **The 1/6-to-4/6 spread is on an IDENTICAL ask set, back to back.** Whether the gap between the
top row and the bottom row is real or just this sampler is **NOT settled** — it needs far more
samples per configuration than anything so far has paid for. What *is* settled: no single run of
any of these scripts can clear a gate, and the two upper rows were never measuring production.

### Two instrument traps, both paid for this session

- **`emit_card` fires in a LATER round than the prose.** A browser poll that waits for the answer to
  stop growing and then declares "prose only" reports **0/5 against a surface that is composing
  cards**. I published that 0/5 before catching it. Wait for the stream to CLOSE, not for text to
  settle.
- **Without `maven_active_thread=__new__`, `/home` rehydrates the newest open thread and appends.**
  Several single-ask runs pile into one thread, and counting cards per thread double-counts across
  runs — it showed the same 5 cards under two different thread titles. One POST per ask avoids it.

Also confirmed live, since `ps eww` shows no env on macOS and cannot answer it: a throwaway route
reported `composedCardsEnabled: true`. The flag genuinely reaches the running server.

## 🔴 Separate defect, reproduced on all three runs

The ask *"explain the structure of a story-time video, start to finish"* streamed **20,742 / 33,165
/ 18,484 characters of prose**. Consistent across runs, so not noise. That is a wall of text on a
creator's screen. It reproduces on turns that compose nothing, so it is **not** a composed-card
problem and does not block this lane — but somebody should chase it.

## Owner rulings — all four RULED and IMPLEMENTED (`67293218`)

| # | was open | ruling | shipped |
|---|---|---|---|
| 1 | teardown with unresolvable refs still renders | **don't render the card** | scoped to `teardown` (the only recipe that *requires* proof_strip); returns an error so the model retries or answers in prose |
| 2 | `search_corpus` hands the model sub-floor multipliers | **strip the figure below 3×, keep the row** | same arithmetic + shared constants as `bandedMultiplier`; also clamps at the ceiling. **This one was live in prod** |
| 3 | `stat_row` carries model-authored numbers | **require provenance or drop the row** | now `{metric,label,receiptRef}` — model names the ROW and WHICH metric, server supplies the figure |
| 4 | "Highest ×" wall (new, from Task 9) | **flagged rows sort last** | in-band receipts rank first; verified in a browser — the sort now opens `▲ 99.3× · 96.8× · 92.4×…` in proven green |

Every guard was verified to **fail against the old behaviour** before being kept.

### ⚠️ One deliberate cost, ruling 3

`brief` can no longer put PLAN numbers in a `stat_row` — the gallery fixture's
`4 Posts · 42s Median runtime · Tue / Thu` cannot be expressed once the figure must come from a
corpus row. Those moved to `label_values`, which is where a spec table belongs. Worth knowing that
**`label_values` still carries model-authored strings**, by exactly the argument that made
`stat_row` a problem. It was not in scope of the ruling and is untouched — but it is the same hole,
one slot over.

The restriction keeping `stat_row` out of `comparison` **stays**, but its rationale expired: it is
now a layout decision, not an honesty one. Three comments that still said otherwise were retired.

## Still open

- **Save on composed cards** — absent by design; `saved_items.item_type` has no type for it.
- **PROVEN STRUCTURE beside no number** — rarer in practice than the corpus statistic suggests.
- **`label_values` model-authored strings** — see above.
- **The 18k–33k prose turn** — see below.

## What I did NOT verify

`/dev/cards` renders only the app shell in this environment — I could not get the gallery content
to mount at all (no console error; the Composer tab button never appears). **So the `brief` card's
new `stat_row` was never eyeballed.** It is covered by three component tests asserting the exact
DOM — value read from the receipt, a stat with an unresolvable ref dropped, the whole row dropped
when none resolve — all verified red-then-green. That is not the same as looking at it.

## Verification

`tsc` clean · **6323 passed / 42 skipped / 0 failed** (no flakes in this run) · `npm run build`
exit 0 · signed-in browser on `/feed` and on a real thread, screenshots in the session scratchpad.
