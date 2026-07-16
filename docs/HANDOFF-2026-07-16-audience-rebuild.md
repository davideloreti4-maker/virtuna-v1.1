# HANDOFF — Audience rebuild (2026-07-16)

**Branch: `feat/audience-rebuild`** (off origin/main, worktree `~/virtuna-prod`, dev server :3000).
**P1 (list) SHIPPED — `5782351c`.** This doc is the SSOT for P2–P4.
**Sketch (approved direction): `.planning/sketches/audience-rebuild.html`** — open it in a browser
first. Live screenshots from P1 verification sit next to it.

## The concept (LOCKED with owner, this session)

- **Thread = the action page. /audience = the manager.** It manages the two things a user owns:
  - **ACCOUNTS** — connected social accounts (scrape-based, no OAuth; `connected_accounts` table,
    multiple allowed, one `is_primary`). Each account *manifests as its synced audience* on the
    list. One connection → one canonical audience.
  - **SIMULATED** — audiences built from a handle you don't own or from a description.
- **Presets are dead as rows** — they become templates inside the create flow's "Describe it" door.
- **General is dead as a row** — it's the fallback, not a managed object. When nothing is pinned,
  one fact-line: "New threads use General. View".
- **The ambient audience card owns the composer/thread side** (brain · personas · population).
  Do NOT add a composer audience chip — it was deliberately retired (`composer-controls.tsx:500`).
- **No brain at rest**: the detail page shows WHO is in the room (population + personas + source).
  The brain only means something while content hits the room (ambient card during a Read).

## Design language for these surfaces (the anti-slop rules, owner-enforced)

The owner rejected two drafts before this locked. The failures, in order: (1) accent flood +
tag soup + bordered boxes; (2) **narrated UI** — explainer subtitles, question-form copy,
self-aware microcopy ("labeled honestly", "you'll see everything we grab"). The bar is
"what a billion-dollar company would ship":

- **Facts only, no narration.** Row metas like "Primary · Synced 2h ago", "From description ·
  2 threads". No sentence explains what a section is.
