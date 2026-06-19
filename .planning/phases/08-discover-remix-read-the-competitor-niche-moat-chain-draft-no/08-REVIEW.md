---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
reviewed: 2026-06-19T09:08:53Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/app/(app)/discover/discover-client.tsx
  - src/app/(app)/discover/page.tsx
  - src/app/api/discover/route.ts
  - src/app/api/tools/chat/route.ts
  - src/app/api/tools/hooks/route.ts
  - src/app/api/tools/read/route.ts
  - src/app/api/tools/remix/run/route.ts
  - src/app/api/tools/script/route.ts
  - src/components/app/sidebar.tsx
  - src/components/discover/discover-entry.tsx
  - src/components/discover/discover-grid.tsx
  - src/components/discover/outlier-tile.tsx
  - src/components/thread/band-block.tsx
  - src/components/thread/message-blocks.tsx
  - src/components/thread/multi-audience-read-block.tsx
  - src/components/thread/outlier-grid-block.tsx
  - src/components/thread/remix-card-block.tsx
  - src/components/thread/verbatim-wall.tsx
  - src/lib/audience/goal-intent.ts
  - src/lib/audience/temperature-disposition.ts
  - src/lib/discover/classify-input.ts
  - src/lib/discover/discover-cache.ts
  - src/lib/discover/outlier-compute.ts
  - src/lib/engine/flash/two-audience-read.ts
  - src/lib/engine/flash/who-not-for.ts
  - src/lib/schemas/competitor.ts
  - src/lib/scraping/apify-provider.ts
  - src/lib/tools/block-registry.ts
  - src/lib/tools/blocks.ts
  - src/lib/tools/chain-handoff.ts
  - src/lib/tools/runners/chat-runner.ts
  - src/lib/tools/runners/hooks-runner.ts
  - src/lib/tools/runners/remix-runner.ts
  - src/lib/tools/runners/script-runner.ts
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-19T09:08:53Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed the Discover → Remix → Read moat chain: Discover scrape/rank/cache, the
two-audience Read feature, the steered runners (chat/hooks/script/remix), block
schemas, and thread renderers. The code is well-structured and the honesty-spine
discipline (no fabricated numeric scores) is consistently enforced at the schema
boundary. However there are two correctness defects that ship wrong user-facing
output, plus a cluster of cross-cutting security inconsistencies — the new POST
routes (`read`, `chat`, `hooks`, `script`, `discover`) omit the Content-Type /
cross-origin CSRF guards that the `remix/run` route applies, leaving them open to
cross-origin POST CSRF since auth rides on cookies. Several `Promise`-shaped
fire-and-forget calls and a fragile timeout pattern round out the warnings.

## Critical Issues

### CR-01: `who-not-for` mislabels the warm `purposeful_viewer` segment as "scrolls past"

**File:** `src/lib/engine/flash/who-not-for.ts:25-29`
**Issue:** `SCROLLS_PAST_DISPOSITIONS` contains `"scanner"`, but `"scanner"` is NOT
exclusively a cold disposition. Per `temperature-disposition.ts:58,62`, the
`scanner` disposition maps to BOTH `purposeful_viewer` (temperature `warm`,
high-intent) and `cross_niche_curiosity` (temperature `cold`). The module comment
even claims the cold set "mirrors the TEMPERATURE_DISPOSITION table" and lists
`purposeful_viewer` among the scroll-prone — but `purposeful_viewer` is a *warm,
engaging* persona. The result: any calibrated audience containing a
`purposeful_viewer` persona gets that warm segment surfaced under "Scrolls past:
Scanners" in the Read card (`multi-audience-read-block.tsx:116`). This is a
direct honesty-spine violation — the feature claims "this is who scrolls past"
and names an engaged segment. Because `deriveWhoNotFor` keys off `disposition`
not `temperature`, it cannot distinguish the two scanner sources.
**Fix:** Filter on temperature, not disposition. Derive scroll-prone personas by
looking up `TEMPERATURE_DISPOSITION[archetype].temperature === "cold"`, then map
to the label — or pass the persona's archetype/temperature through instead of
disposition:
```ts
import { TEMPERATURE_DISPOSITION } from "@/lib/audience/temperature-disposition";

export function deriveWhoNotFor(personas: CalibratedPersona[]): string {
  const present = new Set<Disposition>();
  for (const persona of personas) {
    // Only cold-temperature personas scroll past — disposition alone is ambiguous
    // (scanner is warm for purposeful_viewer, cold for cross_niche_curiosity).
    const temp = TEMPERATURE_DISPOSITION[persona.archetype as Archetype]?.temperature;
    if (temp === "cold") present.add(persona.disposition);
  }
  // ...
}
```
Note `CalibratedPersona` carries `archetype`, so the archetype lookup is available.

