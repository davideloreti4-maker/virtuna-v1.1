---
phase: 03-ideas-tool
plan: 04
subsystem: ideas-surface
tags: [ideas, composer, platform-chip, sse-consumer, thread-view, chain-cta, uat, bugfix]

# Dependency graph
requires:
  - phase: 03-ideas-tool
    plan: 02
    provides: "IdeaCardBlockSchema, IdeaCardRenderer, buildGroundingLine, kcStamp/KC_PROVENANCE_FIELD"
  - phase: 03-ideas-tool
    plan: 03
    provides: "runIdeasPipeline, POST /api/tools/ideas (SSE), POST /api/tools/ideas/develop, createOpenThreadLazy"
provides:
  - "Live Idea chip (tool-chips.tsx enabled:true) + SIM-1 Flash model label"
  - "platform-chip.tsx: first-class platform param (tiktok|instagram|youtube), defaults to profile platform"
  - "composer.tsx Idea routing: empty=Auto / typed=seeded → useIdeasStream.start; NEVER arms pendingNavRef (no /analyze leak)"
  - "use-ideas-stream.ts: fetch+getReader SSE consumer, content-first (faces+quote → band chip)"
  - "ideas-thread-view.tsx: streamed + (future) persisted idea-card render via MessageBlocks"
  - "Develop this → CTA: POST /api/tools/ideas/develop (anchor + platform), in-thread Hooks placeholder seam"
---

# 03-04 — Ideas surface (live chip, content-first thread view, chain CTA) + UAT

## What shipped

- **Idea chip live** (`tool-chips.tsx` `idea.enabled=true`); Hooks/Chat stay disabled (P4/P5). Model label "SIM-1 Flash".
- **platform-chip.tsx** — persistent composer chip (TikTok/IG/YT), defaults to the profile platform else `tiktok`, first-class `platform` param on every request (D-07).
- **composer.tsx routing** — `activeTool==="idea"` routes the send to `useIdeasStream.start` (empty input → Auto, typed → seeded). The Idea path NEVER sets `pendingNavRef`/`stream.start` — Test upload/URL nav stays exclusive (Pitfall 5 / WR-05). Client TikTok-URL relax is UX-only; the server route owns ask-cap validation (WARNING-5).
- **use-ideas-stream.ts** — `fetch(POST)` + `res.body.getReader()` SSE consumer (NOT EventSource — BLOCKER-1). Content-first: card faces + lead scroll-quote render first, per-card band chip fills a beat later.
- **ideas-thread-view.tsx** — mounts above the composer when an Idea run is active; renders streamed cards via `MessageBlocks`; provides `PlatformContext` to `IdeaCardRenderer`.
- **Develop this → CTA** — POSTs the pinned `/api/tools/ideas/develop` (`anchor` + `platform`), appends an in-thread Hooks placeholder ("Hooks queued — check the thread below."). Generation deferred to P4 (IDEAS-03/THREAD-05/D-15).

## UAT outcome (live browser, authed as E2E Test User, 2026-06-18)

| Step | Criterion | Result |
|---|---|---|
| 2 | Idea chip · SIM-1 Flash label · platform chip · idea placeholder | ✅ |
| 3 | Auto: no /analyze nav · legible status · 3 cards content-first · grounding line · "your take" badge · expand (mechanism/seed/topic/take/format) · band chip (verdict · N/10 stop · SIM-1 Flash) | ✅ |
| 4 | Seeded: cards generated on-topic (protein/gym myths) | ✅ |
| 5 | Reload rehydration | ⏸ DEFERRED to P4 (see below) |
| 6 | Develop this → : /develop 200, in-thread Hooks placeholder seam | ✅ |
| 7 | No Test-flow leak (never navigates to /analyze) | ✅ |

Pipeline latency: ~100–120s per run (Qwen reasoning model, text path) — acceptable for v1; a perf pass is a later concern.

## Bugs found and fixed during UAT (committed with this plan)

1. **/home hang (regression).** A duplicate `'use client'` `src/lib/tools/block-registry.tsx` (auto-wip 2026-06-17 22:49–22:50) shared the `@/lib/tools/block-registry` specifier with the canonical `.ts`, re-exported `validateBlock` from `./block-registry` (resolving back to itself → `undefined`), and pulled client-only renderers into the shared module graph that `/home`'s composer and server-side `messages.ts` both import. Its only export (`BLOCK_COMPONENT_REGISTRY`) was imported nowhere. **Deleted the dead `.tsx`.** (Misdiagnosed as a network issue earlier — it was code.)
2. **Dev shim killed LLM calls.** `scripts/dev-fresh-conn.cjs` (a local network workaround added for the misdiagnosed hang) set undici `headersTimeout: 30_000`. Qwen buffers the full generation before sending headers, so every model call died at 30s. **Raised to 300s / body 600s** to cover generation latency.
3. **Qwen json_object 400.** `generateIdeasStructured` used `response_format: json_object`, which DashScope rejects unless the messages contain the literal word "json" — the compiled KC prompt carries no serialization directive. **Added a static `IDEAS_OUTPUT_CONTRACT`** (owned by the runner, where `response_format` lives) appended to the system prompt; documents the JSON shape and keeps the cache prefix byte-stable.
4. **Persist `blocks is not iterable`.** The route passed `withKcStamp({ blocks })` (wrapper object) cast `as unknown[]` into `insertMessage`, which iterates its array arg → threw on every persist; nothing was saved. The system contract is `messages.body = block array` (`develop` route + `loadMessages` Array.isArray). **Fixed:** `insertMessage(threadId, role, blocks, kcGenVersion?)` stores the `{ kcGenVersion, blocks }` wrapper when stamped; `loadMessages` unwraps both shapes (new `unwrapBody` helper). Route now passes the array + `kcStamp().kcGenVersion`. Honors T-03-12 within the real contract. Route test updated.

Also fixed stale `tool-chips.test.tsx` assertions that predated the Idea chip going live (Idea now fires `onSelect`; only Hooks/Chat disabled).

## Deferred to Phase 4 (owner decision 2026-06-18)

- **Reload rehydration (UAT step 5).** Persist now works (cards are saved with KC provenance, and `loadMessages` unwraps them), but the composer hardcodes `persistedBlocks={[]}` and there is no client read-back on mount. Implementer had marked `// TODO Phase 4+`; owner accepted the deferral. Phase 4 (Hooks) shares the same open thread + persistence, so wire the open-thread message load there and pass real `persistedBlocks` to `IdeasThreadView`.
- **Ideas route rate limit** — `RATE_LIMIT_*` constants reserved; per-user rolling limit on the messages table deferred (route protected by auth + ask-cap).

## Verification

- `npx vitest run` — 2373 pass / 0 fail.
- `npm run build` — exit 0.
- Live UAT — steps 2/3/4/6/7 pass; step 5 deferred (above).
