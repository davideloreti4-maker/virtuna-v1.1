# Handoff — Ambient audience quiet-luxury refine + ask-history A-lite

**Session:** 2026-07-13 · worktree `~/virtuna-explore-b` (b-lane) · branch `design/ambient-quiet-luxury`
**Shipped:** PR **#257** (`a561111b`) squash-merged to main. Owner directive: *"improve the general
design of the ambient audience — doesn't yet feel like a design concept a big brand would release."*

---

## 1. What shipped (#257)

Design elevation across every Room state + surfacing recent asks the shell already computed but v6
never rendered. Two files only: `AmbientRoom.tsx`, `audience-presence.tsx`.

### `AmbientRoom.tsx` — the Room body
- **Ranked header** — micro-label (10px, 0.12em tracking), 21px title, thin 4px meter; dropped the
  redundant "tap any one to open the room on it" instruction line.
- **Stepper / view-all** — borderless, subtle `hover:bg-white/[0.04]` fill only.
- **Focus hero** — 30px Newsreader serif, tighter leading/tracking (`leading-[1.12]`,
  `tracking-[-0.015em]`); concept line demoted to 12.5px secondary.
- **Scale switch** — Panel⇄Population is now underline text tabs (was a pill/segmented toggle).
- **People rows** — tonal reaction dot (sage `--color-positive` = stayed, terracotta
  `--color-accent` = bounced) replacing the letter-circle; uppercase micro-labels.
- **Population swarm** — denser 25-col CSS grid, 200 dots, tonal opacity by state.
  Constants: `SWARM_DOTS` 90→200, `SWARM_REVEAL_STEP` 6→14, added `SWARM_COLS = 25`.

### `audience-presence.tsx` — the shell
- **Identity chip** — borderless; hover/active fill only (`bg-white/[0.05]`).
- **Ask-history A-lite** — up to 3 recent asks render under an "Earlier asks" label in the idle
  panel AND under a typed-thought focus. Tapping a row re-opens the Room on that ask via the
  already-wired `onReask` path (composer computed `asks`/`onReask` but v6 rendered nothing).
  `earlierRows` memo = `asks.filter(a => !a.error && a.thought !== focus?.conceptText).slice(-3).reverse()`.
  Gated `!isSurface && onReask && earlierRows.length > 0`, and only mounted when `focus.id == null`
  — the honesty spine (exactly one labeled concept) still holds, because a typed thought has no id.
- **Flex-chain fix** — focus branch wrapper → `flex min-h-0 flex-1 flex-col overflow-hidden` and
  AmbientRoom root → `flex min-h-0 flex-1 flex-col`. Without it the content-hugged panel broke the
  `h-full` chain and the "Earlier asks" footer painted over the weak-spot rows.

### Verification
- `tsc` 0 errors.
- eslint **byte-identical to baseline** — 5 pre-existing `react-hooks/set-state-in-effect`
  (presence 4 / AmbientRoom 1), **0 new** (stash-diffed).
- audience-lens **63/63** · matte guard **38/38** (= 101 tests).
- All 6 Room states screenshot-verified (idle cast, ranked, People, Population, typed-thought +
  Earlier-asks footer, collapsed tab) + re-ask round-trip driven live (tap earlier-ask → Room
  re-focuses, hero + concept swap, list swaps to the other ask).

This RESOLVES the "ask history is invisible" open follow-up from the 07-12 handoff (#249).

---

## 2. ⚠️ OWNER FLAG — prod env sparseness blocks all crons (no keys added)

Per your instruction *"flag, don't add keys without me"* — reporting only, nothing changed in Vercel.

- **Cron auth (401) is FIXED** — `CRON_SECRET` landed 07-12; the 16:00 UTC scheduled fire got past
  auth. That story is closed.
- **New blocker: crons now 500** with `"supabaseKey is required."` **Production has only ~3 env
  vars** (2 Supabase publics + `CRON_SECRET`). Missing for the cron/scrape/engine paths:
  `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_TOKEN` / `APIFY_ACTOR_ID`, `GEMINI_API_KEY`, `WHOP_API_KEY`,
  `DASHSCOPE_API_KEY`, `UPSTASH_REDIS_REST_URL` / `_TOKEN`, etc.
- **Impact:** every scheduled cron (`calculate-trends` hourly, `scrape-trending` 6h,
  `refresh-competitors` daily 06:00, `refresh-account-snapshots`, `sync-whop`, retention sweeps)
  500s. Competitor stats/avatars only look fresh because of manual triggers.
- **Action (owner, ~5 min):** Vercel → virtuna-v1.1 → Settings → Environment Variables → add the
  keys above to Production → redeploy. Then verify next-morning `select tiktok_handle,
  last_scraped_at from competitor_profiles` stamps ~06:00 UTC and Vercel runtime logs show 200s.
- Memory: `vercel-crons-dead-401.md` holds the full inventory + verify steps.

---

## 3. Next-session options (b-lane, owner-gated)

- **Ranked rows carry no WHY** — could surface the top bouncer's quote per ranked row (density
  tradeoff — was deliberately omitted).
- **Meet-mode from People view** — meet-mode cast is only reachable when idle; a focused thread
  never shows it. Fine per current design, but "meet" from the People view could deepen the bond.
- **Short-height panel polish** — panel clips mid-row at very short heights (scrolls fine; a bottom
  fade mask would polish).
- **Persona quote drift** — quotes sometimes off-concept (skincare quote on a morning-routine hook).
  ENGINE-side (S3′ personas from card gen), not a UI fix.

## 4. Session hygiene
- No explore-b dev server left running (mine exited; port 3010 is **landing-lane's** server —
  `lsof -p <pid> | grep cwd` before trusting any screenshot or killing anything).
- Worktree reset to post-merge `origin/main` (`a561111b`). Next b-session cuts a fresh short branch.

SSOT memory: `ambient-audience-refinement.md`. Prior handoff: `docs/HANDOFF-2026-07-12-ambient-audience.md` (#249).
