# Handoff — Grounded Generation, session 4 (SHIPPED, 2026-07-10)

## What shipped this session
Session 3 built the grounded-generation subsystem + wired Hooks behind an OFF flag + live-verified
the gather path. **Session 4 made the payoff VISIBLE on the card** and shipped the whole milestone to
`main`.

Three commits on top of session 3, then the milestone was rebased clean onto `origin/main` and merged:

1. **Receipts-on-cards** (`§11f`) — a grounded hook now shows *which* proven outlier its structure was
   drawn from. Fixed the attribution gap: the runner discarded the `RetrievedExample[]` right after
   `formatCorpusForPrompt`, and the JSON contract never captured which example each hook used.
   - `blocks.ts`: `HookProofSchema` + optional/nullable `proof` on `HookCardBlockSchema` (absent on
     ungrounded/unattributed hooks → byte-identical to the pre-grounding shape → regression gate).
   - `hooks-runner.ts`: grounded-ONLY output contract adds `sourceIndex`; examples retained;
     `buildHookProof` maps `sourceIndex → RetrievedExample → proof`. Ungrounded contract kept
     byte-identical (warm cache). Honesty spine: no source / out-of-range / handle-less → no receipt.
2. **Thumbnail + stats** — the receipt became a real teardown card: video cover + stats + video link.
   `coverUrl` was scraped + DB-written but dropped from `RetrievedExample`; carried it through.
3. **Sandcastles-style redesign (Option A, owner-chosen)** — the proof block now matches the
   Sandcastles/Stanley card in our matte system:
   - **Template-with-variables**: new extraction field `hookTemplate` = the source hook generalized
     into a fill-in-the-blank with `[bracketed variables]`; renderer styles each `[var]` as a distinct
     chip (brightness, not hue — near-zero accent). The written-out hook stays the card's HERO; the
     proof block is the reusable STRUCTURE + receipt.
   - **Prominent, reliable thumbnail**: 9:16 `w-16` cover; a missing/expired cover collapses to a
     **play-tile placeholder** (never an empty/broken box) so a grounded card always shows a video tile.
   - **Colored stat pills**: `↗ multiplier` (`--color-positive`) + `👁 views` + source archetype pill
     (e.g. "Trap Mistake"), phosphor `Eye/Play/TrendUp`.

`hookTemplate` persists inside the existing teardown raw JSONB — **no migration** (a first-class column
lands with the deferred cache read-back).

**Verified**: tsc 0; 117 grounding/hook/tools/assembler/matte tests green; browser-verified on
`/dev/cards` (card #1 real cover + templated chips + green multiplier; card #2 no-cover play-tile
fallback). **Flag still OFF** (`GROUNDING_HOOKS_ENABLED`).

## Merge mechanics (important for the next session)
The branch `milestone/grounded-generation` was cut off `lane/explore-b`, whose base commits were
already **squash-merged** to main (#210/#211/#212 etc.) with different SHAs. A naive PR would have
ballooned to 64 files. Fix applied: `git rebase --onto origin/main 3e7f29ea` replayed ONLY the 15
grounding commits onto the current `origin/main` (`cc401ac2`). Result = a clean 26-file PR
(grounding subsystem + hook card + docs + migration), zero conflicts. Backup ref:
`backup/grounded-gen-preship`.

## STILL OFF / grounded-generation backlog (each separable)
- **Live-verify with the flag ON** — flip `GROUNDING_HOOKS_ENABLED=true`, run one real TikTok hooks
  query → see the receipt on a live-generated card. Costs Apify/LLM + writes a prod row. Owner gate.
  Re-run the harness: `npx tsx scripts/verify-grounding.ts "<query>" <topN>`.
- **Fan the `corpus` field to Ideas + Script** (same 1:1 pattern) + generalize **Remix** `AdaptInput` 1→N.
- **Qwen `text-embedding-v3` (dims 768)** → fill `embedding` at cache-write + light up the vector
  match RPCs = the walk-many cache payoff. (We are Qwen/DashScope ONLY — NOT gemini.)
- **Audience-aware prune** (§11c stage 2) → the REAL per-request fit label (today defaulted 'adjacent').
- **3-beat streamed reveal** (§11) — net-new plumbing, LAST.
- **`hookTemplate` first-class column** + cache read-back mapping (rides with embeddings).
- Coverage decision (LOCKED): **honest-mixed** — a receipt appears only when a real source is
  attributed; ungrounded hooks stay clean. No forced/loose attribution.

## NEXT SESSION FOCUS — "refine every card to best-possible" (owner-requested)
Do a dedicated UI/UX pass across ALL thread card types. They were elevated in prior milestones
(`skill-cards-ui-refinement`, `premium-design-elevation`) so this is refinement, not from-scratch.
The `/dev/cards` gallery (`src/app/(app)/dev/cards/`) renders every card 1:1 with the real
components + fixtures — use it as the review surface (dev-only, URL `/dev/cards`; log in with the e2e
user). Card renderers live in `src/components/thread/*-block.tsx` + `*-thread-view.tsx`.

Inventory to review + refine:
- `idea-card-block` · `hook-card-block` (just redesigned — set the bar) · `script-card-block`
  · `remix-card-block` · `chat-thread-view` (Ask) · `explore-thread-view` (outlier grid)
  · `account-read-block` · `reading.tsx` (Test surface) · `profile-read-block`
  · `reaction-distribution-block` · `prediction-gauge-block` · `multi-audience-read-block`
  · `band-block` · `markdown-block` · `personas-block` · `outlier-grid-block`.

Suggested method (per card): open in `/dev/cards`, check against the design system
(`docs/DESIGN-SYSTEM.md` — flat-warm charcoal, 6% borders, 12px card radius, Inter chrome,
Newsreader for voice-moments, near-zero accent dosage), and the new hook proof card as the quality
bar. Look for: hierarchy (one hero, one proof, one forward action), consistent eyebrow/pill/stat
styling, spacing rhythm, honest signals only, mobile width. Guard: keep `reskin-matte` green (no
coral/glass) + the `/dev/cards` drift test green. Ship small per-card PRs, not one mega-diff.

Gotcha: the `/dev/cards` gallery has always-on shimmer/count-up animations → Playwright screenshots
time out on "element stable". Inject `*{animation:none!important;transition:none!important}` before
element screenshots, or verify via `browser_evaluate` DOM reads (naturalWidth>0 = painted).

## Unrelated WIP (NOT part of this milestone)
Two files were dirty in the worktree the whole milestone — an in-progress **Maven logo redesign**
(serif Newsreader wordmark + new `vertical` orientation): `src/components/brand/maven-logo.tsx`,
`src/app/(onboarding)/layout.tsx`. Kept OUT of the grounded-generation merge (branding, not grounding).
Stashed as: `git stash list` → "wip: maven-logo serif + vertical". Restore with `git stash pop` and
decide separately.

## Resume
- SSOT design: `docs/GROUNDED-GENERATION-VISION.md` (§0–15, LOCKED). Memory: `grounded-generation-vision.md`.
- Env present: `APIFY_TOKEN`, `DASHSCOPE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- tsc: `NODE_OPTIONS=--max-old-space-size=4096 node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- tests: `node ./node_modules/vitest/vitest.mjs run <path>` (npm shim prints fake PASS(0)).
- dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev` (direct node, not npx).
