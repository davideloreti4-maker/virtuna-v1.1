# UI/UX Audit — Calendar · Discover · Audience · Library

**Date:** 2026-07-13
**Method:** Live review, authed as the e2e user (`e2e-test@virtuna.local` — calibrated "Fitness Creators" audience, `test` audience, 9 library items, mock July calendar), dev server on `:3002`, viewport 1440×900, ambient animations disabled for capture.
**Scope:** Read-only audit. **No code changed.** Evidence screenshots in `./screenshots/`.
**Regenerate evidence:** `npx tsx e2e/create-test-user.ts` → log in at `/login` → drive Playwright with `animations:'disabled'`, `caret:'hide'`.

> Routing note: `/discover` is a **redirect to `/feed`** (`DiscoverHub`). The real Discover surface is `/feed`. `/saved` → `/library`.

---

## Verdict

These four surfaces are **functionally real** — real data, real components, honest empty states. The gap to a "billion-dollar" product is **not features, it's restraint and craft**. Three habits make them read as AI-produced:

1. **The app narrates itself.** Every surface has a tagline subtitle, every card has a "Why —" line, every control has an instructional caption. A confident product shows; it doesn't explain.
2. **Copy repeats.** The same reassurance ("pre-tested on your people", "trend builds daily", "real numbers, over time") is stamped 3–4× per screen. Repetition reads as filler, not confidence.
3. **Taxonomy leaks into the UI.** Internal vocabulary (rooms/audiences/personas/panels; Validated/Calibrated/Baseline/Directional/Template) is surfaced raw, so the user has to learn the model instead of using the tool.

Fixing these is mostly **subtraction** — the cheapest, highest-leverage design work available. Below: cross-cutting issues first (they recur on every page), then per-page detail, then confirmed bugs and a prioritized roadmap.

---

## Cross-cutting issues (these recur on all four pages)

### X1 · Subtitle / tagline bloat  — **the thing to kill first**
Every page header carries a marketing subtitle that adds no operational information. They are the loudest "AI-produced" tell.

| Page | H1 | Subtitle (delete or demote) | Source |
|---|---|---|---|
| Calendar | Calendar | `1 planned · 3 tested ideas waiting · pre-tested on your people` | `components/calendar/calendar-workspace.tsx:261` |
| Discover | Discover | `outliers, trends, and rivals — remix any winner into a Read` | `components/discover/discover-hub.tsx:54` |
| Audience | Your audiences | `Who's in the room when you run a Read.` | `components/audience/audience-manager.tsx` |
| Audience · Account | Your audiences | `Your real numbers, over time — the ground truth behind your people.` | `components/audience/audience-manager.tsx` |
| Library | Library | `Everything you've made — Reads, ideas, hooks, scripts, outliers — ready to pull back into a thread.` | `components/saved/saved-shelf.tsx:96` |

Pattern to adopt: **H1 + one short factual line at most, or nothing.** The Library subtitle literally re-lists the filter tabs (`All · Reads · Ideas · Hooks · Scripts · Outliers · Formats`) sitting directly beneath it — pure duplication.

### X2 · Repeated reassurance copy (same phrase, many times, one screen)
- **"pre-tested on your people"** — appears 3× on Calendar alone (header subtitle, empty-state banner, grid legend `month-grid.tsx:209`) and is seeded across `/start`, sidebar, composer. It has become wallpaper.
- **"trend builds daily"** — printed under **all four** stat tiles on Audience → Account (`analytics/analytics-view.tsx:206`), *plus* a caption above them and a full disclaimer paragraph below saying the same thing a third time. Note: `surfaces/sections/stat-row.tsx:54` already removed this exact filler — the fix pattern exists; the analytics view didn't get it.
- **"real numbers / over time / ground truth"** — the Account header subtitle and the panel caption `your account, over time — real numbers` state the identical idea twice, stacked.

### X3 · Instructional microcopy that shouldn't ship
The UI teaches the user how to click. `Tap a card to place it · ★ = Maven's pick` (`calendar/backlog-rail.tsx:69`) + `tap to place` stamped on **every** idea card (`:124`) + `TAP TO PLACE` again on placed-idea cards. Interaction affordance belongs in the hover/drag state, not as permanent body text on every card.

### X4 · In-app marketing voice (em-dash taglines)
Copywriter-voice sentences live inside the product chrome: Audience right rail — *"Your calibrated audience grounds every Read, hook, and remix you run — the moat that makes a prediction yours, not generic."* This is landing-page copy in an app surface. The em-dash aside is the signature; it recurs in nearly every subtitle above.

