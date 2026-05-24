/**
 * Stub e2e spec for the Phase 1 result-surface stream lifecycle (R2.1).
 *
 * Plan 01-01 ships these as test.fixme placeholders. Downstream Wave 1+ plans
 * (01-02 reconnect + polling, 01-07 result card) replace fixme with real
 * Playwright bodies.
 *
 * Playwright distinguishes test.fixme ("skip, expected to fix") from test.todo;
 * Vitest uses it.todo. Do not unify these — they're different runners.
 */
import { test } from "@playwright/test";

test.fixme(
  "submit on /analyze → navigate to /analyze/[id] → panels transition idle→loading→ready",
  async () => {
    // Implementation deferred to Plan 01-07.
  },
);

test.fixme(
  "reconnects once on simulated server-side close, then falls back to polling",
  async () => {
    // Implementation deferred to Plan 01-02.
  },
);

test.fixme(
  "revisiting a completed /analyze/[id] URL renders all panels without re-streaming (Pitfall #3)",
  async () => {
    // Implementation deferred to Plan 01-07.
  },
);
