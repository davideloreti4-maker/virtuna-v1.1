/**
 * POST /api/edit/edits {take} → 201 {id, threadId}
 *
 * Makes an edit of one of the creator's takes (spec §6, §7; plan 2026-11-24-editor-screens-a, Task 6), which may still be
 * uploading: the edit, a chat of its own, and in that chat one message with one block, `{type: "edit", props: {editId}}`. Its
 * title is the take's file name until the first cut names it from the take's first words.
 *
 * 401/403 as every edit route · 415/403 for a body that is not JSON or a call from another origin · 400 for a body that is not
 * `{take}` · 404 for a take that is not theirs, or is a reference.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { takeTitle } from "@/lib/edit/said";
import { referencesAmong } from "@/lib/edit/style/reference";
import { insertMessage } from "@/lib/threads/messages";
import { createNewThread } from "@/lib/threads/threads";
import { creator, ownTake, refuse, route } from "../creator";

const Body = z.strictObject({ take: z.string().max(64) });

export const POST = route("POST /api/edit/edits", async (request: Request) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, "the body is {take}");
  const take = await ownTake(who, body.data.take);
  if (take instanceof Response) return take;
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take");

  const thread = await createNewThread(who.user);
  const { data: edit, error } = await createServiceClient()
    .from("edits")
    .insert({ user_id: who.user, thread_id: thread.id, take_id: take.id, title: takeTitle(take.name, null) })
    .select()
    .single();
  if (error) throw new Error(`the edit could not be written: ${error.message}`);
  await insertMessage(thread.id, "assistant", [{ type: "edit", props: { editId: edit.id } }]);
  return NextResponse.json({ id: edit.id, threadId: thread.id }, { status: 201 });
});
