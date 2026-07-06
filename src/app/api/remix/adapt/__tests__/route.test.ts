/**
 * Wave 0 test scaffolds for /api/remix/adapt route.ts
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — auth-401: returns 401 when no authenticated user
 *   2 — content-type-415: returns 415 when Content-Type is not application/json
 *   3 — cross-origin-403: returns 403 on cross-origin request
 *   4 — zod-body-400: returns 400 on malformed request body (Zod validation)
 *   5 — ownership-404: returns 404 when analysis_results row belongs to another user
 *   6 — atomic-patch: persists variants.remix.adapt via patch_analysis_variants (Bug #7)
 *   7 — success-200: returns { concepts } when adapt engine succeeds
 *   8 — null-engine-500: returns 500 when generateAdaptConcepts returns null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =====================================================
// Module mocks — MUST be before route import
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

// All mocked variables are declared via vi.hoisted() to avoid temporal dead zone
// issues with vi.mock factory hoisting (see vitest docs on vi.hoisted).
const { mockCreate, mockGetUser, mockFrom, mockRpc, mockGenerateAdaptConcepts } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGenerateAdaptConcepts: vi.fn(),
}));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/engine/remix/adapt', () => ({
  generateAdaptConcepts: mockGenerateAdaptConcepts,
}));

process.env.DASHSCOPE_API_KEY = 'test-key';

// =====================================================
// Route import — AFTER mocks, at top level (mirroring analyze/route.test.ts pattern)
// =====================================================
import { POST } from '../route';

// =====================================================
// Fixtures
// =====================================================

const ANALYSIS_ID = '550e8400-e29b-41d4-a716-446655440000'; // valid UUID v4
const USER_ID = 'user-abc-123';

const VALID_BODY = {
  analysis_id: ANALYSIS_ID,
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

const THREE_CONCEPTS = [
  { hook: 'Hook 1', angle: 'Angle 1', who_its_for: 'Who 1', format_borrowed: 'open-loop cold open' },
  { hook: 'Hook 2', angle: 'Angle 2', who_its_for: 'Who 2', format_borrowed: '4-beat emotional arc' },
  { hook: 'Hook 3', angle: 'Angle 3', who_its_for: 'Who 3', format_borrowed: 'counter-intuitive turn' },
];

// Helper to make a POST Request
function makeRequest(
  body: unknown,
  options: { contentType?: string; origin?: string } = {},
): Request {
  const url = 'http://localhost:3000/api/remix/adapt';
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
  };
  if (options.origin !== undefined) {
    headers['origin'] = options.origin;
  }
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// The single from() call the route makes: the ownership check (select user_id).
function makeOwnershipFrom(userId: string) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { user_id: userId },
          error: null,
        }),
      })),
    })),
  };
}

// =====================================================
// Tests
// =====================================================

describe('/api/remix/adapt route (Wave 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the atomic variants patch succeeds. Individual tests override as needed.
    mockRpc.mockResolvedValue({ error: null });
  });

  it('auth-401: returns 401 when supabase.auth.getUser() returns no user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/unauthorized/i);
  });

  it('content-type-415: returns 415 when Content-Type is not application/json', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    const req = makeRequest(VALID_BODY, { contentType: 'text/plain' });
    const res = await POST(req);

    expect(res.status).toBe(415);
  });

  it('cross-origin-403: returns 403 on cross-origin request', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    const req = makeRequest(VALID_BODY, { origin: 'http://evil.example.com' });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('zod-body-400: returns 400 when request body is missing required fields', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    const req = makeRequest({ not_a_valid_body: true });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/validation/i);
  });

  it('zod-body-400: returns 400 when analysis_id is not a url-safe id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    // Contains a space + "!" — fails the url-safe regex.
    const req = makeRequest({ ...VALID_BODY, analysis_id: 'bad id!' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('accepts a nanoid analysis_id (regression: ids are nanoids, NOT UUIDs)', async () => {
    // "KSW5TluyRy0L" is a real nanoid(12) — the prior z.string().uuid() rejected
    // every real id with a 400, breaking the whole Adapt generation flow live.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });
    mockFrom.mockReturnValueOnce(makeOwnershipFrom(USER_ID));
    mockGenerateAdaptConcepts.mockResolvedValueOnce(THREE_CONCEPTS);

    const req = makeRequest({ ...VALID_BODY, analysis_id: 'KSW5TluyRy0L' });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it('ownership-404: returns 404 when analysis_results row belongs to a different user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    // from() → ownership check: returns a different user_id
    mockFrom.mockReturnValueOnce(makeOwnershipFrom('other-user-999'));

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it('atomic-patch: persists { remix: { adapt } } via patch_analysis_variants (Bug #7 — RPC deep-merges, preserving craft + decode)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });
    mockFrom.mockReturnValueOnce(makeOwnershipFrom(USER_ID));
    mockGenerateAdaptConcepts.mockResolvedValueOnce(THREE_CONCEPTS);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(200);

    // The write is a single atomic RPC patch — the RPC deep-merges { remix: { adapt } }
    // server-side, so craft + remix.decode siblings survive with no read-modify-write window.
    expect(mockRpc).toHaveBeenCalledWith(
      'patch_analysis_variants',
      expect.objectContaining({
        p_id: ANALYSIS_ID,
        p_user_id: USER_ID,
        p_patch: { remix: { adapt: THREE_CONCEPTS } },
      }),
    );
  });

  it('success-200: returns { concepts: [...] } with 3 concepts when adapt engine succeeds', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });
    mockFrom.mockReturnValueOnce(makeOwnershipFrom(USER_ID));
    mockGenerateAdaptConcepts.mockResolvedValueOnce(THREE_CONCEPTS);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json() as { concepts: unknown[] };
    expect(json.concepts).toHaveLength(3);
  });

  it('null-engine-500: returns 500 when generateAdaptConcepts returns null, variants NOT written', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });
    mockFrom.mockReturnValueOnce(makeOwnershipFrom(USER_ID));
    mockGenerateAdaptConcepts.mockResolvedValueOnce(null);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(500);
    // Variants must NOT be written when the generator returns null.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // =====================================================
  // Wave 0 smoke — fixture verification
  // =====================================================

  it('VALID_BODY has no luck field (D-01 structural guard at body level)', () => {
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
