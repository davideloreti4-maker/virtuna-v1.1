# Phase 3 — Apify spend governance for the chat agent (design)

**Status:** design complete, sections 1–4 owner-approved. Not built.
**Supersedes:** § 5 of `docs/HANDOFF-2026-08-10-phase1-shipped-phase3-governance.md`, which carried
section 1 only.
**Depends on:** Phase 1 (merged, PR #468). Blocked on a purchase decision — see § 6.

---

## 0. The problem

`src/lib/tools/chat-agent-loop.ts` is a real streaming agent loop: tool calls, a billing gate,
transcript replay, anti-fabrication guards. It can call four skills (`generate_ideas`,
`generate_hooks`, `write_script`, `read_concept`) plus `search_corpus` and `request_input`.

Seven others it cannot call at all. `skill-dispatch.ts` says why:

> `account-read`, `explore` and `remix` stay behind a confirm tap because they hit **Apify scrapes**
> — on a $5/month hard cap — and an agent that can decide to scrape can burn that cap with nobody
> tapping anything.

And even behind a tap, the data never comes back. A confirmed `explore` returns to the agent as one
≤240-char prose line about `tiles[0]` only (`chat-prior-turns.ts` → `SKILL_BLOCK_RECORD["outlier-grid"]`,
`MAX_RECORD_LENGTH = 240`). It never receives the other eleven videos and no decode at all. *"Find me
3 viral formats"* is unanswerable because the agent has nothing to reason over.

### Decisions taken (owner-approved, not re-litigated here)

| # | decision |
|---|---|
| 1 | **Governance first** — spend authority before new tools before planning |
| 2 | **Agent proposes, one tap confirms** — the agent fills the args; the creator reviews a decision, not a form |
| 3 | **Two-turn resume** — the tap runs the skill server-side and opens a NEW turn carrying a real structured tool result |
| 4 | **Cap-out → answer warm, name the limit, no charge, no tap offered** |
| 5 | **Warm-first** — the cache answers free when it can; "pull fresh" is a follow-up affordance, not the default |
| 6 | **Approach C: governance in the DISPATCHER, not the model** — the agent calls `explore(niche)` and never learns about money |
| 7 | `SpendAuthority` is its own module; the chat dispatcher is its only wired caller in Phase 3 |
| 8 | The reserve floor is a **concurrency absorber only** — it does not reserve a cron share |
| 9 | A cap-out **names the reset date, not the platform's accounting** |

Why C (6): every decision above becomes *structural* rather than prompt-borne. Warm-first is a branch
the model cannot route around; adding a paid skill later needs zero prompt changes. Same principle
the loop already reached for after prompt text failed twice — *"ground rule #1 of this lane applies:
structure beats prompt text."*

---

## 1. Architecture (approved)

```
explore(niche, fresh?)                            ← the dispatcher decides, not the model
  ├─1  warmCoverage(niche)   rows ≥3× only, count + newest age    [skipped when fresh — §1.1]
  │      sufficient? ──▶ answer free, state count + age        ← intended common path (see §5.1)
  ├─2  spendAuthority.check(scrapes)   platform Apify cap
  │      capped + warm rows ──▶ answer stale, name the limit, no tap
  │      capped + nothing   ──▶ honest "cannot source right now", no charge
  ├─3  billing.gate(action)     creator credits  → relay the 402 body
  └─4  cold + funded ──▶ single-use proposal, args server-persisted, ONE per turn
                          tap → /api/chat/confirm re-checks 2+3, runs it,
                                opens a NEW turn with the real payload
```

**The ordering is the design.** Warm before any gate (the common path touches no budget); the
platform cap before the creator's credits (a cap-out is not their fault and must never render as a
paywall); the proposal last (spending is the exception).

`request_input` stays exactly as it is. It answers *"I need a value you haven't given me,"* which is a
real and different question from *"authorize this spend."*

### 1.1 Gate 1 — what "sufficient" means, and how to get past it

**Sufficient = at least 3 corpus rows clearing 3×.** This is not a new threshold: it is the rule the
product already ships. `corpus-tool` computes a `grounded` flag on exactly it, and the loop's own
directive states it to the model — *"Claim something is PROVEN only when you have at least three
returned examples clearing 3× against a stated baseline."* Gate 1 reuses that rather than inventing a
second definition of "enough proof," which would immediately disagree with the citation cards.

