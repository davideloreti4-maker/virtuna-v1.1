# Handoff — the three orphans, closed (2026-08-14)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Merged:** **#502** — main at `755a1300`. Branch == main, tree clean, nothing half-finished.
**Verification:** prod build (port 3016), native desktop + mobile contexts, DB confirmed.

> ⚠️ **This document corrects four rows of `HANDOFF-2026-08-13-audit-rewalk.md` §2.** That table
> still lists F-13, F-14, F-18 and F-19 as 🔴 STILL LIVE. They were fixed in **#495**, one day
> after it was written. Read §3 here before re-investigating anything from that table.

---

## 0. ▶️ WHAT SHIPPED

The owner ruled on the three orphans (`HANDOFF-2026-08-14-ui-fixes-and-the-funnel.md` §2) —
surfaces that were live code with no reachable entry point, so each one's usage metric read 0
forever and 0 looked like a preference.

| orphan | ruling | what shipped |
|---|---|---|
| `ProfileInterviewModal` | **optimise, don't remove** | 10 cards → **3 questions inside the calibration wait** |
| `ContentForm` / `CommandBar` | **delete** | deleted, with `ExpertChatInput`/`Thread` behind them |
| `/go` walkthrough | **leave `/go`, decide later** | `/go` untouched; the unreachable events are now declared as such |

### The interview — why three, and why those three

`ONBOARDING-FUNNEL-DESIGN.md` §7 had already ruled it: *"fold goal · stage · pain into the wait,
infer everything else from the scrape."* `WaitQuestions` renders inside `CalibrationFlow`'s
streaming phase on `/welcome` — **no new screen and no added step, because the ~128s wait was
already being spent.**

The cut is two filters applied to all ten cards, and it is worth keeping because it is the
argument, not the answer:

1. **Does any generative skill READ the column?** Six do not — `content_style`, `cuts_per_second`,
   `reference_creators`, `posting_frequency`, `time_of_day_aware`, `pain_points` are absent from
   `ProfileRow`, the type whose docstring is *"only the columns the role-map reads"*. The video
   pipeline is their only consumer.
2. **Can the calibration scrape infer it?** Niche, platforms and past wins/flops all fall out of
   the account read, and `writing_voice_description` is already backfilled from the audience's
   auto-derived `creator_persona`. Asking for those spends attention on data we are about to
   measure anyway.

`primary_goal` passes both. `creator_stage` is *implied* by follower count but not equal to it — a
large dormant account is not "established" in the sense the role-map means. **`pain_points` fails
filter 1 and is kept anyway**, on the design ruling: no skill reads it, and it is the only field
that says what to build next. 🔴 **Do not cite it as engine grounding.**

### Two decisions in that component that are not ports of the old code

- **NO SUBMIT BUTTON, BY CONSTRUCTION.** The block lives inside a wait that ends on its own and
  unmounts it. Anything held in local state until a submit press would be discarded the moment
  calibration finished — silently, and most often for whoever typed the longest answer. Every
  answer writes the moment it is given, and a failed write raises a quiet inline retry rather than
  vanishing.
- **WRITES GO THROUGH THE API ROUTE, NEVER THE SUPABASE CLIENT.** The retired store called
  `.from("creator_profiles").update(...)` directly, so its free text reached
  `formatCreatorContext`'s prompt block without passing `sanitizeText` — the control-character and
  `<<<USER_CONTENT>>>` delimiter strip. `pain_points` is free text. That was a real gap in the old
  code, not a style preference.

`CalibrationFlow` gained a `duringWait` **slot, not a feature**. It is mounted by three surfaces
(`/welcome`, `audience-form`, `audience-detail`) and onboarding belongs to one of them —
`proof-unit-is-shared-do-not-edit` is the standing form of that lesson. The other two callers pass
nothing and are unchanged, and a test asserts it.

### `profile_interview_seen_at` now means "was asked"

It stamps **server-side, only when NULL**, from an empty PATCH that `WaitQuestions` fires on mount.

It had to. Stamping on the first *answer* would leave a creator who saw the questions and skipped
them indistinguishable from one never shown them — rebuilding, one layer up, exactly the
misreading this work exists to end. The value is never accepted from the request body; same rule
the route already applies to `user_id` and #497 applied to `funnel_events.origin`.