### CR-02: `read` route compares General-to-General when no calibrated audience is active

**File:** `src/app/api/tools/read/route.ts:79-107` + `src/lib/engine/flash/two-audience-read.ts:156-165`
**Issue:** The route ALWAYS calls `runTwoAudienceRead(concept, [activeAudience, secondAudience])`
with a 2-element array. `runTwoAudienceRead`'s dedupe guard (`two-audience-read.ts:157-161`)
only fires for `audiences.length === 0 | 1`. For the default case — user has no
calibrated audience pinned and sends no `secondAudienceId` — `activeAudience` =
`GENERAL_AUDIENCE` and `secondAudience` = `GENERAL_AUDIENCE`, so the array length
is 2 and execution falls through to the `else` branch (`slice(0, 2)`), producing
`[General, General]`. The killer feature then renders "General: Strong · General:
Strong" with a "Both General and General land the same" lever — the exact
General-vs-General comparison the dedupe comment says it prevents. This is the
*default path* for any non-onboarded user, so the headline feature ships broken
output for the common case.
**Fix:** Dedupe at the route before calling, or make the runner dedupe the
2-element General/General case:
```ts
// route.ts — only pass a real pair; let the runner default the comparison.
const audiences = activeAudience.is_general
  ? (secondAudience.is_general ? [] : [secondAudience])
  : [activeAudience, secondAudience];
const block = await runTwoAudienceRead(concept, audiences);
```
Or in `runTwoAudienceRead`, collapse the `else` branch when both are general:
`if (pair.every(a => a.is_general)) pair = [GENERAL_AUDIENCE, GENERAL_AUDIENCE]`
is still wrong — the real fix is to require at least one non-general audience or
present a single-audience Read instead of a degenerate self-compare.

## Warnings

### WR-01: New POST routes omit the CSRF (Content-Type + cross-origin) guards present on `remix/run`

