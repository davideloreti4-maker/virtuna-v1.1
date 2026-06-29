/**
 * POST /api/account-read — SSE Account Read route (SELF-01/02).
 *
 * "Read my account" — streams a Read on the creator's OWN account. The own-account
 * scrape is the same 1-3 min Apify profile as P7 calibration, so this mirrors
 * /api/audiences/calibrate verbatim: maxDuration=300, auth-first getUser(), staged
 * status → done / fallback / error.
 *
 * SSE event names (10-UI-SPEC §"Account Read card"):
 *   event: status   — { message: string } — "Reading your account…"
 *   event: fallback — { reason: 'thin', message: string } — honest thin-history (SELF-02, warning-toned)
 *   event: error    — { message: string } — scrape/network failure, generic copy (never echoes the handle)
 *   event: done     — { block: AccountReadBlock } — the composed account-read block (thread persists it)
 *
 * Security (STRIDE T-10-12/13):
 *  - Auth-first: getUser() before any scrape/DB read (CR-01).
 *  - Handle is resolved from the authenticated user's OWN personal audience
 *    (calibration.handle) — NEVER from arbitrary request input (T-10-12 ownership,
 *    reuses P7 personal-scrape ownership; NOT a new OAuth flow).
 *  - Generic error copy; the raw handle is never echoed into error events (T-10-13).
 *  - maxDuration=300 for Apify latency headroom.
 */

import { createClient } from "@/lib/supabase/server";
import { listAudiences } from "@/lib/audience/audience-repo";
import { listReconciliations } from "@/lib/flywheel/reconciliation-repo";
import { generateAccountRead } from "@/lib/account-read/account-read";
import type { AccountReadBlock } from "@/lib/tools/blocks";

// Apify own-account scrape can take 1-3 minutes — allow max 300s (Pitfall 4 / P7 parity).
export const maxDuration = 300;

// ─── SSE helpers (mirrors calibrate/route.ts) ────────────────────────────────

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

// ─── POST /api/account-read ──────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (CR-01 / T-10-12) — before any scrape or DB read ──────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── (2) Resolve the creator's OWN handle from their personal audience ───────
  // Ownership (T-10-12): the handle comes from the authed user's own calibrated
  // personal audience (P7), NEVER from arbitrary request input. No personal audience
  // / no handle → there is nothing to read yet → honest thin fallback (SELF-02).
  let ownHandle: string | null = null;
  let personalAudienceId: string | null = null;
  try {
    const audiences = await listAudiences(supabase);
    const personal = audiences.find(
      (a) => a.type === "personal" && a.calibration?.handle,
    );
    if (personal) {
      ownHandle = personal.calibration?.handle ?? null;
      personalAudienceId = personal.id;
    }
  } catch {
    // DB read failure — generic error (never echo input).
    return Response.json({ error: "account_read_failed" }, { status: 500 });
  }

  // ── (3) SSE stream ──────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream cancelled — drop frame */
        }
      };

      try {
        // No own handle on file → honest thin fallback (SELF-02 — never fabricate).
        if (!ownHandle) {
          send("fallback", {
            reason: "thin",
            message:
              "Not enough history to read yet. Calibrate your personal audience first, then run this again.",
          });
          return;
        }

        send("status", { message: "Reading your account…" });

        // Reconciliations feed the "fix" guidance + accuracy track record (D-03b / SELF-03).
        // Read-only — the model is NEVER mutated. Best-effort: an empty list degrades
        // gracefully (no fix lines, no track record).
        let reconciliations: Awaited<ReturnType<typeof listReconciliations>> = [];
        if (personalAudienceId) {
          try {
            reconciliations = await listReconciliations(supabase, personalAudienceId);
          } catch {
            reconciliations = [];
          }
        }

        const result = await generateAccountRead(ownHandle, user.id, {
          reconciliations,
        });

        // ── Scrape failure — generic copy, never echo the handle (T-10-13) ──────
        if ("error" in result) {
          send("error", {
            message: "Couldn't read your account. Check your handle is public and try again.",
            retry: true,
          });
          return;
        }

        // ── Thin history — honest warning fallback (SELF-02) ────────────────────
        if ("fallback" in result) {
          send("fallback", {
            reason: "thin",
            message:
              "We couldn't find enough public posts on your account to read its patterns honestly. Post more, or check your handle is public, and try again.",
          });
          return;
        }

        // ── Success — emit the composed account-read block (thread persists it) ─
        const block: AccountReadBlock = {
          type: "account-read",
          props: {
            handle: result.handle,
            profile: result.profile,
            analyzedVideos: result.analyzedVideos,
            patterns: result.patterns,
            trackRecord: result.trackRecord,
          },
        };

        send("done", { block });
      } catch {
        send("error", {
          message: "Couldn't read your account. Check your handle is public and try again.",
          retry: true,
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