---

## 1. 🔴 WHAT I ALMOST DELETED

**The 9 card pickers are LIVE.** My own plan said "delete the other 7 cards", and it was wrong on
the facts: `/settings` → `settings-page.tsx:121` → `CreatorProfileSection` → `ProfileSettingsForm`
mounts nine of the ten. Only `voice-description-input.tsx` was exclusive to the dead modal.

**Every `creator_profiles` column and every row is untouched.** `AUDIT-E2E-2026-07-26.md` had
already written the reason down and I nearly repeated the mistake it was warning about: deleting
the interview UI is correct, deleting the data is not — 23 files read `niche_primary` alone, and
the columns lose their only manual source precisely for cold-start users, who are the ones with no
calibrated audience to derive from.

🔑 **The generalisation: "unreachable" is a property of a MOUNT CHAIN, not of a file.** Two
surfaces can import the same component and only one of them be dead. Trace every importer to a
route before deleting anything, and do it again after the ruling — the ruling was given on my
summary, and my summary was wrong.

**Deleted:** `content-form.tsx`, `command-bar/` (CommandBar, ExpertChatInput, ExpertChatThread),
`profile-interview-modal.tsx`, `profile-interview-store.ts`, `use-pending-profile-gate.ts`,
`cards/voice-description-input.tsx`, and their tests.

⚠️ **`deriveSeedPrompts` (`lib/chat/seed-prompts.ts`) is now orphaned** — CommandBar was its only
consumer and only its own test remains. Left in place deliberately: it is a pure function, not a
metric-emitting surface, and widening a deletion past the ruling is how live code gets removed.
Flagging it rather than acting on it.

---

## 2. The unreachable funnel events are now declared

`UNREACHABLE_FUNNEL_EVENTS` in `funnel-events.ts` lists the three that genuinely cannot fire —
`demo_fix_open`, `demo_wall_shown`, `reveal_shown`, emitted only from `beats.ts`, which no route
mounts. `unreachable-events.test.ts` checks the list **against the tree**: it fails if any route
ever mounts the walkthrough, and the instruction in the failure is to *delete the entries*, not
loosen the assertion. I reverted the fix to confirm the guard is not vacuous.

🔴 **`checkout_open` is deliberately NOT on that list, and the previous handoff was wrong to
include it.** It also fires from `/go/page.tsx` and `checkout-modal.tsx`, both live. **Its zero is
real** and means the money screen has genuinely never been opened. Marking it would have explained
away the one number the whole funnel exists to watch. Four events were claimed unreachable; three
are.

**Also corrected:** `funnel-events.ts` opened with *"⚠️ THERE IS NO SINK YET… Nothing leaves the
browser."* **The sink is wired** — `funnel-provider.tsx` attaches `beaconSink` on mount, which is
why `funnel_events` has rows at all. A header comment claiming a system is unwired, on a system
that is wired, is the same class of defect as a stale doc table.

**`/go` is untouched.** Mounting the walkthrough would reopen the 2026-07-27 owner call that
replaced it with `HeroShowcase`; the owner deferred that, deliberately. It is a product decision,
not a cleanup — the walkthrough is complete, runs on a real frozen production analysis, and is the
only built surface carrying the $1 tripwire.

---

## 3. ⚠️ CORRECTIONS TO `HANDOFF-2026-08-13-audit-rewalk.md` §2

**FIVE rows in that table are stale, not four.**

| # | that table says | actually | fixed by |
|---|---|---|---|
| **F-4** | 🔴 STILL LIVE, WORSE | 🟢 **FIXED** — `"Borrowing shape from N proven videos"` → `"Reading shape from N…"`. Guarded by *"never asserts a COMPLETED outcome — the cards do not exist yet"* | **#491**, 2026-08-13 |
| **F-13** | 🔴 composer guillotines content | 🟢 **FIXED** — 40px `.composer-veil`, `fadesAtTop: true` both viewports. It is a **mask**, not a gradient fill; a probe reading `backgroundImage` reports `"none"` on the working surface | #495 |
| **F-14** | 🟠 headings still 0 | 🟢 **FIXED** — `headings: 8` (`h1` document · `h2` per turn · `h3` per card) | #495 |
| **F-18** | 🔴 ☰ overlays body text | 🟢 **FIXED** — 66px `.nav-scrim`, faded, `pointer-events: none` | #495 |
| **F-19** | 🔴 84 tap targets under 40px | 🟢 **substantially fixed** — 4 residual, all understood. **39 of the 84 were invisible-but-tappable, the rightmost `Delete thread`** — that was the real bug, not the size | #495 |

