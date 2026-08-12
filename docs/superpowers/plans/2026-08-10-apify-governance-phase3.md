# Apify Spend Governance (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the chat agent reach the three Apify-spending skills (`explore`, `account`) behind a
governed, warm-first, one-tap-confirm round trip that returns real structured data to the agent
instead of a 240-char prose line.

**Architecture:** Governance lives in the DISPATCHER, never in the model. `chat-agent-loop.ts` gains a
four-gate chain — warm coverage → platform Apify budget → creator credits → a single-use proposal.
The agent calls `explore(niche)` and never learns about money. The tap goes to a new
`POST /api/chat/confirm` route (`maxDuration = 300`), which claims the proposal atomically, re-checks
both budgets, runs the skill server-side, and resumes the conversation with a real `role:"tool"`
message.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase (Postgres + RPC) · Vitest · Zod ·
SSE · Apify REST.

**Design spec:** `docs/superpowers/specs/2026-08-10-apify-governance-phase3-design.md` — read §1.1,
§3.7 and §4.3 before starting; they contain traps that unit tests do not catch.

## Global Constraints

- **Verify commands.** vitest is `node node_modules/vitest/vitest.mjs run <path>` — `npx` output is
  swallowed in this environment and you will think a passing run failed. tsx is
  `node node_modules/tsx/dist/cli.mjs` and the script must live inside the repo.
- **`npx tsc --noEmit` before every commit.** vitest does not typecheck. A green Vercel check is not a
  build. Git is DISCONNECTED — merging does **not** deploy.
- **The post-commit hook AUTO-PUSHES.** Amending after it fires needs a force-push.
- **`supabase db push` is UNSAFE here** (migration-ledger drift). Apply single migrations via the
  Supabase SQL editor. Project `qyxvxleheckijapurisj`.
- **Mock the boundary, never the unit.** `SpendAuthority`, `SkillBilling` and the Supabase client are
  I/O boundaries and may be faked. The dispatcher, the prior-turns walker and every parsing function
  are the units under test and must run for real.
- **Never `#fff`.** Cream text (`text-foreground` / `text-foreground-secondary` /
  `text-foreground-muted`). **Accent (`--color-accent`, `#FF6363`) is banned on this work** — primary
  actions are neutral cream (`CardPrimaryAction`). Accent dosage is LOCKED; a proposal card gets none.
- **At the Apify cap, Apify 403s and the app disguises it as "check your handle is public."** Check the
  ACCOUNT before debugging any scrape failure. Account is at `$3.06 / $5.00`, cycle ends
  `2026-08-20T23:59:59.999Z`.
- **Exact constants** (copy verbatim): `ESTIMATED_RUN_COST_USD = 0.0513`, `RESERVE_RUNS = 4`,
  `MIN_OUTLIER_MULTIPLIER = 3` (import from `@/lib/grounding/outlier-gate`, do not redeclare),
  `WARM_MIN_ROWS = 3`, `PROPOSAL_TTL_HOURS = 24`, `MAX_PROPOSALS_PER_TURN = 1`.
- **Commit format:** `type(scope): description`.

---

## File Structure

| file | responsibility |
|---|---|
| `src/lib/billing/spend-authority.ts` | **Create.** Platform Apify budget: read the cap, apply the floor, fail closed. |
| `src/lib/billing/__tests__/spend-authority.test.ts` | **Create.** |
| `src/lib/discover/warm-coverage.ts` | **Create.** Gate 1: is the corpus already sufficient for this niche? |
| `src/lib/discover/__tests__/warm-coverage.test.ts` | **Create.** |
| `src/lib/grounding/types.ts:429` | **Modify.** Add `postedAt?: string \| null` to `RetrievedExample`. |
| `src/lib/grounding/retrieve.ts:288` | **Modify.** Map `row.posted_at` in `matchRowToExample`. |
| `src/lib/tools/proposal-copy.ts` | **Create.** Every deterministic creator-facing sentence, keyed (skill, branch). |
| `src/lib/tools/__tests__/proposal-copy.test.ts` | **Create.** |
| `src/lib/tools/skill-dispatch.ts` | **Modify.** `SkillTool.proposal` field + `explore` / `account` registry entries. |
| `supabase/migrations/20260810120000_thread_pending_proposal.sql` | **Create.** Column + `claim_thread_proposal` RPC. |
| `src/lib/threads/proposals.ts` | **Create.** arm / claim / release / read helpers over that column. |
| `src/lib/threads/__tests__/proposals.test.ts` | **Create.** |
| `src/lib/tools/blocks.ts` | **Modify.** `SkillProposalBlockSchema`. |
| `src/lib/tools/block-registry.ts` | **Modify.** Register it. |
| `src/components/thread/skill-proposal-block.tsx` | **Create.** The card: idle → running → done. |
| `src/components/thread/message-blocks.tsx` | **Modify.** Wire the renderer. |
| `src/lib/tools/chat-agent-loop.ts` | **Modify.** The gate chain, the per-turn cap, the empty-text fallback, the `guardArtefacts` fix. |
| `src/app/api/tools/chat/route.ts` | **Modify.** Inject `SpendAuthority` + arm the proposal. |
| `src/app/api/chat/confirm/route.ts` | **Create.** The resume route. |
| `src/lib/threads/chat-prior-turns.ts` | **Modify.** Replay `outlier-grid` as a tool run, with the degrade fallback. |
| `scripts/verify-chat-proposal.ts` | **Create.** One real end-to-end proposal → tap → resume + double-tap. |

---

## Task 1: SpendAuthority — the platform budget seam

**Files:**
- Create: `src/lib/billing/spend-authority.ts`
- Create: `src/lib/billing/__tests__/spend-authority.test.ts`
- Modify: `scripts/verify-apify-first.ts:56-69` (delete `assertApifyHeadroom`, delegate)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SpendVerdict`, `SpendAuthority`, `apifySpendAuthority(deps?)`,
  `ESTIMATED_RUN_COST_USD`, `RESERVE_RUNS`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/billing/__tests__/spend-authority.test.ts`:

```ts
/**
 * spend-authority.test.ts — the PLATFORM money gate (creator money is credit-gate.ts).
 *
 * Locks the two properties that cost real money if they drift: the floor scales with the number
 * of Apify runs the action fires, and EVERY unreadable outcome refuses. Fail-open here buys an
 * overrun plus a 403 the app disguises as "check your handle is public".
 */
import { describe, it, expect, vi } from "vitest";
import { apifySpendAuthority, ESTIMATED_RUN_COST_USD, RESERVE_RUNS } from "../spend-authority";

/** The real payload shape, captured from the live account 2026-08-10. */
function limitsPayload(usedUsd: number, capUsd = 5) {
  return {
    data: {
      monthlyUsageCycle: {
        startAt: "2026-07-21T00:00:00.000Z",
        endAt: "2026-08-20T23:59:59.999Z",
      },
      limits: { maxMonthlyUsageUsd: capUsd },
      current: { monthlyUsageUsd: usedUsd },
    },
  };
}

function fetchReturning(payload: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  }) as unknown as typeof fetch;
}

describe("apifySpendAuthority", () => {
  it("funds a single scrape with plenty of headroom", async () => {
    const authority = apifySpendAuthority({ token: "t", fetchImpl: fetchReturning(limitsPayload(3.06)) });
    const verdict = await authority.check(1);
    expect(verdict.funded).toBe(true);
    expect(verdict).toMatchObject({ remainingUsd: expect.closeTo(1.94, 5) });
  });

  it("funds at EXACTLY the floor (the boundary is inclusive)", async () => {
    const floor = (RESERVE_RUNS + 1) * ESTIMATED_RUN_COST_USD;
    const authority = apifySpendAuthority({ token: "t", fetchImpl: fetchReturning(limitsPayload(5 - floor)) });
    expect((await authority.check(1)).funded).toBe(true);
  });

  it("refuses one cent below the floor", async () => {
    const floor = (RESERVE_RUNS + 1) * ESTIMATED_RUN_COST_USD;
    const authority = apifySpendAuthority({
      token: "t",
      fetchImpl: fetchReturning(limitsPayload(5 - floor + 0.01)),
    });
    const verdict = await authority.check(1);
    expect(verdict).toEqual({ funded: false, reason: "capped", resetsLabel: "Aug 21" });
  });

  it("THE ACCOUNT-READ CASE: scrapes:2 is refused where scrapes:1 passes", async () => {
    // Headroom sized for exactly (RESERVE_RUNS + 1) runs.
    const remaining = (RESERVE_RUNS + 1) * ESTIMATED_RUN_COST_USD;
    const payload = limitsPayload(5 - remaining);
    expect((await apifySpendAuthority({ token: "t", fetchImpl: fetchReturning(payload) }).check(1)).funded).toBe(true);
    expect((await apifySpendAuthority({ token: "t", fetchImpl: fetchReturning(payload) }).check(2)).funded).toBe(false);
  });

  it("names the reset date as the day AFTER the cycle end, in UTC", async () => {
    // endAt is 2026-08-20T23:59:59.999Z. Formatting that instant in a negative-offset locale
    // prints "Aug 20" — off by one, in the one sentence whose job is to be trustworthy.
    const authority = apifySpendAuthority({ token: "t", fetchImpl: fetchReturning(limitsPayload(4.99)) });
    const verdict = await authority.check(1);
    expect(verdict).toMatchObject({ reason: "capped", resetsLabel: "Aug 21" });
  });

  it("fails CLOSED on a non-200", async () => {
    const authority = apifySpendAuthority({ token: "t", fetchImpl: fetchReturning({}, false) });
    expect(await authority.check(1)).toEqual({ funded: false, reason: "unreadable", resetsLabel: null });
  });

  it("fails CLOSED on a malformed payload", async () => {
    const authority = apifySpendAuthority({ token: "t", fetchImpl: fetchReturning({ data: { limits: {} } }) });
    expect(await authority.check(1)).toEqual({ funded: false, reason: "unreadable", resetsLabel: null });
  });

  it("fails CLOSED on a network throw, and never rethrows", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as unknown as typeof fetch;
    const authority = apifySpendAuthority({ token: "t", fetchImpl });
    await expect(authority.check(1)).resolves.toEqual({
      funded: false,
      reason: "unreadable",
      resetsLabel: null,
    });
  });

  it("fails CLOSED with no token configured, without calling the network", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const authority = apifySpendAuthority({ token: undefined, fetchImpl });
    expect(await authority.check(1)).toEqual({ funded: false, reason: "unreadable", resetsLabel: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/billing/__tests__/spend-authority.test.ts`
Expected: FAIL — `Failed to resolve import "../spend-authority"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/billing/spend-authority.ts`:

