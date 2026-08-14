# Handoff — the cache-first ordering is fixed, and the live path is now reachable (2026-08-15)

**Lane:** composed-card / Apify-first live sourcing · worked from **trunk** `~/virtuna-v1.1`
**Merged this session:** **#517**. `main` at `a584b23e`.
**Predecessor:** `docs/HANDOFF-2026-08-14-live-sourcing.md`

---

## 0. ▶️ PASTE THIS TO START THE NEXT SESSION

```
Read docs/HANDOFF-2026-08-15-live-first.md. main was a584b23e at handoff — RE-MEASURE
with git rev-parse; it moved TWICE under me yesterday (co-sessions merged #514/#515/#516).

STATE: the cache-first ordering that gated this lane for three sessions is FIXED and
merged (#517). An authorized run now scrapes FIRST; the cache is the safety net behind
it. Proved with one live run on a subject that hit the cache every prior session —
"live scrape — 6 fresh rows", no cache HIT line, 3/3 rows similarity=null, $0.1120.
The 240-char Explore-record orphan is closed in the same PR. Nothing is deployed; prod
is frozen at 2026-08-07 and does not contain this code.

DO NOT:
  - Do not turn on BILLING_ENFORCE_QUOTA (refuses every run) or
    GROUNDING_CHAT_PREFLIGHT (revives a dead path on top of the agent loop).
  - Do not try to fix clockworks profile mode. Re-measured 2026-08-15 with a control
    against @khaby.lame: SUCCEEDED, 0 items, $0.0000, 91s. Upstream. Never debug our
    own handles without running that control first.
  - Do not propose reconnecting the deploy. OFF deliberately, owner-confirmed.
  - Do not build Phase 3's gate chain. Tasks 2-9 are DROPPED.
  - Do not `git add -A` in trunk.

NEEDS MY RULING, don't start without asking:
  1. The gate-1 floor (0.6 → 34% pass rate). It changes what two thirds of asks are told.
  2. ~$40 of live probes for ask 3. Still 0/6, still never ruled on.

METHOD: read a job's OUTPUT before characterising it, and re-read the Apify balance
rather than inheriting it — the handoff's number was already stale by $0.14.
BUDGET: $0.93 of $5, resets Aug 20. A live send now costs ~$0.11 with the flag on.
```

---

## 0b. ▶️ START HERE

The design call that gated this lane for three sessions was made and built. One PR, two changes,
both verified against real bytes.

| | |
|---|---|
| **#517** | **Live-first ordering** — `allowScrape` now REORDERS the gather instead of unlocking its tail |
| **#517** | The Explore context record describes **the grid**, not `tiles[0]` |

🔴 **Nothing is deployed.** Production is still frozen at **2026-08-07** (`1be28832`) and does not
contain this code. Deploy is OFF deliberately, owner-confirmed. Never write a plan whose success
criterion is "watch it in production".

---

## 1. 🔴 THE RULING: authorization reorders the step

The predecessor handoff named the obstacle exactly and left it as a design call. The call:

> **An authorized run scrapes FIRST. The cache becomes the safety net behind it, not the answer
> ahead of it.**

`gather-for-run.ts` used to consult `allowScrape` only **after** the read-back returned, and the
read-back returned early on a hit. Since the 532-row corpus answers **95.5%** of real asks, the
authorization was unreachable on ~19 of every 20 sends. Two consequences, both live:

- `LIVE_SCRAPE_DEFAULT` could be **ON** — it has been, 21/21 flags — and **never once reach Apify**.
- A **second** tap of "Find new outliers" was answered by the write-through the **first** tap had
  just populated.

🔑 **Generalisable: a flag that only unlocks a branch downstream of an early return is a decoration.**
The three sessions that read this as a flag problem were each looking at a correct flag.

### Why the other three candidates lost

Recorded so nobody re-opens a settled question:

