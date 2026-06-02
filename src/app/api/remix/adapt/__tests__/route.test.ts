/**
 * Wave 0 test scaffolds for /api/remix/adapt route.ts
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — auth-401: returns 401 when no authenticated user
 *   2 — zod-body-400: returns 400 on malformed request body (Zod validation)
 *   3 — read-merge-write: preserves pre-seeded variants.craft AND variants.remix.decode
 *   4 — ownership-404: returns 404 when analysis_results row belongs to another user
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =====================================================
// Module mocks (before route import)
// =====================================================

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'test-req-id') }));

// Qwen mock — same shape as stage11-counterfactuals.test.ts
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

// Supabase auth mock
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

// Supabase service mock
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

// adapt engine mock — plan 04-02 creates the real implementation
vi.mock('@/lib/engine/remix/adapt', () => ({
  generateAdaptConcepts: vi.fn(),
}));

process.env.DASHSCOPE_API_KEY = 'test-key';

// =====================================================
// Fixtures
// =====================================================

const VALID_BODY = {
  analysis_id: '00000000-0000-0000-0000-000000000001',
  decode: {
    hook_pattern: 'Open with a provocative question, delay the answer',
    structure: 'Hook (0-3s) → tension build (3-12s) → reveal (12-22s) → CTA (22-30s)',
    the_turn: 'Pivot from problem statement to counter-intuitive solution at 15s',
    emotional_beat: 'Curiosity → frustration → relief → motivation',
    repeatable: [
      { label: 'open-loop cold open', why_repeatable: 'Format hook, not topic-specific' },
      { label: '4-beat emotional arc', why_repeatable: 'Structural pacing pattern' },
    ],
    // Note: luck[] is intentionally ABSENT — D-01 structural guard; the Zod schema excludes it
  },
  niche: 'fitness',
};

// =====================================================
// Tests
// =====================================================

describe('/api/remix/adapt route (Wave 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'auth-401: returns 401 when supabase.auth.getUser() returns no user',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'zod-body-400: returns 400 when request body is missing required fields',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'zod-body-400: returns 400 when analysis_id is not a valid UUID',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'ownership-404: returns 404 when analysis_results row belongs to a different user',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'read-merge-write: preserves variants.craft AND variants.remix.decode when writing variants.remix.adapt (Pitfall 2)',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'success-200: returns { concepts: [...] } with 3 concepts when adapt engine succeeds',
  );

  // =====================================================
  // Wave 0 smoke — fixture verification
  // =====================================================

  it('VALID_BODY has no luck field (D-01 structural guard at body level)', () => {
    // The Zod schema for the request body must NOT include luck[]
    // This smoke checks the fixture itself conforms to the expected schema shape
    expect('luck' in VALID_BODY.decode).toBe(false);
  });

  it('VALID_BODY.analysis_id is a valid UUID format', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidPattern.test(VALID_BODY.analysis_id)).toBe(true);
  });

  it('mockGetUser is defined (auth mock wired correctly)', () => {
    expect(typeof mockGetUser).toBe('function');
  });
});