> 🔴 **MEASURED WRONG, 2026-08-11 — do not implement the paragraph above as written.**
> Both halves of the reuse claim are false, and the measurement is in
> `scripts/probe-warm-coverage.ts` + `scripts/probe-warm-coverage-control.ts` (re-runs for the
> price of embeddings; zero Apify).
>
> 1. **`corpus-tool` does not compute `grounded` on this rule.** `grounded` comes from
>    `assessWarrant` (`warrant.ts:129`): cosine ≥ `WARRANT_FLOOR_DEFAULT` (0.5) with
>    `WARRANT_MIN_ROWS = 1`, and **no multiplier test at all**. The "three examples clearing 3×"
>    sentence is a *prompt directive* to the model at `chat-agent-loop.ts:484`, not a computed
>    flag. `isProofGrade` — which IS the "basis + ≥3×" predicate — has exactly one production
>    caller, `discover/corpus-reads.ts`, and `corpus-tool` is not it. So gate 1 as specced would
>    be the second definition of "enough proof", which is what this paragraph set out to avoid.
>
> 2. **The bar cannot meaningfully fail.** 285 of the 524 corpus rows (54%) pass `isProofGrade`,
>    and `match_shared_teardowns` returns its top 12 by cosine with no floor of its own. "≥3
>    proof-grade of 12" therefore sits *below* what a random draw from this corpus yields.
>    Measured against 132 real distinct asks pulled from prod `messages`: gate 1 passes
>    **95.5%** at the shipped 0.5 floor, with **zero** asks returning an empty corpus. Raising
>    the topicality floor to 0.6 drops that to **34%** — that gap is the honest measure of how
>    often the corpus actually covers the subject.
>
> 3. **The negative control is the proof.** `asdfghjkl qwerty zxcvbn` passes gate 1 with 3
>    proof-grade rows; `yes` passes; `ok` passes with 6; "my cat will not stop knocking things
>    off the table" passes with 4. Genuinely off-domain queries (Peloponnesian War, tractor
>    timing belt, ballast-water regulations) correctly miss — so the 0.5 floor separates
>    off-domain from in-domain, but not *contentless* from *covered*.
>
> **Consequence.** Gate 1 needs a real topicality floor before it can carry the sentence
> *"here are the proven outliers for {niche}"* — otherwise it asserts proof over rows sitting at
> the corpus median, which is the same class of defect PR #470 removed from the printed
> multiplier: a number that looks earned and is not. See the amended §5.1.

