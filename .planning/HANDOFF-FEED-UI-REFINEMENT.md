# HANDOFF — Discover Feed UI refinement + Hooks segment

> For a FRESH session. Goal: refine the Videos + Channels pages toward the Sandcastles
> reference (**especially Channels**) and add a new **Hooks** segment. All reference
> screenshots are saved in `.planning/references/sandcastles/` — open them with the Read tool.
> Worktree `~/virtuna-discover-feed`, branch `milestone/discover-feed`. Author: 2026-06-29.

---

## 0. Start here (fresh session)

```
cd ~/virtuna-discover-feed            # branch milestone/discover-feed
```
1. Read this file end-to-end, then OPEN every image in `.planning/references/sandcastles/`
   with the Read tool (they are the design target — pixel-level detail matters).
2. Read the memory `discover-feed-milestone.md` (state) + `.planning/DISCOVER-FEED-PLAN.md` (spec).
3. The feed is **already built + functional** (cover-forward cards, filters, infinite scroll,
   Videos|Channels segmented nav). This handoff is about **visual/UX refinement + a new Hooks view**.
4. **DO NOT** run multi-agent Workflows / `/code-review` without explicit user OK on the scale
   (the user pushed back hard on token burn). Build inline. Verify with one browser pass + gates.
5. Three work items below: **A. Videos refine · B. Channels refine (priority) · C. Hooks (new)**.
   Confirm the open decisions in §6 with the user before a big filters/Hooks-backend build.

---

## 1. Current state (SHIPPED on `milestone/discover-feed`, PR #89 OPEN, not merged)

Commits (newest first): `201a0a02` (Sandcastles-grade v2) · `81280118` (cover-forward v1) ·
`675af263` (feed page P2.2) · `2ab04d35` (GET /api/feed) · `d890e51a` (Channels page) ·
`bc2fa604` (channel ingest). **PR #89** = whole milestone: https://github.com/davideloreti4-maker/virtuna-v1.1/pull/89
**Squash-merge is PENDING USER GO-AHEAD** (migrations already live → merge = prod release via Vercel; do NOT auto-merge).

### Run + verify
- **Dev:** `PORT=3200 NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3200`
  (use the `node ./node_modules/...` binary form — an `npx next` wrapper in this env turns `dev` into a one-shot build. 768 heap OOMs.)
  ⚠️ `next build` CLOBBERS a live dev's `.next` → kill+restart dev after any build.
- **Auth (browser verify):** Playwright → `/login` → `input[name=email]`=`e2e-test@virtuna.local`,
  `input[name=password]`=`e2e-test-password-2026`, `button[type=submit]` → lands `/dashboard`.
  Ensure user via `npx tsx e2e/create-test-user.ts`. Session expires on dev restart → re-login.
  e2e user has Zach King tracked → Watched tab is populated (7 tiles).
- **Gates:** `npx tsc --noEmit` (baseline **2 pre-existing TEST errors** = hooks-runner.test.ts:209
  + script/__tests__/route.test.ts — NOT yours) · `npx eslint <files>` · matte guard
  `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts`
  (use the `node ./node_modules/vitest/...` form — `npm test` prints fake PASS(0)) ·
  `NODE_OPTIONS='--max-old-space-size=4096' npx next build`.
- **Supabase:** single shared prod DB, project ref `qyxvxleheckijapurisj` (MCP `execute_sql` to confirm rows).
- **Daemon:** only committer in this worktree; `.githooks` post-commit AUTO-PUSHES every commit.

