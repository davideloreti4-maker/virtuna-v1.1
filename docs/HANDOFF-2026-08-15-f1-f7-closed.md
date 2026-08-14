# Handoff — F-1 and F-7 closed, and the flag turned on (2026-08-15)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Branched from:** `efd3e250` (main had moved TWICE since the last brief was written — #511
`feat/live-scrape-default` landed in between).
**Gates:** `tsc` 0 · `npm run build` 0 · **6476 tests passed, 0 failed.**
**Verification:** prod build on port 3016, native 1440×900 desktop context, signed in as the e2e
account; plus a direct measurement of the production `messages` table.

---

## 0. ▶️ WHAT SHIPPED

| # | was | now |
|---|---|---|
| **F-1** | pack renders twice, ~8%, mechanism undiagnosed | **CLOSED** — measured at 14/139 card turns, mechanism found, fixed for skill cards AND composed cards |
| **F-7** | "no diversity constraint exists" | **CLOSED** — was already fixed in `hooks-runner`; `ideas-runner` was the real gap, now capped and both pinned by tests |
| `ENGINE_GEN_CONVERSATION` | ⚫ dark since #475 | 🟢 **default ON** (`!== "false"`), owner ruling |

---

## 1. 🔴 F-1 — the documented mechanism was wrong

Every prior handoff describes F-1 as *the model re-emitting the pack in prose*. **It is not.** The
loop concatenates **every round's text** into one persisted block, and the cap only ever governed
some of those rounds.

```
chat-agent-loop.ts:1057   let fullText = ""            // per TURN
              :1145       textCap = skillRuns.some(blocks) ? 600 : Infinity   // per ROUND, at round START
              :1201       fullText += shownText        // every round, capped or not
              :1607       return { text: fullText }    // → route.ts:703 persists it
```

`skillRuns` is empty until a skill has actually run (`:1553`). So a round that **narrates and calls
the skill in the same breath** streams uncapped, and that narration is welded onto the answer. The
route inserts cards as their **own message first** (`route.ts:689`), so on reload the narration
reappears *below* the cards it was promising — reading as a second, competing answer.

The measured row that proves it, from the production table:

> "To see how your hooks compare, I need to pull the outlier data…" **"Here is the breakdown of how
> your hooks stack up…"**

Two rounds, one block. The RED test reproduced that string shape exactly before the fix.

### The measurement (re-run it before quoting any rate)

`origin:"chat-agent"` markdown blocks, split by whether a card pack exists to duplicate:

| sibling | turns | text > 600 |
|---|---|---|
| `composed-card` | 67 | 6 |
| `hook-card` | 54 | 4 |
| `idea-card` | 13 | 4 |
| `script-card` + combos | 6 | 0 |
| **NO_CARDS** (search→prose) | 34 | **25** |

**F-1 = 14 of 139 card-bearing turns ≈ 10%**, independently confirming the inherited ~8%.

🔴 **The 25 NO_CARDS rows are NOT F-1 and must never be "fixed".** They are search-and-answer turns
— 2,000–3,600 chars of legitimate comparison writing ("Confession wins. By a lot. Here's why…").
There is no pack to duplicate. They survive only because `search_corpus` never enters `skillRuns`,
which was incidental and is now **pinned by a test**, since a refactor routing citations through
`skillRuns` would truncate the product's best answers to 600 chars and stay green.

### The fix, in two halves

1. **Pre-card text is dropped at assembly.** Not buffered — buffering round-1 text is the cost
   `prose-call.ts` explicitly refuses to pay, and `guess-pin.ts` argues at length against it. The
   narration still streams to the creator; it simply does not persist. No truncation.
2. **Post-card text over budget is dropped whole, not truncated.** `POST_TOOL_TEXT_CAP` only ever
   truncates — its own docstring concedes this — so it hands the creator 600 chars of duplicate cut
   mid-sentence instead of no duplicate. The budget is now per **turn**: N post-card rounds of
   capped text still stack into N×600 of duplicate.

⚠️ **`emit_card` blocks route to `uiBlocks`, never to `skillRuns`** — so composed-card turns had
**no text limit at all**, and `COMPOSED_CARDS` went default ON in #503. That is why they were 6 of
the 14. The loop already *told* the model "reply with ONE short closing line and do NOT restate or
rewrite their content in prose" (`:1413`); nothing enforced it. Now something does.

**Deliberately unchanged:** the stream-time cap on skill-card turns still truncates at 600. It is
shipped, tested behaviour and widening the change was not worth the blast radius.

---

## 2. 🔴 F-7 — the re-derivation looked in a file that cannot hold the fix

The inherited claim: *"`build-proof.ts` is still a pure `sourceIndex → example` lookup. **No
diversity constraint exists in the file**."*

**Both sentences are true and the conclusion is wrong.** The constraint *cannot* live there —
`build-proof.ts` resolves ONE card's citation and has no view of the other cards. It belongs in the
assembly loop, where the whole set is known. And it was already there:

- `output-guards.ts:193` — `createSourceDiversityCap`, `MAX_CITATIONS_PER_SOURCE = 2`
- `hooks-runner.ts:790` — calls it, since `7d4bc133`
- `ideas-runner.ts` — **did not.** The actual gap, now fixed.
- `script-runner` — one card per run, N/A.