**Age is reported, never gated on.** The answer states count and newest age honestly ("9 videos, newest
6 days old"). A stale-but-sufficient corpus still answers free — decision 5 makes freshness a
follow-up affordance, not a precondition.

⚠️ **The age needs a one-line widening.** `SharedMatchRow` already carries `posted_at` and the match
RPC already returns it — `matchRowToExample` (`retrieve.ts:288`) simply drops it, so
`RetrievedExample` has no date. Add `postedAt?: string | null` (**optional**, so the two production
constructors and ~6 test literals keep compiling) and map it. No migration, no RPC change. When it is
absent the sentence omits the age rather than fabricating one.

⚠️ **The 3× here is NOT the broken multiplier of §3.8.** A corpus row's `outlier_multiplier` is the
*write-time* figure — `views ÷ followers`, gated at ingest by `MIN_OUTLIER_MULTIPLIER` (see the
Phase 1 write-back fix). `rankOutliers`' figure is a *within-set* median that moves with
`resultsPerPage`. Same word, different number, different code path. Conflating them is how gate 1
would silently start admitting rows on a statistic that depends on scrape size.

**The escape hatch.** Without one, decision 5 deadlocks: a warm answer says "pull fresh if you want,"
the creator says "pull fresh," and gate 1 is still sufficient, so they get the same warm answer
forever. So the tool schema carries `fresh?: boolean`, described to the model as *"ONLY when the
creator explicitly asks for new/fresher data after seeing what you already had."* Setting it skips
gate 1 and nothing else — gates 2 and 3 still run, so this is an intent signal, never a spend
decision. The model can route around the *cache*; it still cannot route around the *money*.

---

## 2. Budget authority

### 2.1 Module and interface

`src/lib/billing/spend-authority.ts` — deliberately next to `credit-gate.ts`, not in `scraping/`. It
is a money seam, the platform-money twin of the creator-money one; `scraping/` stays about the wire.

```ts
export type SpendVerdict =
  | { funded: true;  remainingUsd: number }
  | { funded: false; reason: "capped";     resetsLabel: string }   // "Aug 21"
  | { funded: false; reason: "unreadable"; resetsLabel: null };

export interface SpendAuthority {
  /** May the platform pay for `scrapes` Apify runs right now? Never throws. */
  check: (scrapes: number) => Promise<SpendVerdict>;
}
```

`scrapes` is a parameter because the actions differ. `explore_scrape` is one Apify run; an account
read fires **two** — `scrapeProfile` + `scrapeVideos(handle, 30)`, documented at `pricing.ts:103`. A
single boolean `funded` would be a lie for the heavier one. The count lives on the skill descriptor
(§3.1), so there is no second action→runs table to drift.

Injected by the route, exactly like `SkillBilling`, so the loop stays network-free under test.
Omitting it is not a free pass: an absent authority is treated as `unreadable`, which refuses.

### 2.2 The read

```
GET https://api.apify.com/v2/users/me/limits?token=…      AbortSignal.timeout(3000)

remaining   = data.limits.maxMonthlyUsageUsd − data.current.monthlyUsageUsd
floor       = (RESERVE_RUNS + scrapes) × ESTIMATED_RUN_COST_USD
funded      = remaining ≥ floor
resetsLabel = format(data.monthlyUsageCycle.endAt + 1ms, "MMM d", UTC)
```

Verified against the live account 2026-08-10:

```json
{ "data": {
    "monthlyUsageCycle": { "startAt": "2026-07-21T00:00:00.000Z",
                           "endAt":   "2026-08-20T23:59:59.999Z" },
    "limits":  { "maxMonthlyUsageUsd": 5 },
    "current": { "monthlyUsageUsd": 3.0609334113115043 } } }
```

`monthlyUsageCycle` is **not** in the handoff and is load-bearing: it is where the honest reset date
comes from. It tracks whichever token is active, so it stays correct across the rotating free
accounts.

`resetsLabel` must be formatted **explicitly in UTC**. `endAt` is `…T23:59:59.999Z`; rendering that
instant in server locale prints "Aug 20" for every reader west of UTC — off by one, in the one
sentence whose whole job is to be trustworthy.

### 2.3 Constants

```ts
/** Conservative measured average across the live Phase-1 runs. */
const ESTIMATED_RUN_COST_USD = 0.0513;
const RESERVE_RUNS = 4;
```

The two available measurements disagree: `verify-apify-first.ts` records `$0.0513/run`, while this
session's four runs averaged `$0.0265` ($0.106 ÷ 4). Keep the **higher**. It sizes a safety floor, and
per-run cost genuinely varies — `scrapeVideos(handle, 30)` is far bigger than a six-post pull.

The floor's only job is to absorb concurrency and Apify's metering lag: a run in flight is not yet
counted in `monthlyUsageUsd`. It does **not** reserve budget for the five nightly crons (decision 8).

### 2.4 Fail closed

Missing token, non-200, malformed payload, timeout, network error → `unreadable`, and no scrape is
proposed. Never throws.

This is the opposite posture to `rateLimitGuard`, on purpose. That guard protects us *from users* and
its failure mode is "product down," so it fails open. This one guards a hard external cap whose
overrun makes Apify 403 — which this app **disguises as "check your handle is public"** (memory:
`apify-free-plan-hard-limit`). Failing open buys a real-money overrun *plus* a bug that gets
misdiagnosed for an hour. The precedent is one file over: no `billing` seam wired → the skill is
refused loudly, never run free.

### 2.5 No TTL cache

`check()` only runs on the cold path, which is already about to spend minutes and real money; a
~200ms read is free against that. A module-level cache is per-lambda, so it cannot coordinate
concurrent turns anyway — the reserve floor handles concurrency, cache or no cache. Dropping the
cache deletes a class of staleness bug and buys nothing back.

### 2.6 Called twice per proposal

At gate 2 before the tap is offered, and again in `/api/chat/confirm` before the run. Minutes can pass
between the two, and another door — a cron, another creator — can drain the cap in between.

### 2.7 Copy

The authority returns facts. The **dispatcher** owns the sentences, because only the dispatcher knows
whether warm rows exist. Deterministic copy, relayed by the model, never written by it — same pattern
as `quotaRefusalMessage`, and for the same reason: a relayed refusal has gone wrong on this path
before.

The sentences are keyed by **(skill, branch)**, not by branch alone — only `explore` has a warm arm
(§3.1), so the three-row table below is explore's, and every proposal skill supplies its own set.

`explore`:

| branch | sentence |
|---|---|
| `capped`, warm rows exist | "These are the outliers I already have for *{niche}* — {n} videos, newest {age} old. I can't pull anything fresher until {resetsLabel}." |
| `capped`, nothing warm | "I don't have proven outliers for *{niche}* yet, and I can't pull fresh ones until {resetsLabel}. Want me to work from what you've already got instead?" |
| `unreadable` | "I can't pull fresh videos right now." |

`account` (no warm arm — your own account has no cached equivalent):

| branch | sentence |
|---|---|
| `capped` | "I can't read your account right now — I'm not able to pull new posts until {resetsLabel}." |
| `unreadable` | "I can't read your account right now." |

The `unreadable` lines are honestly vague — no date, because we genuinely do not know one. Vagueness
is the correct register for an unknown, not a default.

### 2.8 One deletion

`scripts/verify-apify-first.ts:57` hand-rolls `assertApifyHeadroom` with its own `< 0.2` threshold. It
delegates to this module instead. Same lesson as the Phase 1 write-back fix: a second hand-rolled
implementation of something that now has a canonical one is how those three defects got in.

### 2.9 Tests

All network-free, injecting the fetch: funded · exactly at floor · one cent below · `scrapes:2` refused
where `scrapes:1` passes · 403 · malformed JSON · timeout · no token configured. Plus one assertion
that the dispatcher never calls a scrape runner on a non-`funded` verdict.

---

## 3. The proposal round trip

### 3.1 The seam that makes decision 6 structural

`SkillTool` gains one optional field:

```ts
proposal?: {
  /** Apify runs one execution fires — sizes the SpendAuthority floor. account = 2. */
  apifyRuns: number;
  /** Deterministic card copy built FROM THE STORED ARGS. Never model text. */
  label: (args: SkillToolArgs) => string;
};
```

The dispatcher branches on `skill.proposal` **before** `skill.run`. A skill carrying it cannot be
executed inline by any code path, because the branch precedes the call. Decision 6 as a type, not a
rule someone has to remember.

**Scope: `explore` + `account` in Phase 3. `remix` deferred.** Explore and account are single-runner
calls needing nothing typed at tap time. Remix's pipeline (`resolveAndRehost` → omni → decode →
adapt) lives *inside* its own SSE route and would have to be extracted first; it keeps its working
`request_input` field meanwhile.

