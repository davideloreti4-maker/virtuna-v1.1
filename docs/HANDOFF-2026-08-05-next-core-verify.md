# HANDOFF — get the CORE product working, verified in a real browser

**Written** 2026-08-05 session close · **Base** `origin/main` = `db0d8c69` · **For** a fresh session
**Scope owner set:** the core loop only — **thread · skills · rail**. *Not* the landing page, not a
funnel walkthrough, not marketing surfaces.

---

## 0. The method is the point — LIVE BROWSER VERIFICATION

The owner asked for this explicitly. Do not close a task on a green suite.

**Four real defects were found in this repo on 2026-08-04/05. Every one was found by opening the app
and looking. None by tests.** ~5,300 tests had an opinion on none of them, and two were money bugs:

| defect | how it was found |
|---|---|
| the home thread never scrolled — answers landed below the fold | a browser |
| Library hid a **billable** button under a transparent box — touch users spent credits unknowingly | a browser at 390px |
| the chat guard leaked the paid pack to **anonymous** visitors | a live harness |
| the sim rail sealed a row then the click did nothing; `#1` was an unmeasured rank | a browser |
| *(this session)* a projected card's `aria-label` still said `Hook #1` after the visible rank was dropped | the DOM, in a browser |

**Rule for this session: every claim of "works" must be a measurement taken in a running browser,
signed in.** `getComputedStyle` / `getBoundingClientRect` / DOM assertions — not a screenshot's vibe,
and not a passing test.

### The signed-in recipe that WORKS (proved 2026-08-05, use this, don't rediscover it)

`e2e/auth.setup.ts` fills a password field the login page no longer shows first, and the
"sign in with a password" toggle is dead in dev (hydration mismatch). Mint the cookie instead:

1. `POST {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password` with headers `apikey` +
   `Authorization: Bearer <ANON>`, body `{email, password}` → full session JSON.
2. Cookie name `sb-<projectRef>-auth-token`, value `'base64-' + base64url(JSON.stringify(session))`.
   A real session is ~2,635 chars → **one cookie, unchunked** (chunking starts at 3,180).
3. In the browser at `localhost:3000`, `document.cookie = \`${NAME}=${VAL}; path=/; SameSite=Lax\``,
   then navigate. `/dev/cards` loads authenticated instead of 307ing to `/login`.

Creds are in memory (`e2e-auth-state-is-dead`). ⚠️ It is a REAL production account
(`31c5a91c-…`) on the shared Supabase project — signed-in actions hit prod data and can spend credits.

### Two screenshot traps

- **Screenshots hang on this app** — the ambient animations never settle. Inject
  `*{animation:none!important;transition:none!important}` before capturing, and scope to an element.
- **A resized window is NOT the mobile UI.** Open a context at the native viewport (390×844).

---

## 1. P1 — omni's ONE job is broken (live in prod)

**Owner's decision, recorded:** *"omni should analyze the audio of a video and 3.7-flash does
everything else."* That is already the shipped architecture (PR #433, `ENGINE_AUDIO_SPLIT`, default
ON — `src/lib/engine/qwen/split/run.ts:59`): flash watches the video and owns the segment grid, omni
hears an ffmpeg-extracted mp3, a text-only call grades `visual_audio_coherence`.

**So omni now does exactly one thing — and it is getting it wrong.** The omni read reports a
90%-dialogue video as **0% voice**: the three audio ratios sum to ~0.05. That output feeds Apollo's
prompt directly, so the core video read is graded on a false premise.

Where to look:
- `src/lib/engine/qwen/schemas.ts:158-160` — `voiceover_ratio`, `music_ratio` (+ the third ratio).
- The refine that would catch this sits on the **legacy Gemini schema** (`types.ts:637`), **not** on
  `qwen/schemas.ts`, which is the one in the path. That mismatch is the bug's cover.
- Background: `docs/HANDOFF-2026-08-04-omni-modality-split.md` §7.

⚠️ **Never let an adapter synthesise a missing figure.** If the audio leg genuinely cannot hear
speech, the honest output is null/absent, not a fabricated ratio — and Apollo must be told which.

Verify with a real clip that is mostly dialogue, end to end, and read the actual values. A
valid-looking model result proves nothing.

