# Dev-Server Verification — 2026-06-29

> Live browser pass on the running dev server (`http://localhost:3300`, the `~/virtuna-refine` worktree =
> `origin/main` content) to separate **what's actually working/landed** from **what's still a stub/missing**.
> Authed as the e2e user (`e2e-test@virtuna.local`). **0 console errors** across the whole session.
> Screenshots in `docs/verification/verify-0*.png`. Complements the static audits
> (`WORKTREE-MERGE-AUDIT` / `OPEN-DEBT-AUDIT`); **where the browser contradicted those docs, this doc wins**
> and the corrections are folded back.

---

## ✅ Working / landed (live-verified)

| Surface | Evidence | Lane |
|---|---|---|
| **Home** (`verify-01`) | GSI HomeStarter — 3 verb chips (Test an idea / Profile a chat / Predict an outcome) + "See it in action" first-run demo + Dismiss; serif hero "Ready to simulate your audience, …?"; audience picker "General · 10 personas ready"; composer = skill pill + Intent + evidence-drop paperclip ("Attach a chat or screenshot") + **SIM-1 Max** badge | GSI 07-06 / 05-06 |
| **Sidebar** | Multi-thread history (8+ threads, relative times) + per-thread delete + New Thread ⌘N + Audience/Library/Feed nav | shell #70 |
| **Skill menu** | **Mode-scoped** — Creator (Explore/Ideas/Hooks/Script/Remix/**Test MAX**/Chat) + Marketing (Offer Validation / Ad Creative, both disabled "soon") | GSI 07-01 |
| **Premium conversational thread** (`verify-06`) | Numen intro turn → "Hooks · General" → **5 hook cards as artifacts** → real engine outro "#1 is your strongest. Want me to turn it into a script?" → forward chip **"Write a script from #1 →"**; AudienceLens REACT live ("1 of 10 would stop" + per-persona stop/scroll); in-thread composer (SIM-1 Flash badge, "Generate hooks") | shell #85 + #88 |
| **Feed · Videos** (`verify-04`) | Watched\|Trending tabs, "Showing 7 of 7", 7 tiles render (covers + TikTok badge + metrics); **filters: min–max ranges (Outlier/Views/Engagement) + "Posted in last" + unit dropdown + Platform + Channels multi-select + Save-filter** | #89 + #90 |
| **Feed · Channels** (`verify-03`) | Suggested/Describe/Search/Add-URL tabs; **Suggested = creator-strategy categories** ("Social media growth strategies" / "Viral content creation tactics" / "AI tools for creators") **+ per-channel follower/view counts**; Watchlist rail (3 channels, Remove/Export) | #90 |
| **Feed · Hooks** (`verify-02`) | "Default hooks · 12" seed vault fully rendered (templates with `[brackets]` + "Inspired by @handle" + category pill + outlier× + views + favorite); Search/Create-from-video/Format-toggle/Sort/Export toolbar | #90 |
| **Library** (`verify-05`) | 9 saved cards, per-type heroes (Hook "Why—"+quote, Read "Lever→", Idea "7/10 stopped", Script "6/10 stopped") + forward actions (Write script→ / Use in thread→ / Develop into hooks→ / Test full script→); type-filter tabs (Reads 2/Ideas 2/Hooks 3/Scripts 2/Outliers/Formats); grid⇄list + sort + search | frame #75 + cards #73–80 |
| **Audience** (`verify-07`) | Mode-sectioned — **Baseline** ("General · 10 universal personas"), **Templates** (×2 weight mixes), **General templates** (×5 GSI authored, e.g. "Tough Crowd 30% · Purposeful Viewer 30%"), **Yours** (×2 custom); **Directional** trust badges + persona counts; Compare + Create | GSI 07-02/03/05 |

---

## 🔴 Stub / missing (live-confirmed)

