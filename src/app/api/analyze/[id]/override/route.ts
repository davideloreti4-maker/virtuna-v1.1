import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database.types';

/**
 * POST /api/analyze/[id]/override
 *
 * Writes per-analysis weight override to analysis_results.analysis_override JSONB.
 * Optionally upserts creator_persona_weights when save_as_default=true.
 *
 * Security (STRIDE T-04-18 to T-04-21):
 * - Zod validates each weight ∈ [0,1] and sum ≈ 1.0 ±0.01 (matches DB CHECK constraint)
 * - Existing analysis_results RLS enforces auth.uid() = user_id on UPDATE (T-04-19)
 * - cpw_upsert_own RLS policy gates creator_persona_weights by auth.uid() (T-04-20)
 * - Errors return generic codes; never echo raw user input (T-04-21 XSS guard)
 */

const WeightsSchema = z
  .object({
    fyp: z.number().min(0).max(1),
    niche: z.number().min(0).max(1),
    loyalist: z.number().min(0).max(1),
    cross_niche: z.number().min(0).max(1),
  })
  .refine(
    (w) => Math.abs(w.fyp + w.niche + w.loyalist + w.cross_niche - 1) < 0.01,
    { message: 'Weights must sum to 1.0 (±0.01)' },
  );

const RequestSchema = z.object({
  weights: WeightsSchema,
  save_as_default: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_weights' }, { status: 400 });
  }

  const { weights, save_as_default } = parsed.data;

  // Write per-analysis override (RLS on analysis_results enforces owner-only UPDATE).
  // analysis_override is opaque JSONB — cast the value to Json on the boundary
  // (mirrors analyze/route.ts) so the typed client checks the column name.
  const { error: e1 } = await supabase
    .from('analysis_results')
    .update({
      analysis_override: {
        weights,
        weights_source: 'analysis_override',
        updated_at: new Date().toISOString(),
      } as unknown as Json,
    })
    .eq('id', id);

  if (e1) {
    return NextResponse.json({ error: 'override_write_failed' }, { status: 500 });
  }

  // Optionally upsert creator default weights (cpw_upsert_own RLS enforces user_id = auth.uid())
  // creator_persona_weights table added in migration 20260527000000_audience_overrides.sql
  if (save_as_default === true) {
    const { error: e2 } = await supabase
      .from('creator_persona_weights')
      .upsert(
        {
          user_id: user.id,
          fyp: weights.fyp,
          niche: weights.niche,
          loyalist: weights.loyalist,
          cross_niche: weights.cross_niche,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (e2) {
      return NextResponse.json({ error: 'default_save_failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
