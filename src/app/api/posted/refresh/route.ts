/**
 * POST /api/posted/refresh — reads the caller's linked posts that are owed a read (plan
 * 2026-11-24-after-posting, Task 2; the reader is `src/lib/posted/read-posts.ts`: at most 3 scraper runs, and
 * none started after 110 s of the run, rulings 26 and 33).
 *
 * Body `{}` (everything owed), `{ id }` (that post, when owed) or `{ id, retry: true }` ("Try again" of an
 * unread post: read now). Try again is bounded: a post never read is read at most `RETRY_MAX` times (then it
 * comes back as it is, ruling 27), and a post with numbers is closed with them at its `RETRY_MAX`-th failure in
 * a row (ruling 34), after which nothing reads it. An empty body is `{}`.
 *   200 `{ posted: Posted[] }`: the caller's posts the run wrote, as they leave the server (none: `[]`, also
 *   for an id that is not the caller's; a Try again past its bound, ruling 27: that post as it is, unread) ·
 *   429 from the shared per-person rate limit (`rateLimitGuard`, key "posted") · 400 a body that is not one
 *   (`retry` needs an `id`) · 404 with the
 *   flag off and for a funnel visitor · 401 signed out · 415 / 403 `csrfGuard` · 500 `Server error` (a
 *   database error, or no scraper token while a read is owed: then nothing is read or written). With nothing
 *   to read, no scraper is made, so a missing token still answers 200 `{ posted: [] }`.
 *
 * Reading costs the creator no credits (like connecting an account). A failed read is stored on the post and
 * logged by its class, never with the pasted link.
 */

import { z } from "zod";

import { rateLimitGuard } from "@/lib/http/rate-limit";
import { toPosted } from "@/lib/posted/posted";
import { readDue } from "@/lib/posted/read-posts";
import { logFailure, postedGate, refused, serverError } from "@/lib/posted/route-gate";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { createServiceClient } from "@/lib/supabase/service";

// A post read waits up to 180 s on the scraper, and a run may make three.
export const maxDuration = 300;

const RefreshBody = z
  .object({ id: z.string().max(100).optional(), retry: z.boolean().optional() })
  .refine((body) => !body.retry || body.id !== undefined);

export async function POST(request: Request): Promise<Response> {
  const gate = await postedGate(request, true);
  if ("answer" in gate) return gate.answer;
  // The shared per-person limit, after the auth and CSRF gates (ruling 28; fail-open without its store).
  const limited = await rateLimitGuard(gate.userId, "posted");
  if (limited) return limited;

  let body: unknown;
  try {
    const text = await request.text();
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    return refused(400, "Bad request");
  }
  const parsed = RefreshBody.safeParse(body);
  if (!parsed.success) return refused(400, "Bad request");

  const now = new Date();
  try {
    // Made only when a read is owed, before anything is claimed (ruling 23): without a token it throws, and
    // then nothing is read or written.
    const makeScraper = () => new ApifyScrapingProvider();
    const rows = await readDue(createServiceClient(), gate.userId, makeScraper, now, { only: parsed.data.id, retry: parsed.data.retry });
    return Response.json({ posted: rows.map((row) => toPosted(row, now)) });
  } catch (err) {
    logFailure("refresh", err);
    return serverError();
  }
}