🔴 **F-4 IS THE INTERESTING ONE, AND I GOT IT WRONG FIRST.** The first version of this handoff
listed it as open work — item 2 of §4, "fix the loading copy" — which would have sent the next
session to redo merged work. **Inside the document whose whole subject is stale statuses.**

The mechanism is worth knowing because it will happen again: **#491 shipped the fix AND the
audit-rewalk table in the same commit.** The table is the *finding that motivated the fix*, written
in its pre-fix voice, and it was never updated once the fix landed beside it. So the row is not
merely out of date — it was never true as of the commit that introduced it.

🔑 **A finding and its fix in one PR means the finding's own document describes a state that no
longer exists at merge.** Before treating any row of an audit table as open, `git log --grep` the
finding ID. That is what caught this, after re-deriving three other rows by hand had not.

**What remains near F-4 is NOT copy work.** The ~4% proof rate that made the old headline dishonest
is `templateInstantiated` correctly stripping citations the model did not earn. **It is a correct
guard. Never revert it.**

**Re-derived today, still true:**

| # | finding | checked how |
|---|---|---|
| **F-7** | same source can back 3 of 5 cards | `build-proof.ts` is still a pure `sourceIndex → example` lookup. **No diversity constraint exists in the file** |
| **F-1** | pack renders twice, ~8% | no de-duplication of already-delivered packs anywhere in `lib/tools/` or `api/tools/`. `repeat-ask.ts`'s "duplicate check" is a *different* thing — it tests an ask naming a different skill |
| **F-22** | corpus multipliers | `outlier_teardowns`: **532 rows, `follower_count` set on 0 of them**, `outlier_multiplier` on 396, and exactly **1 distinct `baseline_label`** |