```ts
/**
 * spend-authority.ts — THE PLATFORM'S money gate. Twin of `credit-gate.ts`, which gates the
 * CREATOR's money.
 *
 * Two different budgets sit between a chat turn and an Apify scrape, and conflating them produces
 * the worst possible message: a platform cap-out rendered as a paywall. A creator who is out of
 * credits should upgrade; a creator hitting OUR monthly Apify cap has done nothing wrong and must
 * never be shown an upgrade door for it. Hence two seams, checked in that order (spec §1).
 *
 * FAILS CLOSED, deliberately the opposite of `rateLimitGuard`. That guard protects us FROM users and
 * its failure mode is "product down", so it fails open. This one guards a hard external cap whose
 * overrun makes Apify 403 — and this app disguises that 403 as "check your handle is public"
 * (memory: apify-free-plan-hard-limit), so failing open buys a real-money overrun PLUS an hour of
 * misdiagnosis. Precedent one file over: a billable skill with no `billing` seam is REFUSED, loudly,
 * never run for free.
 *
 * NO TTL CACHE, on purpose. `check()` only runs on the cold path, which is already about to spend
 * minutes and real money — a ~200ms read is free against that. A module-level cache would be
 * per-lambda and could not coordinate concurrent turns anyway; the reserve floor is what handles
 * concurrency, cache or no cache.
 */

/** Conservative measured average across the live Phase-1 runs (verify-apify-first.ts). */
export const ESTIMATED_RUN_COST_USD = 0.0513;

/**
 * Runs held back beyond what the caller is asking for.
 *
 * Its ONLY job is to absorb concurrency and Apify's metering lag: a run in flight is not yet counted
 * in `monthlyUsageUsd`, so two simultaneous turns can both read the same headroom. It does NOT
 * reserve a share for the nightly crons (owner decision 8).
 */
export const RESERVE_RUNS = 4;

const LIMITS_URL = "https://api.apify.com/v2/users/me/limits";
const READ_TIMEOUT_MS = 3000;

export type SpendVerdict =
  | { funded: true; remainingUsd: number }
  | { funded: false; reason: "capped"; resetsLabel: string }
  | { funded: false; reason: "unreadable"; resetsLabel: null };

export interface SpendAuthority {
  /**
   * May the platform pay for `scrapes` Apify runs right now? Never throws.
   *
   * `scrapes` is a parameter because the actions differ: an explore pull is ONE Apify run, an
   * account read fires TWO (`scrapeProfile` + `scrapeVideos(handle, 30)` — pricing.ts:103). A
   * single boolean would be a lie for the heavier one.
   */
  check: (scrapes: number) => Promise<SpendVerdict>;
}

const UNREADABLE: SpendVerdict = { funded: false, reason: "unreadable", resetsLabel: null };

/**
 * The day the cycle rolls over, formatted in UTC.
 *
 * UTC is not a detail. `endAt` is `…T23:59:59.999Z`; rendering that instant in server locale prints
 * the PREVIOUS day for every reader west of UTC — an off-by-one in the one sentence whose entire job
 * is to be trustworthy.
 */
function resetsLabelFrom(endAtIso: string): string | null {
  const end = new Date(endAtIso);
  if (Number.isNaN(end.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(end.getTime() + 1));
}

export interface SpendAuthorityDeps {
  token?: string;
  fetchImpl?: typeof fetch;
}

export function apifySpendAuthority(deps: SpendAuthorityDeps = {}): SpendAuthority {
  const token = deps.token ?? process.env.APIFY_TOKEN;
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    check: async (scrapes: number): Promise<SpendVerdict> => {
      if (!token) return UNREADABLE;
      try {
        const res = await fetchImpl(`${LIMITS_URL}?token=${token}`, {
          signal: AbortSignal.timeout(READ_TIMEOUT_MS),
        });
        if (!res.ok) return UNREADABLE;
        const body = (await res.json()) as {
          data?: {
            limits?: { maxMonthlyUsageUsd?: unknown };
            current?: { monthlyUsageUsd?: unknown };
            monthlyUsageCycle?: { endAt?: unknown };
          };
        };
        const cap = body.data?.limits?.maxMonthlyUsageUsd;
        const used = body.data?.current?.monthlyUsageUsd;
        const endAt = body.data?.monthlyUsageCycle?.endAt;
        if (typeof cap !== "number" || typeof used !== "number" || typeof endAt !== "string") {
          return UNREADABLE;
        }
        const remainingUsd = cap - used;
        const floor = (RESERVE_RUNS + scrapes) * ESTIMATED_RUN_COST_USD;
        if (remainingUsd >= floor) return { funded: true, remainingUsd };
        const resetsLabel = resetsLabelFrom(endAt);
        // A capped verdict with no date it can name is indistinguishable, to the creator, from an
        // unreadable one — so it degrades to the honestly-vague branch rather than inventing a day.
        return resetsLabel ? { funded: false, reason: "capped", resetsLabel } : UNREADABLE;
      } catch {
        return UNREADABLE;
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/billing/__tests__/spend-authority.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Delete the hand-rolled duplicate in the verify script**

In `scripts/verify-apify-first.ts`, delete the whole `assertApifyHeadroom` function (lines 56-69) and
its `await assertApifyHeadroom();` call. Add to the `require` block near the top:

```ts
const { apifySpendAuthority } = require("@/lib/billing/spend-authority");
```

Replace the call at the top of `main()` with:

```ts
  // ONE implementation of "do we have headroom" — this script used to hand-roll a second one with
  // its own threshold. A second hand-rolled writer for something that already has a canonical one
  // is exactly how the three Phase-1 write-back defects got in.
  const verdict = await apifySpendAuthority().check(2);
  if (!verdict.funded) {
    throw new Error(`Apify budget says ${verdict.reason} — refusing to run`);
  }
  console.log(`APIFY — $${verdict.remainingUsd.toFixed(2)} headroom`);
```

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/billing/spend-authority.ts src/lib/billing/__tests__/spend-authority.test.ts scripts/verify-apify-first.ts
git commit -m "feat(billing): SpendAuthority — the platform Apify budget seam, fail-closed"
```

---

## Task 2: Warm coverage — gate 1

**Files:**
- Modify: `src/lib/grounding/types.ts:429` (add `postedAt` to `RetrievedExample`)
- Modify: `src/lib/grounding/retrieve.ts:288` (map it in `matchRowToExample`)
- Create: `src/lib/discover/warm-coverage.ts`
- Create: `src/lib/discover/__tests__/warm-coverage.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `WarmCoverage` (`{ sufficient, count, newestPostedAt, examples }`),
  `assessWarmCoverage(examples)`, `WARM_MIN_ROWS`.

- [ ] **Step 1: Widen `RetrievedExample`**

In `src/lib/grounding/types.ts`, inside `interface RetrievedExample` (after `similarity`), add:

```ts
  /**
   * When the source video was POSTED (ISO), for the "newest N days old" half of a warm-coverage
   * answer. `SharedMatchRow` has always carried `posted_at` and the match RPC has always returned
   * it — `matchRowToExample` simply dropped it, so no consumer could report corpus age.
   *
   * OPTIONAL because the scrape path (`toRetrievedExample`) does not set it and ~6 test literals
   * construct this shape by hand. Absent means "this path does not carry a date" — never "posted
   * today". A warm answer with no date omits the age clause rather than inventing one.
   */
  postedAt?: string | null;
```

In `src/lib/grounding/retrieve.ts`, inside `matchRowToExample`'s returned object (after
`similarity:`), add:

```ts
    // Carried, not dropped — see RetrievedExample.postedAt. The RPC already returns it.
    postedAt: row.posted_at,
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/discover/__tests__/warm-coverage.test.ts`:

```ts
/**
 * warm-coverage.test.ts — GATE 1 of the chat agent's scrape governance (spec §1.1).
 *
 * The threshold is NOT new: "at least three rows clearing 3× against a stated baseline" is the rule
 * corpus-tool's `grounded` flag already computes and the loop's directive already states to the
 * model. Gate 1 reuses it so a free warm answer can never disagree with the citation cards rendered
 * beside it.
 */
import { describe, it, expect } from "vitest";
import { assessWarmCoverage, WARM_MIN_ROWS } from "../warm-coverage";
import type { RetrievedExample } from "@/lib/grounding/types";

function example(over: Partial<RetrievedExample> = {}): RetrievedExample {
  return {
    teardownId: "t1",
    handle: "@someone",
    videoUrl: "https://tiktok.com/@someone/video/1",
    coverUrl: null,
    platform: "tiktok",
    multiplier: 8,
    views: 120_000,
    baselineLabel: "vs their usual views",
    fitLabel: null,
    hookArchetype: "contrarian",
    format: "talking_head",
    visualSetting: null,
    editingStyle: null,
    hookTechniques: [],
    niche: "fitness",
    spokenHook: "Everyone told me to do this. They were wrong.",
    hookTemplate: "Everyone told me to [X]. They were wrong.",
    template: null,
    idea: null,
    whyItWorks: null,
    sourcePool: "curated",
    trustWeight: 1,
    fromPersonal: false,
    similarity: 0.72,
    postedAt: "2026-08-04T00:00:00.000Z",
    ...over,
  } as RetrievedExample;
}

