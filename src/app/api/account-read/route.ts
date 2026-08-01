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
 *   event: stage    — { name: string, status: 'active'|'done' } — the two real scrape phases (4a)
 *   event: evidence — RunEvidence — the profile the moment it lands (the FIRST kind:'profile'
 *                     producer in the app), then the post covers as a filmstrip (4a)
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
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { listAudiences } from "@/lib/audience/audience-repo";
import { listReconciliations } from "@/lib/flywheel/reconciliation-repo";
import { generateAccountRead } from "@/lib/account-read/account-read";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runHeaderBlock } from "@/lib/tools/run-header";
import { kcStamp } from "@/lib/kc/kc-stamp";
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

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (CR-01 / T-10-12) — before any scrape or DB read ──────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── (1b) Credit gate (BILLING) — priced admission BEFORE any engine spend ───
  // This route was ungated and unmetered until 2026-07-29: it ran TWO Apify scrapes (1-3 min,
  // hence maxDuration=300) for free, and `account` was not even a key in CREDIT_COSTS.
  //
  // It sits AFTER the auth gate, and that order is load-bearing. `creditGate` enforces for
  // anonymous users regardless of BILLING_ENFORCE_QUOTA (`enforced = isAnonymous || …`), so a
  // route that gated before checking auth would start refusing anonymous sessions the moment it
  // deployed, flag or no flag. The 401 above means no anonymous session ever reaches this line.
  //
  // The refusal is an HTTP 402 JSON body, NOT an SSE frame — it must be returned before the
  // stream opens, because the client reads `res.ok` to raise the credit wall (see
  // use-account-read-stream.ts) and a 200 carrying a refusal event would sail straight past it.
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user, "account");
  if (refusal) return refusal;

  // ── Optional persist flag (in-thread chat field ONLY) ───────────────────────
  // The account TOOL POSTs no body → persist stays false → the route is bodyless-equivalent and
  // never touches the thread (unchanged). The chat in-thread field POSTs { persist: true } so the
  // account-read block is written to the open thread and a reload surfaces it in the chat view.
  let persist = false;
  try {
    const body = (await request.json()) as { persist?: unknown } | null;
    persist = body?.persist === true;
  } catch {
    /* no/blank body → persist stays false (the account-tool path) */
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
          // 4a — the ~30s of Promise.all held the avatar, the follower count and 30 covers behind
          // one static line. Both halves now report as they land, in the same idiom as the five
          // skill routes.
          onStage: (name, status) => send("stage", { name, status }),
          onEvidence: (evidence) => send("evidence", evidence),
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

        // ── Success — emit the composed account-read block ──────────────────────
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

        // In-thread chat field: also persist the block to the open thread so a post-run reload
        // surfaces it in the chat view (mirrors the explore/read/remix routes). Best-effort — a
        // persist failure must not swallow the streamed result. The account tool skips this
        // (persist=false) and renders the block from the live stream, exactly as before.
        if (persist) {
          try {
            const openThread = await createOpenThreadLazy(user.id);
            await insertMessage(
              openThread.id,
              "assistant",
              [runHeaderBlock({ skill: "account" }), block],
              kcStamp().kcGenVersion,
            );
          } catch {
            /* non-fatal — the streamed block still reaches the client */
          }
        }

        // ── BILL — on delivery only ─────────────────────────────────────────────
        // Deliberately the LAST thing before `done`, so it is unreachable from the three exits
        // above that produce no Read: no personal audience on file (no scrape ran at all), thin
        // history (the scrape ran but the result is a refusal to fabricate), and scrape failure.
        // Each of those `return`s before this line. Charging for them would bill a creator for
        // being told we have nothing to say.
        //
        // A `billUsage` throw cannot reach the creator either — it swallows internally and logs
        // `usage_bill_skipped`, so a missing service key degrades to free-of-record rather than
        // turning a delivered Read into the generic error below.
        await billUsage({ userId: user.id, action: "account", tier: creditVerdict.tier });

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
