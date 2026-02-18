# Phase 5: Test Coverage - Research

**Researched:** 2026-02-18
**Domain:** Unit testing, integration testing, code coverage for a Next.js engine module pipeline
**Confidence:** HIGH

## Summary

Phase 5 introduces Vitest as the test runner for the prediction engine pipeline in `src/lib/engine/`. The codebase currently has zero test infrastructure -- no `vitest.config.ts`, no test scripts, no `__tests__/` directory, and Vitest is not installed as a dependency. Every module under test (`aggregator`, `normalize`, `ml`, `calibration`, `fuzzy`, `rules`, `deepseek`, `pipeline`) has external dependencies that must be mocked: Supabase service client, Sentry, OpenAI SDK (DeepSeek), Google GenAI SDK (Gemini), filesystem reads, and `performance.now()`.

The engine modules are well-structured for testing. Pure functions exist in `fuzzy.ts` (Jaro-Winkler), `calibration.ts` (ECE computation, Platt scaling math), `normalize.ts` (hashtag extraction, duration parsing), and `aggregator.ts` (weight selection). These can be tested directly. Modules with external I/O (`deepseek.ts`, `gemini.ts`, `rules.ts`, `trends.ts`, `ml.ts`, `pipeline.ts`) require mocking their SDK clients and Supabase calls.

**Primary recommendation:** Use Vitest with v8 coverage provider, mock all external services at the module boundary with `vi.mock()`, create shared mock factories for `PipelineResult`/`GeminiAnalysis`/`DeepSeekReasoning` shapes, and enforce 80% coverage thresholds in `vitest.config.ts`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.2 | Test runner, assertion library, mocking | Vite-native, zero-config with TS, built-in coverage, `vi.mock` hoisting |
| @vitest/coverage-v8 | ^3.2 | V8-based code coverage provider | Built-in V8 provider -- no Istanbul needed, fast, accurate for Node |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Vitest includes assertions (Chai-compatible), mocking (`vi`), and coverage out of the box |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest requires ts-jest or babel transform; Vitest is Vite-native with ESM + TS out of the box. Project already uses Next.js 16 with ESM. |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul is more battle-tested but slower; v8 is adequate for this project's module-level coverage needs |

**Installation:**
```bash
pnpm add -D vitest @vitest/coverage-v8
```

## Architecture Patterns

### Recommended Test Structure
```
src/lib/engine/
├── __tests__/
│   ├── factories.ts          # Shared mock data factories
│   ├── aggregator.test.ts    # Unit: weight selection, confidence, feature vector, score clamping
│   ├── normalize.test.ts     # Unit: hashtag extraction, duration hints, 3 input modes
│   ├── ml.test.ts            # Unit: feature vector bridge, prediction output range
│   ├── calibration.test.ts   # Unit: ECE calculation, Platt scaling math
│   ├── fuzzy.test.ts         # Unit: Jaro-Winkler exact/no match, threshold filtering
│   ├── rules.test.ts         # Unit: 13+ regex patterns with positive/negative cases
│   ├── deepseek.test.ts      # Unit: circuit breaker state transitions, Zod response parsing
│   └── pipeline.test.ts      # Integration: happy path, DeepSeek failure, Gemini failure, weight redistribution
├── aggregator.ts
├── normalize.ts
├── ...
```