### X5 · Casing inconsistency
Title-case headers ("Content pillars", "What to do next") sit next to deliberately-lowercase captions ("your account, over time — real numbers", "outliers, trends, and rivals"). The lowercase "poetic" caption style reads as a stylistic tic, not a system. Pick one casing rule per text role and enforce it.

### X6 · Status-taxonomy overload
Audience rows carry **two pills each** drawn from a six-term vocabulary: Validated · Calibrated · Needs calibration · Baseline · Template · Directional. Library cards mix **audience segments** ("STOPS THE SKEPTIC", "ASPIRING FOUNDERS", "THE LOYALIST") and **content types** ("SCRIPT · OPENER ONLY", "MADE FOR YOUR AUDIENCE") in the *same* colored-eyebrow slot. The user can't tell a category from a status from a segment. Collapse to one meaning per visual slot.

### X7 · Weak visual density & hierarchy
Borders at 6% and near-black fills give almost no edge definition, so large regions (the Calendar month grid; the right portion of every Audience row) read as empty voids. Everything is the same visual weight — nothing earns the eye. This is what makes it feel "unfinished" more than any single element.

---

## Per-page findings

### 1 · Calendar  (`components/calendar/*`) — screenshot `screenshots/audit-calendar-01.png`
Three-column layout: sidebar · month grid · a right rail doing far too much (Ideas/Scheduled tabs → idea cards → "Next 7 days" progress → Content pillars, all stacked in one narrow column).

- **[High] Empty, low-contrast grid.** Day cells are huge and near-borderless; the single placed card on the 8th looks stranded in a void. No weekend tint, no today-column emphasis beyond a small filled "13" dot. The primary surface of the page reads as the emptiest.
- **[High] Right rail overloaded.** Four distinct modules compete in one column; Content pillars is pushed below the fold and duplicates the Content-pillars module that also lives on Audience → Account.
- **[Med] Empty-state banner competes with the header.** "Nothing coming up yet…" is a full-width bar directly under a header that already says "1 planned" — mixed signals (is it empty or not?).
- **[Med] Idea-card noise.** Each card stacks eyebrow (Predicted Win/Risky) + REEL tag + title + "N/10 would stop" bar + italic quote + "TAP TO PLACE". Five information rows per card in a narrow rail; the "would stop" metric has no legend.
- **[Low] Legend + tagline mashed:** `predicted win · risky · neutral · pre-tested on your people` — a functional legend with a marketing phrase glued to the end (`month-grid.tsx:209`).

### 2 · Discover / Feed  (`components/discover/*`) — screenshot `screenshots/audit-feed-01.png`
**The strongest page of the four** — a real thumbnail grid that genuinely looks like a platform. Problems are chrome and legibility, not substance.

- **[Med] Toolbar overload.** One row carries `Showing 24 of 49` + Filters + `Sort: Biggest outlier ▾` + `+ Add video URL` + `Export`. Power-tool actions (Add URL, Export) sit at equal prominence with core browsing — reads as a data tool, not a product. Demote/group them.
- **[Med] Tab sprawl.** Watching · Trending · Competitors · Channels · Hooks = 5 peer tabs under a page whose metadata claims it "folds feed + competitors." Channels and Hooks feel bolted on.
- **[Med] Cryptic metric row.** `↗ 12×  👁 106.1K  ⚡ 4%` — icon-only metrics with no key. The outlier multiplier (the whole point) has the same weight as views and a `⚡`-engagement number whose meaning isn't stated.
- **[Low] Subtitle** (X1) — lowercase em-dash tagline.

### 3 · Audience  (`components/audience/audience-manager.tsx`, 558 lines) — screenshots `audit-audience-01.png`, `audit-audience-account-01.png`
Two tabs: **Audiences** (roster) and **Your account** (folded-in analytics).

