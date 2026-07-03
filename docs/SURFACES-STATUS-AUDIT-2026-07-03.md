# Surfaces Milestone — Status Audit (2026-07-03)

> **Read-only audit.** Worktree `~/virtuna-surfaces`. Git state at audit time: checked-out branch
> `feat/start-page-views-tile` @ `0d65f40b`, which is **2 commits ahead of `milestone/surfaces`**
> (@ `436f1c35`) — `f09fcd1a` (Views-tile feature) + `0d65f40b` (docs). That is PR #114
> ("real Views tile"), **still open / unmerged into `milestone/surfaces`** as of this audit.
> Everything below is evaluated against this HEAD (i.e. includes the Views tile).
> SSOTs read first (not re-derived): `docs/START-PAGE-BUILD-HANDOFF.md`, `docs/THE-CONTRACT.md`,
> `docs/SURFACES-HANDOFF.md`. Every claim below is grounded in a repo file path; anything I could
> not confirm from code is marked **UNVERIFIED**.

---

## 1. Surface coverage

Status legend: **REAL** (wired to live DB/backend) · **STUBBED-on-mock** (real shell, fake data)
· **DEFERRED** (explicit wire-or-remove gate) · **GATED-on-Room** (blocked on the sister
milestone's atoms) · **MISSING** (no surface exists).

### Routes — `src/app/(app)/*`

| Route | Status | Evidence |
|---|---|---|
| `/start` | **Mixed** — real shell + first-run + stat-row; rest stubbed (see §2) | `src/app/(app)/start/page.tsx`, `src/components/surfaces/start-page.tsx` |
| `/home` | REAL, pre-existing, **untouched this milestone** (thread/composer; The Room's) | `src/app/(app)/home/page.tsx` → `HomePageLayout`; zero diff vs `main` (confirmed, see §3) |
| `/audience`, `/audience/new`, `/audience/[id]` | REAL, pre-existing, untouched this milestone | `src/app/(app)/audience/page.tsx` → `AudienceManager` |
| `/library` (+ `/saved` redirect) | REAL, pre-existing, untouched; explicitly **flat** (no Collections) | `src/app/(app)/library/page.tsx` → `SavedShelf`; `src/components/saved/saved-shelf.tsx:7-9` "FLAT by construction... NO folders, NO tags, NO collection grouping" |
| `/feed` (+ `/feed/hooks`, `/feed/channels`) | REAL, pre-existing, untouched; no ambient layer (see §1 Sandcastles row) | `src/app/(app)/feed/page.tsx` → `feed-client.tsx` |
| `/competitors` (+ `/[handle]`, `/compare`) | REAL, pre-existing, untouched | `src/app/(app)/competitors/page.tsx` (direct Supabase queries) |
| `/referrals` | REAL, pre-existing, untouched | `src/app/(app)/referrals/page.tsx` |
| `/settings` | REAL, pre-existing, untouched | `src/app/(app)/settings/page.tsx` |
| `/discover` | REAL — deep-link redirect shim → `/feed` | `src/app/(app)/discover/page.tsx` (full file is the redirect) |
| `/saved` | REAL — deep-link redirect shim → `/library` | `src/app/(app)/saved/page.tsx` (full file is the redirect) |
| `/analyze`, `/analyze/[id]` | GATED-on-Room — owned by The Room, "~70% placeholder" per handoff, untouched this milestone | `src/app/(app)/analyze/[id]/result-card.tsx`; `docs/SURFACES-HANDOFF.md:52` "Not ours (The Room's)" |

### Start-page sections — `src/components/surfaces/sections/*`

| Section | Status | Evidence |
|---|---|---|
| Top chrome (streak/planned/accuracy rings) | STUBBED-on-mock | `top-chrome.tsx` renders `RingStat[]`; values come from `mock-room.ts:434-437` (hardcoded 71%/43%/84%) |
| Greeting | STUBBED-on-mock — **hardcoded name, not the logged-in user** | `greeting.tsx`; text sourced from `mock-room.ts:430-432` (`"Good afternoon, Davide 👋"`) |
| Stat row | **REAL** | `stat-row.tsx` + `src/lib/account-metrics/account-metrics.ts` + `account-metrics-repo.ts`; server fetch in `start/page.tsx:61-72` |
| Daily ideas | STUBBED-on-mock | `daily-ideas.tsx` ← `mock-room.ts` `MOCK_IDEAS` (3 fixed fixtures) |
| Outliers to remix | STUBBED-on-mock (the "View all" nav to `/feed` is real routing) | `outliers.tsx` ← `mock-room.ts` `MOCK_OUTLIERS`; `start-page.tsx:159` `router.push("/feed")` |
| Month calendar | STUBBED-on-mock | `month-calendar.tsx` ← `mock-room.ts:407-411` `CALENDAR_DOTS` |
| Content pillars | STUBBED-on-mock — **docstring claims real, wiring is mock** (see note) | `content-pillars.tsx:8-9` says "the SHARE bar is real (derived from the account's posts)"; actual wiring is `start-page.tsx:167` `<ContentPillars pillars={data.pillars} .../>` where `data = getMockStartPage()` (`start-page.tsx:49`) |
| Today's plan | STUBBED-on-mock | `todays-plan.tsx` ← `mock-room.ts` `plan: [...]` (2 fixed rows) |
| Quick actions | STUBBED-on-mock data, but verb-routing (Make/Test/Ask) logic is real | `quick-actions.tsx` ← `mock-room.ts` `quickActions: [...]`; handler wires into the real `Verb` state (`start-page.tsx:97-100`) |
| The loop (receipts + accuracy) | **DEFERRED** — explicit wire-or-remove gate, owner call 2026-07-03g | `the-loop.tsx:7-17` docstring; write-path hook exists but is unwired (see §4) |
| Ambient/surface dock | GATED-on-Room (stub) | `surface-dock.tsx:4-14` "⚠️ STUB... swap stub → real at the graft" |
| Embedded composer | GATED-on-Room (stub) | `embedded-composer.tsx:4-13` "⚠️ STUB" |
| Room drawer (card → Read drill) | GATED-on-Room (stub) | `room-drawer.tsx:4-13` "⚠️ STUB" |
| First-run / connect | **REAL** | `first-run.tsx` + real detection in `start/page.tsx:47-59`, real CTA routes to `/audience/new` (`start-page.tsx:132`) |

### Stanley-adoption targets

| Target | Coverage | Evidence |
|---|---|---|
| Proactive daily-ideas home | **Partial** — shell/UX complete, content is mock | `daily-ideas.tsx` + `idea-card.tsx` are production-shaped; the 3 ideas rendered are fixed fixtures (`mock-room.ts:225-306`), no generation job wired |
| Content-calendar-with-auto-pillars | **Partial** — UI exists for both, "auto" derivation doesn't | `month-calendar.tsx`, `content-pillars.tsx`; no pillar-derivation code found anywhere outside `mock-room.ts` (searched `src/lib` for pillar logic — only hit is the mock module) |
| Business coach | **Missing** | No dedicated coach surface/mode found; only unrelated persona-voice prompt copy ("You are a TikTok growth coach...") in `src/lib/ai/prompts.ts:188` — not a feature |

### Sandcastles targets

| Target | Coverage | Evidence |
|---|---|---|
| Living Feed | **Partial** — feed mechanics real, "living" (ambient-audience) layer absent | `/feed` (Watched/Trending/outliers) is real and pre-existing; zero `room-contract`/`CardReaction` references anywhere under `src/app/(app)/feed/**` (grep-confirmed) |
| Collections | **Missing by explicit design choice**, not an oversight | `src/components/saved/saved-shelf.tsx:7-9` docstring states flat-by-construction, no grouping |

---

## 2. Real-vs-mock data (start-page sections)

| Section | Real source | Mock-room fixture (if stubbed) |
|---|---|---|
| Stat row | `account_snapshots` table (migration `supabase/migrations/20260703120000_account_snapshots.sql`, `..._recent_views.sql`) via `getAccountSnapshots` → `buildAccountStats` (`src/lib/account-metrics/account-metrics.ts:117-174`) | — (real; `StatCard` type still lives in `mock-room.ts` as a shared shape, not as data) |
| First-run detection | `listAudiences(supabase)` + `!is_general && signature != null` check, `start/page.tsx:50-56` | — (real) |
| Greeting | — | `mock-room.ts:429-432` (`greeting`) |
| Rings | — | `mock-room.ts:433-437` (`rings`) |
| Daily ideas | — | `mock-room.ts:225-306` (`ideaFixtures` → `MOCK_IDEAS`) |
| Outliers | — | `mock-room.ts:310-403` (`outlierFixtures` → `MOCK_OUTLIERS`) |
| Calendar | — | `mock-room.ts:407-411, 446` (`CALENDAR_DOTS`) |
| Pillars | — | `mock-room.ts:447-452` (`pillars` array in `getMockStartPage`) |
| Today's plan | — | `mock-room.ts:453-455` (`plan`) |
| Quick actions | — | `mock-room.ts:457-462` (`quickActions`) |
| The loop | — | `mock-room.ts:463-470` (`receipts`, `accuracy`) |
| Active audience / dock | — | `mock-room.ts:193-221` (`MOCK_AUDIENCES`), consumed at `start-page.tsx:52,58` |
| Card reactions / Read | — | `mock-room.ts:161-187` (`build()`) generates both `CardReaction` + `Read` per fixture |

---

## 3. Polish / UX / responsive

**Only `/start` was built and verified this milestone. No dedicated cross-surface polish/UX pass has happened.**

- **Diff footprint is exactly `/start` + its plumbing.** `git diff --stat main...HEAD -- src/`
  touches 32 files, all under `src/app/(app)/start/`, `src/app/api/audiences/calibrate/route.ts`
  (+21 lines, capture-at-calibration), `src/app/api/cron/refresh-account-snapshots/` (new),
  `src/app/globals.css` (+31 lines, keyframes only), `src/components/sidebar/Sidebar.tsx`
  (+12 lines, nav entry), `src/components/surfaces/**`, `src/lib/account-metrics/**`,
  `src/lib/room-contract/**`. **Zero files touched** under `feed/`, `library/`, `audience/`,
  `competitors/`, `referrals/`, `settings/`, `discover/`, `saved/`, `home/`, `analyze/`
  (confirmed via `git log --oneline main.. -- <those paths>` → empty).
- **Design-system compliance (current flat-warm charcoal) confirmed by direct read**, not just
  by convention: every surfaces file uses token classes (`border-border`, `bg-surface-elevated`,
  `text-foreground`/`-secondary`/`-muted`, `--color-action`) matching `docs/DESIGN-SYSTEM.md`.
  Accent-dosage rule (LOCKED, "liveness-only") is followed exactly: `src/components/surfaces/tone.ts`
  maps `bounced → var(--color-accent)` (the one sanctioned "room reacting" use), `loved → sage
  #8ea68a`, `neutral → muted cream` — never accent-as-decoration.
- **Responsive:** `lg:` breakpoints are present in code — `start-page.tsx` (5 uses),
  `daily-ideas.tsx`, `outliers.tsx`, `stat-row.tsx` — implementing the mobile-first + desktop
  3-column layout the handoff specifies. Untracked, gitignored screenshots at the repo root
  (`start-mobile-full.png`, `start-m1.jpeg` — excluded via `.gitignore:74` `/*.png`) are evidence
  a **mobile** live-verification pass happened; the audit subagent found no desktop screenshot artifact. **Orchestrator correction (2026-07-03):** desktop responsive WAS live-verified this session via Playwright browser_evaluate at **1280x900** (stat-row computed grid-template-columns = **5 columns**, 5 tiles incl. the real Views tile) and **390x844** mobile (**2 columns**, no horizontal overflow); the #105 shell was verified at 1440. So the start-page / stat-row responsive layout is **VERIFIED** at both breakpoints, not merely self-reported. Remaining gap: no automated component/e2e test locks it in.
- **No component/e2e tests for the start-page UI.** Searched for `*start*` test files under
  `src/**/__tests__/` and `*.test.*` — none exist. The only automated test coverage in this
  milestone's diff is `src/lib/account-metrics/__tests__/account-metrics.test.ts` — pure-function
  unit tests, 13 cases (counted directly via grep, matches the handoff's claimed "13/13").
- **Minor type-safety debt:** `account_snapshots` is not yet in the generated
  `database.types.ts`, so `src/lib/account-metrics/account-metrics-repo.ts:9-11,39-40` casts the
  query builder through an `UntypedClient` escape hatch. Contained, but a follow-up (regenerate
  types) would close it.
- Stray local verification artifacts (`start-mobile-full.png`, `start-m1.jpeg`,
  `screenshot-dashboard.png`, `screenshots/*`) sit at the repo root but are gitignored
  (`.gitignore:70-74`) — not a repo-hygiene issue, just debris from live-verify passes.

---

## 4. Blocked-on-The-Room graft list

The Room's Task B (living-presence rebuild) was **reverted** — the real atoms below are not
landed. Nothing here should be stubbed further; wait for The Room to flag each, then swap.

| Atom | Stub file (this repo) | Real target (per contract) | Swap notes |
|---|---|---|---|
| Surface dock | `src/components/surfaces/surface-dock.tsx` | `AudiencePresence variant='surface'` (`src/components/audience-lens/audience-presence.tsx`, Room-side) | Sign-off delta: `variant='surface'` is **read-only** (no ask input) unless the surface hosts a composer — `THE-CONTRACT.md` §3 Seam 3 |
| User-level active audience | `MOCK_AUDIENCES` in `mock-room.ts:193-221`, consumed at `start-page.tsx:52,58` | `resolveUserAudience` (Room-side sibling to `resolve-thread-audience.ts`) | `THE-CONTRACT.md` §6.2 — resolved in principle, not yet built by The Room |
| Embedded composer | `src/components/surfaces/embedded-composer.tsx` | `Composer mode='embedded'` (Room's `composer.tsx`) | **Known stub drift, already flagged**: stub `onLaunch(input, verb)` (`start-page.tsx:78`) vs real signature `onLaunch(input, verb, audience)` — `THE-CONTRACT.md` §3 Seam 4 note |
| Card reactions + Read drill | `src/components/surfaces/card-reaction.tsx`, `src/components/surfaces/room-drawer.tsx`, all `Read`/`CardReaction` fixtures in `mock-room.ts` | Room's shared card component + real Read/Reaction payload (sim-generated) | One-for-one shape swap — types already match `THE-CONTRACT.md` §3 Seams 1–2 |
| Feed / Library passive echoes | **Not started** (no stub exists) — `src/app/(app)/feed/**`, `src/components/saved/**` carry zero `room-contract` references | Per-item "for your people" verdict, contingent on the sim having run on that item | This is a **build**, not a swap — explicitly gated in the handoff ("do NOT fabricate reactions on real feed/library content") |
| The loop | `src/components/surfaces/sections/the-loop.tsx` | Engine read-shape for predicted-vs-actual delta + accuracy % (not yet exposed) | Write path is real and separable — see §6 item 1 |

---

## 5. OAuth / Composio ingestion reshaping

Per the owner decision captured in memory `oauth-profile-ingestion` (2026-07-03): own-profile
metrics move from Apify scrape → OAuth (Composio confirms full TikTok + Instagram toolkits).
Cross-checked against the actual ingestion code in this worktree:

| Aspect | Detail | Evidence |
|---|---|---|
| **Swap points (localized)** | Two call-sites only: the daily cron's `scraper.scrapeProfile()` / `scraper.scrapeVideos()` calls, and the calibration route's scrape-reveal capture | `src/app/api/cron/refresh-account-snapshots/route.ts:66,74`; `src/app/api/audiences/calibrate/route.ts:180-185` (the new capture-at-calibration block) |
| **Stays unchanged** | `account_snapshots` table + RLS (own-rows), `buildAccountStats`/`sumRecentViews` pure functions, `StatRow`/`StatRowEmpty`, the `/start` server-fetch render path | `supabase/migrations/20260703120000_account_snapshots.sql` (own-rows RLS confirmed at the policy definition), `src/lib/account-metrics/account-metrics.ts` |
| **Stays on Apify** | Competitor/public-account scraping — separate table (`competitor_snapshots`, referenced in the migration's header comment), separate cron (`refresh-competitors`) | `vercel.json` cron list — `refresh-competitors` (06:00 UTC) vs `refresh-account-snapshots` (07:00 UTC) are distinct entries |
| **Gets richer/more honest** | IG Graph exposes real account-level views/reach/impressions/profile-views; today's `recent_views` is an honest but narrower **per-post sum** (`sumRecentViews`, `account-metrics.ts:52-63`) that becomes the fallback | Current code has NO account-level Views concept — `account-metrics.ts:5-16` docstring explicitly says "There is NO account-level 'Views' counter on a TikTok profile" |
| **Account-type gating to verify** | IG insights require a Professional (business/creator) account linked to a FB Page; TikTok deeper analytics may need a Business account/scopes | Not yet reflected in code — no account-type check exists anywhere in `src/lib/account-metrics/**` or the cron/calibrate routes today (they assume plain scrape access) — **this gate still needs building**, not just verifying |
| **Fallback requirement** | Keep the Apify scrape path alive for non-OAuth-connected accounts | Today IS the scrape path (100% of current ingestion) — becomes the fallback branch once OAuth lands |

Net: the account-metrics rig is genuinely producer-agnostic (`AccountSnapshot`/`buildAccountStats`
take plain data, no Apify-specific types leak past the two call-sites above), so this is a
contained swap, not a rebuild — consistent with the memory note.

---

## 6. Recommended next-tranche sequence

Unblocked-first, per the handoff's own ordering plus what this audit found still open:

1. **Land PR #114 first** — the Views tile is fully built (`f09fcd1a`) but sits 2 commits ahead of
   `milestone/surfaces` on `feat/start-page-views-tile`, unmerged. Zero-risk, smallest gap to close.
2. **Loop write-path (capture half)** — wire `src/hooks/queries/use-outcome-signature.ts` (confirmed
   **zero importers** anywhere in `src/` via grep — only a comment mention in `the-loop.tsx:9`) to a
   real paste-URL affordance. Note: `src/lib/flywheel/*` itself is NOT dead code — it already has
   other engine-side importers (`src/app/api/account-read/route.ts`, `src/app/api/flywheel/proposals/route.ts`,
   `src/app/api/cron/audience-drift/route.ts`, `src/lib/tools/runners/predicted-pin.ts`) — those are
   unrelated confidence-gate/recalibration consumers, not this surface's write path. The read side
   (receipts/accuracy numbers) stays mocked until the engine exposes the delta read-shape (§4).
3. **OAuth/Composio ingestion slice** — swap the two call-sites in §5, behind an account-type gate,
   Apify path retained as fallback.
4. **Mobile/onboarding + cross-surface polish sweep** — the biggest visible gap if the product is
   judged as "one thing": 9 of 11 routes (`feed`, `library`, `audience`, `competitors`, `referrals`,
   `settings`, `discover`, `saved`, `home`) have had **zero commits this milestone** (§3). First-run
   is already design-grade per the handoff; the rest never got a flat-warm-charcoal/ambient-language
   consistency pass under this milestone.
5. **Graft tranche** — only once The Room flags each atom in §4 as landed; swap, don't rebuild.
6. **Flag before merge to `main`:** the pre-existing Vercel **preview** deploy failure on a
   serverless-function-memory limit, reported in `docs/START-PAGE-BUILD-HANDOFF.md:211` as
   "identical on disjoint PRs → project/plan-level." I did not independently reproduce this (no
   Vercel deployment inspection performed — out of this audit's scope); `vercel.json`'s `functions`
   block currently only configures memory/duration for `src/app/api/analyze/route.ts` (3008MB/300s) —
   no entry exists for `refresh-account-snapshots` or any other route, so if the limit is
   plan/project-level it is still unaddressed in-repo. **UNVERIFIED** root cause; treat as a
   go/no-go gate before `milestone/surfaces` → `main`, not a solved item.
