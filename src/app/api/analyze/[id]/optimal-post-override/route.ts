import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/analyze/[id]/optimal-post-override
 *
 * Writes user override of `optimal_post_window` to analysis_results.optimal_post_override JSONB.
 * Analysis-scoped only — creator-profile-wide preference deferred to M2-II (D-28).
 *
 * Two variants (D-27 + D-29):
 * - SET: persists { day_of_week, hour_range, saved_at } JSONB
 * - CLEAR: writes SQL NULL → restores engine recommendation (source pill returns to 'engine')
 *
 * Security (STRIDE T-06-14 to T-06-20):
 * - Zod ParamsSchema validates `id` BEFORE auth check (T-06-15 — improvement over /override/route.ts)
 * - auth.getUser() gates all DB access (T-06-14)
 * - Defense-in-depth: .eq('id', id).eq('user_id', user.id) AND RLS UPDATE policy (T-06-17)
 * - Zod enum constrains day_of_week to 7 literals — <script> payload impossible (T-06-19)
 * - Generic error codes only — no raw input or Postgres text echoed (T-06-18)
 */

// Mirror /comparisons/route.ts ParamsSchema verbatim — security improvement
// over /override/route.ts (which omitted Zod id validation per RESEARCH item 10).
const ParamsSchema = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});

// D-27 + D-29 + RESEARCH item 10 body schema — discriminated union of SET and CLEAR.
// SET = persist {day, hours, saved_at}; CLEAR = reset to engine recommendation by
// writing SQL NULL to the column (D-27: "Reset to recommendation ... clears override";
// D-29: source pill 'creator' must mean edited, NOT matching-recommendation).
const SetSchema = z
  .object({
    day_of_week: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
    hour_range: z.tuple([
      z.number().int().min(0).max(23),
      z.number().int().min(1).max(24),
    ]),
  })
  .refine((v) => v.hour_range[1] > v.hour_range[0], {
    message: 'end must be > start',
    path: ['hour_range'],
  });

const ClearSchema = z.object({
  clear: z.literal(true),
});

const OptimalPostOverrideSchema = z.union([SetSchema, ClearSchema]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Security improvement: Zod-validate `id` BEFORE auth (cheap, reject malformed input fast)
  const resolvedParams = await params;
  const validatedParams = ParamsSchema.safeParse(resolvedParams);
  if (!validatedParams.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validatedParams.data;

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

  const parsed = OptimalPostOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_override' }, { status: 400 });
  }

  // Branch on variant — CLEAR writes NULL, SET writes JSONB row.
  // Type guard: ClearSchema variant has `clear: true` property.
  const isClear = 'clear' in parsed.data && parsed.data.clear === true;

  const updatePayload = isClear
    ? { optimal_post_override: null }
    : {
        optimal_post_override: {
          day_of_week: (parsed.data as z.infer<typeof SetSchema>).day_of_week,
          hour_range: (parsed.data as z.infer<typeof SetSchema>).hour_range,
          saved_at: new Date().toISOString(),
        },
      };

  // Defense-in-depth: explicit .eq('user_id', user.id) even though RLS UPDATE policy
  // already restricts. Per RESEARCH item 10 security improvement over /override/route.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e1 } = await (supabase as any)
    .from('analysis_results')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id);

  if (e1) {
    return NextResponse.json({ error: 'override_write_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