**Gate 1 is explore-only.** `warmCoverage` is a corpus lookup by niche; your own account has no warm
equivalent. Account skips straight to gate 2.

### 3.2 Storage — `threads.pending_proposal jsonb`

Precedent in this repo: `20260723090753_thread_sim_seals.sql` put per-thread state in a jsonb column
on `threads` — "no new table, RLS inherited from the thread row."

The decisive argument is that **one slot enforces one-live-proposal-per-thread by construction.** A new
proposal overwrites the old, so supersession is automatic rather than a cleanup rule. A separate table
would let a thread accumulate a scrollback of live 5-credit buttons and require code to remember to
kill them.

```
pending_proposal := { token, action, args, at, consumedAt? }   -- one live offer, or NULL
```

`args` never reach the client. That is the point: a client-supplied arg would let a creator scrape
anything.

### 3.3 The atomic claim (RPC)

Single-use is a conditional UPDATE, never a read-then-write. It cannot be expressed through the
supabase-js query builder, so it is an RPC — the `20260719150000_match_rpc_facets.sql` precedent.

```sql
-- claim_thread_proposal(p_thread uuid, p_user uuid, p_token text) → jsonb
UPDATE threads
   SET pending_proposal = jsonb_set(pending_proposal, '{consumedAt}', to_jsonb(now()))
 WHERE id = p_thread AND user_id = p_user
   AND pending_proposal->>'token'      = p_token
   AND pending_proposal->>'consumedAt' IS NULL
   AND (pending_proposal->>'at')::timestamptz > now() - interval '24 hours'
RETURNING pending_proposal;
```