---

## 2. P2 — walk the core loop signed in, on prod AND locally

Thread · skills · rail. Log findings first, fix after — mixing discovery with repair is how three of
the defects above stayed hidden.

- **Thread**: does it scroll, does an answer land above the fold, does history survive reload, does
  the receipt persist.
- **Skills**: hooks / ideas / script / remix / read / test — does each render its cards, do the
  handoffs (`Write the script →`, `Test full →`) actually go somewhere.
- **Rail (ambient v2)**: queued rows → ARM panel → `Simulate ↑` fires the real
  `POST /api/tools/react` (**1 credit**) → row seals → the click opens Brain / Engagement / Audience.

**Just shipped, so check it renders right in prod:** a sealed row with no population is now
`disabled` with a `verdict only` tag, and projected hook cards no longer print `#N`. Both were
verified locally at `/dev/cards` (`#hooks` vs `#hooks-projected`, and the rail fixture) — **not yet
seen on production.**

**The owner's audience state:** only `@zachking` remains (calibrated, projects fine). Four legacy
rows were deleted; `last_audience_id` is NULL → resolves to **General**, which projects through the
baseline. So the drill should work. If it does not, that is a NEW defect, not the old one.

`scripts/probe-surface-live.mjs` opens any route signed in and reports scroll-region state,
below-the-fold content, horizontal overflow and console errors. **Free** — loads a page, spends
nothing. Start there.

---

## 3. State at close

| | |
|---|---|
| `origin/main` | **`db0d8c69`** |
| `~/virtuna-v1.1` (trunk) | synced to `db0d8c69`, clean, deps + `.env.local` present |
| `~/virtuna-slot-b` | detached at `origin/main`, clean, ready |
| production | Vercel READY on `07d4d352` (last code merge); `numenmachines.com` + `/go` → 200 |
| open PRs | only **#376** (Cursor Cloud env), pre-existing |

Merged today: **#437** (sim-rail fix) · **#440** (its handoff) · plus a co-session's **#438**
(mobile Library billable button) and **#439** (chat guard).

---

## 4. Traps that cost real time — do not re-learn these

- **Merging to `main` IS deploying** (~4 min build, no preview URLs). Run gates before the PUSH.
- **A green Vercel check is NOT a build** — `ignoreCommand` skips and posts success. Run `tsc`
  yourself; vitest does not typecheck.
- **`main` moves under you** — it moved 3× during this session under a co-session. `git fetch` +
  `git rev-parse` before acting; **never** read refs with `git log --oneline` (it elides merges here).
- **The suite is intermittently flaky under parallel load.** Two different one-off failure sets in
  six full runs, each passing in isolation, `main` clean. **Re-run a red full suite before believing
  it** — and never let that excuse a real regression.
- **`git cherry -v main <branch>`** is the only tool that answers "is this already in main". A `+`
  does *not* mean unshipped. And a command inside a `while read` loop eats the loop's stdin — that
  silently produced "0 unique" for all 13 branches today. Verify one by hand before believing a
  uniform result.
- **Apify is on a FREE plan, $5 hard cap, ~$3.40 left, resets 2026-08-20.** Calibration, account read
  and Discover Pull all draw on it. A cap-out is disguised as "check your handle is public" — check
  the ACCOUNT, not the app.
- **`NEXT_PUBLIC_*` inlines at BUILD time** — restart dev + clear `.next/` after touching it.

## 5. Tools available

- `scripts/probe-surface-live.mjs` — signed-in live surface probe (free).
- `scripts/fired-sim-drill-harness.ts` — runs the real fired sim path and reports whether Brain /
  Engagement / Audience open, per audience. `--no-flash` skips the paid panel call.
- `scripts/omni-split-harness.ts` — drives the split read on real clips (from #433).
- `scripts/dump-audiences-backup.ts` — back up a user's audience rows before a destructive edit.

## 6. Deliberately NOT in scope

Landing page / `/go` / marketing walkthrough. The 65 unmerged commits across 13 worktree branches
(`docs/HANDOFF-2026-08-05-sim-rail-closed.md` §5 has the survey — several are likely **superseded**,
and none were verified per-branch; do not merge any of them on this session's authority).
