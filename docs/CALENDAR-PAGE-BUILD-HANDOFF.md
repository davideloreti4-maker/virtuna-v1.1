# Calendar / Planning Page — Build Handoff (+ full Stanley parity map)

> **Created 2026-07-03** to hand into a FRESH session. The next Surfaces build = a **standalone
> Calendar/Planning page** (`/calendar`) — the milestone's **second real surface** after `/start`.
> Companion SSOTs: `docs/SURFACES-STATUS-AUDIT-2026-07-03.md` (current status), `docs/START-PAGE-BUILD-HANDOFF.md`
> (patterns + gotchas), `docs/THE-CONTRACT.md` (the 4 shared seams). **Design is directional; build lean, verify live.**

---

## 0. TL;DR
Build `/calendar` — a full **month planning workspace** — in Next.js, responsive (mobile-first → `lg:` desktop),
flat-warm charcoal. It's the dedicated page behind the glanceable `/start` month-calendar **widget**. Reuse
`month-calendar.tsx` + `content-pillars.tsx` + the `mock-room` calendar/Pillar models. **All data MOCK for v1**
(honesty spine: predicted-score dots = **Directional forecast**, a reserved ambient slot, **NEVER** a fabricated
live reaction). Add a Calendar nav entry + deep-link from `/start`. Small PR into `milestone/surfaces`, verify
live at both breakpoints. **Do NOT build thread/skills/engine** (The Room's).

## 1. Why this is the pick (from the audit)
The milestone so far is **only `/start`** (audit headline — zero commits touched any other surface). Building a
second real, dedicated surface is the highest-leverage way to make Numen feel like a *product*. Calendar/planning
is **unblocked** (needs no Room atoms), fully in Surfaces scope, and the **#1 net-new gap Stanley validates**
(creators pay $47/mo for ideas + calendar + coach). *(OAuth/Composio ingestion is the strategic alternative but
the owner hasn't provisioned Composio yet → calendar first.)*

## 2. What Stanley's Content Calendar is (the parity target)
Stanley's **Content Calendar** = a full MONTH view, auto-planned (~every 2 days), each idea placed on a day,
tagged to an auto-built content **pillar** (e.g. "Fundamentals / Tactical Playbooks / Behind the Build") + a
strategic angle. It sits beside Stanley's Analytics (7/30/90d + AI recommendations) and Daily Ideas.
**KEEP THE WEDGE:** Stanley is **reactive**; every surface we copy must carry the line Stanley can't say —
**"pre-tested on your audience"** (the predicted-tone slot). Never blur the wedge into fabrication — the forecast
is **Directional + labeled**, never a claimed real reaction.

## 3. The page spec (mobile-first, then `lg:` desktop)
Route `src/app/(app)/calendar/page.tsx` — auth-gated, inside `(app)` so it inherits AppShell (sidebar + toast).
- **Hero = the month grid** (7-col weeks). Reuse the render from `month-calendar.tsx` (extract a shared
  `<MonthGrid>` if cleaner — the `/start` widget and this page should render the **same** grid, different chrome).
  Each day cell: planned post(s) (title + pillar tag + Directional tone-dot) or an empty "add" affordance.
- **Day detail:** tap a day → (mobile) a bottom sheet · (desktop) a right-side panel with that day's planned
  post(s), the Directional tone + a **Make-for-this-day** CTA (seed composer / Seam-4 launch). Empty day →
  "Add an idea" → seed composer scoped to the day (+ optional pillar).
- **Pillar rail:** reuse `content-pillars.tsx` (distribution + gap nudge) as a side/section — the month's pillar
  balance + "you're neglecting X."
- **Header:** month name + prev/next-month nav + the "N planned this month" density line (already in the widget).
- Optional (v2): a mobile agenda/list toggle.

## 4. Data + persistence
- **v1 = MOCK.** Reuse `mock-room.ts` calendar model (`month/today/days[]` w/ planned|empty + predicted tone +
  pillar) + `Pillar`. Extend the fixture to a fuller month if needed.
- **Real persistence = a FOLLOW-UP PR** — a `planned_posts` table keyed to the user + a repo, mirroring the
  `account_snapshots`/`competitor_snapshots` patterns. Keep **PR-1 = the surface on mock/local state** so it stays
  small; note the follow-up clearly.
- Stanley's "auto-plan every 2 days" (generative fill) = a **later engine/generation graft**, not v1. v1 is the
  planning SURFACE; auto-generation comes when the generation seam is ready.

## 5. Honesty spine (non-negotiable)
- Predicted-score/tone dots = **Directional forecast**, labeled as such, a **reserved ambient slot** (stub against
  `CardReaction`/the contract; graft the real Read when The Room ships). NEVER a fabricated live audience reaction
  on a real planned post.
- No fabricated analytics. Empty = honest "add an idea," never a fake plan.

## 6. Reuse map + wiring (don't rebuild)
- `src/components/surfaces/sections/month-calendar.tsx` — the `/start` widget; share its grid.
- `src/components/surfaces/sections/content-pillars.tsx` + `Pillar` (`src/lib/room-contract/mock-room.ts`).
- `src/components/sidebar/Sidebar.tsx` — **ADD a Calendar nav entry** (Surfaces owns the nav; edit freely).
- **Deep-link:** `/start` month-calendar widget → tap/expand routes to `/calendar` (day tap → `/calendar?day=N`).
- Composer / Seam-4: a day's "Make" → seed the embedded composer / launch a thread (as `/start` does).
- Design system: `src/app/globals.css` `@theme` + `docs/DESIGN-SYSTEM.md` (flat-warm charcoal, accent near-zero,
  the one Directional tone-dot treatment; matte, 6% borders, 12px cards). ⚠️ `BRAND-BIBLE.md`/`docs/tokens.md` STALE.

## 7. Full Stanley parity map (the "everything about Stanley" ask)
| Stanley surface | Ours today | Status / next |
|---|---|---|
| Dashboard command-center | `/start` | ✅ built (responsive; stat-row/Views/first-run REAL, rest mock) |
| **Content Calendar** (month · pillars · angle) | `/start` month-calendar **widget** | ⏳ **THIS BUILD → standalone `/calendar` page** |
| Daily Ideas (4/day → full carousel) | `daily-ideas.tsx` `/start` section (mock) | ideas surface exists; content-gen = engine/graft |
| Analytics (7/30/90d + AI recs w/ action) | `stat-row.tsx` `/start` L7D (real) | ❌ no full analytics PAGE (30/90d + recommend-with-action) — future |
| Top Performers (outliers + Remix) | `/feed` + outliers (real) | ✅ have it |
| Remix "Make it yours" | thread/skills (The Room) | Room territory |
| **Help with my business** (monetization coach) | — | ❌ MISSING (Stanley-adopt **P1**; ties to commerce/whop notes) — future surface |
| Momentum scores (gamification) | `/start` rings (mock) | cosmetic; wire later |
| Referrals (20% recurring) | `/referrals` (real) | ✅ have it |
| Customize (brand/tone/Notion) | audience/settings (partial) | partial; revisit |
| Carousel generator (Canva-lite) | — | ❌ missing (**P2**, high lift) — future |
| Native iOS app | — | future |

**Net after this calendar page, the remaining Stanley-parity gaps = (a) business-coach surface, (b) a full
analytics page (30/90d + recommendation-with-action-button), (c) carousel/asset export.** Wedge on ALL of them:
**"pre-tested on your audience."**

## 8. Setup + gotchas
- `cd ~/virtuna-surfaces`. **First ensure PR #114 is merged** (it carries the real Views tile + the audit doc +
  this handoff), then `git pull` on `milestone/surfaces`. `git config core.hooksPath .githooks`; `npm install`;
  copy `.env.local` from a sibling worktree.
- Dev (768MB OOMs; the npx wrapper breaks dev):
  `PORT=3400 NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack`
- Test user: `e2e-test@virtuna.local` / `e2e-test-password-2026`. Verify via Playwright a11y snapshot +
  `browser_evaluate` on rendered text (remote MCP screenshots don't persist). Supabase MCP = `qyxvxleheckijapurisj`.
- Small PR into `milestone/surfaces`; tsc + eslint clean on touched files (pre-existing `__tests__` TS errors =
  untouched debt). ⚠️ **auto-wip daemon** — if a push is rejected, **fetch + MERGE, never force-push/reset**.
- KNOWN INFRA (not code): `milestone/surfaces` Vercel PREVIEW deploys fail on a serverless-function-memory limit
  (safe to merge PRs over it; fix before `milestone/surfaces` → `main`).

## 9. Don'ts
- Don't build the **thread / skills / engine** (The Room's, `~/virtuna-the-room`).
- Don't **fabricate** predicted reactions/analytics — Directional + labeled, or omit (honesty spine).
- Don't **rebuild** the audience-lens/composer atoms — stub against the contract; graft when The Room ships (their
  Task B was reverted → atoms not landed; don't stub further, wait for them to flag each).
- Don't skip **desktop** — mobile-first, but ship the responsive `lg:` layout + verify both breakpoints.
- Don't over-ceremony — lean, small PR, verify live.
