# Session 17 close-out — the audit backlog reached zero, and none of it cost a run

**Lane:** in-thread chat · worktree `~/virtuna-in-thread-chat`
**Merged:** #535, #536, #540, #543, #545 — all on `main`, all verified after merge.
**Nothing here needed a deploy.** Everything waits with the rest of the queue.

> ⚠️ Read `docs/NEXT-SESSION-2026-08-17.md` **including its 2026-08-21 header box** — the box
> corrects the brief's three operative claims. This file is the shorter version.

---

## 1. What shipped

| PR | What |
|---|---|
| **#535** | `ENV.md` §8 flag ledger + §9 account-move checklist |
| **#536** | 🔴 a real defect: Stage B's dead-zone label read the pre-router guess **raw** where the pin beside it reads it **narrowed** |
| **#540** | corrected the ledger's own headline row — #538 falsified it 16 minutes after it merged |
| **#543** | F-11d + F-12b answered **free from code**; neither ever needed the paid run four briefs budgeted |
| **#545** | the lane brief rewritten to match reality |

**One code fix. Four documents that were quietly wrong.**

## 2. 🔴 The finding worth carrying forward

Three call sites read the pre-router's guess. Two read it **raw** (`guessSkill`), one **narrowed**
(`detectGuessPin`). The narrowing exists for one measured sentence — *"Yes, run the simulate tool on
that hook"* — which `repeat-ask.ts` independently names as the single harmful guess.

So Stage B's B3 frame announced **"Looks like a hooks run…"** to a creator who asked for the **SIM**,
for the entire 4–5s wait the frame exists to fill. `certain:false` marks it a hint; a wrong hint is
worse than the default `"Thinking…"` on a surface whose only job is to make the wait legible.
Test 6g one screen below already proved that ask must never be **pinned** — it was still being
**announced**.

Fixed at `route.ts:496`, pinned by route test **6g2**. It landed **16 minutes** before #538 made
Stage B a shipping default. That was luck.

🔑 **Why it hid:** B3's *client* half is well covered — and every one of those tests **supplies the
frame as a fixture**. Nothing tested which skill the **server** picks. A well-tested consumer says
nothing about an untested producer.

## 3. What is still open

> ✅ **A, C and D were closed out on 2026-08-21 (#555). Their rows below are updated in place.**
> Every one was first checked for *"already done elsewhere"* — the discipline this session earned —
> and the check paid off once, on **B**.

| # | Item | Status |
|---|---|---|
| **A** | **The prose-call comment** — `prose-call.ts` claimed it was *"the guess pin with the ~3.4% wrong-run exposure removed."* It never inherited `detectGuessPin`'s narrowing. ✅ **Comment corrected, code untouched.** The exposure *is* removed, but by a **different mechanism**: the TRIGGER needs an asserted GENERATOR call (`generate_hooks(`…), and the one known bad ask elicits `simulate(...)`, which does not match. Converging the code instead would change measured design behind a dark flag, and this module argues at length that the guess pin's reasoning does **not** transfer — so that is left as an explicit owner call, not silently merged | ✅ closed |
| **B** | 🔴 **F-8b — THE PREMISE MOVED, and this row is now the wrong question.** `e3c43e35` (2026-08-16) changed the audience tab so a segment's `displayName` is a **curated archetype noun** (`population.ts:290`, `archetypeDisplayName()`), never calibration's generated persona. The rail and the tab used to disagree about the same people — *"Quiet Watchers"* vs *"The Scroll-Stopping Scroller"*. So **a repeating roster of names is now INTENDED**, per the 2026-08-12 ruling. F-8b asked "is the persona roster fixed?" — at the display layer the answer is now *yes, deliberately*. Whether **calibration** adapts is a separate question living in the data, not the names. ⚠️ **Do not budget the old F-8b run.** Re-scope it first | 🔴 re-scope, do not spend |
| **C** | **Task #31** — ✅ **checked, and it is genuinely still open.** `stripLeakedReasoning` is called only at assembly (`chat-agent-loop.ts:1694`/`:1697`/`:1712`); the token stream is guarded by `createArtefactGuard`, and `guardArtefacts = (deps.sealedVisitor ?? false) \|\| unbound` (`:973`) — so **a signed-in creator's stream is untouched**, exactly as #523 left it. Still deferred on purpose: withholding tokens means buffering, slowing every turn to guard something rare. ⚠️ Never reproduced (0/21 live runs) while production leaked 3 of 4 identical asks one day and 0 of 6 the next — **a clean run is not evidence it is gone** | ⏸️ open by choice, re-confirmed |
| **D** | **The three dark `ENGINE_*` pins** — ✅ **now exercised together for the first time.** Route test **6h2** turns `GUESS_PIN`, `REPEAT_ASK_PIN` and `PROSE_CALL_PIN` all on and pins the composition: the ternary chain (chip > repeat-ask > guess), `proseCallPin` arming **independently** because it targets a later round, and the narrowing still holding with every pin live. **They compose correctly — no conflict.** Mutation-checked: the test fails when the expected value is changed | ✅ closed |
| **E** | **The sidebar `⋯` menu** — three 44px targets 2px apart would overlap by 20px and the later sibling wins the tap. A design call, not a CSS one | design |
| **F** | **Memory files** still cannot be written — the guard requires a session whose worktree root is `~`. Work order in `NEXT-SESSION-2026-08-17.md` §3 | blocked |

## 4. 🔴 The migration item that is live right now

The new Vercel account exists. **The domain is the thing most likely to be missed**, and the
premise most people start from is wrong:

**`numenmachines.com` is delegated to `ns1/ns2.vercel-dns.com` — the zone lives in the OLD account.**
Namecheap is **not** authoritative, so its *Advanced DNS* tab cannot add the records the new account
is asking for. Measured 2026-08-21.

Full measured zone, the mail records that break silently, and what the new account wants:
**`docs/DNS-numenmachines-2026-08-21.md`**. Move checklist: `ENV.md` §9.

✅ Both apex and `www` currently return **404** — expected with the deploy off, and it means there is
**no live traffic to protect**. This is the cheapest moment to change delegation.

## 5. The pattern this session kept re-learning

Four separate times, a row that said *"needs a paid run"* or *"⚪ unmeasured"* turned out to mean
**nobody had opened the file**:

- **F-3** and **F-8a** — already fixed in code, one of them three days before the table called it open
- **F-11d** — answered by reading two functions; the row cited three call sites and **missed the one
  that actually delivers skill cards**
- **F-12b** — the spine it called unbuilt is fully wired end to end
- **My own §8 ledger** — wrong on its headline row sixteen minutes after it merged

🔑 A row's **status** and its **evidence** get written at different times by different people and are
never reconciled. That is why a row can carry, in its own citation list, the thing that refutes it.
**Open the file before budgeting against any inherited row.**

⚠️ And twice this session an *instrument* lied rather than the answer: a grep with the wrong quote
style reported working code as unwired, and an `echo` label printed "identical" regardless of the
diff beside it. Both were caught by checking the instrument, never by doubting the result.
