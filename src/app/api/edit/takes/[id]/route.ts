/**
 * GET /api/edit/takes/[id] → 200 {take, asset, previewUrl}
 *
 * A take as it stands. Ready, it comes with `asset`, the take as a file of the edit with the worker's facts
 * (N5, X62), and `previewUrl`, a signed read of two hours of its preview copy, which the Player plays (design
 * §8). Otherwise both are null. While it is analysing, its latest job decides its state: a failed or stopped
 * one fails the take with that job's message, and so does having no job two minutes on. The take's row is then
 * written so, filtered on the creator and only if it is still as it was read.
 *
 * 401 without a creator · 404 for a take that is not theirs, or that is a reference (part 3, Task 11: never a take here).
 */
import { NextResponse } from "next/server";
import { referencesAmong } from "@/lib/edit/style/reference";
import { bucket, folderOf, isUnder, signGet } from "@/lib/edit/worker/r2";
import { assetOf, copiesOf, takeView } from "@/lib/edit/worker/takes";
import { creator, ownTake, refuse, route } from "../../creator";
import { takeNow } from "../../take-now";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/takes/[id]", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const take = await ownTake(who, (await context.params).id);
  if (take instanceof Response) return take;
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take"); // read and written nowhere here

  const { state } = await takeNow(who, take);
  if (state.status !== "ready") return NextResponse.json({ take: takeView(take, state), asset: null, previewUrl: null });
  const preview = copiesOf(take).preview;
  if (!isUnder(preview, folderOf(who.user, { take: take.id }))) throw new Error(`take ${take.id}: its preview copy is kept outside its folder`);
  return NextResponse.json({ take: takeView(take, state), asset: assetOf(take, bucket()), previewUrl: await signGet(preview) });
});