### What exists today (component map — what you'll edit)
| File | Role |
|---|---|
| `src/app/(app)/feed/page.tsx` + `feed-client.tsx` | Videos view: server gate → client orchestrator (tab/sort/filter state, Remix/Track/Save wiring, infinite query) |
| `src/app/(app)/feed/loading.tsx` | route skeleton |
| `src/components/feed/feed-view-tabs.tsx` | **[Videos | Channels] segmented nav** — ADD a "Hooks" tab here for §C |
| `src/components/feed/feed-toolbar.tsx` | tabs(Watched/Trending) + Sort menu + Add-video-URL popover + Customize-channels link + Export |
| `src/components/feed/feed-filters.tsx` | filter sidebar — currently **chips** (Any/2×/…); §A wants min–max ranges |
| `src/components/feed/feed-card.tsx` | the 9:16 cover card (cover + platform badge + hover action bar + title + handle/time + 3 metric pills) |
| `src/components/feed/feed-results.tsx` | grid + skeleton + empty/error states + IntersectionObserver infinite scroll |
| `src/app/(app)/feed/channels/page.tsx` + `channels-client.tsx` | Channels view (AddChannelPanel + WatchlistPanel, 1.7fr/1fr split) |
| `src/components/channels/add-channel-panel.tsx` | Tabs: Suggested(category cards) / Describe(stub) / Search / Add URL |
| `src/components/channels/watchlist-panel.tsx` | watchlist rail (rows + bottom Remove-all/Export) |
| `src/components/channels/platform-avatar.tsx` | shared Avatar + platform badge |
| `src/components/channels/suggested-channels.ts` (lib) | static suggested seed — categories Comedy/Beauty/Food/Creators, NO counts |
| `src/lib/feed/feed-query.ts` | `queryFeed` + `FeedTile` (has `platform`, `multiplier`, `views`, `likes/comments/shares`, `coverUrl`, `source`, `trackHandle`…) |
| `src/app/api/feed/route.ts` | GET /api/feed — zod query: tab/sort/cursor/channels/q/minViews/minOutlier/minEngagement/postedWithinDays/platform. **NO max params, NO status.** |
| `src/hooks/queries/use-feed.ts` | `useFeed` (infinite) + `useTrackAccount` + `buildFeedQuery` |
| `src/hooks/queries/use-channels.ts` | watchlist / search / add(ingest+track) / untrack |
| `src/lib/tools/chain-handoff.ts` | CHAIN_HANDOFFS — `discover→remix` endpoint = the Remix→Read moat action |

---

## 2. References (the Sandcastles target — OPEN THESE)

| Image | File | Shows |
|---|---|---|
| Videos feed | `.planning/references/sandcastles/videos-feed.jpeg` | toolbar, filters panel, 9:16 grid, metric pills |
| Channels · Suggested | `.planning/references/sandcastles/channels-suggested.jpeg` | strategy categories, 2-col cards w/ counts, watchlist rail |
| Channels · Describe | `.planning/references/sandcastles/channels-describe.png` | textarea + Platform + Account-size + Search |
| Channels · Search | `.planning/references/sandcastles/channels-search.png` | search card + Platform + Account-size dropdowns |
| Channels · Add URL | `.planning/references/sandcastles/channels-add-url.png` | bulk textarea ("…separated by newline or comma") + Parse |
| Hooks vault | `.planning/references/sandcastles/hooks-vault.jpeg` | NEW segment — row list of hook templates |

> NOTE on fidelity: Sandcastles is the *layout/quality* target, but **keep our brand** —
> flat-warm charcoal + terracotta, NOT Sandcastles' blue/colored chrome. And keep OUR moat verbs
> (tile action = **Remix → Read**, not Sandcastles' "Analyze"). Adopt structure, not their palette.

---

## 3. WORK ITEM A — Videos feed refinement (`videos-feed.jpeg`)

Current vs target gaps:
1. **Filters → min–max ranges** (biggest gap). Sandcastles: Outlier score `0x–100x`, Views `0–10,000,000`,
   Engagement `0%–100%` (paired inputs); "Posted in last" `[N]` + unit dropdown (Days/Weeks/Months); **Platform**
   dropdown; **Status** checkboxes (Analyzed / Unanalyzed); **Save filter** button; a **Channels** dropdown (multi).
   - ⚠️ Needs API work: `GET /api/feed` + `feed-query.ts` currently support only `min*`. Add `maxViews/maxOutlier/
     maxEngagement`, a `postedWithinUnit`, and (if Status is real) an `analyzed` flag. "Analyzed" = whether a
     scraped_video has a derived Read/idea — **we don't track that yet** (it's the Phase-3 analyze pipeline). So
     Status is likely a STUB for now (render the checkboxes, no-op or hide) — CONFIRM with user (§6).
   - Keep the sidebar matte; inputs use the existing `Input`/`Select` primitives.
