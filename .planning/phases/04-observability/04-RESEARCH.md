# Phase 4: Observability - Research

**Researched:** 2026-02-18
**Domain:** Error tracking (Sentry), structured logging, cost observability
**Confidence:** HIGH

## Summary

Phase 4 instruments the prediction engine with three observability layers: (1) Sentry error tracking to capture every pipeline failure as an issue with breadcrumb context, (2) a structured JSON logger that replaces all `console.*` calls in engine modules with machine-parseable output including `requestId`, `stage`, `duration_ms`, and `cost_cents`, and (3) an admin cost aggregation endpoint.

The codebase currently has **zero** Sentry integration, **zero** structured logging, and **24 `console.*` calls** across 6 engine modules (`rules.ts`, `gemini.ts`, `deepseek.ts`, `calibration.ts`, `ml.ts`, and the API `analyze/route.ts`). The `analysis_results` table already stores `cost_cents`, `gemini_model`, `deepseek_model`, and `created_at` per analysis, so the admin costs endpoint can query existing data without schema changes.

**Primary recommendation:** Use `@sentry/nextjs` (latest v10.x) for error tracking with the standard 4-file manual setup. Build a lightweight custom structured logger (~60 lines) rather than pulling in `pino`, since the logging needs are narrow (JSON output in prod, pretty in dev, child logger with bindings) and `pino` has known Edge runtime compatibility issues on Vercel. The admin costs endpoint is a simple Supabase aggregate query on `analysis_results`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/nextjs` | ^10.39.0 | Error tracking, breadcrumbs, performance | Official Sentry SDK for Next.js; auto-instruments Server Components, API routes, middleware |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | Structured logging | Custom lightweight logger (see Architecture Patterns) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom logger | `pino` + `pino-pretty` | Pino is faster and more feature-rich, but has Edge runtime compatibility issues (`pino.transport is not a function` in middleware), requires `pino-pretty` dev dep, and adds ~150KB. Our logging needs are narrow enough that a 60-line utility suffices. |
| Custom logger | `winston` | Heavier than pino, worse serverless perf, no Edge support. Overkill for this use case. |
| `@sentry/nextjs` | Axiom / LogRocket | Sentry is the de facto standard for error tracking in Next.js on Vercel. Axiom is for log aggregation (not error tracking). LogRocket is session replay focused. |

**Installation:**
```bash
pnpm add @sentry/nextjs
```

No other dependencies needed. The structured logger is a project-internal utility.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── logger.ts            # NEW: Structured logger utility
│   └── engine/
│       ├── pipeline.ts       # MODIFIED: Add logger + Sentry breadcrumbs
│       ├── gemini.ts         # MODIFIED: Replace console.* with logger
│       ├── deepseek.ts       # MODIFIED: Replace console.* with logger
│       ├── rules.ts          # MODIFIED: Replace console.* with logger
│       ├── ml.ts             # MODIFIED: Replace console.* with logger
│       ├── calibration.ts    # MODIFIED: Replace console.* with logger
│       └── ...
├── app/
│   └── api/
│       └── admin/
│           └── costs/
│               └── route.ts  # NEW: Cost aggregation endpoint
├── instrumentation.ts        # NEW: Sentry server/edge registration
└── instrumentation-client.ts # NEW: Sentry client-side init (if needed)
sentry.server.config.ts       # NEW: Sentry server SDK init (project root)
sentry.edge.config.ts         # NEW: Sentry edge SDK init (project root)
next.config.ts                # MODIFIED: withSentryConfig wrapper
```

### Pattern 1: Sentry Manual Setup (4-file pattern)
**What:** `@sentry/nextjs` v10+ requires 4 files for full coverage: `instrumentation.ts` (server+edge registration + `onRequestError`), `instrumentation-client.ts` (browser init), `sentry.server.config.ts` (Node.js config), `sentry.edge.config.ts` (Edge config), plus `withSentryConfig` in `next.config.ts`.
**When to use:** Always -- this is the standard Next.js 15+ setup.
**Example:**

```typescript
// instrumentation.ts (project root or src/)
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError = Sentry.captureRequestError;
```

```typescript
// sentry.server.config.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  sendDefaultPii: false,
});
```

```typescript
// sentry.edge.config.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
```

