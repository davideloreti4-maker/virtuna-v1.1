/**
 * GET /api/earn — the Earn page's data (plan 2026-11-24-earn, steps A and B; rulings 9, 16, 34 and 36):
 * `{ link, code, name, joined, whop }` for the caller (`src/lib/earn/earn-read.ts`). The code is made on
 * first view, for any account. `whop` is the payment side: whether enrolling is possible (Whop's settings,
 * read from the environment now), whether the caller is a paying customer, their username at Whop once
 * enrolled, and what Whop says they earned (read for an enrolled creator only, at most once in five
 * minutes, waiting at most three seconds).
 *
 * 404 with the flag off (before anything is read, not even the session) and for a /go funnel visitor (an
 * anonymous session gets no link); 401 signed out; 429 over the shared per-person rate limit, as it answers
 * (it fails open: without its store the page still answers); 500 `Server error` on a database error, whose
 * text goes to the server log only (the repository is public; no id or code is logged). A GET, so no
 * csrfGuard; its one write is the caller's first code, made on first view. The session client reads the
 * caller's own rows; the service client is used only for the referred accounts' creation times
 * (`auth.users`) and to write that first code (for the session's own id).
 */
import { readEarnPage } from "@/lib/earn/earn-read";
import { whopSettings } from "@/lib/earn/whop-affiliates";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (isSealedVisitor(user)) return notFound();
  // Ruling 34: an enrolled creator's read may call Whop with the key the checkout uses.
  const limited = await rateLimitGuard(user.id, "earn");
  if (limited) return limited;

  try {
    return Response.json(await readEarnPage(supabase, createServiceClient(), user, { http: fetch, settings: whopSettings() }));
  } catch (err) {
    console.error("[earn] page read failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