### Pattern 1: Mock Factories for Complex Types
**What:** Shared factory functions that produce valid `PipelineResult`, `GeminiAnalysis`, `DeepSeekReasoning`, and `RuleScoreResult` objects with sensible defaults and optional overrides.
**When to use:** Every test file needs pipeline-shaped data. Without factories, test files become 80% boilerplate.
**Example:**
```typescript
// src/lib/engine/__tests__/factories.ts
import type { PipelineResult } from "../pipeline";
import type { GeminiAnalysis, DeepSeekReasoning, RuleScoreResult, TrendEnrichment, ContentPayload, FeatureVector } from "../types";

export function makeGeminiAnalysis(overrides?: Partial<GeminiAnalysis>): GeminiAnalysis {
  return {
    factors: [
      { name: "Scroll-Stop Power", score: 7, rationale: "Good hook", improvement_tip: "Add question" },
      { name: "Completion Pull", score: 6, rationale: "Decent pacing", improvement_tip: "Tighten middle" },
      { name: "Rewatch Potential", score: 5, rationale: "Average", improvement_tip: "Add layers" },
      { name: "Share Trigger", score: 7, rationale: "Relatable", improvement_tip: "Add CTA" },
      { name: "Emotional Charge", score: 6, rationale: "Moderate", improvement_tip: "Amplify emotion" },
    ],
    overall_impression: "Solid content with room for improvement",
    content_summary: "A TikTok video about productivity tips",
    ...overrides,
  };
}

export function makeDeepSeekReasoning(overrides?: Partial<DeepSeekReasoning>): DeepSeekReasoning {
  return {
    behavioral_predictions: {
      completion_pct: 65, completion_percentile: "top 35%",
      share_pct: 4, share_percentile: "top 40%",
      comment_pct: 2, comment_percentile: "top 50%",
      save_pct: 3, save_percentile: "top 45%",
    },
    component_scores: {
      hook_effectiveness: 7, retention_strength: 6, shareability: 7,
      comment_provocation: 5, save_worthiness: 6, trend_alignment: 4, originality: 6,
    },
    suggestions: [{ text: "Add a hook in the first 2 seconds", priority: "high", category: "hook" }],
    warnings: [],
    confidence: "medium",
    ...overrides,
  };
}

export function makeRuleScoreResult(overrides?: Partial<RuleScoreResult>): RuleScoreResult {
  return {
    rule_score: 55,
    matched_rules: [
      { rule_id: "r1", rule_name: "question_hook", score: 8, max_score: 10, tier: "regex" as const },
    ],
    ...overrides,
  };
}

// ... similar for ContentPayload, TrendEnrichment, PipelineResult
```

### Pattern 2: Module-Boundary Mocking
**What:** Mock external dependencies (`@/lib/supabase/service`, `@sentry/nextjs`, `openai`, `@google/genai`) at the module level using `vi.mock()`. Never mock internal engine functions -- test those through their public API.
**When to use:** Any test for modules that import external SDKs (deepseek, gemini, rules, ml, calibration, trends, pipeline).
**Example:**
```typescript
// Mock Supabase service client
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(), // for awaited queries
  })),
}));

// Mock Sentry (all modules import it)
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
```

### Pattern 3: Circuit Breaker State Testing
**What:** The DeepSeek module has module-level mutable state (`breaker` variable) for circuit breaker logic. Tests must reset this state between test cases.
**When to use:** `deepseek.test.ts` -- testing state transitions (closed -> open -> half-open -> closed).
**Key challenge:** The `breaker` variable is not exported. Tests need to either:
  - (a) Test through the public API (`reasonWithDeepSeek`, `isCircuitOpen`) by triggering failures, OR
  - (b) Export a `resetCircuitBreaker()` function for testing (recommended -- add a `/** @internal */` export)
**Recommendation:** Add a small `resetCircuitBreaker()` export to `deepseek.ts` guarded by a comment. This is cleaner than trying to manipulate internal state through repeated API calls with timing dependencies.

### Anti-Patterns to Avoid
- **Mocking internal engine modules in unit tests:** Don't mock `aggregator.ts` when testing `pipeline.ts` integration. Mock external SDKs only. The integration test should exercise the real aggregator logic.
- **Timing-dependent tests:** The circuit breaker uses `Date.now()` for `nextRetryAt`. Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` instead of real time delays.
- **Testing LLM output content:** Don't assert on specific AI-generated text. Assert on structure (Zod validation passes), score ranges (0-100), and error handling paths.
- **Shared mutable state leaking between tests:** The `cachedWeights`, `cachedCalibration`, and cache instances in `ml.ts`, `calibration.ts`, `rules.ts` are module-level. Use `beforeEach(() => { vi.resetModules() })` or mock the cache to prevent cross-test contamination when needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage reporting | Custom coverage scripts | `@vitest/coverage-v8` with `thresholds` config | V8 provider handles source maps, TypeScript, and threshold enforcement automatically |
| Mock function tracking | Custom call recorders | `vi.fn()` and `vi.spyOn()` | Built-in call tracking, argument assertions, return value mocking |
| Timer mocking for circuit breaker | Manual Date.now stubs | `vi.useFakeTimers()` / `vi.advanceTimersByTime()` | Vitest's timer mocking handles Date.now, setTimeout, setInterval consistently |
| Async test utilities | Custom promise helpers | `async/await` in test functions + `vi.waitFor()` | Vitest natively supports async tests and has built-in retry/wait utilities |

**Key insight:** Vitest's built-in mocking (`vi.mock`, `vi.fn`, `vi.spyOn`, `vi.useFakeTimers`) covers every mocking need in this codebase. No additional mocking libraries (like `msw`, `nock`) are required because all external calls go through SDK clients that can be mocked at the module level.

## Common Pitfalls

### Pitfall 1: Path Alias Resolution (`@/` imports)
**What goes wrong:** Vitest can't resolve `@/lib/supabase/service` or `@/lib/logger` imports without explicit alias configuration.
**Why it happens:** Vitest doesn't read `tsconfig.json` paths automatically -- it needs `resolve.alias` or `test.alias` in `vitest.config.ts`.
**How to avoid:** Configure `resolve.alias` in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    '@/': new URL('./src/', import.meta.url).pathname,
  },
},
```
**Warning signs:** "Cannot find module '@/lib/...'" errors when running tests.

