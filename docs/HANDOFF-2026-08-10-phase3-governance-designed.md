# Handoff — Phase 3 governance DESIGNED (spec + plan), nothing built (2026-08-10)

**Branch:** `main` (docs only; no source touched this session)
**Main at handoff:** `77d0c729` — fast-forwarded past 4 co-session commits (platform-concept lane,
composer/arrival UI; no overlap with this work)
**Apify spend this session:** $0.00 — one free `users/me/limits` read, no scrapes.
Account still **$3.06 / $5.00**, cycle ends `2026-08-20T23:59:59.999Z`.

---

## 1. What this session produced

Two documents. **No code.**

| doc | what it is |
|---|---|
| `docs/superpowers/specs/2026-08-10-apify-governance-phase3-design.md` | The full design, sections 1–4, owner-approved section by section. Supersedes §5 of the 2026-08-10 Phase-1 handoff, which carried section 1 only. |
| `docs/superpowers/plans/2026-08-10-apify-governance-phase3.md` | 9 TDD tasks with real test code, exact file paths, and the verify commands. |

Read the **spec** first, then the plan. The spec's §1.1, §3.7 and §4.3 contain traps that unit tests
cannot catch; the plan repeats them at the task that hits each one.

### The three decisions taken this session (7–9, on top of the six already recorded)

| # | decision |
|---|---|
| 7 | `SpendAuthority` is its **own module**; the chat dispatcher is its only wired caller in Phase 3 |
| 8 | The reserve floor is a **concurrency absorber only** — it does not reserve a cron share |
| 9 | A cap-out **names the reset date, not the platform's accounting** |

Decision 7 matters more than it looks: **ten other doors** drain the same $5 cap — `/api/discover`,
`/api/analyze`, `/api/profile`, `connected-accounts/connect`, `channels/ingest`, `explore-runner`,
`account-read`, and five cron jobs. Phase 3 does not wire them. It does not have to: `SpendAuthority`
reads the **true** remaining budget, so a 3am cron that drains the cap makes the agent correctly
refuse. Wiring the rest is a tracked follow-up, not a hole.

---

## 2. Facts discovered this session — do not re-derive

### The live Apify payload carries a reset date the handoff never mentioned

```json
{ "data": {
    "monthlyUsageCycle": { "startAt": "2026-07-21T00:00:00.000Z",
                           "endAt":   "2026-08-20T23:59:59.999Z" },
    "limits":  { "maxMonthlyUsageUsd": 5 },
    "current": { "monthlyUsageUsd": 3.0609334113115043 } } }
```

`monthlyUsageCycle` is load-bearing — it is where the honest "until Aug 21" comes from, and it tracks
whichever token is active, so it survives the rotating free accounts.

⚠️ **Format it in UTC explicitly.** `endAt` is `…T23:59:59.999Z`; rendering that instant in server
locale prints "Aug 20" for every reader west of UTC — an off-by-one in the one sentence whose entire
job is to be trustworthy.

### `RetrievedExample` silently drops `posted_at`

`SharedMatchRow` carries it (`corpus.ts:307`) and `match_shared_teardowns` returns it.
`matchRowToExample` (`retrieve.ts:288`) just doesn't map it — so **no consumer in the app can report
corpus age**. The fix is one optional field plus one line; no migration, no RPC change. Optional
because two production constructors and ~6 test literals build that shape by hand.

### The two measurements of Apify run cost disagree

`verify-apify-first.ts` records `$0.0513/run`; this session's four runs averaged `$0.0265`
($0.106 ÷ 4). The plan keeps the **higher** — it sizes a safety floor, and cost genuinely varies
(`scrapeVideos(handle, 30)` is far bigger than a six-post pull).

### `threads.sim_seals` is the storage precedent

`20260723090753_thread_sim_seals.sql` — jsonb column on `threads`, "no new table, RLS inherited from
the thread row." The proposal slot copies it. The single slot **enforces one-live-proposal-per-thread
by construction**, which is also why the per-turn cap exists: a second proposal would overwrite the
first and leave a rendered card whose token is already dead.

---

## 3. A defect found in `chat-agent-loop.ts`, unfixed

`chat-agent-loop.ts:1266`

```ts
return { text: unbound ? guard.flush() : fullText, skillRuns, uiBlocks, toolCalls };
```

