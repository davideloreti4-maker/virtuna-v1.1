---
phase: 06-script-remix-tools
reviewed: 2026-06-18T14:08:33Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - scripts/regen-kc.ts
  - src/app/api/tools/remix/run/route.ts
  - src/app/api/tools/script/route.ts
  - src/components/app/home/composer.tsx
  - src/components/app/home/tool-chips.tsx
  - src/components/thread/hook-card-block.tsx
  - src/components/thread/hooks-thread-view.tsx
  - src/components/thread/message-blocks.tsx
  - src/components/thread/remix-card-block.tsx
  - src/components/thread/remix-thread-view.tsx
  - src/components/thread/script-card-block.tsx
  - src/components/thread/script-thread-view.tsx
  - src/hooks/queries/use-remix-stream.ts
  - src/hooks/queries/use-script-stream.ts
  - src/lib/hook-test-context.tsx
  - src/lib/kc/assembler.ts
  - src/lib/kc/compiled.ts
  - src/lib/remix-develop-context.tsx
  - src/lib/script-test-context.tsx
  - src/lib/tools/block-registry.ts
  - src/lib/tools/blocks.ts
  - src/lib/tools/chain-handoff.ts
  - src/lib/tools/runners/remix-runner.ts
  - src/lib/tools/runners/script-runner.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-18T14:08:33Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the Script and Remix skill additions: two SSE routes, two runners, two
stream hooks, six thread/card components, the chain-handoff registry, block schemas,
the KC compiler, and the composer wiring.

The phase's **critical invariants hold**:
- **Auth-first** — both routes call `supabase.auth.getUser()` → 401 before any DB
  read or LLM work. `user.id` is taken from the session, never the body (CR-01).
- **D-05a engine isolation** — `remix-runner.ts` imports only `engine/remix/*`,
  `engine/qwen/omni-analysis`, and `engine/flash/*`. It does NOT import
  `runPredictionPipeline`, `aggregateScores`, `usage_tracking`, or touch
  `ENGINE_VERSION`. Verified by grep + the runner's own guard test.
- **Honesty spine (D-05/Pitfall 5)** — band/fraction are opener-scoped everywhere:
  `script-runner` gates only `openingBeatSeed`, `remix-runner` gates only the
  adapted `chosen.hook`, and the card renderers say "opener stops the scroll" /
  "adapted hook scroll-stop", never full-watch.
- **No /analyze navigation** — Script and Remix paths in the composer never set
  `pendingNavRef` nor call `stream.start` (T-06-20).
- **No hardcoded secrets** — none found; LLM clients come from `getQwenClient()`.

No Critical findings. Six Warnings cluster around two real defects: (1) the Remix
URL is never format-validated on either the client or the server, leaving SSRF
defense entirely to the downstream Apify provider, and (2) the Script route lacks
the CSRF/Content-Type guard and `maxDuration` config that its sibling Remix route
added in the same phase — a same-phase inconsistency that creates a CSRF cost-abuse
vector and a likely production timeout.

## Warnings

### WR-01: Remix URL never validated as a URL — SSRF defense relies solely on the downstream provider

**File:** `src/app/api/tools/remix/run/route.ts:55-58`, `src/components/app/home/composer.tsx:216,232-235,494-499`
**Issue:** The route's Zod schema validates `url: z.string().min(1).max(2000)` — any
non-empty string passes. The route header comment claims "authenticate → **validate
URL** → resolve" but no URL-shape, scheme, or host validation exists at the boundary.
On the client, `TIKTOK_URL_PATTERN` is applied only when `activeTool === "test"`
(`showUrlError = ... && activeTool === "test"`, line 216); for Remix, `canSubmit`
only checks `trimmedUrl.length > 0` (line 234), so arbitrary strings reach the route.
All SSRF protection is therefore deferred to `resolveAndRehost` /
`ApifyScrapingProvider` (per comment T-06-11). CLAUDE.md requires input validation +
path/URL sanitization **at the system boundary**; this route validates neither shape
nor scheme, so a defense-in-depth layer the rest of the app relies on is absent here.
**Fix:** Validate URL shape and restrict scheme/host at the boundary, mirroring the
shared TikTok pattern already imported by the composer:
```ts
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
const RemixRunRequestSchema = z.object({
  url: z.string().min(1).max(2000).refine(
    (u) => { try { const p = new URL(u).protocol; return (p === "http:" || p === "https:") && TIKTOK_URL_PATTERN.test(u); } catch { return false; } },
    "url must be a valid TikTok https URL",
  ),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional().default("tiktok"),
});
```
Also apply the client TikTok check to the Remix tool so the fast UX reject matches.

