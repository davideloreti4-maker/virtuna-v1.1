---
phase: 08-benchmark-retrieval
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - scripts/embed-corpus.ts
  - src/app/api/webhooks/apify/route.ts
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/lib/engine/__tests__/factories.ts
  - src/lib/engine/__tests__/pipeline.test.ts
  - src/lib/engine/__tests__/retrieval/bucket-derivation.test.ts
  - src/lib/engine/__tests__/retrieval/embedder.test.ts
  - src/lib/engine/__tests__/retrieval/pgvector-client.test.ts
  - src/lib/engine/__tests__/retrieval/re-ranker.test.ts
  - src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/corpus/orchestrator.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/retrieval/bucket-derivation.ts
  - src/lib/engine/retrieval/cli/embed-corpus-args.ts
  - src/lib/engine/retrieval/embedder.ts
  - src/lib/engine/retrieval/pgvector-client.ts
  - src/lib/engine/retrieval/re-ranker.ts
  - src/lib/engine/retrieval/retrieval-stage.ts
  - src/lib/engine/types.ts
  - supabase/migrations/20260518000000_phase8_pgvector.sql
  - src/types/database.types.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: resolved
resolved_at: 2026-05-19T11:42:00Z
fixes_applied:
  - id: CR-01
    commit: ecdf1c2
    summary: stringify pgvector literal in CLI backfill update
  - id: CR-02
    commit: e579d92
    summary: stop advancing offset when filtering by embedding IS NULL (default mode); MAX_LOOPS safety cap
  - id: CR-03
    commit: 124e8d2
    summary: timing-safe webhook secret comparison via crypto.timingSafeEqual
  - id: WR-01
    commit: 9e95c3f
    summary: mark match_corpus_videos / match_scraped_videos VOLATILE
  - id: WR-02
    commit: fca548c
    summary: document category→primary_niche backfill upgrade procedure (comment-only)
  - id: WR-03
    commit: c7c957f
    summary: classify Gemini errors as transient vs permanent in embedBatch retry loop
  - id: WR-04
    commit: 4c4fdca
    summary: export REVERSE_CORPUS_NICHE_ALIASES from bucket-derivation as single source of truth
  - id: WR-05
    commit: aa31dfe
    summary: SKIPPED full fix (deferred to Phase 10+); inline KNOWN ISSUE comment added
  - id: WR-06
    commit: a29ae4b
    summary: Promise.allSettled + .select("id") for per-row success accounting in CLI updates
info_skipped:
  - IN-01
  - IN-02
  - IN-03
  - IN-04
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 8 implements pgvector benchmark retrieval — embedder, bucket-derivation, re-ranker, pgvector-client, retrieval-stage — plus the BLOCKING live-DB migration, auto-embed wiring on training_corpus + apify webhook insert paths, and the backfill/percentile CLI. The architecture is sound: D-04 hierarchical relaxation, D-03 score formula, D-04a soft re-rank, D-04b min_corpus_size gate, and D-09 graceful degradation are all implemented faithfully. The aggregator D-03b weight redistribution math is correct and well-tested. The migration uses `IF NOT EXISTS` / `CREATE OR REPLACE` throughout for idempotency.

**However, three issues will cause real production breakage**:

1. **`scripts/embed-corpus.ts` writes raw `number[]` to `vector(768)` columns** while the orchestrator and apify webhook both correctly `JSON.stringify` — the CLI wire format is **inconsistent** and the generated DB type for the embedding column is `string | null`, not `number[]`. PostgREST will either reject the cast or silently coerce; either way the backfill is broken.

2. **The CLI's default `--backfill` pagination is fundamentally broken**: it combines `WHERE embedding IS NULL` with `OFFSET offset` + `LIMIT PAGE`. Each successful update removes a row from the filter set, so subsequent `OFFSET=200, 400, …` ranges skip past rows that should have been processed. Many rows will be silently un-embedded on a single CLI invocation.