| Item | Live evidence | Status |
|---|---|---|
| **Hooks "from your analyzed videos"** | `feed/hooks` shows "Hooks from your analyzed videos · **0**" → *"Remix a video into a Read and we'll pull its hook here — automatic hook extraction is **coming soon**."* | STUB — needs the **Phase-3 analyze pipeline** |
| **Channels "Describe" backend** | `feed/channels` Describe tab: full UI (textarea + Platform + Account-size dropdowns) but **Search button DISABLED** + empty state *"…press Enter to get results."* | STUB — UI only, **no describe→suggest service** |
| **Videos "Status / Analyzed" filter** | `feed` filters: Analyzed/Unanalyzed checkboxes render but caption reads *"Filtering by status — **coming soon**."* | STUB — needs an **`analyzed` flag** on `scraped_video` |
| **Route loading skeletons (Theme B)** | code-confirmed ABSENT: `home`, `analyze`, `library`, `audience`, `audience/[id]`, `audience/new`, `feed/channels`, `feed/hooks`, `saved` have **no `loading.tsx`** (only `feed`/`brand-deals`/`discover`/`competitors*`/`referrals`/`settings` do) | OPEN — shell Theme B |
| **Trending metrics gaps** | Channels watchlist shows `@khaby.lame` + `@chrisbumstead` as "**-- followers · 0 views**" (NULL metrics not backfilled) | partial — per-niche recompute / metric backfill |
| auth-guard `#0A0A0A`+zinc · video-card lucide · ui/* glass · dead GlassToast/GlassSkeleton · A5/A6/A7 · Theme C MATTE | code-confirmed (not browser-visible) — see `WORKTREE-MERGE-AUDIT` §A | OPEN |
| **GSI verbs end-to-end** (Profile/Simulate/Predict producing output) | surfaces live (chips + mode menu + General templates + audience picker); not re-run here (paid LLM). Validated in **GSI Phase-07 Task-4 human-verify** (approved) | working (surfaces) |

---

## ⚠️ Corrections — browser contradicted the static audits (now fixed)

The static pass (from the **pre-#90** `HANDOFF-FEED-UI-REFINEMENT.md` plan) listed feed-filter work as
deferred. The live app proves **#90 actually shipped most of it.** Removed/corrected in
`OPEN-DEBT-AUDIT` §Feed-F and `WORKTREE-MERGE-AUDIT` §B:
- **Min–max filter ranges** (Outlier/Views/Engagement) — **SHIPPED** (rendered with min+max inputs). ✅ not deferred.
- **`max*` API params + `postedWithinUnit`** (Posted-in-last + Days/Weeks/Months unit) — **SHIPPED**. ✅
- **Save-filter button** + **Channels multi-select** — **SHIPPED** (present in the filter sidebar). ✅
  *(Save-filter persistence not exercised — present, assumed wired.)*
- **Suggested-channels: creator-strategy categories + per-channel follower/view counts** — **SHIPPED**. ✅
- **Metric-pill tints / platform-badge color** (handoff §6 open decisions) — the **restrained choice shipped**
  (neutral pills, matte badges). Treat as decided, not open, unless the owner wants tints.

**Net remaining feed work** (down from the handoff's long list): the 3 stubs above (all = the **Phase-3
analyze pipeline**) + trending metric backfill + `shouldDownloadVideos:false` cost optimization +
multi-platform corpus + the unrun E2E-Remix-on-`/feed` check.

---

## Method / notes
- Dev: `~/virtuna-refine` on `lane/refine` (= `origin/main`), port 3300, heap 3072.
- Auth: `e2e-test@virtuna.local` / `e2e-test-password-2026` (ensured via `e2e/create-test-user.ts`).
- The e2e user has Zach King + @khaby.lame + @chrisbumstead tracked → Watched tab = 7 tiles.
- Not browser-exercised (would cost paid LLM calls / need setup): a fresh skill run (the live "Generating"
  loading gap — confirmed structurally at `hooks/route.ts:182/186/198`), Profile/Simulate/Predict verb
  output, Build-an-audience clone flow. Surfaces for all of these are present and wired.
- 0 console errors over: login → home → skill-menu → feed/hooks → feed/channels(+Describe) → feed → library → thread → audience.
