/**
 * GET /api/audiences/[id]/rollup — what this audience has actually SAID (ROLLUP-01, P2).
 *
 * Rolls the user's persisted `multi-audience-read` blocks up to ONE audience:
 *   - `personas` — each persona's latest real reaction (verdict + first-person quote)
 *   - `compared` / `diverged` / `cases` — how often this audience disagreed with the
 *     audience it was read against
 *
 * Bands only (F3): Strong | Mixed | Weak. No numeric score is returned, computed, or
 * derivable from this payload.
 *
 * Security:
 *  - Auth-first, before any DB read (T-07-03)
 *  - The audience id is resolved via getAudience under the SESSION (RLS-scoped) — an id
 *    that isn't yours 404s before any message is scanned
 *  - The rollup scan runs on the RLS-scoped session client; messages_select_own confines it
 *    to the caller's own threads. The service client must never be used here.
 *  - Read-only: no csrfGuard (GET is not a mutating method — mirrors the sibling GET)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAudience } from "@/lib/audience/audience-repo";
import { rollupReadsForAudience } from "@/lib/audience/read-rollup";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Resolve the audience under the session FIRST (RLS-scoped; virtual sentinels like
    // "general" short-circuit in the repo). An id the caller does not own never reaches
    // the message scan.
    const audience = await getAudience(supabase, id);
    if (!audience) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const rollup = await rollupReadsForAudience(supabase, id);

    return NextResponse.json({ audience: { id: audience.id, name: audience.name }, rollup });
  } catch {
    return NextResponse.json({ error: "rollup_failed" }, { status: 500 });
  }
}