```typescript
// next.config.ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // existing config...
};

export default withSentryConfig(nextConfig, {
  org: "virtuna",
  project: "virtuna-web",
  silent: !process.env.CI,
});
```

### Pattern 2: Lightweight Custom Structured Logger
**What:** A ~60-line utility that outputs JSON in production and pretty-prints in development, supports child loggers with bindings (requestId, stage), and includes timing/cost fields.
**When to use:** When logging needs are narrow and Edge runtime compatibility matters.
**Example:**

```typescript
// src/lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  // Pretty format for dev
  const { level, msg, timestamp, ...rest } = entry;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${msg}${extra}`;
}

function emit(level: LogLevel, msg: string, data: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const formatted = formatEntry(entry);
  if (level === "error") console.error(formatted);
  else if (level === "warn") console.warn(formatted);
  else console.log(formatted);
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    debug: (msg, data) => emit("debug", msg, { ...bindings, ...data }),
    info: (msg, data) => emit("info", msg, { ...bindings, ...data }),
    warn: (msg, data) => emit("warn", msg, { ...bindings, ...data }),
    error: (msg, data) => emit("error", msg, { ...bindings, ...data }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();
```

### Pattern 3: Pipeline Stage Instrumentation (Breadcrumbs + Logger)
**What:** Each pipeline stage emits a Sentry breadcrumb and a structured log entry with timing and cost. Hard failures call `Sentry.captureException()`.
**When to use:** Inside every engine module that processes a pipeline stage.
**Example:**

```typescript
// Inside a pipeline stage
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "gemini" });

export async function analyzeWithGemini(input: AnalysisInput) {
  const start = performance.now();
  try {
    // ... existing logic ...
    const duration_ms = Math.round(performance.now() - start);

    Sentry.addBreadcrumb({
      category: "engine.gemini",
      message: `Gemini analysis complete`,
      level: "info",
      data: { duration_ms, cost_cents, model: GEMINI_MODEL },
    });

    log.info("Gemini analysis complete", {
      stage: "gemini_analysis",
      duration_ms,
      cost_cents,
      model: GEMINI_MODEL,
    });

    return { analysis, cost_cents };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "gemini_analysis" },
      extra: { input_mode: input.input_mode, content_type: input.content_type },
    });
    throw error; // Re-throw -- pipeline handles the failure
  }
}
```

### Pattern 4: Admin Costs Aggregation (SQL via Supabase)
**What:** Query `analysis_results` table grouped by `date_trunc('day', created_at)` and model, summing `cost_cents`.
**When to use:** The `/api/admin/costs` endpoint.
**Example:**

```typescript
// The analysis_results table already has:
// - cost_cents (number) — total pipeline cost per analysis
// - gemini_model (string) — which Gemini model was used
// - deepseek_model (string | null) — which DeepSeek model (null = Gemini fallback or unavailable)
// - created_at (timestamp)
//
// We can aggregate with a Supabase RPC or raw SQL query.
// Simplest approach: Supabase RPC wrapping a SQL function.