2. **Toolbar**: Sandcastles shows "Customize channels / Add video URL / Bulk Analyze" (left) and
   "Showing 100 of 33164 / Filters / Sort by / Export" (right), with **Filters as a toggle** (active = filled).
   - We can show "Showing N of {total}" (we already return `total`). "Bulk Analyze" = not our concept (skip or
     map to nothing). Make Filters a real toggle that show/hides the sidebar (nice on mobile).
3. **Metric pills**: Sandcastles TINTS all three (outlier green/red, views blue, engagement orange). We currently
   tint only the outlier (green▲/red▼) and keep views/engagement neutral matte. DECISION (§6): adopt subtle
   tints for views/engagement too, or stay restrained. (Lean: keep neutral — our system is restrained — but ask.)
4. **Platform badge**: Sandcastles uses brand-colored badges (IG gradient, TikTok black). Ours is a matte dark
   circle + white logo. DECISION (§6): brand-colored vs matte. (Lean: brand-colored is more legible/expected.)
5. **Grid density**: Sandcastles is a clean 4-up. Ours is `minmax(200px)` (~3–4-up). Fine; tune to 4-up at lg.
6. Tile is solid already (9:16, hover bar Remix/Watch/Save/Track, title + @handle + relative time).

## 4. WORK ITEM B — Channels refinement (PRIORITY — user said "especially the channels page")

Each tab should be a consistent **big input card** on the left + the watchlist rail on the right.
Per `channels-*.png`:

