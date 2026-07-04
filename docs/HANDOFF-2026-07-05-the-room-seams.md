# The Room — session handoff (2026-07-05): seam vertical COMPLETE

> This session shipped the **Room↔Surfaces seam vertical**: all three data-seam producers + the
> read-only app-wide presence, and verified/corrected the fourth seam. Every unit merged to `main`.
> Supersedes `HANDOFF-2026-07-04-the-room.md`. Memory auto-loads `the-room-phase3-built.md` (full record).

`main` tip after this session = **`c2acc27e`** (the sister **surfaces** session ships to `main` too, so it may have advanced — always branch off the latest).

## 0. Start here (next session)
```bash
cd ~/virtuna-the-room
git fetch origin && git switch -c <your-branch> origin/main
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000 · e2e-test@virtuna.local / e2e-test-password-2026
```
**READ FIRST:** `docs/SURFACE-SEAM-SPEC.md` (the graft-readiness ledger — now all four rows current) +
`docs/THE-CONTRACT.md` (the signed-off seam contract; §112 was corrected this session).

## 1. What shipped this session (all merged to `main`)
Four units, each its own clean PR (small-PR-per-seam; the auto-wip daemon is LIVE in this worktree):

| # | Unit | Files | PR | Merge |
|---|---|---|---|---|
| **Seam 3** | `audienceToActiveAudience` adapter **+** read-only `variant='surface'` render branch | `src/lib/audience/audience-to-active.ts` (+test) · `src/components/audience-lens/audience-presence.tsx` (+6 tests) | #142 | `ac68ea9b` |
| **Seam 2** | `predictionResultToRead` adapter | `src/components/reading/prediction-to-read.ts` (+test) | #145 | `0da0e5cf` |
| **Seam 4** | verify — corrected the false "CONFIRMED" embedded-composer claim (docs only) | `docs/THE-CONTRACT.md` · `docs/SURFACE-SEAM-SPEC.md` | #147 | `57e7792e` |
| **Seam 1** | `readToCardReaction` adapter | `src/lib/room-contract/read-to-card-reaction.ts` (+test) | #148 | `c2acc27e` |

## 2. The four seams — FINAL status
Legend: 🟢 landed & usable · 🔴 gap / owner-decision.

| Seam | Contract type | Room-side status | The producer / component (Room owns) |
|---|---|---|---|
| **1 — Card** | `CardReaction` | 🟢 **LANDED** | `readToCardReaction(read): CardReaction` — pure, derives the glance card face from a Seam-2 `Read` (`src/lib/room-contract/read-to-card-reaction.ts`). |
| **2 — Read** | `Read` | 🟢 **LANDED** | `predictionResultToRead(data, contentId): Read` — pure, builds nodes via `buildAudienceNodes` like the Phase-3 Room (`src/components/reading/prediction-to-read.ts`). |
| **3 — Presence** | `ActiveAudience` + `AudiencePresence variant='surface'` | 🟢 **LANDED** | `audienceToActiveAudience(audience): ActiveAudience` (`src/lib/audience/audience-to-active.ts`) **+** the read-only `'surface'` branch in `audience-presence.tsx`. |
| **4 — Composer** | `Composer mode='embedded'` | 🔴 **VERIFIED GAP — owner-decision** | The real `Composer` exposes NO embedded contract (see §4 below). Not built. |

**All three DATA producers are landed on the Room side.** The surfaces now have real sources for the
card face, the Read, and the app-wide presence — the `mock-room.ts` mocks retire at the graft.

## 3. How the producers compose (the graft, for whoever mounts it)
```
resolveUserAudience(supabase, userId) ──► audienceToActiveAudience(aud) ──► ActiveAudience  (Seam 3)
PredictionResult (a real analysis) ──────► predictionResultToRead(data, id) ──► Read         (Seam 2)
                                            └─► readToCardReaction(read) ──────► CardReaction  (Seam 1)
```
- **`AudiencePresence variant='surface'`** is READ-ONLY: peek band always + (on focus) the read-only
  `AmbientRoom`; the Rewrite CTA + "type below" prompt are gated off via `isSurface`. `variant='thread'`
  is byte-identical. The mount point — `src/components/surfaces/surface-dock.tsx` — is **surfaces-owned**
  (swap `AudienceConstellation`+`MOCK_AUDIENCES` → `<AudiencePresence variant='surface'>` fed the adapter;
  SEAM-SPEC §2.4).
- A surface holding only a `PredictionResult` gets the card face via
  `readToCardReaction(predictionResultToRead(data, id))`.

