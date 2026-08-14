# Handoff — live sourcing measured end to end, and the two things it proved wrong (2026-08-14)

**Lane:** composed-card / Apify-first · worked from **trunk** `~/virtuna-v1.1`
**Merged this session:** **#503** · **#511** · **#512**. `main` at `0fe54c3c`.
**Predecessor:** `docs/HANDOFF-2026-08-13-comparison-hint.md`

---

## 0. ▶️ START HERE

Three things merged, and **one measurement invalidated the framing everyone had been using.**

| | |
|---|---|
| **#503** | `COMPOSED_CARDS` default **ON** + Phase 3 re-scoped (gate chain dropped) |
| **#511** | `LIVE_SCRAPE_DEFAULT` — an env flag that authorizes the live Apify path |
| **#512** | The follower lookup is now **bounded**; the upstream break no longer costs 2 minutes a run |

🔴 **Nothing is live.** Production last deployed **2026-08-07** (`1be28832`). I verified this against
the Vercel API rather than inheriting it: `main` is now **300+ commits** ahead, and the deployed
build contains **no `emit-card-tool.ts`, no `composed-card-schema.ts`, and no read of
`COMPOSED_CARDS` at all**. Setting that env var in Vercel would toggle a variable the running build
never reads — so "flip the flag in prod" is not a task that exists. The flip is a **deposit**.

---

## 1. 🔴 THE FINDING THAT MATTERS: live sourcing already works, and already matches

The owner's standing goal is *"instead of the corpus as reference, gather live from Apify and let it
through Qwen"*, with the stated requirement: **"not some hashtags but searches that match."**

**Both halves were already true, and the session that assumed otherwise was wrong twice.**

`apify-provider.ts` never used hashtags. Stage 1 searches for **people**
(`searchQueries` + `searchSection: "/user"`), stage 2 scrapes their posts. There is a spec note (D12)
recording that caption matching was tried, measured, and rejected.

And the matches are good. Live run, ask = *"ideas about ballast water treatment regulations for
cargo ship compliance officers"*, 35 videos scraped, first ten:

```
@oilgas.id           280,500 plays   "Cargo Ship Ballast Water Management: Sistem Kritis…"
@engineroominsight    17,400 plays   "A Ballast Water Treatment System (BWTS) is…"
@bridgeinsights        1,303 plays   "The 2024 IMO guidance BWM.2/Circ.80/Rev.1 updates ballast…"
```

Ten for ten on-subject.

⚠️ **I published "we paste the creator's whole sentence into TikTok search, that's the defect" and it
was false.** The URL really is the entire ask, verbatim — and TikTok handled it fine. The evidence
was one `fetch` of the run's dataset away and I wrote the conclusion first. **Read the dataset before
theorising about query quality.**

---

## 2. 🔴 What IS broken: clockworks PROFILE mode, upstream

```
profiles:["khaby.lame"]                     → 0 items   clockworks/tiktok-profile-scraper
profiles:["khaby.lame"]                     → 0 items   clockworks/tiktok-scraper
searchQueries:["fountain pen restoration"]  → 5 items   on-topic, WITH subtitleLinks
```

The control against one of the largest accounts on TikTok is what rules out "our handles were junk"
— the four handles stage 1 returned looked marginal (`@tkktoest000`), which is exactly the false
lead that a control kills.

**The failure shape is the load-bearing part.** The actor does not error. It retries each URL ~12
times (*"Failed to parse TikTok response: Unexpected end of JSON input"* — **145 in one run**),
resolves an **empty dataset after 90-130s**, and reports **SUCCEEDED at $0.00**.

So the existing `catch` at orchestrator step 3 — which only covers a **rejection** — was never
reached. #512 adds a 25s deadline. Measured on the same ask: gather **112s → 85s**, run **132.5s →
113.7s**.

🔑 **Generalisable: "best-effort" describes the RESULT, and says nothing about the WAIT.** Every
best-effort call in this codebase is worth re-reading with that split in mind. A dependency that
hangs is not the same as one that fails, and only the second one is guarded by `try/catch`.