### Pitfall 2: Module-Level Side Effects in Engine Modules
**What goes wrong:** Importing engine modules triggers side effects: `createLogger()` calls, `createCache()` instantiation, and `process.env` reads. If env vars aren't set, modules throw on import.
**Why it happens:** Modules like `deepseek.ts` read `process.env.DEEPSEEK_API_KEY` inside `getClient()`, and `calibration.ts` reads calibration files from disk.
**How to avoid:** Mock `@/lib/logger` and `@/lib/cache` globally. Set minimal env vars in test setup or mock `process.env` properties. For `deepseek.ts` and `gemini.ts`, mock the entire `openai` and `@google/genai` modules so `getClient()` never runs.
**Warning signs:** Tests fail with "Missing DEEPSEEK_API_KEY" or "Cannot read file calibration-baseline.json" errors.

### Pitfall 3: Supabase Client Chaining Pattern
**What goes wrong:** Supabase queries use a fluent API (`supabase.from().select().eq().order().limit()`). A naive mock breaks the chain.
**Why it happens:** Each method in the chain returns `this` (the query builder). If `from()` returns a plain object instead of the builder, `.select()` fails.
**How to avoid:** Build a mock Supabase client where every query method returns `this` (using `mockReturnThis()`), and the terminal method (no further chaining, just `await`) resolves with `{ data, error }`. See the module-boundary mocking pattern above.
**Warning signs:** "Cannot read property 'select' of undefined" errors in tests.

### Pitfall 4: Floating Point in Weight Redistribution Tests
**What goes wrong:** `selectWeights()` does proportional weight redistribution with rounding. Naive `toEqual` comparisons fail due to floating point noise.
**Why it happens:** JavaScript floating point arithmetic produces values like `0.38888888888889` instead of `0.389`.
**How to avoid:** Use `toBeCloseTo(expected, 2)` for individual weight assertions, or verify weights sum to approximately 1.0 using `expect(sum).toBeCloseTo(1, 3)`. The function already rounds to 3 decimal places, so `toEqual` should work for the rounded output -- but verify.
**Warning signs:** Tests fail with "expected 0.38900000000000001 to equal 0.389".

### Pitfall 5: ESM + `import.meta.url` in Engine Modules
**What goes wrong:** `gemini.ts` and `deepseek.ts` use `import.meta.url` to resolve `calibration-baseline.json` path. This may behave differently in Vitest's module transform.
**Why it happens:** Vitest transforms modules with Vite; `import.meta.url` resolves relative to the source file but the path resolution depends on the test environment.
**How to avoid:** Mock `fs.readFile` or the `loadCalibrationData` function rather than relying on actual file reads. For integration tests that need the real calibration data, ensure the test runs from the project root.
**Warning signs:** "ENOENT: no such file or directory, open '.../calibration-baseline.json'" in tests.

### Pitfall 6: Circuit Breaker Module-Level State
**What goes wrong:** The `breaker` state in `deepseek.ts` persists across tests because it's module-level. A test that opens the circuit affects subsequent tests.
**Why it happens:** Vitest reuses module instances within a test file by default.
**How to avoid:** Either export a `resetCircuitBreaker()` function for test cleanup, or use `vi.resetModules()` + dynamic `import()` to get fresh module instances between tests. The former is simpler and more reliable.
**Warning signs:** Tests pass individually but fail when run together; circuit breaker tests are order-dependent.

### Pitfall 7: `noUnusedLocals` + `noUnusedParameters` TypeScript Strictness
**What goes wrong:** The project's `tsconfig.json` has `noUnusedLocals: true` and `noUnusedParameters: true`. Test files may trigger TypeScript errors if they import types only used in assertions or mock setups.
**Why it happens:** Test code patterns (importing for mocking, destructuring for assertions) can leave variables "unused" from TypeScript's perspective.
**How to avoid:** Vitest test files are typically excluded from the main `tsconfig.json` via `exclude`. If not, create a `tsconfig.test.json` that extends the base but relaxes these rules, or use `// @ts-expect-error` sparingly.
**Warning signs:** TypeScript errors in test files during `tsc --noEmit` or editor linting.

## Code Examples

