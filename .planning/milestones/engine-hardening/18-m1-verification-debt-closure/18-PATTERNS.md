# Phase 18: M1 Verification Debt Closure - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 6 files to modify/create
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/engine/deepseek.ts` | service | request-response | `src/lib/engine/qwen/omni-analysis.ts` | exact |
| `src/lib/engine/rules.ts` | service | request-response | `src/lib/engine/qwen/omni-analysis.ts` | exact |
| `src/lib/supabase/pgvector.ts` | utility | transform | `src/lib/supabase/service.ts` | role-match |
| `src/app/api/webhooks/apify/route.ts` | route | CRUD | `src/lib/engine/corpus/orchestrator.ts` | exact (same call site pattern) |
| `src/lib/engine/corpus/orchestrator.ts` | service | batch | `src/app/api/webhooks/apify/route.ts` | exact (same call site pattern) |
| `src/app/api/cron/calculate-trends/route.ts` | route | CRUD | `src/app/api/cron/calculate-trends/route.ts` (self, WR-04 block) | self-verify |

---

## Pattern Assignments

### `src/lib/engine/deepseek.ts` — IN-01 timer fix (service, request-response)

**Analog:** `src/lib/engine/qwen/omni-analysis.ts`

**Problem (lines 467–545):** `setTimeout` created at L469, `clearTimeout` only in try path at L492. Catch block at L525 is missing `clearTimeout(timeout)`.

**Correct timer pattern from analog** (`omni-analysis.ts` lines 129–225):
```typescript
// CORRECT pattern — clearTimeout in BOTH try and catch
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // ... API call ...
    clearTimeout(timer);   // ← in try, after await resolves
    // ... process result ...
    return result;
  } catch (err: unknown) {
    clearTimeout(timer);   // ← in catch, FIRST statement
    lastError = err;
    // ... handle / retry ...
  }
}
```

**Current broken pattern in deepseek.ts** (lines 466–545):
```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // ...
    clearTimeout(timeout);   // L492 — in try only
    // ...
    return { reasoning, cost_cents };
  } catch (error) {
    // L525 — NO clearTimeout here  ← BUG
    lastError = error instanceof Error ? error : new Error(String(error));
    if (lastError.name === "AbortError") {
      // ...
    }
  }
}
```

**Fix:** Add `clearTimeout(timeout)` as the first statement inside the catch block at L525. Variable `timeout` is declared inside the for-loop's try block — either hoist declaration above the try block (preferred, matches omni-analysis pattern) or accept that the variable is accessible due to JS scoping within the same for-loop iteration.

**Recommended restructure** (hoist variable to match omni-analysis.ts exactly):
```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // ... existing try body unchanged ...
    clearTimeout(timeout);  // already here at L492
    // ...
    return { reasoning, cost_cents };
  } catch (error) {
    clearTimeout(timeout);  // ← ADD THIS
    lastError = error instanceof Error ? error : new Error(String(error));
    // ... rest of catch unchanged ...
  }
}
```

---

### `src/lib/engine/rules.ts` — IN-01 timer fix (service, request-response)

**Analog:** `src/lib/engine/qwen/omni-analysis.ts` (same pattern as deepseek.ts)

**Problem (lines 188–254):** `setTimeout` at L191, `clearTimeout` at L215 (try only), catch at L246 missing `clearTimeout`.

**Current broken pattern** (lines 188–254):
```typescript
try {
  const ai = getQwenClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEMANTIC_TIMEOUT_MS);  // L191

  const response = await ai.chat.completions.create(
    { ... },
    { signal: controller.signal }
  );

  clearTimeout(timeout);   // L215 — try path only
  // ... process response ...
  return result.data.evaluations;
} catch (error) {
  // L246 — NO clearTimeout  ← BUG
  log.warn("Semantic evaluation failed, falling back to regex-only", { ... });
  Sentry.captureException(error, { ... });
  return [];
}
```

**Fix:** Hoist `controller` and `timeout` declarations above the try/catch (same as deepseek.ts fix), then add `clearTimeout(timeout)` as first statement in catch:
```typescript
const ai = getQwenClient();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), SEMANTIC_TIMEOUT_MS);