⚠️ **Follower counts are unavailable until clockworks catches up.** The `X× vs their usual`
multiplier degrades to the cheap metric — honestly, by design. **Nothing to fix on our side.**
Re-test in a few days by running the control above; it costs one Apify run.

---

## 3. 🔴 The cache answers first, so the live path is nearly unreachable

This is the real obstacle to the owner's goal, and no flag fixes it.

```js
gather-for-run.ts:377   if (cached.enough) {
gather-for-run.ts:385     return finalize(cached.examples);   // ← early return
gather-for-run.ts:405   if (!input.allowScrape || …)          // ← never reached
```

`allowScrape` is consulted **only after a cache miss**, and the 532-row corpus almost never misses.
Measured this session: *"restoring vintage fountain pens"* — picked to be obscure — returned
`cache HIT … 6 teardowns across 3 archetypes (≥4), scrape skipped`. Only a genuinely off-domain
subject (ballast-water regulations) fell through.

This is the same mechanism as the already-recorded **gate 1 passes 95.5% of real asks** finding.
Phase 3's `fresh?: boolean` was going to be the bypass; that plan was dropped this session (§4).

**A live-first product needs a deliberate bypass.** It is a design call, not a bug.

---

## 4. Phase 3 re-scoped — gate chain DROPPED (owner ruling)

Spec §5.1 measured gate 1 at 95.5% and then said re-scoping was *"a scope call for the owner"*. The
call was made. Both docs now record it, so no future session builds the dropped half.

| | |
|---|---|
| **Task 1** — `SpendAuthority` | **KEEP** — the whole lane. **Zero code exists.** |
| **Tasks 2–9** | **DROPPED**, not deferred |
| The ten other Apify doors (§5.2) | **NOW IN SCOPE** |

⚠️ **Task 1's interface is unchanged but its CALLERS are not.** It was specced route-injected "exactly
like `SkillBilling`" for the chat loop — the consumer that just got dropped. Its real callers are the
ten doors, several of them **cron jobs with no route and no request**. Re-derive the seam.

⚠️ **Two defects the drop orphaned, both live TODAY, neither owned:**

1. **The agent only ever learns about the FIRST video of an explore run.** `recordLineOf`
   (`on-screen.ts:275`) caps at 240 chars and the `outlier-grid` describer (`on-screen.ts:114`) reads
   `tiles[0]` only. *"Find me 3 viral formats"* is unanswerable for a mechanical reason. **This fires
   on the manual button today** — not gated behind the dropped proposal flow. Was Task 8.
