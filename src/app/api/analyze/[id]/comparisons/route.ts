import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/analyze/[id]/comparisons
 *
 * Returns up to 10 most-recent prior overall_score values for the authenticated user,
 * excluding the current analysis, plus a cross-user niche cohort aggregate
 * (median / p75 / count) when the analysis has a society_id and the cohort meets
 * the minimum size. Niche stats come from the compute_niche_percentiles RPC
 * (aggregate-only, called via the service-role client since RLS otherwise hides
 * other users' rows). Returns niche=null when no society_id or cohort < min size.
 *
 * Security (STRIDE T-05-15 to T-05-19):
 * - Zod UUID validates `id` URL param before any DB query (T-05-19)
 * - auth.getUser() gates all DB access (T-05-16)
 * - .eq('user_id', user.id) + RLS on analysis_results enforce owner-only reads (T-05-16)
 * - .select('overall_score') never returns ids or PII (T-05-17)
 * - .limit(10) prevents unbounded query (T-05-18)
 * - Supabase JS parameterized queries prevent SQL injection (T-05-15)
 */

// Analysis IDs are either legacy UUIDs (`5958d1c6-…`) or modern nanoid
// (`fThrLL4fGQyx`). Validate the safe-character set rather than a single shape
// — defends against injection while accepting both.
const ParamsSchema = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
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
  // Also read this analysis's society_id (RLS-scoped) to drive the niche cohort.
  const [{ data, error }, currentRow] = await Promise.all([
    supabase
      .from('analysis_results')
      .select('overall_score')
      .eq('user_id', user.id)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('analysis_results')
      .select('society_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: 'comparisons_fetch_failed' }, { status: 500 });
  }

  const history: number[] =
    data?.map((r) => Number(r.overall_score)).filter((n) => Number.isFinite(n)) ?? [];

  // Niche cohort: cross-user aggregate via SECURITY DEFINER RPC. Aggregate-only
  // (median/p75/count/histogram); excludes the requesting user; min cohort enforced in SQL.
  let niche: { median: number; p75: number; count: number; histogram: number[] } | null = null;
  const societyId = currentRow.data?.society_id ?? null;
  if (societyId) {
    const service = createServiceClient();
    const { data: rows } = await service.rpc('compute_niche_percentiles', {
      p_society_id: societyId,
      p_exclude_user_id: user.id,
      p_min_cohort_size: 5,
    });
    const row = rows?.[0];
    if (row && Number.isFinite(Number(row.median))) {
      const raw: unknown[] = Array.isArray(row.histogram) ? (row.histogram as unknown[]) : [];
      const histogram: number[] = Array.from({ length: 10 }, (_, i) => {
        const v = Number(raw[i]);
        return Number.isFinite(v) ? v : 0;
      });
      niche = {
        median: Number(row.median),
        p75: Number(row.p75),
        count: Number(row.count),
        histogram,
      };
    }
  }

  return NextResponse.json({ history, niche });
}
