/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { POST } from '../route';
import { createClient } from '@/lib/supabase/server';

function createMockClient({
  user = { id: 'user-123' } as { id: string } | null,
  updateError = null as { message: string } | null,
} = {}) {
  // Capture the UPDATE payload so tests can assert SET vs CLEAR shape
  const capturedUpdates: unknown[] = [];
  const updateFn = vi.fn((payload: unknown) => {
    capturedUpdates.push(payload);
    return {
      eq: vi.fn((_col: string, _val: string) => ({
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      })),
    };
  });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ update: updateFn })),
    _capturedUpdates: capturedUpdates,
  };
}

function makeRequest(body: unknown, id = 'analysis-id-1234') {
  const req = new Request(`http://localhost/api/analyze/${id}/optimal-post-override`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return { req, params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/analyze/[id]/optimal-post-override', () => {
  it('1. rejects invalid day_of_week with 400 invalid_override', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ day_of_week: 'Funday', hour_range: [18, 21] });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_override');
  });

  it('2. rejects hour_range where end <= start with 400 invalid_override', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ day_of_week: 'Tue', hour_range: [21, 18] });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_override');
  });

  it('3. returns 401 when no auth user', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({ user: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ day_of_week: 'Tue', hour_range: [18, 21] });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('4. SET variant returns 200 { ok: true } and writes JSONB payload', async () => {
    const mockClient = createMockClient();
    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ day_of_week: 'Thu', hour_range: [20, 23] });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    // Verify SET payload shape (JSONB, not null)
    const captured = (mockClient as unknown as { _capturedUpdates: Array<{ optimal_post_override: unknown }> })._capturedUpdates;
    expect(captured.length).toBe(1);
    const payload = captured[0].optimal_post_override as { day_of_week: string; hour_range: number[]; saved_at: string };
    expect(payload).not.toBeNull();
    expect(payload.day_of_week).toBe('Thu');
    expect(payload.hour_range).toEqual([20, 23]);
    expect(typeof payload.saved_at).toBe('string');
  });

  it('5. returns 500 override_write_failed on Supabase error', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({ updateError: { message: 'connection lost' } }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ day_of_week: 'Thu', hour_range: [20, 23] });
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('override_write_failed');
  });

  it('6. XSS guard — error response never echoes raw input', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const xssPayload = { day_of_week: '<script>alert(1)</script>', hour_range: [18, 21] };
    const { req, params } = makeRequest(xssPayload);
    const res = await POST(req, { params });
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('<script>');
    expect(serialized).not.toContain('alert(1)');
  });

  it('7. CLEAR variant: { clear: true } returns 200 and writes NULL to optimal_post_override (D-27)', async () => {
    const mockClient = createMockClient();
    vi.mocked(createClient).mockResolvedValue(
      mockClient as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ clear: true });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    // Verify CLEAR payload writes null (NOT a JSONB object that happens to match the recommendation)
    const captured = (mockClient as unknown as { _capturedUpdates: Array<{ optimal_post_override: unknown }> })._capturedUpdates;
    expect(captured.length).toBe(1);
    expect(captured[0].optimal_post_override).toBeNull();
  });

  it('8. CLEAR variant rejection: { clear: false } returns 400 invalid_override', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest({ clear: false });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_override');
  });

  it('bonus: invalid id (path traversal) returns 400 invalid_id BEFORE auth check', async () => {
    // Auth client not even invoked because Zod fails first
    const req = new Request('http://localhost/api/analyze/..%2F..%2Fetc/optimal-post-override', {
      method: 'POST',
      body: JSON.stringify({ day_of_week: 'Tue', hour_range: [18, 21] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: '../etc' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_id');
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });
});