Marking consumed rather than nulling is deliberate: `RETURNING` then reads the new row unambiguously
and hands back the args in one round trip, and the retained `consumedAt` lets
`GET /api/threads/open` render a tapped card as *done* rather than merely absent.

Zero rows means: already tapped, superseded, expired, or not theirs — four cases, one clean 409, one
honest sentence. Ownership is scoped by `user_id` explicitly, per the CR-01 invariant every
`threads.ts` query already follows.

Applied via the **SQL editor**, single migration. `supabase db push` is unsafe in this project
(migration-ledger drift).

### 3.4 The block

```ts
SkillProposalBlockSchema = {
  type: "skill-proposal",
  props: { token, action, label, platform? }
}
```

**`label` is built server-side from the stored args, by the same function that stored them.** This is
the security property: since the args never reach the client, the label is the creator's *only* view of
what they are authorising. A model-written label could say "pull fitness outliers" over an arg saying
something else. Same rule `input-request` already enforces — *"kind/label/placeholder come from
SKILL_CAPABILITIES, set HERE, never by the model"* — extended to the one field that now carries
meaning.

No credit cost on the card. The account confirm button does not show one either; inventing a second
convention here would be the inconsistency.

Required companion edits:
- `blocks.ts` — add the schema to the union.
- `chat-prior-turns.ts` — add `skill-proposal` to `NON_RECORD_BLOCKS` ("an offer awaiting the creator,
  not a result — recording it would read as an answer"), or the reachability drift test fails.
- `GET /api/threads/open` — return the live token (live = `consumedAt IS NULL` and inside the 24h
  window) so the renderer greys out superseded scrollback cards instead of letting the creator tap
  into a 409.
- Turn 1 must return the block in `uiBlocks`, not merely stream it — that is the existing mechanism
  that survives a reload, and the field affordance already depends on it.

Renderer states mirror `input-request-block.tsx`: idle → running (`ProgressChecklist` seeded with
`SKILL_RUN_META.explore.plan`) → `DoneReceipt`.

### 3.5 `POST /api/chat/confirm`

Its own route, and that is the point: `maxDuration = 300`, matching `account-read/route.ts:39`,
`tools/remix/run/route.ts:56` and `audiences/calibrate/route.ts:47`. The chat route has no extended
budget, which is precisely why heavy skills were pushed to their own routes. **The two-turn shape is
not a UX preference — it is what lets the scrape have five minutes.**

SSE, reusing the chat route's event vocabulary (`stage` · `evidence` · `block` · `token` · `dispatch`
· `done` · `error` · `credit-wall`), so the client reuses its stream handling.

Body: `{ token }` only. The thread is resolved from the session via `getOpenThread(user.id)` — one
less client-supplied field, and CR-01 holds without an ownership check to remember.

Order:

```
auth → CSRF → rate-limit → ATOMIC CLAIM → spendAuthority.check → creditGate
     → run → persist cards → bill on delivery → resume the turn
```

The claim comes **before** the gates deliberately. A double-tap must burn the token, not race two
scrapes past two independent gate reads.

### 3.6 The resumed transcript

```js
{ role: "assistant", content: null,
  tool_calls: [{ id, function: { name: "explore",
                                 arguments: JSON.stringify(STORED_ARGS) } }] }
{ role: "tool", tool_call_id: id, content: JSON.stringify({
    ran: "explore", produced: "12 outlier videos", videos: [...], note: "…" }) }
```

The replayed `arguments` are the **server-stored** ones, so the transcript cannot disagree with what
actually ran.

The resume runs the ordinary loop with `maxSkillRuns` intact — the credit gate is the same protection
a typed message gets. One consequence falls out free: a resume turn *is* a turn, so the
one-proposal-per-turn rule (§4.1) applies unchanged and no special case is needed to stop an infinite
tap-chain.

Sealed visitors need no handling. Scrape skills are billable; billable skills are not bound for them
(`FREE_SKILL_TOOLS`); so no proposal can be constructed.

