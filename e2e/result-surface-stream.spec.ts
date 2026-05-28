/**
 * Phase 1 result-surface stream lifecycle — E2E spec (R2.1, Plan 01-08).
 *
 * W7 ceiling: at most 2 of 3 tests may be test.fixme. Test 1 is REAL.
 *
 * Test 1 (REAL — W7 requirement): Uses Playwright page.route() to intercept
 * POST /api/analyze and return canned SSE frames (STARTED + STAGE sequence +
 * COMPLETE with COMPLETED_PREDICTION). Requires:
 *  - Dev server running at localhost:3000
 *  - Auth state file at e2e/auth/state.json (from auth.setup.ts)
 *  - /analyze route accessible (behind (app) layout auth gate)
 *
 * Tests 2 and 3 are test.fixme — deferred to P7 (need seeded DB + auth fixture).
 *
 * Playwright distinguishes test.fixme ("skip, expected to fix") from test.todo.
 */
import { test, expect } from "@playwright/test";

// Canned SSE frames — mirrors src/test/fixtures/stage-events.ts shapes but
// inlined here to avoid TypeScript/module issues at Playwright runtime.
const ANALYSIS_ID = "e2e-test-id-12chars";

const CANNED_SSE_BODY = [
  // event:started — sets analysisId for navigation
  `event: started\ndata: ${JSON.stringify({ id: ANALYSIS_ID })}\n\n`,
  // wave_1 stages
  `event: stage\ndata: ${JSON.stringify({ type: "stage_start", stage: "wave_1", wave: 1, timestamp_ms: 100 })}\n\n`,
  `event: stage\ndata: ${JSON.stringify({ type: "stage_end", stage: "wave_1", wave: 1, duration_ms: 850, cost_cents: 4, ok: true })}\n\n`,
  // wave_2
  `event: stage\ndata: ${JSON.stringify({ type: "stage_start", stage: "wave_2", wave: 2, timestamp_ms: 950 })}\n\n`,
  `event: stage\ndata: ${JSON.stringify({ type: "stage_end", stage: "wave_2", wave: 2, duration_ms: 1200, cost_cents: 7, ok: true })}\n\n`,
  // wave_3_personas
  `event: stage\ndata: ${JSON.stringify({ type: "stage_start", stage: "wave_3_personas", wave: 3, timestamp_ms: 2150 })}\n\n`,
  `event: stage\ndata: ${JSON.stringify({ type: "stage_end", stage: "wave_3_personas", wave: 3, duration_ms: 4500, cost_cents: 22, ok: true })}\n\n`,
  // aggregator
  `event: stage\ndata: ${JSON.stringify({ type: "stage_start", stage: "aggregator", wave: "aggregator", timestamp_ms: 6650 })}\n\n`,
  `event: stage\ndata: ${JSON.stringify({ type: "stage_end", stage: "aggregator", wave: "aggregator", duration_ms: 350, cost_cents: 0, ok: true })}\n\n`,
  // complete — with optimal_post_window + emotion_arc for B3 panel wiring
  `event: complete\ndata: ${JSON.stringify({
    overall_score: 0.72,
    confidence: 0.65,
    confidence_label: "MEDIUM",
    factors: [],
    warnings: [],
    suggestions: [],
    reasoning: "E2E test result",
    rule_score: 0.7,
    trend_score: 0.5,
    score_weights: {},
    latency_ms: 8500,
    cost_cents: 33,
    engine_version: "v3.0.0-e2e",
    gemini_model: "gemini-2.5-flash-lite",
    deepseek_model: null,
    input_mode: "tiktok_url",
    has_video: false,
    signal_availability: {},
    persona_behavioral_aggregate: null,
    persona_simulation_results: [],
    retrieval_score: null,
    retrieval_evidence: [],
    optimal_post_window: {
      day_of_week: "Tue",
      hour_range: [18, 21],
      timezone: "UTC",
      reasoning: "E2E test default",
      source: "fallback",
    },
    emotion_arc: [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 9500, intensity_0_1: 0.5, label: "mid" },
    ],
    anti_virality_gated: false,
  })}\n\n`,
].join("");

/**
 * Test 1 (REAL — W7): form submit → SSE intercept → URL transition → panel ready.
 *
 * Intercepts POST /api/analyze with canned SSE frames so the test works without
 * a live Qwen/DeepSeek backend. Auth state is loaded from e2e/auth/state.json
 * (created by auth.setup.ts). The /analyze page must be accessible.
 *
 * If this test consistently fails in CI due to missing auth fixture, document in
 * 01-08-SUMMARY and convert to test.fixme with blocker note — but the planner
 * expects this to work with page.route() mocking (approach B from the plan).
 */
test("submit on /analyze → navigate to /analyze/[id] → at least one panel has data-panel-ready=ready", async ({
  page,
}) => {
  // Intercept POST /api/analyze → return canned SSE frames
  await page.route("**/api/analyze", (route) => {
    // Only intercept the POST (ContentForm submit)
    if (route.request().method() !== "POST") {
      route.continue();
      return;
    }
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
      body: CANNED_SSE_BODY,
    });
  });

  // Navigate to the analyze form page
  await page.goto("/analyze");

  // Fill in the TikTok URL input (switch to URL mode first)
  const urlTab = page.getByRole("button", { name: /url/i });
  await urlTab.click();

  const textarea = page.locator("textarea");
  await textarea.fill("https://www.tiktok.com/@test/video/1234567890");

  // Submit the form
  const submitBtn = page.getByRole("button", { name: /submit/i }).or(
    page.locator("button[type='submit']"),
  );
  await submitBtn.click();

  // Expect URL to transition to /analyze/[id] within 5s (after event:started arrives)
  await expect(page).toHaveURL(new RegExp(`/analyze/${ANALYSIS_ID}`), { timeout: 5000 });

  // Expect at least one panel to have data-panel-ready="ready" within 10s
  // (after all stage_end events + event:complete arrive)
  await expect(
    page.locator('[data-panel-id][data-panel-ready="ready"]').first(),
  ).toBeVisible({ timeout: 10000 });
});

test.fixme(
  "revisiting a completed /analyze/[id] URL renders all panels without re-streaming (Pitfall #3)",
  async () => {
    // Deferred to P7 — needs seeded completed-analysis row in DB + full auth fixture.
    // When implemented: navigate directly to /analyze/<known-completed-id> and assert
    // all [data-panel-id] elements have data-panel-ready="ready" without a network flush.
  },
);

test.fixme(
  "simulate connection drop → assert phase transitions to 'reconnecting' within 3s",
  async () => {
    // Deferred to P7 — requires network condition simulation via Playwright CDP.
    // See Plan 01-02 reconnect ladder implementation for the EventSource path.
  },
);