### Vitest Configuration for This Project
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/engine/**/*.ts'],
      exclude: [
        'src/lib/engine/__tests__/**',
        'src/lib/engine/types.ts',
        'src/lib/engine/calibration-baseline.json',
        'src/lib/engine/training-data.json',
        'src/lib/engine/ml-weights.json',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

### Testing Pure Functions (normalize.ts)
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeInput } from '../normalize';

describe('normalizeInput', () => {
  it('extracts hashtags from content text', () => {
    const result = normalizeInput({
      input_mode: 'text',
      content_text: 'Check out #viral and #trending content',
      content_type: 'post',
    });
    expect(result.hashtags).toEqual(['#viral', '#trending']);
  });

  it('extracts duration hint from "30s" pattern', () => {
    const result = normalizeInput({
      input_mode: 'text',
      content_text: 'This 30s video is great',
      content_type: 'video',
    });
    expect(result.duration_hint).toBe(30);
  });

  it('handles tiktok_url input mode', () => {
    const result = normalizeInput({
      input_mode: 'tiktok_url',
      tiktok_url: 'https://tiktok.com/@user/video/123',
      content_type: 'video',
    });
    expect(result.video_url).toBe('https://tiktok.com/@user/video/123');
    expect(result.input_mode).toBe('tiktok_url');
  });
});
```

### Testing Weight Selection (aggregator.ts)
```typescript
import { describe, it, expect } from 'vitest';
import { selectWeights } from '../aggregator';