describe("assessWarmCoverage", () => {
  it("is sufficient at exactly WARM_MIN_ROWS proof-grade rows", () => {
    const out = assessWarmCoverage(Array.from({ length: WARM_MIN_ROWS }, () => example()));
    expect(out.sufficient).toBe(true);
    expect(out.count).toBe(WARM_MIN_ROWS);
  });

  it("is INSUFFICIENT one row short", () => {
    const out = assessWarmCoverage(Array.from({ length: WARM_MIN_ROWS - 1 }, () => example()));
    expect(out.sufficient).toBe(false);
  });

  it("does not count a row under 3x", () => {
    const rows = [example(), example(), example({ multiplier: 2.9 })];
    expect(assessWarmCoverage(rows).count).toBe(2);
    expect(assessWarmCoverage(rows).sufficient).toBe(false);
  });

  it("does not count a big multiplier with NO stated baseline — that is a boast, not proof", () => {
    const rows = [example(), example(), example({ multiplier: 40, baselineLabel: null })];
    expect(assessWarmCoverage(rows).count).toBe(2);
  });

  it("does not count a null multiplier", () => {
    const rows = [example(), example(), example({ multiplier: null })];
    expect(assessWarmCoverage(rows).count).toBe(2);
  });

  it("reports the NEWEST postedAt across counted rows", () => {
    const out = assessWarmCoverage([
      example({ postedAt: "2026-07-01T00:00:00.000Z" }),
      example({ postedAt: "2026-08-06T00:00:00.000Z" }),
      example({ postedAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(out.newestPostedAt).toBe("2026-08-06T00:00:00.000Z");
  });

  it("returns newestPostedAt null when no counted row carries a date — never fabricates one", () => {
    const out = assessWarmCoverage([
      example({ postedAt: undefined }),
      example({ postedAt: null }),
      example({ postedAt: undefined }),
    ]);
    expect(out.sufficient).toBe(true);
    expect(out.newestPostedAt).toBeNull();
  });

  it("ignores dates on rows that did NOT count", () => {
    // A brand-new row that fails the 3x bar must not make the corpus look fresh.
    const out = assessWarmCoverage([
      example({ postedAt: "2026-07-01T00:00:00.000Z" }),
      example({ postedAt: "2026-07-02T00:00:00.000Z" }),
      example({ postedAt: "2026-08-09T00:00:00.000Z", multiplier: 1.2 }),
    ]);
    expect(out.newestPostedAt).toBe("2026-07-02T00:00:00.000Z");
  });

  it("is empty-safe", () => {
    expect(assessWarmCoverage([])).toEqual({
      sufficient: false,
      count: 0,
      newestPostedAt: null,
      examples: [],
    });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/discover/__tests__/warm-coverage.test.ts`
Expected: FAIL — `Failed to resolve import "../warm-coverage"`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/discover/warm-coverage.ts`:

```ts
/**
 * warm-coverage.ts — GATE 1 of the chat agent's scrape governance.
 *
 * "Do we already have enough proven material for this niche to answer for free?" The whole point of
 * the gate ordering (spec §1) is that the common path touches no budget at all: warm is checked
 * BEFORE the platform's Apify cap and before the creator's credits, so the ordinary ask costs
 * nothing and nobody is shown a wall for it.
 *
 * ⚠️ THE THRESHOLD IS NOT NEW. "At least three rows clearing 3x against a stated baseline" is the
 * rule this product already ships — `corpus-tool` computes its `grounded` flag on it, and the chat
 * loop's own directive states it verbatim to the model ("Claim something is PROVEN only when you
 * have at least three returned examples clearing 3x against a stated baseline"). Inventing a second
 * definition of "enough proof" here would let a free warm answer contradict the citation cards
 * rendered beside it.
 *
 * ⚠️ AND THE 3x HERE IS NOT `rankOutliers`' 3x. A corpus row's `outlier_multiplier` is the
 * WRITE-TIME figure — views / followers, gated at ingest by MIN_OUTLIER_MULTIPLIER.
 * `rankOutliers` computes a WITHIN-SET median that moves with `resultsPerPage` (memory:
 * multiplier-depends-on-scrape-size). Same word, different number, different code path. Reading
 * this gate off the latter would make it admit rows on a statistic that depends on scrape size.
 */

import { MIN_OUTLIER_MULTIPLIER } from "@/lib/grounding/outlier-gate";
import type { RetrievedExample } from "@/lib/grounding/types";

/** Same floor as the corpus tool's `grounded` flag and the loop's directive. */
export const WARM_MIN_ROWS = 3;

export interface WarmCoverage {
  /** May we answer this ask for free, without any scrape? */
  sufficient: boolean;
  /** How many rows actually cleared the bar (NOT how many were returned). */
  count: number;
  /** Newest posted date among the COUNTED rows, or null when none carries one. */
  newestPostedAt: string | null;
  /** The counted rows, for the answer the dispatcher composes. */
  examples: RetrievedExample[];
}

/**
 * A row may be counted only when BOTH halves of the sentence hold: it cleared the bar, AND it
 * cleared it against something named. A big number measured against nothing is not proof, it is a
 * number — the same rule `isProofGrade` applies at the DB-row level (retrieve.ts), restated here
 * for the mapped shape.
 */
function isProven(e: RetrievedExample): boolean {
  if (typeof e.baselineLabel !== "string" || e.baselineLabel.trim().length === 0) return false;
  return typeof e.multiplier === "number" && Number.isFinite(e.multiplier) && e.multiplier >= MIN_OUTLIER_MULTIPLIER;
}

export function assessWarmCoverage(examples: readonly RetrievedExample[]): WarmCoverage {
  const counted = examples.filter(isProven);
  // Only COUNTED rows may set the age. A brand-new row that failed the bar must not make the
  // corpus look fresher than its proof actually is.
  let newestPostedAt: string | null = null;
  for (const e of counted) {
    const at = e.postedAt;
    if (typeof at !== "string" || at.length === 0) continue;
    if (newestPostedAt === null || at > newestPostedAt) newestPostedAt = at;
  }
  return {
    sufficient: counted.length >= WARM_MIN_ROWS,
    count: counted.length,
    newestPostedAt,
    examples: counted,
  };
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/discover/__tests__/warm-coverage.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Run the grounding suite — the widened interface must not have broken a constructor**

Run: `node node_modules/vitest/vitest.mjs run src/lib/grounding`
Expected: PASS, unchanged count.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/discover/warm-coverage.ts src/lib/discover/__tests__/warm-coverage.test.ts src/lib/grounding/types.ts src/lib/grounding/retrieve.ts
git commit -m "feat(discover): warm coverage gate — reuse the shipped 3-rows-at-3x proof rule"
```

---

## Task 3: The deterministic copy module

**Files:**
- Create: `src/lib/tools/proposal-copy.ts`
- Create: `src/lib/tools/__tests__/proposal-copy.test.ts`

**Interfaces:**
- Consumes: `SpendVerdict` (Task 1), `WarmCoverage` (Task 2).
- Produces: `ProposalSkill` (`"explore" | "account"`), `cappedSentence(skill, verdict, warm)`,
  `unreadableSentence(skill)`, `warmAnswerSentence(warm, niche)`, `proposalLabel(skill, args)`,
  `deadTokenSentence()`, `scrapeFailedSentence(skill, niche)`, `ageClause(newestPostedAt, now)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tools/__tests__/proposal-copy.test.ts`:

```ts
/**
 * proposal-copy.test.ts — every creator-facing sentence on the governed-scrape path.
 *
 * These are DETERMINISTIC, built here and relayed by the model, never written by it. Same pattern as
 * `quotaRefusalMessage`, same reason: a relayed refusal has gone wrong on this path before, and the
 * one thing a prompt cannot promise is exact wording.
 */
import { describe, it, expect } from "vitest";
import {
  ageClause,
  cappedSentence,
  deadTokenSentence,
  proposalLabel,
  scrapeFailedSentence,
  unreadableSentence,
  warmAnswerSentence,
} from "../proposal-copy";

const NOW = new Date("2026-08-10T12:00:00.000Z");

describe("ageClause", () => {
  it("renders days", () => {
    expect(ageClause("2026-08-04T12:00:00.000Z", NOW)).toBe("newest 6 days old");
  });
  it("renders a single day in the singular", () => {
    expect(ageClause("2026-08-09T12:00:00.000Z", NOW)).toBe("newest 1 day old");
  });
  it("says 'newest from today' rather than '0 days old'", () => {
    expect(ageClause("2026-08-10T09:00:00.000Z", NOW)).toBe("newest from today");
  });
  it("is EMPTY with no date — the sentence omits the clause, never invents one", () => {
    expect(ageClause(null, NOW)).toBe("");
  });
});

describe("cappedSentence", () => {
  it("explore WITH warm rows names the count, the age and the reset date", () => {
    const s = cappedSentence(
      "explore",
      { funded: false, reason: "capped", resetsLabel: "Aug 21" },
      { sufficient: true, count: 9, newestPostedAt: "2026-08-04T12:00:00.000Z", examples: [] },
      { niche: "fitness coaches", now: NOW },
    );
    expect(s).toBe(
      "These are the outliers I already have for fitness coaches — 9 videos, newest 6 days old. " +
        "I can't pull anything fresher until Aug 21.",
    );
  });

  it("explore with warm rows but NO dates drops the age clause cleanly", () => {
    const s = cappedSentence(
      "explore",
      { funded: false, reason: "capped", resetsLabel: "Aug 21" },
      { sufficient: true, count: 9, newestPostedAt: null, examples: [] },
      { niche: "fitness coaches", now: NOW },
    );
    expect(s).toBe(
      "These are the outliers I already have for fitness coaches — 9 videos. " +
        "I can't pull anything fresher until Aug 21.",
    );
  });

  it("explore with NOTHING warm offers to work from what they have", () => {
    const s = cappedSentence(
      "explore",
      { funded: false, reason: "capped", resetsLabel: "Aug 21" },
      { sufficient: false, count: 0, newestPostedAt: null, examples: [] },
      { niche: "fitness coaches", now: NOW },
    );
    expect(s).toBe(
      "I don't have proven outliers for fitness coaches yet, and I can't pull fresh ones until " +
        "Aug 21. Want me to work from what you've already got instead?",
    );
  });

  it("account has NO warm arm and gets its own sentence", () => {
    const s = cappedSentence(
      "account",
      { funded: false, reason: "capped", resetsLabel: "Aug 21" },
      { sufficient: false, count: 0, newestPostedAt: null, examples: [] },
      { now: NOW },
    );
    expect(s).toBe("I can't read your account right now — I'm not able to pull new posts until Aug 21.");
  });

  it("NEVER mentions credits, upgrading, or a plan — a cap-out is not the creator's fault", () => {
    for (const skill of ["explore", "account"] as const) {
      const s = cappedSentence(
        skill,
        { funded: false, reason: "capped", resetsLabel: "Aug 21" },
        { sufficient: false, count: 0, newestPostedAt: null, examples: [] },
        { niche: "x", now: NOW },
      );
      expect(s.toLowerCase()).not.toMatch(/credit|upgrade|plan|billing|budget/);
    }
  });
});

describe("unreadableSentence", () => {
  it("names NO date, because we genuinely do not know one", () => {
    expect(unreadableSentence("explore")).toBe("I can't pull fresh videos right now.");
    expect(unreadableSentence("account")).toBe("I can't read your account right now.");
    expect(unreadableSentence("explore")).not.toMatch(/until|Aug|resets/);
  });
});

describe("warmAnswerSentence", () => {
  it("states count and age", () => {
    expect(
      warmAnswerSentence(
        { sufficient: true, count: 9, newestPostedAt: "2026-08-04T12:00:00.000Z", examples: [] },
        "fitness coaches",
        NOW,
      ),
    ).toBe("I've got 9 proven outliers for fitness coaches — newest 6 days old.");
  });
});

describe("proposalLabel", () => {
  it("renders explore's label FROM THE ARGS", () => {
    expect(proposalLabel("explore", { topic: "fitness coaches" })).toBe(
      "Pull fresh outliers for fitness coaches",
    );
  });
  it("renders account's label, which needs no args", () => {
    expect(proposalLabel("account", {})).toBe("Read your account and pull the patterns");
  });
  it("is total — a missing topic never produces 'undefined' on a button", () => {
    expect(proposalLabel("explore", {})).toBe("Pull fresh outliers");
    expect(proposalLabel("explore", { topic: "   " })).toBe("Pull fresh outliers");
  });
});

describe("failure sentences", () => {
  it("a dead token points at asking again, not at retrying the tap", () => {
    expect(deadTokenSentence()).toBe(
      "That offer isn't current any more — ask me again and I'll set up a fresh one.",
    );
  });

  it("account's scrape-failure line mentions the handle ONLY where a cap-out is ruled out", () => {
    // "check the handle is public" is exactly what an Apify cap-out masquerades as
    // (memory: apify-free-plan-hard-limit). It may only be said once SpendAuthority has
    // confirmed we are funded — which is the caller's job, and this test pins the wording
    // so a future edit cannot quietly move it to the capped branch.
    expect(scrapeFailedSentence("account")).toBe(
      "Couldn't read your account — check the handle is public.",
    );
    expect(scrapeFailedSentence("explore", "fitness coaches")).toBe(
      "Couldn't pull anything for fitness coaches — try a different one.",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/proposal-copy.test.ts`
Expected: FAIL — `Failed to resolve import "../proposal-copy"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/tools/proposal-copy.ts`:

```ts
/**
 * proposal-copy.ts — every creator-facing sentence on the governed-scrape path, in one place.
 *
 * DETERMINISTIC, built here and relayed by the model, never written by it. Same pattern as
 * `quotaRefusalMessage` for credits, and the same reason: on this path a relayed refusal has gone
 * wrong before, and exact wording is the one thing a prompt cannot promise.
 *
 * Sentences are keyed by (skill, branch), not branch alone — only `explore` has a warm arm, because
 * your own account has no cached equivalent.
 *
 * TWO RULES A FUTURE EDIT MUST NOT BREAK:
 *  1. A cap-out NEVER mentions credits, upgrading or a plan. Hitting OUR monthly Apify cap is not
 *     the creator's fault and must never render as a paywall (owner decision 4).
 *  2. "check the handle is public" belongs ONLY to a scrape failure that happened while FUNDED. At
 *     the cap Apify 403s and this app has historically disguised that as exactly this sentence
 *     (memory: apify-free-plan-hard-limit) — which is how a cap-out costs an hour of debugging the
 *     wrong thing.
 */

import type { SpendVerdict } from "@/lib/billing/spend-authority";
import type { WarmCoverage } from "@/lib/discover/warm-coverage";
import type { SkillToolArgs } from "@/lib/tools/skill-dispatch";

/** The skills the agent may PROPOSE. `remix` is deferred (spec §3.1). */
export type ProposalSkill = "explore" | "account";

const MS_PER_DAY = 86_400_000;

/** "newest 6 days old" / "newest from today" / "" when no date is carried. */
export function ageClause(newestPostedAt: string | null, now: Date): string {
  if (!newestPostedAt) return "";
  const then = new Date(newestPostedAt);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
  if (days <= 0) return "newest from today";
  return `newest ${days} ${days === 1 ? "day" : "days"} old`;
}

export function warmAnswerSentence(warm: WarmCoverage, niche: string, now: Date): string {
  const age = ageClause(warm.newestPostedAt, now);
  return `I've got ${warm.count} proven outliers for ${niche}${age ? ` — ${age}` : ""}.`;
}

export interface CopyContext {
  niche?: string;
  now: Date;
}

export function cappedSentence(
  skill: ProposalSkill,
  verdict: Extract<SpendVerdict, { reason: "capped" }>,
  warm: WarmCoverage,
  ctx: CopyContext,
): string {
  const { resetsLabel } = verdict;
  if (skill === "account") {
    return `I can't read your account right now — I'm not able to pull new posts until ${resetsLabel}.`;
  }
  const niche = ctx.niche?.trim() || "that";
  if (warm.count > 0) {
    const age = ageClause(warm.newestPostedAt, ctx.now);
    return (
      `These are the outliers I already have for ${niche} — ${warm.count} videos` +
      `${age ? `, ${age}` : ""}. I can't pull anything fresher until ${resetsLabel}.`
    );
  }
  return (
    `I don't have proven outliers for ${niche} yet, and I can't pull fresh ones until ` +
    `${resetsLabel}. Want me to work from what you've already got instead?`
  );
}

export function unreadableSentence(skill: ProposalSkill): string {
  // No date. We genuinely do not know one, and vagueness is the correct register for an unknown.
  return skill === "account"
    ? "I can't read your account right now."
    : "I can't pull fresh videos right now.";
}

export function proposalLabel(skill: ProposalSkill, args: SkillToolArgs): string {
  if (skill === "account") return "Read your account and pull the patterns";
  const topic = typeof args.topic === "string" ? args.topic.trim() : "";
  // Total by construction: the label is the creator's ONLY view of the server-held args, so it must
  // never render "undefined" onto a button that spends money.
  return topic ? `Pull fresh outliers for ${topic}` : "Pull fresh outliers";
}

export function deadTokenSentence(): string {
  return "That offer isn't current any more — ask me again and I'll set up a fresh one.";
}

/** ⚠️ Only reachable once SpendAuthority has returned `funded` — see rule 2 in the header. */
export function scrapeFailedSentence(skill: ProposalSkill, niche?: string): string {
  if (skill === "account") return "Couldn't read your account — check the handle is public.";
  const subject = niche?.trim() || "that";
  return `Couldn't pull anything for ${subject} — try a different one.`;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/proposal-copy.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/proposal-copy.ts src/lib/tools/__tests__/proposal-copy.test.ts
git commit -m "feat(tools): deterministic copy for the governed-scrape path"
```

---

## Task 4: The proposal slot — migration, RPC, and helpers

**Files:**
- Create: `supabase/migrations/20260810120000_thread_pending_proposal.sql`
- Create: `src/lib/threads/proposals.ts`
- Create: `src/lib/threads/__tests__/proposals.test.ts`

**Interfaces:**
- Consumes: `ProposalSkill` (Task 3).
- Produces: `PendingProposal`, `readPendingProposal(row)`, `armProposal(supabase, …)`,
  `claimProposal(supabase, …)`, `releaseProposal(supabase, …)`, `PROPOSAL_TTL_HOURS`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260810120000_thread_pending_proposal.sql`:

```sql
-- =========================================================================
-- Phase 3 — the chat agent's single-use scrape proposal.
--
-- ONE jsonb column on the existing thread row — no new table, RLS inherited
-- from `threads`. Same shape of decision as sim_seals (20260723090753).
--
-- The single slot is the DESIGN, not a shortcut: it enforces one live
-- proposal per thread by construction. A new proposal overwrites the old, so
-- supersession is automatic rather than a cleanup rule someone must remember.
-- A separate table would let a thread accumulate a scrollback of live
-- 5-credit buttons.
--
-- Shape: { token, action, args, at, consumedAt? }  (or NULL — no live offer)
--   token      = single-use claim (crypto.randomUUID)
--   action     = 'explore' | 'account'
--   args       = the SERVER-HELD skill arguments. Never sent to the client:
--                a client-supplied arg would let a creator scrape anything.
--   at         = ISO, when the offer was armed (drives the 24h TTL)
--   consumedAt = ISO, set by the claim. Retained rather than nulled so the
--                renderer can show a tapped card as done, not merely absent.
-- =========================================================================

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS pending_proposal jsonb;

COMMENT ON COLUMN public.threads.pending_proposal IS
  'Phase 3 single-use scrape proposal: { token, action, args, at, consumedAt? }. One slot = one live offer per thread, by construction. Args are server-held and never sent to the client. Claimed atomically via claim_thread_proposal(). RLS inherited from the thread row.';

-- The ATOMIC claim. A conditional UPDATE, never a read-then-write: a double-tap
-- must burn the token rather than race two scrapes past two independent gate reads.
--
-- Marks consumed rather than nulling, so RETURNING reads the new row
-- unambiguously and hands back the args in one round trip.
--
-- Zero rows means: already tapped, superseded, expired, or not theirs — four
-- cases, one clean 409 at the route.
CREATE OR REPLACE FUNCTION public.claim_thread_proposal(
  p_thread uuid,
  p_user   uuid,
  p_token  text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.threads
     SET pending_proposal = jsonb_set(pending_proposal, '{consumedAt}', to_jsonb(now()))
   WHERE id = p_thread
     AND user_id = p_user
     AND pending_proposal->>'token' = p_token
     AND pending_proposal->>'consumedAt' IS NULL
     AND (pending_proposal->>'at')::timestamptz > now() - interval '24 hours'
  RETURNING pending_proposal;
$$;

COMMENT ON FUNCTION public.claim_thread_proposal IS
  'Atomically claim a thread''s pending scrape proposal by token. Returns the proposal jsonb on success, NULL when already consumed / superseded / expired / not owned by p_user.';
```

- [ ] **Step 2: Apply it via the Supabase SQL editor**

`supabase db push` is UNSAFE in this project (migration-ledger drift). Open the SQL editor for
project `qyxvxleheckijapurisj`, paste the file, run it. Then verify:

```sql
select column_name from information_schema.columns
 where table_name = 'threads' and column_name = 'pending_proposal';
select proname from pg_proc where proname = 'claim_thread_proposal';
```

Expected: one row each.

- [ ] **Step 3: Write the failing test**

Create `src/lib/threads/__tests__/proposals.test.ts`:

```ts
/**
 * proposals.test.ts — the single-use scrape proposal slot.
 *
 * The PARSER is the unit under test and runs for real (a corrupt slot must never produce a live
 * offer). The Supabase client is the I/O boundary and is mocked.
 *
 * What these tests CANNOT see, and the reason scripts/verify-chat-proposal.ts exists: whether the
 * claim is genuinely atomic under a concurrent double-tap. That is a property of the SQL, not of
 * this file.
 */
import { describe, it, expect, vi } from "vitest";
import {
  armProposal,
  claimProposal,
  readPendingProposal,
  releaseProposal,
} from "../proposals";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID = {
  token: "tok-1",
  action: "explore",
  args: { topic: "fitness coaches" },
  at: "2026-08-10T10:00:00.000Z",
};

describe("readPendingProposal", () => {
  it("parses a well-formed live slot", () => {
    expect(readPendingProposal({ pending_proposal: VALID })).toEqual(VALID);
  });

  it("returns null for a CONSUMED slot — a tapped offer is not live", () => {
    expect(
      readPendingProposal({ pending_proposal: { ...VALID, consumedAt: "2026-08-10T11:00:00.000Z" } }),
    ).toBeNull();
  });

  it("returns null for an unknown action — never surfaces a button that cannot run", () => {
    expect(readPendingProposal({ pending_proposal: { ...VALID, action: "delete_everything" } })).toBeNull();
  });

  it("returns null for a missing/blank token", () => {
    expect(readPendingProposal({ pending_proposal: { ...VALID, token: "" } })).toBeNull();
    expect(readPendingProposal({ pending_proposal: { ...VALID, token: 42 } as never })).toBeNull();
  });

  it("returns null for a non-object args", () => {
    expect(readPendingProposal({ pending_proposal: { ...VALID, args: "fitness" } as never })).toBeNull();
  });

  it("returns null for null / array / non-object slots", () => {
    expect(readPendingProposal({ pending_proposal: null })).toBeNull();
    expect(readPendingProposal({ pending_proposal: [] as never })).toBeNull();
    expect(readPendingProposal({ pending_proposal: "nope" as never })).toBeNull();
  });
});

/** update→eq→eq resolving { error }, capturing the payload. */
function mockUpdate(error: { message: string } | null = null) {
  const eq2 = vi.fn().mockResolvedValue({ error });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from } as unknown as SupabaseClient, update, from };
}

describe("armProposal", () => {
  it("writes token, action, args and a timestamp, scoped by thread AND user", async () => {
    const { client, update } = mockUpdate();
    const token = await armProposal(client, "thread-1", "user-1", "explore", { topic: "fitness" });
    expect(token).toMatch(/\S/);
    const payload = update.mock.calls[0]![0] as { pending_proposal: Record<string, unknown> };
    expect(payload.pending_proposal).toMatchObject({
      token,
      action: "explore",
      args: { topic: "fitness" },
    });
    expect(typeof payload.pending_proposal.at).toBe("string");
    expect(payload.pending_proposal.consumedAt).toBeUndefined();
  });

  it("mints a DIFFERENT token each time — a reused token is a replayable spend", async () => {
    const a = await armProposal(mockUpdate().client, "t", "u", "explore", {});
    const b = await armProposal(mockUpdate().client, "t", "u", "explore", {});
    expect(a).not.toBe(b);
  });

  it("returns null on a DB error rather than throwing — arming must not kill the turn", async () => {
    const { client } = mockUpdate({ message: "db down" });
    expect(await armProposal(client, "t", "u", "explore", {})).toBeNull();
  });
});

describe("claimProposal", () => {
  it("returns the parsed proposal when the RPC yields a row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...VALID, consumedAt: "2026-08-10T11:00:00Z" }, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const claimed = await claimProposal(client, "thread-1", "user-1", "tok-1");
    expect(claimed).toMatchObject({ action: "explore", args: { topic: "fitness coaches" } });
    expect(rpc).toHaveBeenCalledWith("claim_thread_proposal", {
      p_thread: "thread-1",
      p_user: "user-1",
      p_token: "tok-1",
    });
  });

  it("returns null when the RPC yields nothing — tapped, superseded, expired or not theirs", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } as unknown as SupabaseClient;
    expect(await claimProposal(client, "t", "u", "tok")).toBeNull();
  });

  it("returns null on an RPC error rather than throwing", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    } as unknown as SupabaseClient;
    expect(await claimProposal(client, "t", "u", "tok")).toBeNull();
  });
});

describe("releaseProposal", () => {
  it("clears consumedAt so a topped-up creator can tap the SAME offer again", async () => {
    const { client, update } = mockUpdate();
    await releaseProposal(client, "thread-1", "user-1", VALID);
    const payload = update.mock.calls[0]![0] as { pending_proposal: Record<string, unknown> };
    expect(payload.pending_proposal.consumedAt).toBeUndefined();
    expect(payload.pending_proposal.token).toBe("tok-1");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/threads/__tests__/proposals.test.ts`
Expected: FAIL — `Failed to resolve import "../proposals"`.

- [ ] **Step 5: Write the implementation**

Create `src/lib/threads/proposals.ts`:

```ts
/**
 * proposals.ts — the chat agent's single-use scrape proposal, stored in ONE jsonb slot on the
 * thread row (`threads.pending_proposal`).
 *
 * THE SLOT IS THE DESIGN. Because there is exactly one, a new proposal overwrites the old and
 * supersession is automatic — not a cleanup rule someone has to remember. It is also why the
 * dispatcher caps proposals at one per turn (chat-agent-loop.ts): a second proposal in the same turn
 * would overwrite the first, leaving a rendered card in the thread whose token is already dead — a
 * button that costs a tap and returns a 409. The cap is a CONSEQUENCE of this storage, not a policy
 * laid on top of it.
 *
 * `args` are server-held and never sent to the client. That is the whole security property: a
 * client-supplied arg would let a creator scrape anything. The card's label is rendered from these
 * args server-side (proposal-copy.ts), so the label is the creator's only view of what they are
 * authorising — and it cannot disagree with what will run.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalSkill } from "@/lib/tools/proposal-copy";
import type { SkillToolArgs } from "@/lib/tools/skill-dispatch";

/** Mirrors the interval in `claim_thread_proposal`. Changing one requires changing both. */
export const PROPOSAL_TTL_HOURS = 24;

const PROPOSAL_ACTIONS: readonly ProposalSkill[] = ["explore", "account"];

export interface PendingProposal {
  token: string;
  action: ProposalSkill;
  args: SkillToolArgs;
  at: string;
  consumedAt?: string;
}

/**
 * Parse the slot into a LIVE offer, or null. Degrades rather than throws: a thread can predate any
 * field, and a corrupt slot must never produce a tappable button that spends money.
 */
export function readPendingProposal(row: { pending_proposal?: unknown } | null): PendingProposal | null {
  const raw = row?.pending_proposal;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.consumedAt != null) return null; // tapped — not live
  const token = p.token;
  const action = p.action;
  const args = p.args;
  const at = p.at;
  if (typeof token !== "string" || token.trim().length === 0) return null;
  if (typeof action !== "string" || !PROPOSAL_ACTIONS.includes(action as ProposalSkill)) return null;
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  if (typeof at !== "string" || at.length === 0) return null;
  return { token, action: action as ProposalSkill, args: args as SkillToolArgs, at };
}

/**
 * Arm a proposal, replacing whatever was in the slot. Returns the token, or null on a DB failure —
 * NEVER throws: a failed arm must degrade to "no offer this turn", not take the turn down.
 */
export async function armProposal(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  action: ProposalSkill,
  args: SkillToolArgs,
): Promise<string | null> {
  const token = randomUUID();
  const { error } = await supabase
    .from("threads")
    .update({ pending_proposal: { token, action, args, at: new Date().toISOString() } })
    // Ownership scoped explicitly (CR-01) — the DB does not enforce it for us here.
    .eq("id", threadId)
    .eq("user_id", userId);
  return error ? null : token;
}

/**
 * Claim the proposal atomically. Null means: already tapped, superseded, expired, or not theirs.
 * The four cases are deliberately indistinguishable to the caller — they all produce one sentence.
 */
export async function claimProposal(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  token: string,
): Promise<PendingProposal | null> {
  const { data, error } = await supabase.rpc("claim_thread_proposal", {
    p_thread: threadId,
    p_user: userId,
    p_token: token,
  });
  if (error || !data) return null;
  const p = data as Record<string, unknown>;
  // The RPC returns the CONSUMED row (that is the proof it was claimed), so parse the fields
  // directly rather than through readPendingProposal, which rejects a consumed slot by design.
  const action = p.action;
  if (typeof p.token !== "string" || typeof action !== "string") return null;
  if (!PROPOSAL_ACTIONS.includes(action as ProposalSkill)) return null;
  if (!p.args || typeof p.args !== "object" || Array.isArray(p.args)) return null;
  return {
    token: p.token,
    action: action as ProposalSkill,
    args: p.args as SkillToolArgs,
    at: typeof p.at === "string" ? p.at : "",
    ...(typeof p.consumedAt === "string" ? { consumedAt: p.consumedAt } : {}),
  };
}

/**
 * Un-consume a claimed proposal — the ONE case where a burned token comes back.
 *
 * Only for a refusal by the CREATOR'S credit gate, because that is the single failure they can fix
 * and immediately retry (hit wall → upgrade → tap). Every other failure stays burned: re-arming on a
 * scrape failure builds a retry loop pointed at a $5/month cap.
 */
export async function releaseProposal(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  proposal: PendingProposal,
): Promise<void> {
  await supabase
    .from("threads")
    .update({
      pending_proposal: {
        token: proposal.token,
        action: proposal.action,
        args: proposal.args,
        at: proposal.at,
      },
    })
    .eq("id", threadId)
    .eq("user_id", userId);
}
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/threads/__tests__/proposals.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20260810120000_thread_pending_proposal.sql src/lib/threads/proposals.ts src/lib/threads/__tests__/proposals.test.ts
git commit -m "feat(threads): single-use scrape proposal slot + atomic claim RPC"
```

---

## Task 5: The `skill-proposal` block and its renderer

**Files:**
- Modify: `src/lib/tools/blocks.ts` (add schema near `InputRequestBlockSchema`, ~line 894)
- Modify: `src/lib/tools/block-registry.ts:55` (register)
- Modify: `src/lib/threads/chat-prior-turns.ts:205` (`NON_RECORD_BLOCKS`)
- Create: `src/components/thread/skill-proposal-block.tsx`
- Modify: `src/components/thread/message-blocks.tsx` (wire the renderer)

**Interfaces:**
- Consumes: `ProposalSkill` (Task 3).
- Produces: `SkillProposalBlockSchema`, `SkillProposalBlock`,
  `<SkillProposalBlockRenderer block={…} />`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tools/__tests__/skill-proposal-block.test.ts`:

```ts
/**
 * skill-proposal-block.test.ts — the write-boundary contract for the proposal card.
 *
 * The card is an OFFER TO SPEND. Two properties are load-bearing: it carries no args (they are
 * server-held), and it is registered so `insertMessage` will actually persist it — an unregistered
 * block is rejected at the write boundary and the offer would vanish on reload.
 */
import { describe, it, expect } from "vitest";
import { SkillProposalBlockSchema } from "../blocks";
import { BLOCK_REGISTRY } from "../block-registry";
import { NON_RECORD_BLOCKS } from "@/lib/threads/chat-prior-turns";

const valid = {
  type: "skill-proposal",
  props: {
    token: "tok-1",
    action: "explore",
    label: "Pull fresh outliers for fitness coaches",
    platform: "tiktok",
  },
};

describe("SkillProposalBlockSchema", () => {
  it("accepts a well-formed proposal", () => {
    expect(SkillProposalBlockSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty label — the label is the creator's ONLY view of the stored args", () => {
    const bad = { ...valid, props: { ...valid.props, label: "" } };
    expect(SkillProposalBlockSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown action", () => {
    const bad = { ...valid, props: { ...valid.props, action: "drop_tables" } };
    expect(SkillProposalBlockSchema.safeParse(bad).success).toBe(false);
  });

  it("STRIPS any args a caller tries to smuggle onto the card", () => {
    const parsed = SkillProposalBlockSchema.parse({
      ...valid,
      props: { ...valid.props, args: { topic: "anything" } },
    });
    expect(parsed.props).not.toHaveProperty("args");
  });

  it("is in BLOCK_REGISTRY, or insertMessage rejects it and the offer vanishes on reload", () => {
    expect(BLOCK_REGISTRY).toHaveProperty("skill-proposal");
  });

  it("is a NON-record block — an offer awaiting the creator is not a result", () => {
    expect(NON_RECORD_BLOCKS).toHaveProperty("skill-proposal");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/skill-proposal-block.test.ts`
Expected: FAIL — `SkillProposalBlockSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `src/lib/tools/blocks.ts`, immediately after `export type InputRequestBlock = …`:

```ts
// ─── skill-proposal ─────────────────────────────────────────────────────────────
// An OFFER TO SPEND, surfaced by the chat agent when a niche has no warm corpus coverage and both
// budgets say yes. The creator reviews a decision, not a form — one button, no fields.
//
// It carries NO ARGS. The skill arguments live server-side in `threads.pending_proposal`, because a
// client-supplied arg would let a creator scrape anything. `label` is therefore the creator's ONLY
// view of what they are authorising, which is why it is built server-side from those same stored
// args (proposal-copy.ts `proposalLabel`) and never written by the model — a model-written label
// could say "pull fitness outliers" over an arg saying something else.
//
// Same rule `input-request` already enforces for kind/label/placeholder, extended to the one field
// that now carries meaning.
export const SkillProposalBlockSchema = z.object({
  type: z.literal("skill-proposal"),
  props: z.object({
    /** Single-use claim. Meaningless without the server-side slot it points at. */
    token: z.string().min(1),
    /** Which skill the tap runs. Deferred: `remix` (spec §3.1). */
    action: z.enum(["explore", "account"]),
    /** Deterministic, server-built from the stored args. NEVER model text. */
    label: z.string().min(1),
    platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
  }),
});

export type SkillProposalBlock = z.infer<typeof SkillProposalBlockSchema>;
```

Add `SkillProposalBlockSchema` to the block-schema export list at the bottom of the file (alongside
`InputRequestBlockSchema` at ~line 1055).

- [ ] **Step 4: Register it**

In `src/lib/tools/block-registry.ts`, add `SkillProposalBlockSchema` to the import from `./blocks`
and add the registry row directly after `"input-request"`:

```ts
  "skill-proposal": { schema: SkillProposalBlockSchema as z.ZodType },
```

In `src/lib/threads/chat-prior-turns.ts`, add to `NON_RECORD_BLOCKS` after the `input-request` entry:

```ts
  "skill-proposal":
    "an OFFER to spend awaiting the creator's tap, not a result — recording it would read as an answer",
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/skill-proposal-block.test.ts`
Expected: PASS, 6 tests.

Also run the reachability drift test, which asserts every block is replayed, recorded, or knowingly
excluded:

Run: `node node_modules/vitest/vitest.mjs run src/lib/threads/__tests__/chat-prior-turns.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the renderer**

Create `src/components/thread/skill-proposal-block.tsx`:

```tsx
'use client';

/**
 * SkillProposalBlockRenderer — the chat agent's OFFER TO SPEND.
 *
 * Distinct from `input-request`, and the difference is the whole point: an input-request asks the
 * creator for a VALUE the agent does not have. This asks for a DECISION about a value the agent has
 * already worked out — so there is no field, just the sentence and one button. The creator reviews a
 * decision, not a form (owner decision 2).
 *
 * The args are server-held; `label` is the only thing describing them, built server-side from those
 * same args. Never render anything the model wrote here.
 *
 * States: idle → running (the skill's own spine) → done (receipt; the real cards are above via the
 * host reload) or error (inline, and the button does NOT come back — the token is burned, so the
 * honest next step is asking again, not tapping again).
 *
 * NO ACCENT. Accent dosage is LOCKED and primary actions are neutral cream (`CardPrimaryAction`).
 * A button that spends money is not a reason to reach for colour.
 */

import { useCallback, useState } from 'react';
import { reportCredit402 } from '@/lib/billing/credit-wall';
import { reportSession401, SESSION_EXPIRED_MESSAGE } from '@/lib/auth/session-expired';
import type { SkillProposalBlock } from '@/lib/tools/blocks';
import { useInThreadInput } from '@/lib/in-thread-input-context';
import { ProgressChecklist } from './progress-checklist';
import { SKILL_RUN_META } from './run-capsule';
import { CardPrimaryAction } from './card-primitives';

export interface SkillProposalBlockRendererProps {
  block: SkillProposalBlock;
}

const SHELL_CLASS =
  'flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-4';

const CTA: Record<string, string> = {
  explore: 'Pull them →',
  account: 'Read it →',
};

export function SkillProposalBlockRenderer({ block }: SkillProposalBlockRendererProps) {
  const { token, action, label } = block.props;
  const { onComplete } = useInThreadInput();

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (running || done) return;
    setRunning(true);
    setError(null);
    try {
      // Only the token crosses the wire. The args stay on the server.
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        if (reportSession401(res.status)) {
          setError(SESSION_EXPIRED_MESSAGE);
          return;
        }
        reportCredit402(res.status, err);
        setError(err.message ?? err.error ?? 'Something went wrong — try again.');
        return;
      }
      setDone(true);
      void onComplete();
    } catch {
      setError('Something went wrong — try again.');
    } finally {
      setRunning(false);
    }
  }, [token, running, done, onComplete]);

  if (done) {
    return (
      <div
        className="rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-3"
        data-testid="skill-proposal-done"
      >
        <p className="text-body text-foreground-muted">Done — the results are in the thread above.</p>
      </div>
    );
  }

  return (
    <div className={SHELL_CLASS} data-testid="skill-proposal">
      {running ? (
        <div aria-live="polite" aria-atomic="false">
          <ProgressChecklist stages={[]} plan={SKILL_RUN_META[action]?.plan} />
        </div>
      ) : (
        <>
          <p className="text-body font-medium text-foreground-secondary">{label}</p>
          {/* The token is burned on tap, so a failed run does not restore this button — asking
              again is the honest next step, and it is what the error sentence says. */}
          {!error && (
            <CardPrimaryAction onClick={() => void handleConfirm()} className="self-start">
              {CTA[action] ?? 'Run it →'}
            </CardPrimaryAction>
          )}
        </>
      )}
      {error && (
        <p className="text-label" style={{ color: 'var(--color-error)' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

In `src/components/thread/message-blocks.tsx`, add the import beside the `InputRequestBlockRenderer`
one and a render branch for `'skill-proposal'` matching how `'input-request'` is dispatched in that
file.

- [ ] **Step 7: Typecheck, run the thread suites, commit**

```bash
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run src/lib/tools src/lib/threads src/components/thread
git add src/lib/tools/blocks.ts src/lib/tools/block-registry.ts src/lib/threads/chat-prior-turns.ts src/components/thread/skill-proposal-block.tsx src/components/thread/message-blocks.tsx src/lib/tools/__tests__/skill-proposal-block.test.ts
git commit -m "feat(thread): skill-proposal block + renderer"
```

---

## Task 6: The dispatcher gate chain

**Files:**
- Modify: `src/lib/tools/skill-dispatch.ts` (add `SkillTool.proposal`, register `explore` + `account`)
- Modify: `src/lib/tools/chat-agent-loop.ts` (gate chain, per-turn cap, empty-text fallback, guard fix)
- Create: `src/lib/tools/__tests__/chat-agent-governance.test.ts`

**Interfaces:**
- Consumes: `SpendAuthority` (T1), `assessWarmCoverage` (T2), copy (T3), `armProposal` (T4),
  the block schema (T5).
- Produces: `ChatAgentStreamDeps.spendAuthority`, `ChatAgentStreamDeps.armProposal`,
  `ChatAgentStreamInput.onProposal`, `MAX_PROPOSALS_PER_TURN`.

- [ ] **Step 1: Add the `proposal` field and the two registry entries**

In `src/lib/tools/skill-dispatch.ts`, add to `interface SkillTool`:

```ts
  /**
   * AN APIFY-SPENDING SKILL. Present ⇒ the dispatcher PROPOSES it and never runs it inline.
   *
   * This is owner decision 6 ("governance in the dispatcher, not the model") expressed as a type
   * rather than a rule someone has to remember: the loop branches on `proposal` BEFORE it reaches
   * `run`, so a skill carrying this field cannot be executed by any code path that skips the gates.
   * `run` is still what the CONFIRM route calls, after the tap and after both budgets re-check.
   */
  proposal?: {
    /**
     * Apify runs ONE execution fires — sizes the SpendAuthority floor. Explore pulls once;
     * an account read fires TWO (scrapeProfile + scrapeVideos(handle, 30) — pricing.ts:103).
     */
    apifyRuns: number;
    /** Deterministic card copy built FROM THE STORED ARGS. Never model text. */
    label: (args: SkillToolArgs) => string;
  };
```

Then append two entries to `SKILL_TOOLS` (their `run` adapters are called only by the confirm
route — the dispatcher never reaches them):

```ts
  {
    name: "explore",
    skillKey: "explore",
    billable: "explore_scrape",
    proposal: { apifyRuns: 1, label: (args) => proposalLabel("explore", args) },
    schema: {
      type: "function",
      function: {
        name: "explore",
        description:
          "Find real outlier videos in a niche to learn from. Use when the creator asks what is " +
          "working right now, wants examples/outliers, or asks what people are posting about X. " +
          "Pass the niche or competitor as `topic`. Set `fresh` ONLY when they explicitly ask for " +
          "new or fresher material after seeing what you already had.",
        parameters: {
          type: "object",
          properties: {
            topic: { type: "string", description: "The niche or competitor handle to scan." },
            fresh: {
              type: "boolean",
              description:
                "ONLY when the creator explicitly asks for new/fresher data after seeing what you " +
                "already had. Omit otherwise.",
            },
          },
          required: ["topic"],
        },
      },
    },
    run: async (args, ctx) => {
      const r = await runExplorePipeline({
        audience: ctx.audience ?? GENERAL_AUDIENCE,
        mode: "niche",
        normalizedInput: args.topic ?? "",
        serendipity: 0,
        onEvidence: ctx.onEvidence,
      });
      return { blocks: [r.block], warnings: [] };
    },
  },
  {
    name: "account",
    skillKey: "account",
    billable: "account",
    proposal: { apifyRuns: 2, label: (args) => proposalLabel("account", args) },
    primaryArg: "topic",
    schema: {
      type: "function",
      function: {
        name: "account",
        description:
          "Read the creator's OWN account — their latest posts and the patterns in them. Use when " +
          "they ask how they are doing, to look at their last videos, or to read their account. " +
          "It needs nothing typed: their handle is resolved server-side.",
        parameters: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "What they want out of the read, in their own words. Free text.",
            },
          },
          required: ["topic"],
        },
      },
    },
    // Reached only from the confirm route, which resolves the handle from the session.
    run: async () => {
      throw new Error("account runs via /api/chat/confirm, which resolves the handle server-side");
    },
  },
```

Add the imports `proposalLabel` from `@/lib/tools/proposal-copy` and `runExplorePipeline` from
`@/lib/tools/runners/explore-runner`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/tools/__tests__/chat-agent-governance.test.ts`:

```ts
/**
 * chat-agent-governance.test.ts — the gate chain (spec §1).
 *
 * THE ORDERING IS THE DESIGN, so most of these assert what did NOT happen. Warm before any gate
 * (the common path touches no budget); the platform cap before the creator's credits (a cap-out is
 * not their fault and must never render as a paywall); the proposal last (spending is the
 * exception).
 */
import { describe, it, expect, vi } from "vitest";
import { runChatAgentStream, MAX_PROPOSALS_PER_TURN } from "../chat-agent-loop";
import type { SkillTool } from "../skill-dispatch";

/** A stream of one round that calls `explore`, then a round of plain text. */
function scriptedStream(rounds: Array<{ text?: string; call?: { name: string; args: string } }>) {
  let i = 0;
  return async () => {
    const round = rounds[i++] ?? { text: "" };
    const chunks = [];
    if (round.call) {
      chunks.push({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: `c${i}`, function: { name: round.call.name, arguments: round.call.args } },
              ],
            },
          },
        ],
      });
    }
    if (round.text) chunks.push({ choices: [{ delta: { content: round.text } }] });
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  };
}

const exploreTool: SkillTool = {
  name: "explore",
  skillKey: "explore",
  billable: "explore_scrape",
  proposal: { apifyRuns: 1, label: (a) => `Pull fresh outliers for ${a.topic}` },
  schema: {
    type: "function",
    function: {
      name: "explore",
      parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] },
    },
  },
  run: vi.fn(async () => ({ blocks: [{ type: "outlier-grid", props: { tiles: [] } }], warnings: [] })),
};

function baseInput(over: Record<string, unknown> = {}) {
  return {
    ask: "what's working for fitness coaches right now?",
    systemPrompt: "sys",
    context: { platform: "tiktok" as const, profileRow: null },
    onToken: vi.fn(),
    onBlock: vi.fn(),
    ...over,
  };
}

const WARM = { sufficient: true, count: 9, newestPostedAt: "2026-08-04T00:00:00.000Z", examples: [] };
const COLD = { sufficient: false, count: 0, newestPostedAt: null, examples: [] };

describe("gate 1 — warm coverage", () => {
  it("a sufficient corpus NEVER calls SpendAuthority: the common path touches no budget", async () => {
    const check = vi.fn();
    const gate = vi.fn();
    await runChatAgentStream(
      baseInput(),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { text: "Here's what I have." },
        ]),
        warmCoverage: async () => WARM,
        spendAuthority: { check },
        billing: { gate, bill: vi.fn() },
        armProposal: vi.fn(),
      },
    );
    expect(check).not.toHaveBeenCalled();
    expect(gate).not.toHaveBeenCalled();
    expect(exploreTool.run).not.toHaveBeenCalled();
  });

  it("`fresh: true` SKIPS gate 1 so 'pull fresh' cannot loop back to the same warm answer", async () => {
    const check = vi.fn().mockResolvedValue({ funded: true, remainingUsd: 2 });
    const warmCoverage = vi.fn().mockResolvedValue(WARM);
    await runChatAgentStream(
      baseInput(),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches","fresh":true}' } },
          { text: "Setting that up." },
        ]),
        warmCoverage,
        spendAuthority: { check },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal: vi.fn().mockResolvedValue("tok-1"),
      },
    );
    expect(check).toHaveBeenCalledWith(1);
  });
});

describe("gate 2 — platform budget before creator credits", () => {
  it("a CAPPED verdict never reaches the credit gate — a cap-out must not render as a paywall", async () => {
    const gate = vi.fn();
    const onCreditWall = vi.fn();
    await runChatAgentStream(
      baseInput({ onCreditWall }),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { text: "" },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: false, reason: "capped", resetsLabel: "Aug 21" }) },
        billing: { gate, bill: vi.fn() },
        armProposal: vi.fn(),
      },
    );
    expect(gate).not.toHaveBeenCalled();
    expect(onCreditWall).not.toHaveBeenCalled();
  });

  it("passes apifyRuns through, so an account read is priced as TWO runs", async () => {
    const accountTool: SkillTool = {
      ...exploreTool,
      name: "account",
      skillKey: "account",
      billable: "account",
      proposal: { apifyRuns: 2, label: () => "Read your account and pull the patterns" },
      schema: {
        type: "function",
        function: {
          name: "account",
          parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] },
        },
      },
    };
    const check = vi.fn().mockResolvedValue({ funded: true, remainingUsd: 2 });
    await runChatAgentStream(
      baseInput(),
      {
        skills: [accountTool],
        streamComplete: scriptedStream([
          { call: { name: "account", args: '{"topic":"how am I doing"}' } },
          { text: "ok" },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal: vi.fn().mockResolvedValue("tok-1"),
      },
    );
    expect(check).toHaveBeenCalledWith(2);
  });

  it("NEVER runs the skill inline, even when everything is funded", async () => {
    await runChatAgentStream(
      baseInput(),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { text: "Tap to pull them." },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: true, remainingUsd: 2 }) },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal: vi.fn().mockResolvedValue("tok-1"),
      },
    );
    expect(exploreTool.run).not.toHaveBeenCalled();
  });
});

