# Handoff — Grounding fan-out SHIPPED + live-verified (2026-07-12, lane explore-a)

## What shipped
**PR #247** (squash `2eb9e5c0` on main, 2 logical commits) — the grounded-generation fan-out:

1. **Stream-drop bugfix** — the routes' `content` SSE event and the `use-*-stream` hooks rebuilt
   card props field-by-field and silently dropped `proof`: a grounded run's receipts only appeared
   after a full page reload. Neither `/dev/cards` (fixtures render directly) nor the persisted path
   (props pass verbatim) could catch it — only a flag-ON live run through the real UI did.
   Fix: `proof` streams WITH the card face on all three routes; `parseProofProp` (blocks.ts) is the
   client-side safeParse so a malformed wire receipt degrades to an ungrounded card, never a crash.
2. **Spine-order bugfix** — `mergePlan` (progress-checklist.tsx) appended off-plan live stages at the
   END, so the env-gated "Finding proven outliers" stage drew at the bottom of the loading spine
   while it was the phase actually running FIRST. Off-plan stages that fire before any in-plan stage
   now PREPEND in emit order (2 tests lock it).
3. **Ideas + Script grounded** (§11f fan-out), each behind its own OFF-by-default env flag —
   `GROUNDING_IDEAS_ENABLED` / `GROUNDING_SCRIPT_ENABLED` (mirrors `GROUNDING_HOOKS_ENABLED`):
   - `src/lib/grounding/gather-for-run.ts` — the ONE shared runner-side gather (gate → scrape →
     extract → format), degrade-safe; hooks-runner refactored onto it (byte-equivalent).
   - `src/lib/tools/runners/build-proof.ts` — shared `buildProofFromSource` + `coerceSourceIndex`
     (attribution honesty rules can't drift per skill); `buildHookProof` re-exported for tests.
   - Grounded-ONLY output contracts add `sourceIndex` per idea / per script (ungrounded contracts
     byte-identical → warm cache + regression gate). Proof attached at BUILD, schema-validated.
   - `src/components/thread/proof-receipt.tsx` — `HookProofReceipt` extracted from hook-card-block
     as the shared `<ProofReceipt/>`; mounted on idea + script card faces. `/dev/cards` fixtures
     show grounded variants for all three skills.
4. **Remix deliberately NOT wired** — it already decodes a REAL source video: `sourceDecode` + cover
   ARE its receipt. `AdaptInput` 1→N (remix-from-topic, no URL) is a separate product path touching
   the D-05a-isolated engine adapt chain → deferred, own milestone.

## Live-verify evidence (flag-ON, real Apify + Qwen + prod writes)
| Run | Result |
|---|---|
| Hooks "high protein breakfast ideas" (UI) | 5 new `outlier_teardowns` rows; 5/5 hooks attributed (@polish1990 145×/2M, @nourish.me.now 277×/4.3M); receipts browser-verified w/ covers + [var] template chips |
| Ideas "meal prep for busy professionals" | 6 new rows; 4/4 attributed (@i.am.layann 43.6×, @basicallymrsb 42.7×); retry run 3/4 + one honest null (honest-mixed holding) |
| Script "5 minute high protein breakfast" (UI) | Receipt **streamed live, NO reload** (@clipzi.recipe 16.6×), cover painted, spine order correct |

Prod corpus: 1 → **13 rows** (project `qyxvxleheckijapurisj`, `outlier_teardowns`).
Gates: tsc 0 · 216 tests green (runners, grounding, thread components, /dev/cards drift, reskin-matte) · Vercel preview green.

One transient: the first UI ideas run errored ("generation dropped out") — a real DashScope hiccup,
honestly surfaced by the error block; its extraction also wrote 0 rows. Retry succeeded. Not a code bug.

## Environment state (IMPORTANT)
- `~/virtuna-explore-a/.env.local` has **all 3 `GROUNDING_*_ENABLED=true`** — LOCAL ONLY. Every local
  hooks/ideas/script run now scrapes+extracts (~40–70s + Apify cents). Remove/comment to run cold.
- **Prod flags UNSET** → prod generation still cold. Flipping = 3 env vars in Vercel + redeploy
  (owner gate). Recommendation: hold until cache read-back lands (below) so prod runs aren't paying
  a fresh scrape per topic.
- Separate standing P0 (unrelated): `CRON_SECRET` missing in Vercel → 32 crons 401 (see
  memory `vercel-crons-dead-401`). One Vercel visit covers both env edits.

## Gotchas (re-confirmed this session)
- **Stale `.next` dev cache**: after editing client stream hooks, a plain server restart served the
  OLD client bundle (receipts invisible live, fine after reload → looked exactly like a code bug).
  `rm -rf .next node_modules/.cache` before browser-verifying client changes.
- `innerText` probes: the receipt label renders `text-transform: uppercase` → probe "PROVEN
  STRUCTURE" or use the `aria-label` attribute (not transformed).
- vitest: `node ./node_modules/vitest/vitest.mjs run <paths>` (npm shim prints fake PASS).
- tsc: `NODE_OPTIONS=--max-old-space-size=4096 node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.
- dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3001` (lane-a port).
- `/dev/cards` login: `e2e-test@virtuna.local` / `e2e-test-password-2026`.

## NEXT SESSION — embeddings + teardown cache read-back (the walk-many unlock)
Today every grounded run re-scrapes. The corpus caches teardowns (dedup `UNIQUE(platform,
platform_video_id)`) but **nothing reads it back** — `embedding` is written NULL
(`src/lib/grounding/corpus.ts:18` says so) and the `match_shared_teardowns` /
`match_personal_teardowns` RPCs (live in prod, 768-dim HNSW) have no producer.

Build (design already LOCKED in `docs/GROUNDED-GENERATION-VISION.md` §13):
1. Embedding producer = **Qwen/DashScope `text-embedding-v3`, dims 768 — NOT gemini** (owner
   corrected this once already; both shipped gemini embedders are dead/deferred).
2. Fill `embedding` at cache-write in `corpus.ts` + backfill the 13 existing rows.
3. Retrieval-first gather: embed the query → `match_*` RPCs (shared+personal unioned/weighted in
   TS) → if yield ≥ N good rows, SKIP the scrape (instant + free); else scrape as today and write
   through. This is gather-once/walk-many — the per-run cost story that gates the prod flag flip.
4. `hookTemplate` first-class column rides along (today it lives in teardown raw JSONB only —
   read-back needs it queryable; small migration).
5. Freshness policy for cached teardowns (staleness window / `refreshed_at`) — decide cheap.

References: memory `grounded-generation-vision` (updated w/ this session) · SSOT
`docs/GROUNDED-GENERATION-VISION.md` §11f/§13 · `src/lib/grounding/*` · prior handoffs
`docs/HANDOFF-2026-07-10-grounded-generation-session4-shipped.md`.

Backlog after that: Remix 1→N · 3-beat streamed reveal · audience-prune real fit (fitLabel still
defaulted 'adjacent') · IG provider · prod flag flip (owner).