The guard is armed on `guardArtefacts = (deps.sealedVisitor ?? false) || unbound` (line 883). A
**sealed visitor who is not `unbound`** streams redacted text and persists the **raw** text — so the
redaction holds for one turn, the leaked line reappears on reload, and it lands in the next turn's
replayed transcript as precedent. That is verbatim the failure the file's own comment says the
guarded return exists to prevent.

Latent today only because `FREE_SKILL_TOOLS` is empty — i.e. exactly the drift the `sealedVisitor` dep
was introduced to close, reintroduced one line below it. **One-word fix** (`guardArtefacts`, not
`unbound`). It is folded into plan Task 6, marked as a bug fix so a reviewer does not "clean it up"
back.

---

## 4. What to do next — and why the order is arguable

### The case for doing Phase 2's two call sites FIRST

`/api/discover` and `/api/tools/explore` still call `rankOutliers`, whose baseline is the median of
the returned set, so the same video prints 1.4× or 28.4× purely from `resultsPerPage`.
`author-baseline.ts` is merged and correct; the two call sites were deferred to Phase 2.

This session made the case sharper than "it's a live bug in a receipt." Spec §3.8 forces the Phase-3
tool result to carry `views` + `baselineLabel` and **no multiplier at all**, because putting
`rankOutliers`' figure in the transcript promotes a display bug into something the **agent asserts in
prose**, with a `corpus-references` citation card standing behind it. So the broken denominator is
now a **quality ceiling on Phase 3's entire payload**, not just a wrong number on a tile.

Switching the two call sites is small. It is the recommended next move.

### Then: execute the Phase 3 plan

9 tasks, `superpowers:subagent-driven-development` (fresh agent per task) or
`superpowers:executing-plans` (inline, batched). Task 4 needs a **manual SQL-editor migration** —
`supabase db push` is unsafe here.

### Two gaps the plan defers on purpose (not omissions)

1. **`GET /api/threads/open` does not expose the live token.** A superseded scrollback proposal card
   stays tappable and 409s. The renderer degrades honestly (inline error, button not restored), so it
   is polish — but it is not built.
2. **§3.8's no-multiplier rule is enforced by convention plus two assertions**, not a drift test. A
   third call site could add it back. A drift test over the transcript payloads would close it.

---

## 5. Open decisions the owner still owes

1. **A paid Apify plan.** At $5/month the whole platform gets ~97 scrapes/month across all users, and
   this design assumes a real budget to govern. It gates **shipping**, not building — the governance
   can be built and tested against the free cap. Still unmade.
2. **Whether Phase 2's two call sites jump the queue** (§4 above — recommended).
3. **Warm-hit rate is unmeasured.** Spec §5.1: `outlier_teardowns` holds 524 `curated`/`extracted`
   rows and **zero `scraped`**, so gate 1 leans entirely on cosine hits against a curated library —
   strong for broad niches, empty for narrow ones. The architecture calls warm-first "the common
   path"; today it may not be. Measure across real niches before treating gate 1 as load-bearing.
4. **`remix` as a proposal** is deferred (spec §3.1) — its pipeline lives inside its own SSE route and
   would need extracting. It keeps its working `request_input` field meanwhile.

---

## 6. Repo gotchas that will cost you time

- **vitest:** `node node_modules/vitest/vitest.mjs run <path>` — npx output is swallowed here, and you
  will read a passing run as a failure. **tsx:** `node node_modules/tsx/dist/cli.mjs`, and the script
  must live inside the repo.
- **`npx tsc --noEmit` before every commit.** vitest does not typecheck. A green Vercel check is not a
  build. 🔴 Git is DISCONNECTED — **merging does NOT deploy**, contra `CLAUDE.md`.
- **The post-commit hook AUTO-PUSHES.** Amending after it fires needs a force-push.
- **`supabase db push` is UNSAFE here** (migration-ledger drift). Single migrations via the SQL
  editor. Project `qyxvxleheckijapurisj`.
- **Co-sessions move `main` underneath you.** It moved 4 commits during this session. `git fetch` and
  re-measure with `git rev-parse` before branching AND before merging — `git log --oneline` elides
  merge commits here.
- ⚠️ **At the Apify cap, Apify 403s and the app disguises it as "check your handle is public."** Check
  the ACCOUNT before debugging any scrape failure. This is why spec §2.7 forbids that sentence on any
  branch where `SpendAuthority` has not confirmed `funded`.