### WR-02: Script route is missing the CSRF / Content-Type guard the sibling Remix route added — cost-abuse vector

**File:** `src/app/api/tools/script/route.ts:64-106` (absent)
**Issue:** `remix/run/route.ts` added a Content-Type `415` guard (L88-96) and a
cross-origin `403` guard (L98-106) explicitly to block CSRF (T-06-14). The Script
route — written in the same phase and doing equally expensive LLM work plus a second
streamed follow-up Qwen call — has **neither**. Because Supabase auth is cookie-based,
a cross-origin page can POST `application/json` (or a simple-request form body) to
`/api/tools/script` and burn the victim's LLM budget. The existing Hooks route shares
this gap, but the same-phase Remix route demonstrates the guard is both expected and
trivial; Script silently diverged from its sibling's security posture.
**Fix:** Copy the two guards from `remix/run/route.ts:88-106` into `script/route.ts`
immediately after the auth gate (before body parse).

### WR-03: Script route omits `maxDuration` while the runner waits up to 300s — internal timeout is dead, platform will kill the request

**File:** `src/app/api/tools/script/route.ts` (no route segment config), `src/lib/tools/runners/script-runner.ts:52`
**Issue:** `script-runner.ts` sets `GENERATE_TIMEOUT_MS = 300_000` (300s) for the Qwen
generate call, but `script/route.ts` declares no `export const maxDuration` (nor
`runtime`/`dynamic`). On Vercel the default function ceiling (10s hobby / 60s pro) is
far below 300s, so the platform terminates the request long before the AbortController
fires — the 300s internal timeout can never be reached, and slow generations fail with
a platform timeout instead of the runner's graceful warning path. The Remix route
correctly sets `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`
(L47-49). Script also runs a *second* streamed follow-up Qwen call after persistence
(route L210-223), extending wall-clock further.
**Fix:** Add to the top of `script/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
```
(or align `GENERATE_TIMEOUT_MS` and `maxDuration` to a value the deployment tier allows).

### WR-04: Remix retry callback fires `remix.start("", …)` with an empty URL — guaranteed 400, retry always fails

**File:** `src/components/app/home/composer.tsx:663`
**Issue:** The Remix thread view's retry is wired as
`onRetry={() => void remix.start("", platform)}`. `remix.start` POSTs
`{ url: "" }`, which fails the route's `z.string().min(1)` validation → `400`. The
hook surfaces "Validation failed" instead of re-running the original URL. Unlike the
Idea/Hooks/Script skills (where empty ask = Auto mode and a re-run is valid), Remix
requires the source URL, which is not retained for retry. The user taps "Retry →" and
gets an error every time.
**Fix:** Retain the last submitted URL (e.g. a `lastRemixUrlRef`) and retry with it,
or hide the retry affordance for Remix when no URL is available:
```ts
const lastRemixUrlRef = useRef<string>("");
// in the remix submit branch: lastRemixUrlRef.current = url;
onRetry={() => lastRemixUrlRef.current && void remix.start(lastRemixUrlRef.current, platform)}
```

### WR-05: Remix graceful-error discriminant is discarded by the client — `resolve_failed`/`decode_failed`/`adapt_failed` collapse to a generic message

**File:** `src/app/api/tools/remix/run/route.ts:182-186`, `src/hooks/queries/use-remix-stream.ts:247-250`
**Issue:** On a graceful pipeline failure the route emits
`send("error", { error: result.error, warnings })` (L184). The client's error branch
reads only `data.message` (L248) — `data.error` is never inspected — so it throws
`new Error('Remix error')` and the specific discriminant (resolve/decode/adapt) is
lost. The route's *unexpected*-exception branch (L246) uses `{ message }`, so the two
error shapes the route emits are inconsistent, and the more common (graceful) one
never carries a message field. The SkillRunError UI is generic, so the user-visible
impact is limited, but the failure mode is unobservable to the client and any future
discriminant-aware UI would silently break.
**Fix:** Make the route emit a single consistent error shape, e.g.
`send("error", { message: friendlyForDiscriminant(result.error), code: result.error })`,
or have the client read `data.error ?? data.message`.

### WR-06: Remix card silently dropped when decode omits any of the four beats — `sourceDecode.*` is `.min(1)` but built from a `""` fallback

