# Stack Research

**Domain:** Mobile-first PWA rebrand of an existing Next.js content-intelligence app (Numen Surface v5.0) — share-sheet ingestion, stage-reveal streaming, in-thread agentic tools
**Researched:** 2026-06-11
**Confidence:** HIGH (versions + iOS/Vercel constraints verified via Context7, WebKit Bugzilla, Vercel docs, and the live codebase)

> **Scope:** ONLY the net-new capabilities for Numen Surface. Engine, Supabase, Tailwind v4, Sentry, Apify, Recharts are existing and untouched. **The single most important finding: most of the streaming transport this milestone "needs" is already built in the codebase. The genuine net-new adds are small.**

---

## 0. Environment correction (verified against package.json)

The milestone brief says "Next.js 15." **The worktree is actually on newer versions.** Plan against these, not the brief:

| Package | Brief said | Actually installed | Impact |
|---------|-----------|--------------------|--------|
| `next` | 15 | **16.1.5** | App Router APIs same; confirms React 19 server features available |
| `react` / `react-dom` | — | **19.2.3** | `use()`, Suspense streaming, RSC all available |
| `zod` | — | **^4.3.6** | AI SDK tool schemas use Zod 4 — already present, no add |
| `apify-client` | "integrated" | **^2.22.1** | Confirmed; reuse, do not re-add |
| `@sentry/nextjs` | — | **^10.39.0** | Reuse for tool-failure capture |
| `openai` | — | **present** (Qwen via DashScope compatible-mode) | LLM access already abstracted |
| `ai` (Vercel AI SDK) | — | **NOT installed** | Genuine decision point (§3) |
| `serwist` / `@serwist/next` | — | **NOT installed** | Genuine net-new (§4) |

No PWA manifest, no service worker, no `manifest.ts`, no icons exist yet — the PWA shell is 100% net-new.

---

## Recommended Stack