| option | why not |
|---|---|
| **Scrape + merge** (union live + cached) | `assessWarrant()` takes ONE axis. A mixed set needs a mixed-axis warrant that does not exist and was not designed. |
| **A separate `fresh` flag** (Phase 3's dropped `fresh?: boolean`) | Needs a UI affordance to be reachable, and the existing "Find new outliers" button **structurally cannot appear on a cache hit** — `scrapeAvailable` is computed on the miss path only. |
| **Tighten the `enough` bar** | Changes what every *unauthorized* user is told, and collides with the measured gate-1 finding (floor 0.6 → 34% pass rate). |

### What the fallback preserves

The cache is not deleted from the authorized path. An **empty or failed** scrape falls through to the
read-back, so the clockworks outage (`SUCCEEDED` + 0 items) cannot leave an authorized run *worse off
than a free one*. A failed scrape warns only when the cache cannot rescue it.

⚠️ **This costs ~1 Apify run per send while the flag is on.** That is the intent — the flag was
unreachable before — but it is real money against a $5/month cap. `scrape-default.ts` now says so;
it previously claimed a full cache hit still spares you, which stopped being true with this merge.

---

## 2. The live proof, and what it cost

One real run through `resolveAllowScrape(undefined)` — the env-flag path a body-less request takes —
on *"high protein breakfast"*, chosen because it hit the cache in **every** prior session:

```
[grounding] live scrape for "high protein breakfast" — 6 fresh rows
grounded: true | warrant: provenance | scrapeAvailable: false | 102.3s
@pulwasha_cooks    953,400 plays   similarity=null
@kyfitjourney    1,600,000 plays   similarity=null
@olyapinsy         467,100 plays   similarity=null
```

No `cache HIT` line at all. `similarity === null` on 3/3 rows is the scrape's own fingerprint
(`orchestrator.ts` sets it null by design) — those are not corpus rows wearing a costume.

**Cost $0.1120**, measured off `usageTotalUsd`, matching the estimate exactly.

---

## 3. The 240-char orphan — closed

`recordLineOf` capped skill records at 240 chars and the `outlier-grid` describer read `tiles[0]`
only, so the agent heard about **one video out of twelve**. *"Find me 3 viral formats"* — an ask the
grid already on the creator's screen fully answers — was unanswerable for a mechanical reason. It
fired on the manual Explore button, on every thread.

Still ONE line. It now quotes up to `MAX_GRID_TILES` (5) with each multiplier, and prints **both**
counts (`pulled 12 … quoting 5`) so the model cannot narrate seven videos it was never shown.

Two things worth carrying forward:

- 🔑 **The cap and the tile count are ONE decision.** A cap below the line the describer intends to
  emit does not save tokens — it hands the model a caption cut mid-word, which it reads back to the
  creator as a video title. 240 → 650, sized to the 5-tile worst case (~630).
- 🔑 **The baseline label rides per-tile, not in a header.** Printing the real shipped fixture showed
  **mixed** bases in one grid (`vs own` and `vs niche`), so a single header would have asserted a
  uniformity the describer never checked. *Printing the output changed the design* — the assertion
  alone would have passed either way.

---

## 4. clockworks profile mode — re-measured, still broken upstream

Ran the control the predecessor asked for, against one of the largest accounts on TikTok:

```
clockworks~tiktok-profile-scraper  profiles:["khaby.lame"]
→ SUCCEEDED   0 items   $0.0000   91.0s
```

**Unchanged from 2026-08-14.** Follower counts and the `X× vs their usual` multiplier remain
unavailable, and there is still **nothing to fix on our side**. The live verification run in §2
independently hit the same retry storm (`Scraped 0/1 profiles`) on our own handles — which means
nothing without this control, and that is exactly why the control is the rule here.

The 25s bound from #512 held: the run completed in 102.3s with the profile lookups failing under it.

---

## 5. State

```
main       a584b23e            prod deployed   1be28832 (2026-08-07)
tsc        0                   tests           6549 pass / 0 fail (566 files)
flags      21/21 ON locally    Apify           $4.07 of $5 — $0.93 left, resets 2026-08-20
```

⚠️ **`main` moved twice during this session** (`37427096` → `ee607e89` → `a584b23e`). Co-sessions
merged #514/#515/#516 underneath. No file overlap with this lane; `ideas-runner.ts` changed but only
downstream of retrieval (F-7 receipt diversity). **Re-measure with `git rev-parse` before branching
AND before merging.**

---

## 6. Traps this session paid for

- **The suite flakes under load, and the flake set is wider than documented.** Four full runs:
  `0 fail → 4 → 7 → 0`. The failures were `omni-analysis-*` (documented) **plus three composer
  files** — `composer-fold-on-close`, `composer-offline-gate`, `composer-stop-disc`. All five pass
  in isolation (26/26) and **none imports the changed modules**. Check WHICH files, and check
  whether they can even reach your diff, before attributing.
- **`node_modules/.bin/tsx` is a shell wrapper** — `node` chokes on it with a `SyntaxError` pointing
  at `basedir=$(dirname ...)`. Run `node node_modules/tsx/dist/cli.mjs` instead.
- **A one-line estimate is worth measuring even when it is right.** Per-run Apify costs were read
  off the real run history ($0.1120 for a full search+scrape, $0.001–$0.02 for the small ones)
  before spending, and the balance was $1.04 — not the $1.18 the predecessor recorded a day earlier.
  **Re-read the balance; do not inherit it.**
- **A test that encodes a superseded order must be changed deliberately, in place, with the reason.**
  One existing test asserted that a failed authorized scrape degrades to ungrounded. Under the new
  order a partial cache rescues it. Updated with a note rather than deleted — the claim it exists to
  make (warn only on a genuine degrade) is unchanged and still pinned.

---

## 7. Do next

1. **`SpendAuthority` (Phase 3 Task 1)** — survives the drop, **zero code exists**, and its specced
   consumer was the half that got dropped. Its real callers are the ten Apify doors, several of them
   **cron jobs with no route and no request**. Re-derive the seam; do not inherit it.
2. **The second orphaned defect** — *"Here are the proven outliers for {niche}"* is asserted over
   median rows; gate 1 passes `asdfghjkl qwerty zxcvbn` (#484). Raising the floor to 0.6 drops the
   pass rate to 34%. **Owner ruling needed** — it changes what two thirds of asks are told.
3. **Ask 3** — *"what makes an ending actually land on a short video?"*, still **0/6**. It belongs to
   the in-thread chat lane, not this one: it is the *general question* card shape, with no structural
   cue and no comparison shape for `compare-hint.ts` to catch. ~$40 of live sends to get a rate
   instead of a verdict. **Still never ruled on** — the owner asked what the test was, and did not
   authorize it.
4. **Re-test clockworks in a few days** — one control run, $0.00, §4 has the exact command shape.
5. **`platform` is still hardcoded `"tiktok"`** while the corpus carries Instagram and YouTube rows.
6. **A purchase, not a session** — the Apify $5 cap gates Phase 1's release, not its build or test.