// SQL function:
// CREATE OR REPLACE FUNCTION admin_daily_costs(days_back int DEFAULT 30)
// RETURNS TABLE(date text, model text, total_cost_cents numeric)
// AS $$
//   SELECT
//     to_char(created_at::date, 'YYYY-MM-DD') AS date,
//     COALESCE(gemini_model, 'unknown') AS model,
//     SUM(cost_cents) AS total_cost_cents
//   FROM analysis_results
//   WHERE created_at >= now() - (days_back || ' days')::interval
//     AND deleted_at IS NULL
//   GROUP BY created_at::date, gemini_model
//   ORDER BY date DESC, model
// $$ LANGUAGE sql STABLE;
```

### Anti-Patterns to Avoid
- **Logging sensitive data:** Never log `content_text`, user IDs, or API keys in structured logs. Log `requestId`, `stage`, `duration_ms`, `cost_cents`, `model` only.
- **Catching and swallowing errors:** When a `try/catch` handles an error gracefully (returns fallback), still call `Sentry.captureException()` so the error surfaces in the dashboard. The pipeline already uses graceful degradation -- Sentry must be added to every catch block.
- **Using `console.log` for Sentry init debugging:** Sentry has its own `debug: true` option in `Sentry.init()`. Don't add `console.log` to debug Sentry.
- **Blocking on Sentry flush in API routes:** In serverless (Vercel), Sentry events are buffered. Don't call `Sentry.flush()` in hot paths -- the SDK handles this via Vercel's `waitUntil` integration.
- **Using pino transports in Edge runtime:** `pino.transport()` uses worker threads which are unavailable in Edge/middleware. If you ever migrate to pino, use direct `pino()` without transport config for Edge-compatible code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error tracking | Custom error reporting to an API | `@sentry/nextjs` | Sentry handles breadcrumbs, stack traces, source maps, deduplication, alerting, and auto-instruments Next.js routes/middleware. Building this would take weeks. |
| Source map upload | Manual source map handling | `withSentryConfig` in next.config.ts | The Sentry webpack plugin handles source map upload automatically. |
| Server Component error capture | Manual error boundaries | `onRequestError` hook | Next.js 15+ calls `onRequestError` for Server Component, middleware, and proxy errors. Sentry's `captureRequestError` handles this. |

**Key insight:** The Sentry SDK is the only external dependency needed. The structured logger is intentionally custom because it's ~60 lines and avoids Edge runtime headaches with pino's worker threads.

## Common Pitfalls

### Pitfall 1: Missing `NEXT_PUBLIC_SENTRY_DSN` Environment Variable
**What goes wrong:** Sentry silently does nothing. No errors captured.
**Why it happens:** DSN must be prefixed with `NEXT_PUBLIC_` for client-side init. Vercel requires it in environment variables.
**How to avoid:** Add `NEXT_PUBLIC_SENTRY_DSN` to `.env.local` and Vercel project settings. Verify with `Sentry.init({ debug: true })` in development.
**Warning signs:** No issues appearing in Sentry dashboard after deploying with intentional errors.

### Pitfall 2: `instrumentation.ts` Location
**What goes wrong:** Sentry server/edge SDK never initializes. Server-side errors not captured.
**Why it happens:** `instrumentation.ts` must be in the project root OR `src/` folder (if using `src/`). Putting it elsewhere means Next.js ignores it.
**How to avoid:** This project uses `src/`, so place at `src/instrumentation.ts`.
**Warning signs:** `register()` function never called (add a `console.log` to verify during setup).

### Pitfall 3: Forgetting `Sentry.captureException()` in Catch Blocks that Don't Re-throw
**What goes wrong:** Graceful degradation silently swallows errors. Non-critical stage failures (Creator, Rules, Trends, DeepSeek) never appear in Sentry.
**Why it happens:** The pipeline wraps non-critical stages in `try/catch` and returns fallback values. Without `captureException`, these errors are invisible.
**How to avoid:** Audit every `catch` block in `pipeline.ts`, `deepseek.ts`, `rules.ts`, `trends.ts`. Add `Sentry.captureException(error)` before the fallback return.
**Warning signs:** Sentry dashboard shows only critical (Gemini) failures, never DeepSeek/Rules/Trends failures.

### Pitfall 4: `withSentryConfig` Breaking Existing next.config.ts
**What goes wrong:** Build fails or Sentry source maps not uploaded.
**Why it happens:** `withSentryConfig` wraps the entire config. If the existing config uses a non-standard export pattern, the wrap can break.
**How to avoid:** The current `next.config.ts` uses a simple `export default nextConfig` pattern, which is compatible. Just wrap it.
**Warning signs:** Build errors mentioning `withSentryConfig` or source map upload failures in CI.

### Pitfall 5: Structured Logger Using `console.*` Internally
**What goes wrong:** ESLint `no-console` rule (if enabled) flags the logger itself. Or the success criterion "no console.* in engine modules" is technically violated.
**Why it happens:** The logger must output somewhere. `console.log/warn/error` is the correct output channel for a logger.
**How to avoid:** The structured logger in `src/lib/logger.ts` is the ONLY file allowed to call `console.*`. Engine modules import the logger and never call `console.*` directly. Add an ESLint exception for `src/lib/logger.ts` if needed. The success criterion specifically scopes to `src/lib/engine/` files, not `src/lib/logger.ts`.
**Warning signs:** Grep for `console.` in `src/lib/engine/` returns results after migration.

### Pitfall 6: Admin Costs Endpoint Returns Empty Due to NULL cost_cents
**What goes wrong:** Some legacy `analysis_results` rows have `cost_cents = NULL`.
**Why it happens:** Pre-v2 engine didn't track costs. The `cost_cents` column is nullable.
**How to avoid:** Use `COALESCE(cost_cents, 0)` in the aggregation query, or filter `WHERE cost_cents IS NOT NULL`.
**Warning signs:** Cost aggregation returns fewer rows than expected or missing dates.

## Code Examples

### Console.* Calls to Replace (Complete Inventory)

These are the exact calls that must be replaced with the structured logger:

**`src/lib/engine/rules.ts` (7 calls):**
```
Line 114: console.error("Failed to load rules:", error);
Line 166: console.debug(`[rules] Unknown regex pattern: ${pattern}`);
Line 186: console.warn(`[rules] Skipping semantic rule...`);
Line 230: console.warn(`[rules] Semantic eval response validation failed...`);
Line 243: console.log(`[rules] Semantic eval: ${evaluableRules.length} rules...`);
Line 252: console.warn(`[rules] Semantic evaluation failed...`);
Line 304: console.debug(`[rules] Regex rule "${rule.name}" has no pattern...`);
Line 322: console.debug(`[rules] Semantic eval returned unknown rule...`);
```

**`src/lib/engine/gemini.ts` (2 calls):**
```
Line 316: console.warn(`[Gemini] Text analysis cost...exceeds soft cap`);
Line 436: console.warn(`[Gemini] Video analysis cost...exceeds soft cap`);
```

**`src/lib/engine/deepseek.ts` (4 calls):**
```
Line 128: console.warn(`[DeepSeek] Circuit breaker OPEN...`);
Line 415: console.warn(`[DeepSeek] Reasoning cost...exceeds soft cap`);
Line 444: console.error(`DeepSeek failed after ${MAX_RETRIES + 1} attempts...`);
Line 449: console.warn("[DeepSeek] Falling back to Gemini for reasoning stage");
Line 500: console.log(`[DeepSeek->Gemini fallback] Reasoning complete...`);
```

**`src/lib/engine/calibration.ts` (1 call):**
```
Line 79: console.error("[calibration] Failed to fetch outcome pairs:", error);
```

**`src/lib/engine/ml.ts` (7 calls):**
```
Line 266: console.log(`[ml] ${setName} Tier ${c + 1}: precision=...`);
Line 321: console.log(`[ml] Class weights: ${weightLog}`);
Line 395: console.log(`Epoch ${epoch + 1}/${EPOCHS}...`);
Line 405: console.log(`\nFinal - Train accuracy:...`);
Line 435: console.error("[ml] Failed to upload weights to storage:", uploadError);
Line 438: console.log(`[ml] Model weights saved to ${STORAGE_BUCKET}/${STORAGE_PATH}`);
Line 474: console.error("[ml] Failed to load ML model weights from storage");
```

**`src/app/api/analyze/route.ts` (1 call):**
```
Line 254: console.error("[analyze] Request error:", error);
```

**`src/app/api/admin/calibration-report/route.ts` (1 call):**
```
Line 41: console.error("[calibration-report] Failed to generate report:", error);
```

### requestId Pattern for Pipeline Logging

```typescript
// In the API route (analyze/route.ts), generate a requestId per pipeline run:
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";