**File:** `src/lib/tools/runners/remix-runner.ts:189-219`, `src/lib/tools/blocks.ts:204-209`
**Issue:** `RemixCardBlockSchema` requires every `sourceDecode` field to be
`z.string().min(1)` (blocks.ts L205-208), but the runner builds them with
`beatBody(id) = decode.beats.find(b => b.id === id)?.body ?? ""` (L189-190). If the
decode result is missing any of the four beat IDs (`hook_pattern`, `structure_pacing`,
`the_turn`, `emotional_beat`) — a plausible partial-decode outcome — the corresponding
field is `""`, `safeParse` fails, and the *entire* card is dropped (L218-223) with only
a warning. The decode succeeded and an adapted hook exists, but the user gets a blank
run because one structural beat was absent. This is over-strict validation converting a
partial success into a total failure.
**Fix:** Either relax the four `sourceDecode` fields to `z.string()` (allow empty,
render a graceful "—" in the card), or have `beatBody` fall back to a placeholder
string so a present-but-thin decode still ships a card. Prefer the former so the schema
reflects reality.

## Info

### IN-01: Remix route emits all four stage `active` events before any work, then all `done` after — progress checklist is cosmetic, not real-time

**File:** `src/app/api/tools/remix/run/route.ts:156-179`
**Issue:** "Resolving", "Decoding", "Adapting", and "Simulating" are all sent `active`
before the single `await runRemixPipeline(...)`, then all sent `done` after it returns.
The checklist shows four stages light up simultaneously and complete simultaneously —
the "real not timed (D-02)" claim in the header comment is not honored for Remix
(acknowledged as deferred in the L158-164 comment). Same pattern in `script/route.ts`
L154-157 for Self-judge/Simulating.
**Fix:** Thread per-phase callbacks out of the runner so each `done` is emitted at the
true phase boundary; or document the stages as indicative-only in the UI.

### IN-02: Stream hooks handle a `followup` event that the Remix/Script routes never emit (Remix), and ignore the `warning` event both routes do emit

**File:** `src/hooks/queries/use-remix-stream.ts:198-200,189-191`, `src/app/api/tools/remix/run/route.ts:189-191`
**Issue:** `use-remix-stream.ts` has a `followup` handler (L198-200) but the Remix
route never emits `followup` (only the Script route does). Conversely both routes emit
a `warning` event (`send("warning", { warnings })`), but neither stream hook handles
`warning` — the frame is silently dropped (falls through the if/else chain). Dead
handler + unhandled event; no functional break, but the contract drifts.
**Fix:** Remove the unused `followup` branch from `use-remix-stream.ts`, or add a
`followup` emit to the Remix route to match Script. Add a `warning` handler if warnings
should surface to the user.

### IN-03: Composer `+`-button comment lists three tools but the condition hides five

**File:** `src/components/app/home/composer.tsx:785-786`
**Issue:** The comment says "Hidden when Idea, Hooks, or Chat tool is active" but the
guard hides the upload button for `idea`, `hooks`, `chat`, `script`, AND `remix`
(L786). Stale comment.
**Fix:** Update the comment to list all five non-Test tools.

### IN-04: Pervasive `any` on persisted-block state weakens the rehydration boundary

**File:** `src/components/app/home/composer.tsx:117-126,421-426,449`
**Issue:** Five `useState<any[]>` arrays hold persisted blocks, and the refine path
casts to `any[]` (L422) with `// eslint-disable-next-line`. The blocks fetched from
`/api/threads/open` are never validated against the block schemas in the composer (they
are re-validated later in `MessageBlocks`/`validateBlock`, which mitigates render
risk), but the composer reads `b?.props?.rank` etc. off untyped data. CLAUDE.md asks for
typed public APIs; the rehydration boundary here is effectively untyped.
**Fix:** Type these as `BlockUnion[]` (or a discriminated subset) and parse the
`/api/threads/open` payload through `validateBlock` at fetch time, dropping unknowns.

### IN-05: `scripts/regen-kc.ts` reads five corpus files with no error handling — a missing/renamed corpus file throws a raw ENOENT

**File:** `scripts/regen-kc.ts:42-46`
**Issue:** Five `readFileSync(...)` calls with no try/catch. If any corpus `.md` is
missing or renamed, the build script dies with an unhelpful raw `ENOENT` stack. This is
a dev-only build tool (not a runtime path), so impact is low, but a clear error message
would save debugging time.
**Fix:** Wrap the reads and emit a clear "corpus file X not found — run from repo root"
message.

---

_Reviewed: 2026-06-18T14:08:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