describe('selectWeights', () => {
  it('returns base weights when all signals available', () => {
    const weights = selectWeights({
      behavioral: true, gemini: true, ml: true, rules: true, trends: true,
    });
    expect(weights).toEqual({
      behavioral: 0.35, gemini: 0.25, ml: 0.15, rules: 0.15, trends: 0.10,
    });
  });

  it('redistributes weight when behavioral is missing', () => {
    const weights = selectWeights({
      behavioral: false, gemini: true, ml: true, rules: true, trends: true,
    });
    expect(weights.behavioral).toBe(0);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('handles single source available', () => {
    const weights = selectWeights({
      behavioral: false, gemini: true, ml: false, rules: false, trends: false,
    });
    expect(weights.gemini).toBeCloseTo(1, 2);
  });
});
```

### Testing Circuit Breaker (deepseek.ts)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external deps before importing module under test
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() }),
}));
vi.mock('openai');
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
}));

describe('DeepSeek circuit breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in closed state', async () => {
    const { isCircuitOpen } = await import('../deepseek');
    expect(isCircuitOpen()).toBe(false);
  });

  // ... more state transition tests using vi.advanceTimersByTime()
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + ts-jest for TS testing | Vitest (native TS via Vite) | 2023-2024 | No babel/ts-jest config, faster execution, ESM-first |
| Istanbul for coverage | V8 coverage provider | Vitest 1.x+ | Faster, no instrumentation overhead, built into V8 |
| `jest.mock()` hoisting | `vi.mock()` hoisting | Vitest design | Same semantics, different API; `vi.mock` is ESM-aware |
| Manual coverage thresholds via CI | `coverage.thresholds` in config | Vitest built-in | `vitest run --coverage` fails if thresholds not met -- no separate CI step |

**Deprecated/outdated:**
- `@vitejs/plugin-react` is NOT needed for testing Node-only engine modules. Only needed if testing React components.
- `happy-dom` / `jsdom` environment is NOT needed. Engine modules run in Node -- use `environment: 'node'` (default).

## Mocking Strategy Per Module

This is the key planning input: which modules need which mocks.

| Module | External Dependencies to Mock | Pure Functions (Test Directly) |
|--------|-------------------------------|-------------------------------|
| `aggregator.ts` | `./ml` (predictWithML, featureVectorToMLInput), `./calibration` (getPlattParameters, applyPlattScaling), `./gemini` (GEMINI_MODEL), `./deepseek` (DEEPSEEK_MODEL) | `selectWeights()`, `calculateConfidence()` (private -- test via `aggregateScores`), `assembleFeatureVector()` (private -- test via `aggregateScores`) |
| `normalize.ts` | None | `normalizeInput()` entirely pure -- `extractHashtags()` and `extractDurationHint()` are private but testable through `normalizeInput()` |
| `ml.ts` | `@/lib/supabase/service`, `@sentry/nextjs`, `fs` (readFileSync), `@/lib/logger` | `featureVectorToMLInput()`, `stratifiedSplit()`, `softmax()` (private), `computeLogits()` (private) -- test softmax/logits via `predictWithML` |
| `calibration.ts` | `@/lib/supabase/service`, `@sentry/nextjs`, `@/lib/cache`, `@/lib/logger` | `computeECE()`, `fitPlattScaling()`, `applyPlattScaling()` -- all pure |
| `fuzzy.ts` | None | `jaroWinklerSimilarity()`, `bestFuzzyMatch()` -- entirely pure |
| `rules.ts` | `@/lib/supabase/service`, `@sentry/nextjs`, `openai` (DeepSeek chat), `@/lib/cache`, `@/lib/logger` | `matchesPattern()` (private -- test via `scoreContentAgainstRules` with regex-tier rules), pattern matching logic |
| `deepseek.ts` | `openai`, `@google/genai`, `@sentry/nextjs`, `fs`, `@/lib/logger` | `parseDeepSeekResponse()` (private), `calculateDeepSeekCost()` (private), `isCircuitOpen()`, circuit breaker state machine |
| `pipeline.ts` | `./gemini`, `./deepseek`, `./rules`, `./trends`, `./creator`, `./normalize`, `@/lib/supabase/service`, `@sentry/nextjs`, `nanoid`, `@/lib/logger` | `timed()` (private helper) |

## Integration Test Strategy

The pipeline integration tests (`pipeline.test.ts`) should mock external SDKs (Gemini, DeepSeek, Supabase) but use real internal engine modules (normalize, aggregator, calibration, rules logic, fuzzy). This tests the wiring between stages.

**Four scenarios required:**
1. **Happy path (all mocked stages succeed):** Gemini returns valid analysis, DeepSeek returns valid reasoning, rules return matches, trends return matches. Assert: PipelineResult has all fields populated, no warnings, timings array has all stages.
2. **DeepSeek failure -> Gemini fallback:** Mock DeepSeek to throw. Assert: `deepseekResult` is still populated (Gemini fallback produces same shape), warnings include DeepSeek failure message.
3. **Gemini failure (critical):** Mock Gemini to throw. Assert: Pipeline throws (Gemini is critical stage).
4. **ML weight redistribution:** Mock ML model as unavailable (returns null). Assert: `score_weights.ml === 0`, other weights redistribute, warnings mention missing signal.

## Open Questions

1. **Circuit breaker `resetCircuitBreaker()` export**
   - What we know: The `breaker` variable in `deepseek.ts` is module-level and not exported. Tests need to reset it.
   - What's unclear: Whether the team prefers a test-only export or `vi.resetModules()` approach.
   - Recommendation: Add `export function resetCircuitBreaker(): void` with `/** @internal — test use only */` doc comment. It's 3 lines of code and makes tests dramatically simpler.

2. **Module-level caches (`cachedWeights`, `cachedCalibration`)**
   - What we know: `ml.ts` and `deepseek.ts`/`gemini.ts` cache loaded data in module-level variables.
   - What's unclear: Whether to add reset exports or rely on `vi.resetModules()`.
   - Recommendation: For `ml.ts`, mock `loadModel()` to return controlled data. For calibration/gemini, mock `fs.readFile` to return fixture JSON. No reset exports needed -- mock at the I/O boundary.

3. **`tsconfig.json` `exclude` for tests**
   - What we know: Current `tsconfig.json` excludes `extraction`, `verification`, `scripts` but not `__tests__`.
   - What's unclear: Whether test files will trigger strict TS errors (`noUnusedLocals`, etc.).
   - Recommendation: Vitest uses its own TypeScript handling via Vite. The main `tsconfig.json` shouldn't need changes if tests are only in `src/lib/engine/__tests__/`. But if TS errors appear, add `"src/**/__tests__/**"` to `exclude`.

## Sources

### Primary (HIGH confidence)
- Context7 `/vitest-dev/vitest` -- configuration, coverage, mocking patterns, alias resolution
- Codebase inspection -- all 15 files in `src/lib/engine/`, `package.json`, `tsconfig.json`, `src/lib/cache.ts`, `src/lib/logger.ts`, `src/lib/supabase/service.ts`

### Secondary (MEDIUM confidence)
- Vitest official docs (via Context7) -- coverage thresholds, `vi.mock` hoisting, `vi.useFakeTimers`

### Tertiary (LOW confidence)
- None -- all findings verified against Context7 and codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Vitest is the established choice for Vite/Next.js projects, v8 coverage is built-in
- Architecture: HIGH -- Test structure follows standard Vitest patterns, all module interfaces are well-defined and inspected
- Pitfalls: HIGH -- All pitfalls identified from actual codebase inspection (path aliases, module-level state, Supabase chaining, ESM imports)
- Mocking strategy: HIGH -- Every module's dependencies catalogued from source code

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- Vitest API is mature)
