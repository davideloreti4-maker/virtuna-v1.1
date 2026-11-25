/**
 * route-gate.ts — what every `/api/posted` handler opens with (plan 2026-11-24-after-posting, Task 2), and how
 * they answer and log a failure.
 *
 * SERVER ONLY. The gate, in order: the flag (off: 404 before anything is read, not even the session), the
 * session (401 signed out), the funnel wall (404 for a /go visitor: nothing of a simulation reaches one,
 * `verdict-seal.ts`), and on a write `csrfGuard` (415 / 403). The session client is used for auth only:
 * every table call goes through the service client with the caller's id from the session (ruling 12).
 */

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { IngestError } from "@/lib/scraping/types";
import { createClient } from "@/lib/supabase/server";

export const notFound = (): Response => Response.json({ error: "Not found" }, { status: 404 });
export const refused = (status: number, error: string): Response => Response.json({ error }, { status });
export const serverError = (): Response => Response.json({ error: "Server error" }, { status: 500 });

/** The caller's id, or the answer that ends the request. */
export async function postedGate(request: Request, write: boolean): Promise<{ userId: string } | { answer: Response }> {
  if (!NEW_LOOK_ENABLED) return { answer: notFound() };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { answer: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (isSealedVisitor(user)) return { answer: notFound() };
  if (write) {
    const guard = csrfGuard(request);
    if (guard) return { answer: guard };
  }
  return { userId: user.id };
}

/**
 * Logs a failed request under the routes' prefix. A database error by its text (the repository's carry the
 * database's message only); the scraper's error by its kind, never its text (it carries the pasted link).
 */
export function logFailure(what: string, err: unknown): void {
  const words = err instanceof IngestError ? `IngestError[${err.kind}]` : err instanceof Error ? err.message : String(err);
  console.error(`[posted] ${what} failed:`, words);
}