describe("the proposal", () => {
  it("emits ONE skill-proposal block carrying the token and NO args", async () => {
    const onBlock = vi.fn();
    const result = await runChatAgentStream(
      baseInput({ onBlock }),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { text: "Tap to pull them." },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: true, remainingUsd: 2 }) },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal: vi.fn().mockResolvedValue("tok-1"),
      },
    );
    const blocks = onBlock.mock.calls.map((c) => c[0] as { type: string; props: Record<string, unknown> });
    const proposals = blocks.filter((b) => b.type === "skill-proposal");
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.props).toEqual({
      token: "tok-1",
      action: "explore",
      label: "Pull fresh outliers for fitness coaches",
      platform: "tiktok",
    });
    // Persisted too, or the offer vanishes on reload.
    expect(result.uiBlocks).toContainEqual(proposals[0]);
  });

  it("caps at ONE per turn — a second would overwrite the slot and leave a dead button", async () => {
    const onBlock = vi.fn();
    const armProposal = vi.fn().mockResolvedValue("tok-1");
    await runChatAgentStream(
      baseInput({ onBlock }),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { call: { name: "explore", args: '{"topic":"yoga teachers"}' } },
          { text: "Tap the offer above." },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: true, remainingUsd: 2 }) },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal,
      },
    );
    expect(MAX_PROPOSALS_PER_TURN).toBe(1);
    expect(armProposal).toHaveBeenCalledTimes(1);
    expect(onBlock.mock.calls.filter((c) => (c[0] as { type: string }).type === "skill-proposal")).toHaveLength(1);
  });

  it("does NOT consume the paid-run leash — a proposal ran nothing", async () => {
    const result = await runChatAgentStream(
      baseInput(),
      {
        skills: [exploreTool],
        streamComplete: scriptedStream([
          { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          { text: "Tap it." },
        ]),
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: true, remainingUsd: 2 }) },
        billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
        armProposal: vi.fn().mockResolvedValue("tok-1"),
        maxSkillRuns: 2,
      },
    );
    expect(result.skillRuns).toHaveLength(0);
  });
});