## 4. Seam 4 — the one open decision (read before building)
The contract's §112 "✅ CONFIRMED" that `Composer` exposes `mode='thread'|'embedded'` +
`onLaunch(input,verb,audience)` was **FALSE** (corrected this session). Verified truth:
- `Composer` (`src/components/app/home/composer.tsx`) props = `{className?, onThreadChange?,
  onConversationChange?, onRehydratingChange?}` — no `mode`/`onLaunch`/`audience`/`seed`. It's a
  self-contained /home component (owns audience + thread create→navigate internally), mounted ONLY on
  /home, always prop-less.
- `onLaunch`/`embedded` exist ONLY in the surfaces' own files (`EmbeddedComposer` stub → a `launchThread`
  **toast**, no real routing).

**Two graft paths (owner picks):**
- **A — shared atom (a Room project):** extract an embeddable `Composer` (`mode='embedded'` +
  `onLaunch(input,verb,audience)`), decoupled from /home's thread/params/streaming. Real ~1,400-line
  refactor — deserves a FRESH full-context session. Start points: `ComposerProps` (:191), the
  `useRouter`/`useParams`/`useAnalysisStream` coupling (:206-221), the create→navigate loop.
- **B — surfaces own the embedded UI + handoff (pragmatic):** surfaces keep `EmbeddedComposer` and wire
  the real create→navigate themselves (POST create thread w/ audience+seed → `/thread/:id`); the Room
  owns only the thread destination. Closest to today's state. **No Room build required.**

## 5. What's left (none is a quick "continue")
| Next | Owner | Notes |
|---|---|---|
| Mount the 3 producers, retire the mocks | **Surfaces session** | SEAM-SPEC §2.4/§5 — their graft |
| Seam 4 | **Owner decides A/B** → then Room (A) or surfaces (B) | §4 above |
| Phase 4 — outcome loop (predicted-vs-actual → recalibrate) | blocked | needs surfaces' account-connect |

## 6. Verification standard held this session
Adapters unit-tested (13 + 10 + 8) + the surface render branch (+6 component tests) + a real-browser
pass of `variant='surface'` (throwaway harness, deleted — dock idle read-only, on-focus Population
weak-spot with the Rewrite CTA absent despite `canRewrite=true`, rail idle; 0 console errors). `tsc`
held at the **21 test-baseline** (all pre-existing `.test.ts` `Audience.mode`) throughout; production 0.

## 7. Gotchas (still true)
- **Vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (`npx vitest` prints a fake PASS(0)).
- **tsc:** production 0; the 21 `.test.ts` `Audience.mode` errors are the pre-existing baseline — don't
  chase them. A stale `.next/dev/types/validator.ts` error means a deleted dev route; `rm -rf .next/dev/types`.
- **Auto-wip daemon LIVE** in this worktree — commit deliberately, **never force-push**. `.githooks/post-commit`
  auto-pushes `origin HEAD` on every commit (expected).
- **Merging from this worktree:** `gh pr merge <n> --squash` works; **don't** pass `--delete-branch` (its
  local step fails — "`main` used by worktree `~/virtuna-v1.1`"); delete the remote branch manually with
  `git push origin --delete <branch>`. Verify with `gh pr view <n> --json state,mergeCommit`.
- **Memory dir is worktree-path-guarded** — write via Bash (`cat >>`/`python3`), not Write/Edit.
- **Fresh-upload Test is flaky here** (`net::ERR_HTTP2_PROTOCOL_ERROR` to Supabase storage) — for render
  verifies use an existing rich analysis (`analysis_results`, Supabase `qyxvxleheckijapurisj`, e2e user:
  `giyyxJfww2iC` / `WPk976kozfWs`, `heatmap->'personas'[].segment_reasons` non-empty).

## 8. Key files
| Path | Role |
|---|---|
| `docs/SURFACE-SEAM-SPEC.md` | The graft-readiness ledger — all four rows current (1🟢 2🟢 3🟢 4🔴) |
| `docs/THE-CONTRACT.md` | Signed-off seam contract; §112 corrected (Seam 4 gap) |
| `src/lib/room-contract/types.ts` | Contract types (`CardReaction`/`Read`/`ActiveAudience`/`Reaction`) |
| `src/lib/room-contract/read-to-card-reaction.ts` | Seam 1 producer |
| `src/components/reading/prediction-to-read.ts` | Seam 2 producer |
| `src/lib/audience/audience-to-active.ts` | Seam 3 producer |
| `src/components/audience-lens/audience-presence.tsx` | The presence — `variant='surface'` read-only branch (`isSurface`) |
| `src/components/surfaces/surface-dock.tsx` | The mount point (surfaces-owned — swap at graft) |
