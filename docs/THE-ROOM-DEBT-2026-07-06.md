# The Room / Surfaces — Debt Inventory & Pillars Plan (2026-07-06)

Grounded survey of the `~/virtuna-the-room` worktree after the outcome-loop optional
backlog was cleared. Companion to `docs/HANDOFF-2026-07-06-outcome-loop.md` (the loop
architecture) and memory `the-room-phase3-built.md` (per-fact history).

## Session context — what just shipped (all merged to `main`)

| PR | Commit | What |
|----|--------|------|
| #182 | `d460d329` | Per-receipt real numbers + post links in the loop (embed `outcome_signatures`) |
| #184 | `6bfa9623` | Mount `RecalibrationNudge` on /start + honest disposition/direction-aware copy |
| #186 | `33e72a2d` | Retire dead `getMockStartPage` receipts/accuracy/stats + orphaned types |
| #188 | (merged) | Delete dead legacy `mock-data.ts` (zero importers) |

`/start` now carries **zero fabricated numbers** except the designated chrome (greeting,
rings, quickActions). **UPDATE 2026-07-06: `MOCK_PILLARS` is now RETIRED — content pillars
shipped real end-to-end (see the Content Pillars section below). /start's only remaining
fabricated data is the designated chrome.**

## Worktree health (as surveyed 2026-07-06)

- **tsc:** 1 error — pre-existing `src/lib/tools/runners/__tests__/script-runner.test.ts`
  (`noUncheckedIndexedAccess` on `mock.calls[0]`). Baseline; not from this work.
- **Open PRs:** 0. No stranded branches; all session work merged.
- **Seam 3 dock:** already grafted to real audiences (`AudiencePresence variant='surface'`
  fed `resolveUserAudience`) — no longer a stub.

## Debt inventory (ranked by type)

