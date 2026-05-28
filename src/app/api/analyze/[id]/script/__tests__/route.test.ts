/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks MUST be declared before importing the route module
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GET } from '../route';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

type Row = Record<string, unknown> | null;

function createMockClient({
  user = { id: 'user-123' } as { id: string } | null,
  row = null as Row,
  selectError = null as { message: string } | null,
} = {}) {
  const selectBuilder: {
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: row, error: selectError }),
  };
  // Chain: .from(table).select(cols).eq('id', id).eq('user_id', user.id).maybeSingle()
  selectBuilder.eq = vi.fn().mockReturnValue(selectBuilder);

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select: vi.fn().mockReturnValue(selectBuilder) })),
  };
}

function createServiceMock({
  updateError = null as { message: string } | null,
} = {}) {
  const updateThen = (
    cb: (r: { error: { message: string } | null }) => void,
  ) => {
    cb({ error: updateError });
    return Promise.resolve({ error: updateError });
  };
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ then: updateThen })),
      })),
    })),
  };
}

function makeRequest(id = 'analysis-id-1234') {
  return {
    req: new Request(`http://localhost/api/analyze/${id}/script`),
    params: Promise.resolve({ id }),
  };
}

const baseRow = {
  id: 'analysis-id-1234',
  counterfactuals: null,
  factors: null,
  reasoning: 'Plain reasoning prose.',
  confidence: 0.4,
  confidence_label: 'LOW',
  anti_virality_gated: false,
  hook_decomposition: null,
  engine_version: 'v3.0.0',
  script_result: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceClient).mockReturnValue(
    createServiceMock() as unknown as ReturnType<typeof createServiceClient>,
  );
});

describe('GET /api/analyze/[id]/script', () => {
  it('1. cache hit returns persisted ScriptResult', async () => {
    const persisted = {
      is_empty_state: false,
      script: {
        opening_line: 'X',
        scene_order: ['0:00 — Y'],
        voiceover: 'Z',
        captions: ['W'],
      },
      engine_version: 'v3.0.0',
      generated_at: '2026-05-28T00:00:00.000Z',
    };
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        row: { ...baseRow, script_result: persisted },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(persisted);
  });

  it('2. cache miss with low band computes full script (4 sections)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        row: {
          ...baseRow,
          confidence_label: 'LOW',
          counterfactuals: {
            band: 'low',
            suggestions: [
              {
                type: 'fix',
                headline: 'Lead with motion',
                detail: 'Open with the gym shot before any words.',
                timestamp_ms: 0,
                signal_anchor: 'hook_decomposition.visual_stop_power',
              },
              {
                type: 'fix',
                headline: 'Add overlay POV:',
                detail: 'A POV text overlay reinforces the hook.',
                timestamp_ms: 1000,
                signal_anchor: 'hook_decomposition.text_overlay_score',
              },
            ],
          },
          factors: [
            {
              name: 'Hook score',
              score: 1,
              max_score: 5,
              rationale: 'Weak',
              improvement_tip: 'Tighten first frame.',
            },
          ],
        },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_empty_state).toBe(false);
    expect(body.script.opening_line.length).toBeGreaterThan(0);
    expect(body.script.scene_order.length).toBeGreaterThan(0);
    expect(body.script.voiceover.length).toBeGreaterThan(0);
    expect(body.script.captions.length).toBeGreaterThan(0);
    expect(body.engine_version).toBe('v3.0.0');
  });

  it('3. high-confidence empty state returns is_empty_state: true', async () => {
    // counterfactuals null → opening_variants sourced from hook/opening factors (computeScript fallback path).
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        row: {
          ...baseRow,
          confidence: 0.85,
          confidence_label: 'HIGH',
          anti_virality_gated: false,
          factors: [
            {
              name: 'Hook strength',
              score: 4,
              max_score: 5,
              rationale: 'Strong',
              improvement_tip: 'Try opener A',
            },
            {
              name: 'Opening pacing',
              score: 4,
              max_score: 5,
              rationale: 'Solid',
              improvement_tip: 'Try opener B',
            },
          ],
        },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    const body = await res.json();
    expect(body.is_empty_state).toBe(true);
    expect(Array.isArray(body.opening_variants)).toBe(true);
    expect(body.opening_variants.length).toBeGreaterThanOrEqual(2);
  });

  it('4. low-confidence gating returns full script (NOT empty state)', async () => {
    // low-confidence row: confidence_label 'LOW' inherently excludes the empty-state branch.
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        row: {
          ...baseRow,
          confidence: 0.3,
        },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    const body = await res.json();
    expect(body.is_empty_state).toBe(false);
  });

  it('5. unauthenticated returns 401', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        user: null,
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it('6. invalid id returns 400', async () => {
    const { req } = makeRequest('../../etc');
    const res = await GET(req, { params: Promise.resolve({ id: '../../etc' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_id');
  });

  it('7. wrong-owner returns 404 not_found (RLS returns null)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({ row: null }) as unknown as Awaited<
        ReturnType<typeof createClient>
      >,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it('8. missing row returns 404 not_found', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({ row: null }) as unknown as Awaited<
        ReturnType<typeof createClient>
      >,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it('9. engine_version skew forces recompute', async () => {
    const stalePersisted = {
      is_empty_state: false,
      script: {
        opening_line: 'STALE',
        scene_order: [],
        voiceover: '',
        captions: [],
      },
      engine_version: 'v2.0.0',
      generated_at: '2025-01-01T00:00:00Z',
    };
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({
        row: {
          ...baseRow,
          engine_version: 'v3.0.0', // row says v3
          script_result: stalePersisted, // cache says v2 → must recompute
        },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    const body = await res.json();
    expect(body.engine_version).toBe('v3.0.0');
    expect(body.script?.opening_line ?? '').not.toBe('STALE');
  });

  it('10. service-client write failure does NOT fail the response', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockClient({ row: { ...baseRow } }) as unknown as Awaited<
        ReturnType<typeof createClient>
      >,
    );
    vi.mocked(createServiceClient).mockReturnValue(
      createServiceMock({
        updateError: { message: 'DB connection refused' },
      }) as unknown as ReturnType<typeof createServiceClient>,
    );
    const { req, params } = makeRequest();
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
  });
});
