/**
 * GET /api/edit/takes → 200 {takes: [{id, name, status, ms, posterUrl}]}
 * POST /api/edit/takes {name, bytes, type} → 201 {take, uploadUrl}
 *
 * GET: first the creator's left-over references are swept (`dropOldReferences`, which never fails the list); then the creator's
 * own takes, newest first, at most 20, and never a reference (part 3, Task 11: a video read into a style and
 * dropped is no take of theirs; `referencesAmong`). `status` is the take's as `GET /api/edit/takes/[id]` gives it (an analysing
 * take's by its latest job); `ms` its length once it is ready, else null; `posterUrl` a signed read of two hours of its poster
 * once it is ready, else null. Nothing is written but what reading a job always writes (a stopped one failed, X41).
 *
 * A take is signed for before it is sent: its row is written `uploading`, and the browser puts the file
 * straight into R2 at `uploadUrl` (X43), then says so at `/api/edit/takes/<id>/uploaded`. MP4 and QuickTime
 * only, at most 2 GB; its length is measured by the worker and held to ten minutes then (X56).
 *
 * The PUT's address binds the file's size and type (both are signed into it), so R2 takes no other file.
 * It is signed before the row is written, so a signing failure leaves no row.
 *
 * 401 without a creator, 403 for one the edit tool is not open to · POST: 415/403 for a body that is not JSON or a call
 * from another origin · 400 for a body that is not a take's.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { dropOldReferences, referencesAmong } from "@/lib/edit/style/reference";
import { latestJob } from "@/lib/edit/worker/jobs";
import { folderOf, isUnder, signGet, signPut, takeKey } from "@/lib/edit/worker/r2";
import { UploadSchema, takeState, takeView, type TakeRow } from "@/lib/edit/worker/takes";
import type { Json } from "@/types/database.types";
import { creator, log, refuse, route, type Creator } from "../creator";

export const dynamic = "force-dynamic";

/** The most takes the list gives; and how many rows are read a page, so that references left out still leave enough. */
const LISTED = 20;
const PAGE = 40;

export const GET = route("GET /api/edit/takes", async () => {
  const who = await creator();
  if (who instanceof Response) return who;
  const service = createServiceClient();
  // The page's first call: the creator's left-over references go here too, not only on their next reference (D-I1). It never
  // throws, so the list is never failed by it.
  await dropOldReferences(who.session, service, who.user);
  const takes = await ownTakes(who);
  const now = Date.now();
  const listed = await Promise.all(
    takes.map(async (take) => {
      const latest = take.status === "analysing" ? await latestJob(who.session, service, who.user, take.id, now) : undefined;
      const { status } = takeState(stateOf(take), latest, now);
      return { id: take.id, name: take.name, status, ms: status === "ready" ? msOf(take) : null, posterUrl: status === "ready" ? await posterOf(who.user, take) : null };
    }),
  );
  return NextResponse.json({ takes: listed });
});

/**
 * What the list reads of a take: the columns its answer and its state need, and of its analysis only the keys of its files and
 * the upload's mark (`analysis->files`, `analysis->reference`); never its whole analysis or its words.
 */
const LISTED_COLUMNS = "id,name,status,error,facts,created_at,updated_at,files:analysis->files,mark:analysis->reference";
interface Listed {
  id: string;
  name: string;
  status: string;
  error: string | null;
  facts: Json | null;
  created_at: string;
  updated_at: string;
  files: Json | null;
  mark: Json | null;
}

/**
 * The creator's takes, newest first, at most `LISTED`, references left out: read through their session a page at a time, each
 * page after the last one's oldest, until enough are found or none are left (five pages at most).
 */
async function ownTakes(who: Creator): Promise<Listed[]> {
  const found: Listed[] = [];
  let before: string | null = null;
  for (let page = 0; page < 5 && found.length < LISTED; page++) {
    let asked = who.session.from("edit_takes").select(LISTED_COLUMNS).eq("user_id", who.user).order("created_at", { ascending: false }).limit(PAGE);
    if (before !== null) asked = asked.lt("created_at", before);
    const { data, error } = await asked.returns<Listed[]>();
    if (error) throw new Error(`the creator's takes could not be read: ${error.message}`);
    const references = await referencesAmong(who.session, who.user, data.map((take) => ({ id: take.id, analysis: { reference: take.mark } })));
    found.push(...data.filter((take) => !references.has(take.id)));
    if (data.length < PAGE) break;
    before = data.at(-1)!.created_at;
  }
  return found.slice(0, LISTED);
}

/** A listed take as `takeState` reads it: its status, error, name, length and when it was touched; the rest it does not read. */
const stateOf = (take: Listed): TakeRow => ({ ...take, user_id: "", bytes: 0, source_path: "", words: null, analysis: null });

const msOf = (take: Listed): number | null => {
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  return typeof ms === "number" ? ms : null;
};

/** A signed read of a ready take's poster, or null when its row names none inside its folder (logged: the list still answers). */
async function posterOf(user: string, take: Listed): Promise<string | null> {
  const poster = (take.files as { poster?: unknown } | null)?.poster;
  if (typeof poster !== "string") return null;
  if (!isUnder(poster, folderOf(user, { take: take.id }))) {
    log.error("a take's poster is kept outside its folder; it is listed without one", { take: take.id });
    return null;
  }
  return signGet(poster);
}

export const POST = route("POST /api/edit/takes", async (request: Request) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body: unknown = await request.json().catch(() => undefined);
  if (typeof body !== "object" || body === null) return refuse(400, "the body is {name, bytes, type}");
  const asked = UploadSchema.safeParse(body);
  if (!asked.success) return refuse(400, asked.error.issues.map((issue) => issue.message).join("; "));

  const id = randomUUID();
  const source = takeKey(who.user, id, "source");
  const uploadUrl = await signPut(source, asked.data.bytes, asked.data.type);
  const { data: take, error } = await createServiceClient()
    .from("edit_takes")
    .insert({ id, user_id: who.user, name: asked.data.name, bytes: asked.data.bytes, source_path: source })
    .select()
    .single();
  if (error) throw new Error(`the take could not be written: ${error.message}`);
  return NextResponse.json({ take: takeView(take, takeState(take)), uploadUrl }, { status: 201 });
});