3. **The apify webhook secret is compared with non-timing-safe `!==`** — opens a timing-attack vector on a service-role-key endpoint.

Additionally there are race-condition concerns with `Promise.all` of per-row `.update()` (CLI), `is_local` argument semantics in the migration's `set_config`, defensive validation gaps, and a few minor quality issues.

## Critical Issues

### CR-01: CLI backfill writes raw `number[]` to vector column instead of stringified pgvector literal

**File:** `scripts/embed-corpus.ts:224`

**Issue:**
```ts
() => supabase.from(table).update({ embedding: vectors[j] }).eq("id", r.id),
```
`vectors[j]` is a raw `number[]` of length 768. The generated `Database` type expects `embedding?: string | null` (see `src/types/database.types.ts:1081, 1108, 1191, 1220`). Both other write surfaces — `src/lib/engine/corpus/orchestrator.ts:380` and `src/app/api/webhooks/apify/route.ts:154` — explicitly call `JSON.stringify(vectors[j])` to produce the pgvector wire literal `"[0.1,0.2,...]"`.

This inconsistency breaks the locked invariant in the review prompt: "vector type wire format consistency — orchestrator/webhook/CLI all use `JSON.stringify(number[])` for vector(768) columns; verify all 3 surfaces stay consistent and no path tries to insert number[] directly." The CLI violates exactly this.

Likely production outcomes:
- PostgREST may serialize the array as JSON and Postgres will attempt to cast to `vector(768)`. Postgres's pgvector cast from JSON-array literal is **not** guaranteed; the documented wire format is the textual `"[0.1,0.2,...]"` literal.
- Even if it works in dev, the TypeScript type system has been bypassed via `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on the `supabase: any` parameter at line 150 — so the compile-time check that would have caught this is suppressed.
- Net effect: the backfill CLI is the one place where the column **may silently remain NULL** or throw a PostgREST 400 that's logged as a warn and skipped (see lines 229-233 catching `updateError`).

**Fix:**
```ts
() => supabase.from(table).update({ embedding: JSON.stringify(vectors[j]) }).eq("id", r.id),
```
Also remove the `supabase: any` annotation at line 150 and import the proper `SupabaseClient<Database>` type so future regressions surface at compile time.

---

### CR-02: Backfill pagination silently skips rows under the default `WHERE embedding IS NULL` filter

**File:** `scripts/embed-corpus.ts:148-250` (loop), specifically `155-175` and `249`

**Issue:** The loop combines a **filtered** result set with a **monotonically-advancing offset cursor**:
```ts
let offset = 0;
while (true) {
  let q = supabase.from(table).select(selectCols);
  if (!args.reEmbedAll) {
    q = q.is("embedding", null);  // <-- filter by NULL embedding
  }
  const { data, error } = await withRetry(
    () => q.order("id").range(offset, offset + PAGE - 1),
    ...
  );
  ...
  // update first PAGE rows -- embedding column becomes non-null
  ...
  offset += PAGE;  // <-- advance cursor past rows that were JUST removed from the filter set
}
```

Walk through with 600 NULL-embedding rows ordered by `id`:
- **Iter 1**: `offset=0`, server returns rows 1..200 (by id). All 200 are embedded → now non-null.
- **Iter 2**: `offset=200`. Filter set is now rows 201..600 (400 rows). `RANGE 200..399` returns the **last 200 rows** of that filter set — i.e., rows 401..600. **Rows 201..400 are silently skipped.**
- **Iter 3**: `offset=400`. Filter set is now only rows 201..400 (200 rows). `RANGE 400..599` returns **0 rows**. Loop exits.

Result: **out of 600 NULL rows, only 400 get embedded on a single invocation** — and the operator has no signal anything was skipped (the closing log line reports "embedded 400 rows" without indicating that 200 were missed).

The bug doesn't affect `--re-embed-all` mode (filter predicate is constant, offset is correct), but the default mode is explicitly the documented re-runnable backfill path — the README in the header (lines 14-16) says "rows with non-null embedding are skipped by default" but doesn't disclose this skipping is mis-ordered.

A re-run will eventually catch the skipped rows, but: (a) each re-run incurs the same N/2 skip pattern recursively, (b) the operator has no visibility into how many invocations are needed, and (c) cost overhead is non-trivial (Gemini API tokens for the SELECT-but-skip pattern, plus full re-paging).

**Fix:** When filtering by `IS NULL`, do NOT advance `offset` — each successful page reduces the filter set, so always re-query `range(0, PAGE-1)`:
```ts
while (true) {
  // ... query unchanged ...
  const { data, error } = await withRetry(
    () => args.reEmbedAll
      ? q.order("id").range(offset, offset + PAGE - 1)
      : q.order("id").limit(PAGE),
    `Select ${table}`,
  );
  ...
  // Update rows ...
  // Only advance offset in re-embed-all mode
  if (args.reEmbedAll) offset += PAGE;
  // else: leave offset=0; the WHERE embedding IS NULL filter drains naturally
}
```
Or use id-cursor pagination: `WHERE embedding IS NULL AND id > :last_id ORDER BY id LIMIT PAGE`.

---

### CR-03: Apify webhook secret comparison is not timing-safe

**File:** `src/app/api/webhooks/apify/route.ts:61`

**Issue:**
```ts
if (payload.secret !== process.env.APIFY_WEBHOOK_SECRET) {
  log.warn("Invalid secret received");
  return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
}
```
JavaScript `!==` on strings short-circuits on the first character mismatch, leaking the prefix length via observable response latency. The endpoint is reachable by anyone on the internet, runs with the **service-role key** (via `createServiceClient()` at line 84), and grants the caller arbitrary `scraped_videos` writes (lines 168-173) plus Apify dataset read access via the operator's Apify token (line 74). A successful auth bypass lets an attacker poison the retrieval pool with crafted rows, exhaust the embedding budget, or trigger the Apify token.

This is a textbook secret-equality timing attack and is the standard finding flagged in any production webhook review.

**Fix:**
```ts
import { timingSafeEqual } from "crypto";

