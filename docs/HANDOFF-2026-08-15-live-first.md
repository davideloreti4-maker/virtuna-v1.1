# Handoff — the cache-first ordering is fixed, and the live path is now reachable (2026-08-15)

**Lane:** composed-card / Apify-first live sourcing · worked from **trunk** `~/virtuna-v1.1`
**Merged this session:** **#517**, **#519**. (No sha pinned — see §5.)
**Predecessor:** `docs/HANDOFF-2026-08-14-live-sourcing.md`

---

## 0. ▶️ PASTE THIS TO START THE NEXT SESSION

```
Read docs/HANDOFF-2026-08-15-live-first.md. MEASURE main yourself with git rev-parse before
you touch anything — this doc deliberately pins no sha, because it moved TWICE under me in one
session (co-sessions merged #514/#515/#516) and a pinned sha here was wrong within a day.
Check `git rev-parse --abbrev-ref HEAD` before every operation in trunk, and never `git add -A`
there — a co-session's blanket add committed my work into its commit.

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

BOTH EARLIER RULINGS ARE NOW MADE — do not re-ask them:
  1. Gate-1 floor: MEASURED at the right bar (§8). The "0.6 → 34%" framing was wrong;
     0.6 actually keeps 66-74% of asks, and 0.56 kills all four contentless controls
     while keeping 85-94%. Open part is WHICH REMEDY (floor at 0.56 / fix the copy /
     both), not the numbers. §8 argues a floor alone cannot work: `ok` (0.553)
     outscores the corpus's own `education-science` (0.541).
  2. Ask 3: DO NOT SPEND NOW. Re-measure at n=6 after the Apify reset (2026-08-20).

METHOD: read a job's OUTPUT before characterising it, and re-read the Apify balance
rather than inheriting it — the handoff's number was already stale by $0.14.
Also: do not interpolate a measurement you can just ask the shipped function for (§8).
BUDGET: $0.93 of $5, resets Aug 20. With LIVE_SCRAPE_DEFAULT on, ~$0.11 per send —
and since #519 that is true of CHAT sends too, which were free this morning.
```

---

## 0b. ▶️ START HERE

The design call that gated this lane for three sessions was made and built. One PR, two changes,
both verified against real bytes.

| | |
|---|---|
| **#517** | **Live-first ordering** — `allowScrape` now REORDERS the gather instead of unlocking its tail |
| **#517** | The Explore context record describes **the grid**, not `tiles[0]` |
| **#519** | `LIVE_SCRAPE_DEFAULT` now reaches **chat-dispatched** generators — #517 alone fixed a path half the product doesn't take (§2b) |

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
| **Tighten the `enough` bar** | Changes what every *unauthorized* user is told, and collides with the gate-1 finding. ⚠️ The "floor 0.6 → 34%" number quoted here when this table was written is **superseded by §8** — it measured a different bar. The objection stands; the arithmetic behind it does not. |

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

## 2b. 🔴 …and the flag still didn't reach chat (#519)

Found by the owner asking whether ask 3 had anything to do with Apify. It doesn't — but checking
surfaced that **#517 fixed the ordering on a path half the product doesn't take.**

`resolveAllowScrape` lived **only** in the three HTTP route handlers. `skill-dispatch.ts` calls
`runIdeasPipeline` / `runHooksPipeline` / `runScriptPipeline` **directly**, passed no `allowScrape`
at all, and the runners forward `input.allowScrape` with no env fallback (`ideas-runner.ts:544`).

| path | before #519 |
|---|---|
| composer routes | live-first, as merged in #517 |
| **chat agent dispatch** | **cache-first — `LIVE_SCRAPE_DEFAULT` was invisible** |

So asking Maven in chat for ideas still answered from the corpus, and **no measurement of the live
path taken through chat could have been true.**

🔑 **Same shape as the bug beneath it, one layer up: an authorization that doesn't reach the path the
product actually takes.** Worth a habit — when a flag is fixed, enumerate every CALLER of the thing
it gates, not just the one you were looking at. The route was the obvious caller; the dispatcher was
the common one.

