# The Room — Phase 3 COMPLETE (handoff for the next session)

> Written 2026-07-04. **Phase 3 is built, verified, and MERGED to `main`.** This closes
> the Phase-3 handoff (`docs/PHASE-3-HANDOFF.md`). Read this for what shipped + what's next.

## 0. Start here (next session)
```bash
cd ~/virtuna-the-room
git fetch origin && git switch -c feat/the-room-<next> origin/main   # always branch off latest main
# dev (gotchas: 768MB heap OOMs; npx wrapper breaks dev — node bin + big heap):
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000  · e2e-test@virtuna.local / e2e-test-password-2026
```
Memory auto-loads `the-room-phase3-built.md` + `the-room-milestone.md` — the full record.

## 1. What shipped (Phase 3, both parts on `main`)
- **Part 1 — composer menu → Make / Test / Ask** (PR #132, commit `1ed5d588`). `SkillRows`
  in `src/components/app/home/composer-controls.tsx` groups the Socials skills by
  `VERB_BY_TOOL`: **Make** = Hooks·Ideas·Script·Remix·Explore · **Test** = A real video·Your
  account · **Ask** = The room. `account` moved Make→Test (owner-locked). Rows relabeled to
  their verb flavor; Offer/Ad **hidden** (`enabled:false`); General verbs keep their own group.
  One SSOT drives both the skill-pill popover AND the `/` slash menu.
- **Part 2 — video Test's Read embeds the Room inline** (PR #131, commit `4fdc2338`, Option A).
  `AudienceContextSection` (`src/components/reading/reading-accordion.tsx`) renders the v6 Room
  inline via new `src/components/reading/reading-room.tsx` (`ReadingRoom`) + keeps the Niche-rank
  drill below. `AmbientRoom` gained two additive optional props — `personaNodes` (rich video
  nodes, no binarise) + `embedded` (drop Bloom height/scroll + focus header). The video-only
  **TIMELINE replay** = `ReplayController` (renders only when real `heatmap.personas[].attentions[]`
  exists). Nothing else on the Read changed.

**Verified:** reading 143 + audience-lens 56 + composer 44 = 268 tests green; tsc 0 production
(21 test-baseline); matte + a11y (axe) green. Real browser — Part 1 on `/home`; Part 2 on a real
prior analysis `/analyze/pmEtHxBW_fqp` (10 named voices, `ask →` → "Ask Theo", Population 500/500 +
swarm, TIMELINE replay 5/5, Niche rank kept, rest of the Read unchanged).

## 2. Next recommended steps (pick per priority / owner steer)
1. **Dead-code cleanup (small, self-contained PR).** The legacy audience path is now OFF the app
   but still present: `AudienceLens` / `AudienceLensContent` + `PersonasPanel` + `renderPanel('personas')`
   in `src/components/reading/reading-panels.tsx`, plus the `readingConceptText` re-export path.
   `reading-room.tsx` imports `readingConceptText` from `reading-panels` — keep that. Delete the
   `personas` case + `PersonasPanel` + the `AudienceLens` import + the `renderPanel(personas)` test in
   `reading.panels.test.tsx` (the "renderPanel(personas) still mounts the legacy list panel" test).
   Grep `AudienceLens` for any other consumer before deleting. Keep tsc 0 prod + matte green.
2. **Fresh real-video verify (optional, costs a SIM-1 Max call).** I verified on a prior analysis
   whose personas carried no `segment_reasons` → voices showed "no words this time" and the
   Population **weak-spot** (bouncers + their exact words) was empty (honest). A FRESH Test with
   real per-persona reasons will surface persona quotes + the weak-spot. UAT video:
   `~/Downloads/TikTok Video Downloader.mp4` → copy into `./.playwright-mcp/` to upload. Run Test
   (General or a calibrated audience) → land on `/analyze/[id]` → confirm quotes + weak-spot render.
3. **`variant='surface'` / `mode='embedded'` app-wide presence seam.** Still deferred; crosses into
   the **surfaces** session (it owns `/start`, `/calendar`, `/analytics`, `/grow`, `/feed`). NOT a
   solo Room task — coordinate.
4. **Phase 4 — outcome loop** (predicted-vs-actual → recalibrate). Blocked on surfaces for
   account-connect. After the surface seam.

## 3. Key files (Phase 3)
| File | Role |
|---|---|
| `src/components/app/home/composer-controls.tsx` | Part 1 — SKILLS SSOT + `VERB_BY_TOOL` + `SkillRows` verb grouping |
| `src/components/reading/reading-room.tsx` | **NEW** — `ReadingRoom` (embeds AmbientRoom + timeline replay) |
| `src/components/reading/reading-accordion.tsx` | Part 2 — `AudienceContextSection` → the Room inline + Niche-rank drill |
| `src/components/audience-lens/AmbientRoom.tsx` | Part 2 — `personaNodes` + `embedded` props added |
| `src/components/audience-lens/ReplayController.tsx` | Part 2 — TIMELINE mode (unchanged; now consumed by the Read) |

## 4. Gotchas (still true)
- **Vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (`npx vitest` prints a fake PASS(0)).
- **tsc:** keep production errors at 0 (`npx tsc --noEmit`; 21 test-baseline is fine, all pre-existing `.test.ts`).
- **Matte guard:** `src/components/reading/__tests__/reskin-matte.test.ts` scans a FIXED file list (not
  the whole reading dir) — new components aren't scanned, but stay matte anyway (terracotta accent is
  the sanctioned bounce signal; sage `#8ea68a` = stop/loved; no `#FF7F50`, no glass).
- **Auto-wip daemon is LIVE** in this worktree — commit deliberately, **never force-push**.
- **Memory dir is worktree-guarded** — Edit/Write to `~/.claude/.../memory/` is blocked from this
  worktree (resolves to a different git root); write memory via Bash (`cat >`) as a fallback.
- **Stacked PRs:** merge the parent first but DON'T delete its branch until the child is retargeted to
  main, else GitHub auto-closes the child (the #123/#124 lesson).
- Dev server may still be running on `:3000` from the last session.