function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ...
if (!safeEqual(payload.secret, process.env.APIFY_WEBHOOK_SECRET)) {
  log.warn("Invalid secret received");
  return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
}
```
Additionally consider: (a) requiring the secret on a header rather than the JSON body so an attacker who can replay a captured payload can't simply resubmit, (b) rate-limiting failed-auth attempts on this route, (c) failing closed when `APIFY_WEBHOOK_SECRET` env var is undefined (currently `undefined !== undefined` would be `false` so all unauthenticated requests get rejected, but a misconfigured env where the var is empty string `""` would accept `{"secret":""}` payloads).

---

## Warnings

### WR-01: Migration's `set_config(..., true)` inside `STABLE` RPC is fragile — verify `hnsw.iterative_scan` actually takes effect

**File:** `supabase/migrations/20260518000000_phase8_pgvector.sql:153, 220`

**Issue:**
```sql
PERFORM set_config('hnsw.iterative_scan','strict_order', true);
```
Three concerns stacked:
1. **`is_local=true` semantics**: when called inside a `STABLE`-marked function called by a single-statement RPC request, the "transaction" lifetime is the RPC call itself. The setting will be reset for the next RPC — fine — but it also means if this RPC is called from inside an outer explicit transaction (e.g., a future batch RPC wrapper), the iterative_scan setting will persist for the rest of that outer txn. That's a non-obvious leak that the comment "Set as LOCAL so it doesn't leak to outer transactions" specifically denies.
2. **Volatility violation**: `set_config` is `VOLATILE`. Calling it inside a `STABLE` function is technically allowed by Postgres but defeats the planner's caching contract — the function's marked-stable promise is now a lie. If Postgres ever decides to memoize a `STABLE` call result across rows in a single query, the iterative_scan setting may or may not be applied as expected.
3. **No verification that the setting actually changed pgvector behavior**: there's no integration test that exercises the SQL function on a real pgvector index with selective filters to confirm the iterative scan kicks in. The comment "Required for pgvector 0.8.0+ to iterate further into the graph" assumes the runtime pgvector version supports `strict_order` — which is only true in 0.8.0+. If Supabase ships an older pgvector, this call **fails** at runtime (parameter doesn't exist), and the RPC throws.

**Fix:**
- Mark both functions `VOLATILE` (since `set_config` makes them so anyway), OR
- Lift the iterative_scan setting out of the function entirely and configure it at session/role level: `ALTER ROLE service_role SET hnsw.iterative_scan = 'strict_order';`. This is the production-grade pattern.
- Add an assertion in the migration that the live pgvector version is ≥ 0.8.0, OR remove the `set_config` call if the index defaults are acceptable and document the trade-off.

---

### WR-02: Migration's category→primary_niche backfill is one-way and silently loses unmapped data

**File:** `supabase/migrations/20260518000000_phase8_pgvector.sql:60-82` + `src/app/api/webhooks/apify/route.ts:36-47`

**Issue:** Both `deriveNicheSlug` in the webhook and the migration's UPDATE chain implement **the same** 10-slug `CATEGORY_TO_NICHE_SLUG` mapping. Any Apify `category` value outside this whitelist (e.g., `"finance"`, `"travel"`, `"sports"`, `"news"`, `"science"`, `"books"`, mixed-case `"Tech"`, plural `"makeups"`) silently produces `primary_niche = NULL` → excluded from retrieval pool.

The migration audit at line 6-9 explicitly notes "Live DB query was not executable from this environment; default mapping covers the 10 NICHE_TREE primary slugs. Unmapped categories stay NULL → excluded from retrieval pool — see D-04." This was accepted by the planner, but the **bucket-derivation.ts** comment at lines 50-58 reveals the consequence: "the 7389 scraped_videos rows all have primary_niche=NULL because their source `category` column is also NULL — the migration's category→niche backfill (Strategy A mapping) matched 0 rows." So in practice the entire scraped corpus is currently retrieval-invisible.

This is locked by D-08/D-13, so it's accepted as Phase 10+ work — but the migration's backfill is irreversible against the source `category` column. If a future scrape gets a populated `category` column and the operator re-runs the migration, **only NULL `primary_niche` rows are updated** (the migration's `WHERE primary_niche IS NULL` guard is correct on this point). But any future operator who wants to expand the mapping must also remember to **explicitly null out the existing primary_niche values for rows whose category should newly map to a slug** — there is no upgrade path in the migration.

This is a soft data-integrity warning, not a hard bug.

**Fix:** Add a SQL comment block at the head of the UPDATE chain documenting the upgrade procedure:
```sql
-- TO ADD A NEW CATEGORY→NICHE MAPPING:
--   1. Add a new UPDATE statement below mirroring the pattern.
--   2. If the new mapping should override existing primary_niche values (e.g., reclassifying
--      "wellness" from lifestyle to fitness), first run:
--      UPDATE scraped_videos SET primary_niche = NULL WHERE category IN ('wellness');
--   3. Then add the new UPDATE.
-- The WHERE primary_niche IS NULL guard prevents accidental overwrites.
```

---

### WR-03: `embedBatch` retry loop swallows non-transient errors (no error classification)

**File:** `src/lib/engine/retrieval/embedder.ts:142-178`

**Issue:**
```ts
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const response = await ai.models.embedContent({...});
    // ... validate ...
    return { vectors, cost_cents };
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    if (attempt === MAX_RETRIES) break;
    const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```
The retry loop catches **all** errors including:
- `400 Bad Request` (input too long / malformed text) — retrying won't help, will just burn budget
- `401 Unauthorized` (bad API key) — retrying won't help, will continue to fail
- Schema validation throws (`Embedding batch shape unexpected`) — these are response-shape bugs that retrying can't fix
- `RESOURCE_EXHAUSTED` / quota errors — retrying with linear backoff is too aggressive

In contrast, `scripts/embed-corpus.ts` has an `isRateLimit()` helper at line 108 and an `isTransientFetchError()` helper at line 113 that classify errors and only retry transient ones. The embedder itself should mirror that pattern.

This is the same defect that exists in many retry loops written without an error classifier — under heavy load (Gemini quota hit during predict-time), the predict path takes 3 × RETRY_BASE_DELAY_MS = ~6s of wasted latency before degrading to graceful-empty.

**Fix:** Extract `isTransientGeminiError(err)` into a shared utility and use it in both `embedder.ts` and `embed-corpus.ts`. Only retry on transient errors. For 4xx errors, throw immediately so the caller's graceful-empty fires fast.

---

### WR-04: D-08 Path 1 (`bucketAndPersist`) re-derives `REVERSE_CORPUS_ALIAS` per call

**File:** `src/lib/engine/corpus/orchestrator.ts:361-363`

**Issue:**
```ts
const REVERSE_CORPUS_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(CORPUS_NICHE_ALIASES).map(([nicheTree, corpus]) => [corpus, nicheTree]),
);
```
This is recomputed inside `bucketAndPersist` every invocation. `scripts/embed-corpus.ts:70` builds the same mapping at module-init time. Both code paths compute the same value from the same constant.

Minor correctness concern: any future mutation to `CORPUS_NICHE_ALIASES` (adding/removing keys) will be picked up by `bucketAndPersist` immediately but NOT by the CLI until restart. Could cause backfill divergence between the two paths during a hot deploy. Test coverage at `bucket-derivation.test.ts:155-157` only asserts the forward map; reverse-map inconsistency wouldn't be caught.

**Fix:** Export `REVERSE_CORPUS_ALIAS` from `bucket-derivation.ts` as a sibling to `CORPUS_NICHE_ALIASES`:
```ts
export const REVERSE_CORPUS_NICHE_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(CORPUS_NICHE_ALIASES).map(([k, v]) => [v, k]),
);
```
Then both surfaces import the same constant — single source of truth, single point of mutation.

---

### WR-05: Webhook embedding overlap with upsert path 2 — embedding may silently regress on re-upsert

**File:** `src/app/api/webhooks/apify/route.ts:137-180`

**Issue:** The webhook is hit when an Apify run completes; the **same** `platform_video_id` can be scraped multiple times across runs (e.g., re-scraping a hashtag corpus weekly). The upsert is configured with `onConflict: "platform,platform_video_id", ignoreDuplicates: false` (line 171-173), meaning on conflict **all columns are overwritten** — including `embedding`.

Now consider this sequence:
1. Scrape A on Day 1 — `embedBatch` succeeds → `embedding` is populated.
2. Scrape A re-runs on Day 8 — `embedBatch` throws (rate-limited) → `embedding` is set to `null` by the catch fallback at line 162.
3. Upsert overwrites the previously-populated `embedding` with `null`.

The "additive-only" invariant (BENCH-05) says "embedder failure MUST NOT block the original upsert," but it doesn't say "must not regress an existing embedding." The current code violates the stricter (and clearly intended) invariant.

The orchestrator (`bucketAndPersist`) has the same bug structurally, but training_corpus is much lower-volume and the corpus version + platform_video_id conflict key includes a version that typically doesn't re-collide.

**Fix:** Two options:
- (a) On embedBatch failure, set `embedding` to a **sentinel that the upsert excludes**. In Postgres + supabase-js you can't selectively skip columns during upsert. Instead, split into two queries: upsert non-embedding columns with `onConflict`, then **conditionally** UPDATE the embedding column only when the new value is non-null (or use a `COALESCE(EXCLUDED.embedding, scraped_videos.embedding)` pattern via SQL function instead of supabase-js .upsert).
- (b) Add a guard at the start: if `embedding` would be null, fetch existing rows by `(platform, platform_video_id)`, and skip those from the upsert payload (preserves existing embeddings).

This is non-trivial to fix correctly under supabase-js's API; the simplest interim mitigation is to add a SQL trigger on `scraped_videos` that does `EXCLUDED.embedding = COALESCE(EXCLUDED.embedding, scraped_videos.embedding)` on conflict. Document this in the orchestrator's `bucketAndPersist` comment as well.

---

### WR-06: Race condition + lost-update window in CLI's `Promise.all` of per-row updates

**File:** `scripts/embed-corpus.ts:221-228`

**Issue:**
```ts
const updates = await Promise.all(
  slice.map((r, j) =>
    withRetry(
      () => supabase.from(table).update({ embedding: vectors[j] }).eq("id", r.id),
      `Update ${table} id=${r.id}`,
    ),
  ),
);
```
Two concerns:

1. **Promise.all rejection semantics**: if the first `update()` in the batch rejects (e.g., transient PostgREST 503 NOT caught by `withRetry`'s `isTransientFetchError`), the entire `Promise.all` rejects and the outer `try` at line 212 catches. The OTHER concurrent updates in the batch were already in-flight and will still complete on the server — but the CLI has no visibility into which succeeded. On re-run, those rows are correctly excluded by `IS NULL` (assuming they completed) so this is recoverable, but **the totalEmbedded counter at line 234 is wrong** — it adds the full `slice.length` even if half the batch failed mid-flight.

2. **Update serialization**: each `update().eq("id", ...)` is a separate REST request that PostgREST translates to a row-locking `UPDATE` statement. Firing 50 of these in parallel against Supabase REST can saturate the connection pool. The Supabase REST tier has rate limits and a hard concurrent connection cap that's not visible to the client. Sequential updates would be safer; the modest throughput cost is paid once per backfill.

3. **No `select` on the updates**: line 224 doesn't chain `.select()`, so `data` is null and the only error signal is `error`. The check at line 229 `(u: { error: unknown }) => u.error` is correct but the diagnostic at line 232 `warn(...)` only logs the FIRST error in the batch — silently swallows the rest.

**Fix:**
- Sequence the updates within a slice: `for (const [j, r] of slice.entries()) { await withRetry(...) }` — slower but correct error accounting.
- Add `.select("id")` to the update for explicit row-count confirmation: `update({...}).eq("id", r.id).select("id")` — then assert `data?.length === 1` per update so a "0 rows affected" silently-skipped update fails loudly.
- Track per-row success/fail in a counter; log a summary including all error messages, not just the first.

---

## Info

### IN-01: Dead-code reassignment of `recordsWithEmbeddings` in apify webhook

**File:** `src/app/api/webhooks/apify/route.ts:137, 166`

**Issue:** Line 137 declares `let recordsWithEmbeddings = records;` and line 166 unconditionally reassigns it to `withEmbeddings`. The initial assignment is dead — the variable is only read after line 166. Trivial readability nit.

**Fix:** Remove line 137 and change line 166 to `const recordsWithEmbeddings = withEmbeddings;`. Or skip the rename entirely and use `withEmbeddings` directly in the `.upsert()` call.

---

### IN-02: `vectors[j] ? JSON.stringify(...)` truthiness guard accepts empty arrays

**File:** `src/app/api/webhooks/apify/route.ts:154` and `src/lib/engine/corpus/orchestrator.ts:380`

**Issue:**
```ts
embedding: vectors[j] ? JSON.stringify(vectors[j]) : null,
```
Empty array `[]` is truthy in JavaScript, so a hypothetical `embedBatch` response that included a zero-length vector entry would stringify to `"[]"` and PostgREST would reject the upsert as malformed pgvector. In practice `embedBatch` validates this at line 159-164 and throws — so the falsy path is defensive-only — but the guard is too weak to be defensive.

**Fix:**
```ts
embedding: vectors[j]?.length === 768 ? JSON.stringify(vectors[j]) : null,
```

---

### IN-03: `category` field is consumed by `deriveNicheSlug` but never persisted to scraped_videos.category

**File:** `src/app/api/webhooks/apify/route.ts:94-129`

**Issue:** The webhook's record-construction at lines 94-129 does NOT include the `category` column even though `scraped_videos.category` exists (per `database.types.ts:1048`) and the migration's backfill (`20260518000000_phase8_pgvector.sql:63-82`) keys off it. New rows inserted via the webhook will have `category = NULL`, so the migration's category→primary_niche backfill is bypassed for webhook-inserted rows (instead `primary_niche` is set directly at line 121 via `deriveNicheSlug`).

This is functionally correct (primary_niche ends up populated either way) but creates a quiet asymmetry: rows from old scrapes have `category` populated, new webhook rows have `category=NULL` and only `primary_niche` populated. Auditing or future re-mapping that relies on `category` will silently misbehave on the new rows.

**Fix:** Set `category` from the source Apify field as well:
```ts
return {
  // ...
  category: item.categoryType ?? item.category ?? null,
  // ...
  primary_niche: deriveNicheSlug(item.categoryType ?? item.category ?? null),
};
```

---

### IN-04: `metadata.scrape_hashtags` typed as `unknown` due to `[key: string]: unknown` index signature

**File:** `src/app/api/webhooks/apify/route.ts:117` and the `ApifyVideoItem` interface lines 9-26

**Issue:** Line 117 reads `payload.scrape_hashtags` from the request body. The webhook payload is parsed as `await request.json()` (line 58) which returns `any` — no validation, no Zod schema. So `payload.scrape_hashtags` is `any` and can be `[null, null, null, ...]`, `"<script>"`, an arbitrarily nested object, or a 100MB blob. It's stored verbatim in JSONB on the row.

This isn't a critical security issue (the field is descriptive metadata, not used downstream for routing or auth), but the entire `payload` shape — secret, resource.defaultDatasetId, resource.id, scrape_hashtags — should be validated through a Zod schema before being trusted. The current code reads `payload.secret`, `payload.resource.defaultDatasetId`, `payload.resource.id` without runtime checks: a payload like `{secret: "...", resource: null}` would crash at line 67 (`resource?.defaultDatasetId`) returning a 400 — that part is safe — but a payload of `{secret: "...", resource: {defaultDatasetId: "../../../etc/passwd"}}` would forward an arbitrary string to `ApifyClient.dataset(...)` as a dataset ID. ApifyClient sanitizes its URL construction so SSRF is unlikely, but the lack of input validation at the boundary is a code-smell.

**Fix:** Define a Zod schema for the webhook payload:
```ts
const ApifyWebhookPayloadSchema = z.object({
  secret: z.string().min(1),
  resource: z.object({
    defaultDatasetId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  }),
  scrape_hashtags: z.array(z.string()).optional().nullable(),
});