### 3.7 Superseding the 240-char record

`CARD_BLOCK_TOOL` gains `"outlier-grid" → "explore"`. The confirm route persists its cards followed by
a text row stamped `origin:"chat-agent"` — which is exactly the signal `openChatPriorTurns` already
uses to attribute pending cards to a tool run. A pill-run Explore has no such row after it, so it
still degrades to the prose record. Correct by construction, and it reuses existing machinery rather
than adding a parallel path.

**There is a trap in the current walk that must be designed around.** `SKILL_BLOCK_RECORD` is checked
first and `continue`s, so a block present in both maps never reaches the tool branch. Reorder it and
the opposite bug appears: `pendingRuns` that never sees a `chat-agent` row is silently discarded
(`pendingRuns = []`), so a pill-run Explore would vanish from context entirely — worse than the
240-char line it replaced. **A pending run must therefore carry its record line, and the flush must
degrade to it when no `chat-agent` row arrives.** One test. Without it, this change quietly re-deletes
the 11% of thread context `SKILL_BLOCK_RECORD` was written to restore.

`MAX_LINES_PER_RUN = 6` needs a per-type raise for grids. Capping a 12-tile pull at six reintroduces
"the agent cannot see what it pulled" in half measure.

### 3.8 A dependency on Phase 2

The tool result must **not carry `multiplier`** until the `author-baseline` denominator is wired into
`/api/tools/explore`. Those tiles come from `rankOutliers`, whose baseline is the median of the
returned set — the same video prints 1.4× or 28.4× purely from `resultsPerPage` (memory:
`multiplier-depends-on-scrape-size`). Putting that number in the transcript promotes a display bug
into the agent *asserting* it in prose, with a `corpus-references` citation card standing behind it.

Until then the result carries `views` + `baselineLabel` and no multiplier.

---

## 4. Error handling + testing

### 4.1 The leash

`paidRuns` increments only after `skill.run()` delivers. A proposal runs nothing, so it never touches
`DEFAULT_MAX_SKILL_RUNS` — no code needed.

The one-per-turn cap needs a counter, but it is **not a policy**. The `pending_proposal` slot holds one
offer; a second proposal in the same turn would overwrite the first, leaving a rendered card in the
thread whose token is already dead — a button that costs a tap and returns a 409. The cap is a
*consequence of the storage*. Stating it that way is what stops someone raising it to 2 later.

Second call in a turn → a tool result: one offer is already on screen, ask them to tap it.

### 4.2 The turn that ends with nothing visible

The hole is real and predates this work: `if (text.length > 0)` guards persistence, and `maxRounds`
can be spent with the last round being a tool call. The creator gets their own message and silence.

Fix: when the loop ends having streamed **zero characters**, the dispatcher emits a deterministic
sentence for whichever governance branch it took — warm answer, cap-out, proposal, refusal — through
`onToken`, so it both streams and persists. The model composes normally when it composes at all; this
fires only on the empty case. Four branches, four sentences, four tests.

### 4.3 An adjacent defect, in scope for the same branch

`chat-agent-loop.ts:1266` returns `text: unbound ? guard.flush() : fullText`, but the guard is armed
on `guardArtefacts = (deps.sealedVisitor ?? false) || unbound` (line 883). A sealed visitor who is not
`unbound` streams redacted text and persists the **raw** text — the redaction holds for one turn, then
the leaked line reappears on reload and lands in the next turn's replayed transcript as precedent.
That is verbatim the failure the file's own comment says the guarded return exists to prevent.

Latent today only because `FREE_SKILL_TOOLS` is empty — i.e. exactly the drift the `sealedVisitor` dep
was introduced to close, reintroduced one line below it. One-word fix: `guardArtefacts`, not `unbound`.

### 4.4 Confirm-route failure taxonomy

| failure | charged | creator sees |
|---|---|---|
| token dead — tapped / superseded / expired / not theirs | no | "That offer isn't current any more — ask me again and I'll set up a fresh one." |
| `capped` at confirm | no | the cap-out sentence, with the reset date |
| `unreadable` | no | "I can't pull fresh videos right now." |
| credit gate refuses | no | existing `credit-wall` frame + relayed sentence |
| scrape throws / returns empty | no | explore: "Couldn't pull anything for *{niche}* — try a different one." · account: "Couldn't read your account — check the handle is public." ⚠️ only after `SpendAuthority` has confirmed we are **not** capped, or this is the disguised-403 trap again |
| scrape ok, persist fails | **yes** | cards streamed once; the warning says plainly they were not saved to the thread |
| scrape ok, closing completion fails | **yes** | cards on screen + the §4.2 fallback line |