// Inside POST handler:
const requestId = nanoid(12);
const log = createLogger({ requestId });

// Pass requestId through pipeline:
const pipelineResult = await runPredictionPipeline(validated, { requestId });

// Each engine module creates a child logger:
// gemini.ts:
export async function analyzeWithGemini(input, opts?: { requestId?: string }) {
  const log = createLogger({ module: "gemini", requestId: opts?.requestId });
  // ...
}
```

### Admin Costs Endpoint

```typescript
// src/app/api/admin/costs/route.ts
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);

  const supabase = createServiceClient();

  // Option A: Raw SQL via Supabase RPC
  const { data, error } = await supabase.rpc("admin_daily_costs", {
    days_back: days,
  });

  // Option B: If no RPC, use client-side aggregation
  // (less efficient but no migration needed)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry.client.config.ts` for client init | `instrumentation-client.ts` for client init | @sentry/nextjs v8+ (2024) | Client SDK now uses Next.js instrumentation hook pattern |
| `sentry.properties` file | `withSentryConfig` options | @sentry/nextjs v8+ (2024) | Config consolidated into `next.config.ts` |
| `Sentry.init` in `_app.tsx` | `instrumentation.ts` + `onRequestError` | Next.js 15 + @sentry/nextjs 8.28+ | Server Components, middleware captured automatically |
| `pino` as default recommendation | Custom logger or pino (context-dependent) | 2025-2026 | Edge runtime incompatibility made pino problematic for full Next.js coverage; custom loggers are now a valid pattern |

