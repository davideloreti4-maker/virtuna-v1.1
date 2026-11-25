/**
 * GET /api/edit/open → 200 {open}
 *
 * Whether the editor is open to the signed-in account (spec E11; plan 2026-11-24-editor-screens-a, Task 6): Home shows the Edit
 * card and the Edit pill only then, so nobody meets a closed door. It answers for the account asking and for no other: the list
 * never leaves the server. Signed out, or not on the list: `{open: false}`. 503 when the sign-in service could not be asked.
 */
import { NextResponse } from "next/server";
import { creator, route } from "../creator";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/open", async () => {
  const who = await creator();
  if (who instanceof Response) return who.status === 401 || who.status === 403 ? NextResponse.json({ open: false }) : who;
  return NextResponse.json({ open: true });
});
