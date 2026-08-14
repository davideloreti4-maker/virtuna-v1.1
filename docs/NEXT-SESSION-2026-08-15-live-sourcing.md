# Next session — copy-paste brief (written 2026-08-14)

**Lane:** composed-card / Apify-first live sourcing · trunk `~/virtuna-v1.1`
**Merged this session:** #503 · #511 · #512 · `main` at `0fe54c3c`
**Full record:** `docs/HANDOFF-2026-08-14-live-sourcing.md`

---

## ▶️ PASTE THIS TO START

```
Read docs/HANDOFF-2026-08-14-live-sourcing.md first. main was 0fe54c3c at handoff —
re-measure, trunk is shared and moves under you.

WHERE THINGS STAND, IN ONE PARAGRAPH: live Apify sourcing works and its results
genuinely match the ask (measured: 10/10 on-topic videos for a ballast-water
question, real creators, real view counts). It is NOT hashtag-based and never was.
Every feature flag is ON in .env.local (21/21, verified by loading the file the way
the app does). Nothing is deployed — prod is frozen at 2026-08-07 and does not
contain this code at all.

ONE DESIGN CALL GATES THE LANE. Ask me, then act:

  THE CACHE ANSWERS FIRST. gather-for-run.ts:377-385 returns early on a cache hit,
  so `allowScrape` is only consulted after a MISS — and the 532-row corpus almost
  never misses (95.5% of real asks; even "restoring vintage fountain pens" hit).
  A live-first product needs a deliberate bypass. Phase 3's `fresh?: boolean` was
  going to be it and that plan was dropped. Decide the bypass before building.

THEN, no decision needed:
  - The 240-char orphan: recordLineOf (on-screen.ts:275) caps skill records at 240
    chars and the outlier-grid describer (on-screen.ts:114) reads tiles[0] ONLY, so
    the agent hears about ONE video of twelve. "Find me 3 viral formats" is
    unanswerable for a mechanical reason. Live on the manual button TODAY.

DO NOT:
  - Do not turn on BILLING_ENFORCE_QUOTA (refuses every run — free tier is limit:0)
    or GROUNDING_CHAT_PREFLIGHT (revives a dead path ON TOP of the agent loop).
    They are off deliberately. Do not "complete the set".
  - Do not try to fix clockworks profile mode. profiles:["khaby.lame"] returns 0
    items on BOTH actors — upstream, not ours. Follower counts and the "X× vs their
    usual" multiplier are unavailable until they fix it. #512 already bounded the
    wait. Re-test with one control run; do not debug our handles.
  - Do not propose reconnecting the deploy. OFF deliberately, owner-confirmed.
    Never write a plan whose success criterion is "watch it in production".
  - Do not build Phase 3's gate chain. Tasks 2-9 were DROPPED this session.
  - Do not `git add -A` in trunk. A co-session rewrote my commits mid-session.

VERIFY WITH REAL BYTES. A live chat probe costs credits; an Apify run costs the $5
cap ($1.18 left, resets Aug 20). Read a run's dataset before theorising about it —
I published two conclusions this session that one fetch would have killed.
```

---

## The three merges

| PR | what |
|---|---|
| **#503** | `COMPOSED_CARDS` default **ON** (`!== "false"`) + Phase 3 re-scoped: gate chain dropped, `SpendAuthority` + the ten Apify doors is the lane |
| **#511** | `LIVE_SCRAPE_DEFAULT` — env flag authorizing the live scrape without the "Find new outliers" tap. Env flag, **not** a changed default, on purpose |
| **#512** | 25s deadline on the follower lookup. Gather **112s → 85s**, run **132.5s → 113.7s** |

## Two claims I published this session that were WRONG

Recorded because both were avoidable by one measurement, and the next session will
be tempted by the same shortcuts.

| I said | Truth |
|---|---|
| *"We paste the whole sentence into TikTok search — that's the defect"* | TikTok handled it fine. 10/10 on-topic results. One `fetch` of the run dataset would have killed it. |
| *"The failing scrapes burned budget on retries"* | They cost **$0.0000**. Four runs, SUCCEEDED, 0 items, $0. Read `usageTotalUsd` off `/v2/actor-runs/<id>`. |

## Live state

```
main            0fe54c3c          prod deployed   1be28832 (2026-08-07)
flags           21/21 ON          Apify           $1.18 of $5, resets Aug 20
tests           6470 pass / 0     tsc             0
```

Start the app with `npm run dev -- --port 3000`; a launchd reaper kills it after
~10 min idle (exit 0 is the reaper, not a crash). Signed-in walk:
`node scripts/mint-auth-state.mjs http://localhost:3000`.
