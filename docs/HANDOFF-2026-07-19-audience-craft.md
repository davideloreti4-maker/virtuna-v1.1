# HANDOFF — Audience manager craft pass shipped; DEEPER REWORK MANDATED (2026-07-19)

**✅ MERGED: PR #333, squash `d843a281`** — composition/craft rework of `/audience`,
`/audience/[id]`, `/audience/new` within the #317 locked IA. Worktree
`~/virtuna-audience-page` retired after merge.

**🔴 THE MANDATE FOR THE NEXT SESSION (owner, verbatim intent):** the craft pass "looks
better but still a lot of UI design rework we need to do" — **the audience OVERVIEW
(`/audience`) and the audience DETAIL page (`/audience/[id]`) need substantial rework**,
beyond polish. This time the layout/content composition is OPEN for redesign; the
honesty/concept law below still binds unless the owner explicitly unlocks a piece.
**Proven rhythm: propose 2–3 directions (ASCII or throwaway `/dev` route variants),
get an owner LOCK, then build.** Two drafts died in July for accent-flood and
narrated UI — do not repeat that; read the law first.

## What #333 changed (so you don't re-litigate it)

- **List**: zone panel = the ONE frame per group; rows borderless, hairline-divided,
  hover tint; meta gained persona-count fact; amber only on the `Nothing yet` label;
  column 1180→880; skeletons (manager + both route `loading.tsx`) mirror the real shells.
- **Detail**: rail's three boxed mini-cards → one quiet hairline-grouped fact column
  (Danger box label deleted, destructive button stays); persona roster folds >6 behind
  `N more…`; disposition mono small-caps; SOURCE tiles 72×118 + right-edge fade mask,
  figures 23px; column 1120→880, rail 212px.
- **Create**: `SURFACE_RADIAL_BG` deleted (retired pattern); door selected-state via
  text tone + 14% border; `Analytics only.` fact inside the step zone.
- Hover-only affordances (Build / Set default / persona Edit) → `pointer-coarse:opacity-100`.

Before/after screenshots: `.planning/sketches/audience-craft-2026-07-19/`
(`aud-list-desktop.png` = before, `-after` = after; detail after-shots incl. expanded fold).

## THE LAW (owner-locked — read before designing)

**`docs/HANDOFF-2026-07-16-audience-rebuild.md` is the concept lock** for this surface:
- Thread = the action page; **/audience = the manager** of the two things a user owns
  (ACCOUNTS · SIMULATED). One connection → one canonical audience.
- **Facts only, no narration** — no explainer subtitles, no self-aware microcopy.
- **Accent budget: ONE element per screen** (primary account's liveness dot / the
  create-flow building dot). Error color only for genuinely destructive.
- **General and presets are never rows** — General is the fact-line
  "New threads use General. View"; presets live inside the describe door.
- Mono small-caps microcopy for group labels; **no serif on manager chrome**.
- Provenance in plain words on every row; **"Nothing yet" is the only state that earns
  color**.
- No brain at rest on the detail page (population/personas/source only — reactions
  belong to the ambient card during a Read).

**Test locks (must stay green or be consciously evolved WITH the design):**
- `src/components/audience/__tests__/honesty-render.test.tsx` — the honesty strings
  ("Read from @x" / "A description you wrote" / "No account data behind it" /
  "Nothing yet" / "Read your @handle to fill it" / "Maven's baseline" /
  "New threads use General" / `Default` / `Make X the default` / Build role=button),
  no trust badges on rows, no General/preset rows.
- `audience-detail.test.tsx` — asserts `Usage` / `Sync` / `Daily` / `Re-calibrate`
  TEXT rendered and `Disconnect @x` / `Delete audience` as REAL buttons in the DOM —
  **don't bury these in a closed dropdown** (getByRole would fail; conscious test
  evolution required if the design demands a menu).
- Component APIs: `AudienceIndex({audiences, accounts, defaultAudienceId, onSetDefault,
  onOpen, onOpenAccount, selectionMode…})`; `AudienceDetail` takes server-assembled
  facts (`audience, account, defaultAudienceId, pinnedThreads, source`) from
  `[id]/page.tsx` — the server component assembles ALL facts; client only acts.

## Known debt / findings on this surface

- 🔴 **`audience-reads.tsx` is ORPHANED** — zero importers since P2 of the rebuild
  deleted `audience-workspace.tsx`; its test runs green against nothing
  (the accomplice pattern). Re-wiring is a PRODUCT decision: P3 made default Reads
  single-audience, so two-sided divergence data now only accrues via explicit Compare.
  Options: delete it + its test, or re-frame as per-audience read history. An "insights"
  section on the detail page is an obvious candidate for the rework — decide with owner.
- The composition bar (`audience-composition-bar.tsx`) encodes persona share ×
  temperature-as-brightness — deliberate (accent ban on rows); it reads cryptic without
  its persona-count neighbor. Fair game to redesign; keep the no-accent rule.
- `PopulationField` (detail hero) is deterministic seeded SVG — byte-identical across
  renders, locked by test. Redesign allowed; keep determinism (no Math.random/Date.now).
- Compare mode lives on the list page (selection checkboxes + READING_CARD panel) —
  untouched by #333, visually the weakest remaining piece of the list page.
- IG/YT accounts are analytics-only (calibration is TikTok-only) — the detail page's
  account-only variant must keep saying so.

## Parallel lanes — DO NOT COLLIDE

- **`~/virtuna-audience-ui`** (branch `design/ambient-audience-ui`, dev :3050, commit
  `22ba99e2`, awaiting owner review, no PR): reworks the ambient ROOM 3-view
  (brain/people/population) in `src/components/audience-lens/*`. Different files from
  the manager surface (`src/components/audience/*`), but the same design language —
  if both merge, reconcile color rules ("cream is the room, coral is where you lose
  them" per its memory).
- Grounding corpus-as-a-service sessions are active on chat/tools files — no overlap
  with this surface.

## Verification protocol (what worked this session)

- New worktree: `git worktree add ../virtuna-<name> -b design/<name> origin/main`,
  then `pnpm install` AND **copy `.env.local` from trunk BEFORE starting the dev
  server** (env loads at boot).
- Dev server: pick a free port (`lsof -ti tcp:3000` — 3000/3050 may be other lanes);
  detach via the `os.fork()+setsid` python snippet (memory `dev-server-launch`),
  2GB heap. It dies occasionally — recheck the port before every shoot.
- Screenshots: raw Playwright borrowing `~/virtuna-brain/node_modules/playwright`
  (worktrees don't ship it). **The app scrolls in an inner div ⇒ `fullPage` captures
  only the viewport — use a tall viewport (height 3400)** for full-page shots.
  Login `e2e-test@virtuna.local` / `e2e-test-password-2026` (@zachking TikTok+IG
  seeded). Harness examples died with the worktree — trivial to rewrite (goto /login,
  fill, submit, goto page, screenshot with `animations:'disabled'`).
- Tests: `node ./node_modules/vitest/vitest.mjs run` (npm test prints FAKE results);
  audience suites: `… run src/components/audience/__tests__`. tsc: `npx tsc --noEmit`.