The bottom two follow the rule already written in `skill-dispatch.ts`: *delivery is not reversible by a
failed charge.* Extended here — delivery is not reversible by a failed closing line either.

**Token release.** Burned on claim, in every case, with one exception: a refusal by the **creator's
credit gate** re-arms it (clear `consumedAt`), because that is the one failure they can fix and
immediately retry — hit wall → upgrade → tap. Every other failure stays burned; re-arming on a scrape
failure builds a retry loop pointed at a $5 cap.

### 4.5 Testing

**Mock the boundary, never the unit.** `SpendAuthority` and `SkillBilling` are injected interfaces —
legitimate fakes. The dispatcher, the prior-turns walker and the claim are the units under test.

Network-free:

- `spend-authority` — the eight cases from §2.9.
- **Gate ordering, asserted as non-calls:** warm-sufficient never calls `SpendAuthority`; capped never
  calls `creditGate`; a non-`funded` verdict never reaches a runner. The ordering *is* the design, so
  the test has to be about what did not happen.
- Proposal cap: two `explore` calls in one turn → one block, one refusal.
- Leash independence: a proposal plus two generator runs all succeed.
- Empty-text fallback, per branch.
- Replayed `arguments` equal the **stored** args, not anything the model wrote.
- Prior-turns, **both directions**: `outlier-grid` + a `chat-agent` row → tool run; `outlier-grid`
  alone → prose record. Both, or the §3.7 degrade trap ships.

What unit tests structurally cannot see, stated rather than papered over: the claim's atomicity under a
genuine double-tap; whether the Apify limits payload still has the shape we parse; whether the resumed
turn reads as continuous.

So one `scripts/verify-chat-proposal.ts` — sibling of `verify-apify-first.ts`, checks headroom first —
drives a real proposal → tap → resume against a real thread, then double-taps the same token to prove
the second gets a 409. Cost: one scrape, ~$0.05.

The "a turn never ends with nothing" claim gets walked once on a **prod build**, not dev: memory
`unhappy-paths-walk` records a cleanup-only `useRef` guard that made `failBack()` a silent no-op in dev
only.

---

## 5. Assumptions, risks, out of scope

### 5.1 Gate 1 — MEASURED 2026-08-11. The risk was backwards.

The original text of this section feared gate 1 would be **empty**: 524 curated rows, zero scraped,
so `warmCoverage(niche)` "strong for broad niches, empty for narrow ones", and warm-first therefore
not yet the common path. It asked for a measurement before treating gate 1 as load-bearing.

**That measurement was run. The fear was inverted.** Gate 1 does not fall through — it passes
**95.5% of 132 real distinct asks** (pulled from prod `messages`; `creator_profiles.niches` is `[]`
on all 18 rows, so there are no self-reported niches to use). **Zero** asks returned an empty
corpus. Details and the negative control are in the amendment box in §1.1.

Three consequences, none of which the design currently accounts for:

1. **Warm-first is not "the common path" — it is very nearly the only path.** Gates 2 and 3,
   `SpendAuthority`, the `pending_proposal` slot, `POST /api/chat/confirm` and the proposal card
   are reached on roughly the residual few percent of asks. The nine-task chat gate chain governs
   a path that is rarely taken and, when taken, rarely spends. The cost risk this design was
   written against is smaller than assumed; so is the value of governing *this* door.

2. **`fresh?: boolean` stops being an escape hatch and becomes the main road.** §1.1 introduces it
   for the case where a creator asks for fresher data after a warm answer. At a 95.5% pass rate it
   is the only route to a scrape that a creator can actually reach.

3. **The exposure is quality, not cost.** A gate that passes on `asdfghjkl` will happily front the
   sentence *"here are the proven outliers for {niche}"* over rows at the corpus median. Fixing
   that means a real topicality floor on `warmCoverage` — distinct from the 0.5 recall floor,
   which `retrieve.ts` itself documents as ~0.05 above "accept a random row" — or dropping the
   proof framing and stating relatedness honestly.