- **Accent budget: ONE element per screen** (the primary account's liveness dot). Everything
  else neutral cream. Error color only for genuinely destructive/error.
- **Tone-zones, not boxes**: `rounded-2xl bg-white/[0.02] p-3.5` zone panels, no border; cards
  inside carry `border-white/[0.06] bg-surface` + `.elev-lift`.
- **Mono microcopy** for group labels (`ACCOUNTS` / `SIMULATED` / `SOURCE`) — the system's
  deliberate idiom. Big tabular-nums figures with mono small-caps unit labels.
- **No serif voice-moments on manager chrome.** Serif stays greeting/hero only.
- Honesty contract survives restyles: provenance in plain words on every row ("Read from @x",
  "A description you wrote", "Nothing yet" — the ONLY state that earns color). Locked by
  `src/components/audience/__tests__/honesty-render.test.tsx`.

## Verified engine/data facts (explored this session — trust these)

- **The double-score is REAL**: `src/app/api/tools/read/route.ts:157` pairs
  `[activeAudience, GENERAL_AUDIENCE]`; `src/lib/engine/flash/two-audience-read.ts:301` runs a
  full LLM pass per audience. Nothing pinned → collapses to ONE General pass.
  `mode:'general'` audiences are never paired (MODE-01 filter).
- **General/presets are virtual constants** in `src/lib/audience/audience-repo.ts` (no DB rows);
  NULL `threads.active_audience_id` IS General.
- **Connect is profile-only scrape; calibration RE-scrapes everything** via Apify and ignores
  stored `account_posts`/`account_snapshots`. Two disconnected pipelines — P4 unifies them.
- **Audience calibration is TikTok-only** (`platform_unsupported` otherwise); IG/YT connect =
  analytics only. The UI says "Analytics only", never hides it.
- `audiences.source_account_id` → `connected_accounts` is many-to-one, `ON DELETE SET NULL`.
- Crons: `refresh-account-snapshots` (daily, profile+posts+pillars), `audience-drift` (weekly).

## P1 — DONE (`5782351c`)

`audience-index.tsx` rewritten (grouped zones), `audience-manager.tsx` (subtitle gone, Compare
→ ghost text button, accounts wired), `AccountOption` + `last_synced_at`, tests updated.
🔴 **Live-caught bug worth remembering**: the connect deep-link leaves an EMPTY audience shell
carrying `source_account_id`, and it shadowed the real calibrated audience — the account row
said "Nothing yet" while Zach King sat in Simulated. `audienceForAccount()` now prefers the
calibrated candidate (most personas). A fixture could not have seen this.

**Deliberately kept until P2:** the "Audiences / Your account" tabs — killing the tab before
analytics has its new home would orphan the surface.

## P2 — DONE (2026-07-16, session 2)

Shipped per sketch §3; live-verified on :3001 as the E2E user (28/28 checks, 0 console
errors — screenshots in `.planning/sketches/p2-live/`). What landed:
- `audience-detail.tsx` + `population-field.tsx` replace `audience-workspace.tsx` (deleted —
  mix sliders die with it). `[id]/page.tsx` is now a SERVER component that assembles all facts
  (audience, account, SOURCE data, pinned-thread count, default) — client only acts.
- SOURCE zone renders REAL post tiles (caption + views from `account_posts` — the table holds
  NO thumbnails; TikTok cover URLs are ephemeral and deliberately unpersisted), honest
  per-platform figures via `buildRangeMetrics`, and real pillar bars.
- Tab is dead: `?tab=account` (and /analytics, /grow) server-redirect → the account's audience
  detail; `/audience/[id]` canonicalizes an ACCOUNT id → its audience's URL, and renders an
  account-only variant (Analytics only · SOURCE · Sync/Danger) for audience-less accounts.
  `AnalyticsView` + `lib/analytics/recommendations` deleted.
- Personas list uses the recurring-cast naming SSOT (`resolvePersonaName` — label wins, else
  Maya/Dev/…): the manager now calls people what the room calls them. Receipts (signature
  evidence) kept, asymmetry locked in tests. Persona editing reachable (Edit per row → dialog).
- Re-calibrate = CalibrationFlow in a dialog with `audienceId` (updates the row in place);
  TikTok-only. Danger for synced = disconnect semantics (audience + account both removed).
- `audienceForAccount` moved to `audience-display.ts` (shared client/server) + inverse
  `accountForAudience`.
- ⚠️ :3000 was serving ANOTHER worktree (`~/virtuna-explore-c`) — this session verified on a
  fresh detached server at **:3001** instead. Check `lsof -a -p <pid> -d cwd` before trusting
  a port.

Original spec (for reference). `/audience/[id]` for a synced audience:
- Header: `@handle` + mono meta `TIKTOK · PRIMARY · SYNCED 2H AGO` + the liveness dot.
- **Population hero** (tone-zone): reuse/adapt `src/components/audience-lens/PopulationSwarm.tsx`;
  dots clustered by persona (spatial clusters, not a fading grid), caption
  `1,000 VIEWERS · 10 PERSONAS` + `GENERATED FROM ACCOUNT DATA` (provenance, mono).
- **Personas list**: name, description, share% + archetype small right column. Custom per-creator
  personas (sim-v2 Stage 1) flow through `getPersonaRoster` already.
- **SOURCE zone** — proof-of-scrape AND provenance: video thumbnails (from `account_posts`),
  figures (followers/likes/posts from `account_snapshots`), pillar bars (`content_pillars`).
  This is where AnalyticsView's content moves. Owner cares hard about this ("show we actually
  grabbed the videos and stats").
- Sidebar: Usage (New threads Default / Pinned N threads) · Sync (Daily / last / Re-calibrate)
  · Danger (Delete audience; for synced = disconnect semantics).
- Kill the "Your account" tab + `?tab=account` (redirect → primary synced audience detail or
  /audience). Check the `/analytics` + `/grow` redirects that land on `?tab=account`.
- Described/simulated audience variant: no SOURCE zone; description + `custom_context` instead.
- Mix sliders die. Persona EDITING (persona-edit-form) — keep reachable (owner hasn't killed it).

## P3 — Single-audience Read

Owner push-back CONFIRMED: score only the selected audience. General scores only when nothing
is pinned. "Compare" stays as the explicit list-page action (route already accepts
`audienceIds: [a, b]` — keep that path intact).
- Change the default pairing at `read/route.ts:157` (drop the forced GENERAL second side).
- **ENGINE_VERSION bump** or the cache replays old two-audience reads.
- Block shape: `multi-audience-read` block + `MultiAudienceReadBlockRenderer` — single-read
  rendering, delta/"wins for X bombs for Y" only in explicit compares.
- 🔴 Five touchpoints (schema → runner → route SSE emit → parse → toBlocks) — the route's SSE
  emit is the one everybody forgets.
- **Orphaned pin decision (owner asked, I recommended, owner accepted "what do you think")**:
  disconnected/deleted audience → thread falls back to General, NEVER silently — next Read
  shows one quiet line "Audience removed · scoring against General."

## P4 — Create flow + unified scrape (LAST — waits for sim-v2 merge)

`calibration.ts` is also being rewritten on `feat/audience-sim-v2` (ANOTHER SESSION'S worktree
`~/virtuna-audience-sim-v2` — do not touch that branch). Sequence P4 after it merges.
- Three doors: Connect account / From a handle / From a description (templates: Growth ·
  Conversion). One-line descriptions, no narration. Name auto-derived; goal/intent optional
  post-create.
- **One scrape**: connect grabs profile + videos once; calibration + the reveal consume stored
  data instead of re-scraping.
- Reveal state: handle + figures (videos/followers/likes/pillars) + thumbnails + "Building
  audience" with the liveness dot. Error state: "Account not found. Check the handle — private
  accounts can't be read." (inline, quiet).
- Auto-create the synced audience on connect.

## Verification protocol (what worked this session)

- Dev server: detached via `os.fork()+setsid` python snippet (see memory dev-server-launch),
  2GB heap, log in scratchpad. It DIES sometimes — check `lsof -iTCP:3000 -sTCP:LISTEN`.
- Live pass: Playwright `chromium.launch({channel:'chrome'})` (headless-shell not installed),
  login `e2e-test@virtuna.local` / `e2e-test-password-2026` (from `e2e/create-test-user.ts`),
  screenshot with `animations:'disabled'`. The E2E user has @zachking TikTok+IG connected.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (npm test prints fake results).
- tsc: `npx tsc --noEmit` — was 0 at P1 commit.
