/**
 * The analysis stream's error contract — the strings a UI has to tell APART, not just show.
 *
 * Lives here rather than in `use-analysis-stream` on purpose: a dozen test files replace that
 * hook with a bare `vi.mock` factory (`{ useAnalysisStream: () => ({…}) }`), so any named export
 * added beside the hook is missing from every one of those mocks and every Composer-mounting
 * suite dies on the import. A constant that both the hook and its consumers need is therefore
 * kept in a module nobody mocks.
 *
 * Pure data. No React, no fetch, no server imports.
 */

/**
 * The polling-ceiling timeout — the ONE `error` the stream reports where the pipeline may still
 * be ALIVE server-side. Every other error means the run is dead: nothing was delivered, nothing
 * was billed (`/api/analyze` calls `recordUsage` only inside its success branch), so retrying is
 * free and correct. This one is not — a retry here starts a SECOND billed pipeline on top of a
 * live one. Compare against this constant, never against the prose.
 */
export const STREAM_TIMEOUT_ERROR = "Stream timed out — analysis still running";