- **[High] Terminology soup** (see X6). "Your audiences" / "Who's in the room" / "Compare two rooms" / "personas" / "Analyst Panel" — audience, room, persona, and panel are used interchangeably in one viewport. Pick one noun for the core concept and use it everywhere.
- **[High] Placeholder-grade avatars.** Each audience is represented by a small scatter of grey dots of inconsistent size/count. They communicate nothing and look like unfinished placeholders — a premium product would show real persona faces/initials or a designed cluster.
- **[Med] Four category headers** (YOURS · BASELINE · TEMPLATES · GENERAL TEMPLATES) for ~6 rows — the taxonomy outweighs the content.
- **[Med] Row metadata is cryptic filler:** `personas modeled · receipts pending`, `warm-heavy`, `Fitness 25% · Learner 20%` — tiny grey strings whose meaning isn't discoverable.
- **[Med] Right-rail marketing paragraph** (X4).
- **Account tab specifically:**
  - **[High] H1 doesn't follow the tab.** On "Your account" the H1 still reads **"Your audiences"** — the title contradicts the content.
  - **[High] Triple-stated disclaimer** (X2): header subtitle + panel caption + 4× "trend builds daily" + a full paragraph, all saying "trends need more history."
  - **[Med] Generic stat tiles.** Followers/Likes/Posts/Views tiles are undifferentiated; the "trend builds daily" filler under each makes them look unbuilt.
  - **[Low] Content pillars** duplicated from the Calendar rail.

### 4 · Library  (`components/saved/saved-shelf.tsx` + `saved-item-card.tsx`) — screenshot `screenshots/audit-library-01.png`
Masonry grid of saved-item cards with search + 7 filter tabs + sort + grid/list toggle.

- **[High] Mixed taxonomy in the eyebrow slot** (X6) — audience segments and content types share one colored-label position, so the labels don't form a scannable system. Compounded by a `#1`/`#2` rank whose basis is unexplained.
- **[Med] Subtitle re-lists the tabs** (X1) — the two-line subtitle enumerates exactly the filter tabs beneath it.
- **[Med] Inconsistent card anatomy.** Some cards have italic quotes, some don't; every card has a different CTA verb (Write script / Use in thread / Develop into hooks / Test full script), so the action column can't be scanned.
- **[Med] Masonry = ragged.** Uneven card heights produce a jagged right edge and misaligned rows; a uniform card height or a cleaner grid would read as more considered.
- **[Bug] "stop stopped"** — see D1.

---

## Confirmed defects (verifiable bugs, not opinions)

- **D1 · "7/10 stop stopped" chip (Library).** The first card's proof chip renders `7/10 stop stopped` while every sibling reads `N/10 stopped`. Cause: `saved-item-card.tsx:239` renders `{fraction} stopped`, and that item's `fraction` value already carries a trailing " stop". Trace the `proof.fraction` view-model source and strip the redundant token. (Same value also feeds the aria label at `:368`.)
- **D2 · Audience → Account H1 mismatch.** H1 stays "Your audiences" on the Account tab; it should reflect the active tab (e.g., "Your account").

---

## Prioritized roadmap

### P0 — Copy & bug hygiene (hours, not days; highest leverage, zero layout risk)
1. **Strip page subtitles** (X1) across all four headers — delete or reduce to one factual line. Single biggest "de-AI" win.
2. **De-duplicate reassurance copy** (X2): one "pre-tested on your people" per surface max; delete the 4× "trend builds daily" (reuse the `stat-row.tsx` fix) and collapse the triple disclaimer on Account to one line.
3. **Remove instructional microcopy** (X3): drop per-card "tap to place" / "TAP TO PLACE"; move the affordance to hover/drag.
4. **Fix D1 (stop stopped) and D2 (H1 mismatch).**
5. **Normalize casing** (X5) — one rule per text role.

### P1 — Hierarchy & density (days)
6. **Calendar grid:** raise cell contrast/borders, add weekend + today emphasis, give placed cards presence; move Content-pillars out of the calendar rail.
7. **Audience rows:** replace placeholder dot-avatars with real/ designed persona marks; collapse the 6-term pill vocabulary to ≤2 meanings; fold 4 section headers into 2.
8. **Discover toolbar:** group Add-URL/Export into an overflow/secondary cluster; add a one-line key for the metric icons.
9. **Library:** unify the eyebrow slot to one meaning; standardize card anatomy + CTA treatment.

### P2 — System-level (design direction needed)
10. **One vocabulary** for the audience concept (X6) — pick audience *or* room *or* panel and purge the synonyms app-wide.
11. **Right-rail information architecture** — define what belongs in a rail vs. the main column; stop duplicating modules (Content pillars) across surfaces.
12. **A density/contrast pass** on the flat-warm tokens so 6% borders don't read as voids at scale (X7).

---

## Evidence
- `screenshots/audit-calendar-01.png`
- `screenshots/audit-feed-01.png` — Discover
- `screenshots/audit-audience-01.png` — roster tab
- `screenshots/audit-audience-account-01.png` — account tab
- `screenshots/audit-library-01.png`