| # | Item | Type | Verdict |
|---|------|------|---------|
| 1 | ~~`mock-data.ts`~~ | dead code | ✅ deleted (#188) |
| 2 | ~~`MOCK_PILLARS`~~ (SSOT for /start · /calendar · /grow) | live mock → **real feature** | ✅ **SHIPPED** (#193 persist · #196 cluster · #197 SSOT+swap · #199 confirm card) — `MOCK_PILLARS` retired; see Pillars Plan below (now historical) |
| 3 | greeting text · rings (streak / planned / prediction-accuracy) · quickActions | fabricated **chrome** | owner-designated keep (voice-moment + engagement chrome) |
| 4 | `mock-grow.ts` (/grow strategy dashboard) | intentional mock | owner-picked shape — leave until /grow gets a real backend |
| 5 | 9 "coming soon" stubs (hook auto-extract, niche compare, describe-a-channel, layout/theme toasts) | **honest** stubs | fine — ship with their phase; not fabricated data |
| 6 | Per-card attribution | **product decision** | flips owner-approved "attribution is audience-scoped v1" — do NOT change unprompted |
| 7 | IG support in the loop | **externally blocked** | no clockworks IG single-post actor; Composio blocked on TikTok/IG business verification |
| 8 | `society-store` / `mock-societies.ts` | old feature, still wired | consumed by `create-society-modal.tsx` + `society-selector.tsx` — not clearly dead; leave |

### Notes on the deferred items

- **Per-card attribution (#6).** Today pins are rank-1 + audience-keyed, so reconciliation
  matches *the audience's latest un-realized prediction*, not a specific post. Copy is
  deliberately audience-level ("how your people reacted"). Moving to per-post matching means
  threading a stable content id through pin → capture → `outcome_signatures` → reconcile, and
  it **changes what the copy is allowed to claim**. It is an owner-approved v1 decision — treat
  a change as a product call, not a cleanup.
- **IG (#7).** The account-metrics rig is producer-agnostic (table + `buildAccountStats` +
  render stay); only the cron/capture producer swaps. Revisit when an IG actor is wired or
  Composio clears verification.

---

## The Content Pillars feature — what it is & how to make it real

> ✅ **SHIPPED 2026-07-06 (this plan is now historical).** Built exactly as planned below, on
> Apify/clockworks (no OAuth/Composio): `account_posts` persists the captions the cron already
> scraped (#193) → `cluster.ts` LLM-names 3–6 frozen pillars + assigns (#196) → `buildContentPillars`
> SSOT feeds /start · /calendar · /grow with real share/count/cadence/gap + engagement-rate tone
> (#197) → propose→confirm `PillarConfirmCard` (#199). `MOCK_PILLARS` retired. Tone baseline = mean
> engagement rate vs the creator's own posts, `loved`/`bounced` on ±25% deviation. See memory
> `content-pillars-real.md`. Only deferred: merge-two-pillars-into-one.

### What a "pillar" is

A **content pillar** is one of the creator's recurring themes — the handful of buckets their
posts fall into (e.g. "Honest confessionals", "Money & cost", "Challenges", "Myth-busting").
It's the vocabulary a creator (and a good coach) uses to talk about *what* they make, above the
level of any single post. Stanley (the competitor teardown) leans on this: "a calendar that
knows your pillars, not just your dates."

### The `Pillar` shape (`src/lib/room-contract/mock-room.ts`)

```ts
interface Pillar {
  id: string;
  name: string;    // "Honest confessionals"
  share: number;   // 0..1 — this pillar's share of the month's plan (drives the bar + %)
  count: number;   // posts this month in this pillar
  tone: Tone;      // DIRECTIONAL forecast of how the audience tends to respond ("loved"/"neutral"/…)
  cadence: string; // "posted 2 days ago" | "none in 3 weeks"
  gap?: boolean;   // under-served → surface a proactive "you're neglecting this" nudge
}
```

### Where it renders (one SSOT, three surfaces)

- **`/start` right rail** (`ContentPillars`): tone dot · name · optional `gap` badge · share
  bar + % · footer nudge ("none in 3 weeks in Myth-busting — tap to make one" / "Balanced across
  your pillars") with a `· Directional` honesty label. Tapping seeds the composer to *Make* an
  idea for that pillar.
- **`/calendar`** pillar rail (same component).
- **`/grow`** numbers tab (`AnalyticsView`).

All three read `MOCK_PILLARS` — so a real derivation must feed the **one SSOT**, and all three
update together.

### Current honesty posture (from `content-pillars.tsx`)

The component is explicit that today's data is mock: the **share bar renders MOCK fixtures**
("real per-pillar derivation from the account's posts is a reserved slot — NOT yet wired"), and
the **tone dot is a Directional forecast** (a reserved ambient slot, never a fabricated live
reaction). So the UI is honest-by-label; the debt is that the *numbers themselves* are invented.

### Why it isn't a quick cleanup

There is **no clean source** of the creator's real posted-content themes with cadence:
- `account_snapshots` = follower/view **counts only** — no per-post topics.
- `analysis_results` = videos they **tested**, not their real content mix (share/cadence would
  mislead).
- the ideas cache (`surface_reactions`) = **generated** ideas, not posted content.

Deriving real pillars therefore requires a small pipeline, not a field swap.

### Proposed build (a fresh-session feature, ~1 vertical)

1. **Source the creator's own posts.** Extend the account scrape from counts to **content-level**
   (recent posts' captions/titles + posted-at + basic metrics). The account-metrics cron is the
   natural host. This is the gating dependency — confirm the scrape actor exposes per-post
   captions (clockworks/Apify TikTok profile scrape typically does).
2. **Cluster → named themes.** One LLM pass over the caption corpus → 3–6 named pillars with a
   membership assignment per post (Flash is fine; deterministic prompt, low cost). Owner-curated
   overrides optional later.
3. **Compute the fields.** `share` = each pillar's fraction of recent posts; `count` = posts this
   month; `cadence` = time since the pillar's most-recent post; `gap` = under a threshold. `tone`
   stays a Directional forecast (or is derived from that pillar's tested reactions if available).
4. **Persist + wire the SSOT.** New table (or reuse the `surface_reactions` cache pattern:
   own-rows RLS, lazy daily re-warm). Replace `MOCK_PILLARS` at its single source so /start,
   /calendar, and /grow all switch together.
5. **Honest empty state.** Below N posts → "gathering your pillars" (mirror the stat-row empty
   pattern), never invented buckets.

**Open decisions for the owner before building:**
- Is the own-account content scrape in scope here, or does it wait on the same
  OAuth/Composio ingestion that gates IG? (If the profile scrape already returns captions, this
  is unblocked today for TikTok.)
- Keep `tone` as a Directional forecast, or derive it from real tested reactions when a pillar
  has tested videos?
- LLM-named pillars vs. owner-declared pillars (or a hybrid: propose → confirm, like the
  recalibration nudge)?

### Verify plan (when built)

Unit-test the derivation (share/cadence/gap math + empty state) pure; seed a real caption set for
the e2e user, browser-verify all three surfaces show the derived pillars, then remove the seed
(same rig used to verify #182/#184).