2. **"Here are the proven outliers for {niche}" is asserted over median rows.** Gate 1 passes
   `asdfghjkl qwerty zxcvbn` (#484). Raising the floor to 0.6 drops the pass rate to 34% — that gap
   is the honest measure of real coverage, and changing it changes what two thirds of asks are told.

---

## 5. Flag state — EVERYTHING is on locally, and `.env.local` is the only place it is

Owner request: *"i want everything on for testing."* Verified by loading the file the way the app
does (`node --env-file=.env.local`), **not** by reading it: **21/21 ON**.

```
LIVE_SCRAPE_DEFAULT · GROUNDING_{IDEAS,HOOKS,SCRIPT}_{ENABLED,ADAPT}
ENGINE_{GEN_CONVERSATION,GUESS_PIN,PROSE_CALL_PIN,REPEAT_ASK_PIN}
NEXT_PUBLIC_{AMBIENT_V2,CONCEPT_V8,ENGINE_ONE_BRAIN}
+ the shipped kill-switch flags (COMPOSED_CARDS, CHAT_AGENT_DISPATCH, …)
```

🔴 **Two are OFF ON PURPOSE — do not "complete the set":**

| | |
|---|---|
| `BILLING_ENFORCE_QUOTA` | Would **refuse every run** (free tier is `limit:0` + `enforced:true`). It is `true` in PROD. |
| `GROUNDING_CHAT_PREFLIGHT` | The code says it *"stays dead by default"*. ON revives a superseded path **on top of** the agent loop: two corpus pulls + an extra blocking call, one answer. |

⚠️ `LIVE_SCRAPE_DEFAULT` is an **env flag, not a changed default** (#511). `gather-for-run` states the
shipped rule — *"the SCRAPE IS EXPLICIT-ONLY … owner call 2026-07-17"* — and that ruling stands for
production. A flipped code default would make **every** send scrape live for **every** user against a
$5 cap the first time anyone deploys: a spend landmine armed by an unrelated merge.

⚠️ Its check is `=== "true"`, the **inverse** of the house `!== "false"`. A shipped-ON feature should
survive a half-set env; a spend must not be *armed* by one. Pinned by test.

---

## 6. Apify budget

```
cap        $5.00
used       $3.82
remaining  $1.18       (~23 scrapes)
resets     2026-08-20T23:59:59Z
```

⚠️ **Correction to something published earlier this session:** the failing profile runs cost
**$0.0000**, not "burned budget". Four runs, all SUCCEEDED, 0 items, $0. Read `usageTotalUsd` off
`/v2/actor-runs/<id>` before claiming spend.

⚠️ At the cap Apify 403s and the app renders it as *"check your handle is public"* — a budget failure
in a broken-video costume. **This session was NOT at the cap**, so the profile failures are a real
outage, not a disguised cap-out. Check the account before debugging a handle.

---

## 7. Traps this session paid for

- **Trunk is shared, and a co-session took it mid-session.** It switched `~/virtuna-v1.1` to its own
  branch and **rewrote my two commits** (reflog: `reset` → `commit` → `amend` → `cherry-pick`). The
  work survived because it was already committed and auto-pushed. **Check
  `git rev-parse --abbrev-ref HEAD` before every operation in trunk**, and never `git add -A` there.
- **A default-flip's ONLY observable arm is the unset one.** `=== "true"` and `!== "false"` agree on
  every environment that *sets* the variable, so any test that sets it is vacuous by construction.
  Test 8c asserts the deleted arm. Generalises past flags.
- **A mutation must be confirmed ON DISK.** Both mutations this session were verified by `grep`ing
  the changed line, not by trusting an editor's exit code.
- **A rejecting stub cannot test a hanging dependency.** The existing `scrapeProfile` stub throws, so
  it passed with *and* without #512. The new test models a promise that **never settles**.
- **`innerText` is layout-aware** — `/home` read 27,123 chars via `innerText` and **108,944** via
  `textContent`. Ask "did it mount" with `textContent`.
- **`nextjs-portal` is always in the dev DOM.** It is not an error frame. Read the console log.
- **A launchd reaper kills idle dev servers after ~10 min.** Mine exited with code 0 mid-session;
  that is the reaper, not a crash.
- **An indented `EOF` never terminates a `<<'EOF'` heredoc.** A pasted, indented block silently
  wrote only part of the env file. Prefer a single-line `printf` for env appends.
- **The suite flakes.** Run 1: 3 failed / run 2: 0 failed. Run 1 (later): 1 failed / run 2: 0 failed.
  `composer-offline-gate.test.tsx` flaked and is **not** in the documented flake set.

---

## 8. Do next

1. **Decide the cache-first bypass** (§3). This is the only thing standing between the product and
   the owner's live-first goal, and it is a design call. Everything else is downstream of it.
2. **The two orphaned defects** (§4). The 240-char one is small, self-contained, and live today.
3. **Re-test clockworks profile mode** (§2) — one Apify run, free-ish, tells you whether the
   multiplier can come back.
4. **`SpendAuthority`** — needs a fresh plan; the old one assumed the dropped consumer.
5. **Ask 3** — *"what makes an ending actually land on a short video?"* — still **0/6**. Needs live
   probes (~40 chat sends). Never ruled on.
6. **A purchase, not a session** — the Apify cap gates Phase 1's release, not its build or its test.