⚠️ **Cost model changed:** with the flag on, a chat-dispatched generator run now costs ~$0.11 where
it was free. This is also why an ask-3 probe run was Apify-free before today and would not be now.

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
main       MEASURE IT          prod deployed   1be28832 (2026-08-07, frozen)
tsc        0                   tests           6549 pass / 0 fail (566 files)
flags      21/21 ON locally    Apify           RE-READ IT — $0.93 left on 2026-08-15, resets 08-20
```

⚠️ **`main` is deliberately not pinned here, and neither is the Apify balance.** Both were recorded
as a sha/number in earlier handoffs and both were wrong within a day: `main` moved twice *during*
one session (`37427096` → `ee607e89` → merge of #517 → merge of #519) as co-sessions merged
#514/#515/#516 underneath, and the inherited balance was already $0.14 stale when it was read.
🔑 **The remedy for a fast-moving fact in a handoff is to make the reader re-derive it, not to sync
a copy of it** — a synced copy is just a slower lie. `git rev-parse main`; read `usageTotalUsd`.

No file overlap between those co-session merges and this lane; `ideas-runner.ts` changed but only
downstream of retrieval (F-7 receipt diversity).

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
2. **The second orphaned defect** — *"Here are the proven outliers for {niche}"* asserted over median
   rows. **MEASURED 2026-08-15 at the right bar; see §8. The "0.6 → 34%" framing was wrong.**
   Still needs an owner ruling on *which* remedy, but not on these numbers.
3. **Ask 3** — *"what makes an ending actually land on a short video?"*, still **0/6**. It belongs to
   the in-thread chat lane, not this one: it is the *general question* card shape, with no structural
   cue and no comparison shape for `compare-hint.ts` to catch. ~$40 of live sends to get a rate
   instead of a verdict.
   ✅ **RULED 2026-08-15: do not spend now. Re-measure at n=6 after the Apify reset (2026-08-20).**
   Two grounds: Apify is at $0.93 and since #519 every chat send draws ~$0.11 from it, and the 0/6
   **predates #514**, which turned on `ENGINE_GEN_CONVERSATION` and touched `chat-agent-loop.ts` —
   so the old rate may already be void and re-spending would measure a build nobody re-baselined.
4. **Re-test clockworks in a few days** — one control run, $0.00, §4 has the exact command shape.
5. **`platform` is still hardcoded `"tiktok"`** while the corpus carries Instagram and YouTube rows.
6. **A purchase, not a session** — the Apify $5 cap gates Phase 1's release, not its build or test.

---

## 8. 🔴 The gate-1 ruling was framed on the wrong bar — measured 2026-08-15

**`scripts/probe-warrant-floor.ts`** (new). DashScope embeddings only, **zero Apify**, nothing
written. 346 queries: 158 distinct real prod asks (raw + boilerplate-stripped), the corpus's own 18
niche labels, and the 12 controls carried verbatim from `probe-warm-coverage-control.ts`.

### What was wrong with the question

The open ruling read *"raising the floor to 0.6 drops the pass rate to 34%"*. That 34% comes from
`probe-warm-coverage.ts`, whose bar is **≥ 3 rows passing `isProofGrade`** at a `wide` fetch of 600.
But the sentence the ruling is about is licensed by `assessWarrant("topical", …)`, whose bar is
**`WARRANT_MIN_ROWS = 1`** (`warrant.ts:79`) over the rows retrieval already returned — one row, no
`isProofGrade` test, no second fetch.

They are also **two separate env knobs**, and `warrant.ts:17` records that they are *allowed* to
differ and already do on the chat path (recall 0.4 / warrant 0.5):

| knob | default | question it answers |
|---|---|---|
| `GROUNDING_CACHE_MIN_SIMILARITY` | 0.5 | may the model **see** this row? |
| `GROUNDING_WARRANT_MIN_SIMILARITY` | 0.5 | may we **cite** it about the subject? |

🔑 **So the honesty fix does not have to cost the answer anything.** Raising only the *warrant*
floor leaves every row in front of the model and changes only what we are entitled to assert —
`warrantNote` switches to the honest wording. The choice was never "34% of asks keep their rows".

### The measurement

Pass = `assessWarrant` returns `grounded`, i.e. we may front the proof claim. Evaluated through the
**shipped** function at every floor.

```
floor    A-raw(158)     B-subject(158)  C-labels(18)   D-control(12)  contentless(4)
0.50   157 ( 99.4%)  157 ( 99.4%)   18 (100.0%)    6 ( 50.0%)  4/4   ← today
0.55   151 ( 95.6%)  144 ( 91.1%)   16 ( 88.9%)    3 ( 25.0%)  1/4
0.56   149 ( 94.3%)  134 ( 84.8%)   16 ( 88.9%)    2 ( 16.7%)  0/4   ← mash all dead
0.60   117 ( 74.1%)  105 ( 66.5%)   13 ( 72.2%)    1 (  8.3%)  0/4
0.65    49 ( 31.0%)   41 ( 25.9%)    4 ( 22.2%)    1 (  8.3%)  0/4
```

- **0.60 does not cost 66% of asks. It costs 26–34%** (74.1% / 66.5% survive). The 34% in the old
  framing lands near **0.64** on this bar.
- **0.56 is the knee.** All four contentless controls are refused there — `asdfghjkl` 0.521,
  `the` 0.522, `yes` 0.547, `ok` 0.553 — while 84.8–94.3% of real asks keep the claim. Everything
  0.6 buys over 0.56 on the controls is **nothing**; they were already gone.
- 6 of the 12 controls **retrieve zero rows at all** (Peloponnesian War, ballast water, …). Those
  never reached the warrant question; they fail at the recall floor. #484's finding is entirely
  about the *near*-domain controls.

### ⚠️ The finding that argues against raising the floor at all

**`ok` (0.553) outscores two of the corpus's own niche labels — `education-science` (0.541) and
`other` (0.540).** So no warrant floor can separate contentless input from the corpus's own
vocabulary: **any floor that kills `ok` also refuses the proof claim on those two labels.** Same
shape as the `carbonara recipe` 0.673 note in `retrieve.ts` — which, incidentally, is *not* a defect
(the corpus genuinely holds food rows; `food` itself measures 0.635, *below* carbonara). That is a
**ranking** fault, not a floor one.

🔑 **A floor is a blunt instrument here, and the probe says so in its own output.** Cosine distance
on this corpus does not encode "contentful"; it encodes "near the corpus". That is an argument for
fixing the **claim** rather than the threshold — the copy option — or for doing both, with the floor
set at 0.56 rather than 0.60 because 0.60 costs ~18 further points of real coverage for zero
additional control rejections.

### Reproduce

```
node node_modules/tsx/dist/cli.mjs scripts/probe-warrant-floor.ts [--limit N]
```

⚠️ **Do not score a few floors and interpolate the rest from a stored `topSim`.** `grounded` at
floor *f* is algebraically `topSim >= f`, so it looks free — but a `topSim` rounded for display
disagrees with the real predicate at the boundary. The first cut of this probe did exactly that and
was off by one row at 0.60 (and by up to three elsewhere). Ask the shipped function at every floor
you intend to report; the probe now does.
