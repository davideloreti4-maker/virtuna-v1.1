/**
 * Stub test file for the Phase 1 POST /api/analyze event:started frame
 * (Pitfall #6 Option A — placeholder row INSERTed with overall_score=null
 *  before stream begins, server emits event:started with the analysis ID).
 *
 * Plan 01-01 ships placeholders; downstream Wave 1 task fills assertions.
 */
import { describe, it } from "vitest";

describe("POST /api/analyze — event:started frame", () => {
  it.todo("POST /api/analyze emits event:started with {id} as first SSE frame");
  it.todo("Placeholder row INSERTed with overall_score=null before stream begins (Pitfall #6 Option A)");
  it.todo("Existing useAnalyze consumer ignores event:started (backward compat)");
  it.todo("Cache-hit branch does NOT emit event:started (single-frame complete path stays unchanged)");
});