try {
  const response = await ai.chat.completions.create(
    { ... },
    { signal: controller.signal }
  );
  clearTimeout(timeout);  // already in try
  // ...
} catch (error) {
  clearTimeout(timeout);  // ← ADD THIS
  log.warn("Semantic evaluation failed, falling back to regex-only", { ... });
  // ...
}
```

---

### `src/lib/supabase/pgvector.ts` — NEW FILE (utility, transform)

**Analog:** `src/lib/supabase/service.ts`

**Pattern from analog** (service.ts lines 1–21): single named export, no default export, JSDoc comment, no external dependencies beyond the `@/` alias convention.

```typescript
// service.ts — structural model for pgvector.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client with the service role key.
 * ...
 */
export function createServiceClient() {
  // ...
}
```

**New file content** (exact per D-08):
```typescript
/**
 * Serializes a pgvector embedding for storage in Supabase.
 *
 * Supabase pgvector columns expect the vector as a JSON array string (e.g. "[0.1,0.2,...]").
 * Centralises the cast so callers don't inline JSON.stringify with null guards.
 */
export function serializeVector(v: number[] | null | undefined): string | null {
  return v ? JSON.stringify(v) : null;
}
```

No imports needed. File lives at `src/lib/supabase/pgvector.ts` as a peer to `client.ts`, `server.ts`, `service.ts`, `middleware.ts`.

---

### `src/app/api/webhooks/apify/route.ts` — IN-02 import + replace (route, CRUD)

**Change scope:** Two changes at L190.

**Existing import block** (lines 1–6):
```typescript
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ApifyClient } from "apify-client";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";
```

**Add to imports:**
```typescript
import { serializeVector } from "@/lib/supabase/pgvector";
```

**Replace at L190** (inside embedBatch result map):
```typescript
// BEFORE:
embedding: vectors[j] ? JSON.stringify(vectors[j]) : null,