describe("the turn never ends with nothing visible", () => {
  const branches = [
    {
      name: "warm answer",
      deps: {
        warmCoverage: async () => WARM,
        spendAuthority: { check: vi.fn() },
      },
      expect: /proven outliers/i,
    },
    {
      name: "cap-out",
      deps: {
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: false, reason: "capped", resetsLabel: "Aug 21" }) },
      },
      expect: /Aug 21/,
    },
    {
      name: "unreadable",
      deps: {
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: false, reason: "unreadable", resetsLabel: null }) },
      },
      expect: /can't pull fresh videos right now/i,
    },
    {
      name: "proposal",
      deps: {
        warmCoverage: async () => COLD,
        spendAuthority: { check: async () => ({ funded: true, remainingUsd: 2 }) },
      },
      expect: /\S/,
    },
  ];

  for (const branch of branches) {
    it(`${branch.name}: streams a deterministic sentence when the model writes nothing`, async () => {
      const onToken = vi.fn();
      const result = await runChatAgentStream(
        baseInput({ onToken }),
        {
          skills: [exploreTool],
          // Every round calls the tool and streams NO text — the shape that used to produce silence.
          streamComplete: scriptedStream([
            { call: { name: "explore", args: '{"topic":"fitness coaches"}' } },
          ]),
          billing: { gate: vi.fn().mockResolvedValue({ allowed: true }), bill: vi.fn() },
          armProposal: vi.fn().mockResolvedValue("tok-1"),
          ...branch.deps,
        },
      );
      const streamed = onToken.mock.calls.map((c) => c[0] as string).join("");
      expect(streamed).toMatch(branch.expect);
      // Persisted, not just streamed — otherwise the sentence dies on reload.
      expect(result.text).toMatch(branch.expect);
    });
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/chat-agent-governance.test.ts`
Expected: FAIL — `MAX_PROPOSALS_PER_TURN` is not exported.

- [ ] **Step 4: Implement the gate chain**

In `src/lib/tools/chat-agent-loop.ts`:

Add near `DEFAULT_MAX_SKILL_RUNS`:

```ts
/**
 * Proposals a single turn may make.
 *
 * NOT A POLICY — a consequence of the storage. `threads.pending_proposal` holds ONE offer, so a
 * second proposal in the same turn would overwrite the first and leave a rendered card in the thread
 * whose token is already dead: a button that costs a tap and returns a 409. Raising this number
 * requires changing the slot first.
 */
export const MAX_PROPOSALS_PER_TURN = 1;
```

Add to `ChatAgentStreamDeps`:

```ts
  /**
   * Gate 2 — the PLATFORM's Apify budget. Absent ⇒ every proposal skill refuses, exactly like an
   * absent `billing` seam: a skill that spends money the platform cannot account for does not run.
   */
  spendAuthority?: SpendAuthority;
  /** Gate 1 — the corpus lookup. Absent ⇒ treated as cold (nothing warm to answer from). */
  warmCoverage?: (niche: string, platform: string) => Promise<WarmCoverage>;
  /** Persist the offer server-side, returning its token. Absent or failing ⇒ no offer this turn. */
  armProposal?: (action: ProposalSkill, args: SkillToolArgs) => Promise<string | null>;
```

Inside the per-call loop, insert the branch **before** the `skill.billable && paidRuns >= maxSkillRuns`
leash check and before the gate:

```ts
      // ── THE GATE CHAIN, for a skill that spends the PLATFORM's Apify budget ──
      // Placed BEFORE `skill.run` is ever reached, which is what makes owner decision 6 structural:
      // the model calls `explore(niche)` and never learns about money, because there is no code path
      // from a tool call to a scrape that does not pass through here.
      if (skill.proposal) {
        const proposalSkill = skill.skillKey as ProposalSkill;
        const niche = (args.topic ?? "").trim();
        const now = new Date();

        // GATE 1 — warm coverage. Skipped only when the creator EXPLICITLY asked for fresh
        // material: without that escape a warm answer would invite "pull fresh", which re-enters
        // this gate, which is still sufficient, forever.
        const warm =
          !args.fresh && deps.warmCoverage
            ? await deps.warmCoverage(niche, input.context.platform)
            : { sufficient: false, count: 0, newestPostedAt: null, examples: [] };

        if (warm.sufficient) {
          governanceFallback = warmAnswerSentence(warm, niche || "that", now);
          toolCalls.push({ name: skill.name, ran: false, note: "warm" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              answered_from: "cache",
              count: warm.count,
              newest_posted_at: warm.newestPostedAt,
              examples: warm.examples.map((e) => ({
                handle: e.handle,
                hook: e.spokenHook,
                template: e.hookTemplate,
                archetype: e.hookArchetype,
                format: e.format,
                views: e.views,
                baseline: e.baselineLabel,
                // NO multiplier — see spec §3.8. rankOutliers' figure moves with resultsPerPage,
                // and a number in the transcript becomes a claim the model asserts in prose.
              })),
              note:
                "these are already-proven examples, no scrape needed. State the count and how old " +
                "the newest is. Do NOT claim you just pulled them.",
            }),
          });
          continue;
        }

        // GATE 2 — the platform's Apify cap. BEFORE the creator's credits, always: a cap-out is not
        // their fault and must never be rendered as a paywall.
        const verdict = deps.spendAuthority
          ? await deps.spendAuthority.check(skill.proposal.apifyRuns)
          : ({ funded: false, reason: "unreadable", resetsLabel: null } as const);

        if (!verdict.funded) {
          const sentence =
            verdict.reason === "capped"
              ? cappedSentence(proposalSkill, verdict, warm, { niche, now })
              : unreadableSentence(proposalSkill);
          governanceFallback = sentence;
          toolCalls.push({ name: skill.name, ran: false, note: verdict.reason });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: "sourcing unavailable",
              tell_the_creator: sentence,
              note:
                "relay that sentence as written. Do NOT offer to try again, do NOT mention credits " +
                "or upgrading, and do NOT invent results.",
            }),
          });
          continue;
        }

        // GATE 3 — the creator's credits, at the same price the skill's own route charges.
        if (!deps.billing) {
          toolCalls.push({ name: skill.name, ran: false, note: "no billing seam" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "this skill cannot be run right now" }),
          });
          continue;
        }
        const admission = await deps.billing.gate(skill.billable!);
        if (!admission.allowed) {
          toolCalls.push({ name: skill.name, ran: false, note: "credit gate refused" });
          if (admission.quota !== undefined) input.onCreditWall?.(admission.quota);
          governanceFallback = admission.reason ?? "You're out of credits for this action.";
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: "not enough credits to run this",
              tell_the_creator: governanceFallback,
              note: "do NOT run or fake the result",
            }),
          });
          continue;
        }

        // GATE 4 — the offer. One per turn, because the slot holds one.
        if (proposalsThisTurn >= MAX_PROPOSALS_PER_TURN) {
          toolCalls.push({ name: skill.name, ran: false, note: "one proposal per turn" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: "an offer is already on screen for this turn",
              note: "ask the creator to tap the offer above before setting up another",
            }),
          });
          continue;
        }

        const token = deps.armProposal ? await deps.armProposal(proposalSkill, args) : null;
        if (!token) {
          toolCalls.push({ name: skill.name, ran: false, note: "arm failed" });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "could not set up that run — tell them to try again shortly" }),
          });
          continue;
        }
        proposalsThisTurn++;
        const proposalBlock = {
          type: "skill-proposal",
          props: {
            token,
            action: proposalSkill,
            // Built from the SERVER-HELD args by the same module that stored them — never model text.
            label: skill.proposal.label(args),
            platform: input.context.platform,
          },
        };
        input.onBlock(proposalBlock);
        uiBlocks.push(proposalBlock);
        governanceFallback = `${skill.proposal.label(args)} — tap to confirm.`;
        toolCalls.push({ name: skill.name, ran: false, note: "proposed" });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            proposed: proposalSkill,
            note:
              "an offer is now on screen. Add ONE short line telling them to tap it. Do NOT describe " +
              "results — nothing has run yet.",
          }),
        });
        continue;
      }
