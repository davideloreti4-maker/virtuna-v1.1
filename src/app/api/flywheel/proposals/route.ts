/**
 * /api/flywheel/proposals — recalibration propose → confirm/decline (FLYWHEEL-04/05).
 *
 * Auth-first idiom (mirrors /api/saved):
 *  - getUser() gates every method; 401 when unauthenticated (T-10-16 elevation guard —
 *    a user can only act on their own audience; RLS scopes audiences/reconciliations).
 *  - user_id is ALWAYS derived from the session inside the repos (CR-01); the body NEVER
 *    supplies it.
 *
 * Regression gate (D-03 / Pitfall 5): propose.ts refuses General/preset audiences and
 * writes ONLY the audience's persona_weights (analysis_override slot) on confirm. This
 * route is a thin auth-first wrapper over that guarded logic.
 *
 *   GET  /api/flywheel/proposals?audience_id=…   → { proposal } | { proposal: null }
 *   POST /api/flywheel/proposals                 → { audience_id, proposal_id, action }
 *                                                   action: 'confirm' | 'decline'
 */

import { createClient } from "@/lib/supabase/server";
import {
  getPendingProposals,
  confirmProposal,
  declineProposal,
} from "@/lib/flywheel/propose";

/**
 * GET /api/flywheel/proposals?audience_id=…
 *
 * Returns the pending proposal set for the audience, or { proposal: null } when nothing
 * is above the confidence gate (the UI renders NO nudge below the gate). General/preset
 * audiences always return null (propose.ts short-circuits).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const audienceId = searchParams.get("audience_id");
    if (!audienceId) {
      return Response.json(
        { error: "audience_id query param is required" },
        { status: 400 },
      );
    }

    const proposal = await getPendingProposals(supabase, audienceId);
    return Response.json({ proposal });
  } catch (error) {
    console.error("[flywheel/proposals] GET error:", error);
    return Response.json(
      { error: "Failed to load proposals" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/flywheel/proposals
 *
 * Body: { audience_id, proposal_id, action: 'confirm' | 'decline' }
 *  - confirm → bounded override written to persona_weights (non-general only) + rows confirmed.
 *  - decline → contributing rows marked 'declined' (no re-nag); audience untouched.
 * General/preset confirm attempts surface as 400 (the regression-gate refusal).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const { audience_id, proposal_id, action } = body as {
      audience_id?: unknown;
      proposal_id?: unknown;
      action?: unknown;
    };

    if (
      typeof audience_id !== "string" ||
      typeof proposal_id !== "string" ||
      (action !== "confirm" && action !== "decline")
    ) {
      return Response.json(
        {
          error:
            "Body must be { audience_id: string, proposal_id: string, action: 'confirm' | 'decline' }",
        },
        { status: 400 },
      );
    }

    if (action === "confirm") {
      await confirmProposal(supabase, audience_id, proposal_id);
    } else {
      await declineProposal(supabase, audience_id, proposal_id);
    }

    return Response.json({ success: true, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // Regression-gate refusal (General/preset) + stale-proposal surface as 400 client errors.
    if (
      message.includes("never recalibrated") ||
      message.includes("no longer above the confidence gate")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("[flywheel/proposals] POST error:", error);
    return Response.json(
      { error: "Failed to apply proposal action" },
      { status: 500 },
    );
  }
}