⚠️ **F-1 and F-7 were ALSO attempted once**, in `7d4bc133` (2026-08-10, *"F-3/F-7 receipts, F-1
re-answer"*). The 08-13 re-walk re-measured both as still live **after** that attempt, and today's
code check agrees — so they stand. Recorded so nobody reads that commit title as a close.

**Inherited, NOT re-derived** — treat as claims, not measurements: F-15 (the second accent
element) and the four never-measured rows F-3 · F-8 · F-11 · F-12, each of which needs a live run.

---

## 4. Open, in the order I would take them

1. **F-1 — the pack renders twice (~8%).** The largest remaining user-visible defect: two competing
   closing questions stacked on screen. The previous handoff's own advice still stands and is
   non-obvious — **key the fix on duplication of cards already delivered THIS TURN, not on shape**,
   and remember the re-answer is a **separate message**, so a "prose in the same message" query
   returns a clean, plausible, entirely wrong "F-1 is fixed".
2. **F-7 — source diversity in `build-proof.ts`.** Pure code, no live run needed. `build-proof.ts`
   is a pure `sourceIndex → example` lookup with nothing preventing the same source backing three
   cards. Unreproducible on screen only because proof is nearly always absent — which is a reason
   it is *unseen*, not a reason it is *fixed*.

🔴 **`COMPOSED_CARDS` WENT DEFAULT ON WHILE THIS WAS BEING WRITTEN** (`api/tools/chat/route.ts:204`,
owner ruling 2026-08-14, PR #503, merged from a trunk session — main moved from `755a1300` to
`2aee9a6d` between the code commit and the docs commit). The lane memory still records it as
defaulting OFF.

That raises item 2. **F-7 is a card defect, and the only reason the last audit could not reproduce
it on screen was that proof was nearly always absent.** More cards means more chances for it to
surface — it goes from present-but-unseen to visible. **Re-measure the card rate before quoting any
number from the earlier handoffs**, and remember `card-rate-is-25-percent-and-per-ask`: every rate
measured through a rehydrated thread measured the wrong thing. Send `maven_active_thread=__new__`.

3. **The four unmeasured rows** — F-3, F-8, F-11, F-12 all need one live run and nobody has done it.
4. **The sidebar's pin/rename/delete are 30×44, not 44×44.** Three 44px hit areas 2px apart would
   overlap by 20px and the later sibling would win the tap — worse than small. The real fix is a
   `⋯` menu, which is a design call, not a CSS one.

---

## 5. ⚠️ TRAPS THIS SESSION PAID FOR

Every one produced a confident wrong answer first, and all of them are the *same shape* as the
lesson this lane already recorded — turned inward, on my own instruments.

| the reading | why it was wrong |
|---|---|
| "the block does not render — /welcome is blank" | `/welcome` **redirects to `/home`**. The account has a calibrated audience and the page *adopts* it, finishing onboarding on mount |
| nulling `onboarding_completed_at` in prod will let me see it | **wrong instrument.** It mutates a shared prod row to observe a *client-side* branch — and it silently flipped `onboarding_step` to `completed` as a side effect when the adopt path ran anyway. Both reads can be answered by the browser instead |
| stub `rest/v1/audiences` and the adopt path stops | the adopt path calls **`GET /api/audiences`, a Next route** — the request never goes to PostgREST. Stubbing the wrong layer looks exactly like a stub that does not work |
| "stage persists on click → FAIL" | **my probe's own bug.** It paired each response to "the first request still missing a status" while two PATCHes were in flight. The UI had already shown the save succeeded |
| `text-foreground-tertiary` will style the hint line | that token **does not exist** — the third tier is `foreground-muted`. The class generates nothing and fails silently |

🔑 **The generalisation, and it is the same one the last session ended on: before believing an
absent signal, prove the path that produces it can run.** Four times here the answer was "the code
that would emit this cannot execute in these conditions", and zero times was it "the thing didn't
happen". That now applies to my own probes, not just to production data.

**And one that is new:** ⚠️ `text-foreground-tertiary` is also live in `extension-card.tsx` and
`upgrade-prompt.tsx`. **Two files are styling with a class that does not exist.** Not fixed here —
out of this ruling's scope — but it is a real, silent defect and a one-line fix each.

---

## 6. Verification recipe (used today, works)

```bash
npm run build && npm run start -- --port 3016      # PROD build; dev overlays fake UI bugs
node scripts/mint-auth-state.mjs      http://localhost:3016
node scripts/probe-wait-questions.mjs http://localhost:3016    # 12/12, both viewports native
```

**`probe-wait-questions.mjs` is the model for anything touching `/welcome`.** It reaches the
calibration wait with **no Apify call and no database write** by fulfilling four requests locally:
`GET /api/audiences` (the adopt path), `POST /api/audiences` (the draft create),
`POST /api/audiences/calibrate` (the ~128s scrape) and the browser's `creator_profiles` read. The
PATCHes under test are deliberately **not** intercepted — persistence is the claim, so they hit the
real route and the real database.

💰 **Why that matters:** a real run is a ~128s Apify scrape on a **$5/mo capped account that dev
shares with prod**. The calibrate stage `autoStart`s, so simply walking `/welcome` spends it.

⚠️ **The e2e account's profile row is written by this probe.** Record it first and restore it
after — this session did, twice, and `onboarding_step` was an unnoticed casualty of the first
attempt until the restore caught it.

---

## 7. Housekeeping

- **Deploy is OFF, owner-confirmed 2026-08-13, and that is a CONSTRAINT, not a task.** Do not
  propose reconnecting it. What it forbids: never write a plan whose success criterion is "watch it
  in production". `numenmachines.com` 404s **by design**.
- **Never backfill `funnel_events.origin`.** NULL means "recorded before the column existed". This
  session's probe runs added rows with `origin = localhost:3016` — which is exactly what the column
  exists to let you filter out.
- **No migration in this PR.** `profile_interview_seen_at`, `primary_goal`, `creator_stage` and
  `pain_points` all already existed. No DDL was applied and none is needed.
- 🔴 The lane memory index is still STALE (it says "session 12"/"session 13"). The worktree path
  guard blocks writing to `~/.claude/projects/.../memory/` from here; it can only be fixed from
  trunk. **The merged handoffs are authoritative.**
- Other lanes are unaffected and still open on their own branches: remix
  (`NEXT-SESSION-2026-08-14-remix.md`), onboarding UI refinement, insights parity, library rework.