**Re-scope before building.** On this evidence the highest-value part of Phase 3 is `SpendAuthority`
failing closed against the real cap, applied to the **ten other doors** that drain it — which §5.2
currently puts out of scope — rather than the chat gate chain, which §1–§3 build in full. That is a
scope call for the owner, not a change this document makes on its own.

> #### ✅ AMENDMENT 2026-08-14 — the owner made that call. Gate chain DROPPED.
>
> **Ruling: build `SpendAuthority` across the ten other doors; do not build the chat gate chain.**
>
> Mapped onto `plans/2026-08-10-apify-governance-phase3.md`:
>
> | | |
> |---|---|
> | **Task 1** — `SpendAuthority`, the platform budget seam | **KEEP.** This is now the whole lane. |
> | **Tasks 2–9** — warm coverage, copy module, `pending_proposal` migration + RPC, the `skill-proposal` block, the dispatcher gate chain, `POST /api/chat/confirm`, the grid replay, the e2e walk | **DROPPED.** Not deferred — dropped. |
> | **NEW** — wire the authority into the ten doors §5.2 lists | **IN SCOPE**, and the reason the lane exists. |
>
> Two grounds, both measured, neither a preference:
>
> 1. **§5.1's own arithmetic.** The chain governs the residual ~4.5% of asks. Eight tasks of
>    migration, RPC, atomic claim, a new block type and a new route, to guard a path that is nearly
>    never taken and, when taken, rarely spends.
> 2. **Gate 1 is measured BROKEN, so the chain's first link cannot be trusted anyway** (#484). It
>    passes 95.5% of real asks *and* passes `asdfghjkl qwerty zxcvbn`. What it actually separates is
>    off-domain from in-domain — **not** contentless from covered. Building seven tasks on top of a
>    gate that admits keyboard mash would be building on a false premise.
>
> ⚠️ **The quality exposure in consequence 3 above is NOT fixed by this ruling and does not go away
> with the chain.** A gate that passes on `asdfghjkl` still fronts *"here are the proven outliers for
> {niche}"* over median rows. That is a live honesty defect on the 95.5% path — the path creators
> actually take — and it is now unowned by any phase. It needs its own scope call. Do not let the
> gate chain's death carry it off the board.
>
> ⚠️ §5.2 below still reads "out of scope" for the ten doors. **It is superseded by this box**; the
> bullet is left standing rather than rewritten so the original reasoning stays legible.
>
> Unchanged by this ruling: §6 — a paid Apify plan still gates **shipping**, not building.

### 5.2 Out of scope

- **The other ten Apify doors.** `/api/discover`, `/api/analyze`, `/api/profile`,
  `connected-accounts/connect`, `channels/ingest`, `explore-runner`, `account-read`, and five cron jobs
  (`scrape-trending`, `refresh-competitors`, `refresh-account-snapshots`, `audience-drift`) all drain
  the same cap and are unchanged. `SpendAuthority` still reads the **true** remaining budget, so a 3am
  cron that drains the cap makes the agent correctly refuse. Wiring the other doors is a tracked
  follow-up (decision 7).
- **`remix` as a proposal** (§3.1).
- **Phase 2** — the `composed-card` output layer, and the `rankOutliers` → `author-baseline` switch at
  `/api/discover` and `/api/tools/explore` (§3.8 depends on the latter).

### 5.3 Repo constraints that shape the build

- `npx tsc --noEmit` before every commit; a green Vercel check is not a build. Git is **disconnected**
  — merging does not deploy.
- The post-commit hook **auto-pushes**.
- vitest: `node node_modules/vitest/vitest.mjs run <path>` — npx output is swallowed here.
- tsx: `node node_modules/tsx/dist/cli.mjs`, and the script must live inside the repo.
- At the Apify cap, Apify 403s and the app disguises it as *"check your handle is public."* Check the
  ACCOUNT before debugging any scrape failure.

---

## 6. Open decision that gates shipping

**A paid Apify plan.** At $5/month the whole platform gets ~97 scrapes/month across all users, and this
design assumes a real budget to govern. It gates **shipping**, not building — the governance can be
built and tested against the free cap. Still unmade.