**File:** `src/app/api/tools/read/route.ts:37-46`, `src/app/api/tools/chat/route.ts:63-72`, `src/app/api/tools/hooks/route.ts:78-87`, `src/app/api/tools/script/route.ts:66-75`, `src/app/api/discover/route.ts:42-51`
**Issue:** `remix/run/route.ts:90-108` applies a Content-Type 415 guard and a
cross-origin 403 guard as documented CSRF mitigations (T-06-14). None of the
other five POST routes reviewed here apply either guard. Auth is cookie-based
(`supabase.auth.getUser()`), so a cross-origin form/fetch POST from a malicious
page carries the victim's session cookie and passes the auth gate. These routes
mutate state (persist messages to the open thread, consume the Discover daily
cap, spend Apify/Qwen budget), so the CSRF exposure is real, not theoretical.
The inconsistency also signals the omission was an oversight, not a decision.
**Fix:** Extract the `remix/run` guard pair into a shared helper and apply it at
the top of every mutating POST route, immediately after the auth gate:
```ts
const ct = request.headers.get("content-type")?.split(";")[0]?.trim()?.toLowerCase();
if (ct !== "application/json") return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
const origin = request.headers.get("origin");
if (origin) {
  const u = new URL(request.url);
  if (origin !== `${u.protocol}//${u.host}`) return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
}
```

### WR-02: Discover remix launch is fire-and-forget — navigates before persistence completes

**File:** `src/app/(app)/discover/discover-client.tsx:120-141`
**Issue:** `handleRemix` POSTs to `/api/tools/remix/run` (an SSE streaming route
that resolves + decodes + adapts over up to 300s) but never reads the response
body or waits for the stream to finish — `await fetch(...)` resolves as soon as
response *headers* arrive, then immediately `router.push("/home")`. The remix-card
is persisted to the open thread only at the END of the stream
(`remix/run/route.ts:241-256`). Navigating on header-arrival races the
persistence: `/home` rehydrates the thread before the card is written, so the
user lands on an empty thread and the "moat chain" appears to do nothing. There
is also no error surfacing — a `resolve_failed`/`decode_failed` SSE error event is
silently discarded (the `catch` only fires on network-level fetch rejection, not
on an in-stream error event), leaving `remixPendingId` cleared only on throw.
**Fix:** Consume the stream to completion (read `done`/`error` events) before
navigating, and surface stream errors:
```ts
const res = await fetch(handoff.endpoint, { method: "POST", headers, body });
// drain the SSE stream until done/error before navigating
const reader = res.body?.getReader();
// ...parse events, on "error" setState error + clear pending, on "done" router.push("/home")
```
At minimum, await the full body (`await res.text()`) before pushing.

### WR-03: `remapApidojoProfile` uses `.parse()` (throws) inside the non-throwing scrape path

**File:** `src/lib/scraping/apify-provider.ts:112-125` (called from `scrapeProfile:152`)
**Issue:** `remapApidojoVideo` deliberately uses `safeParse` + returns `null` to
batch-skip junk items (`:86-88`), but `remapApidojoProfile` uses
`apidojoProfileSchema.parse(item)` which THROWS on the first malformed field.
`scrapeProfile` does not wrap the call, so a single apidojo schema drift (e.g.
missing `channel.username`) throws an unhandled `ZodError` out of the provider.
In `/api/discover` this is caught and mapped to a 502 (acceptable), but any other
caller of `scrapeProfile` (the competitors/cron path) gets a raw throw instead of
the graceful skip the video path provides. Inconsistent failure contract for the
same actor family.
**Fix:** Mirror the video path — use `safeParse` and return `null` (or throw a
typed `IngestError`) so callers handle it uniformly:
```ts
const result = apidojoProfileSchema.safeParse(item);
if (!result.success) throw new IngestError("scrape_failed", "profile", result.error);
const { channel } = result.data;
```

### WR-04: `/api/discover` consumes Apify budget for the `scrapeProfile` actor but only ever calls `scrapeVideos`

**File:** `src/app/api/discover/route.ts:99` + `src/lib/scraping/apify-provider.ts:136-153`
**Issue:** Profile-mode pulls (`mode === "profile"`) call
`provider.scrapeVideos(normalized, SCRAPE_LIMIT)` with a handle, same as niche
mode. The `DISCOVER_VIDEO_ACTOR` (`apidojo/tiktok-scraper`) is documented
(`:23-25`, Pitfall 2) to require ≥10 posts/query and to behave as a search/profile
result-set scraper — but passing a single `@handle` as the `profiles:[handle]`
search term may return the channel's posts OR a niche-keyword search depending on
actor semantics. The "vs own" baseline in `outlier-compute.ts:66` ASSUMES the
result set is a single channel's videos; if the actor returns a keyword search for
the handle string, the "vs own" label is a lie (it's actually vs a mixed set).
Profile-mode correctness hinges on an unverified actor-input assumption, and the
dedicated `scrapeProfile` method is never used by Discover.
**Fix:** Confirm the apidojo video actor returns single-channel results for a
`profiles:[handle]` input (vs `searchQueries`), and if it does keyword search,
use the profile-scoped input shape so the "vs own" baseline holds. Add a
short comment pinning the verified actor-input contract.

### WR-05: In-memory Discover cap + cache is bypassable and non-shared on serverless

**File:** `src/lib/discover/discover-cache.ts:30-32,91-107`
**Issue:** `userPullCounts` is a module-level `Map`. On Vercel (the documented
deploy target) each serverless instance has its own module memory, so the
`DISCOVER_DAILY_CAP` of 20 is per-instance, not per-user-global. A user fanning
requests across warm instances (or simply hitting cold starts) can exceed the cap
that exists specifically to bound Apify spend (`:27`). The file's own Open-Q2 note
acknowledges the cache is "a re-scrape saver, not a correctness gate" — but the
*cap* IS a spend-correctness gate and inherits the same non-shared flaw. There is
also no upper bound on `cacheStore` / `userPullCounts` size: stale prior-day
entries are evicted only lazily on a same-key read, so keys for inputs never
re-queried accumulate (unbounded growth across a long-lived instance).
**Fix:** Back the daily cap with a shared store (Supabase row or Redis) keyed by
`(user_id, day)`, even if the tile cache stays in-memory. At minimum, document
the per-instance cap as an accepted-but-real spend risk, and add a periodic sweep
or size cap on the two Maps.

### WR-06: `read` route catch maps any pipeline throw to a 500 with the raw error message

**File:** `src/app/api/tools/read/route.ts:114-118`
**Issue:** The `catch` returns `err.message` directly to the client in the
`error` field. `runTwoAudienceRead` calls `runFlashTextMode` (Qwen) and
`resolveAudienceWeights`; a provider error message can leak internal details
(model name, internal URLs, stack-adjacent text) to the client. The other SSE
routes route through Sentry + a generic message; this non-SSE route does not.
**Fix:** Log the real error server-side (Sentry/logger) and return a generic
client message:
```ts
} catch (err) {
  Sentry.captureException(err, { tags: { route: "api.tools.read" } });
  return Response.json({ error: "Read failed" }, { status: 500 });
}
```

### WR-07: `getCachedDiscover` re-derives `dayStamp(now)` and double-computes the key/day

**File:** `src/lib/discover/discover-cache.ts:57-64`
**Issue:** Not a crash, but a latent correctness trap: `discoverCacheKey(...)`
embeds `dayStamp(now)` in the key, then line 60 ALSO compares `entry.day !==
dayStamp(now)`. Because the key already contains the day, a prior-day entry can
never be retrieved by today's key — so the `entry.day !== dayStamp(now)` branch
(`:60-63`) is effectively dead code: any entry fetched by today's key already has
`entry.day === today`. The eviction-on-stale logic never runs, which interacts
with WR-05's unbounded-growth concern (stale keys are never swept).
**Fix:** Either drop the day from the key and rely on the stored-day check (so the
eviction branch becomes live and one key per input/mode is reused across days), or
keep the day in the key and delete the redundant `entry.day` check + add an
explicit sweep. Don't keep both half-mechanisms.

### WR-08: `generateHooksStructured` shadows the outer `raw` loop variable

**File:** `src/lib/tools/runners/hooks-runner.ts:142,192`
**Issue:** `let raw: string` holds the model output (`:142`), then the loop
`for (const raw of arr)` (`:192`) re-declares `raw` as the loop item, shadowing
the outer string. It works because the outer `raw` is no longer used after
`JSON.parse(raw)`, but shadowing a same-named variable of a different type in the
same function is a readability/maintenance hazard — a future edit that references
the model-output `raw` after the loop would silently get the loop binding (or a
TDZ error). Variable shadowing is explicitly in-scope for this review.
**Fix:** Rename the loop variable: `for (const item of arr)` (and update the
`raw as Record<...>` cast to `item as Record<...>`).

### WR-09: `setTimeout`/`AbortController` timer can fire after success in the streaming chat path

**File:** `src/lib/tools/runners/chat-runner.ts:168-203`
**Issue:** `clearTimeout(timer)` runs only AFTER the full `for await` stream loop
completes (`:203`) or in the `catch` (`:195`). For a long stream that legitimately
runs beyond `GENERATE_TIMEOUT_MS` (300s) while tokens are still arriving, the
abort fires mid-stream and kills a healthy generation, surfacing as a spurious
"aborted (timeout)" error. The timeout is meant to bound a *stalled* call, but
here it bounds *total* stream duration including successful streaming. The
hooks/script runners use the same call inside a single non-streamed `create`, so
they're fine; the chat streaming loop is the exposed one.
**Fix:** Reset the timer on each received token (sliding inactivity timeout), or
clear it once the stream object is obtained and rely on a per-chunk watchdog:
```ts
for await (const chunk of stream) {
  clearTimeout(timer);
  timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS); // sliding
  // ...
}
```

## Info

### IN-01: `OutlierTile` never renders the "Your channel" source it documents

**File:** `src/components/discover/outlier-tile.tsx:11,38` + `discover-client.tsx:55-59`
**Issue:** Both the tile doc and the `source` field comment list "Your channel"
as a possible label, but `displaySource` only ever returns the niche label or the
literal `"Competitor"` for profile mode (own-vs-competitor is deferred to W3/W4).
The dead "Your channel" branch is misleading documentation.
**Fix:** Drop "Your channel" from the comments until the own/competitor split
lands, or note it as deferred.

### IN-02: `DiscoverGridState` comment lists an `"empty"` state the type does not have

**File:** `src/components/discover/discover-grid.tsx:13,28`
**Issue:** The header comment enumerates four states including `empty`, but the
exported `DiscoverGridState` type is `"idle" | "loading" | "error" | "results"` —
"empty" is folded into the `results && tiles.length === 0` branch. Comment drifts
from the type.
**Fix:** Update the comment to reflect that empty is a sub-state of `results`.

### IN-03: Resolved audience weights are computed then discarded in four runners

**File:** `chat-runner.ts:148-149`, `hooks-runner.ts:311-312`, `script-runner.ts:271-272`, `two-audience-read.ts:66-67`
**Issue:** Each runner calls `resolveAudienceWeights(...)` and immediately
`void`s the result with a "wired for future Max-path" comment. This is dead
computation on every request (the call does real array work) plus four copies of
the same speculative-generality pattern. Acceptable as a documented seam, but it
is dead code today.
**Fix:** Defer the call until the Max path actually consumes it, or extract the
"resolve + void" into one helper so the speculative seam lives in one place.

### IN-04: `as never` cast on the Qwen `create` call suppresses type checking

**File:** `src/lib/tools/runners/hooks-runner.ts:154`, `src/lib/tools/runners/script-runner.ts:137`
**Issue:** The `response_format: { type: "json_object" }` request object is cast
`as never` to bypass the SDK type. `as never` disables all type checking on the
argument — a typo in any field (model, messages, seed) would not be caught.
**Fix:** Cast to the SDK's request type or augment the param type narrowly rather
than `as never`.

### IN-05: `audienceName` STEER tag uses `.min(1).optional()` — empty string silently invalid

**File:** `src/lib/tools/blocks.ts:220` + `remix-runner.ts:248`
**Issue:** The schema requires `audienceName` to be non-empty when present. The
runner spreads it only for a calibrated audience, so empty-string never reaches
validation today — fine. But if a future caller passes `audienceName: ""`, the
whole remix-card block fails `safeParse` and is silently dropped
(`remix-runner.ts:254-258`) with only a warning, losing the card. Brittle coupling
between an optional field's min-length and a silent drop-on-invalid.
**Fix:** Either make it `.optional()` without `.min(1)` (renderer already guards
`audienceName ?`), or coerce empty to omitted at the schema boundary.

### IN-06: Sidebar "Log Out" only navigates to `/` without clearing the session

**File:** `src/components/app/sidebar.tsx:85-87`
**Issue:** The `log-out` case does `router.push("/")` but never calls
`supabase.auth.signOut()` (or any session teardown). The user's auth cookie
remains valid, so "Log Out" is cosmetic — navigating back into `/dashboard`
re-enters an authenticated session. (Out of strict phase scope, but it's in a
reviewed file and is a real auth-UX defect.)
**Fix:** Call the sign-out flow before navigating, e.g. `await supabase.auth.signOut()`
via a client helper, then redirect.

---

_Reviewed: 2026-06-19T09:08:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
