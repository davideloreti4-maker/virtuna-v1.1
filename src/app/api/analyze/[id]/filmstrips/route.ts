import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { signAnalysisFrames } from '@/lib/engine/filmstrip/storage';

/**
 * GET /api/analyze/[id]/filmstrips
 *
 * Returns signed keyframe URLs for a completed analysis as a
 * `{ frames: Record<segmentIdx, url> }` map, so the Audience filmstrip + Input
 * thumbnail render on permalink replay. Live runs get these via SSE
 * (filmstrip_segment_ready); this endpoint re-signs the persisted JPEGs in the
 * private `filmstrips` bucket (path `<analysisId>/<segmentIdx>.jpg`) on read,
 * since signed URLs are not persisted and expire.
 *
 * Auth: user must own the analysis (RLS-scoped select). Listing/signing uses the
 * service client (bucket is private, signed-URL-only).
 */
const ParamsSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});

const SIGNED_URL_TTL_S = 60 * 60; // 1h — board sessions are short-lived

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const validated = ParamsSchema.safeParse(await params);
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

  // Ownership gate (RLS also enforces user_id = auth.uid()).
  const { data: row } = await supabase
    .from('analysis_results')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Re-sign the persisted JPEGs (shared with the in-thread Test card). Ownership is enforced above.
  const frames = await signAnalysisFrames(id, SIGNED_URL_TTL_S);
  return NextResponse.json({ frames });
}