```

Declare the two new locals beside `paidRuns`:

```ts
  let proposalsThisTurn = 0;
  /**
   * The deterministic sentence for whichever governance branch this turn took.
   *
   * A turn that calls a tool and streams no text used to persist NOTHING — `if (text.length > 0)`
   * guards the write — so the creator got their own message and silence, which is worse than an
   * error. This is what gets emitted in that case.
   */
  let governanceFallback: string | null = null;
```

And immediately before the `return`, add the fallback + fix the guard defect:

```ts
  // A turn must never end with nothing visible. Only fires when the model wrote nothing at all.
  const guardedText = guardArtefacts ? guard.flush() : fullText;
  let finalText = guardedText;
  if (finalText.trim().length === 0 && governanceFallback) {
    input.onToken(governanceFallback);
    finalText = governanceFallback;
  }
  return { text: finalText, skillRuns, uiBlocks, toolCalls };
```

> ⚠️ That `guardArtefacts` is a **bug fix**, not a refactor. The line was
> `text: unbound ? guard.flush() : fullText`, while the guard is armed on
> `guardArtefacts = (deps.sealedVisitor ?? false) || unbound`. A sealed visitor who is not `unbound`
> streamed redacted text and persisted the **raw** text — so the redaction held for one turn and the
> leaked line reappeared on reload, then landed in the next turn's transcript as precedent. That is
> verbatim the failure the file's own comment says the guarded return exists to prevent. Latent today
> only because `FREE_SKILL_TOOLS` is empty.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/chat-agent-governance.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Run the full existing loop suite — nothing above may change today's behaviour**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools`
Expected: PASS, unchanged count.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/skill-dispatch.ts src/lib/tools/chat-agent-loop.ts src/lib/tools/__tests__/chat-agent-governance.test.ts
git commit -m "feat(chat): warm-first gate chain — governance in the dispatcher, not the model"
```

---

## Task 7: `POST /api/chat/confirm` — the resume route

**Files:**
- Create: `src/app/api/chat/confirm/route.ts`
- Create: `src/app/api/chat/confirm/__tests__/route.test.ts`
- Modify: `src/app/api/tools/chat/route.ts` (inject `spendAuthority` / `warmCoverage` / `armProposal`)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: the SSE route. No new exported symbols beyond `POST` and `maxDuration`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/chat/confirm/__tests__/route.test.ts`:

