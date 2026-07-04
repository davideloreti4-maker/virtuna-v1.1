# Handoff — mount the Room↔Surfaces seams (the "data depth") · 2026-07-05

## TL;DR
The Room-side seam vertical is **DONE** — all 4 producers/adapters are landed + merged to `main`
(`3b265d9a`), Seam 4 shipped this session (PR #151). **But the surfaces still render `mock-room.ts`
data.** Your job: **mount the 3 data producers on the surfaces so the seams go live** and retire the
mocks. This is the *data depth*, running **in parallel** to the active *design depth* session
(depth + motion) in `~/virtuna-surfaces`.

---

## ⚠️ COORDINATE — another session is LIVE right now
`~/virtuna-surfaces` @ `feat/start-elevation` (aka `design/depth-motion-system`) is actively doing the
**premium design elevation** (depth + motion). As of 2026-07-05 its diff touches **ONLY**:
`src/app/globals.css` · `docs/DESIGN-SYSTEM.md` · `src/components/surfaces/surface-canvas.ts` ·
`src/components/reading/__tests__/reskin-matte.test.ts`.

**Rules to avoid the multi-session mess:**
- **DO NOT touch** those four files (they're the design session's). Never edit `globals.css`,
  `DESIGN-SYSTEM.md`, tokens, motion, or the matte guard.
- **`git fetch` first, then re-check their diff** each time before touching any surface file:
  `git diff --name-only $(git merge-base origin/main origin/feat/start-elevation) origin/feat/start-elevation`
- **HOTSPOT = `src/components/surfaces/start-page.tsx` + the `/start` route.** Both tracks want it
  (their branch is *named* start-elevation) — they just haven't edited it yet. You edit **only the
  DATA plumbing** (server-side audience/analysis resolution + passing real props down); leave the
  **visual / layout / motion** to them. Keep your edits surgical and rebase often.

---

## What shipped this session (context — do NOT redo)
**Seam 4, Path A** (PR #151, merged `3b265d9a`): a Room-owned **`EmbeddedComposer`** atom
(`src/components/app/home/embedded-composer.tsx`) + pure **`buildThreadLaunchHref`**
(`src/lib/room-contract/thread-launch.ts`) + a one-shot **`/home` seed inlet** in `composer.tsx` +
the **graft** in `start-page.tsx` (surfaces stub deleted). Launch defaults to **auto-run** ("send on
/start → land in the thread already reacting"; pre-fill is the built-in fallback via the `run` flag).
Full detail: memory `the-room-phase3-built.md` (2026-07-05 entry) + PR #151.

---

## The seam producers — ALL landed, pure + unit-tested (import, don't rebuild)
| Seam | Producer | File |
|---|---|---|
| 1 — card face | `readToCardReaction(read): CardReaction` | `src/lib/room-contract/read-to-card-reaction.ts` |
| 2 — the Read | `predictionResultToRead(data, contentId): Read` | `src/components/reading/prediction-to-read.ts` |
| 3 — audience | `audienceToActiveAudience(aud): ActiveAudience` | `src/lib/audience/audience-to-active.ts` ⚠️ see trap |
| 4 — composer | `EmbeddedComposer` + `buildThreadLaunchHref` | already grafted into `start-page.tsx` |

---

## Your work — ordered by value + contained-ness

### 1) Seam 3 — real audience on the dock  (START HERE — highest signal, most contained)
Goal: `/start`'s dock shows the user's **real** audience (or General), not the mock "Fitness Creators".

**⚠️ TYPE-FLOW TRAP (verified this session — `SEAM-SPEC §2.4` is INACCURATE here):**
- `AudiencePresence variant='surface'` consumes the **DB `Audience`** type
  (`audience: Audience | null`, `audiences: Audience[]`, `onSelectAudience: (Audience) => void`) —
  see `src/components/audience-lens/audience-presence.tsx:86-92,147`.
- `SurfaceDock` (the stub) + `audienceToActiveAudience` deal in the **contract `ActiveAudience`** type
  (`surface-dock.tsx:18,23-24`).
- ⇒ You **cannot** feed `audienceToActiveAudience`'s output into `AudiencePresence` — the types don't
  line up. The spec's "swap fed by `audienceToActiveAudience`" won't compile.

**Recommended resolution:** mount `<AudiencePresence variant='surface'>` fed the **raw `Audience[]`**
from the server (`listAudiences` / `resolveUserAudience` — already called in the `/start` route
`src/app/(app)/start/page.tsx`) — **NOT** through `audienceToActiveAudience`. Treat `SurfaceDock` +
`audienceToActiveAudience` as **retired-for-the-dock or repurposed** (they only matter where the
contract `ActiveAudience` shape is genuinely consumed — e.g. a card/mock layer). Make the call +
document it in the SEAM-SPEC.

**Files:** `src/app/(app)/start/page.tsx` (server — resolve audiences, pass down; DATA only,
coordinate w/ design) · `src/components/surfaces/start-page.tsx` (client — mount AudiencePresence,
dock vs rail by media query) · `src/components/surfaces/surface-dock.tsx` (retire/adapt).
**Verify:** real browser `/start` — dock shows the real audience; the switcher persists
(`user_settings.last_audience_id`, written by the presence). `variant='surface'` is read-only
(no ask input / no Rewrite CTA) — that's correct (THE-CONTRACT §3 sign-off delta).

### 2) Seam 1 — real card faces  (bigger — needs real analyses)
Daily-ideas / outliers cards carry mock `stop`/`lead`. Real faces =
`readToCardReaction(predictionResultToRead(data, id))`. **But** the mock ideas/outliers aren't backed
by real `analysis_results`, so this is a **data-sourcing** task (surfaces must source a real `Read`
per card), not just an adapter swap. Scope before diving.

### 3) Seam 2 — Read panel in the room drawer  (depends on #2)
`src/components/surfaces/room-drawer.tsx` opens on a tapped card → render the real `Read` via
`predictionResultToRead(data, id)` instead of `MOCK_READS`.

### Retire `mock-room.ts`
As each producer goes live, delete the matching `MOCK_*` (`MOCK_AUDIENCES`, `MOCK_READS`,
`getReadByCardId`, …). Don't leave dead mocks behind.

---

## Blocked / not yours
- **Phase 4 outcome loop** — needs surfaces account-connect (not built). Don't start.
- **Design system** (globals.css, tokens, motion, matte guard, surface-canvas) — the `~/virtuna-surfaces`
  design session owns it.

---

## Setup
```bash
cd ~/virtuna-the-room          # the adapters live here; the DESIGN session stays in ~/virtuna-surfaces
git fetch origin && git switch -c feat/seam-mount-<name> origin/main   # main tip: 3b265d9a
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# http://localhost:3000 · login e2e-test@virtuna.local / e2e-test-password-2026
```
> Run the seam-mount work from **`~/virtuna-the-room`** on a fresh `main`-based branch — NOT from
> `~/virtuna-surfaces` (that's the design session's worktree). Same git, disjoint files → no collision
> as long as you honor the coordination rules above.

## Gotchas (all hit this session)
- **Coordinate w/ `~/virtuna-surfaces`** — re-verify their diff before touching any surface file;
  never touch `globals.css` / `DESIGN-SYSTEM.md` / `surface-canvas.ts` / the matte guard.
- **vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (npx/`npm test` print a fake PASS).
- **tsc:** production 0; the **21 test-baseline `Audience.mode` errors are pre-existing** — ignore them
  (they're all in `*.test.ts`). Stale types → `rm -rf .next/dev/types`.
- **Fresh-upload Test is flaky here** (`ERR_HTTP2` browser→Supabase storage). For Read renders use an
  **existing rich analysis** (`analysis_results`, Supabase project `qyxvxleheckijapurisj`, e2e ids
  `giyyxJfww2iC` / `WPk976kozfWs`, `segment_reasons` non-empty).
- **Auto-wip daemon LIVE** (post-commit auto-pushes) — never force-push. Merge via
  `gh pr merge --squash` **WITHOUT** `--delete-branch` (the local step fails on the shared worktree);
  delete the remote branch manually (`git push origin --delete <branch>`).
- **Memory dir is worktree-guarded** — write memory via Bash, not Edit/Write.
- **Dev-StrictMode note (from Seam 4):** a *full reload* onto a `/home?v=…&seed=…&run=1` launch URL
  while a *conflicting* open thread exists shows the persisted verb instead of the launched one
  (React StrictMode double-invoke resets the one-shot guard). **Production is correct** + the common
  fresh-thread case is clean. Only relevant if you touch the `composer.tsx` seed inlet.

## Read first
- `docs/SURFACE-SEAM-SPEC.md` — graft-readiness ledger (all 4 rows current; §2.4/§5 = the graft, **but
  apply the Seam-3 type-flow correction above**).
- `docs/THE-CONTRACT.md` — the 4 seams (shared vocabulary + shapes).
- Memory auto-loads `the-room-phase3-built.md` (full seam-vertical history incl. this session).

## Seam status (final, Room-side)
`1 🟢 · 2 🟢 · 3 🟢 · 4 🟢` — all producers/adapters landed. Everything remaining is the
**surfaces-side mount** (this handoff) or **blocked** (Phase 4).