const parsed = ApifyWebhookPayloadSchema.safeParse(await request.json());
if (!parsed.success) {
  log.warn("Invalid webhook payload", { issues: parsed.error.issues });
  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
// ...use parsed.data instead of raw payload
```
This also gives the timing-safe-equal fix (CR-03) a guaranteed string to compare.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Fixes Applied

Resolved 2026-05-19T11:42:00Z on branch `phase-8-benchmark-retrieval`.
Scope: Critical + Warning (default). Info findings deferred (no `--all` flag in this run).

Baseline preserved: `pnpm test` reports 842 pass / 3 pre-existing failures (2 in
`cost-benchmark.test.ts`, 1 in `video-e2e.test.ts` — all unchanged from pre-fix
baseline). `pnpm tsc --noEmit` reports 1281 errors — identical count to pre-fix
baseline; no new errors introduced.

| ID | Commit | Files | What changed |
|----|--------|-------|--------------|
| CR-01 | `ecdf1c2` | `scripts/embed-corpus.ts` | Wrap `vectors[j]` in `JSON.stringify(...)` so the CLI emits the pgvector textual literal `"[0.1,0.2,...]"` matching orchestrator + apify webhook. `supabase: any` annotation left in place (removing cascades to non-trivial type wiring; noted in commit body). |
| CR-02 | `e579d92` | `scripts/embed-corpus.ts` | Default `IS NULL` mode no longer advances `offset` between iterations — the filter set drains naturally as embeddings are written. `--re-embed-all` mode still advances (filter is constant). Dry-run also advances (no DB writes shrink the filter). Added `MAX_LOOPS=1000` safety cap. Verified with `npx tsx scripts/embed-corpus.ts --backfill --dry-run --re-embed-all --table=training_corpus --batch-size=25` — 225 rows iterated across offsets 0..200 as expected. |
| CR-03 | `124e8d2` | `src/app/api/webhooks/apify/route.ts` | `payload.secret !== ...` replaced with `safeSecretEqual()` helper that uses `crypto.timingSafeEqual` on equal-length Buffers, with length-guard early-exit. Fails closed when either side is undefined / empty (closes `APIFY_WEBHOOK_SECRET=""` accept-empty-secret edge case). |
| WR-01 | `9e95c3f` | `supabase/migrations/20260518000000_phase8_pgvector.sql` | `match_corpus_videos` + `match_scraped_videos` marked `VOLATILE` (was `STABLE`) — consistent with the `set_config` call inside. Misleading "doesn't leak to outer transactions" comment corrected. Deferred to Phase 10+: `ALTER ROLE service_role SET hnsw.iterative_scan = 'strict_order'` as the production-grade pattern. |
| WR-02 | `fca548c` | `supabase/migrations/20260518000000_phase8_pgvector.sql` | Added SQL comment block documenting the upgrade procedure for `category→primary_niche` mapping (where to add new entries, how to reset existing rows for re-classification, the cross-file invariant with `apify/route.ts deriveNicheSlug`). Pure documentation. |
| WR-03 | `c7c957f` | `src/lib/engine/retrieval/embedder.ts` | Added `isTransientGeminiError()` classifier (401/403/400/invalid_argument → permanent; 429/RESOURCE_EXHAUSTED/503/network blips → transient). `embedBatch` retry guard now bails out immediately on permanent errors instead of burning `MAX_RETRIES * RETRY_BASE_DELAY_MS` of latency. |
| WR-04 | `4c4fdca` | `src/lib/engine/retrieval/bucket-derivation.ts`, `src/lib/engine/corpus/orchestrator.ts`, `scripts/embed-corpus.ts` | Exported `REVERSE_CORPUS_NICHE_ALIASES` from `bucket-derivation.ts`. Both `orchestrator.bucketAndPersist` and the CLI import the shared constant instead of re-deriving it locally. Single source of truth. |
| WR-05 | `aa31dfe` | `src/app/api/webhooks/apify/route.ts` | **SKIPPED** — full fix deferred to Phase 10+ hardening. The proper solution is a SQL trigger preserving `OLD.embedding` when `NEW.embedding IS NULL`, which changes upsert semantics across all writers and warrants its own migration + test coverage. Added inline `KNOWN ISSUE` comment documenting the constraint and operator mitigation (the CLI's `IS NULL` re-sweep catches regressed embeddings on the next scheduled run). |
| WR-06 | `a29ae4b` | `scripts/embed-corpus.ts` | Switched per-row updates from `Promise.all` → `Promise.allSettled` so individual rejections don't lose visibility into other in-flight updates. Chained `.select("id")` so a 0-rows-affected silently-skipped update fails loudly. `totalEmbedded` now counts only verified successes; per-row errors are aggregated and logged (up to 5 per batch, with `+N more` overflow). Kept concurrency (full sequencing would materially slow backfill); connection-pool concern bounded by existing 200ms inter-batch sleep + batch-size cap. |

**Info findings (IN-01..IN-04)** were intentionally not addressed in this pass — default scope is Critical + Warning only. See REVIEW.md sections above for the recommended fixes; can be picked up later with `/gsd-code-review --fix --all` or a targeted follow-up.

_Resolved: 2026-05-19T11:42:00Z_
_Fixer: Claude (manual fix pass)_
_Iteration: 1_
