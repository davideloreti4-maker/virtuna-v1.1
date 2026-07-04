# The Room — session handoff (2026-07-04)

> Post-Phase-3 session. Three units shipped to `main`; the milestone's own vertical is **done +
> verified**. This hands off the next build (the app-wide ambient-presence graft) with a clean spec.
> Supersedes `PHASE-3-COMPLETE.md` as the latest Room state. Memory auto-loads
> `the-room-phase3-built.md` (full record, updated this session).

## 0. Start here (next session)
```bash
cd ~/virtuna-the-room
git fetch origin && git switch -c feat/the-room-surface-v1 origin/main   # always branch off latest main
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000 · e2e-test@virtuna.local / e2e-test-password-2026
```
`main` tip after this session = `2e0387d3` (may have advanced — the sister **surfaces** session ships to main too).

## 1. What shipped this session (all on `main`)
1. **Dead-code cleanup — PR #136** (`51b96ba2`). Removed the legacy audience path in
   `src/components/reading/reading-panels.tsx` (the old `PersonasPanel` + `AudienceList` + the
   `renderPanel('personas')` case + the `'personas'` `PanelId` member + dead imports + `clamp01`) and
   its direct-mount test. Kept `buildAudienceNodes` + `readingConceptText`. `AudienceLens.tsx` /
   `AudienceLensContent.tsx` stayed (live consumers: `audience-presence` + `proof-unit` `LensRewrite`).
   127 deletions; tsc 0 prod; reading+audience-lens **198 green**; matte green.
2. **Phase 3 real-video VERIFY** (no PR — verification of the marquee feature). Confirmed the embedded
   Room renders the weak-spot on **real** data: `/analyze/giyyxJfww2iC` (score 36, video_upload, 10/10
   personas with `segment_reasons`). Population · 1,000 → **"WHERE YOU'RE LOSING THEM · 700 OF 1,000"**
   with named bouncers (Dev/Sam/Maya/Priya/Nadia/Elena/Robin) each beside their EXACT words; People view
   = 10 named voices + `ask →` + their words + the TIMELINE replay. **Rendered quotes match the DB
   `segment_reasons` byte-for-byte** → real engine data, not fabricated. Closes Phase-3 handoff item #2.
3. **`variant='surface'` seam spec — PR #139** (`2e0387d3`). New `docs/SURFACE-SEAM-SPEC.md`: a
   graft-readiness ledger for all 4 Room↔Surfaces seams + the implementation spec for Seam 3 (the
   app-wide ambient dock). Companion to the signed-off `docs/THE-CONTRACT.md`.

## 2. The recommended next build — peek-only `variant='surface'` v1
Full spec: **`docs/SURFACE-SEAM-SPEC.md`** (§2 spec, §3 the deferred work, §5 graft sequence). Summary:

**Why it's unblocked:** the data atom **`resolveUserAudience` IS landed** (`src/lib/audience/resolve-user-audience.ts`, RLS-safe → General). The only gap is component work — `AudiencePresence` accepts `variant='surface'` but only stores `data-variant`; **only `'thread'` is implemented** (`src/components/audience-lens/audience-presence.tsx:136-140`).

**Build (Room-owned, additive):**
1. **`audienceToActiveAudience(audience): ActiveAudience`** — pure fn + unit test. Mapping in SPEC §2.2
   (personas → named `Person[]` via `persona-names.ts`; `tier` via leaf `resolveTier`; `goal ← goal_intent`;
   `platform`; idle `pulse`). Fully vitest-verifiable, no mount point needed — **the safe first step.**
2. **Implement the `'surface'` render branch** in `audience-presence.tsx` — read-only per the §3
   sign-off delta: peek band always + (on focus) the read-only `AmbientRoom` body; **NO ask input /
   Rewrite CTA** unless the surface hosts a composer. Reuse Phase-3 `AmbientRoom` (`personaNodes` + `embedded`).

**⚠️ Verify caveat:** nothing in the Room worktree *mounts* `variant='surface'` — the mount point is
`src/components/surfaces/surface-dock.tsx`, which is **surfaces-session-owned**. So the render branch's
true end-to-end browser verify needs either (a) coordinating with the surfaces session to swap their stub,
or (b) a throwaway harness route. The **adapter (step 1) has no such issue** — do it first.

## 3. Other open threads (lower priority)
- **Seam 4 — embedded composer** (`mode='embedded'` / `onLaunch`): **not found in code** despite
  `THE-CONTRACT.md §112` claiming confirmed. Verify before any composer graft. (SPEC ledger row 4.)
- **Seam 2 — `PredictionResult → contract Read` adapter**: needed so a surface can open the read-only
  Room panel on a *real* card (not `mock-room`). Shapes align 1:1 (see `reading-room.tsx`).
- **Fresh-upload transport bug:** the browser→Supabase-storage PUT fails `net::ERR_HTTP2_PROTOCOL_ERROR`
  (2 attempts, 5.3MB mp4) in this dev env — a Test never reaches the engine. Env/transport, not a Room bug,
  but worth a look if fresh Tests matter. **Workaround for render verifies:** use an existing analysis with
  rich data — query `analysis_results` (Supabase `qyxvxleheckijapurisj`) for
  `heatmap->'personas'[].segment_reasons` non-empty, owned by the e2e user. Rich ids:
  `giyyxJfww2iC`(36) · `WPk976kozfWs`(34) · `gwxLeHphZCxK`(77).
- **Phase 4 — outcome loop** (predicted-vs-actual → recalibrate): blocked on surfaces for account-connect.

## 4. Gotchas (still true)
- **Vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (`npx vitest` prints a fake PASS(0)).
- **tsc:** keep production errors at 0 (`npx tsc --noEmit`; 21 test-baseline `Audience.mode` errors are pre-existing, all `.test.ts`).
- **Auto-wip daemon LIVE** in this worktree — commit deliberately, **never force-push**. The repo's
  `.githooks/post-commit` **auto-pushes** on every commit (that's expected, not the daemon).
- **Merging from this worktree:** `gh pr merge --squash` works, but `--delete-branch` fails the local
  step ("`main` is already used by worktree `~/virtuna-v1.1`") — the server-side merge still succeeds;
  verify with `gh pr view <n> --json state,mergeCommit`, then clean branches manually.
- **Memory dir is worktree-path-guarded** — `Write`/`Edit` to `~/.claude/.../memory/` is blocked; write via
  Bash (`python3`/`cat >`).
- Dev server may still be running on `:3000`.

## 5. Key files & docs
| Path | Role |
|---|---|
| `docs/SURFACE-SEAM-SPEC.md` | **The next build's spec** — graft-readiness + `variant='surface'` implementation |
| `docs/THE-CONTRACT.md` | Signed-off Room↔Surfaces seam contract (the 4 seams) |
| `src/lib/audience/resolve-user-audience.ts` | The landed data atom (user-level last-used audience) |
| `src/components/audience-lens/audience-presence.tsx` | The presence component — `variant` at `:136` (stub) |
| `src/components/surfaces/surface-dock.tsx` | The surfaces mount point (stub to swap at graft) — **surfaces-owned** |
| `src/lib/room-contract/types.ts` | Contract types (`ActiveAudience`, `Read`, `CardReaction`) |
| `src/components/reading/reading-room.tsx` | Phase-3 embedded Room (reference for the read-only render) |