🔑 **This is the handoff's own `git log --grep` rule, failing in a new way.** Grepping "F-7" *does*
surface `7d4bc133`, and the previous session read its title as an attempt rather than a partial
close. A fix that lands for one caller and not another leaves a claim that is half true, and hand
re-derivation of the *other* caller confirms it — which is exactly how it survived two sessions.

⚠️ **Nothing asserted the cap in either runner.** It could have been deleted with every suite green.
`src/lib/tools/runners/__tests__/source-diversity.test.ts` now pins both, at runner level, for the
reason `citation-guard-adapt.test.ts` states about itself: a unit test of the counter proves the
counter counts, and cannot see a runner that never calls it.

---

## 3. `ENGINE_GEN_CONVERSATION` is ON — and it was never measured

Flipped to `!== "false"` (`conversation-digest.ts`), the house convention, matching how
`COMPOSED_CARDS` was flipped in #503. An env var alone would have reached nobody: **the deploy is
off**, so a Vercel change without a redeploy is a deposit, not a release.

🔴 **It shipped without the live A/B its own comment promised** (*"ships dark until it has been A/B
measured live"*). That measurement was never taken and, with the deploy off, could not be taken in
production. The ruling was made on the design argument. **If a later run looks worse, suspect this
first** — `ENGINE_GEN_CONVERSATION=false` is a one-line kill switch, not a revert. The off path is
still covered by tests.

---

## 4. ⚠️ A claim I inherited, checked, and found FALSE

> *"`text-foreground-tertiary` is live in `extension-card.tsx` and `upgrade-prompt.tsx` — two files
> are styling with a class that does not exist."*

**Zero files style with it.** The string occurs **once in the repository**, inside a JSDoc
`@example` block at `extension-card.tsx:79`. `upgrade-prompt.tsx` never contained it. The token
genuinely doesn't exist; nothing references it. Corrected in both documents that carried the claim.

🔑 **A `grep` hit inside a comment is indistinguishable from one in a `className` until you open
it.** The previous session's rule was "grep before believing an inherited claim" — the missing half
is *read the hits*. One of the two files named was never even a match.

---

## 5. Still open — nothing here is half-finished

1. **The monologue leak, live half.** One composed-card turn persisted **20,742 chars** of the
   model's own planning voice — *"The user wants an explanation… I need to break down…"* — as the
   creator-facing answer. F-1's fix stops it being **persisted**, but it still **streams** to the
   creator in real time. `chat-agent-loop.ts:1135` claims reasoning arrives as
   `delta.reasoning_content` which the loop never reads; that claim needs testing against this row,
   because either it is wrong for this path or the model emitted monologue as ordinary content.
   **Do not assume it is a subset of F-1.**
2. **F-3, F-8, F-11, F-12** — never measured, one live run each. Unchanged.
3. **The sidebar `⋯` menu** — still a design call, not a CSS one. Unchanged.
4. **`deriveSeedPrompts`** — still orphaned, still deliberately left.
5. **The lane memory is still stale** and still cannot be written from this worktree. The path
   guard is keyed to the SESSION's worktree root — it also blocked writing a probe to the system
   scratchpad this session, so it is not memory-specific. Work order: `three-orphans.md` §5b.

---

## 6. Verification recipe (used today)

```bash
npm run build && npm run start -- --port 3016     # PROD build; dev overlays fake UI bugs
node scripts/mint-auth-state.mjs http://localhost:3016
node scripts/probe-f1-render.mjs http://localhost:3016 <threadId> .scratch/f1.png
```

⚠️ **`main` is NOT the scroller on `/home`.** It reports `scrollHeight === clientHeight` while a
`flex-1 min-h-0 overflow-y-auto` div holds 2,380px against a 900px viewport. A `fullPage`
screenshot stops at the fold and reports everything below it as absent — which is how a
fully-present 1,907-char duplicate can look like it isn't rendering. The probe finds the real
overflowing element and scrolls that. This is `overflow-check-false-pass` again, in a new place.

💰 **A live re-measurement of the F-1 rate is NOT done and needs N runs, not one.** F-1 fires on
~10% of card turns, so a single run cannot clear it (`adapt-call-is-nondeterministic`: one live run
never clears a gate — sample N and report a rate). What is verified: the defect renders on a prod
build (screenshot), the mechanism is measured in the database, and the fix is driven through the
real loop by tests using the exact round shapes those rows show.

⚠️ **The launchd reaper killed the prod server mid-session** after ~10 idle minutes. If a probe
suddenly cannot connect, that is the cause — restart, don't debug.

---

## 7. Housekeeping

- **Deploy is OFF, owner-confirmed, and that is a CONSTRAINT, not a task.** Merging does not deploy.
- **`LIVE_SCRAPE_DEFAULT` (#511) is default OFF** — `=== "true"`, deliberately the inverse of the
  house switch so a spend is never armed by a half-set env. It does not change the Apify warning.
- **No migration.** No DDL was applied and none is needed.
- The measurement queries in §1 are read-only; nothing was written to the database this session.
