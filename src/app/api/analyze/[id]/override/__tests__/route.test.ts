/**
 * Tests for POST /api/analyze/[id]/override route handler.
 * All DB + auth layers mocked — no real Supabase connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase server client BEFORE importing route ----

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { POST } from '../route';
import { createClient } from '@/lib/supabase/server';

// Helper to create mock supabase client
function createMockClient({
  user = { id: 'user-123' } as { id: string } | null,
  updateError = null as unknown,
  upsertError = null as unknown,
} = {}) {
  const updateBuilder = {
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };

  const upsertResult = vi.fn().mockResolvedValue({ error: upsertError });

  const fromMock = vi.fn((table: string) => {
    if (table === 'analysis_results') {
      return { update: vi.fn().mockReturnValue(updateBuilder) };
    }
    if (table === 'creator_persona_weights') {
      return { upsert: upsertResult };
    }
    return { update: vi.fn(), upsert: vi.fn() };
  });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: fromMock,
    _updateBuilder: updateBuilder,
    _upsertResult: upsertResult,
  };
}

// Helper to build a mock Request
function makeRequest(body: unknown, id = 'analysis-abc') {
  const req = new Request(`http://localhost/api/analyze/${id}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { req, params: Promise.resolve({ id }) };
}

const VALID_WEIGHTS = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };

describe('POST /api/analyze/[id]/override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when no auth user', async () => {
    const client = createMockClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({ weights: VALID_WEIGHTS });
    const res = await POST(req, { params });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');
  });

  it('400 when JSON parse fails', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const req = new Request('http://localhost/api/analyze/abc/override', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json at all {{{',
    });
    const params = Promise.resolve({ id: 'abc' });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_json');
  });

  it('400 when weights sum != 1.0 ±0.01', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({
      weights: { fyp: 0.5, niche: 0.5, loyalist: 0.5, cross_niche: 0.5 }, // sum=2.0
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_weights');
  });

  it('400 when individual weight > 1', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({
      weights: { fyp: 1.5, niche: 0.0, loyalist: 0.0, cross_niche: 0.0 },
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
  });

  it('200 on valid request, writes to analysis_results.analysis_override', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({ weights: VALID_WEIGHTS });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify analysis_results.update was called
    expect(client.from).toHaveBeenCalledWith('analysis_results');
    const updateCall = client.from.mock.results.find(
      (r) => r.type === 'return' && r.value?.update,
    );
    expect(updateCall).toBeDefined();
  });

  it('200 + save_as_default=true upserts creator_persona_weights', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({
      weights: VALID_WEIGHTS,
      save_as_default: true,
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    // Verify creator_persona_weights.upsert was called with user_id
    expect(client.from).toHaveBeenCalledWith('creator_persona_weights');
    expect(client._upsertResult).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', ...VALID_WEIGHTS }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });

  it('500 when analysis_results update fails', async () => {
    const client = createMockClient({ updateError: { message: 'db error', code: '42501' } });
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({ weights: VALID_WEIGHTS });
    const res = await POST(req, { params });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('override_write_failed');
  });

  it('save_as_default=false skips creator_persona_weights write', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const { req, params } = makeRequest({
      weights: VALID_WEIGHTS,
      save_as_default: false,
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    // creator_persona_weights should NOT have been touched
    const cpwCalls = client.from.mock.calls.filter(([table]: [string]) => table === 'creator_persona_weights');
    expect(cpwCalls).toHaveLength(0);
  });

  it('errors return generic codes, never echo raw input (XSS guard T-04-21)', async () => {
    const client = createMockClient();
    vi.mocked(createClient).mockResolvedValue(client as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);

    const maliciousWeights = {
      fyp: 0.5,
      niche: 0.5,
      loyalist: 0.5,
      cross_niche: 0.5, // sum=2.0 — invalid
    };
    const { req, params } = makeRequest({ weights: maliciousWeights });
    const res = await POST(req, { params });

    const json = await res.json();
    // Error message must be generic code, not reflect raw values
    expect(JSON.stringify(json)).not.toContain('0.5');
    expect(json.error).toBe('invalid_weights');
  });
});
