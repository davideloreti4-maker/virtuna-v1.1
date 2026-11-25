/**
 * /api/posted — a simulated piece's posted TikTok link (plan 2026-11-24-after-posting, Task 2).
 *
 * POST adds one: body `{ kind: "text", threadId, key, url }` (a text piece by its chat and result-page key)
 * or `{ kind: "video", analysisId, url }`. What Maven said is copied from the piece now and never again. It
 * does NOT read the post: the browser asks `POST /api/posted/refresh` with `{ id }` right after.
 *   201 `{ posted }` · 400 `{ error: "not_tiktok" }` a link `parsePostLink` refuses · 400 a body that is not
 *   one · 404 a piece that is not the caller's · 422 `no_number` a piece whose result page shows no number ·
 *   409 `already_linked` the piece has a live link · 429 `too_many` 20 links in 24 hours (removed ones count) ·
 *   429 from the shared per-person rate limit (`rateLimitGuard`, key "posted"), passed through as it answers.
 *
 * GET answers one piece's live link: `?threadId=&key=` or `?analysisId=` → 200 `{ posted: Posted | null }`;
 * 404 for a query that names no piece. Read-only: no csrfGuard (it 415s every request without a JSON body).
 *
 * Both: 404 with the flag off and for a funnel visitor, 401 signed out, 500 `Server error` on a database error
 * (its text in the server log only, never the pasted link).
 */

import { z } from "zod";

import { pieceSaid, type PieceRef } from "@/lib/posted/piece-said";
import { ANALYSIS_ID_PATTERN, LINKS_PER_DAY, UUID_PATTERN, parsePostLink, toPosted } from "@/lib/posted/posted";
import { insertPost, linksInLastDay, postOfPiece, postOfVideo } from "@/lib/posted/posted-repo";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { logFailure, notFound, postedGate, refused, serverError } from "@/lib/posted/route-gate";
import { createServiceClient } from "@/lib/supabase/service";
import { isSealHash } from "@/lib/thread-next/seal-hash";

/** The link is any text here: `parsePostLink` decides, so a refused one answers `not_tiktok`. */
const Url = z.string().max(10_000);
const AddBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), threadId: z.string().max(100), key: z.string().max(100), url: Url }),
  z.object({ kind: z.literal("video"), analysisId: z.string().max(100), url: Url }),
]);

export async function POST(request: Request): Promise<Response> {
  const gate = await postedGate(request, true);
  if ("answer" in gate) return gate.answer;
  const { userId } = gate;
  // The shared per-person limit, after the auth and CSRF gates (ruling 28; fail-open without its store).
  const limited = await rateLimitGuard(userId, "posted");
  if (limited) return limited;

  const parsed = AddBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refused(400, "Bad request");
  const link = parsePostLink(parsed.data.url);
  if (link === null) return refused(400, "not_tiktok");
  const ref: PieceRef =
    parsed.data.kind === "text"
      ? { kind: "text", threadId: parsed.data.threadId, key: parsed.data.key }
      : { kind: "video", analysisId: parsed.data.analysisId };

  const now = new Date();
  const db = createServiceClient();
  try {
    const said = await pieceSaid(db, userId, ref);
    if (!said.found) return said.why === "no_number" ? refused(422, "no_number") : notFound();
    const { piece } = said;

    // One live link per piece (a video is one piece whichever chat holds it), said before the day's limit.
    const existing =
      piece.pieceKind === "video"
        ? await postOfVideo(db, userId, piece.pieceKey)
        : await postOfPiece(db, userId, { threadId: piece.threadId, pieceKey: piece.pieceKey });
    if (existing) return refused(409, "already_linked");
    if ((await linksInLastDay(db, userId, now)) >= LINKS_PER_DAY) return refused(429, "too_many");

    const row = await insertPost(db, userId, { ...piece, postUrl: link });
    // Null: another request linked the piece in between (the unique index).
    if (!row) return refused(409, "already_linked");
    return Response.json({ posted: toPosted(row, now) }, { status: 201 });
  } catch (err) {
    logFailure("add", err);
    return serverError();
  }
}

export async function GET(request: Request): Promise<Response> {
  const gate = await postedGate(request, false);
  if ("answer" in gate) return gate.answer;
  const { userId } = gate;

  const params = new URL(request.url).searchParams;
  const threadId = params.get("threadId");
  const key = params.get("key");
  const analysisId = params.get("analysisId");
  const isText = threadId !== null && key !== null && analysisId === null;
  const isVideo = analysisId !== null && threadId === null && key === null;
  if (isText ? !UUID_PATTERN.test(threadId) || !isSealHash(key) : !isVideo || !ANALYSIS_ID_PATTERN.test(analysisId!)) return notFound();

  const now = new Date();
  const db = createServiceClient();
  try {
    const row = isText ? await postOfPiece(db, userId, { threadId: threadId!, pieceKey: key! }) : await postOfVideo(db, userId, analysisId!);
    return Response.json({ posted: row ? toPosted(row, now) : null });
  } catch (err) {
    logFailure("read", err);
    return serverError();
  }
}