// AFTER:
embedding: serializeVector(vectors[j]),
```

Full context of the changed block (lines 186–200):
```typescript
try {
  const { vectors } = await embedBatch(texts);
  const merged = slice.map((row, j) => ({
    ...row,
    embedding: serializeVector(vectors[j]),   // ← was JSON.stringify(vectors[j])
  }));
  withEmbeddings.push(...merged);
} catch (err) {
  log.warn("Embedding batch failed in apify webhook; inserting with embedding=null", {
    offset: i + k,
    error: err instanceof Error ? err.message : String(err),
  });
  const nulled = slice.map((row) => ({ ...row, embedding: null as string | null }));
  withEmbeddings.push(...nulled);
}
```

---

### `src/lib/engine/corpus/orchestrator.ts` — IN-02 import + replace (service, batch)

**Change scope:** Same as apify webhook — add import, replace at L377.

**Existing import block** (lines 1–8):
```typescript
import { ApifyClient } from "apify-client";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { createReadStream, createWriteStream, mkdirSync, existsSync } from "fs";
import { createInterface } from "readline";
import { dirname, join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
```

**Add to imports:**
```typescript
import { serializeVector } from "@/lib/supabase/pgvector";
```

**Replace at L377** (inside embedBatch result map in `bucketAndPersist`):
```typescript
// BEFORE:
embedding: vectors[j] ? JSON.stringify(vectors[j]) : null,

// AFTER:
embedding: serializeVector(vectors[j]),
```

Full context (lines 373–388):
```typescript
try {
  const { vectors } = await embedBatch(texts);
  const merged = slice.map((row, j) => ({
    ...row,
    embedding: serializeVector(vectors[j]),   // ← was JSON.stringify(vectors[j])
  }));
  dbRowsWithEmbeddings.push(...merged);
} catch (err) {
  log.warn("Embedding batch failed in bucketAndPersist; inserting with embedding=null", {
    offset: i,
    error: err instanceof Error ? err.message : String(err),
  });
  const nulled = slice.map((row) => ({ ...row, embedding: null as string | null }));
  dbRowsWithEmbeddings.push(...nulled);
}
```

---

### `src/app/api/cron/calculate-trends/route.ts` — IN-03 SSRF guard + WR-04 verify (route, CRUD)

#### WR-04 verify (lines 208–228)

This block is already implemented. Executor reads and verifies — no code change needed:

```typescript
// 06-REVIEW.md WR-04: bulk-prefetch already-embedded sound_names for this
// batch so processSoundEmbedding can skip them without an N+1 SELECT per
// row. One query per BATCH_SIZE (50) rows instead of BATCH_SIZE separate
// maybeSingle()s. Failure is non-fatal — fall through to per-row check.
let alreadyEmbedded: Set<string> | undefined;
try {
  const batchNames = batch.map((r) => r.sound_name);
  const { data: embedded } = await supabase
    .from("trending_sounds")
    .select("sound_name")
    .in("sound_name", batchNames)
    .not("audio_embedding", "is", null);
  if (embedded) {
    alreadyEmbedded = new Set(embedded.map((r) => r.sound_name));
  }
} catch (err) {
  log.warn("Bulk idempotency prefetch failed — falling back to per-row check", {
    offset: i,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

Verification checklist for WR-04:
1. Bulk SELECT uses `.in("sound_name", batchNames)` — one query per batch, not per row. PASS.
2. `Set<string>` constructed from results. PASS.
3. Failure falls through gracefully via `log.warn` + undefined `alreadyEmbedded`. PASS.

#### IN-03 SSRF guard

**Location:** `processSoundEmbedding` function (lines 44–52). Currently a stub (audio pipeline deferred to M2). The SSRF guard must be added to this function before any future `fetch(sound_url)` call.

**`log.warn` pattern from WR-04 block** (L224 — established non-fatal cron error pattern):
```typescript
log.warn("Bulk idempotency prefetch failed — falling back to per-row check", {
  offset: i,
  error: err instanceof Error ? err.message : String(err),
});
```

**SSRF guard to add inside `processSoundEmbedding`** (per D-11 through D-15):
```typescript
async function processSoundEmbedding(
  _gemini: null,
  supabase: SupabaseClient,
  row: { sound_name: string; sound_url: string | null },
  alreadyEmbedded?: Set<string>,
): Promise<void> {
  // IN-03: SSRF guard — check before any fetch(sound_url) call.
  // Threat model: T-06-13. Permissive by design (no hostname allowlist).
  // Blocks only: non-HTTPS schemes + RFC1918/loopback IPs.
  if (row.sound_url) {
    let hostname: string;
    try {
      hostname = new URL(row.sound_url).hostname;
    } catch {
      log.warn("sound_url SSRF guard rejected — invalid URL", { sound_url: row.sound_url });
      return;
    }
    const isPrivate =
      /^localhost$/i.test(hostname) ||
      /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^169\.254\.\d+\.\d+$/.test(hostname) ||
      /^::1$/.test(hostname) ||
      /^f[cd][0-9a-f]{2}:/i.test(hostname); // fc00::/7 ULA
    const isHttps = row.sound_url.startsWith("https://");
    if (!isHttps || isPrivate) {
      log.warn("sound_url SSRF guard rejected", { sound_url: row.sound_url });
      return null;
    }
  }

  // DEFERRED to M2: audio embedding pipeline disabled.
  void supabase; void row; void alreadyEmbedded;
}
```

Note: current function signature returns `Promise<void>` but guard uses `return null` — executor should change return type to `Promise<void>` using bare `return` (no value) to match existing signature, or keep as-is since TypeScript accepts `return null` in a `Promise<void>` context. Bare `return;` is cleaner.

---

## Shared Patterns

### Logger instantiation
**Source:** `src/lib/engine/deepseek.ts` line 18, `src/lib/engine/rules.ts` (same pattern)
**Apply to:** `src/app/api/cron/calculate-trends/route.ts` IN-03 log.warn calls
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "module-name" });
// Usage:
log.warn("sound_url SSRF guard rejected", { sound_url: row.sound_url });
```

### Non-fatal cron error pattern (log.warn + return/continue)
**Source:** `src/app/api/cron/calculate-trends/route.ts` lines 223–227
**Apply to:** IN-03 SSRF violation handler
```typescript
log.warn("Bulk idempotency prefetch failed — falling back to per-row check", {
  offset: i,
  error: err instanceof Error ? err.message : String(err),
});
// No throw — cron continues processing remaining rows
```

### Supabase utility file structure
**Source:** `src/lib/supabase/service.ts` (entire file, 21 lines)
**Apply to:** `src/lib/supabase/pgvector.ts`
- No default export
- Single named export function
- JSDoc block comment above function
- `@/` alias imports only (pgvector.ts needs none)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/supabase/pgvector.ts` | utility | transform | No existing pgvector/vector serialization utility in codebase; new pattern. Structure follows `service.ts` but logic is novel. |

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/lib/supabase/`, `src/app/api/cron/`, `src/app/api/webhooks/`
**Files scanned:** 8
**Pattern extraction date:** 2026-05-25