**Deprecated/outdated:**
- `sentry.properties` file: replaced by `withSentryConfig` options in `next.config.ts`
- `withSentry` API route wrapper: removed in v8+, replaced by auto-instrumentation
- `sentry.client.config.ts`: replaced by `instrumentation-client.ts` in Next.js 15+
- `tracingOrigins`: renamed to `tracePropagationTargets` in v8+

## Open Questions

1. **Sentry project DSN**
   - What we know: Need a `NEXT_PUBLIC_SENTRY_DSN` value
   - What's unclear: Whether a Sentry project already exists for Virtuna, or needs to be created
   - Recommendation: The planner should include a task to create the Sentry project (if needed) and add the DSN to `.env.local` and Vercel env vars. This is a manual step.

2. **Cost split per model in analysis_results**
   - What we know: `cost_cents` stores the TOTAL pipeline cost (Gemini + DeepSeek combined). `gemini_model` and `deepseek_model` columns exist.
   - What's unclear: The admin endpoint requirement says "grouped by model", but cost_cents is a single combined value. We cannot perfectly split Gemini vs DeepSeek costs from the stored data alone.
   - Recommendation: Two options: (a) Add separate `gemini_cost_cents` and `deepseek_cost_cents` columns (schema migration), or (b) Group by model combination (`gemini_model + deepseek_model`) showing total pipeline cost. Option (b) is simpler and still useful. Option (a) is more precise but requires a migration. **Planner decides.**

3. **Session Replay / Client-side Sentry scope**
   - What we know: The milestone is backend-only. Sentry client config is part of the standard setup.
   - What's unclear: Whether to include `replayIntegration()` and `instrumentation-client.ts` or skip client-side entirely.
   - Recommendation: Create a minimal `instrumentation-client.ts` with just `Sentry.init({ dsn })` and no replay. Backend focus means server/edge configs matter most. Client config can be enhanced in a future milestone.

4. **requestId propagation mechanism**
   - What we know: `nanoid` is already in package.json. Pipeline needs a `requestId` for log correlation.
   - What's unclear: Whether to thread it via function parameters or use AsyncLocalStorage (Node.js context propagation).
   - Recommendation: Use simple function parameter threading. The pipeline is a single async call chain, and AsyncLocalStorage adds complexity without benefit here. Pass `requestId` as an optional options parameter to `runPredictionPipeline` and have each stage create a child logger.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/sentry_io_platforms_javascript_guides_nextjs` - Sentry Next.js manual setup, instrumentation.ts, onRequestError, breadcrumbs, captureException, init options
- Context7 `/pinojs/pino` - Pino API, child loggers, custom levels, pretty printing
- Codebase analysis: `src/lib/engine/` all modules, `src/app/api/analyze/route.ts`, `src/types/database.types.ts`, `package.json`

### Secondary (MEDIUM confidence)
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) - Official docs for 4-file setup pattern
- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) - Latest version 10.39.0
- [Sentry v8-to-v9 Migration](https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v8-to-v9/) - Current migration path
- [Arcjet: Structured logging for Next.js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) - Custom logger pattern validation
- [Vercel Pino Logging Template](https://vercel.com/templates/next.js/pino-logging) - Vercel's own pino template
- [Next.js Discussion #67213](https://github.com/vercel/next.js/discussions/67213) - Edge runtime logging library compatibility issues

### Tertiary (LOW confidence)
- [Next.js Discussion #33898](https://github.com/vercel/next.js/discussions/33898) - Pino middleware JSON output issues (community report, not official)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @sentry/nextjs is the official SDK, verified via Context7 and npm
- Architecture: HIGH - 4-file Sentry setup is documented in official docs; custom logger pattern is simple and verifiable; admin endpoint uses existing DB columns
- Pitfalls: HIGH - Edge runtime issues verified via multiple sources; console.* inventory extracted directly from codebase grep
- Cost endpoint: MEDIUM - SQL aggregation approach is straightforward, but the model-split question needs a planner decision

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain -- Sentry SDK releases are frequent but the setup pattern is stable)