- **Suggested** (`channels-suggested.jpeg`): categories are **creator-strategy** themed ("SOCIAL MEDIA GROWTH
  STRATEGIES", "VIRAL CONTENT CREATION TACTICS", "AI TOOLS FOR CREATORS") — NOT our Comedy/Beauty/Food. Rework
  `suggested-channels.ts`: new categories + **per-channel follower/view counts** (cards show "196K followers · 30M
  views"). Cards are larger, 2-col, avatar + platform badge + name + counts; **click-the-card to add** (Sandcastles
  has no explicit Add button — the whole card is the affordance; show an "Added ✓" state). Our seed currently has
  NO counts → either add static counts to the seed, or fetch lazily. CONFIRM data source (§6).
- **Describe** (`channels-describe.png`): a textarea "Describe the content you're looking for…" + a row with
  **Platform** dropdown + **Account size** dropdown + **Search ⏎** button; empty state "Describe the type of content
  you're looking for and press Enter to get results". Currently an honest STUB — build the UI; backend can stay
  stubbed (note it) until there's a describe→suggest service.
- **Search** (`channels-search.png`): big "Search by channel handle or name…" card + **Platform** + **Account size**
  dropdowns; empty "Start typing a channel handle or name to search". We already have corpus search
  (`/api/channels/search`) — wrap it in this layout; the Platform/Account-size filters can be client-side (or stub).
- **Add URL** (`channels-add-url.png`): a **bulk textarea** "Paste full channel URLs separated by newline or comma…"
  + **Parse ⏎** button (currently single-input). Parse → split on newline/comma → ingest+track each (reuse
  `useAddChannel` in a loop; show per-URL progress/result). 
- **Watchlist rail**: already close (rows = avatar+badge + name + "followers · views", bottom Remove-all/Export).
  Polish spacing/scroll to match; the rail should be a distinct elevated panel.
- General: the Channels page reads a bit plain now — tighten the input-card styling, section headers, card padding,
  hover states; make it feel as crafted as the reference.

## 5. WORK ITEM C — Hooks segment (NEW — `hooks-vault.jpeg`)

A new third view in the Feed surface. Add **"Hooks"** to `feed-view-tabs.tsx` → `/feed/hooks`.

Layout (per ref):
- Header: "Hooks" / "Manage your vault of viral hooks".
- Toolbar: "Search by hook or channel" (big input, left) · "Create from video" (film icon) · right: "Showing format"
  **toggle** · "Sort by" · "Export".
- Sections: "HOOKS FROM YOUR ANALYZED VIDEOS · N" and "DEFAULT HOOKS · N" (rename "Sandcastles" → "Numen"/"Default").
- Each hook = a **ROW** (full-width card): left small video thumbnail · center the hook TEMPLATE with `[bracketed]`
  placeholders + "Inspired by @handle" (muted) · right: **category pill** (Question / Personal Experience / Secret
  Reveal Breakdown / Authority / Contrarian / List — purple-tinted) + **outlier pill** (green▲/red▼ "5.3x") + **views
  pill** (eye) + a **heart** (favorite/save).
- "Showing format" toggle = template-with-brackets ⇄ filled example.

Backend reality (IMPORTANT): a real Hooks vault needs hook templates with category + inspired-by + outlier/views.
- "DEFAULT HOOKS" → a **curated static seed** (`src/lib/hooks/default-hooks.ts`: template, category, inspiredBy,
  multiplier, views, thumbnailUrl). Buildable now.
- "HOOKS FROM YOUR ANALYZED VIDEOS" → needs the **analyze pipeline** (extract a hook template from a scraped/analyzed
  video). This is **Phase 3** territory (the plan deferred "Hooks vault — need analyzed-video pipeline"). For v1,
  ship the seed + an empty/"analyze a video to add hooks" state; wire the analyzed source later.
- We DO already have an in-thread Hooks skill (`/api/tools/hooks`, hook card renderer) + `chain-handoff` hooks→script.
  The vault is a NEW persistent surface, not the in-thread generator — but reuse hook category vocab if one exists.
- CONFIRM scope with user (§6): seed-only Hooks v1 now, or wait for the analyze pipeline?

## 6. OPEN DECISIONS — ask the user before the big builds
1. **Filters rebuild** (Videos): min–max ranges + Platform + Status + Save-filter requires API changes
   (`max*` params, `analyzed` flag). OK to add them? Is **Status/Analyzed** real or a stub for now?
2. **Metric pills**: adopt Sandcastles' tints (views=blue, engagement=orange) or keep restrained neutral?
3. **Platform badge**: brand-colored (IG gradient/TikTok black) or matte dark circle?
4. **Suggested seed**: add static follower/view counts + creator-strategy categories — OK to hand-curate? Source?
5. **Hooks v1**: seed-only (curated default hooks) now, with "analyzed videos" as an empty state until the
   Phase-3 analyze pipeline — agreed? Rename "Sandcastles default hooks" → what ("Default"/"Numen")?
6. **"Bulk Analyze" / "Analyze"**: Sandcastles' verb is Analyze; OUR moat verb is **Remix → Read**. Keep ours
   (don't introduce Analyze) unless the user wants an Analyze action too.

## 7. House rules (do not violate)
- **Flat-warm charcoal**: bg `#262624`, cream text `#ece7de` (never `#fff` for chrome; white-on-photo scrims are OK),
  accent **terracotta `#d97757`** (NEVER coral `#FF7F50`, never glass/backdrop-filter). 6% borders (hover 10%),
  12px card radius, Inter chrome. SSOT = `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`. Keep the matte guard green.
- The ONE accent per surface rule: the tile's action token is the accent; data/pills are neutral or semantic
  (success/error tokens exist: `text-success`/`text-error`/`bg-success/10`).
- Server components by default; `"use client"` only when interactive. Files < 500 lines.
- Reuse primitives: `Input`, `Select` (`src/components/ui/select.tsx`), `DropdownMenu`, `Tabs`, `Popover`, `Avatar`,
  `PlatformAvatar`, `SaveAffordance` (has `iconOnly`), `formatCount`/`formatRelativeTime` (`competitors-utils`).
- Commit `type(phase): desc`; gates before commit; PR #89 auto-updates on push (one cohesive PR for the milestone).
- Verify visually: take screenshots, open them with Read — don't say "should work".

## 8. Verified-good baseline (don't regress)
The current cards already render correctly live: Watched = 9:16 covers + TikTok badge + green▲ outlier / views /
engagement pills + relative time + hover action bar (Remix/Watch/Save/Track). Trending = cover-less film-icon
fallback + metric scrim. Channels = segmented nav + category cards + watchlist rail. 28 unit tests green
(feed-query 5, use-feed 7, channels suites, matte 16). Keep these working.
