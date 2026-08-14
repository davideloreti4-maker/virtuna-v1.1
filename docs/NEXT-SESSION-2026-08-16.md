# Next session — copy-paste brief (written 2026-08-14)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Main at handoff:** `755a1300`. Branch == main, tree clean, nothing half-finished.
**Merged this session:** **#502** — the three orphans, closed.

---

## ▶️ PASTE THIS TO START

```
Read docs/HANDOFF-2026-08-15-three-orphans.md.

Repo ~/virtuna-in-thread-chat, branch lane/in-thread-chat, main at 755a1300. tsc + build +
6419 tests all green, working tree clean.

⚠️ RE-CHECK MAIN BEFORE YOU BRANCH. It moved twice underneath me last session — a trunk
session merged #498 while I was reading the brief. `git fetch` then `git rev-parse origin/main`.

CONTEXT IN ONE LINE: the three orphans are closed. The interview is now 3 questions inside
/welcome's calibration wait; ContentForm/CommandBar are deleted; /go is untouched by owner
ruling. What remains is the F-list, and four of its rows were already fixed.

DO THIS FIRST, before anything else:
  Read HANDOFF-2026-08-15-three-orphans.md §3. Four rows of the F-table in
  HANDOFF-2026-08-13-audit-rewalk.md are STALE (F-13/14/18/19 were fixed in #495).
  Do not re-investigate them.

THE WORK, in order:
  1. F-1 — the pack renders twice, ~8%. The largest user-visible defect left. Key the fix on
     duplication of cards ALREADY DELIVERED THIS TURN, not on shape. The re-answer is a
     SEPARATE message — a "prose in the same message" query returns a clean, plausible,
     entirely wrong "F-1 is fixed".
  2. F-4 — the loading copy promises proof the cards then disclaim. Fix the COPY.
  3. F-7 — source diversity in build-proof.ts. Pure code, no live run. Note fixing F-4
     without F-7 will make F-7 visible.

DO NOT:
  - Do not remove the templateInstantiated guard in output-guards.ts, and do not touch the
    ~4% proof rate. Both are CORRECT. Removing either puts fake citations in front of users.
  - Do not propose reconnecting the deploy. OFF, deliberately, owner-confirmed 2026-08-13.
  - Do not use "nobody uses it yet" as a reason not to build. Owner ruling.
  - Do not backfill funnel_events.origin. NULL is the honest value.
  - Do not delete the 9 card pickers in components/app/cards/. /settings mounts them. LIVE.

💰 Do not walk /welcome with a real handle. The calibrate stage autoStarts a ~128s Apify
scrape on a $5/mo capped account that dev shares with prod. Use
scripts/probe-wait-questions.mjs — it reaches the wait with no scrape and no DB write.

VERIFY IN A BROWSER on a PROD build, not dev, and not the suite. Recipe: handoff §6.
```

---

## The one thing to get right

**Before believing an absent signal, prove the path that produces it can run.**

Four times last session the answer was *"the code that would emit this cannot execute in these
conditions"*, and zero times was it *"the thing didn't happen"*. That now applies to your own
probes, not only to production data — the session's single FAIL was the probe's own
response-pairing bug, against a save the UI had already confirmed.

The corollary that cost the most: **"unreachable" is a property of a MOUNT CHAIN, not of a file.**
Two surfaces can import the same component and only one be dead. I had a ruling to delete seven
card pickers and nine of them turned out to be live on `/settings`.

---

## Known-good, do not re-litigate

- The 3-question block, the `duringWait` slot, and the server-side `profile_interview_seen_at`
  stamp — all verified 12/12 on a prod build with the DB confirmed. Handoff §0.
- `checkout_open` is **not** an unreachable event, despite an earlier handoff saying so. Three are
  unreachable, not four. Handoff §2.
- The funnel sink **is** wired (`funnel-provider.tsx`). The old "no sink yet" comment was stale.

## Loose ends flagged but deliberately not taken

- `text-foreground-tertiary` does not exist as a token; `extension-card.tsx` and
  `upgrade-prompt.tsx` both style with it. Silent no-op, one-line fix each.
- `deriveSeedPrompts` is orphaned now that CommandBar is gone. Pure function, left in place.
- The lane memory index still says "session 12"/"session 13". Only fixable from trunk. **The
  merged handoffs are authoritative.**