```ts
/**
 * confirm/route.test.ts — the tap.
 *
 * The two properties worth locking here are ORDER properties: the claim happens BEFORE the gates
 * (so a double-tap burns the token rather than racing two scrapes past two independent reads), and
 * the token is released ONLY for a credit refusal (the one failure the creator can fix and retry).
 */
import { describe, it, expect } from "vitest";

describe("route module contract", () => {
  it("exports maxDuration = 300 — the scrape needs the budget the chat route does not have", async () => {
    const mod = await import("../route");
    expect((mod as Record<string, unknown>).maxDuration).toBe(300);
  });

  it("exports POST", async () => {
    const mod = await import("../route");
    expect(typeof (mod as Record<string, unknown>).POST).toBe("function");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/app/api/chat/confirm/__tests__/route.test.ts`
Expected: FAIL — cannot resolve `../route`.

- [ ] **Step 3: Write the route**

Create `src/app/api/chat/confirm/route.ts`:

```ts
/**
 * POST /api/chat/confirm — the tap that turns a chat-agent PROPOSAL into a real run.
 *
 * WHY THIS IS ITS OWN ROUTE, and not a branch of /api/tools/chat: `maxDuration = 300`. An Apify
 * scrape genuinely takes minutes and the chat route has no extended budget — which is precisely why
 * every heavy skill in this app already lives behind its own route. The two-turn shape (owner
 * decision 3) is not a UX preference; it is what lets the scrape have five minutes.
 *
 * Body is `{ token }` and nothing else. The thread comes from the session and the args come from the
 * server-held slot, because a client-supplied arg would let a creator scrape anything.
 *
 * ORDER — the claim comes BEFORE the gates, deliberately. A double-tap must burn the token rather
 * than race two scrapes past two independent gate reads.
 *
 *   auth → CSRF → rate-limit → ATOMIC CLAIM → SpendAuthority → creditGate
 *        → run → persist → bill on delivery → resume the turn
 *
 * SSE, reusing the chat route's event vocabulary so the client reuses its stream handling.
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { getOpenThread } from "@/lib/threads/threads";
import { insertMessage, loadMessages } from "@/lib/threads/messages";
import { claimProposal, releaseProposal } from "@/lib/threads/proposals";
import { runHeaderBlock } from "@/lib/tools/run-header";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { apifySpendAuthority } from "@/lib/billing/spend-authority";
import { billUsage, creditGate, quotaRefusalBody, quotaRefusalMessage } from "@/lib/billing/credit-gate";
import { creditCost } from "@/lib/pricing";
import { runExplorePipeline } from "@/lib/tools/runners/explore-runner";
import { generateAccountRead } from "@/lib/account-read/account-read";
import { deadTokenSentence, scrapeFailedSentence, unreadableSentence, cappedSentence } from "@/lib/tools/proposal-copy";
import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";

export const maxDuration = 300;

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const guard = csrfGuard(request);
  if (guard) return guard;
  const limited = await rateLimitGuard(user.id, "explore");
  if (limited) return limited;

  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    /* handled below */
  }
  if (!token) return Response.json({ error: "token is required" }, { status: 400 });

  // The thread is resolved from the SESSION, never the body (CR-01).
  const openThread = await getOpenThread(user.id);
  if (!openThread) return Response.json({ error: "no_open_thread", message: deadTokenSentence() }, { status: 409 });

  // ── THE ATOMIC CLAIM, before any gate ────────────────────────────────────────
  const proposal = await claimProposal(supabase, openThread.id, user.id, token);
  if (!proposal) {
    // Tapped / superseded / expired / not theirs — four cases, one sentence.
    return Response.json({ error: "proposal_not_current", message: deadTokenSentence() }, { status: 409 });
  }

  const skill = SKILL_TOOLS.find((s) => s.skillKey === proposal.action);
  if (!skill?.proposal || !skill.billable) {
    return Response.json({ error: "proposal_not_current", message: deadTokenSentence() }, { status: 409 });
  }

  // ── Re-check the platform budget: minutes can pass between the offer and the tap ──
  const verdict = await apifySpendAuthority().check(skill.proposal.apifyRuns);
  if (!verdict.funded) {
    const message =
      verdict.reason === "capped"
        ? cappedSentence(proposal.action, verdict, { sufficient: false, count: 0, newestPostedAt: null, examples: [] }, { niche: proposal.args.topic, now: new Date() })
        : unreadableSentence(proposal.action);
    // Token stays burned: at the cap the offer is dead for the rest of the cycle anyway.
    return Response.json({ error: "sourcing_unavailable", message }, { status: 409 });
  }

  // ── Re-check the creator's credits ───────────────────────────────────────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user, skill.billable);
  if (refusal) {
    // THE ONE RELEASE. A credit refusal is the single failure the creator can fix and immediately
    // retry (hit wall → upgrade → tap), so the offer comes back. Every other failure stays burned:
    // re-arming on a scrape failure builds a retry loop pointed at a $5/month cap.
    await releaseProposal(supabase, openThread.id, user.id, proposal);
    return Response.json(quotaRefusalBody(creditVerdict, creditCost(skill.billable)), { status: 402 });
  }

  const activeAudience = await resolveThreadAudience(supabase, openThread, user.id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream cancelled */
        }
      };

      try {
        send("dispatch", { skill: proposal.action });

        let blocks: unknown[] = [];
        if (proposal.action === "explore") {
          const r = await runExplorePipeline({
            audience: activeAudience,
            mode: "niche",
            normalizedInput: (proposal.args.topic ?? "").trim(),
            serendipity: 0,
            onEvidence: (evidence) => send("evidence", evidence),
          });
          blocks = [r.block];
        } else {
          const handle = await resolveOwnHandle(supabase, user.id);
          if (!handle) {
            send("error", { message: scrapeFailedSentence("account") });
            return;
          }
          const result = await generateAccountRead(handle, user.id, {
            onStage: (name, status) => send("stage", { name, status }),
          } as never);
          if (!("block" in result) || !result.block) {
            // Reachable ONLY while funded — see the rule in proposal-copy.ts. At the cap this
            // sentence is a lie that costs an hour.
            send("error", { message: scrapeFailedSentence("account") });
            return;
          }
          blocks = [result.block];
        }

        for (const block of blocks) send("block", { block });

        // Persist the cards, then a text row stamped origin:"chat-agent" — the signal
        // openChatPriorTurns uses to replay these as a TOOL RUN rather than a 240-char prose line.
        await insertMessage(
          openThread.id,
          "assistant",
          [runHeaderBlock({ skill: proposal.action, audienceLabel: activeAudience?.name }), ...blocks],
          kcStamp().kcGenVersion,
        );

        // BILL ON DELIVERY. The cards are on screen and nothing after this can un-deliver them —
        // a bookkeeping fault must never discard work the creator can see was done.
        await billUsage({ userId: user.id, action: skill.billable!, tier: creditVerdict.tier });

        // ── The resumed turn ─────────────────────────────────────────────────
        // The replayed `arguments` are the SERVER-STORED ones, so the transcript cannot disagree
        // with what actually ran.
        const closing = await resumeTurn({
          supabase,
          user,
          openThread,
          proposal,
          blocks,
          priorMessages: await loadMessages(openThread.id),
          send,
        });
        if (closing.trim().length > 0) {
          await insertMessage(
            openThread.id,
            "assistant",
            [{ type: "markdown", props: { text: closing, origin: "chat-agent" } }],
            kcStamp().kcGenVersion,
          );
        }
        send("done", {});
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "That run failed" });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
```

Implement the two helpers in the same file:

- `resolveOwnHandle(supabase, userId)` — copy the handle resolution `/api/account-read/route.ts`
  already performs (read it and reuse the same query; do not invent a second resolution path).
- `resumeTurn({...})` — build the transcript described in spec §3.6 and call `runChatAgentStream`
  with `priorTurns` from `openChatPriorTurns(priorMessages)`, `onToken: (d) => send("token", { delta: d })`,
  and the same `billing` / `spendAuthority` / `armProposal` deps the chat route injects. Return the
  streamed text. A resume turn is a turn, so `MAX_PROPOSALS_PER_TURN` applies unchanged and no
  special case is needed to stop a tap-chain.

- [ ] **Step 4: Wire the chat route**

