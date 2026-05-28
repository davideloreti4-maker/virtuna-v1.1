import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analyze/[id]/comparisons
 *
 * Returns up to 10 most-recent prior overall_score values for the authenticated user,
 * excluding the current analysis. Niche aggregate deferred to a future phase
 * (RESEARCH Open Question 1).
 *
 * Security (STRIDE T-05-15 to T-05-19):
 * - Zod UUID validates `id` URL param before any DB query (T-05-19)
 * - auth.getUser() gates all DB access (T-05-16)
 * - .eq('user_id', user.id) + RLS on analysis_results enforce owner-only reads (T-05-16)
 * - .select('overall_score') never returns ids or PII (T-05-17)
 * - .limit(10) prevents unbounded query (T-05-18)
 * - Supabase JS parameterized queries prevent SQL injection (T-05-15)
 */

const ParamsSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const validated = ParamsSchema.safeParse(resolved);
  if (!validated.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validated.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // RLS on `analysis_results` also enforces `user_id = auth.uid()` — defense in depth.
  // Note: the DB table is `analysis_results` (not `analyses`) per the Phase 1 schema.
  // Column `overall_score` confirmed in migration 20260213000000_content_intelligence.sql:90.
  const { data, error } = await supabase
    .from('analysis_results')
    .select('overall_score')
    .eq('user_id', user.id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'comparisons_fetch_failed' }, { status: 500 });
  }

  const history: number[] =
    data?.map((r) => Number(r.overall_score)).filter((n) => Number.isFinite(n)) ?? [];

  // Niche aggregate deferred to a future phase (RESEARCH Open Question 1).
  return NextResponse.json({ history, niche: null });
}
