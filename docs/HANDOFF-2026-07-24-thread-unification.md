# Handoff — Unified thread model (ambient-v2)

**Date:** 2026-07-24 · **Branch:** `design/ambient-audience-v2` → merged to `main`
**Commits:** `37ef2728` (render unify) · `5ed4309c` (ambient ledger) · `919bfca0` (review fixes) · merge of `origin/main` `46f5887b` (mobile room)
**Status:** ✅ Shipped, live-verified, full suite **4451/0**, tsc 0, eslint 0 errors (3 pre-existing composer warns).

## What was done — in one line

Made every skill render in **one persistent, continuing thread** (ChatGPT/Claude-style): text + skill cards render together, survive reload, and survive skill-switching. Fixes the owner's report — vanishing text beside cards, reloads dropping history, skill-switch hiding prior cards.

## The problem (root cause)

The thread **write** path was already unified — every skill (chat, ideas, hooks, script, remix, test/card, account, profile, explore) writes typed blocks to one `messages` table via `insertMessage`. But the **read** path shredded the flat message list into per-skill buckets in `composer.tsx` `loadPersistedBlocks` and rendered only the `activeTool`'s bucket. So on reload/switch only the active skill's cards painted; markdown text and `video-test-card`/`account-read` (not in any bucket) vanished entirely.

## The fix — one ordered-turn stream owns history

- **`src/components/thread/persisted-thread-stream.tsx` (NEW)** — the single persisted-history renderer, ungated by `activeTool`. Renders `orderedTurns(messages)` (from `rehydrate-thread.ts`) through the type-complete `MessageBlocks` registry (all 17 block types), so nothing can vanish.
- **Card CTAs ride React context** (`useOnTestHook`/`useOnWriteScriptHook`/`useOnTestScript`/`useOnDevelopRemix`/`PlatformContext`, all with prop fallback). Lifted those 5 providers to the composer's `threadContent` root, so any card rendered via `MessageBlocks` keeps its "Test full →"/"Develop →" action. **This is the whole enabler.**
- **Per-skill views became live-only** — their gates dropped the `|| persisted*Blocks.length>0` clause; `persistedBlocks={[]}` passed. `ChatThreadView` reduced to its live turn + follow-up chips (keeps `persistedTurns` only for chip keying).
- **Swap-on-switch effect** (composer, after the chat `isDone` swap) — leaving a skill with a completed non-streaming run folds its cards into `persistedChatTurns` (`reloadChatThread`) + resets that stream, so an in-session switch keeps the cards.
- **Ambient ledger unified** — `buildAmbientDescriptors(ledger: unknown[])` now takes ONE flat array `[...persistedFlatBlocks, ...activeStreamCards]` instead of a per-tool pick (which undercounted mixed threads). `PersistedThreadStream` anchors at base 0; live views base their streaming cards at `persistedFlatBlocks.length`. So each card's `data-card-id` == its ledger id and the scroll-spy tracks persisted cards (they had no anchors before).
- **Review follow-ups (`919bfca0`)** — three callers still wrote to retired buckets nothing renders: `handleDevelopRemix` (Remix→hooks, no SSE) and `reloadProfileThread` now also refresh `persistedChatTurns`; Explore's persisted `outlier-grid` stays in `ExploreThreadView` (its Remix/Track handlers ride props, not context) and is filtered out of the unified stream + ledger so indices stay aligned.

## 🔑 Invariants — do NOT break

- `hasThread` must keep meaning "real content exists" — **never add `show*View` terms** (documented regression). `persistedChatTurns.length>0` is now a term.
- The **rail gate** (`onEngagedChange`) stays SEPARATE from `hasThread` — never merge (prior regression).
- The ambient ledger index **includes non-card blocks** (markdown consumes an index) so ids stay aligned with the rendered DOM. Off-by-one = the #306 failure class. Guard: `ambient-card-anchors.test.tsx` (off-by-offset lock spans PersistedThreadStream + live view).
- `orderedTurns` puts the user question in `turn.userTurn` (bubble), assistant blocks in `turn.blocks`. The ledger flat = assistant blocks across turns, NOT user turns.
- `outlier-grid` is deliberately filtered out of `persistedStreamTurns`/the ledger and rendered only in `ExploreThreadView`.

## Verified live (browser, real data + one billed hooks run)

- Mixed thread (3 hook cards + co-pilot line + 4 chat Q&A turns) rehydrates **all 11 blocks** — old code showed only the 3 cards.
- Live hooks run → switch to Ideas → cards **persist**, rendered once, anchors aligned (`hook-0/1/2`).
- Full page reload rehydrates the freshly-run thread.

## What's left (for future sessions)

1. **Phase 5 — dead-code cleanup (optional, low value).** The per-type bucket state (`persistedIdeaBlocks`, `persistedHookBlocks`, `persistedScriptBlocks`, `persistedRemixBlocks`, `persistedChatBlocks`, `persistedProfileBlocks`) is now unused for rendering but still SET in `loadPersistedBlocks` and referenced by `hasThread` + the reload helpers. Deleting it touches the rehydration path, so modest risk — left intact on purpose. `persistedExploreBlocks` is still LIVE (Explore uses it). Also dead: the `hasPersistedContent`/"Earlier" branches in the 4 generative thread-views (composer always passes `persistedBlocks={[]}`).
2. **Minor UX debt — swap-on-switch flicker.** On a skill switch after a completed run, the leaving live view unmounts synchronously but the fold into `persistedChatTurns` is an async `reloadChatThread` round-trip (~50–150ms), so the cards briefly disappear then reappear. Cards are never lost (data is persisted server-side). Fix if it annoys: optimistic synchronous fold, or fold on run-completion (loses the outliers offer immediately — worse tradeoff).
3. **`ambient-v2` next items** (unchanged from prior handoff): owner's threads/composer polish; composer video-Test path still navigates `/analyze` instead of sealing in-thread (see `test-vs-simulation-split`).

## Verify / run

- Dev server: `rm -rf .next && NODE_OPTIONS="--max-old-space-size=2048" NEXT_PUBLIC_AMBIENT_V2=true PORT=3007 nohup node ./node_modules/next/dist/bin/next dev -p 3007 > /tmp/dev-3007.log 2>&1 &` (nohup, NOT setsid — absent on macOS). Test user `e2e-test@virtuna.local`.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (NOT `npm test` — it's a shim). Key suites: `persisted-thread-stream`, `chat-thread-view`, `ambient-descriptors`, `ambient-card-anchors`, `composer`.