In `src/app/api/tools/chat/route.ts`, inside the `runChatAgentStream` deps object, after `billing:`:

```ts
              // Gate 2 — the PLATFORM's Apify budget, checked before the creator's credits so a
              // cap-out never renders as a paywall.
              spendAuthority: apifySpendAuthority(),
              // Gate 1 — the corpus. A sufficient niche answers free and touches no budget at all.
              warmCoverage: async (niche, plat) => {
                try {
                  const { examples } = await retrieveCachedExamples({ query: niche, platform: plat });
                  return assessWarmCoverage(examples);
                } catch {
                  // Retrieval failure degrades to COLD, never to a fabricated warm answer.
                  return { sufficient: false, count: 0, newestPostedAt: null, examples: [] };
                }
              },
              // Gate 4 — persist the offer server-side. Null ⇒ no offer this turn.
              armProposal: openThread
                ? (action, args) => armProposal(supabase, openThread.id, user.id, action, args)
                : undefined,
```

Add the matching imports.

- [ ] **Step 5: Run the tests**

Run: `node node_modules/vitest/vitest.mjs run src/app/api/chat src/app/api/tools/chat`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/api/chat/confirm src/app/api/tools/chat/route.ts
git commit -m "feat(chat): /api/chat/confirm — claim, re-gate, run, resume the turn"
```

---

## Task 8: Replay the grid as a tool run (superseding the 240-char record)

**Files:**
- Modify: `src/lib/threads/chat-prior-turns.ts` (`CARD_BLOCK_TOOL`, `CARD_LINE`, the walk, per-type line cap)
- Modify: `src/lib/threads/__tests__/chat-prior-turns.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports; `openChatPriorTurns` behaviour changes.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/threads/__tests__/chat-prior-turns.test.ts`:

```ts
describe("outlier-grid — tool run vs prose record", () => {
  const gridBlock = {
    type: "outlier-grid",
    props: {
      tiles: Array.from({ length: 12 }, (_, i) => ({
        caption: `caption ${i}`,
        views: 100_000 + i,
        multiplier: 4 + i,
        baselineLabel: "vs their usual views",
      })),
    },
  };

  it("a grid FOLLOWED BY a chat-agent row replays as a TOOL RUN with every tile", () => {
    const turns = openChatPriorTurns([
      { role: "user", blocks: [{ type: "markdown", props: { text: "what's working?" } }] },
      { role: "assistant", blocks: [gridBlock] },
      {
        role: "assistant",
        blocks: [{ type: "markdown", props: { text: "Pulled 12.", origin: "chat-agent" } }],
      },
    ] as never);

    const last = turns[turns.length - 1]!;
    expect(last.toolRuns).toHaveLength(1);
    expect(last.toolRuns![0]!.name).toBe("explore");
    expect(last.toolRuns![0]!.cards).toBe(12);
    // All twelve, not six — capping a grid at MAX_LINES_PER_RUN reintroduces
    // "the agent cannot see what it pulled" in half measure.
    expect(last.toolRuns![0]!.lines).toHaveLength(12);
    // NO multiplier in the replayed line — spec §3.8.
    expect(last.toolRuns![0]!.lines!.join(" ")).not.toMatch(/×|multiplier/i);
  });

  it("THE DEGRADE TRAP: a grid with NO chat-agent row after it still reaches the model", () => {
    // A pill-run Explore leaves cards and no text row. Claimed by the tool branch and then
    // dropped, it would vanish from context entirely — worse than the prose line it replaced.
    const turns = openChatPriorTurns([
      { role: "user", blocks: [{ type: "markdown", props: { text: "hi" } }] },
      { role: "assistant", blocks: [gridBlock] },
    ] as never);

    const records = turns.flatMap((t) => t.skillRecords ?? []);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatch(/^Explore — pulled 12 outlier video/);
    expect(turns.some((t) => (t.toolRuns ?? []).length > 0)).toBe(false);
  });

  it("degrades the same way when a PLAIN assistant turn (no origin stamp) follows", () => {
    const turns = openChatPriorTurns([
      { role: "assistant", blocks: [gridBlock] },
      { role: "assistant", blocks: [{ type: "markdown", props: { text: "Anything else?" } }] },
    ] as never);
    expect(turns.flatMap((t) => t.skillRecords ?? [])).toHaveLength(1);
    expect(turns.some((t) => (t.toolRuns ?? []).length > 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/threads/__tests__/chat-prior-turns.test.ts`
Expected: FAIL — the grid still becomes a prose record in all three cases.

- [ ] **Step 3: Implement the dual-path walk**

In `src/lib/threads/chat-prior-turns.ts`:

Add `"outlier-grid": "explore"` to `CARD_BLOCK_TOOL`, with this comment:

```ts
  // A confirmed PROPOSAL run: the confirm route persists the grid and then a text row stamped
  // origin:"chat-agent", which is what promotes these cards from a 240-char prose line to the real
  // tool exchange. A PILL-run Explore has no such row after it and degrades to the record below.
  "outlier-grid": "explore",
```

Add its identifying line to `CARD_LINE`. A grid is ONE block holding many tiles, so it contributes
many lines at once:

```ts
  // NO multiplier — the tiles carry rankOutliers' within-set figure, which moves with
  // resultsPerPage (spec §3.8). Putting it here would make the model ASSERT it in prose.
  "outlier-grid": (p) =>
    asArray(p.tiles).map((t) => {
      const caption = str(t.caption) ?? "(no caption)";
      const views = typeof t.views === "number" ? ` — ${t.views.toLocaleString()} views` : "";
      const basis = str(t.baselineLabel) ? ` (${str(t.baselineLabel)})` : "";
      return `${caption.slice(0, 140)}${views}${basis}`;
    }),
```

Change `CARD_LINE`'s value type to `(props) => unknown` returning either a string or a string array,
and in the walk push all returned strings. Raise the cap **per type**:

```ts
/** Per-run caps on the replayed lines — a reference, never a transcript of the whole pack. */
const MAX_LINES_PER_RUN = 6;
/**
 * A grid is the exception: 12 tiles capped at 6 reintroduces the exact defect the replay exists to
 * fix — the agent proving a pull happened and unable to say what is in it.
 */
const MAX_LINES_BY_BLOCK: Record<string, number> = { "outlier-grid": 12 };
```

Then fix the ordering trap. In the block loop, test `CARD_BLOCK_TOOL` **first**, but carry the record
line on the pending run so the flush can degrade:

```ts
      const tool = CARD_BLOCK_TOOL[block.type];
      if (tool && msg.role === "assistant") {
        // … existing accumulation …
        // ⚠️ THE DEGRADE FALLBACK. A pending run is DROPPED when no origin:"chat-agent" text row
        // follows it (`pendingRuns = []`). For a generator that is fine — the loop always writes
        // one. For a grid it is not: a pill-run Explore would vanish from context entirely, which
        // is strictly worse than the prose line it replaced. So the run carries its own record and
        // the flush emits it instead of losing the work.
        const record = SKILL_BLOCK_RECORD[block.type];
        if (record && !current.fallbackRecord) {
          try {
            const line = record(block.props as Record<string, unknown>);
            if (line) current.fallbackRecord = line.slice(0, MAX_RECORD_LENGTH);
          } catch {
            /* a thread predating a field must not take the anchor down */
          }
        }
        continue;
      }
```

Add a `flushPendingRunsAsRecords()` that pushes each dropped run's `fallbackRecord` into
`pendingRecords`, and call it everywhere `pendingRuns = []` currently happens without a `dispatched`
attribution — i.e. in the non-dispatched branch of the markdown case, and in the final flush.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/threads/__tests__/chat-prior-turns.test.ts`
Expected: PASS, all existing tests plus the 3 new ones.

- [ ] **Step 5: Typecheck, run the whole suite, commit**

```bash
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run
git add src/lib/threads/chat-prior-turns.ts src/lib/threads/__tests__/chat-prior-turns.test.ts
git commit -m "feat(threads): replay a confirmed Explore as a tool run, with a degrade fallback"
```

---

## Task 9: One real end-to-end verification

**Files:**
- Create: `scripts/verify-chat-proposal.ts`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: nothing importable — a script.

> Everything above is network-free by construction, which means none of it has seen: whether the
> claim is genuinely atomic under a concurrent double-tap, whether the Apify limits payload still has
> the shape we parse, or whether the resumed turn reads as continuous. Phase 1 shipped four defects
> that only a live run could find. This is that run.

- [ ] **Step 1: Write the script**

Create `scripts/verify-chat-proposal.ts`, modelled on `scripts/verify-apify-first.ts` (same dotenv +
`tsconfig-paths` preamble — a tsx script must live inside the repo or module resolution fails).

It must, in order:

1. `apifySpendAuthority().check(1)` and **refuse to start** unless funded.
2. Arm a proposal on a real test thread via `armProposal`, printing the token.
3. `claimProposal` with that token → assert it returns the args.
4. `claimProposal` **again with the same token** → assert `null`. This is the double-tap, and it is
   the single most important line in the file.
5. `claimProposal` with a **wrong user id** → assert `null`.
6. `releaseProposal` → `claimProposal` → assert it succeeds again (the credit-wall retry path).
7. Run one real `runExplorePipeline` for a niche and print the tile count and the newest `postedAt`.
8. Delete the test thread's `pending_proposal` and report total Apify spend delta.

- [ ] **Step 2: Check the account before spending**

```bash
node node_modules/tsx/dist/cli.mjs -e "require('dotenv').config({path:'.env.local'});fetch('https://api.apify.com/v2/users/me/limits?token='+process.env.APIFY_TOKEN).then(r=>r.json()).then(j=>console.log(j.data.current.monthlyUsageUsd,'/',j.data.limits.maxMonthlyUsageUsd))"
```

Expected: usage well under 5. **If it is at the cap, STOP** — every scrape failure below will read as
"check your handle is public" and you will debug the wrong thing for an hour.

- [ ] **Step 3: Run it (foreground, sandbox OFF — the sandbox drops the Apify network)**

Run: `node node_modules/tsx/dist/cli.mjs scripts/verify-chat-proposal.ts`
Expected: every assertion prints PASS, and the second claim prints `null`.

- [ ] **Step 4: Walk the UI on a PROD build**

```bash
npm run build && npm start
```

Ask the co-pilot for outliers in a niche with no corpus coverage. Confirm: the proposal card renders
(cream button, **no accent**), the tap streams progress, the grid lands, and a closing line follows.
Then reload and confirm the card shows its done state rather than a live button.

> Dev is not good enough for the "a turn never ends with nothing" claim: memory `unhappy-paths-walk`
> records a cleanup-only `useRef` guard that made `failBack()` a silent no-op **in dev only**.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run
git add scripts/verify-chat-proposal.ts
git commit -m "test(scripts): live proposal round-trip + double-tap verification"
```

---

## Self-Review

**Spec coverage.** §2 → Task 1. §1.1 (warm gate, `fresh` escape, `postedAt` widening) → Task 2 + Task 6.
§2.7 copy → Task 3. §3.2/§3.3 storage + claim → Task 4. §3.4 block → Task 5. §3.1 seam + §1 gate chain +
§4.1 cap + §4.2 fallback + §4.3 guard fix → Task 6. §3.5/§3.6 confirm route + resume → Task 7. §3.7 record
supersession + degrade trap → Task 8. §4.5 live verification → Task 9. §2.8 (delete the hand-rolled
headroom check) → Task 1 Step 5.

**Two gaps found and left as deliberate deferrals, not omissions:**

1. **§3.4's `GET /api/threads/open` token exposure has no task.** Without it a superseded scrollback
   card stays tappable and 409s. Task 5's renderer handles that honestly (inline error, no button
   restored), so it is a polish item rather than a correctness hole — but it is *not* built by this
   plan. Add it as a follow-up.
2. **§3.8's Phase 2 dependency is enforced by convention, not by a test.** Tasks 6 and 8 both omit
   `multiplier` and each has an assertion, but nothing stops a third call site adding it later. A
   drift test over the transcript payloads would close this properly.

**Placeholder scan.** Two steps intentionally describe rather than show code: Task 7 Step 3's
`resolveOwnHandle` (it must *reuse* `/api/account-read/route.ts`'s existing resolution — writing a
second one here is exactly the duplicate-writer mistake §2.8 deletes) and Task 9 Step 1 (a numbered
list of assertions, since the script is procedural). Both name the file to copy from. Everything else
carries real code.

**Type consistency.** `SpendVerdict` / `WarmCoverage` / `PendingProposal` / `ProposalSkill` /
`SkillToolArgs` are used with identical shapes across Tasks 1–8. `assessWarmCoverage` returns
`{sufficient, count, newestPostedAt, examples}` in Task 2 and is destructured with those exact names
in Tasks 3, 6 and 7. `armProposal(supabase, threadId, userId, action, args)` in Task 4 matches its
call in Task 7 Step 4. `check(scrapes)` takes a number everywhere.
