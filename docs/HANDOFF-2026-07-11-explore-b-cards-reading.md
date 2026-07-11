# Handoff — Card pass shipped + Reading refinement + the 3-lane protocol (2026-07-11)

**Worktree:** `~/virtuna-explore-b` (the b-lane)
**Status:** ✅ **all shipped to `main`, live in production.** Nothing here is pending.

| PR | Merged as | Scope |
|---|---|---|
| [#228](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/228) | `d96dbba5` | Thread-card refinement pass (4 commits from 07-10: CoverFill · script provenance · CaretToggle · tier-3 nits) |
| [#232](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/232) | `629b487c` | Reading `/analyze/[id]` refinement — the one card surface #228 deferred |

Production verified READY at main tip via the Vercel MCP; zero runtime errors (7-day window).

---

## 1. What shipped

### #228 — thread-card pass (authored 07-10, shipped this session)
The 4 commits sat unpushed-then-unmerged on `refine/thread-cards`; this session rebased them onto
`523415a7` (zero file overlap with #221–#227, verified by changed-file intersection) and merged.
Detail in the PR body; primitives: `src/components/primitives/CoverFill.tsx`,
`src/components/thread/caret-toggle.tsx`.

### #232 — Reading surface, audit-first on the REAL route
Driven against a live Read (`/analyze/Ag-0S867AH0r`, e2e user) at 1440 + 390px, every section +
drill expanded. Five fixes, worst-first:

1. **Mobile composer bug (real bug, the find of the session).** The empty chat composer rendered
   **162px tall** at 390px. Mechanism: `ReadingChat`'s fixed dock derives `leftOffset` from
   `useIsMobileHydrated()`, which starts **false** — so the dock mounts at the desktop offset
   (~300px), the textarea is ~90px wide for one frame, the placeholder wraps ~5 lines, and the
   autosize effect pins `min(scrollHeight, 140)` onto an **empty** field. Deps were `[value]`, so it
   never re-measured after hydration. Fix: pin a height only when there IS content + re-measure on
   `leftOffset`. Measured 162→60px, `height: auto` at rest.
2. **Mobile hero clearance.** The AppShell's floating hamburger (fixed, 16–50px) sat exactly on the
   "TEST" section label (`pt-8` = y32). Reading column is now `pt-16 sm:pt-8`; label lands at y64.
3. **Eyebrow grammar.** "Fix first" / "Hook rewrites" / "Ask anything" hand-rolled 12px/0.08em
   labels; every `ReadingSection` renders 10px/0.14em. One quiet-uppercase spec everywhere now; the
   chat's odd-one-out hairline dropped.
4. **Rewrite dedupe.** All three hook rewrites re-printed the same struck-through original
   back-to-back. A shared original now hoists once above the list (`fix-first-rewrites-original`);
   per-card strike kept for mixed originals.
5. **Send affordance.** `rounded-lg` → the #219 cream-disc grammar (36px `rounded-full`, 18px
   ArrowUp @2.25 stroke); stop button matched.

**Deferred from the Reading audit (recorded, deliberately untouched):**
- **Double replay CTA** — "▶ Replay how the room reacted" (AmbientRoom) + "Replay reactions"
  (ReplayController) both render in the embedded Room section. Both live in
  `src/components/audience-lens/` = **a-lane domain**; the Room is shared with /home, so dedupe
  must be coordinated there, not from the Reading.
- Retention drill "On screen" filmstrip renders near-invisible boxes for missing frames
  (`rgba(236,231,222,0.016)`) — same *class* as the CoverFill fix but these are positional
  timeline buckets, so a play-tile is wrong; owner-taste call.
- Niche-rank drill band reads sparse on a thin cohort (shared board panel).
- Fix-first's uncontained tier is documented design (honest fallback), not a break.

### Verification evidence
- tsc 0 · eslint 0 · 176 reading tests green pre-merge; **220 tests (27 files, reading+thread)
  green on the merged tip**.
- Browser, both viewports, before/after measured: composer 162→60px, TEST label y32→64,
  `del` count 3→1, send disc `borderRadius: 9999px` / cream `rgb(236,231,222)`.
- Prod deployment for `629b487c`/`0b34680a` READY (91s build), `virtuna-v11.vercel.app` HTTP 200.

---

## 2. The 3-lane protocol (worked live today — keep it)

Three sessions run the same prompt in `~/virtuna-explore-{a,b,c}`. The only input guaranteed to
differ is **the worktree path**, so work splits deterministically on it — no coordination channel
needed beyond `main` (handoffs) and `git fetch` (auto-pushed branches make siblings visible).

| Lane | Domain (file ownership) | Shipped today | Next |
|---|---|---|---|
| **a** | Audience/Room — `audience-lens/**`, /home room, persona chat (`api/tools/chat`) | #230 landing hero + backlog §1 reconcile | PersonaChatDrawer (in flight — chat-route test edits observed); the double-replay dedupe above |
| **b** | Thread cards + Reading — `thread/**`, `reading/**`, `/dev/cards`, `primitives/` | #228, #232 | Card elevation (owner-taste) · maven-logo (`stash@{0}`) · grounding live-verify (owner-gated) |
| **c** | Discover/data/platform — `scraping/`, `channels/`, crons, /feed, accounts, DB | #229 /feed tab-bar overflow + #231 DB advisor sweep | connected-accounts leftovers (gating, `content_pillars.account_id`) · `SurfaceEmptyState` pick |

Outcome today: **5 PRs (#228–#232) from 3 lanes in ~90 minutes, zero file collisions.**

Mechanics (the rules that made it work):
1. One branch ↔ one worktree ↔ one session (git enforces checkout exclusivity).
2. Cut short `fix/`/`feat/` branches off `origin/main`; PR + squash-merge same session.
3. Pre-PR overlap check: `comm -12 <(my changed files) <(git diff --name-only merge-base..origin/main)`.
4. Don't touch another lane's files — leave a note in your handoff instead (see the replay-CTA item).
5. Dev ports: a=3001 · b=3010 · c=3002. **Kill your server at session end**; `curl` the port —
   background tasks report exit 0 after being signalled dead.
6. Stashes are repo-global (one stack for every worktree): reference by message, only the creating
   session touches one. `stash@{0}: wip: maven-logo serif + vertical` belongs to b.
7. `git config push.default current` is now set repo-wide (protects the bare-push-to-main trap;
   lane upstreams still point at `origin/main`, so **name the remote+branch when pulling**).

---

## 3. Gotchas — new this session, still true

- **Fixed elements + `useIsMobileHydrated` = a pre-hydration width trap.** Anything `fixed` whose
  geometry derives from that hook renders one desktop-sized frame first. Any mount-time measurement
  (autosize, `scrollWidth` probes) inside it captures garbage — re-measure after hydration or gate
  on content. This is the composer-bug mechanism and it generalizes.
- The Reading scrolls in `<main class="relative h-full overflow-auto">` — `fullPage` screenshots
  and `documentElement.scrollWidth` both lie. Scroll + measure the `main`.
- A permalink reload of a settled Read renders at rest (no reveal cascade) — don't wait for
  animations that won't come; `sawSkeleton` gates the cascade to live builds.
- Live Read for e2e user: `Ag-0S867AH0r` (video upload, engine 3.20.0, score 61) — newest row with
  full heatmap/personas/rewrites; the 06-28 rows are thinner.

---

## 4. Resume

- Worktree parked on `refine/reading-surface` **= `origin/main`** (`0b34680a`), clean; dev server
  killed. Next session: cut a fresh branch off `origin/main`.
- Memory updated: `card-refinement-pass.md` (shipped state) + index.
- The open-work index is `docs/OPEN-WORK-BACKLOG.md` (reconciled by #230); this doc supersedes
  nothing there except the item struck in this PR.