### Core Technologies (net-new)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@serwist/next` + `serwist` | **9.5.11** | PWA: manifest + service worker + installability in Next 16 App Router | De-facto `next-pwa` successor (next-pwa is unmaintained). Native App Router support (`app/sw.ts`, `withSerwistInit`, `SerwistProvider`). Workbox-based, TypeScript-first. Verified current on npm. |
| **Next.js native `manifest.ts`** | (built-in, Next 16) | The web app manifest (`/manifest.webmanifest`) incl. `share_target` member | App Router file convention — no extra dep. Type-safe `MetadataRoute.Manifest`. Use this for the manifest; use Serwist for the SW. |
| **Web Share Target API** | spec (manifest member) | Receive shared TikTok/Reels URL into the installed PWA | The acquisition-hero mechanism — but **iOS support is absent** (see §1, this is the milestone's biggest platform risk). |

### Streaming transport — REUSE, do not add

| Mechanism | Status in repo | Reuse for |
|-----------|----------------|-----------|
| **SSE over `ReadableStream`** (`text/event-stream`) | **Already built** — `src/app/api/analyze/[id]/stream/route.ts` | Stage-reveal. Already emits `partial`, `filmstrip_segment_ready`, `complete` events with heartbeats, `Last-Event-ID` reconnect, `X-Accel-Buffering: no`, `maxDuration=300`, client-abort cleanup. **This IS the stage-reveal transport.** |
| **`EventSource` consumer hook** | **Already built** — `src/hooks/queries/use-analysis-stream.ts` | A 9-key hook with a POST→EventSource→TanStack-polling reconnect ladder and a `panelReadyFromStages` mapper (`@/lib/engine/panel-mapping`, `@/lib/engine/events`). The Reading's stage-reveal binds to this. |
| **Raw SSE Qwen streaming** | **Already built** — `src/app/api/analyze/[id]/chat/route.ts` | The in-thread free-text turn ("Ask the expert") already streams Qwen token deltas over SSE with auth, rate-limit, scope allowlist, persistence. |
| **`@tanstack/react-query`** | installed | Reconnect-ladder polling fallback; thread/history caching |
| **`openai` SDK → DashScope** | installed (`src/lib/engine/qwen/client.ts`) | All LLM calls. `maxRetries:0`, `temperature:0`, `seed:7`, per-stage circuit breakers. Qwen-only is a locked constraint. |

### Agentic tools (the moat) — one small decision

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Roll-your-own tool registry** (recommended) | — | Map suggested-tap → typed handler → existing executor (Apify provider, back-catalog query, trends) → SSE `tool-call`/`tool-result` events | The follow-up taps are a **fixed, finite menu** (competitors, back-catalog, trends, best-time, brand-fit), not open-ended LLM-decided tool use. A registry of `{ id, label, kind: 'instant'|'agentic', execute }` over the existing SSE pattern is ~50 lines, zero new deps, and reuses `apify-provider.ts` + the proven stream route. |
| `ai` (Vercel AI SDK) | **6.0.201** | Alternative: model-driven tool calling (`streamText` + `tool()` + `stopWhen: isStepCount`) | Use ONLY if you later need the **LLM to autonomously decide** which tool to call mid-conversation from free text. Adds a real dependency + a second LLM-streaming paradigm alongside the existing raw `openai` Qwen path. Defer unless the free-text tail demands autonomous tool selection. |

### Supporting libraries (net-new, small)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ducanh2912/next-pwa` | — | (rejected alternative to Serwist) | Do not use — see What NOT to Use |
| `satori` / `@vercel/og` | (`next/og` built-in) | Verdict share-card image generation (growth loop, vision §9 open) | Already available via `next/og` in Next 16 — no add. Use when shareable verdict cards land. |
| `nanoid` | installed | Request/thread IDs | Reuse (already in stream route) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `next build && next start` | Test PWA locally | Serwist SW only generates in a production build; dev disables it (`disable: process.env.NODE_ENV === 'development'`). PWA cannot be validated with `next dev`. |
| Lighthouse / PWA audit | Installability + perf gate | Vision targets native feel + (M2-I) Lighthouse ≥90. Run against `next start`. |
| iOS Safari device (real) | Verify Add-to-Home-Screen + share fallback | Simulator does not reproduce share-sheet behavior; test on a physical iPhone. |

## Installation

```bash
# PWA shell (the only meaningful net-new core deps)
pnpm add @serwist/next serwist

# Agentic tools — ONLY if model-driven tool selection is needed later (otherwise skip)
pnpm add ai @ai-sdk/openai   # zod@4 already present

# NOTHING else: apify-client, openai, @tanstack/react-query, zod, sentry,
# nanoid, next/og are all already installed. Reuse.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **SSE (existing stream route)** for stage-reveal | Streaming RSC + React 19 `use()`/Suspense | RSC streaming suits a *one-shot* server render that suspends per section. It does **not** fit here: the engine writes stages to Supabase asynchronously over 45–74s and the client must reconnect/resume — that is exactly what the existing SSE+polling ladder does. RSC streaming also can't survive a tab backgrounding + resume. Keep SSE. |
| **SSE** | WebSockets (e.g. Supabase Realtime) | Use Realtime only if you need bidirectional or true server-push without the 2s DB poll. The current short-poll-over-SSE already works within Vercel limits and avoids a connection-state dependency. Not worth the rewrite for a one-way stage feed. |
| **Roll-your-own tool registry** | Vercel AI SDK `streamText` tool-calling | Switch to AI SDK when free-text follow-ups must let the **model choose** tools/arguments autonomously (multi-step `isStepCount`). For a fixed tap-menu, the SDK is overkill and forks the LLM-streaming approach. |
| **Serwist** | Manual `manifest.ts` + hand-written SW | Manual SW is fine if you only need installability + manifest and **no offline caching**. Given Numen wants "native feel" (offline shell, instant relaunch), Serwist's Workbox precaching earns its keep. If you truly only need `share_target` + install, a manual SW is ~40 lines and zero deps — a legitimate minimal path. |
| **Serwist** | `next-pwa`, `@ducanh2912/next-pwa` | Never — original `next-pwa` is abandoned; the maintained fork still lags Next 16 App Router vs Serwist. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`next-pwa`** | Unmaintained, Pages-Router-era, breaks on Next 16 App Router | `@serwist/next` |
| **Vercel AI SDK for the stage-reveal stream** | Engine output isn't LLM token streaming — it's structured blocks materializing from async DB writes. AI SDK's `streamText`/`useChat` models a chat completion, not a 5-stage pipeline persisted to Postgres | The existing SSE stream route + `use-analysis-stream` hook |
| **A second LLM client/paradigm just for chat** | The repo already streams Qwen via the `openai` SDK with locked retry/seed/circuit-breaker discipline; adding AI SDK as the chat path would fragment LLM access and risk the `maxRetries:0` invariant | Extend the existing `getQwenClient()` raw-stream chat route |
| **Edge runtime for the stream/engine routes** | Engine + Supabase + DashScope calls need Node APIs; Edge's 25s-to-first-byte streaming rule is tighter | Keep `runtime = "nodejs"` (already set), Fluid Compute gives Node up to 300s |
| **`beforeinstallprompt`-driven install UX on iOS** | iOS Safari does not fire it | Manual "Add to Home Screen" coaching UI (iOS), real prompt on Android/desktop |
| **Relying on Web Share Target on iOS** | Not implemented in WebKit (§1) | URL-paste + clipboard-detect fallback; Android/installed-Chrome gets the real share target |

## Stack Patterns by Variant

**If ingestion target = Android / installed Chromium PWA:**
- Real `share_target` in `manifest.ts` works: `{ action: "/share", method: "POST", enctype: "multipart/form-data", params: { url, text, files } }`.
- Service worker (Serwist) intercepts the POST, stashes payload, redirects into the thread. Stage-reveal kicks off immediately. **This is the full acquisition-hero experience.**

**If ingestion target = iOS Safari PWA (the majority of the mobile audience):**
- `share_target` is silently ignored — the PWA never appears in the iOS share sheet (§1).
- **Fallback A (ship this):** in-app "Paste TikTok/Reels link" + auto-read clipboard on focus (`navigator.clipboard.readText()` after a user gesture). Creator copies the link in TikTok → opens Numen → link is pre-filled. One extra tap vs Android, no install required.
- **Fallback B (optional, later):** ship an Apple **Shortcut** ("Share to Numen") users add once; it appears in the share sheet and opens `https://app.numen.../share?url=...`. Distribute via a link. Pragmatic but onboarding friction.
- **Fallback C (future, separate milestone):** the planned **Capacitor iOS wrapper** (PROJECT.md "Future milestones") CAN register a native share extension → the only path to a true iOS share sheet entry. If iOS share-in is strategically critical, that milestone is the real answer, not the PWA.

**If agentic follow-up = fixed tap menu (current vision §4):**
- Roll-your-own registry → SSE `tool-call`/`tool-result` frames → in-persona "working…" + voiced failure (never red toast, per vision). Reuse `apify-provider.ts`.

**If agentic follow-up later accepts open free-text that should auto-pick tools:**
- Add Vercel AI SDK `ai@6.0.201`, define `tool()`s whose `execute` wraps the SAME existing executors, `stopWhen: isStepCount(5)`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@serwist/next@9.5.11` | `next@16.1.5` | Serwist 10+ planned for Next 15+; 9.5.x supports Next 15/16 App Router. Verify peer range at install; bump to Serwist 10 if it's GA and Next-16-validated. |
| `ai@6.0.201` | `zod@^4.3.6` (installed), `react@19.2.3` | AI SDK v6 tool schemas accept Zod 4. `@ai-sdk/openai` provider can target DashScope via `baseURL` — but the repo's Qwen client already does this, so AI SDK is only for tool *orchestration*, not access. |
| Vercel Fluid Compute | `runtime="nodejs"` | Required for >60s on Hobby (300s) and up to 800s on Pro. Engine routes already set `maxDuration=300`. Enabled by default since 2025-04-23. |
| SSE on Vercel Node + Fluid | `X-Accel-Buffering: no` | Already set in stream route — disables proxy buffering so events flush incrementally. Keep it. |

---

## §1 — Native share-sheet ingestion (iOS reality, stated honestly)

**Verdict: the acquisition hero is structurally weak on iOS. Plan the fallback as the primary mobile path, not the exception.**

- **Web Share Target API is NOT implemented in WebKit/Safari.** WebKit Bugzilla #194593 is status **NEW, unassigned, P2**, open since Feb 2019 — ~7 years — with WebKit's position "neutral" since 2023 and no implementation as of the latest comments (May 2026). The API is also not on the W3C standards track, which is part of why Apple deprioritizes it. (HIGH confidence — read directly from the bug tracker.)
- **Consequence:** an installed iOS PWA cannot register in the system share sheet. A creator in TikTok cannot tap Share → Numen. Full stop. No manifest config changes this.
- **What DOES work on iOS Safari:** manual Add-to-Home-Screen install (no `beforeinstallprompt`), service workers (iOS 15+), the Web *Share* API (sharing OUT), `navigator.clipboard.readText()`.
- **Where the real share target works:** Android Chrome / any installed Chromium PWA — `share_target` in the manifest is fully supported. So the feature isn't wasted; it's just iOS-blind.
- **Recommended product framing:** Ship `share_target` for Android/desktop. On iOS, lead with **paste-URL + clipboard auto-detect** (vision §4 already lists "in-app upload / paste URL" as path b) and treat that as the primary mobile ingestion on iOS. If a true iOS share-sheet entry is later judged essential, it belongs to the **Capacitor wrapper milestone** (native share extension), already on PROJECT.md's roadmap — not to this PWA milestone.

## §2 — Stage-reveal streaming (already solved; Vercel limits cleared)

- **Transport decision: SSE. Already built.** The four "options" (SSE / streaming RSC / React 19 `use()` / a lib) resolve decisively to SSE because the engine persists stages to Supabase asynchronously and the client must reconnect after backgrounding — RSC/`use()` streaming is a single suspended render that can't resume. The repo's `stream/route.ts` + `use-analysis-stream.ts` already implement SSE with heartbeats, `Last-Event-ID`, and a TanStack-polling fallback. Net-new work = **reshaping the emitted events into the Reading's block vocabulary**, not new infra.
- **Vercel limits for the 45–74s pipeline (HIGH confidence, Vercel docs):**
  - **Fluid Compute** is default since 2025-04-23. Node.js runtime gets **up to 300s on Hobby, up to 800s on Pro/Enterprise** — well clear of 45–74s.
  - Routes already set `runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=300`. No change needed.
  - The Edge-runtime "25s to first byte" streaming rule does **not** apply — these are Node routes. Heartbeats every 15s keep the connection warm regardless.
  - `X-Accel-Buffering: no` is set, ensuring incremental flush (no buffering until close).
- **One thing to verify in roadmap:** the engine currently *persists* stage state to Postgres and the stream route *polls* it (2s). For tighter stage-reveal you may push events directly from the engine invocation. Not required to ship — the poll-over-SSE is proven.

## §3 — Agentic tools in-thread (roll-your-own; AI SDK only if/when autonomous)

- **Recommendation: roll-your-own tool registry over the existing SSE + Apify provider.** The follow-up taps are a fixed, finite, designer-curated menu (competitors via Apify, back-catalog compare, trends, best-time, brand-fit). That is dispatch, not LLM tool-selection. A typed registry (`{ id, label, kind, execute }`) + SSE `tool-call`/`tool-result` frames is minimal, dep-free, and reuses `src/lib/scraping/apify-provider.ts` (the locked `ScrapingProvider` executor) and the proven stream route. It also makes the vision's requirements trivial: mark agentic taps visually distinct, voice failures in-persona (capture to Sentry, never a red toast).
- **When to adopt Vercel AI SDK (`ai@6.0.201`):** only if the free-text tail must let the **model autonomously pick** tools/arguments. Then use `streamText({ tools, stopWhen: isStepCount(5) })` with `tool()` definitions whose `execute` wraps the same executors, streamed via `createUIMessageStreamResponse`. This adds a real dep and a second LLM-streaming paradigm next to the existing raw-`openai` Qwen chat — defer until proven necessary. (AI SDK tool-calling verified current via Context7 `/vercel/ai`.)

## §4 — PWA shell (Serwist + native manifest.ts)

- **Recommendation: `@serwist/next@9.5.11` for the service worker, Next 16 native `manifest.ts` for the manifest.** Serwist is the maintained `next-pwa` successor with first-class App Router support (`withSerwistInit` in config, `app/sw.ts`, `SerwistProvider` in layout, Workbox precaching). Verified current on npm. (HIGH confidence — Context7 `/websites/serwist_pages_dev` + npm.)
- Use Next's `app/manifest.ts` (`MetadataRoute.Manifest`) for type-safe manifest incl. `display: "standalone"`, icons, theme color (warm-clay per brand), and the `share_target` member (effective on Android/desktop only — §1).
- `appleWebApp` metadata in the root layout (`capable`, `statusBarStyle`, `title`, startup images) drives the iOS standalone look.
- Test only via `next build && next start` — Serwist disables the SW in `next dev`.
- This is fully net-new: no manifest, SW, or icons exist in the repo today.

## Sources

- `/vercel/ai` (Context7) — tool calling (`streamText`, `tool()`, `isStepCount`, `createUIMessageStreamResponse`), custom SSE stream format — HIGH
- `/websites/serwist_pages_dev` (Context7) — `withSerwistInit`, `app/sw.ts`, `SerwistProvider`, Next App Router setup — HIGH
- npm registry — `ai@6.0.201`, `@serwist/next`+`serwist@9.5.11`, `zod@4.4.3` (repo on `^4.3.6`) — HIGH
- Repo `package.json` — Next 16.1.5, React 19.2.3, apify-client 2.22.1, openai, @tanstack/react-query, @sentry/nextjs present; `ai`/`serwist` absent — HIGH
- Repo source — `src/app/api/analyze/[id]/stream/route.ts`, `src/hooks/queries/use-analysis-stream.ts`, `src/app/api/analyze/[id]/chat/route.ts`, `src/lib/scraping/apify-provider.ts`, `src/lib/engine/qwen/client.ts` — existing SSE/streaming/Apify infra to reuse — HIGH
- WebKit Bugzilla #194593 — Web Share Target API status NEW/unassigned/P2, unimplemented as of May 2026 — HIGH (acquisition-hero risk)
- Vercel docs — Fluid Compute (default since 2025-04-23; Node 300s Hobby / 800s Pro), Functions Limits, streaming/Edge 25s rule — HIGH
- MDN `share_target`, web.dev OS Integration, magicbell PWA-iOS-2026 guide — iOS install/SW support + share-target absence + Shortcuts/custom-scheme fallbacks — MEDIUM (cross-confirmed with WebKit bug)

---
*Stack research for: Numen Surface v5.0 mobile-first PWA rebrand — net-new capability additions*
*Researched: 2026-06-11*
